import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, gt, ilike, isNull, lt, or, sql, sum, type SQL } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import {
  type Database, aiConnections, auditLogs, devices, featureFlags, hookPresets, incidents, licenses, mediaAssets, productionRuns,
  renderJobs, sessions, styleCategories, systemSettings, users, visualPresets, voiceProfiles, workerNodes,
} from '@dentweb/database';
import type { PageQuery } from '@dentweb/shared-types';
import { DB, REDIS } from '../../infra/tokens.js';
import { AuditService } from '../../infra/infra.module.js';
import { SettingsService } from '../../infra/settings.service.js';
import { Errors } from '../../infra/errors.js';
import { SessionService } from '../identity/session.service.js';
import { LicenseService } from '../licenses/license.service.js';

@Injectable()
export class AdminService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly sessions: SessionService,
    private readonly licenses: LicenseService,
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
        id: users.id, email: users.email, displayName: users.displayName, role: users.role, status: users.status, createdAt: users.createdAt,
        licenseStatus: sql<string | null>`(select l.status from ${licenses} l where l.user_id = ${users.id} order by l.created_at desc limit 1)`,
      })
      .from(users)
      .where(and(...where))
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(q.limit + 1);
    const more = rows.length > q.limit;
    const items = rows.slice(0, q.limit);
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
    return { id: u.id, status: u.status };
  }

  async revokeSession(actorId: string, sessionId: string) {
    await this.sessions.revoke(sessionId);
    await this.audit.log({ actorId, action: 'session.revoke', targetType: 'session', targetId: sessionId });
    return { ok: true };
  }

  async allLicenses(q: PageQuery & { status?: string }) {
    const where: SQL[] = [];
    if (q.status) where.push(eq(licenses.status, q.status));
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
    const items = rows.slice(0, q.limit);
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
    await this.audit.log({ actorId, action: 'flags.update', targetType: 'feature_flag', metadata: { key, enabled } });
    return row;
  }

  workers() {
    return this.db.select().from(workerNodes).orderBy(desc(workerNodes.lastHeartbeatAt));
  }

  async catalogCounts() {
    const [p] = await this.db.select({ n: count() }).from(visualPresets);
    const [v] = await this.db.select({ n: count() }).from(voiceProfiles);
    const [h] = await this.db.select({ n: count() }).from(hookPresets);
    return { presets: p!.n, voices: v!.n, hooks: h!.n };
  }
}
