import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { type Database, sessions, users } from '@dentweb/database';
import type { Role, SessionUser, UserStatus } from '@dentweb/shared-types';
import { DB } from '../../infra/tokens.js';
import { randomToken, sha256 } from '../../infra/crypto.js';
import { SettingsService } from '../../infra/settings.service.js';
import { Errors } from '../../infra/errors.js';

export interface IssuedSession {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
}

@Injectable()
export class SessionService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly settings: SettingsService,
  ) {}

  private async ttl() {
    const hours = await this.settings.num('auth.session.ttlHours');
    const days = await this.settings.num('auth.refresh.ttlDays');
    const now = Date.now();
    return { expiresAt: new Date(now + hours * 3600_000), refreshExpiresAt: new Date(now + days * 86400_000) };
  }

  async issue(userId: string, meta: { client: 'web' | 'desktop'; ip?: string; userAgent?: string; deviceId?: string | null }): Promise<IssuedSession> {
    const accessToken = randomToken();
    const refreshToken = randomToken();
    const { expiresAt, refreshExpiresAt } = await this.ttl();
    const [row] = await this.db
      .insert(sessions)
      .values({
        userId,
        sessionHash: sha256(accessToken),
        refreshHash: sha256(refreshToken),
        client: meta.client,
        ipAddress: meta.ip?.slice(0, 64),
        userAgent: meta.userAgent?.slice(0, 400),
        deviceId: meta.deviceId ?? null,
        expiresAt,
        refreshExpiresAt,
      })
      .returning({ id: sessions.id });
    return { sessionId: row!.id, accessToken, refreshToken, expiresAt, refreshExpiresAt };
  }

  /** Rotate both tokens. A refresh token can be used exactly once. */
  async rotate(refreshToken: string): Promise<IssuedSession & { userId: string }> {
    const [s] = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.refreshHash, sha256(refreshToken)), isNull(sessions.revokedAt), gt(sessions.refreshExpiresAt, new Date())));
    if (!s) throw Errors.unauthorized('Refresh token tidak valid');
    const [u] = await this.db.select({ status: users.status }).from(users).where(eq(users.id, s.userId));
    if (u?.status !== 'ACTIVE') {
      await this.revoke(s.id);
      throw Errors.unauthorized('Akun tidak aktif');
    }
    const accessToken = randomToken();
    const next = randomToken();
    const { expiresAt, refreshExpiresAt } = await this.ttl();
    const updated = await this.db
      .update(sessions)
      .set({ sessionHash: sha256(accessToken), refreshHash: sha256(next), expiresAt, refreshExpiresAt, lastSeenAt: new Date() })
      .where(and(eq(sessions.id, s.id), eq(sessions.refreshHash, sha256(refreshToken))))
      .returning({ id: sessions.id });
    if (updated.length === 0) throw Errors.unauthorized('Refresh token sudah digunakan');
    return { sessionId: s.id, userId: s.userId, accessToken, refreshToken: next, expiresAt, refreshExpiresAt };
  }

  async resolve(accessToken: string): Promise<{ user: SessionUser; sessionId: string; deviceId: string | null } | null> {
    const now = new Date();
    const [row] = await this.db
      .select({ s: sessions, u: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.sessionHash, sha256(accessToken)), isNull(sessions.revokedAt), gt(sessions.expiresAt, now), isNull(users.deletedAt)));
    if (!row) return null;
    if (now.getTime() - row.s.lastSeenAt.getTime() > 5 * 60_000) {
      await this.db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, row.s.id));
    }
    return {
      sessionId: row.s.id,
      deviceId: row.s.deviceId,
      user: { id: row.u.id, email: row.u.email, displayName: row.u.displayName, role: row.u.role as Role, status: row.u.status as UserStatus },
    };
  }

  async revoke(sessionId: string) {
    await this.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
  }

  async revokeAllForUser(userId: string) {
    await this.db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }

  async bindDevice(sessionId: string, deviceId: string) {
    await this.db.update(sessions).set({ deviceId }).where(eq(sessions.id, sessionId));
  }
}
