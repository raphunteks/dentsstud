import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export interface ViralWord {
  text: string;
  start: number;
  end: number;
}

export interface ViralStyleProps {
  slug: string;
  title: string;
  topic: string;
  archetype: string;
  words: ViralWord[];
  audioUrl: string;
  durationInFrames: number;
}

export interface ArchetypePalette {
  id: string;
  isLight: boolean;
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  groundTop: string;
  groundBottom: string;
  accent: string;
  accentGlow: string;
  secondary: string;
  ink: string;
  subtitleColor: string;
  subtitleActive: string;
  subtitleShadow: string;
  fontDisplay: string;
  fontBody: string;
  texture: 'paper' | 'chalk' | 'blueprint' | 'halftone' | 'vhs' | 'mosaic' | 'swiss' | 'sepia' | 'twilight' | 'cyber' | 'keynote' | 'whiteboard';
}

export const ARCHETYPE_PALETTES: Record<string, ArchetypePalette> = {
  light_paper: {
    id: 'light_paper',
    isLight: true,
    skyTop: '#f5efe2',
    skyMid: '#ebe0cc',
    skyBottom: '#dfd0b4',
    groundTop: '#c9b491',
    groundBottom: '#a68d65',
    accent: '#b45309',
    accentGlow: '#f59e0b',
    secondary: '#1e3a5f',
    ink: '#1c1917',
    subtitleColor: '#1c1917',
    subtitleActive: '#b45309',
    subtitleShadow: '0 2px 10px rgba(255,250,240,0.95), 0 0 2px rgba(255,255,255,1)',
    fontDisplay: 'Georgia, "Times New Roman", serif',
    fontBody: '"Chivo Variable", "Chivo", system-ui, sans-serif',
    texture: 'paper',
  },
  chalkboard: {
    id: 'chalkboard',
    isLight: false,
    skyTop: '#102b21',
    skyMid: '#183f30',
    skyBottom: '#1f4f3d',
    groundTop: '#133025',
    groundBottom: '#0a1c15',
    accent: '#fde047',
    accentGlow: '#86efac',
    secondary: '#93c5fd',
    ink: '#f8fafc',
    subtitleColor: '#ffffff',
    subtitleActive: '#fde047',
    subtitleShadow: '0 3px 12px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.95)',
    fontDisplay: '"Chivo Variable", "Chivo", system-ui, sans-serif',
    fontBody: '"Chivo Variable", "Chivo", system-ui, sans-serif',
    texture: 'chalk',
  },
  blueprint_blue: {
    id: 'blueprint_blue',
    isLight: false,
    skyTop: '#062040',
    skyMid: '#0b3c6d',
    skyBottom: '#13538e',
    groundTop: '#092d54',
    groundBottom: '#04162b',
    accent: '#38bdf8',
    accentGlow: '#7dd3fc',
    secondary: '#fde047',
    ink: '#f0f9ff',
    subtitleColor: '#ffffff',
    subtitleActive: '#38bdf8',
    subtitleShadow: '0 3px 14px rgba(2,12,27,0.92), 0 1px 3px rgba(0,0,0,0.95)',
    fontDisplay: '"Chivo Variable", "Chivo", system-ui, sans-serif',
    fontBody: '"Chivo Variable", "Chivo", system-ui, sans-serif',
    texture: 'blueprint',
  },
  pop_vibrant: {
    id: 'pop_vibrant',
    isLight: true,
    skyTop: '#fef08a',
    skyMid: '#fde047',
    skyBottom: '#fb923c',
    groundTop: '#f43f5e',
    groundBottom: '#9f1239',
    accent: '#e11d48',
    accentGlow: '#2563eb',
    secondary: '#1d4ed8',
    ink: '#0f172a',
    subtitleColor: '#ffffff',
    subtitleActive: '#fef08a',
    subtitleShadow: '0 3px 0 #0f172a, 0 5px 14px rgba(15,23,42,0.85), -1px -1px 0 #0f172a, 1px -1px 0 #0f172a',
    fontDisplay: '"Chivo Variable", "Chivo", system-ui, sans-serif',
    fontBody: '"Chivo Variable", "Chivo", system-ui, sans-serif',
    texture: 'halftone',
  },
  liminal_vhs: {
    id: 'liminal_vhs',
    isLight: false,
    skyTop: '#856e27',
    skyMid: '#b5973b',
    skyBottom: '#cbb15d',
    groundTop: '#5e4c18',
    groundBottom: '#2b2209',
    accent: '#fef08a',
    accentGlow: '#f59e0b',
    secondary: '#ef4444',
    ink: '#fffbeb',
    subtitleColor: '#fffbeb',
    subtitleActive: '#fde047',
    subtitleShadow: '0 3px 12px rgba(20,14,2,0.95), 0 1px 3px rgba(0,0,0,0.95)',
    fontDisplay: '"Courier New", monospace',
    fontBody: '"Chivo Variable", "Chivo", system-ui, sans-serif',
    texture: 'vhs',
  },
  stained_glass: {
    id: 'stained_glass',
    isLight: false,
    skyTop: '#1b1038',
    skyMid: '#3b1d6e',
    skyBottom: '#6d28d9',
    groundTop: '#2e1065',
    groundBottom: '#0f0720',
    accent: '#fbbf24',
    accentGlow: '#f472b6',
    secondary: '#38bdf8',
    ink: '#fdf4ff',
    subtitleColor: '#ffffff',
    subtitleActive: '#fbbf24',
    subtitleShadow: '0 3px 14px rgba(10,4,24,0.95), 0 1px 3px rgba(0,0,0,0.95)',
    fontDisplay: 'Georgia, "Times New Roman", serif',
    fontBody: '"Chivo Variable", "Chivo", system-ui, sans-serif',
    texture: 'mosaic',
  },
  swiss_red: {
    id: 'swiss_red',
    isLight: false,
    skyTop: '#b91c1c',
    skyMid: '#dc2626',
    skyBottom: '#ef4444',
    groundTop: '#991b1b',
    groundBottom: '#450a0a',
    accent: '#fef08a',
    accentGlow: '#ffffff',
    secondary: '#0f172a',
    ink: '#ffffff',
    subtitleColor: '#ffffff',
    subtitleActive: '#fef08a',
    subtitleShadow: '0 3px 12px rgba(69,10,10,0.92), 0 1px 3px rgba(0,0,0,0.95)',
    fontDisplay: '"Chivo Variable", "Chivo", system-ui, sans-serif',
    fontBody: '"Chivo Variable", "Chivo", system-ui, sans-serif',
    texture: 'swiss',
  },
  gold_sepia: {
    id: 'gold_sepia',
    isLight: false,
    skyTop: '#161b33',
    skyMid: '#6b4c3b',
    skyBottom: '#d99b52',
    groundTop: '#4a3525',
    groundBottom: '#1c1512',
    accent: '#fbbf24',
    accentGlow: '#fef08a',
    secondary: '#38bdf8',
    ink: '#fef3c7',
    subtitleColor: '#ffffff',
    subtitleActive: '#fbbf24',
    subtitleShadow: '0 3px 14px rgba(0,0,0,0.92), 0 1px 4px rgba(0,0,0,0.98)',
    fontDisplay: 'Georgia, "Times New Roman", serif',
    fontBody: '"Chivo Variable", "Chivo", system-ui, sans-serif',
    texture: 'sepia',
  },
  twilight_pastel: {
    id: 'twilight_pastel',
    isLight: false,
    skyTop: '#261b47',
    skyMid: '#7c3a6e',
    skyBottom: '#f48c72',
    groundTop: '#432854',
    groundBottom: '#191026',
    accent: '#fde047',
    accentGlow: '#fbcfe8',
    secondary: '#38bdf8',
    ink: '#fff1f2',
    subtitleColor: '#ffffff',
    subtitleActive: '#fde047',
    subtitleShadow: '0 3px 14px rgba(25,16,38,0.92), 0 1px 3px rgba(0,0,0,0.95)',
    fontDisplay: 'Georgia, "Times New Roman", serif',
    fontBody: '"Chivo Variable", "Chivo", system-ui, sans-serif',
    texture: 'twilight',
  },
  neon_cyber: {
    id: 'neon_cyber',
    isLight: false,
    skyTop: '#030816',
    skyMid: '#0a1f3d',
    skyBottom: '#0e3b5c',
    groundTop: '#071c30',
    groundBottom: '#020612',
    accent: '#22d3ee',
    accentGlow: '#a855f7',
    secondary: '#f43f5e',
    ink: '#ecfeff',
    subtitleColor: '#ffffff',
    subtitleActive: '#22d3ee',
    subtitleShadow: '0 3px 14px rgba(0,0,0,0.95), 0 0 8px rgba(34,211,238,0.45)',
    fontDisplay: '"Chivo Variable", "Chivo", system-ui, sans-serif',
    fontBody: '"Chivo Variable", "Chivo", system-ui, sans-serif',
    texture: 'cyber',
  },
  dark_keynote: {
    id: 'dark_keynote',
    isLight: false,
    skyTop: '#060913',
    skyMid: '#111b2e',
    skyBottom: '#1e2f4d',
    groundTop: '#0d1524',
    groundBottom: '#04060b',
    accent: '#60a5fa',
    accentGlow: '#93c5fd',
    secondary: '#f59e0b',
    ink: '#f8fafc',
    subtitleColor: '#ffffff',
    subtitleActive: '#60a5fa',
    subtitleShadow: '0 3px 14px rgba(0,0,0,0.95), 0 1px 3px rgba(0,0,0,0.98)',
    fontDisplay: '"Chivo Variable", "Chivo", system-ui, sans-serif',
    fontBody: '"Chivo Variable", "Chivo", system-ui, sans-serif',
    texture: 'keynote',
  },
  whiteboard: {
    id: 'whiteboard',
    isLight: true,
    skyTop: '#ffffff',
    skyMid: '#f8fafc',
    skyBottom: '#e2e8f0',
    groundTop: '#cbd5e1',
    groundBottom: '#94a3b8',
    accent: '#0284c7',
    accentGlow: '#f97316',
    secondary: '#e11d48',
    ink: '#0f172a',
    subtitleColor: '#0f172a',
    subtitleActive: '#0284c7',
    subtitleShadow: '0 2px 10px rgba(255,255,255,0.98), 0 0 3px rgba(255,255,255,1)',
    fontDisplay: '"Chivo Variable", "Chivo", system-ui, sans-serif',
    fontBody: '"Chivo Variable", "Chivo", system-ui, sans-serif',
    texture: 'whiteboard',
  },
};

export type HeroSubject =
  | 'chip'
  | 'monument'
  | 'anatomy'
  | 'ocean'
  | 'cosmos'
  | 'city'
  | 'economy'
  | 'character'
  | 'cinema'
  | 'craft'
  | 'product'
  | 'clock';

export function resolvePalette(archetype: string): ArchetypePalette {
  return ARCHETYPE_PALETTES[archetype] ?? ARCHETYPE_PALETTES.gold_sepia;
}

export function resolveHeroSubject(slug: string, topic: string): HeroSubject {
  const hay = `${slug} ${topic}`.toLowerCase();
  if (/(chip|baterai|neuralink|circuit|ascii|crt|komputer|kode|ai|hacker|hologram|teardown|isometrik-dibongkar|screencast|desktop)/.test(hay)) {
    return 'chip';
  }
  if (/(sejarah|piramida|derinkuyu|mercusuar|arsitektur|kuno|romawi|manuskrip|gotik|kuil|candi|monumen|potongan|model|museum)/.test(hay)) {
    return 'monument';
  }
  if (/(tubuh|jantung|otak|dopamin|kopi|energy|mikroskop|biologi|darah|saraf|tidur|overthinking|melatonin|sel|medis)/.test(hay)) {
    return 'anatomy';
  }
  if (/(laut|palung|mariana|bermuda|samudera|kapal|peta|relief|ekspedisi|pulau|gunung|island|scrimshaw|ukiyoe)/.test(hay)) {
    return 'ocean';
  }
  if (/(angkasa|planet|bintang|roket|satelit|fisika|sains|lidar|scifi|quantum|gravitasi|cahaya|matahari|bulan)/.test(hay)) {
    return 'cosmos';
  }
  if (/(gaji|uang|saldo|checkout|diskon|saham|dataviz|ekonomi|bisnis|harga|investasi|data-physical|inflasi|bank)/.test(hay)) {
    return 'economy';
  }
  if (/(kartun|anime|komik|meme|game|arcade|pixel|rpg|rubber-hose|toon|puppet|wayang|crayon|brick|stickman|dunia-2d)/.test(hay)) {
    return 'character';
  }
  if (/(kota|urban|transit|city|gedung|jalan|kereta|lampu|tilt-shift|diorama)/.test(hay)) {
    return 'city';
  }
  if (/(film|spy|detektif|investigasi|news|berita|arsip|vhs|backrooms|silent|dagerotipe|polaroid|dossier|briefing|ketik|kino)/.test(hay)) {
    return 'cinema';
  }
  if (/(cat air|watercolor|kertas|paper|mozaik|stained|woodcut|engraving|sutra|impasto|ink-wash|risograph|silkscreen|lentera|lantern)/.test(hay)) {
    return 'craft';
  }
  if (/(jam|waktu|countdown|detik|menit|tahun|masa depan|pagi|malam)/.test(hay)) {
    return 'clock';
  }
  return 'product';
}

export interface ExtractedFacts {
  kicker: string;
  headlineTop: string;
  headlineMain: string;
  statPrimary: string;
  statUnit: string;
  calloutA: string;
  calloutB: string;
  climaxWord: string;
  closingLine: string;
}

function cleanText(s: string): string {
  return s.replace(/[*_`#[\]]/g, '').replace(/\s+/g, ' ').trim();
}

export function extractViralFacts(title: string, topic: string, words: ViralWord[]): ExtractedFacts {
  const cleanTitle = cleanText(title.replace(/\s*\([^)]*\)\s*/g, ' '));
  const cleanTopic = cleanText(topic);
  const fullScript = words.map((w) => w.text).join(' ');
  const combined = `${cleanTopic} ${fullScript}`;

  // Extract numeric fact (e.g. "11.000 Meter", "200 bpm", "1.024 elektroda", "85 meter", "3 pagi")
  const numMatch = combined.match(
    /(\d[\d.,]*)\s*(meter|m|km|bpm|detik|menit|jam|tahun|persen|%|ribu|juta|miliar|elektroda|lantai|atmosfer|derajat|kali|orang|manusia|rupiah)?/i,
  );
  const writtenNumMatch = fullScript.match(
    /(seribu\s+dua\s+puluh\s+empat|sebelas\s+ribu|dua\s+ratus|delapan\s+puluh\s+lima|dua\s+puluh\s+ribu|tiga\s+puluh\s+ribu|lima\s+menit|jam\s+tiga)/i,
  );

  let statPrimary = '100%';
  let statUnit = 'FAKTA NYATA';
  if (numMatch) {
    statPrimary = numMatch[1];
    statUnit = (numMatch[2] || 'SKALA KUNCI').toUpperCase();
  } else if (writtenNumMatch) {
    const raw = writtenNumMatch[1].toLowerCase();
    if (raw.includes('seribu dua puluh empat')) {
      statPrimary = '1.024';
      statUnit = 'ELEKTRODA';
    } else if (raw.includes('sebelas ribu')) {
      statPrimary = '11.000';
      statUnit = 'METER';
    } else if (raw.includes('dua ratus')) {
      statPrimary = '200';
      statUnit = 'BPM';
    } else if (raw.includes('delapan puluh lima')) {
      statPrimary = '85';
      statUnit = 'METER';
    } else if (raw.includes('dua puluh ribu')) {
      statPrimary = '20.000';
      statUnit = 'MANUSIA';
    } else if (raw.includes('tiga puluh ribu')) {
      statPrimary = '30.000';
      statUnit = 'RUPIAH';
    } else if (raw.includes('lima menit')) {
      statPrimary = '5';
      statUnit = 'MENIT';
    } else if (raw.includes('jam tiga')) {
      statPrimary = '03:00';
      statUnit = 'DINI HARI';
    }
  }

  // Split topic into crisp 2-part cinematic display headline
  const topicWords = cleanTopic.split(' ').filter(Boolean);
  const splitIdx = Math.min(2, Math.max(1, Math.floor(topicWords.length / 3)));
  const headlineTop = topicWords.slice(0, splitIdx).join(' ').toUpperCase() || cleanTitle.toUpperCase();
  const headlineMain =
    topicWords.slice(splitIdx, splitIdx + 5).join(' ').toUpperCase() || cleanTitle.toUpperCase();

  // Extract 2 informative callout labels from topic/script
  const stopWords = new Set([
    'yang', 'dan', 'di', 'ke', 'dari', 'ini', 'itu', 'untuk', 'dengan', 'pada', 'adalah',
    'tidak', 'nggak', 'cuma', 'bisa', 'akan', 'ada', 'dalam', 'kamu', 'kita', 'mereka',
    'tapi', 'atau', 'jika', 'bukan', 'saat', 'sudah', 'lebih', 'seperti', 'sampai', 'baru',
  ]);
  const contentTokens = cleanTopic
    .split(/[\s&/,:-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !stopWords.has(t.toLowerCase()));

  const calloutA =
    contentTokens.slice(0, 2).join(' ') || cleanTitle.split(' ').slice(0, 2).join(' ');
  const calloutB =
    contentTokens.slice(2, 4).join(' ') || `${statPrimary} ${statUnit.toLowerCase()}`;

  // Pick a dramatic climax phrase around 60-75% of the script
  const climaxIdx = Math.floor(words.length * 0.62);
  const climaxSlice = words
    .slice(climaxIdx, climaxIdx + 3)
    .map((w) => cleanText(w.text))
    .join(' ');
  const climaxWord = (climaxSlice || headlineMain).toUpperCase();

  // Pick closing takeaway from last 4-5 words
  const closingSlice = words
    .slice(Math.max(0, words.length - 5))
    .map((w) => cleanText(w.text))
    .join(' ');
  const closingLine = closingSlice || cleanTopic;

  return {
    kicker: cleanTitle.toUpperCase().slice(0, 28),
    headlineTop: headlineTop.slice(0, 24),
    headlineMain: headlineMain.slice(0, 34),
    statPrimary,
    statUnit,
    calloutA: calloutA.slice(0, 22),
    calloutB: calloutB.slice(0, 22),
    climaxWord: climaxWord.slice(0, 26),
    closingLine: closingLine.slice(0, 48),
  };
}

export interface SubtitleChunk {
  words: ViralWord[];
  start: number;
  end: number;
}

export function buildSubtitleChunks(words: ViralWord[], maxPerChunk = 4): SubtitleChunk[] {
  if (!words.length) return [];
  const chunks: SubtitleChunk[] = [];
  let buf: ViralWord[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    buf.push(w);
    const endsSentence = /[.!?,;:]$/.test(w.text);
    const charLen = buf.reduce((acc, x) => acc + x.text.length + 1, 0);
    if (buf.length >= maxPerChunk || endsSentence || charLen >= 26 || i === words.length - 1) {
      chunks.push({
        words: buf,
        start: buf[0].start,
        end: buf[buf.length - 1].end,
      });
      buf = [];
    }
  }
  return chunks;
}

function seededRand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const AtmosphereLayer: React.FC<{
  palette: ArchetypePalette;
  progress: number;
  frame: number;
  sceneIdx: number;
}> = ({ palette, progress, frame, sceneIdx }) => {
  const driftX = Math.sin(frame * 0.015) * 28;
  const horizonY = interpolate(progress, [0, 0.55, 0.82, 1], [62, 58, 52, 66]);
  const underwaterTint = sceneIdx === 3 ? 0.24 : 0;

  return (
    <AbsoluteFill>
      {/* Full-bleed atmospheric sky/world gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, ${palette.skyTop} 0%, ${palette.skyMid} ${horizonY - 12}%, ${palette.skyBottom} ${horizonY}%, ${palette.groundTop} ${horizonY + 1}%, ${palette.groundBottom} 100%)`,
        }}
      />

      {/* Atmospheric radial glow behind hero */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: `${horizonY - 10}%`,
          width: 760,
          height: 760,
          transform: `translate(-50%, -50%) scale(${1 + Math.sin(frame * 0.04) * 0.06})`,
          background: `radial-gradient(circle, ${palette.accentGlow}55 0%, ${palette.accent}22 38%, transparent 72%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Archetype-specific rich texture & world geometry */}
      <svg
        width="720"
        height="1280"
        viewBox="0 0 720 1280"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        {/* Blueprint / Cyber perspective grid on ground plane */}
        {(palette.texture === 'blueprint' || palette.texture === 'cyber' || palette.texture === 'keynote') && (
          <g opacity={palette.texture === 'blueprint' ? 0.34 : 0.24}>
            {Array.from({ length: 14 }).map((_, i) => {
              const x = -220 + i * 90 + (driftX % 90);
              return (
                <line
                  key={`vg-${i}`}
                  x1={360 + (x - 360) * 0.18}
                  y1={(horizonY / 100) * 1280}
                  x2={x}
                  y2={1280}
                  stroke={palette.accent}
                  strokeWidth={1.2}
                />
              );
            })}
            {Array.from({ length: 10 }).map((_, i) => {
              const t = i / 9;
              const y = (horizonY / 100) * 1280 + t * t * (1280 - (horizonY / 100) * 1280);
              return (
                <line
                  key={`hg-${i}`}
                  x1={0}
                  y1={y}
                  x2={720}
                  y2={y}
                  stroke={palette.accent}
                  strokeWidth={1 + t * 0.8}
                />
              );
            })}
          </g>
        )}

        {/* Paper / Whiteboard subtle notebook & organic grain strokes */}
        {(palette.texture === 'paper' || palette.texture === 'whiteboard') && (
          <g opacity={0.18}>
            {Array.from({ length: 18 }).map((_, i) => (
              <line
                key={`pl-${i}`}
                x1={0}
                y1={80 + i * 68}
                x2={720}
                y2={80 + i * 68}
                stroke={palette.accent}
                strokeWidth={1}
                strokeDasharray={palette.texture === 'paper' ? '4 8' : undefined}
              />
            ))}
            <circle cx={610 + driftX * 0.4} cy={220} r={140} fill={palette.accent} opacity={0.12} />
            <circle cx={110 - driftX * 0.4} cy={920} r={180} fill={palette.secondary} opacity={0.1} />
          </g>
        )}

        {/* Pop-art halftone sunburst rays */}
        {palette.texture === 'halftone' && (
          <g opacity={0.22} transform={`translate(360, 580) rotate(${frame * 0.25})`}>
            {Array.from({ length: 12 }).map((_, i) => (
              <polygon
                key={`ray-${i}`}
                points="0,0 -48,-760 48,-760"
                fill={i % 2 === 0 ? '#ffffff' : palette.accent}
                transform={`rotate(${i * 30})`}
              />
            ))}
          </g>
        )}

        {/* Stained-glass geometric rose arcs */}
        {palette.texture === 'mosaic' && (
          <g opacity={0.28}>
            {Array.from({ length: 8 }).map((_, i) => {
              const ang = (i * Math.PI) / 4 + frame * 0.004;
              return (
                <line
                  key={`mg-${i}`}
                  x1={360}
                  y1={560}
                  x2={360 + Math.cos(ang) * 680}
                  y2={560 + Math.sin(ang) * 680}
                  stroke="#fbbf24"
                  strokeWidth={2.5}
                />
              );
            })}
            <circle cx={360} cy={560} r={240} fill="none" stroke="#f472b6" strokeWidth={3} />
            <circle cx={360} cy={560} r={370} fill="none" stroke="#38bdf8" strokeWidth={2} />
          </g>
        )}

        {/* Swiss International diagonal bold bars */}
        {palette.texture === 'swiss' && (
          <g opacity={0.18}>
            <rect x={-120} y={140} width={960} height={64} fill="#ffffff" transform="rotate(-12 360 170)" />
            <rect x={-120} y={960} width={960} height={42} fill="#0f172a" transform="rotate(-12 360 980)" />
            <circle cx={590} cy={310} r={115} fill="none" stroke="#ffffff" strokeWidth={10} />
          </g>
        )}

        {/* Chalkboard subtle dust clouds & grid */}
        {palette.texture === 'chalk' && (
          <g opacity={0.2}>
            {Array.from({ length: 24 }).map((_, i) => (
              <circle
                key={`cd-${i}`}
                cx={seededRand(i + 1) * 720}
                cy={seededRand(i + 50) * 1280}
                r={1.5 + seededRand(i + 99) * 3}
                fill="#ffffff"
              />
            ))}
            <path d="M 40 280 Q 180 220 320 290 T 680 260" fill="none" stroke="#fde047" strokeWidth={2} strokeDasharray="6 6" />
          </g>
        )}

        {/* VHS liminal ceiling perspective & scanlines */}
        {palette.texture === 'vhs' && (
          <g opacity={0.28}>
            {Array.from({ length: 28 }).map((_, i) => (
              <line key={`sl-${i}`} x1={0} y1={i * 46 + (frame % 46)} x2={720} y2={i * 46 + (frame % 46)} stroke="#000000" strokeWidth={2} />
            ))}
            <polygon points="0,0 240,420 480,420 720,0" fill="#fef08a" opacity={0.18} />
          </g>
        )}

        {/* Cinematic soft horizon clouds & water ripples for sepia/twilight/cyber */}
        {(palette.texture === 'sepia' || palette.texture === 'twilight') && (
          <g>
            <ellipse cx={160 + driftX} cy={360} rx={220} ry={44} fill={palette.accentGlow} opacity={0.16} />
            <ellipse cx={560 - driftX * 0.8} cy={430} rx={260} ry={52} fill={palette.skyBottom} opacity={0.24} />
            {Array.from({ length: 9 }).map((_, i) => {
              const y = (horizonY / 100) * 1280 + 26 + i * 44;
              const w = 140 + (i % 3) * 90;
              const x = ((i * 173 + frame * (0.9 + (i % 3) * 0.4)) % 840) - 100;
              return (
                <rect
                  key={`wv-${i}`}
                  x={x}
                  y={y}
                  width={w}
                  height={4}
                  rx={2}
                  fill={palette.accentGlow}
                  opacity={0.24 - i * 0.018}
                />
              );
            })}
          </g>
        )}
      </svg>

      {/* Scene 4 calm atmospheric depth wash */}
      {underwaterTint > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(180deg, ${palette.secondary}38 0%, ${palette.skyTop}66 100%)`,
            opacity: underwaterTint,
            pointerEvents: 'none',
          }}
        />
      )}
    </AbsoluteFill>
  );
};

const HeroIllustration: React.FC<{
  subject: HeroSubject;
  palette: ArchetypePalette;
  frame: number;
  progress: number;
  sceneIdx: number;
}> = ({ subject, palette, frame, progress, sceneIdx }) => {
  const floatY = Math.sin(frame * 0.05) * 10;
  const pulse = 1 + Math.sin(frame * 0.12) * 0.045;
  const rotSlow = frame * 0.4;
  const primaryFill = palette.isLight ? palette.secondary : palette.ink;
  const strokeCol = palette.isLight ? palette.ink : palette.accentGlow;
  const bodyFill = palette.isLight ? '#ffffff' : '#1e293b';

  return (
    <svg
      width="560"
      height="560"
      viewBox="0 0 560 560"
      style={{
        overflow: 'visible',
        transform: `translateY(${floatY}px)`,
      }}
    >
      <defs>
        <linearGradient id="heroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={palette.accentGlow} />
          <stop offset="100%" stopColor={palette.accent} />
        </linearGradient>
        <linearGradient id="towerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={palette.isLight ? '#e2e8f0' : '#f1f5f9'} />
          <stop offset="65%" stopColor={palette.isLight ? '#cbd5e1' : '#94a3b8'} />
          <stop offset="100%" stopColor={palette.isLight ? '#94a3b8' : '#475569'} />
        </linearGradient>
      </defs>

      {subject === 'monument' && (
        <g>
          {/* Radiant beacon light rays */}
          <polygon
            points="280,108 40,26 110,180"
            fill={palette.accentGlow}
            opacity={0.28 + Math.sin(frame * 0.09) * 0.1}
          />
          <polygon
            points="280,108 520,26 450,180"
            fill={palette.accentGlow}
            opacity={0.28 + Math.sin(frame * 0.09) * 0.1}
          />
          {/* Base stone platform */}
          <polygon points="100,455 460,455 495,505 65,505" fill="#475569" stroke={strokeCol} strokeWidth="2" />
          <rect x="138" y="345" width="284" height="112" rx="4" fill="url(#towerGrad)" stroke="#334155" strokeWidth="2" />
          {/* Middle tier */}
          <rect x="180" y="210" width="200" height="136" rx="4" fill="url(#towerGrad)" stroke="#334155" strokeWidth="2" />
          {/* Upper lantern room */}
          <rect x="218" y="128" width="124" height="82" rx="4" fill="url(#towerGrad)" stroke="#334155" strokeWidth="2" />
          <circle cx="280" cy="112" r={34 * pulse} fill={palette.accentGlow} opacity={0.92} />
          <path d="M 232 128 Q 280 56 328 128 Z" fill={palette.accent} stroke={strokeCol} strokeWidth="2.5" />
          {/* Architectural windows */}
          {[0, 1, 2, 3].map((row) =>
            [0, 1, 2].map((col) => (
              <rect
                key={`w-${row}-${col}`}
                x={208 + col * 58}
                y={230 + row * 54}
                width={14}
                height={24}
                rx={7}
                fill={row === 0 && col === 1 ? palette.accentGlow : '#1e293b'}
              />
            )),
          )}
        </g>
      )}

      {subject === 'chip' && (
        <g transform="translate(280,280)">
          {/* Exploded isometric PCB + silicon die layers */}
          {[2, 1, 0].map((layer) => {
            const sep = interpolate(progress, [0, 0.35, 0.7], [36, 68, 48]) * (layer - 1);
            return (
              <g key={`l-${layer}`} transform={`translate(0, ${sep})`}>
                <polygon
                  points="0,-105 185,-15 0,75 -185,-15"
                  fill={layer === 1 ? palette.accent : bodyFill}
                  fillOpacity={layer === 1 ? 0.28 : 0.92}
                  stroke={palette.accentGlow}
                  strokeWidth={layer === 0 ? 3 : 2}
                />
                {layer === 0 && (
                  <>
                    <polygon points="0,-54 96,-8 0,38 -96,-8" fill="url(#heroGrad)" opacity={0.92} />
                    {Array.from({ length: 8 }).map((_, p) => {
                      const px = -120 + p * 34;
                      return (
                        <circle
                          key={`pin-${p}`}
                          cx={px}
                          cy={-15 + Math.sin(p) * 18}
                          r={4.5}
                          fill={palette.accentGlow}
                        />
                      );
                    })}
                  </>
                )}
              </g>
            );
          })}
          {/* Orbiting neural nodes */}
          {Array.from({ length: 6 }).map((_, i) => {
            const a = (i * Math.PI) / 3 + frame * 0.03;
            return (
              <g key={`nd-${i}`}>
                <line x1={0} y1={-10} x2={Math.cos(a) * 210} y2={Math.sin(a) * 120} stroke={palette.accent} strokeWidth={1.6} strokeDasharray="5 5" opacity={0.65} />
                <circle cx={Math.cos(a) * 210} cy={Math.sin(a) * 120} r={9} fill={palette.accentGlow} />
              </g>
            );
          })}
        </g>
      )}

      {subject === 'anatomy' && (
        <g transform="translate(280,275)">
          {/* Glowing bio-aura rings */}
          <circle cx={0} cy={0} r={195 * pulse} fill="none" stroke={palette.accent} strokeWidth={2.5} opacity={0.4} />
          <circle cx={0} cy={0} r={145} fill={palette.accent} opacity={0.14} />
          {/* Stylized geometric heart / neural core */}
          <path
            d="M 0 135 C -140 50 -165 -70 -80 -115 C -30 -140 0 -90 0 -65 C 0 -90 30 -140 80 -115 C 165 -70 140 50 0 135 Z"
            fill="url(#heroGrad)"
            stroke={strokeCol}
            strokeWidth={4}
            transform={`scale(${pulse})`}
          />
          {/* Live ECG / synapse waveform across core */}
          <polyline
            points="-220,10 -120,10 -85,-45 -50,65 -15,-95 25,80 60,-30 95,10 220,10"
            fill="none"
            stroke="#ffffff"
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="600"
            strokeDashoffset={600 - ((frame * 14) % 600)}
          />
        </g>
      )}

      {subject === 'ocean' && (
        <g>
          {/* Sonar depth rings */}
          {[1, 2, 3].map((r) => {
            const rad = ((frame * 3 + r * 75) % 240) + 30;
            return (
              <circle
                key={`sr-${r}`}
                cx={280}
                cy={290}
                r={rad}
                fill="none"
                stroke={palette.accentGlow}
                strokeWidth={2.5}
                opacity={1 - rad / 270}
              />
            );
          })}
          {/* Topographic mountain / trench relief silhouette */}
          <path
            d="M 20 340 L 120 210 L 210 280 L 285 130 L 365 255 L 445 190 L 540 340 L 540 490 L 20 490 Z"
            fill={bodyFill}
            fillOpacity={0.88}
            stroke={palette.accent}
            strokeWidth={3.5}
          />
          {/* Deep sea submersible / vessel */}
          <g transform={`translate(${280 + Math.sin(frame * 0.04) * 35}, ${385 + Math.cos(frame * 0.05) * 12})`}>
            <ellipse cx={0} cy={0} rx={58} ry={22} fill="url(#heroGrad)" stroke={strokeCol} strokeWidth={2.5} />
            <rect x={-16} y={-34} width={28} height={18} rx={5} fill={palette.accent} />
            <polygon points="55,0 165,-38 165,38" fill={palette.accentGlow} opacity={0.28} />
          </g>
        </g>
      )}

      {subject === 'cosmos' && (
        <g transform="translate(280,280)">
          {/* Orbital paths */}
          <ellipse cx={0} cy={0} rx={235} ry={82} fill="none" stroke={palette.accentGlow} strokeWidth={2.5} transform="rotate(-18)" opacity={0.7} />
          <ellipse cx={0} cy={0} rx={180} ry={180} fill="none" stroke={palette.secondary} strokeWidth={1.5} strokeDasharray="8 8" opacity={0.45} />
          {/* Planet sphere */}
          <circle cx={0} cy={0} r={118} fill="url(#heroGrad)" stroke={strokeCol} strokeWidth={3} />
          <path d="M -112 -22 Q 0 26 112 -18" fill="none" stroke="#ffffff" strokeWidth={8} opacity={0.35} />
          <path d="M -98 34 Q 10 68 98 28" fill="none" stroke="#0f172a" strokeWidth={10} opacity={0.25} />
          {/* Orbiting satellite */}
          <g transform={`translate(${Math.cos(frame * 0.045) * 225}, ${Math.sin(frame * 0.045) * 85})`}>
            <circle cx={0} cy={0} r={14} fill="#ffffff" />
            <circle cx={0} cy={0} r={24} fill={palette.accentGlow} opacity={0.35} />
          </g>
        </g>
      )}

      {subject === 'economy' && (
        <g>
          {/* 3D Rising / Dramatic Chart Bars */}
          {[0.38, 0.56, 0.74, 0.94, 0.45].map((h, i) => {
            const animH = h * 310 * Math.min(1, frame / 35 + 0.25);
            const x = 78 + i * 86;
            const y = 445 - animH;
            return (
              <g key={`bar-${i}`}>
                <rect
                  x={x}
                  y={y}
                  width={56}
                  height={animH}
                  rx={8}
                  fill={i === 3 ? 'url(#heroGrad)' : i === 4 ? palette.secondary : primaryFill}
                  opacity={i === 3 ? 1 : 0.85}
                  stroke={strokeCol}
                  strokeWidth={2}
                />
              </g>
            );
          })}
          {/* Kinetic trend arrow */}
          <polyline
            points="95,340 190,275 280,210 365,125 465,260"
            fill="none"
            stroke={palette.accentGlow}
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={365} cy={125} r={15 * pulse} fill={palette.accentGlow} />
        </g>
      )}

      {subject === 'character' && (
        <g transform="translate(280,295)">
          {/* Dynamic comic action starburst behind character */}
          <polygon
            points="0,-210 42,-115 145,-155 95,-60 205,-25 110,35 165,130 58,95 25,195 -32,100 -138,145 -98,42 -205,5 -105,-50 -155,-145 -48,-105"
            fill={palette.accentGlow}
            opacity={0.28}
            transform={`rotate(${rotSlow * 0.5})`}
          />
          {/* Expressive stylized mascot/hero silhouette */}
          <circle cx={0} cy={-82} r={74} fill="url(#heroGrad)" stroke={strokeCol} strokeWidth={5} />
          <circle cx={-24} cy={-90} r={11} fill="#ffffff" />
          <circle cx={24} cy={-90} r={11} fill="#ffffff" />
          <circle cx={-21} cy={-90} r={5} fill="#0f172a" />
          <circle cx={27} cy={-90} r={5} fill="#0f172a" />
          <path d="M -24 -52 Q 0 -30 24 -52" fill="none" stroke="#0f172a" strokeWidth={5} strokeLinecap="round" />
          <rect x={-64} y={2} width={128} height={145} rx={44} fill={bodyFill} stroke={strokeCol} strokeWidth={5} />
          <polygon points="0,18 -24,78 4,78 -12,126 32,62 6,62" fill={palette.accentGlow} />
        </g>
      )}

      {subject === 'city' && (
        <g>
          {/* Multi-layer architectural skyline */}
          {[
            { x: 55, w: 78, h: 240 },
            { x: 145, w: 88, h: 330 },
            { x: 245, w: 98, h: 395 },
            { x: 355, w: 84, h: 300 },
            { x: 450, w: 68, h: 215 },
          ].map((b, i) => (
            <g key={`b-${i}`}>
              <rect
                x={b.x}
                y={475 - b.h}
                width={b.w}
                height={b.h}
                rx={4}
                fill={i === 2 ? 'url(#heroGrad)' : bodyFill}
                stroke={strokeCol}
                strokeWidth={2.5}
              />
              {Array.from({ length: 5 }).map((_, r) => (
                <rect
                  key={`bw-${i}-${r}`}
                  x={b.x + 14}
                  y={475 - b.h + 24 + r * 36}
                  width={b.w - 28}
                  height={14}
                  rx={3}
                  fill={palette.accentGlow}
                  opacity={((frame + i * 7 + r * 3) % 40) < 25 ? 0.85 : 0.25}
                />
              ))}
            </g>
          ))}
        </g>
      )}

      {subject === 'cinema' && (
        <g transform="translate(280,280)">
          {/* Perspective corridor / camera aperture lens */}
          {[220, 165, 115, 70].map((sz, i) => (
            <rect
              key={`cor-${i}`}
              x={-sz}
              y={-sz * 1.15}
              width={sz * 2}
              height={sz * 2.3}
              rx={8}
              fill="none"
              stroke={i % 2 === 0 ? palette.accentGlow : strokeCol}
              strokeWidth={3.5 - i * 0.4}
              opacity={0.85 - i * 0.14}
              transform={`scale(${1 + Math.sin(frame * 0.05 + i) * 0.03})`}
            />
          ))}
          <circle cx={0} cy={0} r={54 * pulse} fill="url(#heroGrad)" opacity={0.9} />
          <polygon points="-14,-22 28,0 -14,22" fill="#ffffff" />
        </g>
      )}

      {subject === 'craft' && (
        <g transform="translate(280,285)">
          {/* Layered paper-cut sun & ukiyo-e / craft waves */}
          <circle cx={0} cy={-65} r={118 * pulse} fill="url(#heroGrad)" />
          <path
            d="M -230 95 Q -130 -40 -20 65 T 230 45 L 230 195 L -230 195 Z"
            fill={palette.secondary}
            stroke={strokeCol}
            strokeWidth={3.5}
          />
          <path
            d="M -230 135 Q -90 35 45 125 T 230 115 L 230 215 L -230 215 Z"
            fill={bodyFill}
            stroke={palette.accentGlow}
            strokeWidth={3}
          />
        </g>
      )}

      {subject === 'clock' && (
        <g transform="translate(280,280)">
          <circle cx={0} cy={0} r={185} fill={bodyFill} fillOpacity={0.85} stroke={palette.accentGlow} strokeWidth={6} />
          <circle cx={0} cy={0} r={155} fill="none" stroke={palette.accent} strokeWidth={2} strokeDasharray="6 10" />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i * Math.PI) / 6;
            return (
              <line
                key={`tk-${i}`}
                x1={Math.cos(a) * 136}
                y1={Math.sin(a) * 136}
                x2={Math.cos(a) * 158}
                y2={Math.sin(a) * 158}
                stroke={palette.ink}
                strokeWidth={i % 3 === 0 ? 6 : 3}
              />
            );
          })}
          <line
            x1={0}
            y1={0}
            x2={Math.cos((frame * 0.02) - Math.PI / 2) * 95}
            y2={Math.sin((frame * 0.02) - Math.PI / 2) * 95}
            stroke={palette.ink}
            strokeWidth={8}
            strokeLinecap="round"
          />
          <line
            x1={0}
            y1={0}
            x2={Math.cos((frame * 0.14) - Math.PI / 2) * 135}
            y2={Math.sin((frame * 0.14) - Math.PI / 2) * 135}
            stroke={palette.accentGlow}
            strokeWidth={5}
            strokeLinecap="round"
          />
          <circle cx={0} cy={0} r={12} fill={palette.accent} />
        </g>
      )}

      {subject === 'product' && (
        <g transform="translate(280,280)">
          {/* Sleek floating glass prism / keynote monolith */}
          <polygon
            points="0,-195 168,-55 112,165 -112,165 -168,-55"
            fill="url(#heroGrad)"
            fillOpacity={0.88}
            stroke={strokeCol}
            strokeWidth={3.5}
            transform={`rotate(${Math.sin(frame * 0.03) * 6})`}
          />
          <polygon
            points="0,-145 115,-35 76,115 -76,115 -115,-35"
            fill="#ffffff"
            fillOpacity={0.22}
            stroke="#ffffff"
            strokeWidth={2}
          />
        </g>
      )}

      {/* Scene 2 Wireframe Scale Comparison Overlay (inspired by 30-story wireframe in reference) */}
      {sceneIdx === 1 && (
        <g opacity={0.85}>
          <rect
            x={365}
            y={95}
            width={150}
            height={365}
            fill="none"
            stroke={palette.accentGlow}
            strokeWidth={2}
            strokeDasharray="6 4"
          />
          {Array.from({ length: 12 }).map((_, floor) => (
            <line
              key={`fl-${floor}`}
              x1={365}
              y1={120 + floor * 29}
              x2={515}
              y2={120 + floor * 29}
              stroke={palette.accentGlow}
              strokeWidth={1}
              opacity={0.55}
            />
          ))}
          {/* Vertical measurement line */}
          <line x1={345} y1={95} x2={345} y2={460} stroke={palette.accent} strokeWidth={2.5} />
          <line x1={335} y1={95} x2={355} y2={95} stroke={palette.accent} strokeWidth={2.5} />
          <line x1={335} y1={460} x2={355} y2={460} stroke={palette.accent} strokeWidth={2.5} />
        </g>
      )}
    </svg>
  );
};

const ClimaxParticles: React.FC<{
  palette: ArchetypePalette;
  frame: number;
  active: boolean;
}> = ({ palette, frame, active }) => {
  if (!active) return null;
  return (
    <svg
      width="720"
      height="1280"
      viewBox="0 0 720 1280"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {Array.from({ length: 28 }).map((_, i) => {
        const angle = seededRand(i + 10) * Math.PI * 2;
        const speed = 1.6 + seededRand(i + 30) * 3.8;
        const dist = ((frame * speed * 2.2) % 380) + 40;
        const cx = 360 + Math.cos(angle) * dist;
        const cy = 540 + Math.sin(angle) * dist - (frame % 90) * 1.4;
        const sz = 10 + seededRand(i + 70) * 20;
        const rot = frame * (2 + (i % 4)) + i * 35;
        return (
          <rect
            key={`pt-${i}`}
            x={cx - sz / 2}
            y={cy - sz / 2}
            width={sz}
            height={sz * 0.72}
            rx={2}
            fill={i % 3 === 0 ? palette.accentGlow : i % 3 === 1 ? palette.accent : '#ffffff'}
            opacity={Math.max(0.15, 0.9 - dist / 430)}
            transform={`rotate(${rot} ${cx} ${cy})`}
          />
        );
      })}
    </svg>
  );
};

export const ViralStyleComp: React.FC<ViralStyleProps> = ({
  slug,
  title,
  topic,
  archetype,
  words,
  audioUrl,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const total = Math.max(1, durationInFrames);
  const progress = Math.min(1, Math.max(0, frame / total));
  const currentTimeSec = frame / fps;

  const palette = useMemo(() => resolvePalette(archetype), [archetype]);
  const subject = useMemo(() => resolveHeroSubject(slug, topic), [slug, topic]);
  const facts = useMemo(() => extractViralFacts(title, topic, words), [title, topic, words]);
  const chunks = useMemo(() => buildSubtitleChunks(words, 4), [words]);

  // 4-scene progression: 0-25% Hook, 25-55% Scale/Breakdown, 55-82% Climax, 82-100% Closing
  const sceneIdx = progress < 0.25 ? 0 : progress < 0.55 ? 1 : progress < 0.82 ? 2 : 3;

  // Smooth spring & cinematic camera motion across the 4 scenes
  const titleSpring = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const cameraScale = interpolate(
    progress,
    [0, 0.25, 0.55, 0.7, 0.82, 1],
    [0.94, 1.04, 1.12, 1.18, 1.0, 0.96],
    { easing: Easing.inOut(Easing.ease) },
  );
  const cameraPanX = interpolate(progress, [0, 0.25, 0.55, 0.82, 1], [0, -24, -42, 14, 0]);
  const climaxShakeX = sceneIdx === 2 ? Math.sin(frame * 1.9) * 5 : 0;
  const climaxShakeY = sceneIdx === 2 ? Math.cos(frame * 2.3) * 4 : 0;

  // Active karaoke subtitle chunk
  const activeChunk = useMemo(() => {
    if (!chunks.length) return null;
    const found = chunks.find((c) => currentTimeSec >= c.start - 0.08 && currentTimeSec <= c.end + 0.32);
    if (found) return found;
    // Fallback to nearest previous chunk if between pauses
    for (let i = chunks.length - 1; i >= 0; i--) {
      if (currentTimeSec >= chunks[i].start) return chunks[i];
    }
    return chunks[0];
  }, [chunks, currentTimeSec]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.skyTop,
        fontFamily: palette.fontBody,
        overflow: 'hidden',
      }}
    >
      {audioUrl ? <Audio src={audioUrl} /> : null}

      {/* Full-Screen Atmospheric World */}
      <AtmosphereLayer palette={palette} progress={progress} frame={frame} sceneIdx={sceneIdx} />

      {/* Animated Center Hero Stage with Camera Pan/Zoom/Shake */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 110,
          transform: `translate(${cameraPanX + climaxShakeX}px, ${climaxShakeY}px) scale(${cameraScale})`,
          transformOrigin: 'center center',
        }}
      >
        <HeroIllustration
          subject={subject}
          palette={palette}
          frame={frame}
          progress={progress}
          sceneIdx={sceneIdx}
        />
      </div>

      {/* Scene 3 Dramatic Burst Particles */}
      <ClimaxParticles palette={palette} frame={frame} active={sceneIdx === 2} />

      {/* Scene 2 Thin Callout Pointers & Scale Metric */}
      {sceneIdx === 1 && (
        <svg
          width="720"
          height="1280"
          viewBox="0 0 720 1280"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          {/* Pointer 1 (upper left -> center) */}
          <circle cx={290} cy={460} r={6} fill={palette.accentGlow} />
          <circle cx={290} cy={460} r={13} fill={palette.accentGlow} opacity={0.3} />
          <polyline
            points="290,460 220,385 95,385"
            fill="none"
            stroke={palette.isLight ? palette.ink : '#ffffff'}
            strokeWidth={2}
          />
          <text
            x={95}
            y={372}
            fill={palette.isLight ? palette.ink : '#ffffff'}
            stroke={palette.isLight ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)'}
            strokeWidth={4}
            paintOrder="stroke"
            fontSize={22}
            fontWeight={700}
          >
            {facts.calloutA}
          </text>

          {/* Pointer 2 (right scale metric) */}
          <circle cx={485} cy={615} r={6} fill={palette.accentGlow} />
          <polyline
            points="485,615 535,565 655,565"
            fill="none"
            stroke={palette.accentGlow}
            strokeWidth={2}
          />
          <text
            x={538}
            y={548}
            fill={palette.accentGlow}
            stroke="rgba(0,0,0,0.85)"
            strokeWidth={5}
            paintOrder="stroke"
            fontSize={44}
            fontWeight={900}
          >
            ±{facts.statPrimary}
          </text>
          <text
            x={538}
            y={590}
            fill={palette.isLight ? palette.ink : '#ffffff'}
            stroke={palette.isLight ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)'}
            strokeWidth={4}
            paintOrder="stroke"
            fontSize={20}
            fontWeight={800}
            letterSpacing={2}
          >
            {facts.statUnit}
          </text>
        </svg>
      )}

      {/* Scene 4 Subtle Underwater/Discovery Callout */}
      {sceneIdx === 3 && (
        <svg
          width="720"
          height="1280"
          viewBox="0 0 720 1280"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          <circle cx={225} cy={705} r={6} fill={palette.accentGlow} />
          <polyline
            points="225,705 280,615 470,615"
            fill="none"
            stroke={palette.isLight ? palette.ink : '#ffffff'}
            strokeWidth={2}
          />
          <text
            x={286}
            y={603}
            fill={palette.isLight ? palette.ink : '#ffffff'}
            stroke={palette.isLight ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)'}
            strokeWidth={4}
            paintOrder="stroke"
            fontSize={22}
            fontWeight={700}
          >
            {facts.calloutB}
          </text>
        </svg>
      )}

      {/* Top Cinematic Title Block (adapts per scene) */}
      <div
        style={{
          position: 'absolute',
          top: 72,
          left: 40,
          right: 40,
          textAlign: 'center',
          transform: `translateY(${interpolate(titleSpring, [0, 1], [-36, 0])}px)`,
          opacity: interpolate(titleSpring, [0, 1], [0, 1]),
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontSize: 19,
            fontWeight: 800,
            letterSpacing: 5,
            color: palette.isLight ? palette.accent : palette.accentGlow,
            textShadow: palette.isLight
              ? '0 1px 6px rgba(255,255,255,0.9)'
              : '0 2px 10px rgba(0,0,0,0.85)',
            marginBottom: 10,
            textTransform: 'uppercase',
          }}
        >
          {sceneIdx === 0
            ? facts.kicker
            : sceneIdx === 1
              ? facts.headlineTop
              : sceneIdx === 2
                ? 'MOMEN KLIMAKS'
                : facts.kicker}
        </div>
        <div
          style={{
            fontFamily: palette.fontDisplay,
            fontSize: sceneIdx === 0 ? 54 : sceneIdx === 1 ? 52 : 46,
            fontWeight: 900,
            lineHeight: 1.06,
            letterSpacing: -0.5,
            color: palette.ink,
            textShadow: palette.isLight
              ? '0 3px 14px rgba(255,255,255,0.92)'
              : '0 6px 24px rgba(0,0,0,0.88), 0 2px 4px rgba(0,0,0,0.95)',
          }}
        >
          {sceneIdx === 0
            ? facts.headlineMain
            : sceneIdx === 1
              ? `${facts.statPrimary} ${facts.statUnit}`
              : sceneIdx === 2
                ? facts.climaxWord
                : facts.closingLine.toUpperCase()}
        </div>
      </div>

      {/* Clean Karaoke Subtitle (NO black box behind text, crisp shadow + accent highlight) */}
      {activeChunk && (
        <div
          style={{
            position: 'absolute',
            left: 38,
            right: 38,
            bottom: 112,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '6px 12px',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          {activeChunk.words.map((w, idx) => {
            const isActive = currentTimeSec >= w.start - 0.05 && currentTimeSec <= w.end + 0.08;
            return (
              <span
                key={`${w.text}-${idx}`}
                style={{
                  fontSize: 38,
                  fontWeight: 900,
                  lineHeight: 1.22,
                  color: isActive ? palette.subtitleActive : palette.subtitleColor,
                  textShadow: palette.subtitleShadow,
                  transform: isActive ? 'scale(1.07)' : 'scale(1)',
                  display: 'inline-block',
                }}
              >
                {w.text}
              </span>
            );
          })}
        </div>
      )}

      {/* Subtle Bottom-Right Watermark: DENTSWEB MOTION */}
      <div
        style={{
          position: 'absolute',
          right: 26,
          bottom: 22,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          opacity: 0.78,
          pointerEvents: 'none',
        }}
      >
        <svg width="20" height="14" viewBox="0 0 24 16">
          <path
            d="M 2 12 L 7 4 L 12 12 L 17 4 L 22 12"
            fill="none"
            stroke={palette.isLight ? palette.ink : '#ffffff'}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 1.4,
            color: palette.isLight ? palette.ink : '#ffffff',
            textShadow: palette.isLight ? 'none' : '0 1px 4px rgba(0,0,0,0.8)',
          }}
        >
          DENTSWEB MOTION
        </span>
      </div>
    </AbsoluteFill>
  );
};
