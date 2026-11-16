/**
 * DENTWEB render worker. Pulls jobs from Redis (outbound only, no public port), renders with Remotion + FFmpeg,
 * talks to the API only through the token-protected /internal channel (no direct DB access).
 */
import { Worker } from 'bullmq';
import { hostname, cpus, totalmem } from 'node:os';
import { mkdir, rm } from 'node:fs/promises';
import { openAsBlob } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { z } from 'zod';
import { renderDocument } from '@dentweb/remotion-compositions';

const Env = z.object({
  REDIS_URL: z.string().min(1),
  API_INTERNAL_URL: z.string().url().default('http://localhost:4000'),
  WORKER_TOKEN: z.string().min(32),
  WORKER_NAME: z.string().default(`render-${hostname()}`),
  /** Isolates environments that share one Redis (must match the API's QUEUE_PREFIX). */
  QUEUE_PREFIX: z.string().regex(/^[\w-]{1,40}$/).default('dentweb'),
  RENDER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(1),
  REMOTION_BROWSER_EXECUTABLE: z.string().optional(),
  REMOTION_CONCURRENCY: z.coerce.number().int().min(1).max(32).optional(),
});
const env = Env.parse(process.env);
const RENDER_QUEUE = 'dw-render';
const caps = { cpus: cpus().length, memGb: Math.round(totalmem() / 2 ** 30), formats: ['mp4', 'webm', 'gif'] };

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${env.API_INTERNAL_URL}/api/v1/internal${path}`, { ...init, headers: { 'x-worker-token': env.WORKER_TOKEN, ...(init.body && !(init.body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...init.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`API ${path} ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body as T;
}

function redis(url: string) {
  const u = new URL(url);
  return { host: u.hostname, port: Number(u.port || 6379), username: u.username || undefined, password: u.password ? decodeURIComponent(u.password) : undefined, tls: u.protocol === 'rediss:' ? {} : undefined, maxRetriesPerRequest: null };
}

const log = (msg: string, extra: Record<string, unknown> = {}) => console.log(JSON.stringify({ t: new Date().toISOString(), worker: env.WORKER_NAME, msg, ...extra }));

const worker = new Worker(
  RENDER_QUEUE,
  async (job) => {
    const id = String(job.data.jobId);
    const start = await api<{ proceed: boolean; status?: string; inputUrl?: string; format?: 'mp4' | 'webm' | 'gif' }>(`/render/jobs/${id}/start`, {
      method: 'POST',
      body: JSON.stringify({ workerName: env.WORKER_NAME, capabilities: caps }),
    });
    if (!start.proceed) return log('skip', { id, status: start.status });
    const dir = join(tmpdir(), 'dentweb-render', id);
    await mkdir(dir, { recursive: true });
    const ac = new AbortController();
    let last = 0;
    try {
      const doc = await (await fetch(start.inputUrl!)).json();
      const out = join(dir, `out.${start.format}`);
      log('render.start', { id, format: start.format });
      await renderDocument({
        doc,
        outPath: out,
        format: start.format,
        browserExecutable: env.REMOTION_BROWSER_EXECUTABLE ?? null,
        concurrency: env.REMOTION_CONCURRENCY ?? null,
        signal: ac.signal,
        onProgress: (p) => {
          if (Date.now() - last < 1500 && p < 1) return;
          last = Date.now();
          void api<{ cancel: boolean }>(`/render/jobs/${id}/progress`, { method: 'POST', body: JSON.stringify({ progress: p }) })
            .then((r) => r.cancel && ac.abort())
            .catch(() => undefined);
        },
      });
      const fd = new FormData();
      fd.append('file', await openAsBlob(out), `out.${start.format}`);
      await api(`/render/jobs/${id}/output`, { method: 'POST', body: fd });
      log('render.done', { id });
    } catch (e) {
      const msg = ac.signal.aborted ? 'Dibatalkan' : (e as Error).message;
      log('render.fail', { id, error: msg });
      await api(`/render/jobs/${id}/fail`, { method: 'POST', body: JSON.stringify({ error: msg }) }).catch(() => undefined);
      if (!ac.signal.aborted) throw e;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
  { connection: redis(env.REDIS_URL), prefix: env.QUEUE_PREFIX, concurrency: env.RENDER_CONCURRENCY, lockDuration: 120_000 },
);

const beat = () => api('/workers/heartbeat', { method: 'POST', body: JSON.stringify({ name: env.WORKER_NAME, capabilities: caps }) }).catch((e) => log('heartbeat.fail', { error: (e as Error).message }));
void beat();
const timer = setInterval(beat, 20_000);
worker.on('failed', (j, e) => log('job.failed', { id: j?.id, error: e.message }));
log('worker.ready', { queue: RENDER_QUEUE, concurrency: env.RENDER_CONCURRENCY });

const shutdown = async () => {
  clearInterval(timer);
  await worker.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
