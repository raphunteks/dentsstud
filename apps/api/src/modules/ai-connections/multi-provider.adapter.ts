import { Injectable } from '@nestjs/common';
import { redact } from '../../infra/crypto.js';
import type { ProbeResult } from './anthropic.adapter.js';

export const DEFAULT_PROVIDER_MODELS: Record<string, string[]> = {
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  openai: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini'],
  openrouter: ['anthropic/claude-sonnet-4', 'google/gemini-2.5-pro', 'openai/gpt-4o', 'deepseek/deepseek-chat-v3-0324'],
  custom_gateway: ['claude-sonnet-4-5', 'gpt-4o', 'gemini-2.5-flash'],
};

/** SSRF guard for user-supplied gateway URLs (blocks loopback, metadata, RFC1918 private IPs). */
export function assertSafeGatewayUrl(rawUrl: string): string {
  let u: URL;
  try {
    u = new URL(rawUrl.trim());
  } catch {
    throw new Error('URL gateway tidak valid');
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new Error('URL gateway harus menggunakan http:// atau https://');
  }
  const host = u.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '::1' ||
    host === '[::1]' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw new Error('URL gateway lokal atau jaringan privat tidak diizinkan (SSRF guard)');
  }
  return u.toString().replace(/\/+$/, '');
}

function flattenContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part && typeof (part as { text?: unknown }).text === 'string') {
          return (part as { text: string }).text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return String(content ?? '');
}

function openAiBase(provider: string, baseUrl?: string): string {
  if (provider === 'openai') return 'https://api.openai.com/v1';
  if (provider === 'openrouter') return 'https://openrouter.ai/api/v1';
  if (provider === 'custom_gateway') {
    if (!baseUrl) throw new Error('Base URL wajib diisi untuk Custom Gateway / 9Router');
    const clean = assertSafeGatewayUrl(baseUrl);
    return clean.endsWith('/v1') ? clean : `${clean}/v1`;
  }
  throw new Error(`Provider tidak dikenal: ${provider}`);
}

@Injectable()
export class MultiProviderAdapter {
  pickModel(provider: string, models: string[]): string {
    const defaults = DEFAULT_PROVIDER_MODELS[provider] ?? DEFAULT_PROVIDER_MODELS.custom_gateway!;
    for (const preferred of defaults) {
      if (models.includes(preferred)) return preferred;
    }
    return models[0] ?? defaults[0] ?? 'gpt-4o-mini';
  }

  async probe(
    provider: string,
    credential: string,
    opts: { baseUrl?: string; isOAuth?: boolean; signal?: AbortSignal } = {},
  ): Promise<ProbeResult> {
    const token = credential.trim().replace(/^Bearer\s+/i, '');
    const signal = opts.signal ?? AbortSignal.timeout(provider === 'custom_gateway' ? 25_000 : 15_000);

    try {
      if (provider === 'gemini') {
        const url = opts.isOAuth
          ? 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=50'
          : `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(token)}&pageSize=50`;
        const headers: Record<string, string> = opts.isOAuth ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(url, { headers, signal });
        if (res.status === 401 || res.status === 403 || res.status === 400) {
          const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          return { status: 'INVALID', error: redact(j.error?.message ?? 'Kredensial Gemini ditolak'), httpStatus: res.status };
        }
        if (!res.ok) return { status: 'UNAVAILABLE', error: `Gemini API merespons ${res.status}`, httpStatus: res.status };
        const body = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
        const models = (body.models ?? [])
          .filter((m) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent'))
          .map((m) => m.name.replace(/^models\//, ''))
          .filter((m) => m.startsWith('gemini-'));
        return { status: 'CONNECTED', models: models.length ? models : DEFAULT_PROVIDER_MODELS.gemini! };
      }

      const base = openAiBase(provider, opts.baseUrl);
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        ...(provider === 'openrouter' ? { 'HTTP-Referer': 'https://motion.dentsweb.my.id', 'X-Title': 'DENTSWEB STUDIO' } : {}),
      };
      const res = await fetch(`${base}/models`, { headers, signal });
      if (res.status === 401 || res.status === 403) {
        const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        return { status: 'INVALID', error: redact(j.error?.message ?? `Kredensial ${provider} ditolak`), httpStatus: res.status };
      }
      if (!res.ok) return { status: 'UNAVAILABLE', error: `${provider} merespons ${res.status}`, httpStatus: res.status };
      const body = (await res.json().catch(() => ({}))) as { data?: { id: string }[] };
      const seen = new Set<string>();
      const models: string[] = [];
      for (const m of body.data ?? []) {
        if (m?.id && !seen.has(m.id)) {
          seen.add(m.id);
          models.push(m.id);
          if (models.length >= 500) break;
        }
      }
      return { status: 'CONNECTED', models: models.length ? models : (DEFAULT_PROVIDER_MODELS[provider] ?? DEFAULT_PROVIDER_MODELS.custom_gateway!) };
    } catch (e) {
      return { status: 'UNAVAILABLE', error: redact(`Tidak dapat menghubungi ${provider}: ${(e as Error).message}`) };
    }
  }

  async messages(
    provider: string,
    credential: string,
    body: { model: string; system: string; messages: { role: 'user' | 'assistant'; content: unknown }[]; max_tokens: number },
    opts: { baseUrl?: string; isOAuth?: boolean; signal?: AbortSignal } = {},
  ) {
    const token = credential.trim().replace(/^Bearer\s+/i, '');
    const signal = opts.signal ?? AbortSignal.timeout(180_000);

    try {
      if (provider === 'gemini') {
        const model = body.model || DEFAULT_PROVIDER_MODELS.gemini![0]!;
        const url = opts.isOAuth
          ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
          : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(token)}`;
        const headers: Record<string, string> = {
          'content-type': 'application/json',
          ...(opts.isOAuth ? { Authorization: `Bearer ${token}` } : {}),
        };
        const payload = {
          ...(body.system ? { systemInstruction: { parts: [{ text: body.system }] } } : {}),
          contents: body.messages.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: flattenContent(m.content) }],
          })),
          generationConfig: { maxOutputTokens: body.max_tokens },
        };
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload), signal });
        const j = (await res.json().catch(() => ({}))) as {
          candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
          usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
          error?: { message?: string; status?: string };
        };
        if (!res.ok) {
          return {
            ok: false as const,
            status: res.status,
            error: redact(j.error?.message ?? `HTTP ${res.status}`),
            errorType: j.error?.status,
          };
        }
        const text = (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('\n');
        return {
          ok: true as const,
          text,
          sources: [] as { url: string; title: string }[],
          usage: { input_tokens: j.usageMetadata?.promptTokenCount, output_tokens: j.usageMetadata?.candidatesTokenCount },
          stopReason: j.candidates?.[0]?.finishReason,
          model,
        };
      }

      const base = openAiBase(provider, opts.baseUrl);
      const model = body.model || this.pickModel(provider, []);
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        ...(provider === 'openrouter' ? { 'HTTP-Referer': 'https://motion.dentsweb.my.id', 'X-Title': 'DENTSWEB STUDIO' } : {}),
      };
      const chatMessages = [
        ...(body.system ? [{ role: 'system', content: body.system }] : []),
        ...body.messages.map((m) => ({ role: m.role, content: flattenContent(m.content) })),
      ];
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages: chatMessages, max_tokens: body.max_tokens }),
        signal,
      });
      const j = (await res.json().catch(() => ({}))) as {
        choices?: { message?: { content?: string }; finish_reason?: string }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
        error?: { message?: string; type?: string; code?: string };
      };
      if (!res.ok) {
        return {
          ok: false as const,
          status: res.status,
          error: redact(j.error?.message ?? `HTTP ${res.status}`),
          errorType: j.error?.type ?? j.error?.code,
        };
      }
      const text = j.choices?.[0]?.message?.content ?? '';
      return {
        ok: true as const,
        text,
        sources: [] as { url: string; title: string }[],
        usage: { input_tokens: j.usage?.prompt_tokens, output_tokens: j.usage?.completion_tokens },
        stopReason: j.choices?.[0]?.finish_reason,
        model,
      };
    } catch (e) {
      return { ok: false as const, status: 503, error: redact(`Gagal memanggil ${provider}: ${(e as Error).message}`), errorType: 'network_error' };
    }
  }

  async complete(
    provider: string,
    credential: string,
    model: string,
    prompt: string,
    opts: { baseUrl?: string; isOAuth?: boolean; maxTokens?: number } = {},
  ) {
    return this.messages(
      provider,
      credential,
      { model, system: '', messages: [{ role: 'user', content: prompt }], max_tokens: opts.maxTokens ?? 300 },
      { baseUrl: opts.baseUrl, isOAuth: opts.isOAuth, signal: AbortSignal.timeout(60_000) },
    );
  }
}
