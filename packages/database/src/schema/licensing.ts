import { check, index, jsonb, pgTable, smallint, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createdAt, id, inList, status, tz, updatedAt } from './_helpers.js';
import { users } from './identity.js';

export const LICENSE_STATUS_VALUES = ['ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED'] as const;

export interface LicenseEntitlements {
  maxWorkers: number;
  maxVideosPerDay: number;
  cloudRender: boolean;
  cloudRenderMinutesPerMonth: number;
}

export const licenses = pgTable(
  'licenses',
  {
    id: id(),
    userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: status(),
    maxDevices: smallint().notNull(),
    entitlements: jsonb().$type<LicenseEntitlements>().notNull(),
    validFrom: createdAt(),
    validUntil: tz(),
    revokedAt: tz(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('licenses_user_idx').on(t.userId),
    index('licenses_status_idx').on(t.status),
    check('licenses_status_check', inList('status', LICENSE_STATUS_VALUES)),
    check('licenses_max_devices_check', sql`${t.maxDevices} BETWEEN 1 AND 50`),
  ],
);

export const devices = pgTable(
  'devices',
  {
    id: id(),
    userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    installationHash: varchar({ length: 128 }).notNull(),
    platform: varchar({ length: 20 }).notNull(),
    architecture: varchar({ length: 20 }).notNull(),
    label: varchar({ length: 120 }).notNull(),
    lastSeenAt: createdAt(),
    revokedAt: tz(),
    createdAt: createdAt(),
  },
  (t) => [unique('devices_user_installation_uq').on(t.userId, t.installationHash), check('devices_platform_check', inList('platform', ['darwin', 'win32', 'linux']))],
);

export const licenseActivations = pgTable(
  'license_activations',
  {
    id: id(),
    licenseId: uuid().notNull().references(() => licenses.id, { onDelete: 'cascade' }),
    deviceId: uuid().notNull().references(() => devices.id, { onDelete: 'cascade' }),
    activatedAt: createdAt(),
    revokedAt: tz(),
  },
  (t) => [unique('license_activations_uq').on(t.licenseId, t.deviceId)],
);
