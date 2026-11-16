import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const envPath = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envPath);
}
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { createDatabase, type Database } from '@dentweb/database';
import { MailService } from '../src/infra/infra.module.js';
import { resetEnvCache } from '../src/config/env.js';

export const TEST_DB = process.env.TEST_DATABASE_URL ?? (process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/\/dentweb$/, '/dentweb_test') : 'postgresql://dentweb:Ksanihbous03_@43.153.199.122:5432/dentweb_test');
const dbPkg = fileURLToPath(new URL('../../../packages/database', import.meta.url));

export function configureEnv(extra: Record<string, string> = {}) {
  const { privateKey } = generateKeyPairSync('ed25519');
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DB,
    REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
    SECRETS_MASTER_KEY: randomBytes(32).toString('base64'),
    LICENSE_SIGNING_KEY: Buffer.from(privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()).toString('base64'),
    WEB_ORIGIN: 'http://localhost:3000',
    QUEUE_PREFIX: `dwtest${process.pid}`,
    ...extra,
  });
  resetEnvCache();
}

/** Drop everything, run real migrations + seed. */
export async function resetDatabase(): Promise<Database> {
  const db = createDatabase(TEST_DB, 2);
  await db.execute(sql`drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public; create extension if not exists citext;`);
  const env = { ...process.env, DATABASE_URL: TEST_DB };
  execFileSync('pnpm', ['exec', 'tsx', 'scripts/migrate.ts'], { cwd: dbPkg, env, stdio: 'pipe' });
  execFileSync('pnpm', ['exec', 'tsx', 'seeds/seed.ts'], { cwd: dbPkg, env, stdio: 'pipe' });
  return db;
}

export async function bootApp() {
  const { createApp } = await import('../src/bootstrap.js');
  const app = await createApp({ logger: false });
  await app.init();
  return app;
}

export const outbox = (app: INestApplication) => app.get(MailService).testOutbox;

export function lastOtp(app: INestApplication, email: string) {
  const mail = [...outbox(app)].reverse().find((m) => m.to === email);
  const code = mail?.subject.match(/(\d{6})$/)?.[1];
  if (!code) throw new Error(`No OTP mail for ${email}`);
  return code;
}

/** Register + verify a member; returns an authenticated supertest agent (cookie session). */
export async function registerMember(app: INestApplication, email: string, password = 'RahasiaKuat123') {
  const agent = request.agent(app.getHttpServer());
  const r = await agent.post('/api/v1/auth/register').send({ email, password, displayName: email.split('@')[0] }).expect(201);
  await agent.post('/api/v1/auth/otp/verify').send({ challengeId: r.body.challengeId, code: lastOtp(app, email) }).expect(200);
  return agent;
}

export async function loginDesktop(app: INestApplication, email: string, password: string) {
  const r = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(200);
  const v = await request(app.getHttpServer())
    .post('/api/v1/auth/otp/verify')
    .send({ challengeId: r.body.challengeId, code: lastOtp(app, email), client: 'desktop' })
    .expect(200);
  return v.body.session as { accessToken: string; refreshToken: string };
}

export function findChromeExecutable(): string | undefined {
  if (process.env.REMOTION_BROWSER_EXECUTABLE && existsSync(process.env.REMOTION_BROWSER_EXECUTABLE)) {
    return process.env.REMOTION_BROWSER_EXECUTABLE;
  }
  const candidates =
    process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium']
      : process.platform === 'win32'
        ? [`${process.env['PROGRAMFILES']}\\Google\\Chrome\\Application\\chrome.exe`, `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`]
        : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'];
  return candidates.find((p) => p && existsSync(p));
}
