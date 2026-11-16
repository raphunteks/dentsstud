import { boolean, check, index, integer, jsonb, pgTable, text, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { createdAt, id, inList, status, tz, updatedAt } from './_helpers.js';
import { users } from './identity.js';
import { mediaAssets } from './media.js';

export const CONTENT_STATUS_VALUES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;

export const styleCategories = pgTable(
  'style_categories',
  {
    id: id(),
    slug: varchar({ length: 100 }).notNull().unique(),
    name: varchar({ length: 150 }).notNull(),
    description: text(),
    sortOrder: integer().notNull().default(0),
    isActive: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('style_categories_active_sort_idx').on(t.isActive, t.sortOrder)],
);

export const visualPresets = pgTable(
  'visual_presets',
  {
    id: id(),
    categoryId: uuid().notNull().references(() => styleCategories.id, { onDelete: 'restrict' }),
    slug: varchar({ length: 150 }).notNull().unique(),
    name: varchar({ length: 200 }).notNull(),
    description: text().notNull().default(''),
    status: status(),
    currentVersion: integer().notNull().default(1),
    thumbnailAssetId: uuid().references(() => mediaAssets.id, { onDelete: 'set null' }),
    previewAssetId: uuid().references(() => mediaAssets.id, { onDelete: 'set null' }),
    createdBy: uuid().notNull().references(() => users.id, { onDelete: 'restrict' }),
    publishedAt: tz(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('visual_presets_category_idx').on(t.categoryId),
    index('visual_presets_status_idx').on(t.status),
    index('visual_presets_name_idx').on(t.name),
    check('visual_presets_status_check', inList('status', CONTENT_STATUS_VALUES)),
  ],
);

export const visualPresetVersions = pgTable(
  'visual_preset_versions',
  {
    id: id(),
    presetId: uuid().notNull().references(() => visualPresets.id, { onDelete: 'cascade' }),
    version: integer().notNull(),
    manifest: jsonb().notNull(),
    recipe: jsonb().notNull(),
    checksum: varchar({ length: 128 }).notNull(),
    createdBy: uuid().notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
  },
  (t) => [unique('visual_preset_versions_uq').on(t.presetId, t.version)],
);

export const presetAssets = pgTable(
  'preset_assets',
  {
    id: id(),
    presetVersionId: uuid().notNull().references(() => visualPresetVersions.id, { onDelete: 'cascade' }),
    assetId: uuid().notNull().references(() => mediaAssets.id, { onDelete: 'restrict' }),
    assetRole: varchar({ length: 60 }).notNull(),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [index('preset_assets_version_idx').on(t.presetVersionId)],
);

export const hookPresets = pgTable(
  'hook_presets',
  {
    id: id(),
    slug: varchar({ length: 150 }).notNull().unique(),
    name: varchar({ length: 200 }).notNull(),
    status: status(),
    config: jsonb().notNull().default({}),
    currentVersion: integer().notNull().default(1),
    previewAssetId: uuid().references(() => mediaAssets.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('hook_presets_status_idx').on(t.status), check('hook_presets_status_check', inList('status', CONTENT_STATUS_VALUES))],
);

export const hookVersions = pgTable(
  'hook_versions',
  {
    id: id(),
    hookId: uuid().notNull().references(() => hookPresets.id, { onDelete: 'cascade' }),
    version: integer().notNull(),
    recipe: jsonb().notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique('hook_versions_uq').on(t.hookId, t.version)],
);

export const importBatches = pgTable(
  'import_batches',
  {
    id: id(),
    createdBy: uuid().notNull().references(() => users.id, { onDelete: 'restrict' }),
    kind: varchar({ length: 30 }).notNull(),
    source: varchar({ length: 30 }).notNull(),
    status: status(),
    summary: jsonb().notNull().default({}),
    createdAt: createdAt(),
    finishedAt: tz(),
  },
  (t) => [
    index('import_batches_created_by_idx').on(t.createdBy),
    index('import_batches_status_idx').on(t.status),
    check('import_batches_source_check', inList('source', ['LOCAL_FOLDER', 'DASHBOARD_UPLOAD'])),
    check('import_batches_status_check', inList('status', ['STAGING', 'VALIDATING', 'VALIDATED', 'COMMITTED', 'FAILED', 'CANCELLED', 'PARTIAL'])),
  ],
);

export const importItems = pgTable(
  'import_items',
  {
    id: id(),
    batchId: uuid().notNull().references(() => importBatches.id, { onDelete: 'cascade' }),
    originalPath: text().notNull(),
    checksum: varchar({ length: 128 }).notNull(),
    itemType: varchar({ length: 40 }).notNull(),
    status: status(),
    validationErrors: jsonb().notNull().default([]),
    targetId: uuid(),
  },
  (t) => [index('import_items_batch_idx').on(t.batchId), index('import_items_status_idx').on(t.status)],
);

// ---------------- Voice ----------------
export const voiceProfiles = pgTable(
  'voice_profiles',
  {
    id: id(),
    provider: varchar({ length: 60 }).notNull(),
    providerVoiceId: varchar({ length: 255 }),
    slug: varchar({ length: 150 }).notNull().unique(),
    name: varchar({ length: 150 }).notNull(),
    description: text().notNull().default(''),
    language: varchar({ length: 40 }).notNull(),
    voiceAttributes: jsonb().notNull().default({}),
    capabilities: jsonb().notNull().default({}),
    sampleAssetId: uuid().references(() => mediaAssets.id, { onDelete: 'set null' }),
    synthesisConfig: jsonb().notNull().default({}),
    status: status(),
    currentVersion: integer().notNull().default(1),
    createdBy: uuid().notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('voice_profiles_provider_idx').on(t.provider),
    index('voice_profiles_status_idx').on(t.status),
    index('voice_profiles_language_idx').on(t.language),
    check('voice_profiles_status_check', inList('status', ['DRAFT', 'PUBLISHED', 'DISABLED', 'ARCHIVED'])),
  ],
);

export const voiceVersions = pgTable(
  'voice_versions',
  {
    id: id(),
    voiceId: uuid().notNull().references(() => voiceProfiles.id, { onDelete: 'cascade' }),
    version: integer().notNull(),
    config: jsonb().notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique('voice_versions_uq').on(t.voiceId, t.version)],
);

export const voiceSamples = pgTable(
  'voice_samples',
  {
    id: id(),
    voiceId: uuid().notNull().references(() => voiceProfiles.id, { onDelete: 'cascade' }),
    assetId: uuid().notNull().references(() => mediaAssets.id, { onDelete: 'restrict' }),
    language: varchar({ length: 40 }).notNull(),
    sampleText: text(),
  },
  (t) => [index('voice_samples_voice_idx').on(t.voiceId)],
);

export const ttsProviderConfigs = pgTable('tts_provider_configs', {
  id: id(),
  provider: varchar({ length: 60 }).notNull().unique(),
  displayName: varchar({ length: 120 }).notNull(),
  isEnabled: boolean().notNull().default(false),
  publicCapabilities: jsonb().notNull().default({}),
  /** Non-secret provider settings (default model, fallback base URL). */
  config: jsonb().notNull().default({}),
  secretRef: text(),
  lastCheckedAt: tz(),
  lastStatus: varchar({ length: 24 }),
  updatedAt: updatedAt(),
});

/** A member's own TTS credentials (key in secret_vault). Never shared between members. */
export const memberTtsAccounts = pgTable(
  'member_tts_accounts',
  {
    id: id(),
    userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar({ length: 60 }).notNull(),
    status: status(),
    credentialRef: text(),
    credentialHint: varchar({ length: 32 }),
    config: jsonb().notNull().default({}),
    lastError: text(),
    lastCheckedAt: tz(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique('member_tts_accounts_uq').on(t.userId, t.provider), check('member_tts_accounts_provider_check', inList('provider', ['gemini', 'elevenlabs', 'cadangan']))],
);
