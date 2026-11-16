import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { type Database, users, styleCategories } from '@dentweb/database';
import { bootApp, configureEnv, registerMember, resetDatabase } from './setup.js';

const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
const RECIPE = {
  palette: { background: '#101418', ink: '#f4efe5', accent: '#c98a1b' },
  typography: { display: 'Chivo', body: 'Chivo' },
  motion: { easing: 'easeOut', intensity: 0.6, transition: 'fade' },
  layout: { titleScale: 1, safeArea: 0.06, textAlign: 'left' },
};
function presetPkg(slug: string, opts: { badChecksum?: boolean; category?: string } = {}) {
  const recipe = Buffer.from(JSON.stringify(RECIPE));
  const manifest = {
    schemaVersion: 1, kind: 'preset', slug, name: `Preset ${slug}`, category: opts.category ?? 'infografis',
    compatibility: { formats: ['9:16', '16:9'] }, rights: { license: 'Milik DENTWEB, nonkomersial' }, recipe: 'recipe.json',
    files: [
      { path: 'thumbnail.png', sha256: opts.badChecksum ? '0'.repeat(64) : sha(PNG), role: 'thumbnail' },
      { path: 'recipe.json', sha256: sha(recipe), role: 'recipe' },
    ],
  };
  return [
    { path: `${slug}/manifest.json`, data: Buffer.from(JSON.stringify(manifest)) },
    { path: `${slug}/thumbnail.png`, data: PNG },
    { path: `${slug}/recipe.json`, data: recipe },
  ];
}

// ---------- mock ElevenLabs + Gemini ----------
const MP3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(200, 1)]);
const PCM = Buffer.alloc(4800, 0);
const mock: Server = createServer((req, res) => {
  const url = new URL(req.url!, 'http://x');
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const json = (s: number, o: unknown) => (res.writeHead(s, { 'content-type': 'application/json' }), res.end(JSON.stringify(o)));
    const elOk = req.headers['xi-api-key'] === 'el-valid-key-123456';
    if (url.pathname === '/v1/models') return elOk ? json(200, [{ model_id: 'eleven_multilingual_v2', can_do_text_to_speech: true }]) : json(401, { detail: 'invalid' });
    if (url.pathname.startsWith('/v1/text-to-speech/')) {
      if (!elOk) return json(401, { detail: { message: 'invalid api key' } });
      res.writeHead(200, { 'content-type': 'audio/mpeg' });
      return res.end(MP3);
    }
    const gOk = req.headers['x-goog-api-key'] === 'gm-valid-key-123456';
    if (url.pathname === '/v1beta/models') return gOk ? json(200, { models: [{ name: 'models/gemini-3.8-flash-tts' }] }) : json(400, { error: { message: 'API key not valid' } });
    if (url.pathname.endsWith(':generateContent')) {
      if (!gOk) return json(400, { error: { message: 'API key not valid' } });
      const b = JSON.parse(body);
      if (b.generationConfig?.speechConfig?.voiceConfig?.voice !== 'Kore') return json(400, { error: { message: 'unknown voice' } });
      return json(200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: PCM.toString('base64') } }] } }] });
    }
    json(404, {});
  });
});

let app: INestApplication;
let db: Database;
let admin: ReturnType<typeof request.agent>;
let member: ReturnType<typeof request.agent>;

beforeAll(async () => {
  await new Promise<void>((r) => mock.listen(0, '127.0.0.1', () => r()));
  const base = `http://127.0.0.1:${(mock.address() as { port: number }).port}`;
  const storage = mkdtempSync(join(tmpdir(), 'dw-storage-'));
  configureEnv({ ELEVENLABS_API_BASE: base, GEMINI_API_BASE: base, STORAGE_DIR: storage });
  db = await resetDatabase();
  app = await bootApp();
  admin = await registerMember(app, 'admin2@dentweb.test');
  await db.update(users).set({ role: 'SUPERADMIN' }).where(eq(users.email, 'admin2@dentweb.test'));
  member = await registerMember(app, 'member2@dentweb.test');
});
afterAll(async () => {
  await app?.close();
  await db?.$client.end();
  mock.close();
});

async function importBatch(kind: string, files: { path: string; data: Buffer }[]) {
  const b = await admin.post('/api/v1/admin/imports/init').send({ kind, source: 'DASHBOARD_UPLOAD' }).expect(201);
  let req = admin.post(`/api/v1/admin/imports/upload?batchId=${b.body.id}`).field('paths', JSON.stringify(files.map((f) => f.path)));
  for (const f of files) req = req.attach('files', f.data, { filename: f.path.split('/').pop()! });
  const up = await req;
  return { id: b.body.id as string, upload: up };
}

describe('Preset import → draft → publish → member catalog', () => {
  let presetId = '';
  it('rejects member access to the CMS', async () => {
    await member.post('/api/v1/admin/imports/init').send({ kind: 'preset' }).expect(403);
    await member.get('/api/v1/admin/styles/presets').expect(403);
  });

  it('validates and commits a real package as DRAFT (not visible to members)', async () => {
    const { id, upload } = await importBatch('preset', presetPkg('cetak-biru'));
    expect(upload.status).toBe(201);
    const v = await admin.post('/api/v1/admin/imports/validate').send({ batchId: id }).expect(200);
    expect(v.body.items).toHaveLength(1);
    expect(v.body.items[0].status).toBe('VALID');
    expect((await member.get('/api/v1/styles/presets').expect(200)).body.items).toHaveLength(0);
    const c = await admin.post('/api/v1/admin/imports/commit').send({ batchId: id }).expect(200);
    expect(c.body.status).toBe('COMMITTED');
    presetId = c.body.items[0].targetId;
    const p = await admin.get(`/api/v1/admin/styles/presets/${presetId}`).expect(200);
    expect(p.body.status).toBe('DRAFT');
    expect(p.body.thumbnailUrl).toMatch(/^\/api\/v1\/files\//);
    expect((await member.get('/api/v1/styles/presets').expect(200)).body.items).toHaveLength(0);
    // the signed thumbnail URL serves the exact bytes; a tampered signature is refused
    const file = await request(app.getHttpServer()).get(p.body.thumbnailUrl).buffer(true).parse((r, cb) => { const c: Buffer[] = []; r.on('data', (d: Buffer) => c.push(d)); r.on('end', () => cb(null, Buffer.concat(c))); }).expect(200);
    expect(Buffer.compare(file.body as Buffer, PNG)).toBe(0);
    await request(app.getHttpServer()).get(p.body.thumbnailUrl.replace(/sig=[^&]+/, 'sig=AAAA')).expect(403);
  });

  it('publish makes it visible with dynamic counts; unpublish hides it', async () => {
    await admin.post(`/api/v1/admin/styles/presets/${presetId}/publish`).expect(200);
    const list = await member.get('/api/v1/styles/presets?category=infografis').expect(200);
    expect(list.body.items).toHaveLength(1);
    const cats = await member.get('/api/v1/styles/categories').expect(200);
    expect(cats.body.total).toBe(1);
    expect(cats.body.categories.find((c: { slug: string }) => c.slug === 'infografis').presetCount).toBe(1);
    const one = await member.get(`/api/v1/styles/presets/${presetId}`).expect(200);
    expect(one.body.recipe.palette.accent).toBe('#c98a1b');
    await admin.post(`/api/v1/admin/styles/presets/${presetId}/publish`).expect(409);
    await admin.post(`/api/v1/admin/styles/presets/${presetId}/unpublish`).expect(200);
    await member.get(`/api/v1/styles/presets/${presetId}`).expect(404);
  });

  it('recipe edits version; rollback creates a new version; duplicate & archive', async () => {
    const u = await admin.patch(`/api/v1/admin/styles/presets/${presetId}`).send({ recipe: { ...RECIPE, palette: { ...RECIPE.palette, accent: '#1f7a4d' } } }).expect(200);
    expect(u.body.currentVersion).toBe(2);
    const r = await admin.post(`/api/v1/admin/styles/presets/${presetId}/rollback`).send({ version: 1 }).expect(200);
    expect(r.body.currentVersion).toBe(3);
    expect(r.body.version.recipe.palette.accent).toBe('#c98a1b');
    const vs = await admin.get(`/api/v1/admin/styles/presets/${presetId}/versions`).expect(200);
    expect(vs.body.map((v: { version: number }) => v.version)).toEqual([3, 2, 1]);
    const d = await admin.post(`/api/v1/admin/styles/presets/${presetId}/duplicate`).expect(201);
    expect(d.body.slug).toBe('cetak-biru-salinan');
    await admin.post(`/api/v1/admin/styles/presets/${presetId}/archive`).expect(200);
    await admin.patch(`/api/v1/admin/styles/presets/${presetId}`).send({ name: 'x y' }).expect(409);
    await admin.post(`/api/v1/admin/styles/presets/${presetId}/restore`).expect(200);
    const [cat] = await db.select().from(styleCategories).where(eq(styleCategories.slug, 'infografis'));
    const del = await admin.delete(`/api/v1/admin/styles/categories/${cat!.id}`).expect(409);
    expect(del.body.error.code).toBe('CATEGORY_NOT_EMPTY');
  });

  it('flags duplicates, bad checksums, unknown categories and forbidden file types', async () => {
    const files = [...presetPkg('cetak-biru'), ...presetPkg('rusak', { badChecksum: true }), ...presetPkg('nyasar', { category: 'tidak-ada' })];
    const { id } = await importBatch('preset', files);
    const v = await admin.post('/api/v1/admin/imports/validate').send({ batchId: id }).expect(200);
    const by = Object.fromEntries(v.body.items.map((i: { originalPath: string; status: string; validationErrors: string[] }) => [i.originalPath, i]));
    expect(by['cetak-biru'].status).toBe('DUPLICATE');
    expect(by['rusak'].status).toBe('INVALID');
    expect(by['rusak'].validationErrors.join(' ')).toContain('Checksum');
    expect(by['nyasar'].validationErrors.join(' ')).toContain('Kategori tidak dikenal');
    const c = await admin.post('/api/v1/admin/imports/commit').send({ batchId: id }).expect(200);
    expect(c.body.status).toBe('FAILED');
    const svg = await importBatch('preset', [{ path: 'x/manifest.json', data: Buffer.from('{}') }, { path: 'x/evil.svg', data: Buffer.from('<svg onload=alert(1)>') }]);
    const sv = await admin.post('/api/v1/admin/imports/validate').send({ batchId: svg.id }).expect(200);
    expect(sv.body.items[0].status).toBe('INVALID');
  });

  it('blocks path traversal, zip traversal and zip bombs', async () => {
    const t = await importBatch('preset', [{ path: '../../etc/passwd', data: Buffer.from('x') }]);
    expect(t.upload.status).toBe(422);
    const dir = mkdtempSync(join(tmpdir(), 'dw-zip-'));
    const py = (code: string) => execFileSync('python3', ['-c', code], { cwd: dir });
    py("import zipfile;z=zipfile.ZipFile('evil.zip','w');z.writestr('../../escape.txt','x');z.close()");
    py("import zipfile;z=zipfile.ZipFile('bomb.zip','w',zipfile.ZIP_DEFLATED);z.writestr('big.json','0'*20000000);z.close()");
    for (const f of ['evil.zip', 'bomb.zip']) {
      const b = await admin.post('/api/v1/admin/imports/init').send({ kind: 'preset' }).expect(201);
      const r = await admin.post(`/api/v1/admin/imports/upload?batchId=${b.body.id}`).field('paths', JSON.stringify([f])).attach('files', readFileSync(join(dir, f)), { filename: f });
      expect(r.status).toBeGreaterThanOrEqual(400);
    }
    // a good zip is accepted and validated
    const pkg = presetPkg('dari-zip');
    for (const f of pkg) {
      const p = join(dir, 'pkg', f.path);
      execFileSync('mkdir', ['-p', join(p, '..')]);
      writeFileSync(p, f.data);
    }
    py("import zipfile,os;z=zipfile.ZipFile('ok.zip','w');[z.write(os.path.join(r,f),os.path.relpath(os.path.join(r,f),'pkg')) for r,_,fs in os.walk('pkg') for f in fs];z.close()");
    const b = await admin.post('/api/v1/admin/imports/init').send({ kind: 'preset' }).expect(201);
    await admin.post(`/api/v1/admin/imports/upload?batchId=${b.body.id}`).field('paths', JSON.stringify(['ok.zip'])).attach('files', readFileSync(join(dir, 'ok.zip')), { filename: 'ok.zip' }).expect(201);
    const v = await admin.post('/api/v1/admin/imports/validate').send({ batchId: b.body.id }).expect(200);
    expect(v.body.items[0].status).toBe('VALID');
  });
});

describe('Voice catalog & Voice Studio', () => {
  let voiceId = '';
  let geminiVoiceId = '';
  it('starts empty and keeps unverified voices unpublished', async () => {
    expect((await member.get('/api/v1/voices').expect(200)).body).toHaveLength(0);
    await admin.patch('/api/v1/admin/voice-providers/elevenlabs').send({ apiKey: 'el-wrong-key-000000', isEnabled: true }).expect(422);
    const p = await admin.patch('/api/v1/admin/voice-providers/elevenlabs').send({ apiKey: 'el-valid-key-123456', isEnabled: true }).expect(200);
    expect(p.body.isEnabled).toBe(true);
    expect(JSON.stringify(p.body)).not.toContain('el-valid-key');
    const v = await admin.post('/api/v1/admin/voices').send({ provider: 'elevenlabs', providerVoiceId: 'voice_abc', slug: 'narator-pria', name: 'Narator Pria', language: 'id-ID', voiceAttributes: { gender: 'male' }, capabilities: { speed: true } }).expect(201);
    voiceId = v.body.id;
    const pub = await admin.post(`/api/v1/admin/voices/${voiceId}/publish`).expect(422);
    expect(pub.body.error.code).toBe('VOICE_UNVERIFIED');
  });

  it('test synthesis stores real audio, then publish shows it to members', async () => {
    const t = await admin.post(`/api/v1/admin/voices/${voiceId}/test`).send({}).expect(200);
    const audio = await request(app.getHttpServer()).get(t.body.audioUrl).expect(200);
    expect(audio.headers['content-type']).toContain('audio/mpeg');
    await admin.post(`/api/v1/admin/voices/${voiceId}/publish`).expect(200);
    const list = await member.get('/api/v1/voices?gender=male').expect(200);
    expect(list.body).toHaveLength(1);
    expect((await member.get('/api/v1/voices?gender=female').expect(200)).body).toHaveLength(0);
  });

  it('member preview needs the member’s own account and honours capabilities', async () => {
    const no = await member.post(`/api/v1/voices/${voiceId}/preview`).send({}).expect(422);
    expect(no.body.error.code).toBe('TTS_ACCOUNT_MISSING');
    await member.put('/api/v1/settings/voice-accounts/elevenlabs').send({ apiKey: 'el-wrong-key-000000' }).expect(422);
    const acc = await member.put('/api/v1/settings/voice-accounts/elevenlabs').send({ apiKey: 'el-valid-key-123456' }).expect(200);
    expect(acc.body.status).toBe('CONNECTED');
    expect(acc.body.credentialHint).toBe('…3456');
    await member.post(`/api/v1/voices/${voiceId}/preview`).send({ pitch: 3 }).expect(422);
    const pv = await member.post(`/api/v1/voices/${voiceId}/preview`).send({ speed: 1.1 }).expect(200);
    expect(pv.body.mime).toBe('audio/mpeg');
    const pref = await member.put('/api/v1/voices/preferences/me').send({ voiceId, speed: 1.1 }).expect(200);
    expect(pref.body.voiceActive).toBe(true);
    await admin.post(`/api/v1/admin/voices/${voiceId}/disable`).expect(200);
    expect((await member.get('/api/v1/voices/preferences/me').expect(200)).body.voiceActive).toBe(false);
  });

  it('Gemini adapter wraps PCM into WAV and sends the voice name', async () => {
    await admin.patch('/api/v1/admin/voice-providers/gemini').send({ apiKey: 'gm-valid-key-123456', isEnabled: true }).expect(200);
    const v = await admin.post('/api/v1/admin/voices').send({ provider: 'gemini', providerVoiceId: 'Kore', slug: 'kore-id', name: 'Kore', language: 'id-ID', voiceAttributes: { gender: 'female' } }).expect(201);
    geminiVoiceId = v.body.id;
    const t = await admin.post(`/api/v1/admin/voices/${geminiVoiceId}/test`).send({}).expect(200);
    const wav = await request(app.getHttpServer()).get(t.body.audioUrl).buffer(true).parse((r, cb) => { const c: Buffer[] = []; r.on('data', (d: Buffer) => c.push(d)); r.on('end', () => cb(null, Buffer.concat(c))); }).expect(200);
    const buf = wav.body as Buffer;
    expect(buf.subarray(0, 4).toString()).toBe('RIFF');
    expect(buf.readUInt32LE(24)).toBe(24000);
    expect(buf.length).toBe(44 + PCM.length);
  });
});

describe('Hooks, brand and production settings', () => {
  it('hook CMS: draft hidden, published visible', async () => {
    const h = await admin.post('/api/v1/admin/hooks').send({ slug: 'pembuka-tebal', name: 'Pembuka tebal', formats: ['9:16'], recipe: { durationSec: 2, style: 'bold', text: { maxWords: 6 }, animation: { in: 'pop' } } }).expect(201);
    expect((await member.get('/api/v1/hooks').expect(200)).body).toHaveLength(0);
    await admin.post(`/api/v1/admin/hooks/${h.body.id}/publish`).expect(200);
    expect((await member.get('/api/v1/hooks').expect(200)).body).toHaveLength(1);
  });

  it('brand fields are optional; production limits follow the license', async () => {
    const b = await member.put('/api/v1/settings/brand').send({ name: 'Klinik Senyum', instagramUsername: '@kliniksenyum', openingText: '', captionCta: 'Simpan video ini' }).expect(200);
    expect(b.body.instagramUsername).toBe('kliniksenyum');
    expect(b.body.openingText).toBeNull();
    await member.put('/api/v1/settings/brand').send({ instagramUsername: 'bukan username!' }).expect(422);
    const p = await member.put('/api/v1/settings/production').send({ videosPerDay: 3, defaultWorkers: 1, preferredFormat: '9:16' }).expect(422);
    expect(p.body.error.code).toBe('ENTITLEMENT_VIDEOS');
  });
});
