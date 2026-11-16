import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { and, count, desc, eq, gt, isNull, or } from 'drizzle-orm';
import { importPKCS8, SignJWT, type CryptoKey } from 'jose';
import { createPublicKey } from 'node:crypto';
import { type Database, type LicenseEntitlements, devices, licenseActivations, licenses, users } from '@dentweb/database';
import type { DeviceActivateInput, LicenseGrantInput } from '@dentweb/shared-types';
import { DB, ENV } from '../../infra/tokens.js';
import type { Env } from '../../config/env.js';
import { AuditService } from '../../infra/infra.module.js';
import { SettingsService } from '../../infra/settings.service.js';
import { Errors } from '../../infra/errors.js';
import { sha256 } from '../../infra/crypto.js';

export const NO_ENTITLEMENTS: LicenseEntitlements = { maxWorkers: 0, maxVideosPerDay: 0, cloudRender: false, cloudRenderMinutesPerMonth: 0 };

@Injectable()
export class LicenseService implements OnModuleInit {
  private signingKey!: CryptoKey;
  publicKeyPem!: string;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    const pem = Buffer.from(this.env.LICENSE_SIGNING_KEY, 'base64').toString('utf8');
    this.signingKey = await importPKCS8(pem, 'EdDSA', { extractable: true });
    this.publicKeyPem = createPublicKey(pem).export({ type: 'spki', format: 'pem' }).toString();
  }

  /** Currently valid license (ACTIVE and inside validity window). */
  async active(userId: string) {
    const now = new Date();
    const [lic] = await this.db
      .select()
      .from(licenses)
      .where(and(eq(licenses.userId, userId), eq(licenses.status, 'ACTIVE'), isNull(licenses.revokedAt), or(isNull(licenses.validUntil), gt(licenses.validUntil, now))))
      .orderBy(desc(licenses.createdAt))
      .limit(1);
    return lic ?? null;
  }

  async summary(userId: string) {
    const lic = await this.active(userId);
    const [latest] = await this.db.select().from(licenses).where(eq(licenses.userId, userId)).orderBy(desc(licenses.createdAt)).limit(1);
    const activeDevices = lic
      ? (await this.db.select({ n: count() }).from(licenseActivations).where(and(eq(licenseActivations.licenseId, lic.id), isNull(licenseActivations.revokedAt))))[0]!.n
      : 0;
    return {
      status: lic ? 'ACTIVE' : (latest?.status ?? 'NONE'),
      license: lic ?? latest ?? null,
      activeDevices,
      entitlements: lic?.entitlements ?? NO_ENTITLEMENTS,
      nonCommercial: true,
    };
  }

  async grant(actorId: string, input: LicenseGrantInput, ip?: string) {
    const [u] = await this.db.select({ id: users.id }).from(users).where(and(eq(users.id, input.userId), isNull(users.deletedAt)));
    if (!u) throw Errors.notFound('Member');
    const lic = await this.db.transaction(async (tx) => {
      // One active license per member: supersede previous.
      await tx
        .update(licenses)
        .set({ status: 'REVOKED', revokedAt: new Date() })
        .where(and(eq(licenses.userId, input.userId), eq(licenses.status, 'ACTIVE')));
      const [l] = await tx
        .insert(licenses)
        .values({
          userId: input.userId,
          status: 'ACTIVE',
          maxDevices: input.maxDevices,
          entitlements: input.entitlements,
          validUntil: input.validUntil ? new Date(input.validUntil) : null,
        })
        .returning();
      return l!;
    });
    await this.audit.log({ actorId, action: 'license.grant', targetType: 'license', targetId: lic.id, metadata: { userId: input.userId, maxDevices: input.maxDevices }, ip });
    return lic;
  }

  async revoke(actorId: string, licenseId: string, ip?: string) {
    const [l] = await this.db
      .update(licenses)
      .set({ status: 'REVOKED', revokedAt: new Date() })
      .where(and(eq(licenses.id, licenseId), isNull(licenses.revokedAt)))
      .returning();
    if (!l) throw Errors.notFound('Lisensi aktif');
    await this.db.update(licenseActivations).set({ revokedAt: new Date() }).where(and(eq(licenseActivations.licenseId, l.id), isNull(licenseActivations.revokedAt)));
    await this.audit.log({ actorId, action: 'license.revoke', targetType: 'license', targetId: l.id, metadata: { userId: l.userId }, ip });
    return l;
  }

  async activateDevice(userId: string, input: DeviceActivateInput, ip?: string) {
    const lic = await this.active(userId);
    if (!lic) throw Errors.forbidden('Lisensi tidak aktif. Hubungi Superadmin untuk aktivasi.');
    const installationHash = sha256(`${userId}:${input.installationId}`);
    return this.db.transaction(async (tx) => {
      // Serialize concurrent activations for the same license.
      await tx.select({ id: licenses.id }).from(licenses).where(eq(licenses.id, lic.id)).for('update');
      const [dev] = await tx
        .insert(devices)
        .values({ userId, installationHash, platform: input.platform, architecture: input.architecture, label: input.label })
        .onConflictDoUpdate({
          target: [devices.userId, devices.installationHash],
          set: { platform: input.platform, architecture: input.architecture, label: input.label, lastSeenAt: new Date(), revokedAt: null },
        })
        .returning();
      const [existing] = await tx
        .select()
        .from(licenseActivations)
        .where(and(eq(licenseActivations.licenseId, lic.id), eq(licenseActivations.deviceId, dev!.id)));
      if (!existing || existing.revokedAt) {
        const [{ n }] = (await tx
          .select({ n: count() })
          .from(licenseActivations)
          .where(and(eq(licenseActivations.licenseId, lic.id), isNull(licenseActivations.revokedAt)))) as [{ n: number }];
        if (n >= lic.maxDevices) {
          throw Errors.conflict('DEVICE_LIMIT', `Batas ${lic.maxDevices} perangkat tercapai. Lepas perangkat lain terlebih dahulu.`);
        }
        await tx
          .insert(licenseActivations)
          .values({ licenseId: lic.id, deviceId: dev!.id })
          .onConflictDoUpdate({ target: [licenseActivations.licenseId, licenseActivations.deviceId], set: { revokedAt: null, activatedAt: new Date() } });
      }
      await this.audit.log({ actorId: userId, action: 'device.activate', targetType: 'device', targetId: dev!.id, metadata: { platform: input.platform }, ip });
      return { device: dev!, licenseId: lic.id };
    });
  }

  async listDevices(userId: string) {
    return this.db
      .select({
        id: devices.id,
        label: devices.label,
        platform: devices.platform,
        architecture: devices.architecture,
        lastSeenAt: devices.lastSeenAt,
        revokedAt: devices.revokedAt,
        createdAt: devices.createdAt,
      })
      .from(devices)
      .where(eq(devices.userId, userId))
      .orderBy(desc(devices.lastSeenAt));
  }

  async releaseDevice(actorId: string, ownerId: string, deviceId: string, ip?: string) {
    const [dev] = await this.db
      .update(devices)
      .set({ revokedAt: new Date() })
      .where(and(eq(devices.id, deviceId), eq(devices.userId, ownerId), isNull(devices.revokedAt)))
      .returning();
    if (!dev) throw Errors.notFound('Perangkat');
    await this.db.update(licenseActivations).set({ revokedAt: new Date() }).where(and(eq(licenseActivations.deviceId, dev.id), isNull(licenseActivations.revokedAt)));
    await this.audit.log({ actorId, action: 'device.release', targetType: 'device', targetId: dev.id, metadata: { ownerId }, ip });
    return { ok: true };
  }

  /** Signed, short-lived proof that lets desktop work offline within the grace window. */
  async offlineProof(userId: string, deviceId: string | null | undefined) {
    if (!deviceId) throw Errors.invalid('DEVICE_REQUIRED', 'Sesi ini belum terikat ke perangkat teraktivasi');
    const lic = await this.active(userId);
    if (!lic) throw Errors.forbidden('Lisensi tidak aktif');
    const [act] = await this.db
      .select()
      .from(licenseActivations)
      .where(and(eq(licenseActivations.licenseId, lic.id), eq(licenseActivations.deviceId, deviceId), isNull(licenseActivations.revokedAt)));
    if (!act) throw Errors.forbidden('Perangkat tidak teraktivasi');
    const graceHours = await this.settings.num('license.offlineGraceHours');
    let exp = Math.floor(Date.now() / 1000) + graceHours * 3600;
    if (lic.validUntil) exp = Math.min(exp, Math.floor(lic.validUntil.getTime() / 1000));
    const token = await new SignJWT({ lic: lic.id, dev: deviceId, ent: lic.entitlements, nc: true })
      .setProtectedHeader({ alg: 'EdDSA', typ: 'dw-license+jwt' })
      .setSubject(userId)
      .setIssuer('dentweb-studio')
      .setAudience('dentweb-desktop')
      .setIssuedAt()
      .setExpirationTime(exp)
      .sign(this.signingKey);
    return { proof: token, expiresAt: new Date(exp * 1000) };
  }
}
