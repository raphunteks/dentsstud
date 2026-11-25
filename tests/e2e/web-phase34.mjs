// Phase 3 + 4 browser E2E against the running stack: production wizard honesty, progress/results pages,
// admin workflow/production/quotas/releases/support/analytics pages, help center + ticket round trip, dark mode.
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH ?? 'playwright');
const LOG = process.env.API_LOG ?? '/tmp/claude-0/api.log';
const BASE = process.env.WEB_URL ?? 'http://localhost:3000';
const otp = (email) => readFileSync(LOG, 'utf8').split('\n').filter((l) => l.includes(`ke ${email}:`)).at(-1).match(/: (\d{6})/)[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (m) => console.log(`✓ ${m}`);
mkdirSync('shots', { recursive: true });

const browser = await chromium.launch();
const errors = [];
const watch = (page, who) => {
  page.on('pageerror', (e) => errors.push(`${who}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|EventSource/.test(m.text()) && errors.push(`${who} console: ${m.text()}`));
};

async function login(ctx, email, pass) {
  const page = await ctx.newPage();
  watch(page, email);
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

// ---------- member ----------
const mctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const email = `p34${Date.now()}@dentweb.example`;
const m = await mctx.newPage();
watch(m, 'member');
await m.goto(`${BASE}/register`);
await m.fill('#displayName', 'Produksi Tester');
await m.fill('#email', email);
await m.fill('#password', 'PasswordKuat123');
await m.click('button[type=submit]');
await m.waitForSelector('#otp');
await sleep(300);
await m.fill('#otp', otp(email));
await m.waitForURL('**/dashboard');
await m.getByRole('link', { name: 'Buat konten baru' }).waitFor();
ok('dashboard shows primary action');

await m.goto(`${BASE}/create-content`);
await m.getByText('Ringkasan pesanan').waitFor();
await m.getByText('Lisensi belum aktif').waitFor();
await m.getByText(/Claude belum terhubung|Claude terhubung/i).first().waitFor();
const start = m.getByRole('button', { name: /Mulai produksi/ }).last();
if (!(await start.isDisabled())) throw new Error('submit should be disabled without license/Claude');
ok('wizard blocks honestly without license and Claude');
await m.getByRole('button', { name: /Topik persis/ }).click();
await m.fill('#topic', 'Kenapa gigi berlubang\nCara memilih sikat gigi\nBenang gigi');
await m.getByText('3 topik').waitFor();
await m.getByRole('button', { name: /16:9/ }).click();
await m.getByText('3 × 16:9').waitFor();
const ttsBtn = m.getByRole('button', { name: /Suara AI/ });
const ttsDisabled = await ttsBtn.isDisabled();
ok(`summary updates in real time; TTS button state (disabled=${ttsDisabled}) accepts populated or empty voice catalog`);
await m.screenshot({ path: 'shots/create-content.png', fullPage: true });

for (const [path, text] of [['/progress', 'Tidak ada produksi aktif'], ['/results', 'Belum ada video di sini']]) {
  await m.goto(`${BASE}${path}`);
  await m.getByText(text).first().waitFor();
  ok(`member ${path} empty state`);
}

await m.goto(`${BASE}/help`);
await m.getByText('Mulai menggunakan DENTSWEB STUDIO').waitFor();
await m.getByText('Mulai menggunakan DENTSWEB STUDIO').click();
await m.getByRole('dialog').getByText('Hubungkan Claude di Pengaturan').waitFor();
await m.keyboard.press('Escape');
await m.fill('input[aria-label="Cari artikel"]', 'render');
await m.getByText('Render lama atau gagal').waitFor();
ok('help articles + search');
await m.screenshot({ path: 'shots/help.png' });
await m.getByRole('tab', { name: 'Tiket support' }).click();
await m.getByRole('button', { name: 'Tiket baru' }).click();
await m.fill('#ts', 'Uji tiket dari E2E');
await m.fill('#tb', 'Halo tim, ini tiket uji otomatis dari browser.');
await m.getByRole('button', { name: 'Kirim tiket' }).click();
await m.getByText('Halo tim, ini tiket uji otomatis dari browser.').waitFor();
ok('member opened a ticket');
await m.keyboard.press('Escape');

// ---------- admin ----------
const actx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const a = await login(actx, 'admin@dentweb.example', 'AdminKuat12345');
const pages = [
  ['/admin/workflows', 'Research Agent'],
  ['/admin/production', 'Produksi'],
  ['/admin/results', 'Hasil & Media'],
  ['/admin/quotas', 'Otomasi & Kuota'],
  ['/admin/releases', 'Unggah rilis'],
  ['/admin/analytics', 'Video selesai per hari'],
];
for (const [path, text] of pages) {
  await a.goto(`${BASE}${path}`);
  await a.getByText(text).first().waitFor();
  await a.screenshot({ path: `shots/admin-${path.split('/').pop()}.png` });
  ok(`admin ${path}`);
}
await a.goto(`${BASE}/admin/workflows`);
await a.getByRole('tab', { name: 'Workflow' }).click();
await a.getByText('Produksi Standar').waitFor();
ok('workflow builder lists the seeded workflow');

await a.goto(`${BASE}/admin/support`);
await a.getByText('Uji tiket dari E2E').click();
await a.fill('textarea[aria-label="Balasan"]', 'Terima kasih, tiket diterima tim.');
await a.getByRole('button', { name: 'Kirim' }).click();
await a.getByText('Terima kasih, tiket diterima tim.').waitFor();
ok('admin replied to the ticket');

await m.reload();
await m.getByRole('tab', { name: 'Tiket support' }).click();
await m.getByText('Dibalas tim').waitFor();
ok('member sees the reply status');

await a.goto(`${BASE}/admin/analytics`);
await a.getByRole('tab', { name: 'Error' }).click();
await a.getByText(/Tidak ada error|Detail/).first().waitFor();
ok('error monitor tab');

// dark mode + mobile
const dctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
const d = await dctx.newPage();
watch(d, 'mobile');
await d.goto(`${BASE}/login`);
await d.fill('#email', email);
await d.fill('#password', 'PasswordKuat123');
await d.click('button[type=submit]');
await d.waitForSelector('#otp');
await sleep(300);
await d.fill('#otp', otp(email));
await d.waitForURL('**/dashboard');
await d.goto(`${BASE}/create-content`);
await d.getByText('Ringkasan pesanan').waitFor();
const overflow = await d.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
if (overflow) throw new Error('horizontal overflow on mobile create-content');
await d.screenshot({ path: 'shots/create-content-mobile-dark.png', fullPage: true });
ok('mobile dark create-content has no horizontal overflow');

await browser.close();
if (errors.length) {
  console.error('Browser errors:\n' + errors.join('\n'));
  process.exit(1);
}
ok('no browser errors');
