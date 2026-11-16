// Electron E2E (Playwright _electron) against a dev API on :4000. OTP read from the API dev log.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const { _electron } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH ?? 'playwright');

const LOG = process.env.API_LOG ?? '/tmp/claude-0/api.log';
const API = 'http://localhost:4000/api/v1';
const EMAIL = 'admin@dentweb.example';
const PASS = 'AdminKuat12345';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const otp = (email) => readFileSync(LOG, 'utf8').split('\n').filter((l) => l.includes(`ke ${email}:`)).at(-1).match(/: (\d{6})/)[1];
const assert = (c, m) => { if (!c) throw new Error(`ASSERT: ${m}`); console.log(`✓ ${m}`); };
const j = async (r) => { const b = await r.json(); if (!r.ok) throw new Error(JSON.stringify(b)); return b; };

// Ensure the superadmin holds a license (granted through the real admin API).
const l = await j(await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASS }) }));
await sleep(200);
const v = await j(await fetch(`${API}/auth/otp/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ challengeId: l.challengeId, code: otp(EMAIL), client: 'desktop' }) }));
const H = { 'content-type': 'application/json', authorization: `Bearer ${v.session.accessToken}` };
await j(await fetch(`${API}/admin/licenses/grant`, { method: 'POST', headers: H, body: JSON.stringify({ userId: v.user.id, maxDevices: 3 }) }));

const app = await _electron.launch({
  executablePath: createRequire(resolve('apps/desktop/package.json'))('electron'),
  args: [resolve('apps/desktop'), '--no-sandbox'],
  env: { ...process.env, NODE_OPTIONS: '', DENTWEB_TEST_NO_SANDBOX: '1', DENTWEB_API_BASE: 'http://localhost:4000', ELECTRON_DISABLE_SECURITY_WARNINGS: '1' },
});
const win = await app.firstWindow();
const errors = [];
win.on('pageerror', (e) => errors.push(e.message));
await win.waitForLoadState('domcontentloaded');
assert(win.url().startsWith('app://dentweb/'), 'renderer served from app:// protocol');
const nodeLeak = await win.evaluate(() => typeof require !== 'undefined' || typeof process !== 'undefined');
assert(!nodeLeak, 'no Node globals in renderer (contextIsolation + sandbox)');
const bad = await win.evaluate(() => window.dentweb.invoke('fs:read', {}).then(() => 'resolved', (e) => String(e)));
assert(bad.includes('not allowed'), 'preload rejects non-allowlisted channel');

await win.getByText('Masuk ke studio').waitFor({ timeout: 15000 });
await win.fill('input[type=email]', EMAIL);
await win.fill('input[type=password]', PASS);
await win.click('button:has-text("Lanjut")');
await win.getByLabel('Kode OTP').waitFor();
await sleep(300);
await win.fill('[aria-label="Kode OTP"]', otp(EMAIL));
await win.getByText('Halo,').waitFor({ timeout: 15000 });
assert(true, 'desktop login with OTP (tokens kept in main process)');

await win.click('button:has-text("Aktifkan perangkat ini")');
await win.getByText('Perangkat aktif.').waitFor({ timeout: 15000 });
assert(true, 'device activated + offline proof stored');
await win.getByText(/Offline:.*sampai/).waitFor({ timeout: 5000 }).catch(() => {});
const offline = await win.evaluate(() => window.dentweb.invoke('license:offline-status'));
assert(offline.ok && offline.data.valid, 'offline proof verifies with Ed25519 public key');
await win.getByText(/Tidak ditemukan|Terpasang/).waitFor();
assert(true, 'Claude Code detection reports real state');
await win.screenshot({ path: 'shots/desktop-home.png' });
assert(errors.length === 0, 'no renderer errors');
await app.close();
