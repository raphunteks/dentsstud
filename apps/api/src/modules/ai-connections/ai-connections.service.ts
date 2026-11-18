import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { type Database, aiConnectionEvents, aiConnections, aiProviderRegistry, secretVault, users } from '@dentweb/database';
import type { AiConnectionStartInput, AiConnectionStatus } from '@dentweb/shared-types';
import { DB } from '../../infra/tokens.js';
import { AuditService } from '../../infra/infra.module.js';
import { Cipher } from '../../infra/crypto.js';
import { Errors } from '../../infra/errors.js';
import { AnthropicAdapter } from './anthropic.adapter.js';
import { OAuthPkceService } from './oauth-pkce.service.js';

type Conn = typeof aiConnections.$inferSelect;

/** Public shape. Never includes credential material. */
const view = (c: Conn) => ({
  id: c.id,
  provider: c.provider,
  method: c.method,
  status: c.status as AiConnectionStatus,
  capabilities: c.capabilities,
  credentialHint: c.credentialHint,
  lastError: c.lastError,
  lastCheckedAt: c.lastCheckedAt,
  createdAt: c.createdAt,
});

@Injectable()
export class AiConnectionsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly cipher: Cipher,
    private readonly anthropic: AnthropicAdapter,
    private readonly oauth: OAuthPkceService,
    private readonly audit: AuditService,
  ) {}

  async providers() {
    const rows = await this.db.select().from(aiProviderRegistry);
    return rows.map((p) => ({
      ...p,
      methods: (p.methods as string[]).map((m) => ({
        method: m,
        available: m === 'OAUTH_PKCE' ? this.oauth.isConfigured(p.code) : true,
        reason:
          m === 'OAUTH_PKCE' && !this.oauth.isConfigured(p.code)
            ? 'UNSUPPORTED: Provider belum terdaftar untuk OAuth PKCE.'
            : m === 'CLAUDE_CODE_LOCAL'
              ? 'Hanya di aplikasi desktop dengan Claude Code resmi terpasang.'
              : null,
      })),
    }));
  }

  async list(userId: string) {
    const rows = await this.db.select().from(aiConnections).where(eq(aiConnections.userId, userId)).orderBy(desc(aiConnections.updatedAt));
    return rows.map(view);
  }

  /** Overall status for sidebar indicator. */
  async status(userId: string): Promise<{ status: AiConnectionStatus; connection: ReturnType<typeof view> | null }> {
    const rows = await this.list(userId);
    const best = rows.find((r) => r.status === 'CONNECTED') ?? rows[0] ?? null;
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

  private async upsert(userId: string, provider: string, method: string, patch: Partial<Conn>) {
    const [c] = await this.db
      .insert(aiConnections)
      .values({ userId, provider, method, status: patch.status ?? 'NOT_CONFIGURED', ...patch })
      .onConflictDoUpdate({ target: [aiConnections.userId, aiConnections.provider, aiConnections.method], set: { ...patch, updatedAt: new Date() } })
      .returning();
    return c!;
  }

  async start(userId: string, input: AiConnectionStartInput, ctx: { deviceId?: string | null; ip?: string }) {
    if (input.method === 'API_KEY') {
      const probe = await this.anthropic.probe(input.apiKey);
      // Only store a key that Anthropic accepted. INVALID keys are not persisted.
      if (probe.status === 'INVALID') {
        throw Errors.invalid('AI_KEY_INVALID', probe.error);
      }
      const existing = await this.db
        .select()
        .from(aiConnections)
        .where(and(eq(aiConnections.userId, userId), eq(aiConnections.provider, 'anthropic'), eq(aiConnections.method, 'API_KEY')));
      const ref = await this.storeSecret(userId, 'ai:anthropic:api_key', input.apiKey, existing[0]?.credentialRef);
      const c = await this.upsert(userId, 'anthropic', 'API_KEY', {
        status: probe.status,
        credentialRef: ref,
        credentialHint: `…${input.apiKey.slice(-4)}`,
        capabilities: probe.status === 'CONNECTED' ? { models: probe.models, defaultModel: this.anthropic.pickModel(probe.models) } : {},
        lastError: probe.status === 'CONNECTED' ? null : probe.error,
        lastCheckedAt: new Date(),
      });
      await this.event(c.id, 'connection.api_key.saved', { status: c.status });
      await this.audit.log({ actorId: userId, action: 'ai.connection.start', targetType: 'ai_connection', targetId: c.id, metadata: { method: 'API_KEY', status: c.status }, ip: ctx.ip });
      return { connection: view(c) };
    }

    if (input.method === 'OAUTH_PKCE') {
      const r = await this.oauth.start(userId, input.provider, input.redirectUri);
      return { authorizeUrl: r.authorizeUrl, expiresInSeconds: r.expiresInSeconds };
    }

    // CLAUDE_CODE_LOCAL: official, unmodified Claude Code binary detected by the desktop app on THIS device.
    if (!ctx.deviceId) {
      throw Errors.invalid('AI_METHOD_UNSUPPORTED', 'Claude Code lokal hanya dapat dihubungkan dari aplikasi desktop yang teraktivasi.');
    }
    const status: AiConnectionStatus = input.authenticated ? 'CONNECTED' : 'INVALID';
    const c = await this.upsert(userId, 'anthropic', 'CLAUDE_CODE_LOCAL', {
      status,
      capabilities: { scope: 'device', deviceId: ctx.deviceId, version: input.version, verifiedBy: 'desktop-local-check' },
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
    const ref = await this.storeSecret(userId, `ai:${provider}:oauth`, JSON.stringify({ ...tokens, obtainedAt: Date.now() }), existing[0]?.credentialRef);

    // Probe models using access token
    let models: string[] = [];
    try {
      const probe = await this.anthropic.probe(tokens.access_token);
      if (probe.status === 'CONNECTED' && probe.models?.length) {
        models = probe.models;
      }
    } catch {
      // fallback
    }
    if (!models.length) {
      models = ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-5-haiku-20241022'];
    }

    const c = await this.upsert(userId, provider, 'OAUTH_PKCE', {
      status: 'CONNECTED',
      credentialRef: ref,
      credentialHint: 'oauth-9router',
      capabilities: { scope: tokens.scope ?? null, models, defaultModel: this.anthropic.pickModel(models) },
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

  async check(userId: string, id: string) {
    const c = await this.own(userId, id);
    if (c.method === 'API_KEY' && c.credentialRef) {
      const key = await this.readSecret(userId, c.credentialRef, 'ai:anthropic:api_key');
      const probe = await this.anthropic.probe(key);
      const curCaps = (c.capabilities ?? {}) as { defaultModel?: string };
      const [u] = await this.db
        .update(aiConnections)
        .set({
          status: probe.status,
          capabilities: probe.status === 'CONNECTED' ? { models: probe.models, defaultModel: curCaps.defaultModel ?? this.anthropic.pickModel(probe.models) } : c.capabilities,
          lastError: probe.status === 'CONNECTED' ? null : probe.error,
          lastCheckedAt: new Date(),
        })
        .where(eq(aiConnections.id, c.id))
        .returning();
      await this.event(c.id, 'connection.checked', { status: probe.status });
      return view(u!);
    }
    if (c.method === 'OAUTH_PKCE' && c.credentialRef) {
      const token = await this.getValidOAuthToken(userId, c);
      const probe = await this.anthropic.probe(token);
      const curCaps = (c.capabilities ?? {}) as { defaultModel?: string };
      const [u] = await this.db
        .update(aiConnections)
        .set({
          status: probe.status,
          capabilities: probe.status === 'CONNECTED' ? { models: probe.models, defaultModel: curCaps.defaultModel ?? this.anthropic.pickModel(probe.models) } : c.capabilities,
          lastError: probe.status === 'CONNECTED' ? null : probe.error,
          lastCheckedAt: new Date(),
        })
        .where(eq(aiConnections.id, c.id))
        .returning();
      await this.event(c.id, 'connection.checked', { status: probe.status });
      return view(u!);
    }
    if (c.method === 'CLAUDE_CODE_LOCAL') {
      // Server cannot reach the member's machine; the desktop re-reports via /ai/connections/start.
      return view(c);
    }
    return view(c);
  }

  async setDefaultModel(userId: string, id: string, model: string) {
    const c = await this.own(userId, id);
    const validModels = [
      'claude-haiku-4-5',
      'claude-sonnet-5-5',
      'claude-opus-5-5',
      'claude-sonnet-4-5',
      'claude-haiku-5-5',
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-5-haiku-20241022',
    ];
    if (!validModels.includes(model)) {
      throw Errors.invalid('INVALID_MODEL', `Model ${model} tidak didukung.`);
    }
    const currentCaps = (c.capabilities ?? {}) as { models?: string[]; defaultModel?: string };
    const updatedCaps = {
      ...currentCaps,
      models: currentCaps.models?.length ? Array.from(new Set([...currentCaps.models, model])) : validModels,
      defaultModel: model,
    };
    const [u] = await this.db
      .update(aiConnections)
      .set({
        capabilities: updatedCaps,
      })
      .where(eq(aiConnections.id, c.id))
      .returning();
    await this.event(c.id, 'connection.model.updated', { model });
    return view(u!);
  }

  /** "Tes Jawab": a real inference call. Never fabricates an answer. */
  async test(userId: string, id: string, prompt: string) {
    const c = await this.own(userId, id);
    let key: string;
    if (c.method === 'API_KEY' && c.credentialRef) {
      key = await this.readSecret(userId, c.credentialRef, 'ai:anthropic:api_key');
    } else if (c.method === 'OAUTH_PKCE' && c.credentialRef) {
      key = await this.getValidOAuthToken(userId, c);
    } else {
      throw Errors.invalid('AI_TEST_UNSUPPORTED', 'Tes jawab server hanya untuk koneksi API key atau OAuth PKCE. Claude Code lokal diuji dari aplikasi desktop.');
    }
    const caps = c.capabilities as { defaultModel?: string; models?: string[] };
    let model = caps.defaultModel;
    if (!model) {
      const probe = await this.anthropic.probe(key);
      if (probe.status !== 'CONNECTED') throw Errors.unavailable('AI_UNAVAILABLE', probe.error);
      model = this.anthropic.pickModel(probe.models);
    }
    if (!model) throw Errors.unavailable('AI_NO_MODEL', 'Tidak ada model yang tersedia untuk akun ini');
    const started = Date.now();
    const r = await this.anthropic.complete(key, model, prompt);
    await this.event(c.id, r.ok ? 'connection.test.ok' : 'connection.test.failed', { latencyMs: Date.now() - started, model });
    if (!r.ok) {
      const status: AiConnectionStatus = r.status === 401 || r.status === 403 ? 'INVALID' : 'UNAVAILABLE';
      await this.db.update(aiConnections).set({ status, lastError: r.error, lastCheckedAt: new Date() }).where(eq(aiConnections.id, c.id));
      throw Errors.unavailable('AI_TEST_FAILED', r.error);
    }
    return { model, answer: r.text, latencyMs: Date.now() - started, usage: r.usage };
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

  /** Decrypted API key or OAuth Bearer token for server-side agent execution (never exposed via HTTP). */
  async resolveApiKey(userId: string): Promise<string | null> {
    // 1. Try user's own API_KEY connection
    const [apiKeyConn] = await this.db
      .select()
      .from(aiConnections)
      .where(and(eq(aiConnections.userId, userId), eq(aiConnections.provider, 'anthropic'), eq(aiConnections.method, 'API_KEY'), eq(aiConnections.status, 'CONNECTED')));
    if (apiKeyConn?.credentialRef) {
      return this.readSecret(userId, apiKeyConn.credentialRef, 'ai:anthropic:api_key');
    }

    // 2. Try user's own OAUTH_PKCE connection (active)
    const [oauthConn] = await this.db
      .select()
      .from(aiConnections)
      .where(and(eq(aiConnections.userId, userId), eq(aiConnections.provider, 'anthropic'), eq(aiConnections.method, 'OAUTH_PKCE'), eq(aiConnections.status, 'CONNECTED')));
    if (oauthConn?.credentialRef) {
      return this.getValidOAuthToken(userId, oauthConn);
    }

    // 3. User's own OAUTH_PKCE with credentialRef (self-heal if status was marked UNAVAILABLE by old probe)
    const [anyOauth] = await this.db
      .select()
      .from(aiConnections)
      .where(and(eq(aiConnections.userId, userId), eq(aiConnections.provider, 'anthropic'), eq(aiConnections.method, 'OAUTH_PKCE')));
    if (anyOauth?.credentialRef) {
      try {
        const token = await this.getValidOAuthToken(userId, anyOauth);
        if (token) {
          await this.db
            .update(aiConnections)
            .set({ status: 'CONNECTED', lastError: null, lastCheckedAt: new Date() })
            .where(eq(aiConnections.id, anyOauth.id));
          return token;
        }
      } catch {
        // proceed to superadmin fallback
      }
    }

    // 4. Fallback for MEMBER role: use Superadmin's active connection if member has not connected their own key
    const [memberUser] = await this.db.select({ role: users.role }).from(users).where(eq(users.id, userId));
    if (memberUser?.role === 'MEMBER') {
      const [superConn] = await this.db
        .select({ c: aiConnections })
        .from(aiConnections)
        .innerJoin(users, eq(users.id, aiConnections.userId))
        .where(
          and(
            eq(users.role, 'SUPERADMIN'),
            eq(aiConnections.provider, 'anthropic'),
            inArray(aiConnections.method, ['OAUTH_PKCE', 'API_KEY']),
            eq(aiConnections.status, 'CONNECTED'),
          ),
        );
      if (superConn?.c.credentialRef) {
        if (superConn.c.method === 'API_KEY') {
          return this.readSecret(superConn.c.userId, superConn.c.credentialRef, 'ai:anthropic:api_key');
        }
        return this.getValidOAuthToken(superConn.c.userId, superConn.c);
      }
    }

    return null;
  }
}
