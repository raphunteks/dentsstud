import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createServer, type Server } from 'node:http';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, openSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, eq } from 'drizzle-orm';
import { type Database, memberProductionSettings, productionRuns, users } from '@dentweb/database';
import { bootApp, configureEnv, findChromeExecutable, registerMember, resetDatabase } from './setup.js';
import { localSlot, ProductionWorker } from '../src/modules/production/production.worker.js';

const TOKEN = 'p'.repeat(40);
const KEY = 'sk-ant-test-valid-key-0123456789';
const PCM = Buffer.alloc(48_000, 0); // 1 s of 24 kHz 16-bit silence

// ---------- Mock Anthropic (agent replies keyed on the output contract in the system prompt) + Gemini TTS ----------
const calls: { agent: string; tools: boolean }[] = [];
let factRound = 0;
let failResearchWithWebSearch = false;
const reply = (text: string, extra: unknown[] = []) => ({ content: [...extra, { type: 'text', text }], usage: { input_tokens: 10, output_tokens: 10 }, stop_reason: 'end_turn' });
const mock: Server = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const json = (s: number, o: unknown) => (res.writeHead(s, { 'content-type': 'application/json' }), res.end(JSON.stringify(o)));
    const url = new URL(req.url!, 'http://x');
    if (url.pathname === '/v1/models') return req.headers['x-api-key'] === KEY ? json(200, { data: [{ id: 'claude-sonnet-x' }] }) : json(401, { error: { message: 'invalid' } });
    if (url.pathname === '/v1/messages') {
      if (req.headers['x-api-key'] !== KEY) return json(401, { error: { message: 'invalid x-api-key' } });
      const b = JSON.parse(body) as { system?: string; tools?: unknown[]; messages: { content: unknown }[] };
      const sys = b.system ?? '';
      const tools = !!b.tools?.length;
      if (sys.includes('"keyFacts"')) {
        calls.push({ agent: 'research', tools });
        if (tools && failResearchWithWebSearch) return json(400, { error: { type: 'invalid_request_error', message: 'web search not enabled' } });
        const ws = tools ? [{ type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: 'https://www.who.int/news-room/fact-sheets/detail/oral-health', title: 'WHO Oral health' }] }] : [];
        return json(200, reply('```json\n' + JSON.stringify({ topic: 'Kenapa gigi berlubang', angle: 'bakteri dan gula', summary: 'Karies terjadi saat bakteri plak memfermentasi gula menjadi asam yang melarutkan email gigi.', keyFacts: [{ fact: 'Karies gigi permanen adalah penyakit tidak menular paling umum di dunia.', sources: ['https://www.who.int/news-room/fact-sheets/detail/oral-health'] }, { fact: 'Fluorida membantu remineralisasi email.', sources: [] }] }) + '\n```', ws));
      }
      if (sys.includes('"onScreenText"')) {
        calls.push({ agent: 'scriptwriter', tools });
        const fixed = JSON.stringify(b.messages).includes('PERBAIKAN WAJIB');
        return json(200, reply(JSON.stringify({ title: 'Gigi Berlubang Itu Asam', hook: 'Gula bukan musuh utamamu', scenes: [{ narration: 'Bakteri plak mengubah gula jadi asam.', onScreenText: 'Bakteri + gula = asam', durationSec: 2 }, { narration: fixed ? 'Fluorida membantu memperkuat email gigi.' : 'Fluorida membuat gigi kebal selamanya.', onScreenText: 'Fluorida memperkuat email', durationSec: 2 }], cta: 'Simpan video ini' })));
      }
      if (sys.includes('"CONTRADICTED"')) {
        calls.push({ agent: 'fact_checker', tools });
        factRound++;
        if (factRound === 1) return json(200, reply(JSON.stringify({ claims: [{ claim: 'Fluorida membuat gigi kebal selamanya', status: 'CONTRADICTED', note: 'Berlebihan' }, { claim: 'Bakteri mengubah gula jadi asam', status: 'VERIFIED', sources: ['https://www.who.int/news-room/fact-sheets/detail/oral-health'] }], corrections: [{ scene: 2, fix: 'Fluorida membantu remineralisasi, bukan membuat kebal.' }] })));
        return json(200, reply(JSON.stringify({ claims: [{ claim: 'Bakteri mengubah gula jadi asam', status: 'VERIFIED', sources: ['https://www.who.int/news-room/fact-sheets/detail/oral-health'] }, { claim: 'Fluorida memperkuat email', status: 'UNVERIFIED' }] })));
      }
      if (sys.includes('"big-number"')) {
        calls.push({ agent: 'motion_director', tools });
        return json(200, reply(JSON.stringify({ scenes: [{ layout: 'title-center', emphasis: 'asam', effect: 'rise', transition: 'fade' }, { layout: 'quote', emphasis: '', effect: 'fade', transition: 'slide', background: '#13202b' }] })));
      }
      if (sys.includes('"passed"')) {
        calls.push({ agent: 'qc', tools });
        return json(200, reply(JSON.stringify({ checks: [{ name: 'Keterbacaan', passed: true, note: 'Teks pendek' }] })));
      }
      if (sys.includes('"firstComment"')) {
        calls.push({ agent: 'social_media', tools });
        // First reply breaks the contract to prove the corrective retry.
        if (calls.filter((c) => c.agent === 'social_media').length === 1) return json(200, reply('Maaf, ini captionnya: gigi itu penting!'));
        return json(200, reply(JSON.stringify({ caption: 'Gigi berlubang bukan cuma soal permen. Bakteri plak mengubah gula jadi asam.', hashtags: ['kesehatangigi', '#karies', '#edukasi'], firstComment: 'Sumber: WHO Oral health', coverText: 'Gigi & Asam' })));
      }
      return json(400, { error: { message: 'unknown agent' } });
    }
    if (url.pathname === '/v1beta/models') return json(200, { models: [{ name: 'models/gemini-3.8-flash-tts' }] });
    if (url.pathname.endsWith(':generateContent')) {
      if (req.headers['x-goog-api-key'] !== 'gm-valid-key-123456') return json(400, { error: { message: 'API key not valid' } });
      return json(200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: PCM.toString('base64') } }] } }] });
    }
    json(404, {});
  });
});

let app: INestApplication;
let db: Database;
let admin: ReturnType<typeof request.agent>;
let member: ReturnType<typeof request.agent>;
let worker: ChildProcess | undefined;
let base = '';
let memberId = '';
let voiceId = '';
const tmp = mkdtempSync(join(tmpdir(), 'dw-p3-'));

async function waitRun(id: string, done: string[], secs = 240) {
  let r = (await member.get(`/api/v1/production/runs/${id}`).expect(200)).body;
  for (let i = 0; i < secs && !done.includes(r.status); i++) {
    await new Promise((x) => setTimeout(x, 1000));
    r = (await member.get(`/api/v1/production/runs/${id}`).expect(200)).body;
  }
  return r;
}

beforeAll(async () => {
  await new Promise<void>((r) => mock.listen(0, '127.0.0.1', () => r()));
  const mockBase = `http://127.0.0.1:${(mock.address() as { port: number }).port}`;
  configureEnv({ WORKER_TOKEN: TOKEN, STORAGE_DIR: join(tmp, 'storage'), ANTHROPIC_API_BASE: mockBase, GEMINI_API_BASE: mockBase, SCHEDULER_ENABLED: 'false', PRODUCTION_CONCURRENCY: '2' });
  db = await resetDatabase();
  app = await bootApp();
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
  const { loadEnv } = await import('../src/config/env.js');
  (loadEnv() as { PUBLIC_API_ORIGIN: string }).PUBLIC_API_ORIGIN = base;
  admin = await registerMember(app, 'p3admin@dentweb.test');
  await db.update(users).set({ role: 'SUPERADMIN' }).where(eq(users.email, 'p3admin@dentweb.test'));
  member = await registerMember(app, 'p3@dentweb.test');
  memberId = (await member.get('/api/v1/me')).body.id;
  worker = spawn(process.execPath, [fileURLToPath(new URL('../../render-worker/dist/index.js', import.meta.url))], {
    env: { ...process.env, API_INTERNAL_URL: base, WORKER_TOKEN: TOKEN, WORKER_NAME: 'p3-worker', REMOTION_BROWSER_EXECUTABLE: findChromeExecutable() ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' },
    stdio: ['ignore', openSync(join(tmp, 'worker.log'), 'a'), openSync(join(tmp, 'worker.log'), 'a')],
  });
  console.log('worker log', join(tmp, 'worker.log'));
}, 120_000);

afterAll(async () => {
  worker?.kill('SIGTERM');
  await app?.close();
  await db?.$client.end();
  mock.close();
});

const order = (extra: Record<string, unknown> = {}) => ({
  quantity: 1, workers: 1, format: '9:16', topicMode: 'PERSIS', topic: 'Kenapa gigi berlubang', voice: { mode: 'NONE' }, hook: { mode: 'AUTO' }, notes: '', ...extra,
});

describe('Production order validation', () => {
  it('refuses without license, then without Claude, then with an unknown voice', async () => {
    const r1 = await member.post('/api/v1/production/orders').send(order()).expect(403);
    expect(r1.body.error.message).toMatch(/Lisensi/);
    await admin.post('/api/v1/admin/licenses/grant').send({ userId: memberId, maxDevices: 2, entitlements: { maxWorkers: 2, maxVideosPerDay: 3, cloudRender: true, cloudRenderMinutesPerMonth: 120 } }).expect(201);
    const r2 = await member.post('/api/v1/production/orders').send(order()).expect(422);
    expect(r2.body.error.code).toBe('CLAUDE_NOT_CONNECTED');
    await member.post('/api/v1/ai/connections/start').send({ provider: 'anthropic', method: 'API_KEY', apiKey: KEY }).expect(201);
    await member.post('/api/v1/production/orders').send(order({ voice: { mode: 'TTS', voiceId: '00000000-0000-4000-8000-000000000000' } })).expect(422);
    await member.post('/api/v1/production/orders').send(order({ workers: 5 })).expect(422);
    await member.post('/api/v1/production/orders').send(order({ quantity: 4 })).expect(422);
    const ready = (await member.get('/api/v1/production/readiness').expect(200)).body;
    expect(ready.claudeApiKey).toBe(true);
    expect(ready.remainingToday).toBe(3);
    expect(ready.published).toEqual({ voices: 0, presets: 0, hooks: 0 });
  });
});

describe('Multi-agent production end to end (mock Claude, real TTS pipeline, real Remotion render)', () => {
  let runId = '';
  let resultId = '';
  it('sets up a published Gemini voice and the member TTS account', async () => {
    await admin.patch('/api/v1/admin/voice-providers/gemini').send({ apiKey: 'gm-valid-key-123456', isEnabled: true }).expect(200);
    const v = await admin.post('/api/v1/admin/voices').send({ provider: 'gemini', providerVoiceId: 'Kore', slug: 'kore-p3', name: 'Kore', language: 'id-ID' }).expect(201);
    voiceId = v.body.id;
    await admin.post(`/api/v1/admin/voices/${voiceId}/test`).send({}).expect(200);
    await admin.post(`/api/v1/admin/voices/${voiceId}/publish`).expect(200);
    await member.put('/api/v1/settings/voice-accounts/gemini').send({ apiKey: 'gm-valid-key-123456' }).expect(200);
    await member.put('/api/v1/settings/brand').send({ name: 'Klinik Senyum', instagramUsername: '@kliniksenyum', captionCta: 'Follow untuk tips gigi' }).expect(200);
  });

  it('is idempotent and runs all six stages to a ready video with social package', async () => {
    const body = order({ voice: { mode: 'TTS', voiceId } });
    const o = await member.post('/api/v1/production/orders').set('Idempotency-Key', 'order-key-0001').send(body).expect(201);
    const dup = await member.post('/api/v1/production/orders').set('Idempotency-Key', 'order-key-0001').send(body).expect(201);
    expect(dup.body.duplicate).toBe(true);
    expect(dup.body.id).toBe(o.body.id);
    expect(o.body.runs).toHaveLength(1);
    runId = o.body.runs[0].id;
    const r = await waitRun(runId, ['COMPLETED', 'FAILED']);
    if (r.status !== 'COMPLETED') console.error(JSON.stringify((await member.get(`/api/v1/production/runs/${runId}/events?technical=1`)).body, null, 1));
    expect(r.status).toBe('COMPLETED');
    expect(r.progress).toBe(100);
    expect(r.resultId).toBeTruthy();
    resultId = r.resultId;
    const stages = r.stages.filter((s: { status: string }) => s.status === 'COMPLETED').map((s: { stageCode: string }) => s.stageCode);
    for (const s of ['RESEARCH', 'SCRIPT', 'FACT_CHECK', 'MOTION', 'QC', 'SOCIAL']) expect(stages).toContain(s);
    // Fact-check found a contradiction and the script was revised once.
    expect(stages.filter((s: string) => s === 'SCRIPT').length).toBe(2);
    expect(calls.find((c) => c.agent === 'research')!.tools).toBe(true);
    const ev = (await member.get(`/api/v1/production/runs/${runId}/events`).expect(200)).body as { eventType: string; metadata?: unknown }[];
    expect(ev.some((e) => e.eventType === 'agent.invalid_output')).toBe(true);
    expect(ev.some((e) => e.eventType === 'agent.revision')).toBe(true);
    expect(ev[0]!.metadata).toBeUndefined();
  }, 300_000);

  it('result detail carries a real MP4, cover, sources, fact check, QC and brand-aware caption', async () => {
    const d = (await member.get(`/api/v1/results/${resultId}`).expect(200)).body;
    expect(d.status).toBe('READY');
    expect(d.title).toBe('Gigi Berlubang Itu Asam');
    expect(d.sources.some((s: { url: string }) => s.url.includes('who.int'))).toBe(true);
    expect(d.factCheck.verdict).toEqual({ verified: 1, unverified: 1, contradicted: 0 });
    expect(d.qc.passed).toBe(true);
    expect(d.social.caption).toContain('Follow untuk tips gigi');
    expect(d.social.caption).toContain('@kliniksenyum');
    expect(d.social.hashtags).toContain('#kesehatangigi');
    expect(d.coverUrl).toBeTruthy();
    const file = join(tmp, 'result.mp4');
    const res = await request(base).get(d.videoUrl.replace(base, '')).buffer(true).parse((r, cb) => { const c: Buffer[] = []; r.on('data', (x: Buffer) => c.push(x)); r.on('end', () => cb(null, Buffer.concat(c))); }).expect(200);
    writeFileSync(file, res.body as Buffer);
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height', '-of', 'json', file]).toString());
    expect(probe.streams.find((s: { codec_type: string }) => s.codec_type === 'video')).toMatchObject({ codec_name: 'h264', width: 1080, height: 1920 });
    expect(probe.streams.some((s: { codec_type: string }) => s.codec_type === 'audio')).toBe(true);
    const dl = await member.get(`/api/v1/results/${resultId}/download?json=1`).expect(200);
    expect(dl.body.url).toContain('/api/v1/files/');
    await member.get(`/api/v1/results/${resultId}/cover`).expect(302);
    const other = await registerMember(app, 'p3other@dentweb.test');
    await other.get(`/api/v1/results/${resultId}`).expect(404);
    await other.get(`/api/v1/production/runs/${runId}`).expect(404);
  });

  it('result tabs, social edit, mark uploaded, trash and restore', async () => {
    expect((await member.get('/api/v1/results?tab=READY').expect(200)).body).toHaveLength(1);
    await member.patch(`/api/v1/results/${resultId}/social`).send({ caption: 'Caption baru yang lebih pendek tapi jelas.', hashtags: ['#gigi', '#sehat'] }).expect(200);
    await member.patch(`/api/v1/results/${resultId}/social`).send({ hashtags: ['tanpa pagar'] }).expect(422);
    await member.patch(`/api/v1/results/${resultId}`).send({ status: 'UPLOADED' }).expect(200);
    expect((await member.get('/api/v1/results?tab=UPLOADED').expect(200)).body).toHaveLength(1);
    await member.delete(`/api/v1/results/${resultId}`).expect(200);
    expect((await member.get('/api/v1/results?tab=TRASH').expect(200)).body).toHaveLength(1);
    await member.post(`/api/v1/results/${resultId}/restore`).expect(200);
    expect((await member.get('/api/v1/results?tab=ALL').expect(200)).body).toHaveLength(1);
  });

  it('rerender reuses research/script/fact-check (no new research call) and links the revision', async () => {
    const researchBefore = calls.filter((c) => c.agent === 'research').length;
    const o = await member.post(`/api/v1/results/${resultId}/rerender`).send({ format: '1:1', hook: { mode: 'NONE' } }).expect(201);
    const r = await waitRun(o.body.runs[0].id, ['COMPLETED', 'FAILED']);
    expect(r.status).toBe('COMPLETED');
    expect(r.kind).toBe('REVISION');
    expect(calls.filter((c) => c.agent === 'research').length).toBe(researchBefore);
    const d = (await member.get(`/api/v1/results/${r.resultId}`).expect(200)).body;
    expect(d.revision).toBe(2);
    expect(d.parentResultId).toBe(resultId);
    // Revisions do not consume the daily quota.
    expect((await member.get('/api/v1/production/readiness').expect(200)).body.usedToday).toBe(1);
  }, 300_000);
});

describe('Cancel, resume, retry and failure honesty', () => {
  it('cancels a queued run and resumes it from checkpoint; failure is reported, not faked', async () => {
    failResearchWithWebSearch = true;
    const o = await member.post('/api/v1/production/orders').send(order({ start: false })).expect(201);
    expect(o.body.status).toBe('DRAFT');
    const id = o.body.runs[0].id;
    expect(o.body.runs[0].status).toBe('PAUSED');
    const c = await member.post(`/api/v1/production/runs/${id}/cancel`).expect(200);
    expect(c.body.status).toBe('CANCELLED');
    await member.post(`/api/v1/production/runs/${id}/resume`).expect(200);
    const r = await waitRun(id, ['COMPLETED', 'FAILED']);
    expect(r.status).toBe('COMPLETED');
    const ev = (await member.get(`/api/v1/production/runs/${id}/events`).expect(200)).body as { eventType: string; message: string }[];
    expect(ev.some((e) => e.eventType === 'agent.warning' && /Web search tidak tersedia/.test(e.message))).toBe(true);
    failResearchWithWebSearch = false;
  }, 300_000);

  it('a revoked Claude key fails the run with a clear message and retry is offered', async () => {
    const conns = (await member.get('/api/v1/ai/connections').expect(200)).body;
    await member.delete(`/api/v1/ai/connections/${conns[0].id}`).expect(200);
    // Queue directly (order validation would refuse) to simulate the key being removed mid-flight.
    const [run] = await db.select().from(productionRuns).where(and(eq(productionRuns.userId, memberId), eq(productionRuns.kind, 'PRODUCTION'))).limit(1);
    await db.update(productionRuns).set({ status: 'FAILED', resultId: null }).where(eq(productionRuns.id, run!.id));
    await member.post(`/api/v1/production/runs/${run!.id}/retry`).expect(200);
    const r = await waitRun(run!.id, ['COMPLETED', 'FAILED']);
    expect(r.status).toBe('FAILED');
    expect(r.error.message).toMatch(/API key/);
    const failed = (await member.get('/api/v1/results?tab=FAILED').expect(200)).body;
    expect(failed.some((x: { id: string }) => x.id === run!.id)).toBe(true);
  }, 120_000);
});

describe('Scheduler and admin', () => {
  it('creates exactly one order per due slot (idempotent) and records skipped slots', async () => {
    const now = new Date();
    const { time } = localSlot(now, 'Asia/Jakarta');
    await db.insert(memberProductionSettings).values({ userId: memberId, videosPerDay: 1, defaultWorkers: 1, preferredFormat: '9:16', scheduleConfig: { enabled: true, times: [time], timezone: 'Asia/Jakarta', topics: ['Benang gigi'] } }).onConflictDoNothing();
    const w = app.get(ProductionWorker);
    // Claude was disconnected above, so the slot is skipped with a notification instead of a fake run.
    const first = await w.tick(now);
    expect(first.created).toBe(0);
    await member.post('/api/v1/ai/connections/start').send({ provider: 'anthropic', method: 'API_KEY', apiKey: KEY }).expect(201);
    const second = await w.tick(now);
    expect(second.created).toBe(1);
    const third = await w.tick(now);
    expect(third.created).toBe(0);
    const queued = (await member.get('/api/v1/production/runs?status=QUEUED,RUNNING').expect(200)).body as { id: string }[];
    expect(queued.length).toBe(1);
    await member.post(`/api/v1/production/runs/${queued[0]!.id}/cancel`).expect(200);
  });

  it('admin sees all runs and logs, edits an agent prompt as a new version and publishes a workflow version', async () => {
    await member.get('/api/v1/admin/production/runs').expect(403);
    const runs = (await admin.get('/api/v1/admin/production/runs').expect(200)).body;
    expect(runs.length).toBeGreaterThan(0);
    const logs = (await admin.get(`/api/v1/admin/production/runs/${runs[runs.length - 1].id}/logs`).expect(200)).body;
    expect(logs.length).toBeGreaterThan(0);
    const agents = (await admin.get('/api/v1/admin/agents').expect(200)).body;
    expect(agents).toHaveLength(6);
    const qc = agents.find((a: { code: string }) => a.code === 'qc');
    const p = await admin.patch(`/api/v1/admin/agents/${qc.id}`).send({ systemPrompt: `${qc.systemPrompt}\nPeriksa juga ejaan.` }).expect(200);
    expect(p.body.currentVersion).toBe(2);
    const wfs = (await admin.get('/api/v1/admin/workflows').expect(200)).body;
    const bad = await admin.post('/api/v1/admin/workflows').send({ workflowId: wfs[0].id, definition: { stages: [{ code: 'SCRIPT', agent: 'scriptwriter', timeoutSec: 300, maxAttempts: 2 }, { code: 'RESEARCH', agent: 'research', timeoutSec: 300, maxAttempts: 2 }, { code: 'MOTION', agent: 'motion_director', timeoutSec: 900, maxAttempts: 1 }, { code: 'SOCIAL', agent: 'social_media', timeoutSec: 300, maxAttempts: 2 }] } }).expect(422);
    expect(bad.body.error.code).toBe('WORKFLOW_INVALID');
    const v = await admin.post('/api/v1/admin/workflows').send({ workflowId: wfs[0].id, definition: { stages: [{ code: 'RESEARCH', agent: 'research', timeoutSec: 300, maxAttempts: 2 }, { code: 'SCRIPT', agent: 'scriptwriter', timeoutSec: 300, maxAttempts: 2 }, { code: 'MOTION', agent: 'motion_director', timeoutSec: 900, maxAttempts: 1 }, { code: 'SOCIAL', agent: 'social_media', timeoutSec: 300, maxAttempts: 2 }] } }).expect(201);
    expect((await admin.post(`/api/v1/admin/workflows/${v.body.id}/test`).expect(200)).body.valid).toBe(true);
    expect((await admin.post(`/api/v1/admin/workflows/${v.body.id}/publish`).expect(200)).body.version).toBe(2);
    const q = (await admin.get('/api/v1/admin/production/quotas').expect(200)).body;
    expect(q.find((x: { email: string }) => x.email === 'p3@dentweb.test').usedToday).toBeGreaterThanOrEqual(2);
  });
});
