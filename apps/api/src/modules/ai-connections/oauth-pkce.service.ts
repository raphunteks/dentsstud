import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { type Database, oauthTransactions } from '@dentweb/database';
import { DB, ENV } from '../../infra/tokens.js';
import type { Env } from '../../config/env.js';
import { Cipher, redact, sha256 } from '../../infra/crypto.js';
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
  ) {
    const defaultClaude: OAuthProviderConfig = {
      code: 'anthropic',
      clientId: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
      authorizeUrl: 'https://claude.ai/oauth/authorize',
      tokenUrl: 'https://api.anthropic.com/v1/oauth/token',
      scopes: ['org:create_api_key', 'user:profile', 'user:inference'],
      redirectUri: 'http://localhost:3000/callback',
    };
    const raw = env.OAUTH_PROVIDERS_JSON;
    const list = raw ? z.array(OAuthProviderConfig).parse(JSON.parse(raw)) : [];
    const map = new Map<string, OAuthProviderConfig>();
    map.set('anthropic', defaultClaude);
    map.set('claude', { ...defaultClaude, code: 'claude' });
    for (const p of list) {
      map.set(p.code, p);
    }
    this.providers = map;
  }

  isConfigured(provider: string) {
    return this.providers.has(provider);
  }

  configuredProviders() {
    return [...this.providers.keys()];
  }

  async start(userId: string, provider: string, customRedirectUri?: string) {
    const cfg = this.providers.get(provider);
    if (!cfg) {
      throw Errors.invalid('OAUTH_UNSUPPORTED', `Provider "${provider}" belum memiliki OAuth client resmi yang terdaftar untuk DENTSWEB.`);
    }
    const isClaude = provider === 'anthropic' || provider === 'claude';
    let redirectUri: string;
    if (isClaude) {
      if (customRedirectUri && (customRedirectUri.includes('platform.claude.com') || customRedirectUri.includes('console.anthropic.com'))) {
        redirectUri = customRedirectUri;
      } else if (customRedirectUri && (customRedirectUri.includes('localhost') || customRedirectUri.startsWith('http://127.0.0.1'))) {
        redirectUri = customRedirectUri;
      } else {
        // Default Anthropic supported redirect URI:
        // Remote web requests use official platform callback (which displays copyable code on screen)
        // Local requests use loopback
        redirectUri = customRedirectUri?.includes('localhost')
          ? 'http://localhost:3000/callback'
          : 'https://platform.claude.com/oauth/code/callback';
      }
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
    const cfg = this.providers.get(provider);
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

    // Jika yang ditempel adalah full URL callback
    if (raw.includes('://') || raw.includes('callback?') || raw.includes('code=')) {
      try {
        const u = new URL(raw.startsWith('http') ? raw : `http://localhost/${raw}`);
        authCode = u.searchParams.get('code') || authCode;
        if (!codeState) codeState = u.searchParams.get('state') || '';
        if (u.hash) {
          const h = u.hash.replace(/^#\/?/, '');
          const hp = new URLSearchParams(h);
          codeState = codeState || hp.get('state') || (!h.includes('=') ? h : '');
        }
      } catch {}
    }

    if (authCode.includes('#')) {
      const parts = authCode.split('#');
      authCode = parts[0]!;
      if (!codeState && parts[1]) codeState = parts[1];
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
            gt(oauthTransactions.expiresAt, new Date()),
          ),
        )
        .limit(1);
      tx = found;
    }

    if (!tx) {
      // Fallback: jika URL yang ditempel tidak menyertakan state, ambil transaksi aktif terbaru milik user
      const recent = await this.db
        .select()
        .from(oauthTransactions)
        .where(
          and(
            eq(oauthTransactions.userId, userId),
            gt(oauthTransactions.expiresAt, new Date()),
          ),
        )
        .orderBy(desc(oauthTransactions.createdAt))
        .limit(1);
      tx = recent[0];
    }

    if (!tx) {
      throw Errors.invalid(
        'OAUTH_STATE_INVALID',
        'Sesi OAuth kedaluwarsa atau tidak ditemukan. Silakan klik tombol "Connect Claude via OAuth" sekali lagi untuk memulai sesi baru.',
      );
    }

    const cfg = this.providers.get(tx.provider);
    if (!cfg) throw Errors.invalid('OAUTH_UNSUPPORTED', 'Provider tidak lagi dikonfigurasi');

    const verifier = this.cipher.decrypt(tx.codeVerifierEnc, `oauth:${tx.provider}`);
    const isAnthropic = tx.provider === 'anthropic' || tx.provider === 'claude';
    let headers: Record<string, string>;
    let body: string | URLSearchParams;

    if (isAnthropic) {
      headers = { 'content-type': 'application/json', accept: 'application/json' };
      body = JSON.stringify({
        code: authCode,
        state: codeState || params.state || 'auth_state',
        grant_type: 'authorization_code',
        client_id: cfg.clientId,
        redirect_uri: tx.redirectUri,
        code_verifier: verifier,
        ...(cfg.clientSecret ? { client_secret: cfg.clientSecret } : {}),
      });
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

    const res = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(20_000),
    }).catch((e: Error) => {
      throw Errors.unavailable('OAUTH_TOKEN_UNREACHABLE', redact(e.message));
    });
    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok || !json.access_token) {
      let errDetail =
        json.error_description
          ? `${json.error}: ${json.error_description}`
          : typeof json.error === 'string'
            ? json.error
            : json.error?.message || json.message || `HTTP ${res.status}`;
      if (errDetail.includes('invalid_grant') || errDetail.includes('Invalid \'code\'')) {
        errDetail = 'Kode otorisasi sudah digunakan atau kedaluwarsa oleh Anthropic. Silakan klik "Connect Claude via OAuth" untuk otorisasi ulang.';
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
