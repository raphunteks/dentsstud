import { bigint, check, index, integer, jsonb, pgTable, text, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { createdAt, id, inList, status, tz, updatedAt } from './_helpers.js';
import { users } from './identity.js';

export const mediaAssets = pgTable(
  'media_assets',
  {
    id: id(),
    ownerId: uuid().notNull().references(() => users.id, { onDelete: 'restrict' }),
    objectKey: text().notNull(),
    filename: varchar({ length: 255 }).notNull(),
    mimeType: varchar({ length: 120 }).notNull(),
    sizeBytes: bigint({ mode: 'number' }).notNull(),
    sha256: varchar({ length: 64 }).notNull(),
    metadata: jsonb().notNull().default({}),
    status: status(),
    createdAt: createdAt(),
  },
  (t) => [
    index('media_assets_owner_idx').on(t.ownerId),
    index('media_assets_sha_idx').on(t.sha256),
    index('media_assets_status_idx').on(t.status),
    check('media_assets_status_check', inList('status', ['STAGING', 'READY', 'QUARANTINED', 'DELETED'])),
  ],
);

export const projects = pgTable(
  'projects',
  {
    id: id(),
    ownerId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: varchar({ length: 255 }).notNull(),
    status: status(),
    width: integer().notNull(),
    height: integer().notNull(),
    fps: integer().notNull(),
    durationFrames: integer().notNull(),
    currentRevision: bigint({ mode: 'number' }).notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: tz(),
  },
  (t) => [index('projects_owner_updated_idx').on(t.ownerId, t.updatedAt)],
);

export const projectDocuments = pgTable('project_documents', {
  projectId: uuid().primaryKey().references(() => projects.id, { onDelete: 'cascade' }),
  schemaVersion: integer().notNull(),
  revision: bigint({ mode: 'number' }).notNull(),
  document: jsonb().notNull(),
  checksum: varchar({ length: 128 }).notNull(),
  updatedAt: updatedAt(),
});

export const projectOperations = pgTable(
  'project_operations',
  {
    id: id(),
    projectId: uuid().notNull().references(() => projects.id, { onDelete: 'cascade' }),
    operationId: uuid().notNull().unique(),
    baseRevision: bigint({ mode: 'number' }).notNull(),
    resultRevision: bigint({ mode: 'number' }).notNull(),
    payload: jsonb().notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique('project_operations_rev_uq').on(t.projectId, t.resultRevision)],
);

export const projectVersions = pgTable(
  'project_versions',
  {
    id: id(),
    projectId: uuid().notNull().references(() => projects.id, { onDelete: 'cascade' }),
    revision: bigint({ mode: 'number' }).notNull(),
    snapshotRef: text().notNull(),
    checksum: varchar({ length: 128 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique('project_versions_uq').on(t.projectId, t.revision)],
);

export const syncConflicts = pgTable(
  'sync_conflicts',
  {
    id: id(),
    projectId: uuid().notNull().references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    localRevision: bigint({ mode: 'number' }).notNull(),
    remoteRevision: bigint({ mode: 'number' }).notNull(),
    status: status(),
    resolution: jsonb(),
    createdAt: createdAt(),
  },
  (t) => [index('sync_conflicts_project_idx').on(t.projectId)],
);
