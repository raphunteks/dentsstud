import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, useCurrentFrame, useVideoConfig } from 'remotion';
import { LAYOUT_COMPONENTS } from './viral-layouts';

export interface ViralWord {
  text: string;
  start: number;
  end: number;
}

export interface ViralSceneSpec {
  label: string;
  metric: string;
  detail: string;
}

export type VisualLayoutId =
  | 'news-broadcast'
  | 'forensic-dossier'
  | 'handdrawn-board'
  | 'isometric-cutaway'
  | 'comic-panel'
  | 'swiss-editorial'
  | 'dataviz-hud'
  | 'arcade-game'
  | 'cinema-reel'
  | 'east-asian-scroll'
  | 'cinematic-3d'
  | 'product-keynote';

export const ALL_VISUAL_LAYOUTS: readonly VisualLayoutId[] = [
  'news-broadcast',
  'forensic-dossier',
  'handdrawn-board',
  'isometric-cutaway',
  'comic-panel',
  'swiss-editorial',
  'dataviz-hud',
  'arcade-game',
  'cinema-reel',
  'east-asian-scroll',
  'cinematic-3d',
  'product-keynote',
] as const;

export interface ViralStyleProps {
  slug: string;
  title: string;
  topic: string;
  archetype: string;
  visualLayout?: VisualLayoutId;
  hookTitle?: string;
  scenes?: ViralSceneSpec[];
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
    subtitleShadow: '0 2px 10px rgba(255,250,240,0.98), 0 0 3px rgba(255,255,255,1)',
    fontDisplay: 'Georgia, "Times New Roman", serif',
    fontBody: '"Chivo Variable", "Chivo", system-ui, sans-serif',
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
    subtitleShadow: '0 3px 12px rgba(0,0,0,0.88), 0 1px 3px rgba(0,0,0,0.95)',
    fontDisplay: '"Chivo Variable", "Chivo", system-ui, sans-serif',
    fontBody: '"Chivo Variable", "Chivo", system-ui, sans-serif',
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
    subtitleShadow: '0 3px 14px rgba(2,12,27,0.95), 0 1px 3px rgba(0,0,0,0.95)',
    fontDisplay: '"Chivo Variable", "Chivo", system-ui, sans-serif',
    fontBody: '"Chivo Variable", "Chivo", system-ui, sans-serif',
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
    subtitleShadow: '0 3px 0 #0f172a, 0 5px 14px rgba(15,23,42,0.9), -1px -1px 0 #0f172a, 1px -1px 0 #0f172a',
    fontDisplay: '"Chivo Variable", "Chivo", system-ui, sans-serif',
    fontBody: '"Chivo Variable", "Chivo", system-ui, sans-serif',
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
    subtitleShadow: '0 3px 14px rgba(0,0,0,0.95), 0 1px 4px rgba(0,0,0,0.98)',
    fontDisplay: 'Georgia, "Times New Roman", serif',
    fontBody: '"Chivo Variable", "Chivo", system-ui, sans-serif',
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
    subtitleShadow: '0 3px 14px rgba(25,16,38,0.95), 0 1px 3px rgba(0,0,0,0.95)',
    fontDisplay: 'Georgia, "Times New Roman", serif',
    fontBody: '"Chivo Variable", "Chivo", system-ui, sans-serif',
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
  },
};

export function resolvePalette(archetype: string): ArchetypePalette {
  return ARCHETYPE_PALETTES[archetype] ?? ARCHETYPE_PALETTES.gold_sepia;
}

export function resolveVisualLayout(visualLayout?: string, slug = ''): VisualLayoutId {
  if (visualLayout && (ALL_VISUAL_LAYOUTS as readonly string[]).includes(visualLayout)) {
    return visualLayout as VisualLayoutId;
  }
  const s = slug.toLowerCase();
  if (/(news|caption|telestrator|briefing)/.test(s)) return 'news-broadcast';
  if (/(investigation|dossier|archive|spy|mesin-ketik)/.test(s)) return 'forensic-dossier';
  if (/(whiteboard|chalkboard|watercolor|sketch|crayon|one-line|woodcut|engraving)/.test(s)) return 'handdrawn-board';
  if (/(isomet|blueprint|teardown|potongan|white-model|circuit)/.test(s)) return 'isometric-cutaway';
  if (/(kartun|anime|toon|rubber-hose|memphis|brick|dunia-2d)/.test(s)) return 'comic-panel';
  if (/(swiss|poster|risograph|silkscreen|cetak-blok|papercut|art-deco)/.test(s)) return 'swiss-editorial';
  if (/(dataviz|data-physical|hologram|lidar|transit|microscope|countdown|pictogram)/.test(s)) return 'dataviz-hud';
  if (/(arcade|pixel|rpg|game-show|microgame|hd-2d|ascii)/.test(s)) return 'arcade-game';
  if (/(film|kino|backrooms|polaroid|dagerotipe|city-symphony|printed-long-take|tilt-shift)/.test(s)) return 'cinema-reel';
  if (/(ukiyoe|gongbi|ink-wash|lantern|shadow-puppet|teater-kertas|paper-popup)/.test(s)) return 'east-asian-scroll';
  if (/(sejarah|peta|satellite|mosaik|manuskrip|stained|scrimshaw|lowpoly|gotik)/.test(s)) return 'cinematic-3d';
  return 'product-keynote';
}

function cleanText(s: string): string {
  return s.replace(/[*_`#[\]]/g, '').replace(/\s+/g, ' ').trim();
}

export function clampHookTitle(hookTitle: string | undefined, topic: string, title: string): string {
  const raw = cleanText(hookTitle || topic || title).toUpperCase();
  if (raw.length <= 22) return raw;
  const words = raw.split(' ');
  let out = '';
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > 22) break;
    out = next;
  }
  return out || raw.slice(0, 22).trim();
}

export function normalizeScenes(
  scenes: ViralSceneSpec[] | undefined,
  topic: string,
  title: string,
): ViralSceneSpec[] {
  if (Array.isArray(scenes) && scenes.length >= 4) {
    return scenes.slice(0, 4).map((s) => ({
      label: cleanText(s.label || 'SOROTAN').slice(0, 24),
      metric: cleanText(s.metric || '100%').slice(0, 18),
      detail: cleanText(s.detail || topic).slice(0, 64),
    }));
  }
  const cleanTopic = cleanText(topic || title);
  const cleanTitle = cleanText(title.replace(/\s*\([^)]*\)\s*/g, ' '));
  return [
    { label: 'PEMBUKA', metric: '01', detail: cleanTopic.slice(0, 56) },
    { label: 'SKALA FAKTA', metric: '100%', detail: cleanTitle.slice(0, 56) },
    { label: 'KLIMAKS', metric: 'KRITIS', detail: cleanTopic.slice(0, 56) },
    { label: 'KESIMPULAN', metric: 'TERBUKTI', detail: cleanTopic.slice(0, 56) },
  ];
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

/** Determine whether the bottom subtitle strip sits on a light background for a given layout. */
function isLightBottomArea(layout: VisualLayoutId, palette: ArchetypePalette): boolean {
  if (layout === 'swiss-editorial') return true;
  if (layout === 'comic-panel') return true;
  if (layout === 'handdrawn-board') return palette.id !== 'chalkboard';
  if (layout === 'east-asian-scroll') return palette.isLight;
  return false;
}

export const ViralStyleComp: React.FC<ViralStyleProps> = ({
  slug,
  title,
  topic,
  archetype,
  visualLayout,
  hookTitle,
  scenes,
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
  const layoutId = useMemo(() => resolveVisualLayout(visualLayout, slug), [visualLayout, slug]);
  const safeHook = useMemo(() => clampHookTitle(hookTitle, topic, title), [hookTitle, topic, title]);
  const cleanKicker = useMemo(
    () => cleanText(title.replace(/\s*\([^)]*\)\s*/g, ' ')).slice(0, 26).toUpperCase(),
    [title],
  );
  const normalizedScenes = useMemo(() => normalizeScenes(scenes, topic, title), [scenes, topic, title]);
  const chunks = useMemo(() => buildSubtitleChunks(words, 4), [words]);

  const sceneIdx = progress < 0.25 ? 0 : progress < 0.55 ? 1 : progress < 0.82 ? 2 : 3;
  const activeScene = normalizedScenes[sceneIdx] ?? normalizedScenes[0];
  const LayoutComponent = LAYOUT_COMPONENTS[layoutId];

  const activeChunk = useMemo(() => {
    if (!chunks.length) return null;
    const found = chunks.find((c) => currentTimeSec >= c.start - 0.08 && currentTimeSec <= c.end + 0.32);
    if (found) return found;
    for (let i = chunks.length - 1; i >= 0; i--) {
      if (currentTimeSec >= chunks[i].start) return chunks[i];
    }
    return chunks[0];
  }, [chunks, currentTimeSec]);

  const lightBottom = isLightBottomArea(layoutId, palette);
  const subColor = lightBottom ? '#0f172a' : '#ffffff';
  const subActive = lightBottom ? '#dc2626' : palette.subtitleActive;
  const subShadow = lightBottom
    ? '0 2px 8px rgba(255,255,255,0.98), 0 0 3px rgba(255,255,255,1)'
    : '0 3px 14px rgba(0,0,0,0.95), 0 1px 4px rgba(0,0,0,0.98)';
  const wmColor = lightBottom ? '#0f172a' : '#ffffff';

  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.skyTop,
        fontFamily: palette.fontBody,
        overflow: 'hidden',
      }}
    >
      {audioUrl ? <Audio src={audioUrl} /> : null}

      {/* 12 Category-Specific Visual Layout Engine */}
      <LayoutComponent
        slug={slug}
        hookTitle={safeHook}
        kicker={cleanKicker}
        topic={topic}
        palette={palette}
        scene={activeScene}
        scenes={normalizedScenes}
        sceneIdx={sceneIdx}
        frame={frame}
        fps={fps}
        progress={progress}
      />

      {/* Clean Karaoke Subtitle (NO black box behind text, crisp shadow + accent highlight) */}
      {activeChunk && (
        <div
          style={{
            position: 'absolute',
            left: 38,
            right: 38,
            bottom: 96,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '6px 12px',
            textAlign: 'center',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {activeChunk.words.map((w, idx) => {
            const isActive = currentTimeSec >= w.start - 0.05 && currentTimeSec <= w.end + 0.08;
            return (
              <span
                key={`${w.text}-${idx}`}
                style={{
                  fontSize: 36,
                  fontWeight: 900,
                  lineHeight: 1.22,
                  color: isActive ? subActive : subColor,
                  textShadow: subShadow,
                  transform: isActive ? 'scale(1.06)' : 'scale(1)',
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
          zIndex: 10,
        }}
      >
        <svg width="20" height="14" viewBox="0 0 24 16">
          <path
            d="M 2 12 L 7 4 L 12 12 L 17 4 L 22 12"
            fill="none"
            stroke={wmColor}
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
            color: wmColor,
            textShadow: lightBottom ? 'none' : '0 1px 4px rgba(0,0,0,0.85)',
          }}
        >
          DENTSWEB MOTION
        </span>
      </div>
    </AbsoluteFill>
  );
};
