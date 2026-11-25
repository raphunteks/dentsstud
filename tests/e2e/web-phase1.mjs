// Browser E2E against a running web (3000) + API (4000) in development (OTP read from API dev log).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH ?? 'playwright');
import { readFileSync } from 'node:fs';

const LOG = process.env.API_LOG ?? '/tmp/claude-0/api.log';
const BASE = process.env.WEB_URL ?? 'http://localhost:3000';
const SHOTS = process.env.SHOTS ?? 'shots';
const otpFor = (email) => {
  const lines = readFileSync(LOG, 'utf8').split('\n').filter((l) => l.includes(`ke ${email}:`));
  const m = lines.at(-1)?.match(/: (\d{6})/);
  if (!m) throw new Error(`OTP not found for ${email}`);
  return m[1];
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const assert = (c, m) => { if (!c) throw new Error(`ASSERT: ${m}`); console.log(`✓ ${m}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

// Protected route redirects
await page.goto(`${BASE}/dashboard`);
assert(page.url().includes('/login'), 'unauthenticated /dashboard → /login');

// Register + OTP
const email = `member${Date.now()}@dentweb.example`;
await page.goto(`${BASE}/register`);
await page.fill('#displayName', 'Rina Kreator');
await page.fill('#email', email);
await page.fill('#password', 'short');
await page.click('button[type=submit]');
await page.getByText('Password minimal 10 karakter').waitFor({ timeout: 5000 }); assert(true, 'client validation shows field error');
await page.fill('#password', 'PasswordKuat123');
await page.click('button[type=submit]');
await page.waitForSelector('#otp');
await wait(300);
await page.fill('#otp', otpFor(email));
await page.waitForURL('**/dashboard');
assert(true, 'register + OTP → dashboard');
const chips = await page.locator('[data-chip]').count();
assert(chips === 12, `12 category chips (got ${chips})`);
assert(await page.getByText(/· \d+ preset/).first().isVisible(), 'total preset >= 0 (dynamic)');
await page.screenshot({ path: `${SHOTS}/member-dashboard-dark.png` });

// Claude settings: OAuth PKCE / API key status shown honestly
await page.click('a[href="/settings/claude"] >> nth=0');
await page.waitForURL('**/settings/claude');
await page.getByText(/Belum terhubung|Terhubung|CONNECTED|AVAILABLE|UNSUPPORTED/i).first().waitFor();
assert(
  await page.getByText(/CONNECTED|AVAILABLE|UNSUPPORTED|9Router|OAuth/i).first().isVisible(),
  'OAuth PKCE / Claude status shown honestly',
);
await page.screenshot({ path: `${SHOTS}/member-claude.png` });

await page.goto(`${BASE}/settings/license`);
await page.getByText('Belum ada lisensi').waitFor();
assert(true, 'license page shows NONE');

// Member cannot open admin
await page.goto(`${BASE}/admin`);
await page.waitForURL('**/dashboard');
assert(true, 'member redirected away from /admin');

await page.getByRole('button', { name: 'Keluar' }).first().click();
await page.waitForURL('**/login');
assert(true, 'logout');

// Superadmin
await page.fill('#email', 'admin@dentweb.example');
await page.fill('#password', 'AdminKuat12345');
await page.click('button[type=submit]');
await page.waitForSelector('#otp');
await wait(300);
await page.fill('#otp', otpFor('admin@dentweb.example'));
await page.waitForURL('**/admin');
await page.getByText('Total member').waitFor();
await page.screenshot({ path: `${SHOTS}/admin-dashboard-dark.png` });
await page.goto(`${BASE}/admin/members`);
await page.locator('tr', { hasText: email }).getByRole('link').click();
await page.waitForURL('**/admin/members/**');
await page.getByRole('button', { name: 'Berikan lisensi' }).click();
await page.getByRole('button', { name: 'Cabut lisensi' }).waitFor();
assert(true, 'superadmin granted license via UI');
await page.screenshot({ path: `${SHOTS}/admin-member-detail.png`, fullPage: true });
await page.goto(`${BASE}/admin/system`);
await page.getByText('license.grant').first().waitFor();
assert(true, 'audit log shows license.grant');

const light = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
const p2 = await light.newPage();
await p2.goto(`${BASE}/login`);
await p2.screenshot({ path: `${SHOTS}/login-mobile-light.png` });
await p2.goto(`${BASE}/`);
await p2.screenshot({ path: `${SHOTS}/home-mobile-light.png`, fullPage: true });

assert(errors.length === 0, `no page errors ${errors.join(' | ')}`);
await browser.close();
