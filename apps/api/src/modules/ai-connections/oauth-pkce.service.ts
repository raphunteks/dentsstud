import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { type Database, oauthTransactions } from '@dentweb/database';
import { DB, ENV } from '../../infra/tokens.js';
import type { Env } from '../../config/env.js';
import { Cipher, redact, sha256 } from '../../infra/crypto.js';
import { SettingsService } from '../../infra/settings.service.js';
import { Errors } from '../../infra/errors.js';

/**
 * Generic OAuth 2.0 Authorization Code + PKCE (S256) engine.
 * Providers are configured explicitly via OAUTH_PROVIDERS_JSON with a client registered TO DENTSWEB.
 * We never reuse another application's client identity.
 */
export const OAuthProviderConfig = z.object({
  code: z.string().min(2).max(60),
  authorizeUrl: z.url(),
  tokenUrl: z.url(),
  clientId: z.string().min(1),
  clientSecret: z.string().optional(),
  scopes: z.array(z.string()).default([]),
  redirectUri: z.url(),
});
export type OAuthProviderConfig = z.infer<typeof OAuthProviderConfig>;

export interface OAuthTokenSet {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

export const b64url = (b: Buffer) => b.toString('base64url');
export const pkceChallenge = (verifier: string) => b64url(createHash('sha256').update(verifier).digest());

@Injectable()
export class OAuthPkceService {
  private readonly providers: Map<string, OAuthProviderConfig>;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly cipher: Cipher,
    private readonly settings?: SettingsService,
  ) {
    const defaultClaude: OAuthProviderConfig = {
      code: 'anthropic',
      clientId: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
      authorizeUrl: 'https://claude.ai/oauth/authorize',
      tokenUrl: 'https://platform.claude.com/v1/oauth/token',
      scopes: [
        'org:create_api_key',
        'user:profile',
        'user:inference',
        'user:sessions:claude_code',
        'user:mcp_servers',
        'user:file_upload',
        'user:plugins',
      ],
      redirectUri: 'http://localhost:3000/callback',
    };
    const raw = env.OAUTH_PROVIDERS_JSON;
    const list = raw ? z.array(OAuthProviderConfig).parse(JSON.parse(raw)) : [];
    const map = new Map<string, OAuthProviderConfig>();
    map.set('anthropic', defaultClaude);
    map.set('claude', { ...defaultClaude, code: 'claude' });
    if (process.env.GOOGLE_OAUTH_CLIENT_ID) {
      map.set('gemini', {
        code: 'gemini',
        clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || undefined,
        authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scopes: ['https://www.googleapis.com/auth/generative-language.retriever', 'openid', 'email'],
        redirectUri: `${(env.WEB_ORIGIN || 'http://localhost:3000').replace(/\/+$/, '')}/callback`,
      });
    }
    for (const p of list) {
      map.set(p.code, p);
    }
    this.providers = map;
  }

  isConfigured(provider: string) {
    return this.providers.has(provider);
  }

  async resolveConfig(provider: string): Promise<OAuthProviderConfig | null> {
    const staticCfg = this.providers.get(provider);
    if (staticCfg) return staticCfg;
    if (!this.settings) return null;

    type OAuthClientMap = Record<string, { clientId?: string; clientSecretEnc?: string; redirectUri?: string }>;
    const stored = await this.settings
      .raw<OAuthClientMap>('ai.oauth_clients', {})
      .catch((): OAuthClientMap => ({}));
    const entry = stored?.[provider] ?? (provider === 'gemini' ? stored?.google : undefined);
    if (!entry?.clientId?.trim()) return null;

    let clientSecret: string | undefined;
    if (entry.clientSecretEnc) {
      try {
        clientSecret = this.cipher.decrypt(entry.clientSecretEnc, `oauth-client:${provider}`);
      } catch {
        clientSecret = undefined;
      }
    }
    const defaultRedirect = `${(this.env.WEB_ORIGIN || 'http://localhost:3000').replace(/\/+$/, '')}/callback`;
    if (provider === 'gemini' || provider === 'google') {
      return {
        code: 'gemini',
        clientId: entry.clientId.trim(),
        clientSecret,
        authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scopes: ['https://www.googleapis.com/auth/generative-language.retriever', 'openid', 'email'],
        redirectUri: entry.redirectUri?.trim() || defaultRedirect,
      };
    }
    if (provider === 'openai') {
      return {
        code: 'openai',
        clientId: entry.clientId.trim(),
        clientSecret,
        authorizeUrl: 'https://auth.openai.com/oauth/authorize',
        tokenUrl: 'https://auth.openai.com/oauth/token',
        scopes: ['openid', 'profile', 'email', 'offline_access'],
        redirectUri: entry.redirectUri?.trim() || defaultRedirect,
      };
    }
    return null;
  }

  async isConfiguredAsync(provider: string): Promise<boolean> {
    return (await this.resolveConfig(provider)) !== null;
  }

  configuredProviders() {
    return [...this.providers.keys()];
  }

  async start(userId: string, provider: string, customRedirectUri?: string) {
    const cfg = await this.resolveConfig(provider);
    if (!cfg) {
      throw Errors.invalid('OAUTH_UNSUPPORTED', `Provider "${provider}" belum memiliki OAuth client resmi yang terdaftar untuk DENTSWEB.`);
    }
    const isClaude = provider === 'anthropic' || provider === 'claude';
    let redirectUri: string;
    if (isClaude) {
      // Anthropic's OAuth client ID (9d1c250a-e61b-44d9-88ed-5944d1962f5e) strictly accepts only:
      // - http://localhost:3000/callback (for local development)
      // - https://platform.claude.com/oauth/code/callback (for remote/production web where user copies code)
      // Any custom domain like https://motion.dentsweb.my.id/callback is rejected with
      // "Redirect URI ... is not supported by client".
      const isLocal = customRedirectUri
        ? customRedirectUri.includes('localhost') || customRedirectUri.includes('127.0.0.1')
        : (this.env.WEB_ORIGIN?.includes('localhost') || this.env.WEB_ORIGIN?.includes('127.0.0.1'));
      redirectUri = isLocal
        ? 'http://localhost:3000/callback'
        : 'https://platform.claude.com/oauth/code/callback';
    } else {
      redirectUri = customRedirectUri ?? cfg.redirectUri;
    }
    const state = b64url(randomBytes(32));
    const verifier = b64url(randomBytes(48));
    const nonce = b64url(randomBytes(16));
    await this.db.insert(oauthTransactions).values({
      userId,
      provider,
      stateDigest: sha256(state),
      codeVerifierEnc: this.cipher.encrypt(verifier, `oauth:${provider}`),
      nonceDigest: sha256(nonce),
      redirectUri,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });
    const url = new URL(cfg.authorizeUrl);
    url.searchParams.set('code', 'true');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', cfg.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    if (!isClaude) url.searchParams.set('nonce', nonce);
    url.searchParams.set('code_challenge', pkceChallenge(verifier));
    url.searchParams.set('code_challenge_method', 'S256');
    if (cfg.scopes.length) url.searchParams.set('scope', cfg.scopes.join(' '));
    return { authorizeUrl: url.toString(), expiresInSeconds: 600 };
  }

  async refresh(provider: string, refreshToken: string): Promise<OAuthTokenSet> {
    const cfg = await this.resolveConfig(provider);
    if (!cfg) throw Errors.invalid('OAUTH_UNSUPPORTED', 'Provider tidak lagi dikonfigurasi');

    const isAnthropic = provider === 'anthropic' || provider === 'claude';
    let headers: Record<string, string>;
    let body: string | URLSearchParams;

    if (isAnthropic) {
      headers = { 'content-type': 'application/json', accept: 'application/json' };
      body = JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: cfg.clientId,
        ...(cfg.clientSecret ? { client_secret: cfg.clientSecret } : {}),
      });
    } else {
      headers = { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' };
      const form = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: cfg.clientId,
      });
      if (cfg.clientSecret) form.set('client_secret', cfg.clientSecret);
      body = form;
    }

    const res = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(20_000),
    }).catch((e: Error) => {
      throw Errors.unavailable('OAUTH_TOKEN_UNREACHABLE', redact(e.message));
    });
    const json = (await res.json().catch(() => ({}))) as Partial<OAuthTokenSet> & { error?: string };
    if (!res.ok || !json.access_token) {
      throw Errors.invalid('OAUTH_REFRESH_FAILED', `Refresh token gagal (${res.status}${json.error ? `: ${redact(json.error)}` : ''})`);
    }
    return json as OAuthTokenSet;
  }

  /** Validates state (single-use, unexpired, bound to user) and exchanges the code. */
  async callback(userId: string, params: { state?: string; code?: string; error?: string }) {
    if (params.error) throw Errors.invalid('OAUTH_DENIED', `Otorisasi ditolak: ${redact(params.error)}`);
    if (!params.code) throw Errors.invalid('OAUTH_BAD_CALLBACK', 'Kode otorisasi tidak ditemukan');

    let raw = params.code.trim();
    let authCode = raw;
    let codeState = params.state?.trim() || '';

    // Parse full URL callback, query string, URL fragment, or code#state format
    if (raw.includes('://') || raw.includes('callback?') || raw.includes('code=') || raw.includes('#')) {
      try {
        const urlStr = raw.startsWith('http')
          ? raw
          : raw.includes('?') || raw.includes('#')
            ? `http://localhost/${raw.replace(/^\/+/, '')}`
            : `http://localhost/?${raw}`;
        const u = new URL(urlStr);
        if (u.searchParams.get('code')) {
          authCode = u.searchParams.get('code')!;
        }
        if (!codeState && u.searchParams.get('state')) {
          codeState = u.searchParams.get('state')!;
        }
        if (u.hash) {
          const h = u.hash.replace(/^#\/?/, '');
          const hp = new URLSearchParams(h);
          if (hp.get('code')) {
            authCode = hp.get('code')!;
          }
          if (!codeState && hp.get('state')) {
            codeState = hp.get('state')!;
          } else if (!codeState && !h.includes('=')) {
            codeState = h;
          }
        }
      } catch {}
    }

    if (authCode.includes('#')) {
      const parts = authCode.split('#');
      authCode = parts[0]!.trim();
      if (!codeState && parts[1]) codeState = parts[1].trim();
    }

    const stateToLookup = codeState || params.state;
    let tx: typeof oauthTransactions.$inferSelect | undefined;

    if (stateToLookup) {
      const [found] = await this.db
        .select()
        .from(oauthTransactions)
        .where(
          and(
            eq(oauthTransactions.stateDigest, sha256(stateToLookup)),
            eq(oauthTransactions.userId, userId),
            isNull(oauthTransactions.consumedAt),
            gt(oauthTransactions.expiresAt, new Date()),
          ),
        )
        .limit(1);
      tx = found;
    }

    if (!tx) {
      throw Errors.invalid(
        'OAUTH_STATE_INVALID',
        'Sesi OAuth kedaluwarsa, sudah digunakan, atau parameter state tidak cocok. Silakan klik tombol "Connect Claude via OAuth" sekali lagi untuk memulai sesi baru.',
      );
    }

    const cfg = await this.resolveConfig(tx.provider);
    if (!cfg) throw Errors.invalid('OAUTH_UNSUPPORTED', 'Provider tidak lagi dikonfigurasi');

    const verifier = this.cipher.decrypt(tx.codeVerifierEnc, `oauth:${tx.provider}`);
    const isAnthropic = tx.provider === 'anthropic' || tx.provider === 'claude';
    let headers: Record<string, string>;
    let body: string | URLSearchParams;

    if (isAnthropic) {
      // Ensure redirect_uri strictly matches Anthropic accepted URIs and what was authorized:
      let redirectUriToSend = tx.redirectUri;
      if (raw.includes('platform.claude.com')) {
        redirectUriToSend = 'https://platform.claude.com/oauth/code/callback';
      } else if (raw.includes('localhost') || raw.includes('127.0.0.1')) {
        redirectUriToSend = 'http://localhost:3000/callback';
      } else if (redirectUriToSend.includes('localhost') || redirectUriToSend.includes('127.0.0.1')) {
        redirectUriToSend = 'http://localhost:3000/callback';
      } else {
        redirectUriToSend = 'https://platform.claude.com/oauth/code/callback';
      }

      headers = {
        'content-type': 'application/json',
        accept: 'application/json',
        'User-Agent': 'claude-code/2.1.296 (external, sdk-cli)',
        'anthropic-beta': 'oauth-2025-04-20,claude-code-20250219',
        'anthropic-dangerous-direct-browser-access': 'true',
        'X-App': 'cli',
      };
      const tokenPayload: Record<string, string> = {
        code: authCode,
        grant_type: 'authorization_code',
        client_id: cfg.clientId,
        redirect_uri: redirectUriToSend,
        code_verifier: verifier,
      };
      const effectiveState = codeState || params.state;
      if (effectiveState) {
        tokenPayload.state = effectiveState;
      }
      if (cfg.clientSecret) {
        tokenPayload.client_secret = cfg.clientSecret;
      }
      body = JSON.stringify(tokenPayload);
    } else {
      headers = { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' };
      const form = new URLSearchParams({
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: tx.redirectUri,
        client_id: cfg.clientId,
        code_verifier: verifier,
      });
      if (cfg.clientSecret) form.set('client_secret', cfg.clientSecret);
      body = form;
    }

    let res = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(20_000),
    }).catch(() => null);

    // Fallback URL if platform.claude.com token URL fails or is rate limited/unreachable
    if (isAnthropic && (!res || !res.ok)) {
      const fallbackUrl = 'https://api.anthropic.com/v1/oauth/token';
      const fallbackRes = await fetch(fallbackUrl, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(20_000),
      }).catch((e: Error) => {
        throw Errors.unavailable('OAUTH_TOKEN_UNREACHABLE', redact(e.message));
      });
      if (fallbackRes.ok || !res) {
        res = fallbackRes;
      }
    }

    if (!res) {
      throw Errors.unavailable('OAUTH_TOKEN_UNREACHABLE', 'Tidak dapat menghubungi server Anthropic');
    }

    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok || !json.access_token) {
      let errDetail =
        json.error_description
          ? `${json.error}: ${json.error_description}`
          : typeof json.error === 'string'
            ? json.error
            : json.error?.message || json.message || `HTTP ${res.status}`;
      if (res.status === 403 || errDetail.includes('invalid_grant') || errDetail.includes('Invalid \'code\'')) {
        errDetail = 'Kode autentikasi tidak valid atau telah kedaluwarsa. Jika Anda mendapatkan kode ini dari perintah "claude" di Terminal, mohon tempelkan langsung ke Terminal Anda. Jika ingin menghubungkan via DENTSWEB, silakan klik tombol [ Buka via Kode ] terlebih dahulu.';
      }
      throw Errors.invalid('OAUTH_TOKEN_FAILED', `Penukaran token gagal (${res.status}: ${redact(errDetail)})`);
    }

    // Tandai transaksi telah dikonsumsi setelah berhasil tukar token
    await this.db
      .update(oauthTransactions)
      .set({ consumedAt: new Date() })
      .where(eq(oauthTransactions.id, tx.id));

    return { provider: tx.provider, tokens: json as OAuthTokenSet };
  }
}
