import { describe, expect, it } from 'vitest';
import {
  buildDentswebMotionSkillZip,
  SEED_EFFECTS,
  SEED_GLOSSARY,
  SEED_LESSONS,
  SEED_MODULES,
  SEED_PROMPTS,
  SEED_RECIPES,
  SEED_UPDATES,
} from '../src/modules/lms/lms-seed.js';

describe('DENTSWEB MOTION LMS Starter Catalog & Skill ZIP', () => {
  it('provides complete DENTSWEB MOTION starter datasets with expected counts and categories', () => {
    expect(SEED_MODULES).toHaveLength(8);
    expect(SEED_LESSONS).toHaveLength(16);
    expect(SEED_PROMPTS).toHaveLength(24);
    expect(new Set(SEED_PROMPTS.map((p) => p.stage)).size).toBe(7);
    expect(SEED_RECIPES).toHaveLength(12);
    expect(SEED_GLOSSARY).toHaveLength(20);
    expect(new Set(SEED_GLOSSARY.map((g) => g.category)).size).toBe(5);
    expect(SEED_EFFECTS).toHaveLength(24);
    expect(new Set(SEED_EFFECTS.map((e) => e.category)).size).toBe(8);
    expect(SEED_UPDATES).toHaveLength(4);

    // Ensure zero legacy brand strings leaked into starter catalog
    const serialized = JSON.stringify({ SEED_MODULES, SEED_LESSONS, SEED_PROMPTS, SEED_RECIPES, SEED_GLOSSARY, SEED_EFFECTS, SEED_UPDATES });
    expect(serialized).not.toMatch(/one[\s-]line[\s-]motion/i);
  });

  it('builds a valid extractable dentsweb-motion-v2.3.0.zip archive', () => {
    const zip = buildDentswebMotionSkillZip();
    expect(Buffer.isBuffer(zip)).toBe(true);
    expect(zip.length).toBeGreaterThan(1000);
    // ZIP local file header magic PK\x03\x04
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
    expect(zip.toString('utf8')).toContain('dentsweb-motion/SKILL.md');
    expect(zip.toString('utf8')).toContain('DENTSWEB MOTION v2.3.0');
  });
});
