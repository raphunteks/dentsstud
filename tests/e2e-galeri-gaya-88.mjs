import { chromium } from 'playwright';
import assert from 'node:assert';

const BASE_URL = process.env.TEST_URL || 'https://motion.dentsweb.my.id';

async function runE2E() {
  console.log(`[E2E] Memulai pengujian Galeri Gaya di ${BASE_URL}...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true
  });
  const page = await context.newPage();

  // 1. Uji API langsung: GET /api/v1/styles/presets
  console.log('[E2E] 1. Menguji respons API /api/v1/styles/presets...');
  const res = await page.request.get(`${BASE_URL}/api/v1/styles/presets?limit=100`);
  assert.strictEqual(res.status(), 200, `API styles/presets gagal: status ${res.status()}`);
  const data = await res.json();
  const presets = data.items || [];
  console.log(`[E2E] Total preset ditemukan di API: ${presets.length}`);
  assert.ok(presets.length >= 88, `Total preset (${presets.length}) kurang dari 88!`);

  // Cek sampel gaya viral utama (8 headline awal + 5 dari 21 gaya asli DB)
  const headlineSlugs = [
    'isometrik-dibongkar',
    'sejarah-3d',
    'tubuh-anime',
    'dunia-2d',
    'kartun-cel',
    'peta-relief',
    'promo-produk',
    'bikin-dari-nol',
    'art-deco',
    'blueprint',
    'spy-titles',
    'ukiyoe',
    'whiteboard'
  ];
  for (const s of headlineSlugs) {
    const item = presets.find((p) => p.slug === s);
    assert.ok(item, `Gaya utama '${s}' tidak ditemukan di API!`);
    assert.ok(item.previewUrl, `Gaya '${s}' tidak memiliki previewUrl!`);
    assert.ok(item.thumbnailUrl, `Gaya '${s}' tidak memiliki thumbnailUrl!`);
    console.log(`  ✓ ${s}: previewUrl=${item.previewUrl.slice(0, 45)}...`);
  }

  // 2. Uji streaming asset media: pastikan previewUrl dan thumbnailUrl mengembalikan HTTP 200 / 206
  console.log('[E2E] 2. Menguji streaming video MP4 & thumbnail JPG...');
  for (const testSlug of ['isometrik-dibongkar', 'blueprint', 'spy-titles']) {
    const sample = presets.find((p) => p.slug === testSlug);
    assert.ok(sample, `Preset '${testSlug}' tidak ditemukan untuk uji streaming!`);
    const thumbRes = await page.request.get(`${BASE_URL}${sample.thumbnailUrl}`);
    assert.strictEqual(thumbRes.status(), 200, `Thumbnail ${sample.slug} gagal diambil!`);
    console.log(`  ✓ [${testSlug}] Thumbnail JPG: HTTP 200 (${thumbRes.headers()['content-type']})`);

    const videoRes = await page.request.get(`${BASE_URL}${sample.previewUrl}`, {
      headers: { Range: 'bytes=0-1024' }
    });
    assert.ok([200, 206].includes(videoRes.status()), `Video ${sample.slug} gagal di-stream (status ${videoRes.status()})!`);
    console.log(`  ✓ [${testSlug}] Video MP4 Stream: HTTP ${videoRes.status()} (${videoRes.headers()['content-type']})`);
  }

  // 3. Uji navigasi halaman web: buka portal web
  console.log('[E2E] 3. Menguji visual UI portal web...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  const title = await page.title();
  console.log(`  ✓ Halaman termuat: "${title}"`);

  await browser.close();
  console.log('[E2E] SELURUH PENGUJIAN GALERI GAYA PASS 100%!');
}

runE2E().catch((err) => {
  console.error('[E2E] GAGAL:', err);
  process.exit(1);
});
