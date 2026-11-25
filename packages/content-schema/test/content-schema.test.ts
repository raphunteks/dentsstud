import { describe, expect, it } from 'vitest';
import { HookRecipe, PresetManifest, PresetRecipe, checkFileType, safeRelPath } from '../src/index.js';
import { PRESETS_DATA, buildPresetVersionPayload } from '../../database/seeds/seed-presets.js';

describe('@dentweb/content-schema', () => {
  it('validates all 10 official presets from seed-presets against PresetManifest & PresetRecipe', () => {
    expect(PRESETS_DATA).toHaveLength(10);
    for (const item of PRESETS_DATA) {
      const { manifest, recipe } = buildPresetVersionPayload(item);
      const parsedManifest = PresetManifest.parse(manifest);
      const parsedRecipe = PresetRecipe.parse(recipe);
      expect(parsedManifest.slug).toBe(item.slug);
      expect(parsedRecipe.motion.easing).toBe(item.motion.easing);
      expect(parsedRecipe.motion.transition).toBe(item.motion.transition);
      expect(parsedRecipe.palette.background).toBe(item.palette.background);
    }
  });

  it('parses HookRecipe with optional badgeText and defaults', () => {
    const parsed = HookRecipe.parse({
      durationSec: 2.5,
      style: 'neon',
      badgeText: 'FAKTA GIGI',
      text: { maxWords: 6, case: 'upper' },
      animation: { in: 'slide', emphasis: 'pulse' },
    });
    expect(parsed.badgeText).toBe('FAKTA GIGI');
    expect(parsed.style).toBe('neon');
    expect(parsed.text.case).toBe('upper');
  });

  it('rejects unsafe relative paths and unsupported file types', () => {
    expect(safeRelPath('../secret.json')).toBeNull();
    expect(safeRelPath('/etc/passwd')).toBeNull();
    expect(safeRelPath('.DS_Store')).toBeNull();
    expect(safeRelPath('assets/preview.mp4')).toBe('assets/preview.mp4');

    const badPng = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    expect(checkFileType('thumb.png', badPng, 1024)).toContain('Isi file tidak sesuai');
    expect(checkFileType('script.js', badPng, 100)).toContain('Tipe file tidak didukung');
  });
});
