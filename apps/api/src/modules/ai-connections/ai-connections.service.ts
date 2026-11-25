import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { type Database, aiConnectionEvents, aiConnections, aiProviderRegistry, secretVault, users } from '@dentweb/database';
import type { AiConnectionPatchInput, AiConnectionStartInput, AiConnectionStatus } from '@dentweb/shared-types';
import { DB } from '../../infra/tokens.js';
import { AuditService } from '../../infra/infra.module.js';
import { SettingsService } from '../../infra/settings.service.js';
import { NotificationService } from '../../infra/notifications.service.js';
import { Cipher } from '../../infra/crypto.js';
import { Errors } from '../../infra/errors.js';
import { AnthropicAdapter } from './anthropic.adapter.js';
import { assertSafeGatewayUrl, DEFAULT_PROVIDER_MODELS, MultiProviderAdapter } from './multi-provider.adapter.js';
import { OAuthPkceService } from './oauth-pkce.service.js';

type Conn = typeof aiConnections.$inferSelect;

export interface AiConnCapabilities {
  models?: string[];
  defaultModel?: string;
  priority?: number;
  active?: boolean;
  label?: string | null;
  baseUrl?: string | null;
  cooldownUntil?: string | null;
  scope?: string | null;
  deviceId?: string;
  version?: string;
  verifiedBy?: string;
}

const COOLDOWN_MS = 10 * 60_000;

const CANONICAL_PROVIDERS: { code: string; name: string; kind: string; notes: string; methods: string[] }[] = [
  {
    code: 'anthropic',
    name: 'Claude (Anthropic)',
    kind: 'LLM',
    notes: 'Rekomendasi utama untuk riset, naskah, cek fakta, dan motion direction. Mendukung OAuth PKCE (9Router), API Key, dan Claude Code CLI.',
    methods: ['OAUTH_PKCE', 'API_KEY', 'CLAUDE_CODE_LOCAL'],
  },
  {
    code: 'gemini',
    name: 'Google Gemini',
    kind: 'LLM',
    notes: 'Cadangan berkecepatan tinggi dengan jendela konteks besar. Mendukung API Key Google AI Studio dan Google OAuth PKCE.',
    methods: ['API_KEY', 'OAUTH_PKCE'],
  },
  {
    code: 'openai',
    name: 'OpenAI (GPT-4.1 / 4o)',
    kind: 'LLM',
    notes: 'Provider cadangan andal untuk naskah, QC, dan struktur JSON ketat melalui API Key resmi OpenAI.',
    methods: ['API_KEY'],
  },
  {
    code: 'openrouter',
    name: 'OpenRouter',
    kind: 'AGGREGATOR',
    notes: 'Satu API Key untuk puluhan model lintas provider (Claude, Gemini, GPT, DeepSeek) dengan routing otomatis.',
    methods: ['API_KEY'],
  },
  {
    code: 'custom_gateway',
    name: 'Custom Gateway / 9Router',
    kind: 'GATEWAY',
    notes: 'Sambungkan endpoint OpenAI-compatible atau self-hosted 9Router gateway milik Anda sendiri (URL + Bearer key).',
    methods: ['GATEWAY_KEY'],
  },
];

export function isRateLimitError(status?: number, error?: string, errorType?: string): boolean {
  if (status === 429) return true;
  const hay = `${error ?? ''} ${errorType ?? ''}`.toLowerCase();
  return /rate.?limit|quota|too many requests|resource_exhausted|overloaded|insufficient_quota/.test(hay);
}

const capsOf = (c: Pick<Conn, 'capabilities'>): AiConnCapabilities =>
  (c.capabilities && typeof c.capabilities === 'object' ? c.capabilities : {}) as AiConnCapabilities;

const priorityOf = (c: Pick<Conn, 'capabilities'>): number => {
  const p = capsOf(c).priority;
  return typeof p === 'number' && Number.isFinite(p) ? p : 50;
};

/** Public shape. Never includes credential material. */
const view = (c: Conn) => {
  const caps = capsOf(c);
  const cooldownUntil = caps.cooldownUntil ?? null;
  const inCooldown = Boolean(cooldownUntil && new Date(cooldownUntil).getTime() > Date.now());
  return {
    id: c.id,
    provider: c.provider,
    method: c.method,
    status: c.status as AiConnectionStatus,
    capabilities: {
      ...caps,
      priority: priorityOf(c),
      active: caps.active ?? true,
      label: caps.label ?? null,
      baseUrl: caps.baseUrl ?? null,
      cooldownUntil,
      inCooldown,
    },
    credentialHint: c.credentialHint,
    lastError: c.lastError,
    lastCheckedAt: c.lastCheckedAt,
    createdAt: c.createdAt,
  };
};

@Injectable()
export class AiConnectionsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly cipher: Cipher,
    private readonly anthropic: AnthropicAdapter,
    private readonly multi: MultiProviderAdapter,
    private readonly oauth: OAuthPkceService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationService,
  ) {}

  async providers() {
    const dbRows = await this.db.select().from(aiProviderRegistry).catch(() => []);
    const byCode = new Map(dbRows.map((r) => [r.code, r]));
    return Promise.all(
      CANONICAL_PROVIDERS.map(async (p) => {
        const dbRow = byCode.get(p.code);
        const methods = await Promise.all(
          p.methods.map(async (m) => {
            const available = m === 'OAUTH_PKCE' ? await this.oauth.isConfiguredAsync(p.code) : true;
            return {
              method: m,
              available,
              reason:
                m === 'OAUTH_PKCE' && !available
                  ? p.code === 'gemini'
                    ? 'Konfigurasi Google OAuth Client di Superadmin (06 AI Provider), atau gunakan API Key / 9Router Gateway.'
                    : 'Konfigurasi OAuth Client di Superadmin, atau gunakan API Key / 9Router Gateway.'
                  : m === 'CLAUDE_CODE_LOCAL'
                    ? 'Hanya di aplikasi desktop dengan Claude Code resmi terpasang.'
                    : null,
            };
          }),
        );
        return {
          code: p.code,
          name: dbRow?.name || p.name,
          kind: dbRow?.kind || p.kind,
          notes: dbRow?.notes || p.notes,
          methods,
        };
      }),
    );
  }

  async list(userId: string) {
    const rows = await this.db.select().from(aiConnections).where(eq(aiConnections.userId, userId)).orderBy(desc(aiConnections.updatedAt));
    return rows.sort((a, b) => priorityOf(a) - priorityOf(b)).map(view);
  }

  /** Overall status for sidebar indicator. */
  async status(userId: string): Promise<{ status: AiConnectionStatus; connection: ReturnType<typeof view> | null }> {
    const rows = await this.list(userId);
    const best = rows.find((r) => r.status === 'CONNECTED' && r.capabilities.active !== false) ?? rows.find((r) => r.status === 'CONNECTED') ?? rows[0] ?? null;
    return { status: best?.status ?? 'NOT_CONFIGURED', connection: best };
  }

  private async own(userId: string, id: string) {
    const [c] = await this.db.select().from(aiConnections).where(and(eq(aiConnections.id, id), eq(aiConnections.userId, userId)));
    if (!c) throw Errors.notFound('Koneksi AI');
    return c;
  }

  private async event(connectionId: string, eventType: string, metadata: Record<string, unknown> = {}) {
    await this.db.insert(aiConnectionEvents).values({ connectionId, eventType, metadata });
  }

  private secretPurpose(provider: string, method: string): string {
    if (method === 'OAUTH_PKCE') return `ai:${provider}:oauth`;
    if (method === 'GATEWAY_KEY') return `ai:${provider}:gateway_key`;
    return `ai:${provider}:api_key`;
  }

  private async storeSecret(userId: string, purpose: string, plain: string, existingRef?: string | null) {
    const ciphertext = this.cipher.encrypt(plain, `${purpose}:${userId}`);
    if (existingRef) {
      await this.db.update(secretVault).set({ ciphertext }).where(and(eq(secretVault.id, existingRef), eq(secretVault.ownerId, userId)));
      return existingRef;
    }
    const [s] = await this.db.insert(secretVault).values({ ownerId: userId, purpose, ciphertext }).returning({ id: secretVault.id });
    return s!.id;
  }

  private async readSecret(userId: string, ref: string, purpose: string) {
    const [s] = await this.db.select().from(secretVault).where(and(eq(secretVault.id, ref), eq(secretVault.ownerId, userId)));
    if (!s) throw Errors.notFound('Kredensial');
    return this.cipher.decrypt(s.ciphertext, `${purpose}:${userId}`);
  }

  private async nextPriority(userId: string): Promise<number> {
    const existing = await this.db.select({ capabilities: aiConnections.capabilities }).from(aiConnections).where(eq(aiConnections.userId, userId));
    if (!existing.length) return 1;
    const max = existing.reduce((m, r) => Math.max(m, priorityOf(r)), 0);
    return Math.min(99, max + 1);
  }

  private async upsert(userId: string, provider: string, method: string, patch: Partial<Conn>) {
    const [c] = await this.db
      .insert(aiConnections)
      .values({ userId, provider, method, status: patch.status ?? 'NOT_CONFIGURED', ...patch })
      .onConflictDoUpdate({ target: [aiConnections.userId, aiConnections.provider, aiConnections.method], set: { ...patch, updatedAt: new Date() } })
      .returning();
    return c!;
  }

  private isAnthropic(provider: string): boolean {
    return provider === 'anthropic' || provider === 'claude';
  }

  private async probeProvider(provider: string, credential: string, opts: { baseUrl?: string | null; isOAuth?: boolean } = {}) {
    if (this.isAnthropic(provider)) return this.anthropic.probe(credential);
    return this.multi.probe(provider, credential, { baseUrl: opts.baseUrl ?? undefined, isOAuth: opts.isOAuth });
  }

  private pickModelFor(provider: string, models: string[]): string {
    if (this.isAnthropic(provider)) return this.anthropic.pickModel(models);
    return this.multi.pickModel(provider, models);
  }

  async start(userId: string, input: AiConnectionStartInput, ctx: { deviceId?: string | null; ip?: string }) {
    if (input.method === 'API_KEY' || input.method === 'GATEWAY_KEY') {
      const provider = input.provider;
      let cleanBaseUrl: string | null = null;
      if (provider === 'custom_gateway' || input.method === 'GATEWAY_KEY') {
        if (!input.baseUrl) throw Errors.invalid('BASE_URL_REQUIRED', 'Base URL wajib diisi untuk Custom Gateway / 9Router');
        try {
          cleanBaseUrl = assertSafeGatewayUrl(input.baseUrl);
        } catch (e) {
          throw Errors.invalid('INVALID_GATEWAY_URL', (e as Error).message);
        }
      }

      const probe = await this.probeProvider(provider, input.apiKey, { baseUrl: cleanBaseUrl });
      if (probe.status === 'INVALID') {
        throw Errors.invalid('AI_KEY_INVALID', probe.error);
      }

      const existing = await this.db
        .select()
        .from(aiConnections)
        .where(and(eq(aiConnections.userId, userId), eq(aiConnections.provider, provider), eq(aiConnections.method, input.method)));
      const prevCaps = existing[0] ? capsOf(existing[0]) : {};
      const purpose = this.secretPurpose(provider, input.method);
      const ref = await this.storeSecret(userId, purpose, input.apiKey, existing[0]?.credentialRef);
      const priority = input.priority ?? prevCaps.priority ?? (await this.nextPriority(userId));
      const models = probe.status === 'CONNECTED' ? probe.models : (prevCaps.models ?? DEFAULT_PROVIDER_MODELS[provider] ?? []);
      const defaultModel =
        probe.status === 'CONNECTED'
          ? (prevCaps.defaultModel && models.includes(prevCaps.defaultModel) ? prevCaps.defaultModel : this.pickModelFor(provider, models))
          : prevCaps.defaultModel;

      const c = await this.upsert(userId, provider, input.method, {
        status: probe.status,
        credentialRef: ref,
        credentialHint: `…${input.apiKey.slice(-4)}`,
        capabilities: {
          ...prevCaps,
          models,
          defaultModel,
          priority,
          active: true,
          label: input.label ?? prevCaps.label ?? null,
          baseUrl: cleanBaseUrl ?? prevCaps.baseUrl ?? null,
          cooldownUntil: null,
        },
        lastError: probe.status === 'CONNECTED' ? null : probe.error,
        lastCheckedAt: new Date(),
      });
      await this.event(c.id, `connection.${input.method.toLowerCase()}.saved`, { provider, status: c.status });
      await this.audit.log({ actorId: userId, action: 'ai.connection.start', targetType: 'ai_connection', targetId: c.id, metadata: { provider, method: input.method, status: c.status }, ip: ctx.ip });
      return { connection: view(c) };
    }

    if (input.method === 'OAUTH_PKCE') {
      const r = await this.oauth.start(userId, input.provider, input.redirectUri);
      return { authorizeUrl: r.authorizeUrl, expiresInSeconds: r.expiresInSeconds };
    }

    // CLAUDE_CODE_LOCAL
    if (!(await this.settings.flag('claude_code_local', true))) {
      throw Errors.forbidden('Fitur Claude Code lokal sedang dinonaktifkan oleh Superadmin.');
    }
    if (!ctx.deviceId) {
      throw Errors.invalid('AI_METHOD_UNSUPPORTED', 'Claude Code lokal hanya dapat dihubungkan dari aplikasi desktop yang teraktivasi.');
    }
    const status: AiConnectionStatus = input.authenticated ? 'CONNECTED' : 'INVALID';
    const priority = input.priority ?? (await this.nextPriority(userId));
    const c = await this.upsert(userId, 'anthropic', 'CLAUDE_CODE_LOCAL', {
      status,
      capabilities: { scope: 'device', deviceId: ctx.deviceId, version: input.version, verifiedBy: 'desktop-local-check', priority, active: true, label: input.label ?? null, cooldownUntil: null },
      lastError: input.authenticated ? null : 'Claude Code terpasang tetapi belum login. Jalankan "claude" di terminal lalu login.',
      lastCheckedAt: new Date(),
    });
    await this.event(c.id, 'connection.claude_code.reported', { version: input.version, authenticated: input.authenticated });
    return { connection: view(c) };
  }

  async callback(userId: string, q: { state?: string; code?: string; error?: string }) {
    const { provider, tokens } = await this.oauth.callback(userId, q);
    const existing = await this.db
      .select()
      .from(aiConnections)
      .where(and(eq(aiConnections.userId, userId), eq(aiConnections.provider, provider), eq(aiConnections.method, 'OAUTH_PKCE')));
    const prevCaps = existing[0] ? capsOf(existing[0]) : {};
    const ref = await this.storeSecret(userId, `ai:${provider}:oauth`, JSON.stringify({ ...tokens, obtainedAt: Date.now() }), existing[0]?.credentialRef);

    let models: string[] = [];
    try {
      const probe = await this.probeProvider(provider, tokens.access_token, { isOAuth: true });
      if (probe.status === 'CONNECTED' && probe.models?.length) models = probe.models;
    } catch {
      // fallback
    }
    if (!models.length) {
      models = this.isAnthropic(provider)
        ? ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-5-haiku-20241022']
        : (DEFAULT_PROVIDER_MODELS[provider] ?? []);
    }
    const priority = prevCaps.priority ?? (await this.nextPriority(userId));

    const c = await this.upsert(userId, provider, 'OAUTH_PKCE', {
      status: 'CONNECTED',
      credentialRef: ref,
      credentialHint: this.isAnthropic(provider) ? 'oauth-9router' : `oauth-${provider}`,
      capabilities: {
        ...prevCaps,
        scope: tokens.scope ?? null,
        models,
        defaultModel: this.pickModelFor(provider, models),
        priority,
        active: true,
        cooldownUntil: null,
      },
      lastError: null,
      lastCheckedAt: new Date(),
    });
    await this.event(c.id, 'connection.oauth.completed');
    await this.audit.log({ actorId: userId, action: 'ai.connection.oauth', targetType: 'ai_connection', targetId: c.id, metadata: { provider } });
    return view(c);
  }

  private async getValidOAuthToken(userId: string, c: Conn): Promise<string> {
    const raw = await this.readSecret(userId, c.credentialRef!, `ai:${c.provider}:oauth`);
    const tokenData = JSON.parse(raw) as { access_token: string; refresh_token?: string; expires_in?: number; obtainedAt?: number };
    const ageMs = Date.now() - (tokenData.obtainedAt ?? 0);
    const maxAgeMs = ((tokenData.expires_in ?? 28800) - 300) * 1000;
    if (ageMs > maxAgeMs && tokenData.refresh_token) {
      try {
        const refreshed = await this.oauth.refresh(c.provider, tokenData.refresh_token);
        const updated = { ...tokenData, ...refreshed, obtainedAt: Date.now() };
        await this.storeSecret(userId, `ai:${c.provider}:oauth`, JSON.stringify(updated), c.credentialRef);
        return refreshed.access_token;
      } catch {
        return tokenData.access_token;
      }
    }
    return tokenData.access_token;
  }

  private async decryptFor(userId: string, c: Conn): Promise<string | null> {
    if (!c.credentialRef) return null;
    if (c.method === 'OAUTH_PKCE') return this.getValidOAuthToken(userId, c);
    return this.readSecret(userId, c.credentialRef, this.secretPurpose(c.provider, c.method));
  }

  async patchConnection(userId: string, id: string, input: AiConnectionPatchInput) {
    const c = await this.own(userId, id);
    const curCaps = capsOf(c);
    const nextCaps: AiConnCapabilities = {
      ...curCaps,
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.label !== undefined ? { label: input.label || null } : {}),
      ...(input.defaultModel !== undefined ? { defaultModel: input.defaultModel } : {}),
      ...(input.resetCooldown ? { cooldownUntil: null } : {}),
    };
    const nextStatus = input.resetCooldown && c.status === 'UNAVAILABLE' ? 'CONNECTED' : c.status;
    const [u] = await this.db
      .update(aiConnections)
      .set({
        capabilities: nextCaps,
        status: nextStatus,
        ...(input.resetCooldown ? { lastError: null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(aiConnections.id, c.id))
      .returning();
    await this.event(c.id, 'connection.updated', { ...input });
    return view(u!);
  }

  async check(userId: string, id: string) {
    const c = await this.own(userId, id);
    if (c.method === 'CLAUDE_CODE_LOCAL') return view(c);
    const key = await this.decryptFor(userId, c);
    if (!key) return view(c);
    const curCaps = capsOf(c);
    const probe = await this.probeProvider(c.provider, key, { baseUrl: curCaps.baseUrl, isOAuth: c.method === 'OAUTH_PKCE' });
    const [u] = await this.db
      .update(aiConnections)
      .set({
        status: probe.status,
        capabilities:
          probe.status === 'CONNECTED'
            ? { ...curCaps, models: probe.models, defaultModel: curCaps.defaultModel ?? this.pickModelFor(c.provider, probe.models), cooldownUntil: null }
            : curCaps,
        lastError: probe.status === 'CONNECTED' ? null : probe.error,
        lastCheckedAt: new Date(),
      })
      .where(eq(aiConnections.id, c.id))
      .returning();
    await this.event(c.id, 'connection.checked', { status: probe.status });
    return view(u!);
  }

  async setDefaultModel(userId: string, id: string, model: string) {
    const c = await this.own(userId, id);
    const currentCaps = capsOf(c);
    if (this.isAnthropic(c.provider)) {
      const validModels = [
        'claude-sonnet-4-5-20250929',
        'claude-sonnet-4-20250514',
        'claude-3-7-sonnet-20250219',
        'claude-3-5-sonnet-20241022',
        'claude-3-opus-20240229',
        'claude-3-5-haiku-20241022',
        'claude-haiku-4-5',
        'claude-sonnet-4-5',
        'claude-sonnet-5-5',
        'claude-opus-5-5',
        'claude-haiku-5-5',
      ];
      const allowed = new Set([...validModels, ...(currentCaps.models ?? [])]);
      if (!allowed.has(model)) {
        throw Errors.invalid('INVALID_MODEL', `Model ${model} tidak didukung.`);
      }
      const updatedCaps = {
        ...currentCaps,
        models: currentCaps.models?.length ? Array.from(new Set([...currentCaps.models, model])) : validModels,
        defaultModel: model,
      };
      const [u] = await this.db.update(aiConnections).set({ capabilities: updatedCaps }).where(eq(aiConnections.id, c.id)).returning();
      await this.event(c.id, 'connection.model.updated', { model });
      return view(u!);
    }

    const updatedCaps = {
      ...currentCaps,
      models: Array.from(new Set([...(currentCaps.models ?? DEFAULT_PROVIDER_MODELS[c.provider] ?? []), model])),
      defaultModel: model,
    };
    const [u] = await this.db.update(aiConnections).set({ capabilities: updatedCaps }).where(eq(aiConnections.id, c.id)).returning();
    await this.event(c.id, 'connection.model.updated', { model });
    return view(u!);
  }

  /** "Tes Jawab": a real inference call. Never fabricates an answer. */
  async test(userId: string, id: string, prompt: string) {
    const c = await this.own(userId, id);
    if (c.method === 'CLAUDE_CODE_LOCAL') {
      throw Errors.invalid('AI_TEST_UNSUPPORTED', 'Tes jawab server hanya untuk koneksi API key, OAuth PKCE, atau Gateway. Claude Code lokal diuji dari aplikasi desktop.');
    }
    const key = await this.decryptFor(userId, c);
    if (!key) throw Errors.invalid('AI_NO_CRED', 'Kredensial tidak ditemukan');

    const caps = capsOf(c);
    let model = caps.defaultModel;
    if (!model) {
      const probe = await this.probeProvider(c.provider, key, { baseUrl: caps.baseUrl, isOAuth: c.method === 'OAUTH_PKCE' });
      if (probe.status !== 'CONNECTED') throw Errors.unavailable('AI_UNAVAILABLE', probe.error);
      model = this.pickModelFor(c.provider, probe.models);
    }
    if (!model) throw Errors.unavailable('AI_NO_MODEL', 'Tidak ada model yang tersedia untuk akun ini');

    const started = Date.now();
    const r = this.isAnthropic(c.provider)
      ? await this.anthropic.complete(key, model, prompt)
      : await this.multi.complete(c.provider, key, model, prompt, { baseUrl: caps.baseUrl ?? undefined, isOAuth: c.method === 'OAUTH_PKCE' });

    await this.event(c.id, r.ok ? 'connection.test.ok' : 'connection.test.failed', { latencyMs: Date.now() - started, model });
    if (!r.ok) {
      const status: AiConnectionStatus = r.status === 401 || r.status === 403 ? 'INVALID' : 'UNAVAILABLE';
      await this.db.update(aiConnections).set({ status, lastError: r.error, lastCheckedAt: new Date() }).where(eq(aiConnections.id, c.id));
      throw Errors.unavailable('AI_TEST_FAILED', r.error);
    }
    return { model: r.model ?? model, answer: r.text, latencyMs: Date.now() - started, usage: r.usage };
  }

  async remove(userId: string, id: string) {
    const c = await this.own(userId, id);
    await this.db.transaction(async (tx) => {
      await tx.delete(aiConnections).where(eq(aiConnections.id, c.id));
      if (c.credentialRef) await tx.delete(secretVault).where(and(eq(secretVault.id, c.credentialRef), eq(secretVault.ownerId, userId)));
    });
    await this.audit.log({ actorId: userId, action: 'ai.connection.delete', targetType: 'ai_connection', targetId: c.id });
    return { ok: true };
  }

  /** Collect ordered server-runnable connections for user (with Superadmin fallback for MEMBER). */
  async resolveOrderedConnections(userId: string): Promise<Conn[]> {
    const ownRows = await this.db
      .select()
      .from(aiConnections)
      .where(and(eq(aiConnections.userId, userId), inArray(aiConnections.method, ['API_KEY', 'OAUTH_PKCE', 'GATEWAY_KEY'])));

    const ownActive = ownRows
      .filter((c) => c.credentialRef && capsOf(c).active !== false && c.status === 'CONNECTED')
      .sort((a, b) => priorityOf(a) - priorityOf(b));
    if (ownActive.length) return ownActive;

    const [memberUser] = await this.db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    if (memberUser?.role === 'MEMBER') {
      const superRows = await this.db
        .select({ c: aiConnections })
        .from(aiConnections)
        .innerJoin(users, eq(users.id, aiConnections.userId))
        .where(and(eq(users.role, 'SUPERADMIN'), inArray(aiConnections.method, ['API_KEY', 'OAUTH_PKCE', 'GATEWAY_KEY']), eq(aiConnections.status, 'CONNECTED')));
      return superRows
        .map((r) => r.c)
        .filter((c) => c.credentialRef && capsOf(c).active !== false)
        .sort((a, b) => priorityOf(a) - priorityOf(b));
    }
    return [];
  }

  /**
   * Auto-Fallback Router: runs completion across active CONNECTED connections in priority order.
   * On HTTP 429 / rate-limit / quota errors, places connection on 10-min cooldown, logs event,
   * notifies user via NotificationService, and automatically fails over to the next provider.
   */
  async completeWithFallback(
    userId: string,
    opts: {
      model?: string;
      system: string;
      messages: { role: 'user' | 'assistant'; content: unknown }[];
      max_tokens: number;
      tools?: unknown[];
      signal?: AbortSignal;
    },
  ): Promise<
    | { ok: true; text: string; sources: { url: string; title: string }[]; usage?: unknown; stopReason?: string; provider: string; model: string }
    | { ok: false; status: number; error: string; errorType?: string; provider?: string }
  > {
    const all = await this.resolveOrderedConnections(userId);
    if (!all.length) {
      return { ok: false, status: 422, error: 'Tidak ada koneksi AI aktif. Hubungkan minimal satu provider di Pengaturan → AI Provider.' };
    }

    const now = Date.now();
    const ready = all.filter((c) => {
      const until = capsOf(c).cooldownUntil;
      return !until || new Date(until).getTime() <= now;
    });
    // If every provider is currently in cooldown, fall back to earliest-expiring cooldown so we still attempt recovery.
    const candidates = ready.length
      ? ready
      : [...all].sort((a, b) => new Date(capsOf(a).cooldownUntil ?? 0).getTime() - new Date(capsOf(b).cooldownUntil ?? 0).getTime());

    let lastFailure: { status: number; error: string; errorType?: string; provider: string } = {
      status: 503,
      error: 'Semua provider AI gagal merespons',
      provider: candidates[0]!.provider,
    };

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i]!;
      const caps = capsOf(c);
      const key = await this.decryptFor(c.userId, c).catch(() => null);
      if (!key) continue;

      const model =
        this.isAnthropic(c.provider)
          ? (opts.model && opts.model.toLowerCase().includes('claude') ? opts.model : caps.defaultModel ?? 'claude-3-7-sonnet-20250219')
          : (caps.defaultModel ?? this.pickModelFor(c.provider, caps.models ?? []));

      const res = this.isAnthropic(c.provider)
        ? await this.anthropic.messages(key, { model, system: opts.system, messages: opts.messages, max_tokens: opts.max_tokens, tools: opts.tools }, opts.signal)
        : await this.multi.messages(c.provider, key, { model, system: opts.system, messages: opts.messages, max_tokens: opts.max_tokens }, { baseUrl: caps.baseUrl ?? undefined, isOAuth: c.method === 'OAUTH_PKCE', signal: opts.signal });

      if (res.ok) {
        return { ok: true, text: res.text, sources: res.sources, usage: res.usage, stopReason: res.stopReason, provider: c.provider, model };
      }

      lastFailure = { status: res.status, error: res.error, errorType: res.errorType, provider: c.provider };

      if (isRateLimitError(res.status, res.error, res.errorType)) {
        const cooldownUntil = new Date(Date.now() + COOLDOWN_MS).toISOString();
        await this.db
          .update(aiConnections)
          .set({ capabilities: { ...caps, cooldownUntil }, lastError: `Cooldown 10m (429): ${res.error}`, lastCheckedAt: new Date() })
          .where(eq(aiConnections.id, c.id));
        await this.event(c.id, 'connection.rate_limited', { provider: c.provider, status: res.status, cooldownUntil });

        const nextConn = candidates[i + 1];
        if (nextConn) {
          await this.notifications
            .notify(userId, 'ai.provider_switched', {
              fromProvider: caps.label || c.provider,
              toProvider: capsOf(nextConn).label || nextConn.provider,
              reason: `HTTP ${res.status} / batas kuota tercapai`,
            })
            .catch(() => undefined);
          continue;
        }
      }

      // On 401/403 or 5xx, also fail over if another backup provider exists
      if (candidates[i + 1] && (res.status === 401 || res.status === 403 || res.status >= 500)) {
        const nextConn = candidates[i + 1]!;
        await this.notifications
          .notify(userId, 'ai.provider_switched', {
            fromProvider: caps.label || c.provider,
            toProvider: capsOf(nextConn).label || nextConn.provider,
            reason: `HTTP ${res.status}`,
          })
          .catch(() => undefined);
        continue;
      }

      return { ok: false, ...lastFailure };
    }

    return { ok: false, ...lastFailure };
  }

  /** Decrypted API key or OAuth Bearer token for server-side agent execution (never exposed via HTTP). */
  async resolveApiKey(userId: string): Promise<string | null> {
    const ordered = await this.resolveOrderedConnections(userId);
    for (const c of ordered) {
      const key = await this.decryptFor(c.userId, c).catch(() => null);
      if (key) return key;
    }

    // Legacy self-heal for Anthropic OAuth if status was marked UNAVAILABLE by old probe
    const [anyOauth] = await this.db
      .select()
      .from(aiConnections)
      .where(and(eq(aiConnections.userId, userId), eq(aiConnections.provider, 'anthropic'), eq(aiConnections.method, 'OAUTH_PKCE')));
    if (anyOauth?.credentialRef) {
      try {
        const token = await this.getValidOAuthToken(userId, anyOauth);
        if (token) {
          await this.db.update(aiConnections).set({ status: 'CONNECTED', lastError: null, lastCheckedAt: new Date() }).where(eq(aiConnections.id, anyOauth.id));
          return token;
        }
      } catch {
        // ignore
      }
    }

    return null;
  }
}
