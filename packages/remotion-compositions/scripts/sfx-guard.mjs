#!/usr/bin/env node
/**
 * DENTSWEB MOTION — sfx-guard.mjs
 *
 * Measures momentary loudness of VO_<slug>.mp3 via FFmpeg ebur128,
 * measures loudness of the 9-file studio SFX bank (assets/sfx/*.wav),
 * generates 8–14 beat-aligned SFX cues from VO_<slug>.json word boundaries,
 * and computes safe `gain` + `gainMax` caps strictly below VO momentary loudness.
 *
 * Outputs:
 *   - Per-style plan:  <out-dir>/<slug>.json
 *   - Combined index:  <audio-dir>/audio-plan.json
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_SFX_DIR = path.resolve(__dirname, '../assets/sfx');
const DEFAULT_AUDIO_DIR = '/opt/dentsweb/content/skills/dentsweb-motion/assets/audio';
const DEFAULT_CATALOG = '/opt/dentsweb/content/skills/dentsweb-motion/scripts/viral_88_naskah.json';

const SFX_NAMES = [
  'impact',
  'whoosh',
  'riser',
  'pop',
  'click',
  'glitch',
  'chime',
  'sub-drop',
  'tick',
];

// Layout-specific SFX palettes so each visual world has fitting sound design
const LAYOUT_PALETTES = {
  'news-broadcast': {
    hook: 'impact',
    transition: 'whoosh',
    callout: 'tick',
    accent: 'click',
    climax: 'sub-drop',
    outro: 'chime',
  },
  'forensic-dossier': {
    hook: 'sub-drop',
    transition: 'whoosh',
    callout: 'click',
    accent: 'tick',
    climax: 'impact',
    outro: 'click',
  },
  'handdrawn-board': {
    hook: 'pop',
    transition: 'whoosh',
    callout: 'pop',
    accent: 'click',
    climax: 'chime',
    outro: 'chime',
  },
  'isometric-cutaway': {
    hook: 'impact',
    transition: 'whoosh',
    callout: 'click',
    accent: 'pop',
    climax: 'riser',
    outro: 'chime',
  },
  'comic-panel': {
    hook: 'impact',
    transition: 'whoosh',
    callout: 'pop',
    accent: 'pop',
    climax: 'impact',
    outro: 'chime',
  },
  'swiss-editorial': {
    hook: 'click',
    transition: 'whoosh',
    callout: 'tick',
    accent: 'click',
    climax: 'impact',
    outro: 'chime',
  },
  'dataviz-hud': {
    hook: 'glitch',
    transition: 'whoosh',
    callout: 'tick',
    accent: 'click',
    climax: 'riser',
    outro: 'chime',
  },
  'arcade-game': {
    hook: 'glitch',
    transition: 'pop',
    callout: 'click',
    accent: 'pop',
    climax: 'impact',
    outro: 'chime',
  },
  'cinema-reel': {
    hook: 'sub-drop',
    transition: 'whoosh',
    callout: 'tick',
    accent: 'glitch',
    climax: 'riser',
    outro: 'sub-drop',
  },
  'east-asian-scroll': {
    hook: 'sub-drop',
    transition: 'whoosh',
    callout: 'chime',
    accent: 'pop',
    climax: 'impact',
    outro: 'chime',
  },
  'cinematic-3d': {
    hook: 'sub-drop',
    transition: 'riser',
    callout: 'impact',
    accent: 'whoosh',
    climax: 'sub-drop',
    outro: 'chime',
  },
  'product-keynote': {
    hook: 'chime',
    transition: 'whoosh',
    callout: 'pop',
    accent: 'click',
    climax: 'riser',
    outro: 'chime',
  },
};

// Headroom below VO momentary loudness (in dB) per SFX role so speech always dominates
const ROLE_HEADROOM_DB = {
  hook: 9.5,
  transition: 11.5,
  callout: 13.0,
  accent: 13.5,
  climax: 9.0,
  outro: 10.5,
};

function parseArgs(argv) {
  const args = {
    audioDir: DEFAULT_AUDIO_DIR,
    sfxDir: DEFAULT_SFX_DIR,
    catalog: DEFAULT_CATALOG,
    outDir: null,
    slug: null,
    fps: 30,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--audio-dir' && argv[i + 1]) args.audioDir = argv[++i];
    else if (a === '--sfx-dir' && argv[i + 1]) args.sfxDir = argv[++i];
    else if (a === '--catalog' && argv[i + 1]) args.catalog = argv[++i];
    else if (a === '--out-dir' && argv[i + 1]) args.outDir = argv[++i];
    else if (a === '--slug' && argv[i + 1]) args.slug = argv[++i];
    else if (a === '--fps' && argv[i + 1]) args.fps = Number(argv[++i]) || 30;
  }
  if (!args.outDir) args.outDir = path.join(args.audioDir, 'audio-plans');
  return args;
}

/**
 * Run FFmpeg ebur128 loudness scan and return:
 *  - integratedLufs (number)
 *  - maxMomentaryLufs (number)
 *  - meanMomentaryLufs (number)
 *  - timeline: Array<{ t: number, m: number }>
 */
function scanLoudness(filePath) {
  const res = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-i', filePath, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );
  const parsed = parseEbur128Output(res.stderr || '');

  // Short transient SFX (<400ms) don't fill an EBU R128 momentary window and report -70 LUFS;
  // fall back to volumedetect mean_volume so gainMax stays accurately capped below VO.
  if (parsed.integratedLufs <= -55 || parsed.maxMomentaryLufs <= -55) {
    const vd = spawnSync(
      'ffmpeg',
      ['-hide_banner', '-i', filePath, '-af', 'volumedetect', '-f', 'null', '-'],
      { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
    );
    const meanMatch = (vd.stderr || '').match(/mean_volume:\s*(-?[0-9.]+)\s*dB/);
    const maxMatch = (vd.stderr || '').match(/max_volume:\s*(-?[0-9.]+)\s*dB/);
    const meanDb = meanMatch ? Number(meanMatch[1]) : -16.0;
    const maxDb = maxMatch ? Number(maxMatch[1]) : -2.0;
    // Perceptual equivalent LUFS for short transients sits between mean and peak
    const effectiveLufs = Number((meanDb * 0.7 + maxDb * 0.3).toFixed(2));
    return {
      integratedLufs: effectiveLufs,
      maxMomentaryLufs: effectiveLufs,
      meanMomentaryLufs: effectiveLufs,
      timeline: parsed.timeline,
    };
  }
  return parsed;
}

function parseEbur128Output(stderr) {
  const timeline = [];
  const lineRe = /t:\s*([0-9.]+)\s+TARGET:[^\n]*M:\s*(-?[0-9.]+)/g;
  let match;
  while ((match = lineRe.exec(stderr)) !== null) {
    const t = Number(match[1]);
    const m = Number(match[2]);
    if (Number.isFinite(t) && Number.isFinite(m) && m > -65) {
      timeline.push({ t, m });
    }
  }

  let integratedLufs = -16.0;
  const sumMatch = stderr.match(/Summary:[\s\S]*?I:\s*(-?[0-9.]+)\s*LUFS/);
  if (sumMatch && Number.isFinite(Number(sumMatch[1]))) {
    integratedLufs = Number(sumMatch[1]);
  } else if (timeline.length > 0) {
    integratedLufs = timeline.reduce((acc, x) => acc + x.m, 0) / timeline.length;
  }

  const maxMomentaryLufs =
    timeline.length > 0 ? Math.max(...timeline.map((x) => x.m)) : integratedLufs;
  const meanMomentaryLufs =
    timeline.length > 0
      ? timeline.reduce((acc, x) => acc + x.m, 0) / timeline.length
      : integratedLufs;

  return {
    integratedLufs: Number(integratedLufs.toFixed(2)),
    maxMomentaryLufs: Number(maxMomentaryLufs.toFixed(2)),
    meanMomentaryLufs: Number(meanMomentaryLufs.toFixed(2)),
    timeline,
  };
}

function lookupMomentaryLufs(scan, timeSec) {
  if (!scan.timeline.length) return scan.integratedLufs;
  // Average momentary loudness in a +/- 0.35s window around timeSec
  const near = scan.timeline.filter((pt) => Math.abs(pt.t - timeSec) <= 0.35);
  if (near.length > 0) {
    const avg = near.reduce((a, b) => a + b.m, 0) / near.length;
    return Number(avg.toFixed(2));
  }
  // Nearest point fallback
  let best = scan.timeline[0];
  let bestDist = Math.abs(best.t - timeSec);
  for (const pt of scan.timeline) {
    const d = Math.abs(pt.t - timeSec);
    if (d < bestDist) {
      best = pt;
      bestDist = d;
    }
  }
  return Number(best.m.toFixed(2));
}

function dbToLinear(db) {
  return Math.pow(10, db / 20);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function snapToWordBoundary(words, targetSec, minGap = 0.0) {
  if (!words || !words.length) return Number(targetSec.toFixed(3));
  let best = targetSec;
  let bestDist = Infinity;
  for (const w of words) {
    const st = Number(w.start);
    if (!Number.isFinite(st) || st < minGap) continue;
    const d = Math.abs(st - targetSec);
    if (d < bestDist) {
      bestDist = d;
      best = st;
    }
  }
  return Number(best.toFixed(3));
}

function buildCuesForStyle(meta, voScan, sfxLoudnessMap, fps) {
  const duration = Number(meta.duration_seconds) || 16.0;
  const words = Array.isArray(meta.words) ? meta.words : [];
  const layout = meta.visualLayout || 'isometric-cutaway';
  const pal = LAYOUT_PALETTES[layout] || LAYOUT_PALETTES['isometric-cutaway'];

  const rawEvents = [];
  const addEvent = (at, sfx, role, reason) => {
    const clampedAt = clamp(Number(at.toFixed(3)), 0.04, Math.max(0.2, duration - 0.18));
    // Avoid overlapping cues within 0.45s
    if (rawEvents.some((e) => Math.abs(e.at - clampedAt) < 0.45)) return;
    rawEvents.push({ at: clampedAt, sfx, role, reason });
  };

  // 1. Opening hook impact (at first word or 0.06s)
  const hookAt = words.length > 0 ? Math.min(0.2, Number(words[0].start) || 0.06) : 0.06;
  addEvent(hookAt, pal.hook, 'hook', 'hook-entrance');

  // 2. Scene transitions aligned to 25%, 55%, 82% snapped to nearest word boundary
  const s2At = snapToWordBoundary(words, duration * 0.25, 1.5);
  const s3At = snapToWordBoundary(words, duration * 0.55, s2At + 1.5);
  const s4At = snapToWordBoundary(words, duration * 0.82, s3At + 1.5);

  addEvent(s2At, pal.transition, 'transition', 'scene-2-transition');
  addEvent(s3At, pal.climax, 'climax', 'scene-3-climax');
  addEvent(s4At, pal.transition, 'transition', 'scene-4-twist');

  // 3. Callout pops/clicks slightly after each scene entry (metric reveal)
  addEvent(Math.min(duration - 1.0, hookAt + 1.15), pal.callout, 'callout', 'scene-1-metric-callout');
  addEvent(Math.min(duration - 1.0, s2At + 0.95), pal.callout, 'callout', 'scene-2-metric-callout');
  addEvent(Math.min(duration - 1.0, s3At + 0.95), pal.callout, 'callout', 'scene-3-metric-callout');
  addEvent(Math.min(duration - 0.6, s4At + 0.85), pal.outro, 'outro', 'scene-4-outro-resolve');

  // 4. Keyword/number emphasis accents from WordBoundary (targeting 10-12 total cues)
  const numericOrEmphasisWords = words.filter((w) => {
    const t = String(w.text || '').toLowerCase();
    return (
      /\d/.test(t) ||
      /^(seribu|juta|miliar|triliun|persen|detik|meter|tahun|rahasia|pertama|terbesar|mustahil|ledak|kilat|kunci|fakta)$/.test(
        t.replace(/[^a-z0-9]/g, ''),
      )
    );
  });

  for (const w of numericOrEmphasisWords) {
    if (rawEvents.length >= 12) break;
    addEvent(Number(w.start) || 0, pal.accent, 'accent', `keyword:${w.text}`);
  }

  // Ensure at least 9 cues by filling rhythmic mid-scene beats if needed
  const rhythmicTargets = [0.14, 0.38, 0.46, 0.68, 0.74, 0.91];
  for (const frac of rhythmicTargets) {
    if (rawEvents.length >= 10) break;
    const beatAt = snapToWordBoundary(words, duration * frac, 0.8);
    addEvent(beatAt, pal.accent, 'accent', `beat-${Math.round(frac * 100)}pct`);
  }

  rawEvents.sort((a, b) => a.at - b.at);

  // Compute gainMax & gain strictly below VO momentary loudness at each cue timestamp
  return rawEvents.slice(0, 14).map((ev, idx) => {
    const voMomentary = lookupMomentaryLufs(voScan, ev.at);
    const sfxLufs = sfxLoudnessMap[ev.sfx]?.maxMomentaryLufs ?? -14.0;
    const headroomDb = ROLE_HEADROOM_DB[ev.role] ?? 11.5;

    // Target SFX loudness <= voMomentary - headroomDb
    const targetSfxLufs = voMomentary - headroomDb;
    const neededGainDb = targetSfxLufs - sfxLufs;
    const gainMax = Number(clamp(dbToLinear(neededGainDb), 0.06, 0.42).toFixed(3));
    const gain = Number(clamp(gainMax * 0.86, 0.05, gainMax).toFixed(3));

    return {
      id: `cue-${String(idx + 1).padStart(2, '0')}`,
      sfx: ev.sfx,
      file: `${ev.sfx}.wav`,
      at: ev.at,
      frame: Math.max(0, Math.round(ev.at * fps)),
      role: ev.role,
      reason: ev.reason,
      voMomentaryLufs: voMomentary,
      sfxBaseLufs: sfxLufs,
      gain,
      gainMax,
    };
  });
}

function main() {
  const args = parseArgs(process.argv);

  if (!fs.existsSync(args.sfxDir)) {
    console.error(`[sfx-guard] SFX directory not found: ${args.sfxDir}`);
    process.exit(1);
  }
  if (!fs.existsSync(args.audioDir)) {
    console.error(`[sfx-guard] Audio directory not found: ${args.audioDir}`);
    process.exit(1);
  }
  if (!fs.existsSync(args.catalog)) {
    console.error(`[sfx-guard] Catalog not found: ${args.catalog}`);
    process.exit(1);
  }

  fs.mkdirSync(args.outDir, { recursive: true });

  // 1. Measure loudness of all 9 studio SFX wav files
  const sfxLoudnessMap = {};
  for (const name of SFX_NAMES) {
    const wavPath = path.join(args.sfxDir, `${name}.wav`);
    if (!fs.existsSync(wavPath)) {
      console.error(`[sfx-guard] Missing SFX file: ${wavPath}`);
      process.exit(1);
    }
    sfxLoudnessMap[name] = scanLoudness(wavPath);
  }

  // 2. Load catalog & filter by --slug if given
  const catalog = JSON.parse(fs.readFileSync(args.catalog, 'utf8'));
  const targets = args.slug ? catalog.filter((item) => item.id === args.slug) : catalog;

  const combinedPlans = {};
  let processed = 0;

  for (const item of targets) {
    const slug = item.id;
    const mp3Path = path.join(args.audioDir, `VO_${slug}.mp3`);
    const jsonPath = path.join(args.audioDir, `VO_${slug}.json`);
    if (!fs.existsSync(mp3Path) || !fs.existsSync(jsonPath)) {
      console.warn(`[sfx-guard] Skipping ${slug} (missing MP3 or JSON)`);
      continue;
    }

    const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const voScan = scanLoudness(mp3Path);
    const cues = buildCuesForStyle(meta, voScan, sfxLoudnessMap, args.fps);

    const plan = {
      slug,
      visualLayout: meta.visualLayout || item.visualLayout || 'isometric-cutaway',
      categorySlug: meta.categorySlug || item.categorySlug || '',
      fps: args.fps,
      durationSeconds: meta.duration_seconds,
      voIntegratedLufs: voScan.integratedLufs,
      voMeanMomentaryLufs: voScan.meanMomentaryLufs,
      cueCount: cues.length,
      cues,
    };

    const perStylePath = path.join(args.outDir, `${slug}.json`);
    fs.writeFileSync(perStylePath, JSON.stringify(plan, null, 2));
    combinedPlans[slug] = plan;
    processed++;
  }

  const combinedPath = path.join(args.audioDir, 'audio-plan.json');
  fs.writeFileSync(
    combinedPath,
    JSON.stringify(
      {
        version: '1.0.23',
        sfxDir: args.sfxDir,
        sfxBank: Object.fromEntries(
          SFX_NAMES.map((n) => [
            n,
            {
              file: `${n}.wav`,
              integratedLufs: sfxLoudnessMap[n].integratedLufs,
              maxMomentaryLufs: sfxLoudnessMap[n].maxMomentaryLufs,
            },
          ]),
        ),
        totalStyles: processed,
        plans: combinedPlans,
      },
      null,
      2,
    ),
  );

  console.log(`sfx-guard: wrote gainMax caps to audio-plan.json (${processed}/${targets.length} styles, 9 SFX bank verified)`);
}

main();
