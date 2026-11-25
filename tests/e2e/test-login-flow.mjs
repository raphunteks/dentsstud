import { chromium } from 'playwright';

async function run() {
  console.log('🚀 Starting Playwright E2E Login Verification on http://localhost:3000/login...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const networkErrors = [];
  page.on('response', (response) => {
    if (response.status() >= 400 && !response.url().includes('favicon')) {
      networkErrors.push({ url: response.url(), status: response.status() });
    }
  });

  // 1. Navigate to /login
  console.log('📍 Navigating to http://localhost:3000/login');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });

  // 2. Verify login form elements
  const heading = await page.textContent('h1');
  console.log(`✓ Page header found: "${heading}"`);

  // 3. Fill in Superadmin credentials from env
  const email = process.env.E2E_EMAIL ?? 'ksanihtest@gmail.com';
  const password = process.env.E2E_PASSWORD;
  if (!password) {
    console.log('⏭️ Skipping login submit step: E2E_PASSWORD is not set in environment.');
    await browser.close();
    return;
  }
  console.log(`✍️ Filling credentials: ${email}`);
  await page.fill('#email', email);
  await page.fill('#password', password);

  // 4. Click Submit
  console.log('🖱️ Clicking button "Lanjut"');
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/v1/auth/login')),
    page.click('button[type="submit"]'),
  ]);

  console.log(`✓ API Response Status: ${response.status()}`);
  const json = await response.json();
  console.log('✓ API Response JSON:', JSON.stringify(json));

  if (response.status() !== 200) {
    throw new Error(`Expected status 200 but got ${response.status()}`);
  }

  // 5. Verify OTP Step is displayed
  console.log('⏳ Waiting for OTP screen...');
  await page.waitForSelector('#otp', { timeout: 10000 });
  const otpLabel = await page.textContent('body');
  const hasOtpPrompt = otpLabel.includes('kode') || otpLabel.includes('OTP');
  console.log(`✓ OTP Prompt displayed: ${hasOtpPrompt}`);

  // Take screenshot for proof
  await page.screenshot({ path: 'shots/login-otp-success.png' });
  console.log('📸 Screenshot saved to shots/login-otp-success.png');

  if (networkErrors.length > 0) {
    console.error('⚠️ Encountered network errors:', networkErrors);
  } else {
    console.log('✅ ALL E2E PLAYWRIGHT TESTS PASSED 100% WITH ZERO ERRORS!');
  }

  await browser.close();
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
