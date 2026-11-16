import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { hash, verify } from '@node-rs/argon2';
import { createHmac, randomUUID } from 'node:crypto';
import { type Database, authIdentities, otpChallenges, users } from '@dentweb/database';
import type { LoginInput, RegisterInput, SessionUser, Role, UserStatus } from '@dentweb/shared-types';
import { DB, ENV } from '../../infra/tokens.js';
import type { Env } from '../../config/env.js';
import { AuditService, MailService } from '../../infra/infra.module.js';
import { SettingsService } from '../../infra/settings.service.js';
import { Errors } from '../../infra/errors.js';
import { otpCode } from '../../infra/crypto.js';
import { SessionService, type IssuedSession } from './session.service.js';

const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;
type Purpose = 'LOGIN' | 'VERIFY_EMAIL';

export interface ClientMeta {
  ip?: string;
  userAgent?: string;
  client: 'web' | 'desktop';
}

@Injectable()
export class AuthService {
  /** Precomputed hash used to equalize timing for unknown emails. */
  private dummyHash: Promise<string> = hash('dentweb-timing-equalizer-0', ARGON);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly sessions: SessionService,
  ) {}

  hashPassword(pw: string) {
    return hash(pw, ARGON);
  }

  private codeDigest(challengeId: string, code: string) {
    return createHmac('sha256', this.env.SECRETS_MASTER_KEY).update(`${challengeId}:${code}`).digest('hex');
  }

  private async createChallenge(user: { id: string; email: string; displayName: string }, purpose: Purpose, ip?: string) {
    const ttl = await this.settings.num('auth.otp.ttlSeconds');
    const id = randomUUID();
    const code = otpCode();
    // Invalidate older open challenges of same purpose.
    await this.db
      .update(otpChallenges)
      .set({ consumedAt: new Date() })
      .where(and(eq(otpChallenges.userId, user.id), eq(otpChallenges.purpose, purpose), isNull(otpChallenges.consumedAt)));
    await this.db.insert(otpChallenges).values({
      id,
      userId: user.id,
      purpose,
      codeHash: this.codeDigest(id, code),
      expiresAt: new Date(Date.now() + ttl * 1000),
      ipAddress: ip?.slice(0, 64),
    });
    await this.sendOtp(user, code, purpose, ttl);
    return { challengeId: id, expiresInSeconds: ttl };
  }

  private async sendOtp(user: { email: string; displayName: string }, code: string, purpose: Purpose, ttl: number) {
    const what = purpose === 'LOGIN' ? 'masuk ke' : 'memverifikasi email Anda di';
    await this.mail.send({
      to: user.email,
      subject: `Kode ${purpose === 'LOGIN' ? 'masuk' : 'verifikasi'} DENTWEB STUDIO: ${code}`,
      text: `Halo ${user.displayName},\n\nKode untuk ${what} DENTWEB STUDIO: ${code}\nKode berlaku ${Math.round(ttl / 60)} menit dan hanya dapat dipakai sekali.\n\nJika Anda tidak meminta kode ini, abaikan email ini dan segera ganti password Anda.`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:480px"><p>Halo ${escapeHtml(user.displayName)},</p><p>Kode untuk ${what} <b>DENTWEB STUDIO</b>:</p><p style="font-size:32px;letter-spacing:8px;font-weight:700;font-family:ui-monospace,monospace">${code}</p><p>Berlaku ${Math.round(ttl / 60)} menit, sekali pakai.</p><p style="color:#666">Jika Anda tidak meminta kode ini, abaikan email ini.</p></div>`,
    });
  }

  async register(input: RegisterInput, meta: ClientMeta) {
    const [existing] = await this.db.select().from(users).where(eq(users.email, input.email));
    if (existing) {
      if (existing.status === 'PENDING_VERIFICATION') {
        return this.createChallenge(existing, 'VERIFY_EMAIL', meta.ip);
      }
      // Avoid account enumeration: respond identically, notify the real owner.
      await this.mail.send({
        to: existing.email,
        subject: 'Percobaan pendaftaran DENTWEB STUDIO',
        text: 'Seseorang mencoba mendaftar menggunakan email Anda. Jika itu Anda, silakan masuk menggunakan akun yang sudah ada.',
      });
      return { challengeId: randomUUID(), expiresInSeconds: await this.settings.num('auth.otp.ttlSeconds') };
    }
    const passwordHash = await this.hashPassword(input.password);
    const user = await this.db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({ email: input.email, displayName: input.displayName, role: 'MEMBER', status: 'PENDING_VERIFICATION' })
        .returning();
      await tx.insert(authIdentities).values({ userId: u!.id, provider: 'password', providerSubject: input.email, secretHash: passwordHash });
      return u!;
    });
    await this.audit.log({ actorId: user.id, action: 'auth.register', targetType: 'user', targetId: user.id, ip: meta.ip });
    return this.createChallenge(user, 'VERIFY_EMAIL', meta.ip);
  }

  async login(input: LoginInput, meta: ClientMeta) {
    const [row] = await this.db
      .select({ u: users, secret: authIdentities.secretHash })
      .from(users)
      .innerJoin(authIdentities, and(eq(authIdentities.userId, users.id), eq(authIdentities.provider, 'password')))
      .where(and(eq(users.email, input.email), isNull(users.deletedAt)));
    const ok = row?.secret ? await verify(row.secret, input.password) : await verify(await this.dummyHash, input.password).then(() => false);
    if (!row || !ok) {
      if (row) await this.audit.log({ actorId: row.u.id, action: 'auth.login.failed', targetType: 'user', targetId: row.u.id, ip: meta.ip });
      throw Errors.invalid('INVALID_CREDENTIALS', 'Email atau password salah');
    }
    if (row.u.status === 'SUSPENDED' || row.u.status === 'DISABLED') {
      throw Errors.forbidden('Akun Anda dinonaktifkan. Hubungi Superadmin.');
    }
    const purpose: Purpose = row.u.status === 'PENDING_VERIFICATION' ? 'VERIFY_EMAIL' : 'LOGIN';
    const ch = await this.createChallenge(row.u, purpose, meta.ip);
    return { ...ch, purpose };
  }

  async resend(challengeId: string) {
    const [c] = await this.db.select({ c: otpChallenges, u: users }).from(otpChallenges).innerJoin(users, eq(users.id, otpChallenges.userId)).where(eq(otpChallenges.id, challengeId));
    if (!c || c.c.consumedAt || c.c.expiresAt < new Date()) throw Errors.invalid('OTP_EXPIRED', 'Kode sudah kedaluwarsa, silakan masuk ulang');
    const cooldown = await this.settings.num('auth.otp.resendCooldownSeconds');
    const elapsed = (Date.now() - c.c.lastSentAt.getTime()) / 1000;
    if (elapsed < cooldown) throw Errors.tooMany(`Tunggu ${Math.ceil(cooldown - elapsed)} detik sebelum mengirim ulang`);
    if (c.c.sendCount >= 5) throw Errors.tooMany('Batas pengiriman ulang tercapai, silakan masuk ulang');
    const code = otpCode();
    await this.db
      .update(otpChallenges)
      .set({ codeHash: this.codeDigest(c.c.id, code), sendCount: c.c.sendCount + 1, lastSentAt: new Date(), attempts: 0 })
      .where(eq(otpChallenges.id, c.c.id));
    const ttl = Math.max(0, Math.round((c.c.expiresAt.getTime() - Date.now()) / 1000));
    await this.sendOtp(c.u, code, c.c.purpose as Purpose, ttl);
    return { challengeId: c.c.id, expiresInSeconds: ttl };
  }

  async verifyOtp(challengeId: string, code: string, meta: ClientMeta): Promise<{ user: SessionUser; session: IssuedSession }> {
    const maxAttempts = await this.settings.num('auth.otp.maxAttempts');
    const [c] = await this.db.select().from(otpChallenges).where(eq(otpChallenges.id, challengeId));
    if (!c || c.consumedAt || c.expiresAt < new Date()) throw Errors.invalid('OTP_INVALID', 'Kode salah atau kedaluwarsa');
    if (c.attempts >= maxAttempts) throw Errors.tooMany('Terlalu banyak percobaan. Silakan masuk ulang.');
    if (c.codeHash !== this.codeDigest(c.id, code)) {
      await this.db.update(otpChallenges).set({ attempts: c.attempts + 1 }).where(eq(otpChallenges.id, c.id));
      throw Errors.invalid('OTP_INVALID', 'Kode salah atau kedaluwarsa', { attemptsLeft: Math.max(0, maxAttempts - c.attempts - 1) });
    }
    const consumed = await this.db
      .update(otpChallenges)
      .set({ consumedAt: new Date() })
      .where(and(eq(otpChallenges.id, c.id), isNull(otpChallenges.consumedAt)))
      .returning({ id: otpChallenges.id });
    if (consumed.length === 0) throw Errors.invalid('OTP_INVALID', 'Kode sudah digunakan');

    let [u] = await this.db.select().from(users).where(eq(users.id, c.userId));
    if (!u) throw Errors.unauthorized();
    if (c.purpose === 'VERIFY_EMAIL' && u.status === 'PENDING_VERIFICATION') {
      [u] = await this.db.update(users).set({ status: 'ACTIVE' }).where(eq(users.id, u.id)).returning();
      await this.db.update(authIdentities).set({ verifiedAt: new Date() }).where(and(eq(authIdentities.userId, u!.id), eq(authIdentities.provider, 'password')));
      await this.audit.log({ actorId: u!.id, action: 'auth.email.verified', targetType: 'user', targetId: u!.id, ip: meta.ip });
    }
    if (u!.status !== 'ACTIVE') throw Errors.forbidden('Akun tidak aktif');
    const session = await this.sessions.issue(u!.id, meta);
    await this.audit.log({ actorId: u!.id, action: 'auth.login', targetType: 'session', targetId: session.sessionId, metadata: { client: meta.client }, ip: meta.ip });
    return {
      user: { id: u!.id, email: u!.email, displayName: u!.displayName, role: u!.role as Role, status: u!.status as UserStatus },
      session,
    };
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
