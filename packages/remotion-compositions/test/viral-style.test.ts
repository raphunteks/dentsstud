import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ALL_VISUAL_LAYOUTS,
  ARCHETYPE_PALETTES,
  buildSubtitleChunks,
  clampHookTitle,
  normalizeScenes,
  resolvePalette,
  resolveVisualLayout,
} from '../src/ViralStyleComp.js';
import { BESPOKE_SCENES } from '../src/bespoke-scenes.js';
import { resolveCueStartSec, resolveCueUrl, resolveCueVolume } from '../src/SfxTrack.js';
import { LAYOUT_COMPONENTS, fitHookFontSize } from '../src/viral-layouts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('ViralStyleComp Anti-Slop Bespoke + SfxTrack Engine', () => {
  it('registers all 8 bespoke core recipes and 12 anti-slop gallery layouts', () => {
    const coreSlugs = [
      'isometrik-dibongkar',
      'sejarah-3d',
      'tubuh-anime',
      'dunia-2d',
      'kartun-cel',
      'peta-relief',
      'promo-produk',
      'bikin-dari-nol',
    ];
    for (const slug of coreSlugs) {
      expect(typeof BESPOKE_SCENES[slug]).toBe('function');
    }
    expect(ALL_VISUAL_LAYOUTS).toHaveLength(12);
    for (const id of ALL_VISUAL_LAYOUTS) {
      expect(typeof LAYOUT_COMPONENTS[id]).toBe('function');
      expect(resolveVisualLayout(id, 'any')).toBe(id);
    }
    expect(Object.keys(ARCHETYPE_PALETTES).length).toBeGreaterThanOrEqual(12);
    expect(resolvePalette('blueprint_blue').id).toBe('blueprint_blue');
  });

  it('enforces sfx-guard gainMax volume cap in SfxTrack helpers', () => {
    expect(resolveCueVolume({ gain: 0.4, gainMax: 0.12 })).toBeCloseTo(0.12, 5);
    expect(resolveCueVolume({ gain: 0.08, gainMax: 0.15 })).toBeCloseTo(0.08, 5);
    expect(resolveCueStartSec({ at: 1.25 })).toBe(1.25);
    expect(resolveCueStartSec({ atSec: 2.5 })).toBe(2.5);
    expect(resolveCueUrl({ file: 'impact.wav' }, 'http://127.0.0.1:9999/sfx')).toBe(
      'http://127.0.0.1:9999/sfx/impact.wav',
    );
  });

  it('enforces Anti-Slop Gate G0-G5 (zero banned deck/HUD chrome in layouts & bespoke scenes)', () => {
    const layoutsSrc = fs.readFileSync(path.resolve(__dirname, '../src/viral-layouts.tsx'), 'utf8');
    const bespokeSrc = fs.readFileSync(path.resolve(__dirname, '../src/bespoke-scenes.tsx'), 'utf8');
    const combined = `${layoutsSrc}\n${bespokeSrc}`;
    const bannedChrome = ['LIVE REPORT', 'REC ●', 'ADEGAN 01', 'POW!', 'DEKLASIFIKASI', 'BERKAS #', 'BUKTI 01', 'STAGE 0'];
    for (const token of bannedChrome) {
      expect(combined).not.toContain(token);
    }
  });

  it('enforces hookTitle <= 22 chars and groups karaoke subtitles cleanly', () => {
    const clamped = clampHookTitle('MISTERI KOTA BAWAH TANAH DERINKUYU YANG TERSEMBUNYI', 'topik', 'judul');
    expect(clamped.length).toBeLessThanOrEqual(22);
    expect(fitHookFontSize(clamped)).toBeGreaterThanOrEqual(30);

    const scenes = normalizeScenes(undefined, 'Palung Mariana 11.000 Meter', 'Peta Relief');
    expect(scenes).toHaveLength(4);

    const chunks = buildSubtitleChunks(
      [
        { text: 'Detak', start: 0, end: 0.3 },
        { text: 'jantung', start: 0.3, end: 0.6 },
        { text: '200', start: 0.6, end: 0.9 },
        { text: 'bpm!', start: 0.9, end: 1.3 },
        { text: 'Tubuh', start: 1.4, end: 1.8 },
      ],
      4,
    );
    expect(chunks.length).toBe(2);
  });
});
