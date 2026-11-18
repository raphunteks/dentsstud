import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import { OAuthPkceService, pkceChallenge } from '../src/modules/ai-connections/oauth-pkce.service.js';
import { AnthropicAdapter } from '../src/modules/ai-connections/anthropic.adapter.js';
import type { Env } from '../src/config/env.js';
import { Cipher, sha256 } from '../src/infra/crypto.js';

describe('Claude OAuth PKCE Alignment & Adapter Tests', () => {
  const masterKey = randomBytes(32).toString('base64');
  const fakeEnv = {
    WEB_ORIGIN: 'http://localhost:3000',
    ANTHROPIC_API_BASE: 'https://api.anthropic.com',
    SECRETS_MASTER_KEY: masterKey,
  } as Env;

  const cipher = new Cipher(masterKey);

  describe('OAuthPkceService - Anthropic Redirect URI strictly aligned', () => {
    let mockDb: any;
    let insertedTransactions: any[] = [];

    beforeEach(() => {
      insertedTransactions = [];
      mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockImplementation((val) => {
            insertedTransactions.push(val);
            return Promise.resolve();
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                return Promise.resolve(insertedTransactions);
              }),
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockImplementation(() => {
                  return Promise.resolve(insertedTransactions);
                }),
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
    });

    it('enforces http://localhost:3000/callback for local development', async () => {
      const svc = new OAuthPkceService(mockDb, fakeEnv, cipher);
      const res = await svc.start('user-1', 'anthropic', 'http://localhost:5173/callback');
      const url = new URL(res.authorizeUrl);

      expect(url.searchParams.get('client_id')).toBe('9d1c250a-e61b-44d9-88ed-5944d1962f5e');
      expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/callback');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');

      expect(insertedTransactions).toHaveLength(1);
      expect(insertedTransactions[0].redirectUri).toBe('http://localhost:3000/callback');
    });

    it('enforces https://platform.claude.com/oauth/code/callback for remote/production web', async () => {
      const prodEnv = { ...fakeEnv, WEB_ORIGIN: 'https://motion.dentsweb.my.id' } as Env;
      const svc = new OAuthPkceService(mockDb, prodEnv, cipher);
      const res = await svc.start('user-2', 'anthropic', 'https://motion.dentsweb.my.id/callback');
      const url = new URL(res.authorizeUrl);

      expect(url.searchParams.get('client_id')).toBe('9d1c250a-e61b-44d9-88ed-5944d1962f5e');
      // Must NOT use https://motion.dentsweb.my.id/callback (which Anthropic rejects with "Redirect URI ... is not supported")
      expect(url.searchParams.get('redirect_uri')).toBe('https://platform.claude.com/oauth/code/callback');

      expect(insertedTransactions).toHaveLength(1);
      expect(insertedTransactions[0].redirectUri).toBe('https://platform.claude.com/oauth/code/callback');
    });

    it('handles callback with URL fragment containing #code=...&state=... (platform.claude.com copy)', async () => {
      const svc = new OAuthPkceService(mockDb, fakeEnv, cipher);
      const { authorizeUrl } = await svc.start('user-3', 'anthropic', 'https://platform.claude.com/oauth/code/callback');
      const authUrl = new URL(authorizeUrl);
      const state = authUrl.searchParams.get('state')!;

      let tokenBody: any = null;
      const globalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
        if (url.includes('/oauth/token')) {
          tokenBody = JSON.parse(init.body);
          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: 'sk-ant-oat-test-access-token',
              refresh_token: 'sk-ant-ort-test-refresh-token',
              expires_in: 28800,
              token_type: 'Bearer',
            }),
          };
        }
        return globalFetch(url, init);
      });

      try {
        // User pastes full platform URL with hash fragment
        const pasteUrl = `https://platform.claude.com/oauth/code/callback#code=test-auth-code-123&state=${state}`;
        const cbRes = await svc.callback('user-3', { code: pasteUrl });

        expect(cbRes.provider).toBe('anthropic');
        expect(cbRes.tokens.access_token).toBe('sk-ant-oat-test-access-token');

        // Verify token exchange payload
        expect(tokenBody).toBeDefined();
        expect(tokenBody.grant_type).toBe('authorization_code');
        expect(tokenBody.client_id).toBe('9d1c250a-e61b-44d9-88ed-5944d1962f5e');
        expect(tokenBody.code).toBe('test-auth-code-123');
        expect(tokenBody.state).toBe(state);
        // Ensure redirect_uri strictly matches https://platform.claude.com/oauth/code/callback
        expect(tokenBody.redirect_uri).toBe('https://platform.claude.com/oauth/code/callback');
      } finally {
        global.fetch = globalFetch;
      }
    });

    it('handles callback with localhost callback URL and sends exact matching redirect_uri', async () => {
      const svc = new OAuthPkceService(mockDb, fakeEnv, cipher);
      const { authorizeUrl } = await svc.start('user-4', 'anthropic', 'http://localhost:3000/callback');
      const authUrl = new URL(authorizeUrl);
      const state = authUrl.searchParams.get('state')!;

      let tokenBody: any = null;
      const globalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
        if (url.includes('/oauth/token')) {
          tokenBody = JSON.parse(init.body);
          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: 'sk-ant-oat-local-access-token',
              token_type: 'Bearer',
            }),
          };
        }
        return globalFetch(url, init);
      });

      try {
        const pasteUrl = `http://localhost:3000/callback?code=local-code-456&state=${state}`;
        const cbRes = await svc.callback('user-4', { code: pasteUrl });

        expect(cbRes.tokens.access_token).toBe('sk-ant-oat-local-access-token');
        expect(tokenBody.code).toBe('local-code-456');
        expect(tokenBody.redirect_uri).toBe('http://localhost:3000/callback');
      } finally {
        global.fetch = globalFetch;
      }
    });

    it('handles code#state format', async () => {
      const svc = new OAuthPkceService(mockDb, fakeEnv, cipher);
      const { authorizeUrl } = await svc.start('user-5', 'anthropic', 'https://platform.claude.com/oauth/code/callback');
      const authUrl = new URL(authorizeUrl);
      const state = authUrl.searchParams.get('state')!;

      let tokenBody: any = null;
      const globalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
        if (url.includes('/oauth/token')) {
          tokenBody = JSON.parse(init.body);
          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: 'sk-ant-oat-split-token',
            }),
          };
        }
        return globalFetch(url, init);
      });

      try {
        const input = `anthropic-code-xyz#${state}`;
        const cbRes = await svc.callback('user-5', { code: input });

        expect(cbRes.tokens.access_token).toBe('sk-ant-oat-split-token');
        expect(tokenBody.code).toBe('anthropic-code-xyz');
        expect(tokenBody.state).toBe(state);
        expect(tokenBody.redirect_uri).toBe('https://platform.claude.com/oauth/code/callback');
      } finally {
        global.fetch = globalFetch;
      }
    });
  });

  describe('AnthropicAdapter - OAuth tokens & beta headers', () => {
    it('sets official beta headers for sk-ant-oat tokens', async () => {
      const adapter = new AnthropicAdapter(fakeEnv);
      let capturedHeaders: Record<string, string> = {};

      const globalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
        capturedHeaders = init.headers;
        return {
          ok: true,
          status: 200,
          json: async () => ({ content: [{ type: 'text', text: 'pong' }] }),
        };
      });

      try {
        const probeRes = await adapter.probe('sk-ant-oat-0123456789abcdefghijklmnopqrstuvwxyz');
        expect(probeRes.status).toBe('CONNECTED');
        if (probeRes.status === 'CONNECTED') {
          expect(probeRes.models).toContain('claude-3-7-sonnet-20250219');
        }

        expect(capturedHeaders['Authorization']).toBe('Bearer sk-ant-oat-0123456789abcdefghijklmnopqrstuvwxyz');
        expect(capturedHeaders['anthropic-beta']).toBe('oauth-2025-04-20,claude-code-20250219');
        expect(capturedHeaders['anthropic-dangerous-direct-browser-access']).toBe('true');
        expect(capturedHeaders['User-Agent']).toBe('claude-cli/1.0.0 (external, sdk-cli)');
        expect(capturedHeaders['X-App']).toBe('cli');
      } finally {
        global.fetch = globalFetch;
      }
    });

    it('correctly handles Bearer prefix in OAuth token credentials', async () => {
      const adapter = new AnthropicAdapter(fakeEnv);
      let capturedHeaders: Record<string, string> = {};

      const globalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
        capturedHeaders = init.headers;
        return {
          ok: true,
          status: 200,
          json: async () => ({ content: [{ type: 'text', text: 'pong' }] }),
        };
      });

      try {
        const probeRes = await adapter.probe('Bearer sk-ant-oat-mytesttoken12345678901234567890');
        expect(probeRes.status).toBe('CONNECTED');
        expect(capturedHeaders['Authorization']).toBe('Bearer sk-ant-oat-mytesttoken12345678901234567890');
        expect(capturedHeaders['anthropic-beta']).toBe('oauth-2025-04-20,claude-code-20250219');
      } finally {
        global.fetch = globalFetch;
      }
    });

    it('returns INVALID when Anthropic rejects OAuth token with 401 or 403', async () => {
      const adapter = new AnthropicAdapter(fakeEnv);

      const globalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(async () => {
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: { message: 'OAuth token has been revoked' } }),
        };
      });

      try {
        const probeRes = await adapter.probe('sk-ant-oat-expired-token');
        expect(probeRes.status).toBe('INVALID');
        if (probeRes.status === 'INVALID') {
          expect(probeRes.error).toContain('revoked');
        }
      } finally {
        global.fetch = globalFetch;
      }
    });

    it('uses x-api-key without beta headers for regular API keys', async () => {
      const adapter = new AnthropicAdapter(fakeEnv);
      let capturedHeaders: Record<string, string> = {};

      const globalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(async (url: string, init: any) => {
        capturedHeaders = init.headers;
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ id: 'claude-3-7-sonnet-20250219' }] }),
        };
      });

      try {
        const probeRes = await adapter.probe('sk-ant-api03-regular-api-key');
        expect(probeRes.status).toBe('CONNECTED');
        expect(capturedHeaders['x-api-key']).toBe('sk-ant-api03-regular-api-key');
        expect(capturedHeaders['Authorization']).toBeUndefined();
        expect(capturedHeaders['anthropic-beta']).toBeUndefined();
      } finally {
        global.fetch = globalFetch;
      }
    });
  });
});
