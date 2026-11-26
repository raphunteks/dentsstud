import { describe, expect, it } from 'vitest';
import {
  ARCHETYPE_PALETTES,
  buildSubtitleChunks,
  extractViralFacts,
  resolveHeroSubject,
  resolvePalette,
} from '../src/ViralStyleComp.js';

describe('ViralStyleComp visual storytelling helpers', () => {
  it('provides 12 distinct calibrated archetype palettes', () => {
    expect(Object.keys(ARCHETYPE_PALETTES).length).toBeGreaterThanOrEqual(12);
    expect(resolvePalette('blueprint_blue').texture).toBe('blueprint');
    expect(resolvePalette('unknown_style').id).toBe('gold_sepia');
  });

  it('maps slugs and topics to diverse hero illustrations', () => {
    expect(resolveHeroSubject('isometrik-dibongkar', 'Chip Neuralink')).toBe('chip');
    expect(resolveHeroSubject('sejarah-3d', 'Kota Bawah Tanah Derinkuyu')).toBe('monument');
    expect(resolveHeroSubject('tubuh-anime', 'Efek Minum Energy Drink')).toBe('anatomy');
    expect(resolveHeroSubject('peta-relief', 'Palung Mariana 11.000 Meter')).toBe('ocean');
    expect(resolveHeroSubject('kartun-cel', 'Gaji Baru Masuk 5 Menit')).toBe('economy');
  });

  it('extracts numeric scale facts and clean callouts without raw markdown', () => {
    const facts = extractViralFacts(
      'Peta Relief Sinematik (Ekspedisi)',
      'Misteri Palung Mariana 11.000 Meter',
      [
        { text: 'Sebelas', start: 0, end: 0.4 },
        { text: 'ribu', start: 0.4, end: 0.8 },
        { text: 'meter', start: 0.8, end: 1.2 },
        { text: 'di', start: 1.2, end: 1.4 },
        { text: 'bawah', start: 1.4, end: 1.8 },
        { text: 'laut.', start: 1.8, end: 2.3 },
      ],
    );
    expect(facts.statPrimary).toBe('11.000');
    expect(facts.statUnit).toBe('METER');
    expect(facts.kicker).not.toContain('(');
    expect(facts.headlineMain).not.toContain('**');
  });

  it('groups karaoke words into natural short chunks', () => {
    const words = [
      { text: 'Detak', start: 0, end: 0.3 },
      { text: 'jantung', start: 0.3, end: 0.6 },
      { text: 'melonjak', start: 0.6, end: 1.0 },
      { text: '200', start: 1.0, end: 1.3 },
      { text: 'bpm!', start: 1.3, end: 1.7 },
      { text: 'Tubuh', start: 1.8, end: 2.1 },
      { text: 'manusia', start: 2.1, end: 2.5 },
    ];
    const chunks = buildSubtitleChunks(words, 4);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].words.length).toBeLessThanOrEqual(4);
    expect(chunks[0].start).toBe(0);
  });
});
