import { check, index, pgTable, primaryKey, smallint, text, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { citext, createdAt, id, inList, status, tz, updatedAt } from './_helpers.js';
import { devices } from './licensing.js';

export const ROLE_VALUES = ['SUPERADMIN', 'MEMBER'] as const;
export const USER_STATUS_VALUES = ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DISABLED'] as const;

export const users = pgTable(
  'users',
  {
    id: id(),
    email: citext().notNull().unique(),
    displayName: varchar({ length: 120 }).notNull(),
    role: varchar({ length: 20 }).notNull(),
    status: status(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: tz(),
  },
  (t) => [
    index('users_role_idx').on(t.role),
    index('users_status_idx').on(t.status),
    index('users_created_at_idx').on(t.createdAt),
    check('users_role_check', inList('role', ROLE_VALUES)),
    check('users_status_check', inList('status', USER_STATUS_VALUES)),
  ],
);

export const authIdentities = pgTable(
  'auth_identities',
  {
    id: id(),
    userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar({ length: 50 }).notNull(),
    providerSubject: varchar({ length: 255 }).notNull(),
    secretHash: varchar({ length: 255 }),
    verifiedAt: tz(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique('auth_identities_provider_subject_uq').on(t.provider, t.providerSubject), index('auth_identities_user_idx').on(t.userId)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    sessionHash: varchar({ length: 128 }).notNull().unique(),
    refreshHash: varchar({ length: 128 }).unique(),
    deviceId: uuid().references(() => devices.id, { onDelete: 'set null' }),
    client: varchar({ length: 20 }).notNull().default('web'),
    ipAddress: varchar({ length: 64 }),
    userAgent: varchar({ length: 400 }),
    expiresAt: tz().notNull(),
    refreshExpiresAt: tz(),
    lastSeenAt: createdAt(),
    revokedAt: tz(),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId), index('sessions_expires_idx').on(t.expiresAt), check('sessions_client_check', inList('client', ['web', 'desktop']))],
);

/** Email OTP challenge (SMTP delivered) for login 2-step and email verification. */
export const otpChallenges = pgTable(
  'otp_challenges',
  {
    id: id(),
    userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    purpose: varchar({ length: 30 }).notNull(),
    codeHash: varchar({ length: 128 }).notNull(),
    attempts: smallint().notNull().default(0),
    sendCount: smallint().notNull().default(1),
    lastSentAt: createdAt(),
    expiresAt: tz().notNull(),
    consumedAt: tz(),
    ipAddress: varchar({ length: 64 }),
    createdAt: createdAt(),
  },
  (t) => [
    index('otp_user_purpose_idx').on(t.userId, t.purpose),
    index('otp_expires_idx').on(t.expiresAt),
    check('otp_purpose_check', inList('purpose', ['LOGIN', 'VERIFY_EMAIL', 'RESET_PASSWORD'])),
  ],
);

export const oauthTransactions = pgTable(
  'oauth_transactions',
  {
    id: id(),
    userId: uuid().references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar({ length: 50 }).notNull(),
    stateDigest: varchar({ length: 128 }).notNull().unique(),
    codeVerifierEnc: text().notNull(),
    nonceDigest: varchar({ length: 128 }),
    redirectUri: text().notNull(),
    expiresAt: tz().notNull(),
    consumedAt: tz(),
    createdAt: createdAt(),
  },
  (t) => [index('oauth_tx_provider_idx').on(t.provider), index('oauth_tx_expires_idx').on(t.expiresAt)],
);

export const roles = pgTable('roles', {
  code: varchar({ length: 20 }).primaryKey(),
  name: varchar({ length: 80 }).notNull(),
  description: text(),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleCode: varchar({ length: 20 }).notNull().references(() => roles.code, { onDelete: 'cascade' }),
    permission: varchar({ length: 100 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.roleCode, t.permission] })],
);
