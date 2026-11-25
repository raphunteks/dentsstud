import { describe, expect, it } from 'vitest';
import { MotionDocument, newDocument } from '@dentweb/motion-schema';
import { computeLayerBox, formatHookText, resolveBadgeText, resolvePresetSlug } from '../src/MotionComp.js';

describe('@dentweb/remotion-compositions helpers', () => {
  it('resolves badgeText dynamically without hardcoded KITA BONGKAR', () => {
    const base = newDocument('9:16', 'Edukasi Enamel');
    expect(resolveBadgeText(base)).toBe('SOROTAN UTAMA');

    const withPreset = MotionDocument.parse({
      ...base,
      style: { ...base.style, presetName: 'Papan Sains' },
    });
    expect(resolveBadgeText(withPreset)).toBe('Papan Sains');

    const withHookBadge = MotionDocument.parse({
      ...withPreset,
      hook: {
        id: '11111111-1111-4111-8111-111111111111',
        version: 1,
        text: 'Kenapa gigi ngilu?',
        recipe: { badgeText: 'MITOS VS FAKTA', durationSec: 2 },
      },
    });
    expect(resolveBadgeText(withHookBadge)).toBe('MITOS VS FAKTA');
  });

  it('formats hook text case accurately', () => {
    expect(formatHookText('kenapa gigi ngilu?', 'upper')).toBe('KENAPA GIGI NGILU?');
    expect(formatHookText('kenapa GIGI ngilu?', 'title')).toBe('Kenapa Gigi Ngilu?');
    expect(formatHookText('Kenapa Gigi?', 'as-is')).toBe('Kenapa Gigi?');
  });

  it('infers all 10 official preset visual DNA slugs from slug or palette', () => {
    const base = newDocument('9:16');
    const slugs = ['kartun-flat', 'papan-sains', 'sinematik', 'clay', 'retro', 'cat-air', 'pixel', 'komik', 'stickman', 'lowpoly'] as const;
    for (const slug of slugs) {
      const doc = MotionDocument.parse({ ...base, style: { ...base.style, presetSlug: slug } });
      expect(resolvePresetSlug(doc)).toBe(slug);
    }

    const byPalette = MotionDocument.parse({
      ...base,
      style: { ...base.style, palette: { ...base.style.palette, background: '#14002B', accent: '#FF006E' } },
    });
    expect(resolvePresetSlug(byPalette)).toBe('retro');
  });

  it('centers layers inside safeArea across 9:16, 16:9, and 1:1 formats', () => {
    const formats = [
      { width: 1080, height: 1920 },
      { width: 1920, height: 1080 },
      { width: 1080, height: 1080 },
    ];
    for (const { width, height } of formats) {
      const pad = 0.08;
      const box = computeLayerBox(0.5, 0.5, 0.8, 0.2, width, height, pad);
      const absCenterX = pad * width + box.left + box.width / 2;
      const absCenterY = pad * height + box.top + box.height / 2;
      expect(absCenterX).toBeCloseTo(width / 2, 5);
      expect(absCenterY).toBeCloseTo(height / 2, 5);
    }
  });
});
