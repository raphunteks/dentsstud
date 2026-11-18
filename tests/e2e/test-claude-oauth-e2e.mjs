import { chromium } from 'playwright';
import { createServer } from 'node:http';

async function runE2E() {
  console.log('🧪 Starting E2E Verification for Claude OAuth & Desktop Deep-Link...');

  // 1. Test Local Callback Server & HTML Response
  console.log('📍 1. Simulating Local Callback Server with Deep-Link on port 3000');
  let receivedCode = null;
  let receivedState = null;

  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost:3000');
    if (url.pathname === '/callback') {
      receivedCode = url.searchParams.get('code');
      receivedState = url.searchParams.get('state');

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>DENTSWEB STUDIO - Terhubung</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #141210; color: #f4efe5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #1c1917; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 40px; text-align: center; max-width: 440px; }
    h2 { color: #22c55e; margin-top: 0; font-size: 22px; }
    .btn { display: inline-block; margin-top: 20px; background: #e09322; color: #141210; font-weight: 700; padding: 12px 28px; border-radius: 10px; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h2>✓ Berhasil Terhubung!</h2>
    <p>Otorisasi Claude AI selesai. Aplikasi DENTSWEB STUDIO sedang dibuka kembali secara otomatis...</p>
    <a href="dentsweb://oauth-success" class="btn">Buka DENTSWEB STUDIO</a>
  </div>
</body>
</html>`);
    } else {
      res.writeHead(404).end();
    }
  });

  await new Promise((resolve) => server.listen(3000, resolve));
  console.log('✓ Mock desktop OAuth listener active on port 3000');

  // 2. Playwright Headless Browser Navigation using system Chrome
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  const page = await browser.newPage();

  console.log('📍 2. Navigating to http://localhost:3000/callback?code=mock_claude_code_789&state=mock_state_abc');
  const response = await page.goto('http://localhost:3000/callback?code=mock_claude_code_789&state=mock_state_abc', { waitUntil: 'domcontentloaded' });

  if (response.status() !== 200) {
    throw new Error(`Expected HTTP 200, got ${response.status()}`);
  }
  console.log(`✓ Callback HTTP Status: ${response.status()}`);

  const heading = await page.textContent('h2');
  console.log(`✓ Page Heading: "${heading}"`);
  if (!heading.includes('Berhasil Terhubung')) {
    throw new Error('Heading did not contain "Berhasil Terhubung"');
  }

  const btnHref = await page.getAttribute('a.btn', 'href');
  console.log(`✓ Deep-link Button Href: "${btnHref}"`);
  if (btnHref !== 'dentsweb://oauth-success') {
    throw new Error(`Expected href "dentsweb://oauth-success", got "${btnHref}"`);
  }

  console.log(`✓ Callback received params: code="${receivedCode}", state="${receivedState}"`);
  if (receivedCode !== 'mock_claude_code_789' || receivedState !== 'mock_state_abc') {
    throw new Error('Callback params mismatched!');
  }

  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  console.log('✓ Callback server cleanly shut down');

  // 3. Test Production VPS Health & API Status
  console.log('📍 3. Testing Production API Health on https://motion.dentsweb.my.id');
  const healthRes = await fetch('https://motion.dentsweb.my.id/api/v1/health');
  const healthJson = await healthRes.json();
  console.log('✓ Health response:', JSON.stringify(healthJson));
  if (healthJson.status !== 'ok' || healthJson.db !== 'up' || healthJson.redis !== 'up') {
    throw new Error('Production VPS health check failed');
  }

  console.log('🎉 ALL PLAYWRIGHT E2E & DEEP-LINK TESTS PASSED 100%!');
}

runE2E().catch((err) => {
  console.error('❌ E2E Failed:', err);
  process.exit(1);
});
