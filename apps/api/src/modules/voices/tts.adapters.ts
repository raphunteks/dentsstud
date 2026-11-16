import { Inject, Injectable } from '@nestjs/common';
import { ENV } from '../../infra/tokens.js';
import type { Env } from '../../config/env.js';
import { redact } from '../../infra/crypto.js';

export interface SynthesisRequest {
  text: string;
  voiceId: string;
  emotion?: string | null;
  speed?: number | null;
  pitch?: number | null;
  instructions?: string | null;
  model?: string | null;
  stability?: number;
  similarityBoost?: number;
}
export interface Credentials {
  apiKey?: string;
  baseUrl?: string;
}
export type SynthResult = { ok: true; audio: Buffer; mime: 'audio/wav' | 'audio/mpeg'; ext: 'wav' | 'mp3' } | { ok: false; status: 'INVALID' | 'UNAVAILABLE'; error: string };
export type ProbeResult = { status: 'CONNECTED' | 'INVALID' | 'UNAVAILABLE'; error?: string; info?: Record<string, unknown> };

export interface TtsAdapter {
  readonly provider: 'gemini' | 'elevenlabs' | 'cadangan';
  readonly capabilities: { emotion: boolean; speed: boolean; pitch: boolean; instructions: boolean };
  probe(c: Credentials): Promise<ProbeResult>;
  synthesize(c: Credentials, r: SynthesisRequest): Promise<SynthResult>;
}

/** Wraps 16-bit mono PCM in a RIFF/WAV header. */
export function pcmToWav(pcm: Buffer, sampleRate = 24000, channels = 1) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * channels * 2, 28);
  h.writeUInt16LE(channels * 2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

const fail = (status: number, msg: string): SynthResult => ({ ok: false, status: status === 401 || status === 403 ? 'INVALID' : 'UNAVAILABLE', error: redact(msg) });
const net = (e: unknown): SynthResult => ({ ok: false, status: 'UNAVAILABLE', error: redact(`Provider tidak dapat dihubungi: ${(e as Error).message}`) });

/** Gemini API TTS (generateContent with AUDIO modality). Style/emotion via speech metadata. */
@Injectable()
export class GeminiTts implements TtsAdapter {
  readonly provider = 'gemini' as const;
  readonly capabilities = { emotion: true, speed: true, pitch: false, instructions: true };
  constructor(@Inject(ENV) private readonly env: Env) {}

  async probe(c: Credentials): Promise<ProbeResult> {
    if (!c.apiKey) return { status: 'INVALID', error: 'API key Gemini kosong' };
    try {
      const r = await fetch(`${this.env.GEMINI_API_BASE}/v1beta/models?pageSize=200`, { headers: { 'x-goog-api-key': c.apiKey }, signal: AbortSignal.timeout(15_000) });
      if (r.status === 400 || r.status === 401 || r.status === 403) return { status: 'INVALID', error: 'API key Gemini ditolak' };
      if (!r.ok) return { status: 'UNAVAILABLE', error: `Gemini API ${r.status}` };
      const j = (await r.json()) as { models?: { name: string }[] };
      const tts = (j.models ?? []).map((m) => m.name.replace(/^models\//, '')).filter((n) => n.includes('tts'));
      return { status: 'CONNECTED', info: { ttsModels: tts } };
    } catch (e) {
      return { status: 'UNAVAILABLE', error: redact((e as Error).message) };
    }
  }

  async synthesize(c: Credentials, r: SynthesisRequest): Promise<SynthResult> {
    if (!c.apiKey) return { ok: false, status: 'INVALID', error: 'API key Gemini belum diatur' };
    const style = [r.emotion, r.speed && r.speed !== 1 ? (r.speed > 1 ? `tempo lebih cepat (${r.speed}x)` : `tempo lebih lambat (${r.speed}x)`) : null, r.instructions].filter(Boolean).join('; ');
    const model = r.model || this.env.GEMINI_TTS_MODEL;
    try {
      const res = await fetch(`${this.env.GEMINI_API_BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': c.apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: r.text, ...(style ? { speech_metadata: { style } } : {}) }] }],
          generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { voice: r.voiceId } } },
        }),
        signal: AbortSignal.timeout(90_000),
      });
      const j = (await res.json().catch(() => ({}))) as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[]; error?: { message?: string } };
      if (!res.ok) return fail(res.status, j.error?.message ?? `Gemini ${res.status}`);
      const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
      if (!part?.data) return { ok: false, status: 'UNAVAILABLE', error: 'Gemini tidak mengembalikan audio' };
      const bytes = Buffer.from(part.data, 'base64');
      // Gemini 3.8 TTS returns WAV; earlier models returned raw 24 kHz L16 PCM.
      const isWav = bytes.subarray(0, 4).toString('ascii') === 'RIFF';
      const rate = Number(/rate=(\d+)/.exec(part.mimeType ?? '')?.[1] ?? 24000);
      return { ok: true, audio: isWav ? bytes : pcmToWav(bytes, rate), mime: 'audio/wav', ext: 'wav' };
    } catch (e) {
      return net(e);
    }
  }
}

/** ElevenLabs text-to-speech (mp3). Speed and stability map to voice_settings; pitch is not offered. */
@Injectable()
export class ElevenLabsTts implements TtsAdapter {
  readonly provider = 'elevenlabs' as const;
  readonly capabilities = { emotion: false, speed: true, pitch: false, instructions: false };
  constructor(@Inject(ENV) private readonly env: Env) {}

  async probe(c: Credentials): Promise<ProbeResult> {
    if (!c.apiKey) return { status: 'INVALID', error: 'API key ElevenLabs kosong' };
    try {
      const r = await fetch(`${this.env.ELEVENLABS_API_BASE}/v1/models`, { headers: { 'xi-api-key': c.apiKey }, signal: AbortSignal.timeout(15_000) });
      if (r.status === 401 || r.status === 403) return { status: 'INVALID', error: 'API key ElevenLabs ditolak' };
      if (!r.ok) return { status: 'UNAVAILABLE', error: `ElevenLabs ${r.status}` };
      const j = (await r.json()) as { model_id: string; can_do_text_to_speech?: boolean }[];
      return { status: 'CONNECTED', info: { models: j.filter((m) => m.can_do_text_to_speech !== false).map((m) => m.model_id) } };
    } catch (e) {
      return { status: 'UNAVAILABLE', error: redact((e as Error).message) };
    }
  }

  async synthesize(c: Credentials, r: SynthesisRequest): Promise<SynthResult> {
    if (!c.apiKey) return { ok: false, status: 'INVALID', error: 'API key ElevenLabs belum diatur' };
    try {
      const res = await fetch(`${this.env.ELEVENLABS_API_BASE}/v1/text-to-speech/${encodeURIComponent(r.voiceId)}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': c.apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify({
          text: r.text,
          model_id: r.model || this.env.ELEVENLABS_MODEL,
          voice_settings: { stability: r.stability ?? 0.5, similarity_boost: r.similarityBoost ?? 0.75, speed: r.speed ?? 1 },
        }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { detail?: { message?: string } | string };
        return fail(res.status, typeof j.detail === 'string' ? j.detail : (j.detail?.message ?? `ElevenLabs ${res.status}`));
      }
      return { ok: true, audio: Buffer.from(await res.arrayBuffer()), mime: 'audio/mpeg', ext: 'mp3' };
    } catch (e) {
      return net(e);
    }
  }
}

/**
 * "Cadangan": any self-hosted engine exposing the OpenAI-compatible POST {baseUrl}/v1/audio/speech
 * (e.g. Kokoro/Piper servers). Unconfigured → UNAVAILABLE, never simulated.
 */
@Injectable()
export class FallbackTts implements TtsAdapter {
  readonly provider = 'cadangan' as const;
  readonly capabilities = { emotion: false, speed: true, pitch: false, instructions: false };

  async probe(c: Credentials): Promise<ProbeResult> {
    if (!c.baseUrl) return { status: 'UNAVAILABLE', error: 'URL engine cadangan belum diatur' };
    try {
      const r = await fetch(`${c.baseUrl.replace(/\/$/, '')}/v1/models`, { headers: c.apiKey ? { authorization: `Bearer ${c.apiKey}` } : {}, signal: AbortSignal.timeout(10_000) });
      if (r.status === 401 || r.status === 403) return { status: 'INVALID', error: 'Engine cadangan menolak kredensial' };
      return r.ok ? { status: 'CONNECTED' } : { status: 'UNAVAILABLE', error: `Engine cadangan ${r.status}` };
    } catch (e) {
      return { status: 'UNAVAILABLE', error: redact((e as Error).message) };
    }
  }

  async synthesize(c: Credentials, r: SynthesisRequest): Promise<SynthResult> {
    if (!c.baseUrl) return { ok: false, status: 'UNAVAILABLE', error: 'URL engine cadangan belum diatur' };
    try {
      const res = await fetch(`${c.baseUrl.replace(/\/$/, '')}/v1/audio/speech`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(c.apiKey ? { authorization: `Bearer ${c.apiKey}` } : {}) },
        body: JSON.stringify({ model: r.model ?? 'tts-1', voice: r.voiceId, input: r.text, speed: r.speed ?? 1, response_format: 'mp3' }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!res.ok) return fail(res.status, `Engine cadangan ${res.status}`);
      return { ok: true, audio: Buffer.from(await res.arrayBuffer()), mime: 'audio/mpeg', ext: 'mp3' };
    } catch (e) {
      return net(e);
    }
  }
}
