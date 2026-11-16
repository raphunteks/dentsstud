import { bigint, boolean, check, index, integer, jsonb, pgTable, smallint, text, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { createdAt, id, inList, status, tz, updatedAt } from './_helpers.js';
import { users } from './identity.js';
import { workflowVersions } from './settings.js';
import { mediaAssets, projects } from './media.js';

export const RUN_STATUS_VALUES = ['QUEUED', 'RUNNING', 'PAUSED', 'CANCELLING', 'CANCELLED', 'FAILED', 'COMPLETED'] as const;

export const productionOrders = pgTable(
  'production_orders',
  {
    id: id(),
    userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    requestConfig: jsonb().notNull(),
    quantity: integer().notNull(),
    status: status(),
    idempotencyKey: varchar({ length: 128 }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique('production_orders_idem_uq').on(t.userId, t.idempotencyKey), index('production_orders_user_created_idx').on(t.userId, t.createdAt)],
);

export const productionRuns = pgTable(
  'production_runs',
  {
    id: id(),
    orderId: uuid().notNull().references(() => productionOrders.id, { onDelete: 'cascade' }),
    userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    workflowVersionId: uuid().notNull().references(() => workflowVersions.id, { onDelete: 'restrict' }),
    status: status(),
    currentStage: varchar({ length: 50 }),
    progress: smallint().notNull().default(0),
    error: jsonb(),
    startedAt: tz(),
    completedAt: tz(),
    heartbeatAt: tz(),
    /** Position of this run inside its order (1..quantity) and the topic it was given. */
    sequence: smallint().notNull().default(1),
    topic: text(),
    projectId: uuid(),
    renderJobId: uuid(),
    resultId: uuid(),
    kind: varchar({ length: 20 }).notNull().default('PRODUCTION'),
    createdAt: createdAt(),
  },
  (t) => [
    index('production_runs_user_idx').on(t.userId),
    index('production_runs_user_created_idx').on(t.userId, t.createdAt),
    index('production_runs_order_idx').on(t.orderId),
    index('production_runs_status_idx').on(t.status),
    index('production_runs_started_idx').on(t.startedAt),
    check('production_runs_status_check', inList('status', RUN_STATUS_VALUES)),
  ],
);

export const productionStageRuns = pgTable(
  'production_stage_runs',
  {
    id: id(),
    runId: uuid().notNull().references(() => productionRuns.id, { onDelete: 'cascade' }),
    stageCode: varchar({ length: 60 }).notNull(),
    attemptNumber: smallint().notNull(),
    status: status(),
    inputRef: text(),
    outputRef: text(),
    output: jsonb(),
    startedAt: createdAt(),
    completedAt: tz(),
  },
  (t) => [unique('production_stage_runs_uq').on(t.runId, t.stageCode, t.attemptNumber)],
);

export const productionEvents = pgTable(
  'production_events',
  {
    id: id(),
    runId: uuid().notNull().references(() => productionRuns.id, { onDelete: 'cascade' }),
    stageRunId: uuid().references(() => productionStageRuns.id, { onDelete: 'set null' }),
    eventType: varchar({ length: 80 }).notNull(),
    agentCode: varchar({ length: 100 }),
    message: text().notNull(),
    metadata: jsonb().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('production_events_run_created_idx').on(t.runId, t.createdAt)],
);

export const researchSources = pgTable(
  'research_sources',
  {
    id: id(),
    runId: uuid().notNull().references(() => productionRuns.id, { onDelete: 'cascade' }),
    url: text().notNull(),
    title: text().notNull(),
    retrievedAt: createdAt(),
    metadata: jsonb().notNull().default({}),
  },
  (t) => [index('research_sources_run_idx').on(t.runId)],
);

export const factCheckReports = pgTable(
  'fact_check_reports',
  {
    id: id(),
    runId: uuid().notNull().references(() => productionRuns.id, { onDelete: 'cascade' }),
    claims: jsonb().notNull(),
    verdict: jsonb().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('fact_check_reports_run_idx').on(t.runId)],
);

export const qcReports = pgTable(
  'qc_reports',
  {
    id: id(),
    runId: uuid().notNull().references(() => productionRuns.id, { onDelete: 'cascade' }),
    checks: jsonb().notNull(),
    passed: boolean().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('qc_reports_run_idx').on(t.runId)],
);

// ---------------- Rendering & results ----------------
export const workerNodes = pgTable('worker_nodes', {
  id: id(),
  name: varchar({ length: 150 }).notNull().unique(),
  capabilities: jsonb().notNull().default({}),
  status: status(),
  lastHeartbeatAt: createdAt(),
});

export const renderJobs = pgTable(
  'render_jobs',
  {
    id: id(),
    userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid().notNull().references(() => projects.id, { onDelete: 'cascade' }),
    mode: varchar({ length: 20 }).notNull(),
    status: status(),
    preset: jsonb().notNull().default({}),
    snapshotRef: text().notNull(),
    progress: smallint().notNull().default(0),
    createdAt: createdAt(),
    completedAt: tz(),
  },
  (t) => [index('render_jobs_user_status_created_idx').on(t.userId, t.status, t.createdAt), check('render_jobs_mode_check', inList('mode', ['LOCAL', 'CLOUD']))],
);

export const renderAttempts = pgTable(
  'render_attempts',
  {
    id: id(),
    jobId: uuid().notNull().references(() => renderJobs.id, { onDelete: 'cascade' }),
    attemptNumber: integer().notNull(),
    workerId: uuid().references(() => workerNodes.id, { onDelete: 'set null' }),
    status: status(),
    error: jsonb(),
    startedAt: createdAt(),
    finishedAt: tz(),
  },
  (t) => [unique('render_attempts_uq').on(t.jobId, t.attemptNumber)],
);

export const renderOutputs = pgTable(
  'render_outputs',
  {
    id: id(),
    jobId: uuid().notNull().references(() => renderJobs.id, { onDelete: 'cascade' }),
    objectKey: text().notNull(),
    format: varchar({ length: 20 }).notNull(),
    sizeBytes: bigint({ mode: 'number' }).notNull(),
    checksum: varchar({ length: 128 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('render_outputs_job_idx').on(t.jobId)],
);

export const videoResults = pgTable(
  'video_results',
  {
    id: id(),
    userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    runId: uuid().notNull().references(() => productionRuns.id, { onDelete: 'cascade' }),
    renderOutputId: uuid().notNull().references(() => renderOutputs.id, { onDelete: 'restrict' }),
    title: varchar({ length: 255 }).notNull(),
    status: status(),
    coverAssetId: uuid().references(() => mediaAssets.id, { onDelete: 'set null' }),
    revision: integer().notNull().default(1),
    parentResultId: uuid(),
    publishedAt: tz(),
    deletedAt: tz(),
    createdAt: createdAt(),
  },
  (t) => [
    index('video_results_run_idx').on(t.runId),
    index('video_results_user_status_created_idx').on(t.userId, t.status, t.createdAt),
    check('video_results_status_check', inList('status', ['READY', 'UPLOADED', 'FAILED'])),
  ],
);

export const socialMetadata = pgTable('social_metadata', {
  resultId: uuid().primaryKey().references(() => videoResults.id, { onDelete: 'cascade' }),
  caption: text().notNull(),
  hashtags: jsonb().$type<string[]>().notNull().default([]),
  firstComment: text().notNull().default(''),
  sourceRefs: jsonb().notNull().default([]),
  coverText: text(),
  updatedAt: updatedAt(),
});
