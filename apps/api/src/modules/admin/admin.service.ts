import { Inject, Injectable } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';
import { and, count, desc, eq, gt, ilike, inArray, isNull, lt, or, sql, sum, type SQL } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import {
  type Database, aiConnections, auditLogs, authIdentities, devices, featureFlags, hookPresets, incidents, licenses, mediaAssets, productionRuns,
  renderJobs, sessions, styleCategories, systemSettings, users, visualPresets, voiceProfiles, workerNodes,
} from '@dentweb/database';
import type { PageQuery } from '@dentweb/shared-types';
import { unlink } from 'node:fs/promises';
import { DB, REDIS } from '../../infra/tokens.js';
import { AuditService } from '../../infra/infra.module.js';
import { Cipher } from '../../infra/crypto.js';
import { SettingsService } from '../../infra/settings.service.js';
import { NotificationService } from '../../infra/notifications.service.js';
import { Errors } from '../../infra/errors.js';
import { SessionService } from '../identity/session.service.js';
import { LicenseService } from '../licenses/license.service.js';
import {
  extractSkillsFromFiles,
  normalizeSkill,
  persistSkillFiles,
  readZipAllSkillFilesFromPath,
  readZipSkillFiles,
  slugifySkill,
  type MotionSkill,
  type ParsedSkillBundle,
  type RawSkillFile,
} from './skills.helper.js';

const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(12);
  let out = 'Dw';
  for (let i = 0; i < 10; i++) out += chars[bytes[i]! % chars.length];
  return `${out}9`;
}

@Injectable()
export class AdminService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly sessions: SessionService,
    private readonly licenses: LicenseService,
    private readonly notifications: NotificationService,
    private readonly cipher: Cipher,
  ) {}

  async dashboard() {
    const now = new Date();
    const [[members], [activeSessions], runs, [renderQueue], [storage], [openIncidents], ai, [presetsPublished], [voicesPublished], [categories], [workers]] =
      await Promise.all([
        this.db.select({ n: count() }).from(users).where(and(eq(users.role, 'MEMBER'), isNull(users.deletedAt))),
        this.db.select({ n: count() }).from(sessions).where(and(isNull(sessions.revokedAt), gt(sessions.expiresAt, now))),
        this.db.select({ status: productionRuns.status, n: count() }).from(productionRuns).groupBy(productionRuns.status),
        this.db.select({ n: count() }).from(renderJobs).where(or(eq(renderJobs.status, 'QUEUED'), eq(renderJobs.status, 'RUNNING'))),
        this.db.select({ bytes: sum(mediaAssets.sizeBytes) }).from(mediaAssets).where(eq(mediaAssets.status, 'READY')),
        this.db.select({ n: count() }).from(incidents).where(sql`${incidents.status} <> 'RESOLVED'`),
        this.db.select({ status: aiConnections.status, n: count() }).from(aiConnections).groupBy(aiConnections.status),
        this.db.select({ n: count() }).from(visualPresets).where(eq(visualPresets.status, 'PUBLISHED')),
        this.db.select({ n: count() }).from(voiceProfiles).where(eq(voiceProfiles.status, 'PUBLISHED')),
        this.db.select({ n: count() }).from(styleCategories),
        this.db.select({ n: count() }).from(workerNodes).where(gt(workerNodes.lastHeartbeatAt, new Date(Date.now() - 60_000))),
      ]);
    return {
      totalMembers: members!.n,
      activeSessions: activeSessions!.n,
      productionJobs: Object.fromEntries(runs.map((r) => [r.status, r.n])),
      renderQueue: renderQueue!.n,
      storageBytes: Number(storage!.bytes ?? 0),
      openIncidents: openIncidents!.n,
      aiProviderHealth: Object.fromEntries(ai.map((r) => [r.status, r.n])),
      catalog: { categories: categories!.n, publishedPresets: presetsPublished!.n, publishedVoices: voicesPublished!.n },
      onlineWorkers: workers!.n,
      generatedAt: now,
    };
  }

  async metrics() {
    const t0 = performance.now();
    await this.db.execute(sql`select 1`);
    const dbMs = performance.now() - t0;
    let redisMs: number | null = null;
    try {
      const t1 = performance.now();
      await this.redis.ping();
      redisMs = performance.now() - t1;
    } catch {
      redisMs = null;
    }
    const mem = process.memoryUsage();
    return {
      uptimeSec: Math.round(process.uptime()),
      memory: { rss: mem.rss, heapUsed: mem.heapUsed },
      dbLatencyMs: Math.round(dbMs * 10) / 10,
      redisLatencyMs: redisMs === null ? null : Math.round(redisMs * 10) / 10,
      pool: { total: this.db.$client.totalCount, idle: this.db.$client.idleCount, waiting: this.db.$client.waitingCount },
      node: process.version,
    };
  }

  async members(q: PageQuery & { status?: string; role?: string }) {
    const where: SQL[] = [isNull(users.deletedAt)];
    if (q.q) where.push(or(ilike(users.email, `%${q.q}%`), ilike(users.displayName, `%${q.q}%`))!);
    if (q.status) where.push(eq(users.status, q.status));
    if (q.role) where.push(eq(users.role, q.role));
    if (q.cursor) {
      const [c] = await this.db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, q.cursor));
      if (c) where.push(or(lt(users.createdAt, c.createdAt), and(eq(users.createdAt, c.createdAt), lt(users.id, q.cursor)))!);
    }
    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(...where))
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(q.limit + 1);
    const more = rows.length > q.limit;
    const baseItems = rows.slice(0, q.limit);
    const userIds = baseItems.map((u) => u.id);
    if (userIds.length === 0) return { items: [], nextCursor: null };

    const now = new Date();
    const [licRows, devRows, sessRows] = await Promise.all([
      this.db
        .select({
          userId: licenses.userId,
          status: licenses.status,
          validUntil: licenses.validUntil,
          maxDevices: licenses.maxDevices,
          createdAt: licenses.createdAt,
        })
        .from(licenses)
        .where(inArray(licenses.userId, userIds))
        .orderBy(desc(licenses.createdAt)),
      this.db
        .select({ userId: devices.userId, revokedAt: devices.revokedAt, lastSeenAt: devices.lastSeenAt })
        .from(devices)
        .where(inArray(devices.userId, userIds)),
      this.db
        .select({ userId: sessions.userId, revokedAt: sessions.revokedAt, expiresAt: sessions.expiresAt, lastSeenAt: sessions.lastSeenAt })
        .from(sessions)
        .where(inArray(sessions.userId, userIds)),
    ]);

    const licByUser = new Map<string, (typeof licRows)[number]>();
    for (const l of licRows) {
      const prev = licByUser.get(l.userId);
      const isLiveActive = l.status === 'ACTIVE' && (!l.validUntil || l.validUntil > now);
      const prevLiveActive = prev && prev.status === 'ACTIVE' && (!prev.validUntil || prev.validUntil > now);
      if (!prev || (isLiveActive && !prevLiveActive)) licByUser.set(l.userId, l);
    }

    const items = baseItems.map((u) => {
      const lic = licByUser.get(u.id) ?? null;
      const licenseStatus = lic
        ? lic.status === 'ACTIVE' && lic.validUntil && lic.validUntil <= now
          ? 'EXPIRED'
          : lic.status
        : null;
      const userDevs = devRows.filter((d) => d.userId === u.id);
      const userSess = sessRows.filter((s) => s.userId === u.id);
      const activeDevicesCount = userDevs.filter((d) => !d.revokedAt).length;
      const activeSessionsCount = userSess.filter((s) => !s.revokedAt && s.expiresAt > now).length;
      const seenTs = [
        ...userDevs.map((d) => d.lastSeenAt?.getTime() ?? 0),
        ...userSess.map((s) => s.lastSeenAt?.getTime() ?? 0),
      ].filter((t) => t > 0);
      const lastSeenAt = seenTs.length > 0 ? new Date(Math.max(...seenTs)).toISOString() : null;
      return {
        ...u,
        licenseStatus,
        licenseValidUntil: lic?.validUntil ? lic.validUntil.toISOString() : null,
        licenseMaxDevices: lic?.maxDevices ?? null,
        activeDevicesCount,
        activeSessionsCount,
        lastSeenAt,
      };
    });
    return { items, nextCursor: more ? items[items.length - 1]!.id : null };
  }

  async member(id: string) {
    const [u] = await this.db.select().from(users).where(and(eq(users.id, id), isNull(users.deletedAt)));
    if (!u) throw Errors.notFound('Member');
    const [license, devs, activeSessions, history, licenseHistory] = await Promise.all([
      this.licenses.summary(id),
      this.licenses.listDevices(id),
      this.db
        .select({ id: sessions.id, client: sessions.client, ipAddress: sessions.ipAddress, userAgent: sessions.userAgent, lastSeenAt: sessions.lastSeenAt, expiresAt: sessions.expiresAt })
        .from(sessions)
        .where(and(eq(sessions.userId, id), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
        .orderBy(desc(sessions.lastSeenAt)),
      this.db.select().from(auditLogs).where(eq(auditLogs.actorId, id)).orderBy(desc(auditLogs.createdAt)).limit(50),
      this.db.select().from(licenses).where(eq(licenses.userId, id)).orderBy(desc(licenses.createdAt)),
    ]);
    return { user: u, license, licenseHistory, devices: devs, sessions: activeSessions, accessHistory: history };
  }

  async setStatus(actorId: string, id: string, status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED', reason: string | undefined, ip?: string) {
    if (actorId === id) throw Errors.invalid('SELF_STATUS', 'Tidak dapat mengubah status akun sendiri');
    const [u] = await this.db.update(users).set({ status }).where(and(eq(users.id, id), isNull(users.deletedAt))).returning();
    if (!u) throw Errors.notFound('Member');
    if (status !== 'ACTIVE') await this.sessions.revokeAllForUser(id);
    await this.audit.log({ actorId, action: 'member.status', targetType: 'user', targetId: id, metadata: { status, reason }, ip });
    await this.notifications.notify(id, 'member.status_changed', { status, reason: reason ?? null }).catch(() => undefined);
    return { id: u.id, status: u.status };
  }

  async revokeSession(actorId: string, sessionId: string) {
    await this.sessions.revoke(sessionId);
    await this.audit.log({ actorId, action: 'session.revoke', targetType: 'session', targetId: sessionId });
    return { ok: true };
  }

  async createMember(
    actorId: string,
    input: { displayName: string; email: string; password?: string; role?: 'MEMBER' | 'SUPERADMIN'; grantLicenseDays?: number; maxDevices?: number },
    ip?: string,
  ) {
    const email = input.email.trim().toLowerCase();
    const [existing] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existing) throw Errors.conflict('EMAIL_EXISTS', 'Email sudah terdaftar');

    const temporaryPassword = input.password?.trim() || generateTempPassword();
    const secretHash = await hash(temporaryPassword, ARGON);

    const user = await this.db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({
          email,
          displayName: input.displayName.trim(),
          role: input.role ?? 'MEMBER',
          status: 'ACTIVE',
        })
        .returning();
      await tx.insert(authIdentities).values({
        userId: u!.id,
        provider: 'password',
        providerSubject: email,
        secretHash,
      });
      return u!;
    });

    if (input.grantLicenseDays && input.grantLicenseDays > 0) {
      const validUntil = new Date(Date.now() + input.grantLicenseDays * 86_400_000).toISOString();
      await this.licenses.grant(
        actorId,
        {
          userId: user.id,
          maxDevices: input.maxDevices ?? 2,
          validUntil,
          entitlements: { maxWorkers: 2, maxVideosPerDay: 10, cloudRender: true, cloudRenderMinutesPerMonth: 120 },
        },
        ip,
      );
    }

    await this.audit.log({ actorId, action: 'member.create', targetType: 'user', targetId: user.id, metadata: { email, role: user.role }, ip });
    return { user, temporaryPassword };
  }

  async updateMember(
    actorId: string,
    id: string,
    patch: { displayName?: string; email?: string; role?: 'MEMBER' | 'SUPERADMIN'; status?: 'ACTIVE' | 'SUSPENDED' | 'DISABLED' },
    ip?: string,
  ) {
    if (actorId === id && (patch.role === 'MEMBER' || (patch.status && patch.status !== 'ACTIVE'))) {
      throw Errors.invalid('SELF_EDIT_FORBIDDEN', 'Tidak dapat menurunkan role atau menonaktifkan akun sendiri');
    }
    const [cur] = await this.db.select().from(users).where(and(eq(users.id, id), isNull(users.deletedAt)));
    if (!cur) throw Errors.notFound('Member');

    const nextEmail = patch.email ? patch.email.trim().toLowerCase() : undefined;
    if (nextEmail && nextEmail !== cur.email) {
      const [dup] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, nextEmail));
      if (dup) throw Errors.conflict('EMAIL_EXISTS', 'Email sudah digunakan oleh akun lain');
    }

    const [updated] = await this.db
      .update(users)
      .set({
        ...(patch.displayName ? { displayName: patch.displayName.trim() } : {}),
        ...(nextEmail ? { email: nextEmail } : {}),
        ...(patch.role ? { role: patch.role } : {}),
        ...(patch.status ? { status: patch.status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    if (nextEmail && nextEmail !== cur.email) {
      await this.db
        .update(authIdentities)
        .set({ providerSubject: nextEmail })
        .where(and(eq(authIdentities.userId, id), eq(authIdentities.provider, 'password')));
    }
    if (patch.status && patch.status !== 'ACTIVE') {
      await this.sessions.revokeAllForUser(id);
    }
    if (patch.status && patch.status !== cur.status) {
      await this.notifications.notify(id, 'member.status_changed', { status: patch.status }).catch(() => undefined);
    }
    await this.audit.log({ actorId, action: 'member.update', targetType: 'user', targetId: id, metadata: patch, ip });
    return updated!;
  }

  async resetMemberPassword(
    actorId: string,
    id: string,
    input: { newPassword?: string; revokeSessions?: boolean },
    ip?: string,
  ) {
    const [u] = await this.db.select().from(users).where(and(eq(users.id, id), isNull(users.deletedAt)));
    if (!u) throw Errors.notFound('Member');
    const temporaryPassword = input.newPassword?.trim() || generateTempPassword();
    const secretHash = await hash(temporaryPassword, ARGON);

    const [existingAuth] = await this.db
      .select({ id: authIdentities.id })
      .from(authIdentities)
      .where(and(eq(authIdentities.userId, id), eq(authIdentities.provider, 'password')));
    if (existingAuth) {
      await this.db.update(authIdentities).set({ secretHash, providerSubject: u.email }).where(eq(authIdentities.id, existingAuth.id));
    } else {
      await this.db.insert(authIdentities).values({ userId: id, provider: 'password', providerSubject: u.email, secretHash });
    }

    if (input.revokeSessions !== false) {
      await this.sessions.revokeAllForUser(id);
    }
    await this.audit.log({ actorId, action: 'member.reset_password', targetType: 'user', targetId: id, metadata: { revokeSessions: input.revokeSessions !== false }, ip });
    return { ok: true, temporaryPassword };
  }

  async revokeAllSessions(actorId: string, id: string, ip?: string) {
    const [u] = await this.db.select({ id: users.id }).from(users).where(and(eq(users.id, id), isNull(users.deletedAt)));
    if (!u) throw Errors.notFound('Member');
    const revoked = await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, id), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });
    await this.audit.log({ actorId, action: 'member.revoke_all_sessions', targetType: 'user', targetId: id, metadata: { revokedCount: revoked.length }, ip });
    return { ok: true, revokedCount: revoked.length };
  }

  async officePresence() {
    const now = new Date();
    const nowMs = now.getTime();
    const [allUsers, activeSess, activeDevs, activeRuns, activeRenders, recentLogs] = await Promise.all([
      this.db.select({ id: users.id, displayName: users.displayName, email: users.email, role: users.role, status: users.status }).from(users).where(isNull(users.deletedAt)).orderBy(desc(users.createdAt)).limit(200),
      this.db.select({ userId: sessions.userId, client: sessions.client, lastSeenAt: sessions.lastSeenAt }).from(sessions).where(and(isNull(sessions.revokedAt), gt(sessions.expiresAt, now))),
      this.db.select({ userId: devices.userId, platform: devices.platform, lastSeenAt: devices.lastSeenAt }).from(devices).where(isNull(devices.revokedAt)),
      this.db
        .select({ userId: productionRuns.userId, topic: productionRuns.topic, currentStage: productionRuns.currentStage, progress: productionRuns.progress, status: productionRuns.status })
        .from(productionRuns)
        .where(inArray(productionRuns.status, ['QUEUED', 'RUNNING'])),
      this.db
        .select({ userId: renderJobs.userId, mode: renderJobs.mode, progress: renderJobs.progress, status: renderJobs.status })
        .from(renderJobs)
        .where(inArray(renderJobs.status, ['QUEUED', 'RUNNING'])),
      this.db
        .select({ id: auditLogs.id, action: auditLogs.action, createdAt: auditLogs.createdAt, actorEmail: users.email })
        .from(auditLogs)
        .leftJoin(users, eq(users.id, auditLogs.actorId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(15),
    ]);

    const members = allUsers.map((u) => {
      const uSess = activeSess.filter((s) => s.userId === u.id);
      const uDevs = activeDevs.filter((d) => d.userId === u.id);
      const uRun = activeRuns.find((r) => r.userId === u.id);
      const uRender = activeRenders.find((r) => r.userId === u.id);

      const latestSess = uSess.sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())[0];
      const latestDev = uDevs.sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())[0];
      const lastSeenDate = [latestSess?.lastSeenAt, latestDev?.lastSeenAt]
        .filter((d): d is Date => Boolean(d))
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
      const ageMs = lastSeenDate ? nowMs - lastSeenDate.getTime() : Infinity;

      let presence: 'PRODUCING' | 'ONLINE' | 'IDLE' | 'OFFLINE' = 'OFFLINE';
      let room: 'RENDER_ROOM' | 'WORKSPACE' | 'MEETING' | 'LOUNGE' = 'LOUNGE';
      let activity = 'Sedang offline';
      let stage: string | null = null;
      let progress: number | null = null;

      if (uRun || uRender) {
        presence = 'PRODUCING';
        room = 'RENDER_ROOM';
        stage = uRun?.currentStage ?? (uRender ? `RENDER_${uRender.mode}` : 'PRODUCTION');
        progress = uRun?.progress ?? uRender?.progress ?? 0;
        activity = uRun?.topic ? `Produksi: ${uRun.topic}` : `Render ${uRender?.mode ?? 'video'} (${progress}%)`;
      } else if (uSess.length > 0 && ageMs <= 15 * 60_000) {
        presence = 'ONLINE';
        room = u.role === 'SUPERADMIN' ? 'MEETING' : 'WORKSPACE';
        activity = u.role === 'SUPERADMIN' ? 'Memantau Control Center' : 'Aktif di DENTSWEB Studio';
      } else if (uSess.length > 0 || ageMs <= 24 * 60 * 60_000) {
        presence = 'IDLE';
        room = 'LOUNGE';
        activity = 'Sesi aktif (istirahat)';
      }

      return {
        id: u.id,
        displayName: u.displayName,
        email: u.email,
        role: u.role,
        status: u.status,
        presence,
        room,
        activity,
        stage,
        progress,
        platform: latestDev?.platform ?? latestSess?.client ?? null,
        lastSeenAt: lastSeenDate ? lastSeenDate.toISOString() : null,
        activeSessions: uSess.length,
      };
    });

    const summary = {
      total: members.length,
      producing: members.filter((m) => m.presence === 'PRODUCING').length,
      online: members.filter((m) => m.presence === 'ONLINE').length,
      idle: members.filter((m) => m.presence === 'IDLE').length,
      offline: members.filter((m) => m.presence === 'OFFLINE').length,
    };

    return {
      members,
      summary,
      recentEvents: recentLogs.map((l) => ({
        id: l.id,
        actorEmail: l.actorEmail ?? 'system',
        action: l.action,
        createdAt: l.createdAt.toISOString(),
      })),
      serverTime: now.toISOString(),
    };
  }

  async allLicenses(q: PageQuery & { status?: string }) {
    const now = new Date();
    const where: SQL[] = [];
    if (q.status === 'EXPIRED') {
      where.push(or(eq(licenses.status, 'EXPIRED'), and(eq(licenses.status, 'ACTIVE'), lt(licenses.validUntil, now)))!);
    } else if (q.status === 'ACTIVE') {
      where.push(and(eq(licenses.status, 'ACTIVE'), or(isNull(licenses.validUntil), gt(licenses.validUntil, now)))!);
    } else if (q.status) {
      where.push(eq(licenses.status, q.status));
    }
    if (q.cursor) {
      const [c] = await this.db.select({ createdAt: licenses.createdAt }).from(licenses).where(eq(licenses.id, q.cursor));
      if (c) where.push(lt(licenses.createdAt, c.createdAt));
    }
    const rows = await this.db
      .select({ license: licenses, email: users.email, displayName: users.displayName })
      .from(licenses)
      .innerJoin(users, eq(users.id, licenses.userId))
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(licenses.createdAt))
      .limit(q.limit + 1);
    const more = rows.length > q.limit;
    const items = rows.slice(0, q.limit).map((r) => {
      const expired = r.license.status === 'ACTIVE' && r.license.validUntil && r.license.validUntil <= now;
      return expired ? { ...r, license: { ...r.license, status: 'EXPIRED' } } : r;
    });
    return { items, nextCursor: more ? items[items.length - 1]!.license.id : null };
  }

  async allDevices(q: PageQuery) {
    const rows = await this.db
      .select({ device: devices, email: users.email })
      .from(devices)
      .innerJoin(users, eq(users.id, devices.userId))
      .where(q.q ? or(ilike(users.email, `%${q.q}%`), ilike(devices.label, `%${q.q}%`)) : undefined)
      .orderBy(desc(devices.lastSeenAt))
      .limit(q.limit);
    return { items: rows, nextCursor: null };
  }

  async revokeDevice(actorId: string, deviceId: string, ip?: string) {
    const [d] = await this.db.select().from(devices).where(eq(devices.id, deviceId));
    if (!d) throw Errors.notFound('Perangkat');
    return this.licenses.releaseDevice(actorId, d.userId, deviceId, ip);
  }

  async auditLogs(q: PageQuery & { action?: string; actorId?: string }) {
    const where: SQL[] = [];
    if (q.action) where.push(ilike(auditLogs.action, `${q.action}%`));
    if (q.actorId) where.push(eq(auditLogs.actorId, q.actorId));
    if (q.cursor) {
      const [c] = await this.db.select({ createdAt: auditLogs.createdAt }).from(auditLogs).where(eq(auditLogs.id, q.cursor));
      if (c) where.push(or(lt(auditLogs.createdAt, c.createdAt), and(eq(auditLogs.createdAt, c.createdAt), lt(auditLogs.id, q.cursor)))!);
    }
    const rows = await this.db
      .select({ log: auditLogs, actorEmail: users.email })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(q.limit + 1);
    const more = rows.length > q.limit;
    const items = rows.slice(0, q.limit);
    return { items, nextCursor: more ? items[items.length - 1]!.log.id : null };
  }

  listSettings() {
    return this.db.select().from(systemSettings).orderBy(systemSettings.key);
  }

  async patchSetting(actorId: string, key: string, value: unknown) {
    const [prev] = await this.db.select().from(systemSettings).where(eq(systemSettings.key, key));
    if (!prev) throw Errors.notFound('Setting');
    if (typeof prev.value !== typeof value) throw Errors.invalid('SETTING_TYPE', `Tipe nilai harus ${typeof prev.value}`);
    const [row] = await this.db.update(systemSettings).set({ value: value as never, updatedBy: actorId }).where(eq(systemSettings.key, key)).returning();
    this.settings.invalidate(key);
    await this.audit.log({ actorId, action: 'settings.update', targetType: 'system_setting', metadata: { key, from: prev.value, to: value } });
    return row;
  }

  listFlags() {
    return this.db.select().from(featureFlags).orderBy(featureFlags.key);
  }

  async patchFlag(actorId: string, key: string, enabled: boolean) {
    const [row] = await this.db.update(featureFlags).set({ enabled }).where(eq(featureFlags.key, key)).returning();
    if (!row) throw Errors.notFound('Feature flag');
    this.settings.invalidate(key);
    await this.audit.log({ actorId, action: 'flags.update', targetType: 'feature_flag', metadata: { key, enabled } });
    return row;
  }

  async workers() {
    const rows = await this.db.select().from(workerNodes).orderBy(desc(workerNodes.lastHeartbeatAt));
    const cutoff = Date.now() - 60_000;
    return rows.map((w) => {
      const online = w.lastHeartbeatAt && w.lastHeartbeatAt.getTime() > cutoff;
      return { ...w, status: online ? 'ONLINE' : 'OFFLINE' };
    });
  }

  // ---- Incidents CRUD ----
  listIncidents() {
    return this.db.select().from(incidents).orderBy(desc(incidents.createdAt)).limit(100);
  }

  async createIncident(actorId: string, i: { title: string; severity: string; affectedServices?: string[]; rootCause?: string; recoverySteps?: string; preventive?: string }) {
    const [row] = await this.db
      .insert(incidents)
      .values({
        title: i.title,
        severity: i.severity,
        status: 'OPEN',
        affectedServices: i.affectedServices ?? [],
        rootCause: i.rootCause ?? null,
        recoverySteps: i.recoverySteps ?? null,
        preventive: i.preventive ?? null,
      })
      .returning();
    await this.audit.log({ actorId, action: 'incident.create', targetType: 'incident', targetId: row!.id, metadata: { severity: i.severity } });
    return row;
  }

  async patchIncident(actorId: string, id: string, i: { title?: string; severity?: string; status?: string; affectedServices?: string[]; rootCause?: string | null; recoverySteps?: string | null; preventive?: string | null }) {
    const [cur] = await this.db.select().from(incidents).where(eq(incidents.id, id));
    if (!cur) throw Errors.notFound('Incident');
    const resolvedAt = i.status === 'RESOLVED' ? (cur.resolvedAt ?? new Date()) : i.status ? null : cur.resolvedAt;
    const [row] = await this.db
      .update(incidents)
      .set({ ...i, resolvedAt })
      .where(eq(incidents.id, id))
      .returning();
    await this.audit.log({ actorId, action: 'incident.update', targetType: 'incident', targetId: id, metadata: { status: row!.status } });
    return row;
  }

  // ---- Motion Skills CMS (stored in system_settings key 'motion.skills') ----
  private async saveSkills(actorId: string, next: MotionSkill[]) {
    await this.db
      .insert(systemSettings)
      .values({ key: 'motion.skills', value: next, updatedBy: actorId })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value: next, updatedBy: actorId, updatedAt: new Date() } });
    this.settings.invalidate('motion.skills');
  }

  async listSkills(): Promise<MotionSkill[]> {
    const list = await this.settings.raw<(Partial<MotionSkill> & { id: string; name: string; content: string })[]>('motion.skills', []);
    return Array.isArray(list) ? list.filter((s) => s && s.id && s.name).map(normalizeSkill) : [];
  }

  async addSkill(actorId: string, i: { name: string; description?: string; content: string; active?: boolean }) {
    const current = await this.listSkills();
    const now = new Date().toISOString();
    const data = Buffer.from(i.content, 'utf8');
    const storagePath = await persistSkillFiles(i.name, [{ path: 'SKILL.md', data }]);
    const skill: MotionSkill = {
      id: crypto.randomUUID(),
      name: i.name,
      description: i.description ?? '',
      content: i.content,
      active: i.active ?? true,
      sourceType: 'manual',
      filesCount: 1,
      files: ['SKILL.md'],
      totalBytes: data.length,
      storagePath,
      createdAt: now,
      updatedAt: now,
    };
    const next = [skill, ...current];
    await this.saveSkills(actorId, next);
    await this.audit.log({ actorId, action: 'skill.create', targetType: 'motion_skill', targetId: skill.id, metadata: { name: skill.name, sourceType: 'manual' } });
    return skill;
  }

  async patchSkill(actorId: string, id: string, patch: { name?: string; description?: string; content?: string; active?: boolean }) {
    const current = await this.listSkills();
    const idx = current.findIndex((s) => s.id === id);
    if (idx === -1) throw Errors.notFound('Motion skill');
    const prev = current[idx]!;
    const updated: MotionSkill = {
      ...prev,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.content !== undefined ? { content: patch.content } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      updatedAt: new Date().toISOString(),
    };
    if (patch.content !== undefined || patch.name !== undefined) {
      const data = Buffer.from(updated.content, 'utf8');
      updated.storagePath = await persistSkillFiles(updated.name, [{ path: 'SKILL.md', data }]);
      if (updated.filesCount <= 1) updated.totalBytes = data.length;
    }
    const next = current.map((s, i) => (i === idx ? updated : s));
    await this.saveSkills(actorId, next);
    await this.audit.log({ actorId, action: 'skill.update', targetType: 'motion_skill', targetId: id, metadata: { name: updated.name, active: updated.active } });
    return updated;
  }

  private async upsertSkills(actorId: string, bundles: ParsedSkillBundle[], sourceType: 'zip' | 'folder') {
    if (!bundles.length) throw Errors.invalid('SKILL_EMPTY', 'Tidak ada file SKILL.md / .md yang valid ditemukan');
    const current = await this.listSkills();
    const now = new Date().toISOString();
    const next = [...current];
    const imported: MotionSkill[] = [];

    for (const b of bundles) {
      const slug = slugifySkill(b.name);
      const storagePath = await persistSkillFiles(b.name, b.files);
      const existingIdx = next.findIndex((s) => slugifySkill(s.name) === slug || s.name.toLowerCase() === b.name.toLowerCase());
      let item: MotionSkill;
      if (existingIdx >= 0) {
        const prev = next[existingIdx]!;
        item = {
          ...prev,
          name: b.name,
          description: b.description || prev.description,
          content: b.content,
          active: true,
          sourceType,
          filesCount: b.filesCount,
          files: b.fileList,
          totalBytes: b.totalBytes,
          storagePath,
          updatedAt: now,
        };
        next[existingIdx] = item;
      } else {
        item = {
          id: crypto.randomUUID(),
          name: b.name,
          description: b.description,
          content: b.content,
          active: true,
          sourceType,
          filesCount: b.filesCount,
          files: b.fileList,
          totalBytes: b.totalBytes,
          storagePath,
          createdAt: now,
          updatedAt: now,
        };
        next.unshift(item);
      }
      imported.push(item);
    }

    await this.saveSkills(actorId, next);
    await this.audit.log({
      actorId,
      action: `skill.upload_${sourceType}`,
      targetType: 'motion_skill',
      metadata: { count: imported.length, names: imported.map((s) => s.name) },
    });
    return { imported, count: imported.length };
  }

  async uploadSkillZip(actorId: string, file: Express.Multer.File) {
    if (!file || (!file.path && !file.buffer?.length)) throw Errors.invalid('SKILL_ZIP_EMPTY', 'File ZIP tidak boleh kosong');
    if (!file.originalname.toLowerCase().endsWith('.zip')) {
      if (file.path) await unlink(file.path).catch(() => undefined);
      throw Errors.invalid('SKILL_ZIP_TYPE', 'File harus berformat .zip');
    }
    try {
      let rawFiles: RawSkillFile[];
      try {
        rawFiles = file.path ? await readZipAllSkillFilesFromPath(file.path) : await readZipSkillFiles(file.buffer);
      } catch (e) {
        throw Errors.invalid('SKILL_ZIP_INVALID', (e as Error).message || 'Arsip ZIP tidak valid');
      }
      const fallbackName = file.originalname.replace(/\.zip$/i, '');
      const bundles = extractSkillsFromFiles(rawFiles, fallbackName);
      return await this.upsertSkills(actorId, bundles, 'zip');
    } finally {
      if (file.path) await unlink(file.path).catch(() => undefined);
    }
  }

  async uploadSkillFolder(actorId: string, body: { folderName?: string; files: { path: string; content?: string; base64?: string }[] }) {
    let bundles: ParsedSkillBundle[];
    try {
      bundles = extractSkillsFromFiles(body.files, body.folderName);
    } catch (e) {
      throw Errors.invalid('SKILL_FOLDER_INVALID', (e as Error).message || 'Folder skill tidak valid');
    }
    return this.upsertSkills(actorId, bundles, 'folder');
  }

  // ---- Dynamic OAuth Client Config (Superadmin, stored in system_settings['ai.oauth_clients']) ----
  async getOAuthClients() {
    type OAuthClientMap = Record<string, { clientId?: string; clientSecretEnc?: string; redirectUri?: string }>;
    const stored = await this.settings
      .raw<OAuthClientMap>('ai.oauth_clients', {})
      .catch((): OAuthClientMap => ({}));
    const fmt = (code: 'gemini' | 'openai') => {
      const entry = stored?.[code];
      const envId = code === 'gemini' ? process.env.GOOGLE_OAUTH_CLIENT_ID : undefined;
      const clientId = entry?.clientId || envId || '';
      return {
        clientId,
        hasSecret: Boolean(entry?.clientSecretEnc || (code === 'gemini' && process.env.GOOGLE_OAUTH_CLIENT_SECRET)),
        redirectUri: entry?.redirectUri || '',
        configured: Boolean(clientId),
      };
    };
    return { gemini: fmt('gemini'), openai: fmt('openai') };
  }

  async patchOAuthClients(
    actorId: string,
    body: {
      gemini?: { clientId?: string; clientSecret?: string; redirectUri?: string };
      openai?: { clientId?: string; clientSecret?: string; redirectUri?: string };
    },
  ) {
    const current = await this.settings
      .raw<Record<string, { clientId?: string; clientSecretEnc?: string; redirectUri?: string }>>('ai.oauth_clients', {})
      .catch(() => ({}));
    const next: Record<string, { clientId?: string; clientSecretEnc?: string; redirectUri?: string }> = { ...current };

    for (const code of ['gemini', 'openai'] as const) {
      const patch = body[code];
      if (!patch) continue;
      const prev = next[code] ?? {};
      next[code] = {
        clientId: patch.clientId !== undefined ? patch.clientId.trim() : prev.clientId,
        redirectUri: patch.redirectUri !== undefined ? patch.redirectUri.trim() : prev.redirectUri,
        clientSecretEnc:
          patch.clientSecret !== undefined
            ? patch.clientSecret.trim()
              ? this.cipher.encrypt(patch.clientSecret.trim(), `oauth-client:${code}`)
              : undefined
            : prev.clientSecretEnc,
      };
    }

    await this.db
      .insert(systemSettings)
      .values({ key: 'ai.oauth_clients', value: next, updatedBy: actorId })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value: next, updatedBy: actorId, updatedAt: new Date() } });
    this.settings.invalidate('ai.oauth_clients');
    await this.audit.log({ actorId, action: 'ai.oauth_clients.update', targetType: 'system_setting', targetId: 'ai.oauth_clients' });
    return this.getOAuthClients();
  }

  async deleteSkill(actorId: string, id: string) {
    const current = await this.listSkills();
    const next = current.filter((s) => s.id !== id);
    if (next.length === current.length) throw Errors.notFound('Motion skill');
    await this.saveSkills(actorId, next);
    await this.audit.log({ actorId, action: 'skill.delete', targetType: 'motion_skill', targetId: id });
    return { ok: true, id };
  }

  async catalogCounts() {
    const [p] = await this.db.select({ n: count() }).from(visualPresets);
    const [v] = await this.db.select({ n: count() }).from(voiceProfiles);
    const [h] = await this.db.select({ n: count() }).from(hookPresets);
    return { presets: p!.n, voices: v!.n, hooks: h!.n };
  }
}
