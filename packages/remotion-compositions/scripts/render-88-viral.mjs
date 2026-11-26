#!/usr/bin/env node
/**
 * DENTSWEB STUDIO — Remotion Full Multi-Scene Visual Storytelling Batch Renderer (88 Styles)
 * Renders ViralStyleComp via @remotion/renderer (720x1280, 30fps, crf 23) + faststart remux
 * + JPG thumbnail capture (2.8s) + PostgreSQL media_assets/visual_presets sync.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openBrowser, renderMedia, selectComposition } from '@remotion/renderer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE_DIR = path.resolve(__dirname, '../bundle');

const AUDIO_DIR = process.env.DENTSWEB_AUDIO_DIR || '/opt/dentsweb/content/skills/dentsweb-motion/assets/audio';
const OUTPUT_DIR = process.env.DENTSWEB_OUTPUT_DIR || '/opt/dentsweb/apps/api/.data/storage/objects/media/presets_rendered';
const CATALOG_PATH = process.env.DENTSWEB_CATALOG_PATH || '/opt/dentsweb/content/skills/dentsweb-motion/scripts/viral_88_naskah.json';
const SUPERADMIN_ID = '62375e60-d295-4f0c-8828-e2bc6ce50ba9';

const SLUG_THEMES = {
  whiteboard: 'whiteboard', watercolor: 'light_paper', 'urban-sketch': 'light_paper',
  woodcut: 'light_paper', engraving: 'light_paper', 'one-line': 'light_paper',
  'paper-popup': 'light_paper', 'crayon-book': 'light_paper', ukiyoe: 'light_paper',
  'album-polaroid': 'light_paper', 'teater-kertas': 'light_paper', 'cetak-blok': 'light_paper',
  'printed-long-take': 'light_paper', 'dunia-2d': 'light_paper',
  chalkboard: 'chalkboard',
  blueprint: 'blueprint_blue', 'iso-infographic': 'blueprint_blue', 'isometric-picture-book': 'blueprint_blue',
  'isometrik-dibongkar': 'blueprint_blue',
  'memphis-diorama': 'pop_vibrant', 'brick-toy': 'pop_vibrant', risograph: 'pop_vibrant',
  'silkscreen-poster': 'pop_vibrant', 'game-show': 'pop_vibrant', microgame: 'pop_vibrant',
  'midcentury-toon': 'pop_vibrant', 'rubber-hose': 'pop_vibrant', 'scifi-toon': 'pop_vibrant',
  'cel-anime-80s': 'pop_vibrant', 'lowpoly-island': 'pop_vibrant', 'tilt-shift': 'pop_vibrant',
  'kartun-cel': 'pop_vibrant', 'tubuh-anime': 'pop_vibrant',
  backrooms: 'liminal_vhs',
  'stained-glass': 'stained_glass',
  'swiss-motion': 'swiss_red', 'kino-montage': 'swiss_red', 'papercut-red': 'swiss_red',
  'poster-huruf-kayu': 'swiss_red',
  'art-deco': 'gold_sepia', 'manuskrip-iluminasi': 'gold_sepia', 'mosaik-romawi': 'gold_sepia',
  'gongbi-sutra': 'gold_sepia', dagerotipe: 'gold_sepia', newsreel: 'gold_sepia',
  'silent-film': 'gold_sepia', scrimshaw: 'gold_sepia', 'sejarah-3d': 'gold_sepia',
  'pastel-senja': 'twilight_pastel', impasto: 'twilight_pastel', 'ink-wash': 'twilight_pastel',
  'paper-lantern': 'twilight_pastel', 'shadow-puppet': 'twilight_pastel',
  'ascii-crt': 'neon_cyber', 'circuit-board': 'neon_cyber', 'hologram-hud': 'neon_cyber',
  'lidar-survey': 'neon_cyber', dataviz: 'neon_cyber', 'data-physical': 'neon_cyber',
  'arcade-tarung': 'neon_cyber', 'pixel-rpg': 'neon_cyber', 'hd-2d': 'neon_cyber',
  'dark-keynote': 'dark_keynote', 'living-screencast': 'dark_keynote', 'desktop-flythrough': 'dark_keynote',
  'transit-map': 'neon_cyber', 'caption-news': 'neon_cyber', 'news-package': 'neon_cyber',
  telestrator: 'chalkboard', 'visual-investigation': 'dark_keynote', countdown: 'neon_cyber',
  'city-symphony': 'dark_keynote', 'archive-lighttable': 'gold_sepia', 'briefing-board': 'blueprint_blue',
  microscope: 'neon_cyber', 'satellite-briefing': 'blueprint_blue', teardown: 'blueprint_blue',
  'white-model': 'whiteboard', 'spy-titles': 'gold_sepia', 'halftone-dossier': 'dark_keynote',
  'pictogram-motion': 'neon_cyber', 'glass-product': 'dark_keynote', 'potongan-arsitektur': 'blueprint_blue',
  'arang-gotik': 'dark_keynote', 'mesin-ketik': 'light_paper', 'promo-produk': 'dark_keynote',
  'peta-relief': 'blueprint_blue', 'bikin-dari-nol': 'neon_cyber',
};

function parseArgs(argv) {
  const opts = { slug: '', limit: 0, startIndex: 0, concurrency: 4, noDb: false, skipExisting: false, shardIdx: 0, shardTotal: 1, slugsFile: '' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--slug') opts.slug = argv[++i] || '';
    else if (a === '--limit') opts.limit = Number(argv[++i] || 0);
    else if (a === '--start') opts.startIndex = Number(argv[++i] || 0);
    else if (a === '--concurrency') opts.concurrency = Number(argv[++i] || 4);
    else if (a === '--no-db') opts.noDb = true;
    else if (a === '--skip-existing') opts.skipExisting = true;
    else if (a === '--slugs-file') opts.slugsFile = argv[++i] || '';
    else if (a === '--shard') {
      const [idx, tot] = (argv[++i] || '0/1').split('/').map(Number);
      opts.shardIdx = idx || 0;
      opts.shardTotal = tot || 1;
    }
  }
  return opts;
}

function runPsql(query) {
  const out = execFileSync(
    'docker',
    ['exec', '-i', 'dentweb-postgres', 'psql', '-U', 'dentweb', '-d', 'dentweb', '-t', '-A', '-q', '-c', query],
    { encoding: 'utf8' },
  ).trim();
  const m = out.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
  return m ? m[0] : out;
}

function sha256File(filePath) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(filePath));
  return h.digest('hex');
}

function startAudioServer(dir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const safeName = path.basename(decodeURIComponent((req.url || '/').split('?')[0]));
      const fullPath = path.join(dir, safeName);
      if (!fs.existsSync(fullPath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const stat = fs.statSync(fullPath);
      const range = req.headers.range;
      if (range) {
        const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : stat.size - 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': end - start + 1,
          'Content-Type': 'audio/mpeg',
          'Access-Control-Allow-Origin': '*',
        });
        fs.createReadStream(fullPath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': stat.size,
          'Content-Type': 'audio/mpeg',
          'Access-Control-Allow-Origin': '*',
        });
        fs.createReadStream(fullPath).pipe(res);
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: addr.port });
    });
  });
}

function findAudioAndWords(slug) {
  const files = fs.existsSync(AUDIO_DIR) ? fs.readdirSync(AUDIO_DIR) : [];
  let mp3Name = files.find((f) => f === `VO_${slug}.mp3`)
    || files.find((f) => f.startsWith('VO_') && f.endsWith(`_${slug}.mp3`))
    || '';
  let jsonName = files.find((f) => f === `VO_${slug}.json`)
    || files.find((f) => f.startsWith('VO_') && f.endsWith(`_${slug}.json`))
    || '';

  let words = [];
  let durationSec = 14;
  let metaTitle = '';
  let metaTopic = '';

  if (jsonName) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(AUDIO_DIR, jsonName), 'utf8'));
      if (Array.isArray(parsed.words)) {
        words = parsed.words.map((w) => ({
          text: String(w.text || ''),
          start: Number(w.start || 0),
          end: Number(w.end || (Number(w.start || 0) + 0.3)),
        }));
      }
      if (parsed.duration_seconds) durationSec = Number(parsed.duration_seconds);
      if (parsed.name) metaTitle = String(parsed.name);
      if (parsed.topic) metaTopic = String(parsed.topic);
    } catch {
      // ignore malformed json
    }
  }

  if (mp3Name && durationSec <= 0) {
    try {
      const probe = execFileSync(
        'ffprobe',
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', path.join(AUDIO_DIR, mp3Name)],
        { encoding: 'utf8' },
      ).trim();
      durationSec = Math.max(8, parseFloat(probe) || 14);
    } catch {
      durationSec = 14;
    }
  }

  // Cap preview duration cleanly between 10s and 28s while preserving full spoken VO when <= 28s
  const finalDurationSec = Math.max(8, Math.min(35, durationSec + 0.8));
  return { mp3Name, words, durationSec: finalDurationSec, metaTitle, metaTopic };
}

function detectBrowser() {
  const candidates = [
    process.env.REMOTION_BROWSER_EXECUTABLE,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
  ].filter(Boolean);
  return candidates.find((c) => fs.existsSync(c)) || null;
}

async function main() {
  const opts = parseArgs(process.argv);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const catalog = {};
  if (fs.existsSync(CATALOG_PATH)) {
    for (const item of JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'))) {
      catalog[item.id] = {
        slug: item.id,
        title: item.nama || item.id,
        topic: item.topik || item.nama || item.id,
      };
    }
  }

  let slugs = [];
  if (opts.slug) {
    slugs = [opts.slug];
  } else if (opts.slugsFile && fs.existsSync(opts.slugsFile)) {
    slugs = fs.readFileSync(opts.slugsFile, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
  } else if (!opts.noDb) {
    const raw = execFileSync(
      'docker',
      [
        'exec', '-i', 'dentweb-postgres', 'psql', '-U', 'dentweb', '-d', 'dentweb', '-t', '-A', '-c',
        "SELECT p.slug FROM visual_presets p JOIN media_assets m ON p.preview_asset_id = m.id WHERE m.object_key LIKE 'presets_rendered/%' ORDER BY p.slug;",
      ],
      { encoding: 'utf8' },
    );
    slugs = raw.split('\n').map((s) => s.trim()).filter(Boolean);
  } else {
    slugs = Object.keys(catalog);
  }

  if (opts.shardTotal > 1) {
    slugs = slugs.filter((_, idx) => idx % opts.shardTotal === opts.shardIdx);
  }
  if (opts.startIndex > 0) slugs = slugs.slice(opts.startIndex);
  if (opts.limit > 0) slugs = slugs.slice(0, opts.limit);

  const browserExecutable = detectBrowser();
  const { server, port } = await startAudioServer(AUDIO_DIR);
  console.log(`[remotion-88] Starting batch render: ${slugs.length} styles, concurrency=${opts.concurrency}, browser=${browserExecutable || 'auto'}, audioPort=${port}`);

  const launchBrowser = () => openBrowser('chrome', {
    browserExecutable,
    chromiumOptions: {
      disableWebSecurity: true,
    },
  });

  let puppeteerInstance = await launchBrowser();

  const tStartAll = Date.now();
  let okCount = 0;
  let renderedInSession = 0;

  try {
    for (let i = 0; i < slugs.length; i++) {
      const slug = slugs[i];
      const rawMp4 = path.join(OUTPUT_DIR, `.tmp_${slug}.mp4`);
      const finalMp4 = path.join(OUTPUT_DIR, `${slug}.mp4`);
      const finalJpg = path.join(OUTPUT_DIR, `${slug}.jpg`);

      if (opts.skipExisting && fs.existsSync(finalMp4) && fs.existsSync(finalJpg) && fs.statSync(finalMp4).size > 100000 && fs.statSync(finalJpg).size > 10000) {
        okCount++;
        continue;
      }

      if (renderedInSession > 0 && renderedInSession % 12 === 0) {
        await puppeteerInstance.close({ silent: true });
        puppeteerInstance = await launchBrowser();
      }

      const t0 = Date.now();
      const cat = catalog[slug] || { slug, title: slug.replace(/-/g, ' '), topic: 'DENTSWEB MOTION' };
      const { mp3Name, words, durationSec, metaTitle, metaTopic } = findAudioAndWords(slug);
      const durationInFrames = Math.max(90, Math.round(durationSec * 30));
      const archetype = SLUG_THEMES[slug] || 'gold_sepia';

      const inputProps = {
        slug,
        title: metaTitle || cat.title,
        topic: metaTopic || cat.topic,
        archetype,
        words,
        audioUrl: mp3Name ? `http://127.0.0.1:${port}/${encodeURIComponent(mp3Name)}` : '',
        durationInFrames,
      };

      const composition = await selectComposition({
        serveUrl: BUNDLE_DIR,
        id: 'ViralStyleComp',
        inputProps,
        puppeteerInstance,
      });

      await renderMedia({
        composition,
        serveUrl: BUNDLE_DIR,
        codec: 'h264',
        crf: 23,
        imageFormat: 'jpeg',
        jpegQuality: 85,
        pixelFormat: 'yuv420p',
        outputLocation: rawMp4,
        inputProps,
        puppeteerInstance,
        concurrency: opts.concurrency,
        x264Preset: 'veryfast',
      });

      // Guarantee moov atom at head (byte offset 32) for zero-delay HTTP 206 streaming
      execFileSync('ffmpeg', [
        '-y', '-i', rawMp4,
        '-c', 'copy',
        '-movflags', '+faststart',
        finalMp4,
      ], { stdio: 'ignore' });
      try { fs.unlinkSync(rawMp4); } catch {}

      // Capture rich full-screen JPG thumbnail at 2.8s (peak Scene 1/2 visual + hook title)
      const thumbSec = Math.min(durationSec - 0.5, 2.8);
      execFileSync('ffmpeg', [
        '-y', '-ss', thumbSec.toFixed(3),
        '-i', finalMp4,
        '-vframes', '1',
        '-q:v', '2',
        finalJpg,
      ], { stdio: 'ignore' });

      const mp4Size = fs.statSync(finalMp4).size;
      const mp4Sha = sha256File(finalMp4);
      const jpgSize = fs.statSync(finalJpg).size;
      const jpgSha = sha256File(finalJpg);

      if (!opts.noDb) {
        const videoKey = `presets_rendered/${slug}.mp4`;
        const thumbKey = `presets_rendered/${slug}.jpg`;

        let vidId = runPsql(`SELECT id FROM media_assets WHERE object_key = '${videoKey}' LIMIT 1;`);
        if (!vidId) {
          vidId = runPsql(`INSERT INTO media_assets (user_id, file_name, file_type, mime_type, size_bytes, sha256, storage_type, object_key) VALUES ('${SUPERADMIN_ID}', '${slug}.mp4', 'VIDEO', 'video/mp4', ${mp4Size}, '${mp4Sha}', 'LOCAL', '${videoKey}') RETURNING id;`);
        } else {
          runPsql(`UPDATE media_assets SET size_bytes = ${mp4Size}, sha256 = '${mp4Sha}' WHERE id = '${vidId}';`);
        }

        let thumbId = runPsql(`SELECT id FROM media_assets WHERE object_key = '${thumbKey}' LIMIT 1;`);
        if (!thumbId) {
          thumbId = runPsql(`INSERT INTO media_assets (user_id, file_name, file_type, mime_type, size_bytes, sha256, storage_type, object_key) VALUES ('${SUPERADMIN_ID}', '${slug}.jpg', 'IMAGE', 'image/jpeg', ${jpgSize}, '${jpgSha}', 'LOCAL', '${thumbKey}') RETURNING id;`);
        } else {
          runPsql(`UPDATE media_assets SET size_bytes = ${jpgSize}, sha256 = '${jpgSha}' WHERE id = '${thumbId}';`);
        }

        runPsql(`UPDATE visual_presets SET preview_asset_id = '${vidId}', thumbnail_asset_id = '${thumbId}', updated_at = NOW() WHERE slug = '${slug}';`);
      }

      okCount++;
      renderedInSession++;
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`[${i + 1}/${slugs.length}] OK ${slug} (${archetype}, ${durationInFrames}f) -> mp4=${mp4Size}B jpg=${jpgSize}B in ${dt}s`);
    }
  } finally {
    await puppeteerInstance.close({ silent: true });
    server.close();
  }

  const totalMin = ((Date.now() - tStartAll) / 60000).toFixed(2);
  console.log(`[remotion-88] DONE: ${okCount}/${slugs.length} styles rendered in ${totalMin} min.`);
}

main().catch((err) => {
  console.error('[remotion-88] FATAL:', err);
  process.exit(1);
});
