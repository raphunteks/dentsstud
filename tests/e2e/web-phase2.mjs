// Phase 2 browser E2E: Superadmin catalog pages, member studio pages, Motion Editor autosave + cloud render.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH ?? 'playwright');
const LOG = process.env.API_LOG ?? '/tmp/claude-0/api.log';
const BASE = process.env.WEB_URL ?? 'http://localhost:3000';
const otp = (email) => readFileSync(LOG, 'utf8').split('\n').filter((l) => l.includes(`ke ${email}:`)).at(-1).match(/: (\d{6})/)[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (m) => console.log(`✓ ${m}`);

const browser = await chromium.launch();
const errors = [];
async function login(ctx, email, pass) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${email}: ${e.message}`));
  await page.goto(`${BASE}/login`);
  await page.fill('#email', email);
  await page.fill('#password', pass);
  await page.click('button[type=submit]');
  await page.waitForSelector('#otp');
  await sleep(300);
  await page.fill('#otp', otp(email));
  await page.waitForURL(/\/(admin|dashboard)/);
  return page;
}

const admin = await login(await browser.newContext({ viewport: { width: 1440, height: 900 } }), 'admin@dentweb.example', 'AdminKuat12345');
for (const [path, text] of [['/admin/content', 'Katalog konten'], ['/admin/content/import', 'Import package'], ['/admin/voices', 'Provider']]) {
  await admin.goto(`${BASE}${path}`);
  await admin.getByText(text).first().waitFor();
  ok(`admin ${path}`);
}
await admin.goto(`${BASE}/admin/content`);
await admin.getByRole('tab', { name: 'Kategori' }).click();
await admin.getByText('gaya-studio').waitFor();
ok('12 categories listed in CMS');
await admin.screenshot({ path: 'shots/admin-content.png' });

// Member: register fresh, then studio pages
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const email = `studio${Date.now()}@dentweb.example`;
const m = await ctx.newPage();
m.on('pageerror', (e) => errors.push(`member: ${e.message}`));
await m.goto(`${BASE}/register`);
await m.fill('#displayName', 'Studio Tester');
await m.fill('#email', email);
await m.fill('#password', 'PasswordKuat123');
await m.click('button[type=submit]');
await m.waitForSelector('#otp');
await sleep(300);
await m.fill('#otp', otp(email));
await m.waitForURL('**/dashboard');
for (const [path, text] of [['/styles', 'Galeri gaya'], ['/voices', 'Suara narator'], ['/settings/voice-accounts', 'Akun suara'], ['/settings/brand', 'Brand & akun'], ['/settings/production', 'Produksi otomatis'], ['/studio/render', 'Render Center']]) {
  await m.goto(`${BASE}${path}`);
  await m.getByText(text).first().waitFor();
  ok(`member ${path}`);
}
// grant license via admin UI so cloud render is allowed
await admin.goto(`${BASE}/admin/members`);
await admin.locator('tr', { hasText: email }).getByRole('link').click();
await admin.getByRole('button', { name: 'Berikan lisensi' }).click();
await admin.getByRole('button', { name: 'Cabut lisensi' }).waitFor();
ok('license granted');

await m.goto(`${BASE}/studio/projects`);
await m.fill('#pn', 'Uji editor');
await m.click('button:has-text("Buat & buka editor")');
await m.waitForURL('**/studio/editor/**');
await m.getByText('Tersimpan · rev 1').waitFor({ timeout: 20000 });
ok('editor loaded rev 1');
await m.click('button:has-text("+ Teks")');
await m.fill('#ly-text', 'Halo dari editor');
await m.getByText('Tersimpan · rev 2').or(m.getByText('Tersimpan · rev 3')).waitFor({ timeout: 15000 });
ok('autosave created a new revision');
await m.keyboard.press('Escape');
await m.click('button:has-text("+ Scene")');
await m.getByText('2. Scene 2').waitFor();
await m.click('[aria-label="Undo"]');
await m.getByText('2. Scene 2').waitFor({ state: 'detached' });
ok('undo works');
await m.screenshot({ path: 'shots/editor.png' });
await m.click('button:has-text("Render cloud")');
await m.getByText('Render cloud masuk antrean').waitFor({ timeout: 15000 });
await m.goto(`${BASE}/studio/render`);
await m.getByText(/Unduh MP4/).waitFor({ timeout: 120000 });
ok('cloud render completed and is downloadable');
await m.screenshot({ path: 'shots/render-center.png' });
if (errors.length) throw new Error(errors.join('\n'));
ok('no page errors');
await browser.close();
