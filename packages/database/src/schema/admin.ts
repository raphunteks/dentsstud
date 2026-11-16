import { bigint, boolean, index, integer, jsonb, pgTable, text, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { createdAt, id, status, tz, updatedAt } from './_helpers.js';
import { users } from './identity.js';

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: varchar({ length: 60 }).notNull(),
    payload: jsonb().notNull().default({}),
    readAt: tz(),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_created_idx').on(t.userId, t.createdAt)],
);

export const supportTickets = pgTable(
  'support_tickets',
  {
    id: id(),
    userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    subject: varchar({ length: 255 }).notNull(),
    status: status(),
    diagnostics: jsonb(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('support_tickets_user_status_idx').on(t.userId, t.status)],
);

export const supportTicketMessages = pgTable(
  'support_ticket_messages',
  {
    id: id(),
    ticketId: uuid().notNull().references(() => supportTickets.id, { onDelete: 'cascade' }),
    authorId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    body: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('support_ticket_messages_ticket_idx').on(t.ticketId, t.createdAt)],
);

export const helpArticles = pgTable(
  'help_articles',
  {
    id: id(),
    slug: varchar({ length: 150 }).notNull().unique(),
    kind: varchar({ length: 30 }).notNull(),
    title: varchar({ length: 255 }).notNull(),
    body: text().notNull(),
    status: status(),
    sortOrder: integer().notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('help_articles_kind_status_idx').on(t.kind, t.status)],
);

export const appReleases = pgTable(
  'app_releases',
  {
    id: id(),
    platform: varchar({ length: 20 }).notNull(),
    architecture: varchar({ length: 20 }).notNull(),
    channel: varchar({ length: 30 }).notNull(),
    version: varchar({ length: 60 }).notNull(),
    artifactKey: text().notNull(),
    filename: varchar({ length: 255 }).notNull().default(''),
    sizeBytes: bigint({ mode: 'number' }).notNull().default(0),
    checksum: varchar({ length: 128 }).notNull(),
    /** base64 SHA-512, the format electron-updater verifies. */
    sha512: text().notNull().default(''),
    signature: text(),
    releaseNotes: text(),
    downloads: integer().notNull().default(0),
    isActive: boolean().notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [unique('app_releases_uq').on(t.platform, t.architecture, t.channel, t.version)],
);

export const incidents = pgTable(
  'incidents',
  {
    id: id(),
    title: varchar({ length: 255 }).notNull(),
    severity: varchar({ length: 10 }).notNull(),
    status: status(),
    affectedServices: jsonb().$type<string[]>().notNull().default([]),
    rootCause: text(),
    recoverySteps: text(),
    preventive: text(),
    createdAt: createdAt(),
    resolvedAt: tz(),
  },
  (t) => [index('incidents_status_severity_idx').on(t.status, t.severity)],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    actorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    action: varchar({ length: 120 }).notNull(),
    targetType: varchar({ length: 80 }).notNull(),
    targetId: uuid(),
    metadata: jsonb().notNull().default({}),
    ipAddress: varchar({ length: 64 }),
    createdAt: createdAt(),
  },
  (t) => [index('audit_logs_actor_idx').on(t.actorId), index('audit_logs_action_idx').on(t.action), index('audit_logs_created_idx').on(t.createdAt)],
);

export const systemSettings = pgTable('system_settings', {
  key: varchar({ length: 150 }).primaryKey(),
  value: jsonb().notNull(),
  updatedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
  updatedAt: updatedAt(),
});

export const featureFlags = pgTable('feature_flags', {
  key: varchar({ length: 150 }).primaryKey(),
  enabled: boolean().notNull().default(false),
  config: jsonb().notNull().default({}),
  updatedAt: updatedAt(),
});

/** Grouped application errors (API 5xx, web and desktop clients). One row per fingerprint. */
export const errorReports = pgTable(
  'error_reports',
  {
    id: id(),
    fingerprint: varchar({ length: 64 }).notNull().unique(),
    source: varchar({ length: 20 }).notNull(),
    message: text().notNull(),
    stack: text(),
    context: jsonb().notNull().default({}),
    userId: uuid().references(() => users.id, { onDelete: 'set null' }),
    occurrences: integer().notNull().default(1),
    status: status(),
    firstSeenAt: createdAt(),
    lastSeenAt: tz().notNull().defaultNow(),
  },
  (t) => [index('error_reports_status_last_idx').on(t.status, t.lastSeenAt)],
);
