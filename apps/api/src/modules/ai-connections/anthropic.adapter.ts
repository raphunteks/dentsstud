import { Inject, Injectable } from '@nestjs/common';
import { ENV } from '../../infra/tokens.js';
import type { Env } from '../../config/env.js';
import { redact } from '../../infra/crypto.js';

export type ProbeResult =
  | { status: 'CONNECTED'; models: string[] }
  | { status: 'INVALID' | 'UNAVAILABLE'; error: string; httpStatus?: number };

const VERSION = '2023-06-01';

/** Talks to the official Anthropic Messages API with the member's own API key. */
@Injectable()
export class AnthropicAdapter {
  constructor(@Inject(ENV) private readonly env: Env) {}

  private headers(credential: string): Record<string, string> {
    const token = credential.trim().replace(/^Bearer\s+/i, '');
    if (token.startsWith('sk-ant-oat') || (token.length > 80 && !token.startsWith('sk-ant-api'))) {
      return {
        'Authorization': `Bearer ${token}`,
        'anthropic-version': VERSION,
        'anthropic-beta': 'oauth-2025-04-20,claude-code-20250219',
        'anthropic-dangerous-direct-browser-access': 'true',
        'User-Agent': 'claude-cli/1.0.0 (external, sdk-cli)',
        'X-App': 'cli',
        'content-type': 'application/json',
      };
    }
    return { 'x-api-key': token, 'anthropic-version': VERSION, 'content-type': 'application/json' };
  }

  async probe(credential: string, signal = AbortSignal.timeout(15_000)): Promise<ProbeResult> {
    const token = credential.trim().replace(/^Bearer\s+/i, '');
    const isOAuth = token.startsWith('sk-ant-oat') || (token.length > 80 && !token.startsWith('sk-ant-api'));
    try {
      if (isOAuth) {
        // OAuth tokens for Claude Code (9Router style) are scoped for messages, not /v1/models
        const testRes = await fetch(`${this.env.ANTHROPIC_API_BASE}/v1/messages`, {
          method: 'POST',
          headers: this.headers(token),
          body: JSON.stringify({ model: 'claude-3-5-haiku-20241022', max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
          signal,
        });
        if (testRes.status === 401 || testRes.status === 403) {
          const errBody = (await testRes.json().catch(() => ({}))) as { error?: { message?: string } };
          return { status: 'INVALID', error: errBody.error?.message ?? 'Kredensial OAuth ditolak oleh Anthropic', httpStatus: testRes.status };
        }
        if (testRes.ok || testRes.status === 400 || testRes.status === 429) {
          return { status: 'CONNECTED', models: ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'] };
        }
        return { status: 'UNAVAILABLE', error: `Anthropic API merespons ${testRes.status}`, httpStatus: testRes.status };
      }

      const res = await fetch(`${this.env.ANTHROPIC_API_BASE}/v1/models?limit=100`, { headers: this.headers(token), signal });
      if (res.status === 401 || res.status === 403) return { status: 'INVALID', error: 'Kredensial ditolak oleh Anthropic', httpStatus: res.status };
      if (!res.ok) {
        // Fallback probe via lightweight messages
        const fallbackRes = await fetch(`${this.env.ANTHROPIC_API_BASE}/v1/messages`, {
          method: 'POST',
          headers: this.headers(credential),
          body: JSON.stringify({ model: 'claude-3-5-haiku-20241022', max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
          signal,
        }).catch(() => null);
        if (fallbackRes && (fallbackRes.ok || fallbackRes.status === 400)) {
          return { status: 'CONNECTED', models: ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'] };
        }
        return { status: 'UNAVAILABLE', error: `Anthropic API merespons ${res.status}`, httpStatus: res.status };
      }
      const body = (await res.json()) as { data?: { id: string }[] };
      const models = (body.data ?? []).map((m) => m.id);
      return { status: 'CONNECTED', models: models.length ? models : ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'] };
    } catch (e) {
      return { status: 'UNAVAILABLE', error: redact(`Tidak dapat menghubungi Anthropic: ${(e as Error).message}`) };
    }
  }

  pickModel(models: string[]): string | undefined {
    return models.find((m) => m.includes('sonnet')) ?? models.find((m) => m.includes('haiku')) ?? models[0];
  }

  /** Raw Messages API call (agents). Returns text plus any web_search result sources. */
  async messages(apiKey: string, body: { model: string; system: string; messages: { role: 'user' | 'assistant'; content: unknown }[]; max_tokens: number; tools?: unknown[] }, signal?: AbortSignal) {
    const res = await fetch(`${this.env.ANTHROPIC_API_BASE}/v1/messages`, {
      method: 'POST',
      headers: this.headers(apiKey),
      body: JSON.stringify(body),
      signal: signal ?? AbortSignal.timeout(180_000),
    });
    const j = (await res.json().catch(() => ({}))) as { content?: { type: string; text?: string; content?: { type: string; url?: string; title?: string }[] }[]; error?: { type?: string; message?: string }; usage?: { input_tokens?: number; output_tokens?: number }; stop_reason?: string };
    if (!res.ok) return { ok: false as const, status: res.status, error: redact(j.error?.message ?? `HTTP ${res.status}`), errorType: j.error?.type };
    const text = (j.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    const sources = (j.content ?? [])
      .filter((c) => c.type === 'web_search_tool_result' && Array.isArray(c.content))
      .flatMap((c) => c.content!.filter((r) => r.type === 'web_search_result' && r.url).map((r) => ({ url: r.url!, title: r.title ?? r.url! })));
    return { ok: true as const, text, sources, usage: j.usage, stopReason: j.stop_reason };
  }

  async complete(apiKey: string, model: string, prompt: string, maxTokens = 300) {
    const res = await fetch(`${this.env.ANTHROPIC_API_BASE}/v1/messages`, {
      method: 'POST',
      headers: this.headers(apiKey),
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(60_000),
    });
    const body = (await res.json().catch(() => ({}))) as { content?: { type: string; text?: string }[]; error?: { message?: string }; usage?: unknown };
    if (!res.ok) return { ok: false as const, status: res.status, error: redact(body.error?.message ?? `HTTP ${res.status}`) };
    const text = (body.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    return { ok: true as const, text, usage: body.usage, model };
  }
}
