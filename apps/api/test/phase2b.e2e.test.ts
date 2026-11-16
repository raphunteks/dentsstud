import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { type Database, users } from '@dentweb/database';
import { bootApp, configureEnv, findChromeExecutable, registerMember, resetDatabase } from './setup.js';

const TOKEN = 'w'.repeat(40);
let app: INestApplication;
let db: Database;
let member: ReturnType<typeof request.agent>;
let admin: ReturnType<typeof request.agent>;
let worker: ChildProcess | undefined;
let base = '';
const tmp = mkdtempSync(join(tmpdir(), 'dw-p2b-'));

beforeAll(async () => {
  configureEnv({ WORKER_TOKEN: TOKEN, STORAGE_DIR: join(tmp, 'storage') });
  db = await resetDatabase();
  app = await bootApp();
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
  process.env.PUBLIC_API_ORIGIN = base;
  const { loadEnv } = await import('../src/config/env.js');
  (loadEnv() as { PUBLIC_API_ORIGIN: string }).PUBLIC_API_ORIGIN = base;
  member = await registerMember(app, 'p2b@dentweb.test');
  admin = await registerMember(app, 'p2badmin@dentweb.test');
  await db.update(users).set({ role: 'SUPERADMIN' }).where(eq(users.email, 'p2badmin@dentweb.test'));
  const me = (await member.get('/api/v1/me')).body;
  await admin.post('/api/v1/admin/licenses/grant').send({ userId: me.id, maxDevices: 2 }).expect(201);
  const ad = (await admin.get('/api/v1/me')).body;
  await admin.post('/api/v1/admin/licenses/grant').send({ userId: ad.id, maxDevices: 2 }).expect(201);
}, 120_000);

afterAll(async () => {
  worker?.kill('SIGTERM');
  await app?.close();
  await db?.$client.end();
});

describe('Projects: documents, operations, offline sync', () => {
  let pid = '';
  it('creates, edits with revisions and rejects stale whole-document saves', async () => {
    const p = await member.post('/api/v1/projects').send({ name: 'Siklus air', format: '9:16' }).expect(201);
    pid = p.body.id;
    const d = await member.get(`/api/v1/projects/${pid}/document`).expect(200);
    expect(d.body.revision).toBe(1);
    const doc = d.body.document;
    doc.scenes[0].layers[0].text = 'Siklus air dalam 60 detik';
    await member.put(`/api/v1/projects/${pid}/document`).send({ document: doc, baseRevision: 1 }).expect(200);
    const stale = await member.put(`/api/v1/projects/${pid}/document`).send({ document: doc, baseRevision: 1 }).expect(409);
    expect(stale.body.error.code).toBe('REVISION_CONFLICT');
    const bad = { ...doc, fps: 999 };
    await member.put(`/api/v1/projects/${pid}/document`).send({ document: bad, baseRevision: 2 }).expect(422);
  });

  it('applies idempotent operations, rebases stale but mergeable ops, and makes a conflict copy otherwise', async () => {
    const opId = randomUUID();
    const add = { op: 'addScene', scene: { id: 's2', durationFrames: 60, layers: [{ id: 'x', type: 'text', text: 'Penguapan' }] } };
    const r1 = await member.post(`/api/v1/projects/${pid}/operations`).send({ operationId: opId, baseRevision: 2, ops: [add] }).expect(200);
    expect(r1.body.revision).toBe(3);
    const again = await member.post(`/api/v1/projects/${pid}/operations`).send({ operationId: opId, baseRevision: 2, ops: [add] }).expect(200);
    expect(again.body.duplicate).toBe(true);
    const r2 = await member.post(`/api/v1/projects/${pid}/operations`).send({ operationId: randomUUID(), baseRevision: 2, ops: [{ op: 'updateScene', sceneId: 's2', patch: { durationFrames: 45 } }] }).expect(200);
    expect(r2.body.rebased).toBe(true);
    const c = await member.post(`/api/v1/projects/${pid}/operations`).send({ operationId: randomUUID(), baseRevision: 2, ops: [{ op: 'updateLayer', sceneId: 'zzz', layerId: 'x', patch: { text: 'hilang?' } }] }).expect(200);
    expect(c.body.conflict.copyProjectId).toBeTruthy();
    const list = await member.get('/api/v1/projects').expect(200);
    expect(list.body.some((p: { name: string }) => p.name.includes('konflik'))).toBe(true);
    const other = await registerMember(app, 'intruder@dentweb.test');
    await other.get(`/api/v1/projects/${pid}/document`).expect(404);
  });

  it('cloud render: real Remotion worker renders an MP4 from an immutable snapshot', async () => {
    const workerEntry = fileURLToPath(new URL('../../render-worker/dist/index.js', import.meta.url));
    worker = spawn(process.execPath, [workerEntry], {
      env: { ...process.env, REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379', API_INTERNAL_URL: base, WORKER_TOKEN: TOKEN, WORKER_NAME: 'test-worker', REMOTION_BROWSER_EXECUTABLE: findChromeExecutable() ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' },
      stdio: 'pipe',
    });
    const job = await member.post('/api/v1/render/jobs').send({ projectId: pid, mode: 'CLOUD', format: 'mp4' }).expect(201);
    expect(job.body.status).toBe('QUEUED');
    let j = job.body;
    for (let i = 0; i < 120 && !['COMPLETED', 'FAILED'].includes(j.status); i++) {
      await new Promise((r) => setTimeout(r, 1000));
      j = (await member.get(`/api/v1/render/jobs/${j.id}`).expect(200)).body;
    }
    expect(j.status).toBe('COMPLETED');
    expect(j.outputs).toHaveLength(1);
    const file = join(tmp, 'out.mp4');
    const res = await request(base).get(j.outputs[0].url.replace(base, '')).buffer(true).parse((r, cb) => { const c: Buffer[] = []; r.on('data', (d: Buffer) => c.push(d)); r.on('end', () => cb(null, Buffer.concat(c))); }).expect(200);
    writeFileSync(file, res.body as Buffer);
    const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height,nb_frames', '-of', 'json', file]).toString();
    const s = JSON.parse(probe).streams[0];
    expect(s.codec_name).toBe('h264');
    expect([s.width, s.height]).toEqual([1080, 1920]);
    expect(Number(s.nb_frames)).toBe(120 + 45);
    const w = await admin.get('/api/v1/admin/workers').expect(200);
    expect(w.body.some((x: { name: string }) => x.name === 'test-worker')).toBe(true);
    await request(base).post(`/api/v1/internal/render/jobs/${j.id}/start`).send({}).expect(401);
  }, 180_000);

  it('local render: desktop flow reports progress and uploads output; cancel and retry work', async () => {
    const job = await member.post('/api/v1/render/jobs').send({ projectId: pid, mode: 'LOCAL', format: 'mp4' }).expect(201);
    expect(job.body.status).toBe('AWAITING_LOCAL');
    const s = await member.post(`/api/v1/render/jobs/${job.body.id}/local/start`).expect(200);
    expect(s.body.proceed).toBe(true);
    const doc = (await (await fetch(s.body.inputUrl)).json()) as { scenes: unknown[] };
    expect(doc.scenes).toHaveLength(2);
    await member.post(`/api/v1/render/jobs/${job.body.id}/local/progress`).send({ progress: 0.5 }).expect(200);
    const mp4 = join(tmp, 'out.mp4');
    const done = await member.post(`/api/v1/render/jobs/${job.body.id}/local/output`).attach('file', mp4, { filename: 'local.mp4' }).expect(200);
    expect(done.body.status).toBe('COMPLETED');
    const c = await member.post('/api/v1/render/jobs').send({ projectId: pid, mode: 'LOCAL', format: 'webm' }).expect(201);
    await member.post(`/api/v1/render/jobs/${c.body.id}/cancel`).expect(200);
    const rt = await member.post(`/api/v1/render/jobs/${c.body.id}/retry`).expect(200);
    expect(rt.body.status).toBe('AWAITING_LOCAL');
  });

  it('preset test render is queued as a system project', async () => {
    const cats = await admin.get('/api/v1/admin/styles/categories').expect(200);
    const p = await admin.post('/api/v1/admin/styles/presets').send({ categoryId: cats.body[0].id, slug: 'uji-render', name: 'Uji Render', recipe: { palette: { background: '#0b1f3a', ink: '#ffffff', accent: '#ffb000' }, typography: { display: 'Chivo', body: 'Chivo' }, motion: {}, layout: {} } }).expect(201);
    const t = await admin.post(`/api/v1/admin/styles/presets/${p.body.id}/test-render`).send({ format: '1:1' }).expect(202);
    expect(t.body.mode).toBe('CLOUD');
    expect((await admin.get('/api/v1/projects').expect(200)).body.some((x: { name: string }) => x.name.startsWith('Test render'))).toBe(false);
  });
});
