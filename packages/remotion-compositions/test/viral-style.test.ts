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
import { LAYOUT_COMPONENTS, fitHookFontSize } from '../src/viral-layouts.js';

describe('ViralStyleComp 12-layout visual storytelling engine', () => {
  it('registers all 12 distinct category visual layouts', () => {
    expect(ALL_VISUAL_LAYOUTS).toHaveLength(12);
    for (const id of ALL_VISUAL_LAYOUTS) {
      expect(typeof LAYOUT_COMPONENTS[id]).toBe('function');
      expect(resolveVisualLayout(id, 'any-slug')).toBe(id);
    }
    expect(Object.keys(ARCHETYPE_PALETTES).length).toBeGreaterThanOrEqual(12);
    expect(resolvePalette('blueprint_blue').id).toBe('blueprint_blue');
  });

  it('infers sensible fallback layout from slug when visualLayout is omitted', () => {
    expect(resolveVisualLayout(undefined, 'news-package')).toBe('news-broadcast');
    expect(resolveVisualLayout(undefined, 'visual-investigation')).toBe('forensic-dossier');
    expect(resolveVisualLayout(undefined, 'whiteboard')).toBe('handdrawn-board');
    expect(resolveVisualLayout(undefined, 'isometrik-dibongkar')).toBe('isometric-cutaway');
    expect(resolveVisualLayout(undefined, 'kartun-cel')).toBe('comic-panel');
    expect(resolveVisualLayout(undefined, 'swiss-motion')).toBe('swiss-editorial');
    expect(resolveVisualLayout(undefined, 'dataviz')).toBe('dataviz-hud');
    expect(resolveVisualLayout(undefined, 'arcade-tarung')).toBe('arcade-game');
    expect(resolveVisualLayout(undefined, 'backrooms')).toBe('cinema-reel');
    expect(resolveVisualLayout(undefined, 'ukiyoe')).toBe('east-asian-scroll');
    expect(resolveVisualLayout(undefined, 'sejarah-3d')).toBe('cinematic-3d');
    expect(resolveVisualLayout(undefined, 'dark-keynote')).toBe('product-keynote');
  });

  it('enforces hookTitle <= 22 chars and scales font size safely without clipping', () => {
    const short = clampHookTitle('KOTA BAWAH TANAH', 'topik', 'judul');
    expect(short).toBe('KOTA BAWAH TANAH');
    expect(short.length).toBeLessThanOrEqual(22);

    const longClamped = clampHookTitle(
      'MISTERI KOTA BAWAH TANAH DERINKUYU YANG TERSEMBUNYI',
      'topik',
      'judul',
    );
    expect(longClamped.length).toBeLessThanOrEqual(22);
    expect(fitHookFontSize(short)).toBeGreaterThanOrEqual(30);
    expect(fitHookFontSize('1234567890123456789012')).toBeLessThanOrEqual(36);
  });

  it('normalizes 4 scene specs and groups karaoke words into clean chunks', () => {
    const scenes = normalizeScenes(
      [
        { label: 'HOOK', metric: '85 M', detail: 'Kota bawah tanah' },
        { label: 'SKALA', metric: '20.000', detail: 'Kapasitas penghuni' },
        { label: 'KLIMAKS', metric: '18 LANTAI', detail: 'Lorong rahasia' },
        { label: 'PENUTUP', metric: '1963', detail: 'Ditemukan tak sengaja' },
      ],
      'Kota Derinkuyu',
      'Sejarah 3D',
    );
    expect(scenes).toHaveLength(4);
    expect(scenes[0].metric).toBe('85 M');

    const words = [
      { text: 'Detak', start: 0, end: 0.3 },
      { text: 'jantung', start: 0.3, end: 0.6 },
      { text: 'melonjak', start: 0.6, end: 1.0 },
      { text: '200', start: 1.0, end: 1.3 },
      { text: 'bpm!', start: 1.3, end: 1.7 },
      { text: 'Tubuh', start: 1.8, end: 2.1 },
    ];
    const chunks = buildSubtitleChunks(words, 4);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].words.length).toBeLessThanOrEqual(4);
  });
});
