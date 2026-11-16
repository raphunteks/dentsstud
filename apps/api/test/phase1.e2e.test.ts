import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import { importSPKI, jwtVerify } from 'jose';
import { eq } from 'drizzle-orm';
import { type Database, secretVault, users, aiConnections } from '@dentweb/database';
import { bootApp, configureEnv, lastOtp, loginDesktop, registerMember, resetDatabase } from './setup.js';

// ---------- Local mock of external providers (Anthropic API + an OAuth server) ----------
const VALID_KEY = 'sk-ant-test-valid-key-0123456789';
let lastTokenRequest: URLSearchParams | null = null;
let authorizeChallenge = '';
const mock: Server = createServer((req, res) => {
  const url = new URL(req.url!, 'http://x');
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const json = (s: number, o: unknown) => {
      res.writeHead(s, { 'content-type': 'application/json' });
      res.end(JSON.stringify(o));
    };
    if (url.pathname === '/v1/models') {
      return req.headers['x-api-key'] === VALID_KEY ? json(200, { data: [{ id: 'claude-haiku-x' }, { id: 'claude-sonnet-x' }] }) : json(401, { error: { message: 'invalid x-api-key' } });
    }
    if (url.pathname === '/v1/messages') {
      if (req.headers['x-api-key'] !== VALID_KEY) return json(401, { error: { message: 'invalid' } });
      const parsed = JSON.parse(body);
      return json(200, { content: [{ type: 'text', text: `Jakarta (model ${parsed.model})` }], usage: { input_tokens: 5, output_tokens: 3 } });
    }
    if (url.pathname === '/oauth/token') {
      lastTokenRequest = new URLSearchParams(body);
      const verifier = lastTokenRequest.get('code_verifier') ?? '';
      const challenge = createHash('sha256').update(verifier).digest('base64url');
      if (challenge !== authorizeChallenge || lastTokenRequest.get('code') !== 'good-code') return json(400, { error: 'invalid_grant' });
      return json(200, { access_token: 'at-123', refresh_token: 'rt-123', expires_in: 3600, scope: 'inference' });
    }
    json(404, {});
  });
});

let app: INestApplication;
let db: Database;
let base = '';

beforeAll(async () => {
  await new Promise<void>((r) => mock.listen(0, '127.0.0.1', () => r()));
  const port = (mock.address() as { port: number }).port;
  base = `http://127.0.0.1:${port}`;
  configureEnv({
    ANTHROPIC_API_BASE: base,
    OAUTH_PROVIDERS_JSON: JSON.stringify([
      { code: 'mockai', authorizeUrl: `${base}/oauth/authorize`, tokenUrl: `${base}/oauth/token`, clientId: 'dentweb-client', scopes: ['inference'], redirectUri: 'http://localhost:3000/settings/claude/callback' },
    ]),
  });
  db = await resetDatabase();
  app = await bootApp();
  // Bootstrap a superadmin through the real register flow, then promote (mirrors bootstrap script).
  await registerMember(app, 'admin@dentweb.test');
  await db.update(users).set({ role: 'SUPERADMIN' }).where(eq(users.email, 'admin@dentweb.test'));
});

afterAll(async () => {
  await app?.close();
  await db?.$client.end();
  mock.close();
});

const http = () => request(app.getHttpServer());

describe('Seed: empty catalog', () => {
  it('has 12 categories and 0 presets/voices', async () => {
    const agent = await registerMember(app, 'seed@dentweb.test');
    const r = await agent.get('/api/v1/styles/categories').expect(200);
    expect(r.body.categories).toHaveLength(12);
    expect(r.body.total).toBe(0);
    expect(r.body.categories.every((c: { presetCount: number }) => c.presetCount === 0)).toBe(true);
    const v = await agent.get('/api/v1/voices/providers').expect(200);
    expect(v.body.map((p: { provider: string }) => p.provider).sort()).toEqual(['cadangan', 'elevenlabs', 'gemini']);
    expect(v.body.every((p: { voiceCount: number; isEnabled: boolean }) => p.voiceCount === 0 && !p.isEnabled)).toBe(true);
  });
});

describe('Identity: password + email OTP', () => {
  it('register requires OTP verification before session', async () => {
    const r = await http().post('/api/v1/auth/register').send({ email: 'Budi@Dentweb.test', password: 'PasswordKuat99', displayName: 'Budi' }).expect(201);
    const [u] = await db.select().from(users).where(eq(users.email, 'budi@dentweb.test'));
    expect(u!.status).toBe('PENDING_VERIFICATION');
    await http().post('/api/v1/auth/otp/verify').send({ challengeId: r.body.challengeId, code: '000000' }).expect(422);
    const v = await http().post('/api/v1/auth/otp/verify').send({ challengeId: r.body.challengeId, code: lastOtp(app, 'budi@dentweb.test') }).expect(200);
    expect(v.body.user.status).toBe('ACTIVE');
    const cookie = v.headers['set-cookie'] as unknown as string[];
    expect(cookie.some((c) => c.startsWith('dw_sid=') && c.includes('HttpOnly'))).toBe(true);
    // Code is single-use
    await http().post('/api/v1/auth/otp/verify').send({ challengeId: r.body.challengeId, code: lastOtp(app, 'budi@dentweb.test') }).expect(422);
  });

  it('rejects weak password and wrong credentials without enumeration', async () => {
    await http().post('/api/v1/auth/register').send({ email: 'x@dentweb.test', password: 'short', displayName: 'X' }).expect(422);
    const a = await http().post('/api/v1/auth/login').send({ email: 'budi@dentweb.test', password: 'Salah12345' }).expect(422);
    const b = await http().post('/api/v1/auth/login').send({ email: 'nobody@dentweb.test', password: 'Salah12345' }).expect(422);
    expect(a.body.error.message).toBe(b.body.error.message);
  });

  it('locks OTP after max attempts', async () => {
    const r = await http().post('/api/v1/auth/login').send({ email: 'budi@dentweb.test', password: 'PasswordKuat99' }).expect(200);
    expect(r.body.purpose).toBe('LOGIN');
    for (let i = 0; i < 5; i++) await http().post('/api/v1/auth/otp/verify').send({ challengeId: r.body.challengeId, code: '999999' });
    await http().post('/api/v1/auth/otp/verify').send({ challengeId: r.body.challengeId, code: lastOtp(app, 'budi@dentweb.test') }).expect(429);
  });

  it('desktop tokens: bearer auth + single-use refresh rotation + logout', async () => {
    const s = await loginDesktop(app, 'budi@dentweb.test', 'PasswordKuat99');
    await http().get('/api/v1/me').set('authorization', `Bearer ${s.accessToken}`).expect(200);
    const r1 = await http().post('/api/v1/auth/refresh').send({ refreshToken: s.refreshToken }).expect(200);
    await http().post('/api/v1/auth/refresh').send({ refreshToken: s.refreshToken }).expect(401);
    await http().get('/api/v1/me').set('authorization', `Bearer ${s.accessToken}`).expect(401);
    const fresh = r1.body.session.accessToken;
    await http().get('/api/v1/auth/session').set('authorization', `Bearer ${fresh}`).expect(200);
    await http().post('/api/v1/auth/logout').set('authorization', `Bearer ${fresh}`).expect(200);
    await http().get('/api/v1/me').set('authorization', `Bearer ${fresh}`).expect(401);
  });
});

describe('RBAC', () => {
  it('only SUPERADMIN reaches /admin', async () => {
    const member = await registerMember(app, 'member-rbac@dentweb.test');
    await member.get('/api/v1/admin/dashboard').expect(403);
    await member.get('/api/v1/admin/members').expect(403);
    const admin = await loginDesktop(app, 'admin@dentweb.test', 'RahasiaKuat123');
    const d = await http().get('/api/v1/admin/dashboard').set('authorization', `Bearer ${admin.accessToken}`).expect(200);
    expect(d.body.catalog).toEqual({ categories: 12, publishedPresets: 0, publishedVoices: 0 });
    await http().get('/api/v1/admin/members').expect(401);
  });
});

describe('Licenses & devices', () => {
  it('grant → activate (limit) → offline proof → release → revoke', async () => {
    const member = await registerMember(app, 'lic@dentweb.test');
    const me = (await member.get('/api/v1/me').expect(200)).body;
    const admin = await loginDesktop(app, 'admin@dentweb.test', 'RahasiaKuat123');
    const A = { authorization: `Bearer ${admin.accessToken}` };

    const desk = await loginDesktop(app, 'lic@dentweb.test', 'RahasiaKuat123');
    const D = { authorization: `Bearer ${desk.accessToken}` };
    const dev = (id: string, label: string) => ({ installationId: id.padEnd(24, '0'), platform: 'darwin', architecture: 'arm64', label });

    await http().post('/api/v1/devices/activate').set(D).send(dev('mac-1', 'MacBook')).expect(403);

    const lic = await http().post('/api/v1/admin/licenses/grant').set(A).send({ userId: me.id, maxDevices: 1 }).expect(201);
    const summary = await member.get('/api/v1/licenses/me').expect(200);
    expect(summary.body.status).toBe('ACTIVE');
    expect(summary.body.entitlements.maxWorkers).toBe(2);

    const act = await http().post('/api/v1/devices/activate').set(D).send(dev('mac-1', 'MacBook')).expect(200);
    await http().post('/api/v1/devices/activate').set(D).send(dev('mac-1', 'MacBook')).expect(200); // idempotent re-activate
    const second = await http().post('/api/v1/devices/activate').set(D).send(dev('win-2', 'PC')).expect(409);
    expect(second.body.error.code).toBe('DEVICE_LIMIT');

    const proof = await http().post('/api/v1/licenses/offline-proof').set(D).expect(200);
    const pub = await http().get('/api/v1/licenses/public-key').expect(200);
    const { payload } = await jwtVerify(proof.body.proof, await importSPKI(pub.body.pem, 'EdDSA'), { issuer: 'dentweb-studio', audience: 'dentweb-desktop' });
    expect(payload.sub).toBe(me.id);
    expect(payload.dev).toBe(act.body.deviceId);

    await http().delete(`/api/v1/devices/${act.body.deviceId}`).set(D).expect(200);
    await http().post('/api/v1/devices/activate').set(D).send(dev('win-2', 'PC')).expect(200);

    // Member cannot release other member's device
    const other = await registerMember(app, 'other@dentweb.test');
    await other.delete(`/api/v1/devices/${act.body.deviceId}`).expect(404);

    await http().post(`/api/v1/admin/licenses/${lic.body.id}/revoke`).set(A).expect(200);
    await http().post('/api/v1/devices/activate').set(D).send(dev('mac-1', 'MacBook')).expect(403);
    const audit = await http().get('/api/v1/admin/audit-logs?action=license').set(A).expect(200);
    expect(audit.body.items.map((i: { log: { action: string } }) => i.log.action)).toEqual(expect.arrayContaining(['license.grant', 'license.revoke']));
  });

  it('suspending a member kills their sessions', async () => {
    const member = await registerMember(app, 'suspend@dentweb.test');
    const me = (await member.get('/api/v1/me').expect(200)).body;
    const admin = await loginDesktop(app, 'admin@dentweb.test', 'RahasiaKuat123');
    const A = { authorization: `Bearer ${admin.accessToken}` };
    await http().patch(`/api/v1/admin/members/${me.id}/status`).set(A).send({ status: 'SUSPENDED', reason: 'test' }).expect(200);
    await member.get('/api/v1/me').expect(401);
    await http().post('/api/v1/auth/login').send({ email: 'suspend@dentweb.test', password: 'RahasiaKuat123' }).expect(403);
    const self = (await http().get('/api/v1/auth/session').set(A).expect(200)).body.user.id;
    await http().patch(`/api/v1/admin/members/${self}/status`).set(A).send({ status: 'SUSPENDED' }).expect(422);
  });
});

describe('AI connections (honest status)', () => {
  it('invalid API key is rejected and not stored', async () => {
    const m = await registerMember(app, 'ai1@dentweb.test');
    const r = await m.post('/api/v1/ai/connections/start').send({ provider: 'anthropic', method: 'API_KEY', apiKey: 'sk-ant-wrong-key-000000000' }).expect(422);
    expect(r.body.error.code).toBe('AI_KEY_INVALID');
    const caps = await m.get('/api/v1/ai/capabilities').expect(200);
    expect(caps.body.status).toBe('NOT_CONFIGURED');
  });

  it('valid key → CONNECTED, encrypted at rest, real test answer, delete', async () => {
    const m = await registerMember(app, 'ai2@dentweb.test');
    const r = await m.post('/api/v1/ai/connections/start').send({ provider: 'anthropic', method: 'API_KEY', apiKey: VALID_KEY }).expect(201);
    const c = r.body.connection;
    expect(c.status).toBe('CONNECTED');
    expect(c.credentialHint).toBe('…6789');
    expect(JSON.stringify(r.body)).not.toContain(VALID_KEY);
    const [row] = await db.select().from(aiConnections).where(eq(aiConnections.id, c.id));
    const [secret] = await db.select().from(secretVault).where(eq(secretVault.id, row!.credentialRef!));
    expect(secret!.ciphertext).not.toContain(VALID_KEY);
    const t = await m.post(`/api/v1/ai/connections/${c.id}/test`).send({ prompt: 'Ibu kota Indonesia?' }).expect(200);
    expect(t.body.answer).toContain('Jakarta');
    expect(t.body.model).toBe('claude-sonnet-x');
    const chk = await m.post(`/api/v1/ai/connections/${c.id}/check`).expect(200);
    expect(chk.body.status).toBe('CONNECTED');
    // other member cannot touch it
    const o = await registerMember(app, 'ai3@dentweb.test');
    await o.post(`/api/v1/ai/connections/${c.id}/test`).send({}).expect(404);
    await m.delete(`/api/v1/ai/connections/${c.id}`).expect(200);
    expect((await db.select().from(secretVault).where(eq(secretVault.id, row!.credentialRef!))).length).toBe(0);
  });

  it('Claude Code local is UNSUPPORTED from web sessions', async () => {
    const m = await registerMember(app, 'ai4@dentweb.test');
    const r = await m.post('/api/v1/ai/connections/start').send({ provider: 'anthropic', method: 'CLAUDE_CODE_LOCAL', version: '2.0.0', authenticated: true }).expect(422);
    expect(r.body.error.code).toBe('AI_METHOD_UNSUPPORTED');
  });

  it('generic OAuth PKCE: S256 challenge, single-use state, verifier checked', async () => {
    const m = await registerMember(app, 'oauth@dentweb.test');
    const s = await m.post('/api/v1/ai/connections/start').send({ provider: 'mockai', method: 'OAUTH_PKCE' }).expect(201);
    const u = new URL(s.body.authorizeUrl);
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    authorizeChallenge = u.searchParams.get('code_challenge')!;
    const state = u.searchParams.get('state')!;
    await m.get('/api/v1/ai/connections/callback').query({ state: 'forged', code: 'good-code' }).expect(422);
    const other = await registerMember(app, 'oauth2@dentweb.test');
    await other.get('/api/v1/ai/connections/callback').query({ state, code: 'good-code' }).expect(422); // bound to user
    const ok = await m.get('/api/v1/ai/connections/callback').query({ state, code: 'good-code' }).expect(200);
    expect(ok.body.status).toBe('CONNECTED');
    expect(lastTokenRequest!.get('client_id')).toBe('dentweb-client');
    await m.get('/api/v1/ai/connections/callback').query({ state, code: 'good-code' }).expect(422); // replay
    const unsupported = await m.post('/api/v1/ai/connections/start').send({ provider: 'claude-ai', method: 'OAUTH_PKCE' }).expect(422);
    expect(unsupported.body.error.code).toBe('OAUTH_UNSUPPORTED');
  });
});

describe('Member dashboard', () => {
  it('returns only own zeroed stats with honest statuses', async () => {
    const m = await registerMember(app, 'dash@dentweb.test');
    const r = await m.get('/api/v1/me/dashboard').expect(200);
    expect(r.body.stats).toEqual({ readyToUpload: 0, inProduction: 0, uploaded: 0, failed: 0 });
    expect(r.body.ai.status).toBe('NOT_CONFIGURED');
    expect(r.body.license.status).toBe('NONE');
  });
});
