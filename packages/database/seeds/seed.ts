/**
 * Idempotent seed. Seeds ONLY: 12 style categories (empty), 2 roles + permissions,
 * agent definitions + prompt v1, workflow stage definition, base system settings,
 * feature flags, AI/TTS provider registry metadata.
 * NEVER seeds visual_presets, voice_profiles, hook_presets or results (v1.1 §4.3).
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
dotenv.config();
dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
import { count, sql } from 'drizzle-orm';
import {
  AGENTS, HELP_ARTICLES, PRODUCTION_WORKFLOW, ROLE_PERMISSIONS, STYLE_CATEGORIES, createDatabase,
  agentDefinitions, agentPromptVersions, aiProviderRegistry, featureFlags, helpArticles, hookPresets, rolePermissions, roles,
  styleCategories, systemSettings, ttsProviderConfigs, visualPresets, voiceProfiles, workflowDefinitions, workflowVersions,
} from '../src/index.js';

export async function seed(db = createDatabase(undefined, 1)) {
  await db.transaction(async (tx) => {
    await tx
      .insert(styleCategories)
      .values(STYLE_CATEGORIES.map((c, i) => ({ slug: c.slug, name: c.name, sortOrder: (i + 1) * 10 })))
      .onConflictDoNothing({ target: styleCategories.slug });

    await tx
      .insert(roles)
      .values([
        { code: 'SUPERADMIN', name: 'Superadmin', description: 'Pengelola platform dengan hak operasional global.' },
        { code: 'MEMBER', name: 'Member', description: 'Pengguna yang memproduksi konten miliknya sendiri.' },
      ])
      .onConflictDoNothing();
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      await tx.insert(rolePermissions).values(perms.map((permission) => ({ roleCode: role, permission }))).onConflictDoNothing();
    }

    for (const a of AGENTS) {
      const [agent] = await tx
        .insert(agentDefinitions)
        .values({ code: a.code, name: a.name, description: a.description, config: { stage: a.stage, temperature: 0.4, maxTokens: 4096 } })
        .onConflictDoUpdate({ target: agentDefinitions.code, set: { code: sql`excluded.code` } })
        .returning({ id: agentDefinitions.id });
      await tx.insert(agentPromptVersions).values({ agentId: agent!.id, version: 1, systemPrompt: a.systemPrompt }).onConflictDoNothing();
    }

    const [wf] = await tx
      .insert(workflowDefinitions)
      .values({ code: PRODUCTION_WORKFLOW.code, name: PRODUCTION_WORKFLOW.name, status: 'PUBLISHED' })
      .onConflictDoUpdate({ target: workflowDefinitions.code, set: { code: sql`excluded.code` } })
      .returning({ id: workflowDefinitions.id });
    await tx.insert(workflowVersions).values({ workflowId: wf!.id, version: 1, definition: PRODUCTION_WORKFLOW.definition }).onConflictDoNothing();

    await tx
      .insert(helpArticles)
      .values(HELP_ARTICLES.map((a, i) => ({ slug: a.slug, kind: a.kind, title: a.title, body: a.body, status: 'PUBLISHED', sortOrder: (i + 1) * 10 })))
      .onConflictDoNothing({ target: helpArticles.slug });

    const settings: Record<string, unknown> = {
      'auth.otp.ttlSeconds': 600,
      'auth.otp.maxAttempts': 5,
      'auth.otp.resendCooldownSeconds': 60,
      'auth.session.ttlHours': 12,
      'auth.refresh.ttlDays': 30,
      'license.defaultMaxDevices': 2,
      'license.offlineGraceHours': 72,
      'upload.maxBytes': 524_288_000,
      'render.maxResolution': { width: 3840, height: 2160 },
      'quota.globalWorkerConcurrency': 4,
      'quota.perMemberConcurrency': 2,
      'retention.trashDays': 30,
    };
    await tx
      .insert(systemSettings)
      .values(Object.entries(settings).map(([key, value]) => ({ key, value })))
      .onConflictDoNothing();

    await tx
      .insert(featureFlags)
      .values(['cloud_render', 'local_render', 'scheduler', 'claude_code_local'].map((key) => ({ key, enabled: true })))
      .onConflictDoNothing();
    await tx.insert(featureFlags).values({ key: 'oauth_generic_pkce', enabled: false }).onConflictDoNothing();

    await tx
      .insert(aiProviderRegistry)
      .values({
        code: 'anthropic',
        name: 'Anthropic Claude',
        kind: 'LLM',
        methods: ['API_KEY', 'CLAUDE_CODE_LOCAL', 'OAUTH_PKCE'],
        capabilities: { textGeneration: true, toolUse: true, vision: true },
        notes:
          'OAuth Claude.ai konsumen tidak tersedia untuk aplikasi pihak ketiga. Jalur yang didukung: API key Anthropic milik member, atau Claude Code resmi yang terpasang di perangkat member.',
      })
      .onConflictDoNothing();

    await tx
      .insert(ttsProviderConfigs)
      .values([
        { provider: 'gemini', displayName: 'Gemini API' },
        { provider: 'elevenlabs', displayName: 'ElevenLabs' },
        { provider: 'cadangan', displayName: 'Cadangan' },
      ])
      .onConflictDoNothing();
  });

  const [c] = await db.select({ n: count() }).from(styleCategories);
  const [p] = await db.select({ n: count() }).from(visualPresets);
  const [v] = await db.select({ n: count() }).from(voiceProfiles);
  const [h] = await db.select({ n: count() }).from(hookPresets);
  return { categories: c!.n, presets: p!.n, voices: v!.n, hooks: h!.n };
}

const isMain = process.argv[1] && (path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) || import.meta.url.endsWith(process.argv[1]));
if (isMain) {
  const db = createDatabase(undefined, 1);
  seed(db)
    .then((r) => console.log('[seed] done', r))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => db.$client.end());
}
