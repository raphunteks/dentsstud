import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { type Database, users } from '@dentweb/database';
import { bootApp, configureEnv, registerMember, resetDatabase } from './setup.js';

const METRICS = 'm'.repeat(32);
let app: INestApplication;
let db: Database;
let admin: ReturnType<typeof request.agent>;
let member: ReturnType<typeof request.agent>;

beforeAll(async () => {
  configureEnv({ STORAGE_DIR: join(mkdtempSync(join(tmpdir(), 'dw-p4-')), 'storage'), METRICS_TOKEN: METRICS, SCHEDULER_ENABLED: 'false', PRODUCTION_WORKER: 'false' });
  db = await resetDatabase();
  app = await bootApp();
  admin = await registerMember(app, 'p4admin@dentweb.test');
  await db.update(users).set({ role: 'SUPERADMIN' }).where(eq(users.email, 'p4admin@dentweb.test'));
  member = await registerMember(app, 'p4@dentweb.test');
});
afterAll(async () => {
  await app?.close();
  await db?.$client.end();
});

describe('Desktop releases and auto-update feed', () => {
  const exe = randomBytes(64 * 1024);
  let id = '';
  it('only Superadmin uploads; wrong extension and bad semver are rejected', async () => {
    await member.post('/api/v1/admin/releases').field('platform', 'win32').field('arch', 'x64').field('version', '1.0.0').attach('file', exe, 'DENTSWEB-Setup-1.0.0.exe').expect(403);
    await admin.post('/api/v1/admin/releases').field('platform', 'win32').field('arch', 'x64').field('version', '1.0.0').attach('file', exe, 'DENTSWEB-1.0.0.dmg').expect(422);
    await admin.post('/api/v1/admin/releases').field('platform', 'win32').field('arch', 'x64').field('version', 'v1').attach('file', exe, 'DENTSWEB-Setup.exe').expect(422);
  });

  it('stores the installer with sha256 + sha512 and serves an electron-updater feed', async () => {
    const r = await admin.post('/api/v1/admin/releases').field('platform', 'win32').field('arch', 'x64').field('version', '1.0.0').field('releaseNotes', 'Rilis pertama').attach('file', exe, 'DENTSWEB-Studio-Setup-1.0.0.exe').expect(201);
    id = r.body.id;
    expect(r.body.checksum).toBe(createHash('sha256').update(exe).digest('hex'));
    expect(r.body.sha512).toBe(createHash('sha512').update(exe).digest('base64'));
    await admin.post('/api/v1/admin/releases').field('platform', 'win32').field('arch', 'x64').field('version', '1.0.0').attach('file', exe, 'DENTSWEB-Studio-Setup-1.0.0.exe').expect(409);
    const latest = await request(app.getHttpServer()).get('/api/v1/releases/latest?platform=win32&arch=x64').expect(200);
    expect(latest.body.version).toBe('1.0.0');
    const yml = await request(app.getHttpServer()).get('/api/v1/releases/feed/stable/win32/x64/latest.yml').expect(200);
    expect(yml.text).toContain('version: 1.0.0');
    expect(yml.text).toContain(`sha512: ${r.body.sha512}`);
    expect(yml.text).toContain(`size: ${exe.length}`);
    const file = yml.text.match(/path: '([^']+)'/)![1]!;
    const dl = await request(app.getHttpServer()).get(`/api/v1/releases/feed/stable/win32/x64/${file}`).expect(302);
    const bin = await request(app.getHttpServer()).get(new URL(dl.headers.location!, 'http://x').pathname + new URL(dl.headers.location!, 'http://x').search).buffer(true).parse((res, cb) => { const c: Buffer[] = []; res.on('data', (d: Buffer) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); }).expect(200);
    expect(Buffer.compare(bin.body as Buffer, exe)).toBe(0);
    await request(app.getHttpServer()).get('/api/v1/releases/feed/stable/darwin/arm64/latest-mac.yml').expect(404);
    await request(app.getHttpServer()).get('/api/v1/releases/feed/nightly/win32/x64/latest.yml').expect(404);
  });

  it('semver ordering beats upload order and deactivated releases disappear', async () => {
    await admin.post('/api/v1/admin/releases').field('platform', 'win32').field('arch', 'x64').field('version', '1.2.0').attach('file', exe, 'DENTSWEB-Studio-Setup-1.2.0.exe').expect(201);
    await admin.post('/api/v1/admin/releases').field('platform', 'win32').field('arch', 'x64').field('version', '1.1.5').attach('file', exe, 'DENTSWEB-Studio-Setup-1.1.5.exe').expect(201);
    expect((await request(app.getHttpServer()).get('/api/v1/releases/latest?platform=win32&arch=x64')).body.version).toBe('1.2.0');
    const list = (await admin.get('/api/v1/admin/releases').expect(200)).body as { id: string; version: string }[];
    await admin.patch(`/api/v1/admin/releases/${list.find((x) => x.version === '1.2.0')!.id}`).send({ isActive: false }).expect(200);
    expect((await request(app.getHttpServer()).get('/api/v1/releases/latest?platform=win32&arch=x64')).body.version).toBe('1.1.5');
    expect((await admin.get('/api/v1/admin/releases').expect(200)).body.find((x: { id: string }) => x.id === id).downloads).toBe(1);
  });
});

describe('Help center and support tickets', () => {
  let ticket = '';
  it('serves the shipped help articles; drafts stay hidden from members', async () => {
    const list = (await member.get('/api/v1/help/articles').expect(200)).body as { slug: string }[];
    expect(list.length).toBeGreaterThanOrEqual(8);
    expect((await member.get('/api/v1/help/articles/mulai-menggunakan').expect(200)).body.title).toMatch(/Mulai/);
    const d = await admin.post('/api/v1/admin/help/articles').send({ slug: 'draf-internal', kind: 'FAQ', title: 'Draf internal', body: 'Belum siap dipublikasikan.' }).expect(201);
    await member.get('/api/v1/help/articles/draf-internal').expect(404);
    await admin.patch(`/api/v1/admin/help/articles/${d.body.id}`).send({ status: 'PUBLISHED' }).expect(200);
    await member.get('/api/v1/help/articles/draf-internal').expect(200);
    expect((await member.get('/api/v1/help/articles?q=kuota').expect(200)).body.length).toBeGreaterThan(0);
    await member.post('/api/v1/admin/help/articles').send({ slug: 'x-x-x', kind: 'FAQ', title: 'abc', body: 'abcdefghijk' }).expect(403);
  });

  it('member opens a ticket, admin replies, member sees it; others cannot', async () => {
    const t = await member.post('/api/v1/support/tickets').send({ subject: 'Render tertahan', body: 'Render cloud saya tertahan di antrean.', diagnostics: { app: '1.0.0', os: 'win32' } }).expect(201);
    ticket = t.body.id;
    expect(t.body.messages).toHaveLength(1);
    const other = await registerMember(app, 'p4other@dentweb.test');
    await other.get(`/api/v1/support/tickets/${ticket}`).expect(404);
    await other.post(`/api/v1/support/tickets/${ticket}/messages`).send({ body: 'ikut' }).expect(404);
    const all = (await admin.get('/api/v1/admin/support/tickets').expect(200)).body;
    expect(all.some((x: { id: string }) => x.id === ticket)).toBe(true);
    const r = await admin.post(`/api/v1/admin/support/tickets/${ticket}/messages`).send({ body: 'Sedang kami cek, worker sedang ditambah.' }).expect(201);
    expect(r.body.status).toBe('PENDING');
    const mine = (await member.get(`/api/v1/support/tickets/${ticket}`).expect(200)).body;
    expect(mine.messages.map((m: { authorRole: string }) => m.authorRole)).toEqual(['MEMBER', 'SUPERADMIN']);
    await admin.patch(`/api/v1/admin/support/tickets/${ticket}`).send({ status: 'CLOSED' }).expect(200);
    await member.post(`/api/v1/support/tickets/${ticket}/messages`).send({ body: 'Terima kasih' }).expect(409);
  });
});

describe('Observability: error reports, analytics, metrics', () => {
  it('groups client errors by fingerprint and lets admin resolve them', async () => {
    for (const n of [1, 2, 3]) await member.post('/api/v1/telemetry/errors').send({ source: 'web', message: `Cannot read properties of undefined (reading 'x') id ${n}`, stack: 'TypeError: x\n    at render (app.js:10:5)' }).expect(202);
    await request(app.getHttpServer()).post('/api/v1/telemetry/errors').send({ source: 'desktop', message: 'Render lokal gagal: chrome tidak ditemukan' }).expect(202);
    await request(app.getHttpServer()).post('/api/v1/telemetry/errors').send({ source: 'api', message: 'x' }).expect(422);
    const list = (await admin.get('/api/v1/admin/errors?status=OPEN').expect(200)).body as { id: string; source: string; occurrences: number; userEmail: string | null }[];
    const web = list.find((e) => e.source === 'web')!;
    expect(web.occurrences).toBe(3);
    expect(web.userEmail).toBe('p4@dentweb.test');
    await admin.patch(`/api/v1/admin/errors/${web.id}`).send({ status: 'RESOLVED' }).expect(200);
    await member.get('/api/v1/admin/errors').expect(403);
  });

  it('analytics returns real aggregates (empty production is zero, not invented)', async () => {
    const a = (await admin.get('/api/v1/admin/analytics?days=7').expect(200)).body;
    expect(a.totals).toEqual({ runs: 0, completed: 0, failed: 0, successRate: null });
    expect(a.members.total).toBe(3);
    expect(a.results.total).toBe(0);
  });

  it('metrics endpoint requires the bearer token and exposes Prometheus text', async () => {
    await request(app.getHttpServer()).get('/api/v1/metrics').expect(401);
    await request(app.getHttpServer()).get('/api/v1/metrics').set('authorization', 'Bearer wrong-token-wrong-token-xx').expect(401);
    const m = await request(app.getHttpServer()).get('/api/v1/metrics').set('authorization', `Bearer ${METRICS}`).expect(200);
    expect(m.text).toContain('dentweb_http_requests_total{method="GET",route="/api/v1/help/articles",status="200"}');
    expect(m.text).toContain('dentweb_queue_jobs{queue="render",state="waiting"}');
    expect(m.text).toContain('dentweb_error_reports_open 1');
  });
});

describe('Security baseline', () => {
  it('sets hardening headers, refuses foreign CORS origins, and keeps session cookies HttpOnly', async () => {
    const h = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(h.headers['x-content-type-options']).toBe('nosniff');
    expect(h.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(h.headers['strict-transport-security']).toBeTruthy();
    expect(h.headers['x-powered-by']).toBeUndefined();
    const c = await request(app.getHttpServer()).options('/api/v1/auth/login').set('origin', 'https://evil.example').set('access-control-request-method', 'POST');
    expect(c.headers['access-control-allow-origin']).toBeUndefined();
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: 'p4@dentweb.test', password: 'RahasiaKuat123' }).expect(200);
    expect(login.body.challengeId).toBeTruthy();
    const reg = await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: 'cookie@dentweb.test', password: 'RahasiaKuat123', displayName: 'Cookie' }).expect(201);
    const { lastOtp } = await import('./setup.js');
    const v = await request(app.getHttpServer()).post('/api/v1/auth/otp/verify').send({ challengeId: reg.body.challengeId, code: lastOtp(app, 'cookie@dentweb.test') }).expect(200);
    const cookies = ([] as string[]).concat(v.headers['set-cookie'] ?? []);
    for (const name of ['dw_sid', 'dw_rt']) {
      const ck = cookies.find((x) => x.startsWith(`${name}=`))!;
      expect(ck).toMatch(/HttpOnly/i);
      expect(ck).toMatch(/SameSite=Lax|SameSite=Strict/i);
    }
  });

  it('never returns secrets: AI keys and TTS keys are write-only', async () => {
    const res = await member.get('/api/v1/ai/connections').expect(200);
    expect(JSON.stringify(res.body)).not.toMatch(/sk-ant-/);
    const acc = await member.get('/api/v1/settings/voice-accounts').expect(200);
    expect(JSON.stringify(acc.body)).not.toMatch(/apiKey"\s*:\s*"[^"]{6,}/);
  });

  it('rejects path traversal and unsigned file URLs', async () => {
    await request(app.getHttpServer()).get('/api/v1/files/Li4vLi4vZXRjL3Bhc3N3ZA?exp=9999999999&sig=x').expect(403);
    await request(app.getHttpServer()).get('/api/v1/files/Li4vLi4vZXRjL3Bhc3N3ZA').expect(403);
  });
});
