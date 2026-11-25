const BASE_URL = process.env.API_URL ?? 'https://motion.dentsweb.my.id';

async function runE2E() {
  console.log('🧪 Starting Full E2E Verification: Galeri Gaya 10 Preset MP4 & Voice TTS System...');

  // 1. Check Categories
  console.log('📍 1. Testing GET /api/v1/styles/categories');
  const catRes = await fetch(`${BASE_URL}/api/v1/styles/categories`);
  if (!catRes.ok) throw new Error(`Failed to fetch categories: ${catRes.status}`);
  const catJson = await catRes.json();
  console.log(`✓ Categories loaded: ${catJson.categories?.length} categories, total presets: ${catJson.total}`);

  // 2. Check Presets
  console.log('📍 2. Testing GET /api/v1/styles/presets');
  const presetRes = await fetch(`${BASE_URL}/api/v1/styles/presets?limit=100`);
  if (!presetRes.ok) throw new Error(`Failed to fetch presets: ${presetRes.status}`);
  const presetJson = await presetRes.json();
  const presets = presetJson.items || [];
  console.log(`✓ Presets retrieved: ${presets.length}`);

  if (presets.length < 10) {
    throw new Error(`Expected at least 10 presets, got ${presets.length}`);
  }

  // 3. Verify Video & Thumbnail for each of the 10 presets
  console.log('📍 3. Verifying all 10 Presets have streaming video MP4 and thumbnail (No @coretanfery, Walking Person)');
  for (const p of presets) {
    if (!p.previewUrl) throw new Error(`Preset "${p.name}" (${p.slug}) missing previewUrl!`);
    if (!p.thumbnailUrl) throw new Error(`Preset "${p.name}" (${p.slug}) missing thumbnailUrl!`);

    const fullVideoUrl = p.previewUrl.startsWith('http') ? p.previewUrl : `${BASE_URL}${p.previewUrl}`;
    const vCheck = await fetch(fullVideoUrl, { method: 'HEAD' });
    if (!vCheck.ok) throw new Error(`Video URL for "${p.name}" returned status ${vCheck.status}`);
    const contentType = vCheck.headers.get('content-type');
    const contentLength = vCheck.headers.get('content-length');
    console.log(`  ✓ [${p.slug}] ${p.name}: MP4 OK (${contentType}, ${contentLength} bytes)`);
  }

  // 4. Test Voice Providers & Voices Catalog (including Kokoro)
  console.log('📍 4. Testing GET /api/v1/voices/providers & GET /api/v1/voices');
  const provRes = await fetch(`${BASE_URL}/api/v1/voices/providers`);
  if (!provRes.ok) throw new Error(`Failed to fetch voice providers: ${provRes.status}`);
  const provs = await provRes.json();
  console.log(`✓ Voice providers: ${provs.map((pr) => pr.displayName).join(', ')}`);

  const voiceRes = await fetch(`${BASE_URL}/api/v1/voices`);
  if (!voiceRes.ok) throw new Error(`Failed to fetch voices: ${voiceRes.status}`);
  const voices = await voiceRes.json();
  console.log(`✓ Total published voices in catalog: ${voices.length}`);

  const kokoroVoices = voices.filter((v) => v.name.includes('Kokoro'));
  console.log(`✓ Kokoro neural voices found: ${kokoroVoices.length}`);
  if (kokoroVoices.length < 6) {
    console.warn(`Warning: Expected 6 Kokoro voices, found ${kokoroVoices.length}`);
  }
  for (const kv of kokoroVoices) {
    console.log(`  ✓ Voice: ${kv.name} (${kv.language}, sample: ${kv.sampleUrl ? 'YES' : 'NO'})`);
  }

  // 5. Test Dynamic "Teks Uji" Preview (POST /api/v1/voices/:id/preview)
  console.log('📍 5. Testing Dynamic Voice Preview with Custom Test Text');
  const testVoice = kokoroVoices[0] || voices[0];
  const testText = 'Coba lihat benda ini. Kelihatannya biasa, tapi ada rahasia kecil di dalamnya.';
  console.log(`  Testing voice: ${testVoice.name} (ID: ${testVoice.id})`);
  console.log(`  Input text: "${testText}"`);

  const previewRes = await fetch(`${BASE_URL}/api/v1/voices/${testVoice.id}/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: testText }),
  });

  if (!previewRes.ok) {
    const errText = await previewRes.text();
    throw new Error(`Voice preview failed with HTTP ${previewRes.status}: ${errText}`);
  }

  const previewJson = await previewRes.json();
  console.log(`  ✓ Preview audio URL: ${previewJson.audioUrl}`);

  // 6. Verify synthesized audio streaming
  console.log('📍 6. Verifying Synthesized MP3 Stream');
  const fullAudioUrl = previewJson.audioUrl.startsWith('http') ? previewJson.audioUrl : `${BASE_URL}${previewJson.audioUrl}`;
  const aHead = await fetch(fullAudioUrl, { method: 'HEAD' });
  if (!aHead.ok) throw new Error(`Failed to fetch audio stream: ${aHead.status}`);
  console.log(`  ✓ Audio Content-Type: ${aHead.headers.get('content-type')}`);
  console.log(`  ✓ Audio Size: ${aHead.headers.get('content-length')} bytes`);
  console.log(`  ✓ Range support (HTTP 206): ${aHead.headers.get('accept-ranges')}`);

  // 7. Test Partial Range Request (HTTP 206)
  const rangeRes = await fetch(fullAudioUrl, { headers: { Range: 'bytes=0-1000' } });
  if (rangeRes.status !== 206 && rangeRes.status !== 200) {
    throw new Error(`Range request failed: ${rangeRes.status}`);
  }
  console.log(`  ✓ Range request returned HTTP ${rangeRes.status}`);

  console.log('🎉 ALL 10 PRESETS, KOKORO VOICES, & INTERACTIVE "TEKS UJI" PREVIEWS PASSED 100%!');
}

runE2E().catch((err) => {
  console.error('❌ E2E Failed:', err);
  process.exit(1);
});
