import { boolean, index, integer, jsonb, numeric, pgTable, smallint, text, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { createdAt, id, status, tz, updatedAt } from './_helpers.js';
import { users } from './identity.js';
import { voiceProfiles } from './content.js';

export const memberVoicePreferences = pgTable('member_voice_preferences', {
  userId: uuid().primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  voiceId: uuid().references(() => voiceProfiles.id, { onDelete: 'set null' }),
  emotion: varchar({ length: 50 }),
  speed: numeric({ precision: 5, scale: 2, mode: 'number' }).notNull().default(1),
  pitch: numeric({ precision: 5, scale: 2, mode: 'number' }),
  instructions: text(),
  updatedAt: updatedAt(),
});

export const memberBrandProfiles = pgTable(
  'member_brand_profiles',
  {
    id: id(),
    userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: varchar({ length: 150 }).notNull(),
    instagramUsername: varchar({ length: 120 }),
    openingText: text(),
    closingText: text(),
    captionCta: text(),
    brandSettings: jsonb().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('member_brand_profiles_user_idx').on(t.userId)],
);

export const memberProductionSettings = pgTable('member_production_settings', {
  userId: uuid().primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  videosPerDay: integer().notNull().default(0),
  defaultWorkers: smallint().notNull().default(1),
  preferredFormat: varchar({ length: 20 }).notNull().default('9:16'),
  scheduleConfig: jsonb().notNull().default({}),
  updatedAt: updatedAt(),
});

// ---------------- AI connections ----------------
export const aiConnections = pgTable(
  'ai_connections',
  {
    id: id(),
    userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar({ length: 60 }).notNull(),
    method: varchar({ length: 40 }).notNull(),
    status: status(),
    providerSubject: varchar({ length: 255 }),
    capabilities: jsonb().notNull().default({}),
    credentialRef: text(),
    credentialHint: varchar({ length: 32 }),
    lastError: text(),
    lastCheckedAt: tz(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('ai_connections_user_idx').on(t.userId),
    index('ai_connections_provider_idx').on(t.provider),
    index('ai_connections_status_idx').on(t.status),
    unique('ai_connections_user_provider_method_uq').on(t.userId, t.provider, t.method),
  ],
);

export const aiConnectionEvents = pgTable(
  'ai_connection_events',
  {
    id: id(),
    connectionId: uuid().notNull().references(() => aiConnections.id, { onDelete: 'cascade' }),
    eventType: varchar({ length: 80 }).notNull(),
    metadata: jsonb().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('ai_connection_events_conn_idx').on(t.connectionId, t.createdAt)],
);

/** AES-256-GCM encrypted secrets. API never returns plaintext; Superadmin cannot read member secrets. */
export const secretVault = pgTable(
  'secret_vault',
  {
    id: id(),
    ownerId: uuid().references(() => users.id, { onDelete: 'cascade' }),
    purpose: varchar({ length: 80 }).notNull(),
    ciphertext: text().notNull(),
    keyVersion: integer().notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('secret_vault_owner_idx').on(t.ownerId)],
);

export const aiProviderRegistry = pgTable('ai_provider_registry', {
  code: varchar({ length: 60 }).primaryKey(),
  name: varchar({ length: 120 }).notNull(),
  kind: varchar({ length: 30 }).notNull(),
  methods: jsonb().$type<string[]>().notNull().default([]),
  capabilities: jsonb().notNull().default({}),
  isEnabled: boolean().notNull().default(true),
  notes: text(),
  updatedAt: updatedAt(),
});

// ---------------- Agents & workflows ----------------
export const agentDefinitions = pgTable('agent_definitions', {
  id: id(),
  code: varchar({ length: 100 }).notNull().unique(),
  name: varchar({ length: 150 }).notNull(),
  description: text().notNull(),
  config: jsonb().notNull().default({}),
  isActive: boolean().notNull().default(true),
  currentVersion: integer().notNull().default(1),
});

export const agentPromptVersions = pgTable(
  'agent_prompt_versions',
  {
    id: id(),
    agentId: uuid().notNull().references(() => agentDefinitions.id, { onDelete: 'cascade' }),
    version: integer().notNull(),
    systemPrompt: text().notNull(),
    inputSchema: jsonb().notNull().default({}),
    outputSchema: jsonb().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [unique('agent_prompt_versions_uq').on(t.agentId, t.version)],
);

export const workflowDefinitions = pgTable('workflow_definitions', {
  id: id(),
  code: varchar({ length: 100 }).notNull().unique(),
  name: varchar({ length: 150 }).notNull(),
  status: status(),
  currentVersion: integer().notNull().default(1),
});

export const workflowVersions = pgTable(
  'workflow_versions',
  {
    id: id(),
    workflowId: uuid().notNull().references(() => workflowDefinitions.id, { onDelete: 'cascade' }),
    version: integer().notNull(),
    definition: jsonb().notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique('workflow_versions_uq').on(t.workflowId, t.version)],
);
