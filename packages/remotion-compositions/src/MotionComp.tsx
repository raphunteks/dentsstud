import type { CSSProperties } from 'react';
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { effectAt, valueAt, type Layer, type MotionDocument, type Scene } from '@dentweb/motion-schema';

const TRANSITION = 14;

export type PresetVisualSlug =
  | 'kartun-flat'
  | 'papan-sains'
  | 'sinematik'
  | 'clay'
  | 'retro'
  | 'cat-air'
  | 'pixel'
  | 'komik'
  | 'stickman'
  | 'lowpoly'
  | 'default';

const LIGHT_PRESETS = new Set<PresetVisualSlug>(['clay', 'cat-air', 'komik', 'stickman']);

/** Pure helper: resolve the preset visual DNA slug from explicit slug, name, or palette signature. */
export function resolvePresetSlug(doc: Pick<MotionDocument, 'style' | 'preset'>): PresetVisualSlug {
  const raw = (doc.style?.presetSlug || doc.preset?.slug || doc.style?.presetName || doc.preset?.name || '').toLowerCase();
  if (raw.includes('kartun')) return 'kartun-flat';
  if (raw.includes('sains')) return 'papan-sains';
  if (raw.includes('sinematik')) return 'sinematik';
  if (raw.includes('clay')) return 'clay';
  if (raw.includes('retro') || raw.includes('synthwave')) return 'retro';
  if (raw.includes('cat-air') || raw.includes('cat air')) return 'cat-air';
  if (raw.includes('pixel')) return 'pixel';
  if (raw.includes('komik')) return 'komik';
  if (raw.includes('stickman')) return 'stickman';
  if (raw.includes('lowpoly') || raw.includes('low-poly')) return 'lowpoly';

  const bg = (doc.style?.palette?.background || '').toUpperCase();
  const acc = (doc.style?.palette?.accent || '').toUpperCase();
  if (bg === '#0F1B33') return 'kartun-flat';
  if (bg === '#0B1E2D') return 'papan-sains';
  if (bg === '#08080A') return 'sinematik';
  if (bg === '#F2E8DC') return 'clay';
  if (bg === '#14002B') return 'retro';
  if (bg === '#FBF7EF') return 'cat-air';
  if (bg === '#1A1C2C') return 'pixel';
  if (bg === '#FFFFFF' && acc === '#FFD23F') return 'komik';
  if (bg === '#FFFFFF' && acc === '#FF5A36') return 'stickman';
  if (bg === '#1E3A5F') return 'lowpoly';
  return 'default';
}

/** Pure helper: resolve badge text for HookOverlay and CoverComp without hardcoded branding. */
export function resolveBadgeText(doc: Pick<MotionDocument, 'hook' | 'style' | 'preset'>): string {
  const recipe = doc.hook?.recipe as { badgeText?: unknown } | undefined;
  const fromHook = typeof recipe?.badgeText === 'string' && recipe.badgeText.trim() ? recipe.badgeText.trim() : null;
  return fromHook || doc.style?.presetName?.trim() || doc.preset?.name?.trim() || 'SOROTAN UTAMA';
}

/** Pure helper: format hook text according to HookRecipe.text.case. */
export function formatHookText(text: string, textCase?: string): string {
  if (textCase === 'upper') return text.toUpperCase();
  if (textCase === 'title') {
    return text.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }
  return text;
}

/** Pure helper: compute pixel box inside safeArea container so (0.5, 0.5) centers accurately. */
export function computeLayerBox(
  x: number,
  y: number,
  w: number,
  h: number,
  width: number,
  height: number,
  safeArea: number,
) {
  const pad = Math.max(0, Math.min(0.4, safeArea));
  const innerW = width * (1 - 2 * pad);
  const innerH = height * (1 - 2 * pad);
  return {
    left: (x - w / 2) * innerW,
    top: (y - h / 2) * innerH,
    width: w * innerW,
    height: h * innerH,
    innerW,
    innerH,
  };
}

/**
 * Animated dynamic background with preset visual DNA treatments, responsive width/height
 * particle bounds (works across 9:16, 16:9, 1:1), procedural film grain, and vignette.
 */
function DynamicBackground({
  bg,
  accent,
  secondary,
  sceneIndex,
  presetSlug,
}: {
  bg: string;
  accent: string;
  secondary?: string;
  sceneIndex: number;
  presetSlug: PresetVisualSlug;
}) {
  const rawFrame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isStepped = presetSlug === 'clay' || presetSlug === 'pixel';
  const frame = isStepped ? Math.floor(rawFrame / 2.5) * 2.5 : rawFrame;
  const seed = (Math.floor(frame / 2) + sceneIndex * 17) % 60;
  const pulse = Math.sin(frame / 18) * 0.08 + 0.92;
  const sec = secondary ?? accent;
  const isLight = LIGHT_PRESETS.has(presetSlug);

  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: bg }}>
      {/* 1. Base radial / directional glow */}
      <AbsoluteFill
        style={{
          background:
            presetSlug === 'retro'
              ? `linear-gradient(180deg, ${bg} 0%, ${sec}66 56%, #05000d 100%)`
              : presetSlug === 'cat-air'
                ? `radial-gradient(60% 45% at 22% 24%, ${accent}38 0%, transparent 70%), radial-gradient(55% 45% at 78% 72%, ${sec}34 0%, transparent 70%), ${bg}`
                : presetSlug === 'sinematik'
                  ? `radial-gradient(110% 80% at 25% 15%, ${accent}24 0%, ${bg} 68%)`
                  : `radial-gradient(130% 90% at 50% 25%, ${accent}26 0%, ${bg} 72%)`,
        }}
      />

      {/* 2. Preset-specific visual DNA layer */}
      {presetSlug === 'papan-sains' && (
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(${accent}14 1px, transparent 1px), linear-gradient(90deg, ${accent}14 1px, transparent 1px)`,
            backgroundSize: `${Math.round(Math.min(width, height) * 0.055)}px ${Math.round(Math.min(width, height) * 0.055)}px`,
          }}
        />
      )}

      {presetSlug === 'retro' && (
        <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
          {/* Striped synthwave sun */}
          <circle cx={width * 0.5} cy={height * 0.56} r={Math.min(width, height) * 0.19} fill={accent} opacity={0.32} />
          {[0, 1, 2, 3, 4].map((b) => (
            <rect
              key={b}
              x={width * 0.25}
              y={height * 0.56 - Math.min(width, height) * (0.02 + b * 0.03)}
              width={width * 0.5}
              height={3 + b * 1.5}
              fill={bg}
              opacity={0.7}
            />
          ))}
          {/* Perspective receding grid */}
          {Array.from({ length: 11 }, (_, i) => {
            const xBottom = ((i - 5) / 5) * width * 1.2 + width * 0.5;
            return <line key={`v-${i}`} x1={width * 0.5} y1={height * 0.58} x2={xBottom} y2={height} stroke="#00F0FF" strokeOpacity={0.28} strokeWidth={1.5} />;
          })}
          {Array.from({ length: 12 }, (_, step) => {
            const ratio = Math.pow(((step + ((frame * 0.08) % 1)) / 12), 2.1);
            const yLine = height * 0.58 + (height * 0.42) * ratio;
            return <line key={`h-${step}`} x1={0} y1={yLine} x2={width} y2={yLine} stroke="#00F0FF" strokeOpacity={0.28} strokeWidth={1.5} />;
          })}
        </svg>
      )}

      {presetSlug === 'komik' && (
        <>
          <AbsoluteFill
            style={{
              backgroundImage: `radial-gradient(${sec}22 2px, transparent 2px)`,
              backgroundSize: '18px 18px',
            }}
          />
          <AbsoluteFill style={{ border: '10px solid #111111', margin: '18px', pointerEvents: 'none' }} />
        </>
      )}

      {presetSlug === 'stickman' && (
        <AbsoluteFill
          style={{
            backgroundImage: 'repeating-linear-gradient(180deg, transparent 0px, transparent 41px, rgba(74,144,226,0.14) 41px, rgba(74,144,226,0.14) 42px)',
            borderLeft: `2px solid rgba(230,57,70,0.22)`,
            marginLeft: `${Math.round(width * 0.08)}px`,
          }}
        />
      )}

      {presetSlug === 'pixel' && (
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(${accent}10 2px, transparent 2px), linear-gradient(90deg, ${accent}10 2px, transparent 2px)`,
            backgroundSize: '24px 24px',
            imageRendering: 'pixelated',
          }}
        />
      )}

      {presetSlug === 'lowpoly' && (
        <svg width={width} height={height} style={{ position: 'absolute', inset: 0, opacity: 0.28 }}>
          <polygon points={`0,${height * 0.78} ${width * 0.34},${height * 0.56} ${width * 0.62},${height * 0.78}`} fill={sec} />
          <polygon points={`${width * 0.34},${height * 0.56} ${width * 0.62},${height * 0.78} ${width * 0.48},${height * 0.78}`} fill={accent} opacity={0.5} />
          <polygon points={`${width * 0.42},${height * 0.8} ${width * 0.78},${height * 0.5} ${width},${height * 0.8}`} fill={sec} opacity={0.85} />
          <polygon points={`0,${height * 0.78} ${width},${height * 0.78} ${width},${height} 0,${height}`} fill="#0c1829" opacity={0.55} />
        </svg>
      )}

      {presetSlug === 'kartun-flat' && (
        <svg width={width} height={height} style={{ position: 'absolute', inset: 0, opacity: 0.16 }}>
          {[0, 1, 2].map((i) => {
            const cx = ((width * (0.2 + i * 0.32) + frame * (0.6 + i * 0.2)) % (width + 180)) - 90;
            const cy = height * (0.16 + i * 0.24);
            const r = Math.min(width, height) * (0.07 + i * 0.02);
            return <circle key={i} cx={cx} cy={cy} r={r} fill={i % 2 === 0 ? accent : sec} />;
          })}
        </svg>
      )}

      {presetSlug === 'clay' && (
        <svg width={width} height={height} style={{ position: 'absolute', inset: 0, opacity: 0.22 }}>
          <ellipse cx={width * 0.2} cy={height * 0.22} rx={width * 0.14} ry={width * 0.1} fill={accent} />
          <ellipse cx={width * 0.82} cy={height * 0.78} rx={width * 0.16} ry={width * 0.11} fill={sec} />
        </svg>
      )}

      {presetSlug === 'sinematik' && (
        <svg width={width} height={height} style={{ position: 'absolute', inset: 0, opacity: 0.16 }}>
          <polygon points={`${width * 0.1},0 ${width * 0.35},0 ${width * 0.85},${height} ${width * 0.15},${height}`} fill={accent} />
        </svg>
      )}

      {/* 3. Responsive kinetic bokeh particles (using width/height from useVideoConfig) */}
      {presetSlug !== 'stickman' && presetSlug !== 'komik' && (
        <svg width={width} height={height} style={{ position: 'absolute', inset: 0, opacity: isLight ? 0.18 : 0.25 }}>
          {[1, 2, 3, 4, 5, 6].map((idx) => {
            const cx = ((idx * (width * 0.163) + frame * (idx % 2 ? 0.4 : -0.3)) % width + width) % width;
            const cy = ((idx * (height * 0.15) + Math.sin((frame + idx * 20) / 25) * (height * 0.025)) % height + height) % height;
            const r = (idx % 3 + 1) * (Math.min(width, height) * 0.0035) * pulse;
            return presetSlug === 'pixel' ? (
              <rect key={idx} x={Math.round(cx / 8) * 8} y={Math.round(cy / 8) * 8} width={10} height={10} fill={accent} opacity={0.6} />
            ) : (
              <circle key={idx} cx={cx} cy={cy} r={r} fill={accent} opacity={0.6} />
            );
          })}
        </svg>
      )}

      {/* 4. Subtle default grid when no specialized grid is drawn */}
      {presetSlug === 'default' && (
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(${accent}08 1px, transparent 1px), linear-gradient(90deg, ${accent}08 1px, transparent 1px)`,
            backgroundSize: '80px 80px',
            opacity: 0.6,
          }}
        />
      )}

      {/* 5. Procedural shifting film grain */}
      <AbsoluteFill style={{ opacity: presetSlug === 'sinematik' ? 0.06 : 0.04, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
        <svg width="100%" height="100%">
          <filter id={`grain-${seed}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} />
          </filter>
          <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
        </svg>
      </AbsoluteFill>

      {/* 6. Edge vignette (gentle on light paper presets, richer on dark/sinematik) */}
      <AbsoluteFill
        style={{
          background: isLight
            ? 'radial-gradient(ellipse at center, transparent 65%, rgba(0,0,0,0.12) 100%)'
            : presetSlug === 'sinematik'
              ? 'radial-gradient(ellipse at center, transparent 48%, rgba(0,0,0,0.68) 100%)'
              : 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.52) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
}

/**
 * Kinetic text layer with spring pop, word stagger, typewriter support, background pill,
 * and emphasis highlighting.
 */
function KineticTextLayer({
  text,
  size,
  align,
  color,
  accentColor,
  background,
  fontFamily,
  fontWeight,
  role,
  effect,
  startFrame,
  sceneFrame,
  isLightBg,
}: {
  text: string;
  size: number;
  align: 'center' | 'left' | 'right';
  color: string;
  accentColor: string;
  background?: string;
  fontFamily: string;
  fontWeight: number;
  role?: string;
  effect?: Layer['effect'];
  startFrame: number;
  sceneFrame: number;
  isLightBg: boolean;
}) {
  const { fps } = useVideoConfig();
  const local = Math.max(0, sceneFrame - startFrame);

  // For small badges / labels, render as a sleek modern pill
  if (role === 'label') {
    const s = spring({ frame: local, fps, config: { damping: 12, stiffness: 120 } });
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          borderRadius: '999px',
          background: background ?? `${accentColor}18`,
          border: `1.5px solid ${accentColor}44`,
          color: background ? color : accentColor,
          fontFamily,
          fontWeight: 700,
          fontSize: size,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          transform: `scale(${s}) translateY(${(1 - s) * 12}px)`,
          opacity: Math.min(1, s * 2),
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: accentColor }} />
        {text}
      </div>
    );
  }

  const wrapStyle: CSSProperties = background
    ? {
        background,
        padding: `${Math.round(size * 0.24)}px ${Math.round(size * 0.42)}px`,
        borderRadius: `${Math.round(size * 0.28)}px`,
        boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
      }
    : {};

  // Progressive typewriter reveal
  if (effect === 'typewriter') {
    const typingFrames = Math.max(12, Math.min(48, Math.round(text.length * 1.2)));
    const revealed = Math.max(1, Math.min(text.length, Math.round((local / typingFrames) * text.length)));
    const showCursor = revealed < text.length || Math.floor(local / 8) % 2 === 0;
    return (
      <div
        style={{
          ...wrapStyle,
          textAlign: align,
          fontFamily,
          fontWeight,
          fontSize: size,
          color,
          lineHeight: role === 'title' ? 1.08 : 1.25,
          letterSpacing: role === 'title' ? '-0.02em' : 0,
          textShadow: isLightBg ? '0 2px 8px rgba(0,0,0,0.12)' : '0 6px 20px rgba(0,0,0,0.6)',
        }}
      >
        {text.slice(0, revealed)}
        {showCursor && <span style={{ color: accentColor, marginLeft: 2 }}>|</span>}
      </div>
    );
  }

  const words = text.split(' ');
  return (
    <div
      style={{
        ...wrapStyle,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
        textAlign: align,
        gap: `0 ${size * 0.22}px`,
        lineHeight: role === 'title' ? 1.08 : 1.25,
        letterSpacing: role === 'title' ? '-0.03em' : 0,
        textShadow: isLightBg ? '0 2px 10px rgba(0,0,0,0.12)' : '0 6px 20px rgba(0,0,0,0.6)',
      }}
    >
      {words.map((w, i) => {
        const isEmphasized = w.startsWith('*') || /\d/.test(w) || (role === 'title' && i === 0);
        const s = spring({
          frame: local - i * 3,
          fps,
          config: { damping: 11, stiffness: 100 },
        });
        const clean = w.startsWith('*') ? w.slice(1) : w;

        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              fontFamily,
              fontWeight,
              fontSize: size,
              color: isEmphasized ? accentColor : color,
              transform: `translateY(${(1 - s) * (size * 0.5)}px) scale(${0.85 + 0.15 * s})`,
              opacity: Math.min(1, Math.max(0, s * 1.5)),
            }}
          >
            {clean}
          </span>
        );
      })}
    </div>
  );
}

function LayerView({
  layer,
  doc,
  sceneFrame,
  isLightBg,
}: {
  layer: Layer;
  doc: MotionDocument;
  sceneFrame: number;
  isLightBg: boolean;
}) {
  const { width, height } = useVideoConfig();
  const local = sceneFrame - layer.startFrame;
  if (layer.hidden || local < 0 || (layer.durationFrames && local >= layer.durationFrames)) return null;
  const s = doc.style;
  const fx = effectAt(layer.effect, local, Math.round(18 / Math.max(0.3, s.motion.intensity + 0.5)));
  const x = valueAt(layer, 'x', local);
  const y = valueAt(layer, 'y', local) + fx.dy;
  const sc = valueAt(layer, 'scale', local) * fx.scale;
  const rot = valueAt(layer, 'rotation', local);
  const op = valueAt(layer, 'opacity', local) * fx.opacity;

  const rect = computeLayerBox(x, y, layer.w, layer.h, width, height, s.layout.safeArea);
  const box: CSSProperties = {
    position: 'absolute',
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    transform: `rotate(${rot}deg) scale(${sc})`,
    opacity: op,
    filter: fx.blur ? `blur(${fx.blur}px)` : undefined,
    clipPath: fx.clip < 1 && layer.effect === 'wipe' ? `inset(0 ${(1 - fx.clip) * 100}% 0 0)` : undefined,
  };
  const base = Math.min(rect.innerW, rect.innerH);

  if (layer.type === 'text') {
    const size =
      layer.fontSize ??
      (layer.role === 'title'
        ? base * 0.088 * s.layout.titleScale
        : layer.role === 'caption'
          ? base * 0.042
          : layer.role === 'label'
            ? base * 0.032
            : base * 0.05);
    const align = (layer.align ?? s.layout.textAlign) as 'center' | 'left' | 'right';
    const color = layer.color ?? (layer.role === 'label' ? s.palette.accent : s.palette.ink);
    const fontFamily = `${layer.role === 'title' ? s.typography.display : s.typography.body}, 'Chivo Variable', sans-serif`;
    const fontWeight = layer.fontWeight ?? (layer.role === 'title' ? s.typography.displayWeight : 500);

    return (
      <div
        style={{
          ...box,
          display: 'flex',
          alignItems: 'center',
          justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
        }}
      >
        <KineticTextLayer
          text={layer.text}
          size={size}
          align={align}
          color={color}
          accentColor={s.palette.accent}
          background={layer.background}
          fontFamily={fontFamily}
          fontWeight={fontWeight}
          role={layer.role}
          effect={layer.effect}
          startFrame={layer.startFrame}
          sceneFrame={sceneFrame}
          isLightBg={isLightBg}
        />
      </div>
    );
  }

  if (layer.type === 'shape') {
    return (
      <div
        style={{
          ...box,
          background: layer.shape === 'line' ? undefined : (layer.fill ?? s.palette.accent),
          borderRadius: layer.shape === 'circle' ? '50%' : layer.radius * base * 0.2,
          border: layer.strokeWidth ? `${layer.strokeWidth}px solid ${layer.stroke ?? s.palette.ink}` : undefined,
          borderTop: layer.shape === 'line' ? `${Math.max(3, layer.strokeWidth)}px solid ${layer.stroke ?? s.palette.accent}` : undefined,
          boxShadow: layer.shape === 'line' ? `0 0 12px ${s.palette.accent}88` : undefined,
          height: layer.shape === 'line' ? 0 : box.height,
        }}
      />
    );
  }

  if (!layer.src) return null;
  if (layer.type === 'image') return <Img src={layer.src} style={{ ...box, objectFit: layer.fit }} />;
  return <OffthreadVideo src={layer.src} muted={layer.muted} style={{ ...box, objectFit: layer.fit }} />;
}

function BrandWatermark({ doc }: { doc: MotionDocument }) {
  const { width, height } = useVideoConfig();
  const brand = doc.brand;
  if (!brand?.logoUrl && !brand?.name) return null;
  const pad = doc.style.layout.safeArea;
  const base = Math.min(width, height);
  return (
    <div
      style={{
        position: 'absolute',
        top: `${pad * 100 + 1.5}%`,
        right: `${pad * 100 + 1.5}%`,
        zIndex: 8,
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.round(base * 0.012),
        padding: `${Math.round(base * 0.008)}px ${Math.round(base * 0.018)}px`,
        borderRadius: '999px',
        background: 'rgba(0,0,0,0.36)',
        border: '1px solid rgba(255,255,255,0.18)',
        backdropFilter: 'blur(6px)',
      }}
    >
      {brand.logoUrl && (
        <Img
          src={brand.logoUrl}
          style={{
            height: Math.round(base * 0.036),
            width: 'auto',
            maxWidth: Math.round(base * 0.14),
            objectFit: 'contain',
            borderRadius: 4,
          }}
        />
      )}
      {brand.name && (
        <span
          style={{
            color: '#FFFFFF',
            fontFamily: `${doc.style.typography.body}, 'Chivo Variable', sans-serif`,
            fontSize: Math.round(base * 0.022),
            fontWeight: 700,
            letterSpacing: '0.04em',
            opacity: 0.92,
          }}
        >
          {brand.name}
        </span>
      )}
    </div>
  );
}

function SceneView({
  scene,
  doc,
  isFirst,
  sceneIndex,
  presetSlug,
}: {
  scene: Scene;
  doc: MotionDocument;
  isFirst: boolean;
  sceneIndex: number;
  presetSlug: PresetVisualSlug;
}) {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const t = scene.transition === 'cut' || isFirst ? 1 : interpolate(frame, [0, TRANSITION], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const bg = scene.background ?? doc.style.palette.background;
  const accent = doc.style.palette.accent;
  const secondary = doc.style.palette.secondary;
  const isLightBg = LIGHT_PRESETS.has(presetSlug);

  // Subtle continuous slow drift so the scene is always dynamically alive
  const drift = presetSlug === 'pixel' || presetSlug === 'stickman' ? 1 : 1 + 0.025 * (frame / Math.max(1, scene.durationFrames));

  const style: CSSProperties = {
    transform: `scale(${drift})`,
    transformOrigin: 'center center',
  };
  if (scene.transition === 'fade') style.opacity = t;
  if (scene.transition === 'slide') style.transform = `translateX(${(1 - t) * width}px) scale(${drift})`;
  if (scene.transition === 'zoom') (style.opacity = t), (style.transform = `scale(${(1.12 - 0.12 * t) * drift})`);
  if (scene.transition === 'wipe') style.clipPath = `inset(0 ${(1 - t) * 100}% 0 0)`;
  const pad = doc.style.layout.safeArea;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <DynamicBackground bg={bg} accent={accent} secondary={secondary} sceneIndex={sceneIndex} presetSlug={presetSlug} />

      <AbsoluteFill style={style}>
        <AbsoluteFill style={{ inset: `${pad * 100}%` }}>
          {scene.layers.map((l) => (
            <LayerView key={l.id} layer={l} doc={doc} sceneFrame={frame} isLightBg={isLightBg} />
          ))}
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function HookOverlay({ doc, presetSlug }: { doc: MotionDocument; presetSlug: PresetVisualSlug }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const h = doc.hook;
  if (!h) return null;

  const r = h.recipe as {
    durationSec?: number;
    style?: string;
    badgeText?: string;
    text?: { case?: string };
    animation?: { in?: string; emphasis?: string };
    palette?: { ink?: string; accent?: string; background?: string };
  };
  const len = Math.round((r.durationSec ?? 2) * fps);
  if (frame >= len) return null;

  const inT = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  const outT = interpolate(frame, [Math.max(1, len - 8), len], [1, 0], { extrapolateLeft: 'clamp' });
  const pal = {
    ink: r.palette?.ink ?? doc.style.palette.ink,
    accent: r.palette?.accent ?? doc.style.palette.accent,
    bg: r.palette?.background ?? doc.style.palette.background,
  };
  const s = spring({ frame, fps, config: { damping: 9, stiffness: 130 } });
  const badgeText = resolveBadgeText(doc);
  const formattedText = formatHookText(h.text, r.text?.case);

  const animIn = r.animation?.in ?? 'pop';
  const emphasis = r.animation?.emphasis ?? 'underline';
  const hookStyle = r.style ?? 'custom';

  const base = Math.min(width, height);
  let transform = `scale(${0.8 + 0.2 * s})`;
  let clipPath: string | undefined;
  let visibleText = formattedText;

  if (animIn === 'slide') {
    transform = `translateY(${(1 - s) * 60}px)`;
  } else if (animIn === 'scale') {
    transform = `scale(${1.25 - 0.25 * s})`;
  } else if (animIn === 'mask') {
    transform = 'none';
    clipPath = `inset(0 ${(1 - inT) * 100}% 0 0)`;
  } else if (animIn === 'type') {
    transform = 'none';
    const chars = Math.max(1, Math.min(formattedText.length, Math.round(inT * formattedText.length)));
    visibleText = formattedText.slice(0, chars);
  }

  if (emphasis === 'shake' && frame > 8) {
    transform += ` translateX(${Math.sin(frame * 1.8) * 5}px)`;
  } else if (emphasis === 'pulse' && frame > 8) {
    transform += ` scale(${1 + Math.sin(frame / 4) * 0.03})`;
  }

  const cardStyle: CSSProperties =
    hookStyle === 'glass'
      ? {
          background: 'rgba(255,255,255,0.08)',
          border: `1.5px solid ${pal.accent}55`,
          borderRadius: 28,
          padding: '6% 7%',
          backdropFilter: 'blur(12px)',
        }
      : hookStyle === 'komik'
        ? {
            background: '#FFFDF5',
            border: '6px solid #111111',
            borderRadius: 16,
            padding: '5% 6%',
            boxShadow: `10px 10px 0 ${pal.accent}`,
          }
        : {};

  const textColor = hookStyle === 'komik' ? '#111111' : pal.ink;

  return (
    <AbsoluteFill style={{ background: pal.bg, alignItems: 'center', justifyContent: 'center', opacity: outT, zIndex: 10 }}>
      <DynamicBackground bg={pal.bg} accent={pal.accent} secondary={doc.style.palette.secondary} sceneIndex={99} presetSlug={presetSlug} />
      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '0 8%', maxWidth: '92%', ...cardStyle }}>
        <div
          style={{
            display: 'inline-block',
            marginBottom: '16px',
            padding: '6px 18px',
            borderRadius: hookStyle === 'komik' ? '8px' : '999px',
            background: hookStyle === 'neon' ? `${pal.accent}33` : `${pal.accent}22`,
            border: hookStyle === 'komik' ? '3px solid #111111' : `1.5px solid ${pal.accent}55`,
            color: hookStyle === 'komik' ? '#111111' : pal.accent,
            fontSize: base * 0.032,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            boxShadow: hookStyle === 'neon' ? `0 0 28px ${pal.accent}99` : `0 0 20px ${pal.accent}44`,
          }}
        >
          {badgeText}
        </div>
        <div
          style={{
            fontFamily: `${doc.style.typography.display}, 'Chivo Variable', sans-serif`,
            fontWeight: hookStyle === 'bold' ? 900 : 800,
            fontSize: base * (hookStyle === 'bold' ? 0.105 : 0.095),
            color: textColor,
            transform,
            clipPath,
            opacity: inT,
            lineHeight: 1.06,
            textShadow: hookStyle === 'neon' ? `0 0 24px ${pal.accent}` : hookStyle === 'komik' ? 'none' : '0 8px 30px rgba(0,0,0,0.7)',
          }}
        >
          {visibleText}
          {(emphasis === 'underline' || hookStyle === 'bongkar') && (
            <div
              style={{
                height: base * 0.012,
                background: pal.accent,
                width: `${Math.min(100, inT * 100)}%`,
                margin: '0.4em auto 0',
                borderRadius: '999px',
                boxShadow: `0 0 15px ${pal.accent}`,
              }}
            />
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function MotionComp({ doc }: { doc: MotionDocument }) {
  const presetSlug = resolvePresetSlug(doc);
  let from = 0;
  return (
    <AbsoluteFill style={{ background: doc.style.palette.background }}>
      {doc.scenes.map((s, i) => {
        const start = from;
        from += s.durationFrames;
        const overlap = i === 0 || s.transition === 'cut' ? 0 : Math.min(TRANSITION, s.durationFrames - 1);
        return (
          <Sequence key={s.id} from={start - overlap} durationInFrames={s.durationFrames + overlap} name={s.name || s.id}>
            <SceneView scene={s} doc={doc} isFirst={i === 0} sceneIndex={i} presetSlug={presetSlug} />
          </Sequence>
        );
      })}
      {doc.audio.map((a) =>
        a.src ? (
          <Sequence key={a.id} from={a.startFrame} durationInFrames={a.durationFrames} layout="none">
            <Audio src={a.src} volume={a.volume} />
          </Sequence>
        ) : null,
      )}
      <BrandWatermark doc={doc} />
      <HookOverlay doc={doc} presetSlug={presetSlug} />
    </AbsoluteFill>
  );
}

/** Cover: the first scene's title on the style ground, with the accent rule and dynamic badge. */
export function CoverComp({ doc, coverTitle }: { doc: MotionDocument; coverTitle?: string }) {
  const { width, height } = useVideoConfig();
  const title = coverTitle ?? doc.title;
  const s = doc.style;
  const presetSlug = resolvePresetSlug(doc);
  const badgeText = resolveBadgeText(doc);
  const isLight = LIGHT_PRESETS.has(presetSlug);

  return (
    <AbsoluteFill style={{ background: s.palette.background, overflow: 'hidden' }}>
      <DynamicBackground bg={s.palette.background} accent={s.palette.accent} secondary={s.palette.secondary} sceneIndex={0} presetSlug={presetSlug} />
      <BrandWatermark doc={doc} />
      <AbsoluteFill style={{ padding: `${s.layout.safeArea * 100 + 4}%`, justifyContent: 'flex-end', zIndex: 2 }}>
        <div
          style={{
            display: 'inline-block',
            marginBottom: '16px',
            padding: '6px 16px',
            borderRadius: '999px',
            background: `${s.palette.accent}22`,
            border: `1.5px solid ${s.palette.accent}55`,
            color: s.palette.accent,
            fontSize: Math.min(width, height) * 0.035,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            alignSelf: 'flex-start',
          }}
        >
          {badgeText}
        </div>
        <div
          style={{
            width: '22%',
            height: Math.min(width, height) * 0.016,
            background: s.palette.accent,
            marginBottom: '4%',
            borderRadius: '999px',
            boxShadow: `0 0 16px ${s.palette.accent}`,
          }}
        />
        <div
          style={{
            fontFamily: `${s.typography.display}, 'Chivo Variable', sans-serif`,
            fontWeight: s.typography.displayWeight,
            color: s.palette.ink,
            fontSize: Math.min(width, height) * 0.095,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            textShadow: isLight ? '0 3px 12px rgba(0,0,0,0.15)' : '0 8px 30px rgba(0,0,0,0.8)',
          }}
        >
          {title}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
