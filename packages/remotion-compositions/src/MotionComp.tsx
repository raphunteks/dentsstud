import type { CSSProperties } from 'react';
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { effectAt, valueAt, type Layer, type MotionDocument, type Scene } from '@dentweb/motion-schema';

const TRANSITION = 14;

/**
 * Animated dynamic background with procedural film grain, subtle radial glow,
 * floating ambient particles, and vignette to prevent flat swatch "AI-slop".
 */
function DynamicBackground({ bg, accent, sceneIndex }: { bg: string; accent: string; sceneIndex: number }) {
  const frame = useCurrentFrame();
  const seed = (Math.floor(frame / 2) + sceneIndex * 17) % 60;
  const pulse = Math.sin(frame / 18) * 0.08 + 0.92;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* 1. Deep dynamic radial glow */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(130% 90% at 50% 25%, ${accent}28 0%, ${bg} 70%)`,
        }}
      />

      {/* 2. Floating kinetic bokeh particles (No dead frame) */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.25 }}>
        {[1, 2, 3, 4, 5, 6].map((idx) => {
          const cx = ((idx * 163 + frame * (idx % 2 ? 0.4 : -0.3)) % 1080 + 1080) % 1080;
          const cy = ((idx * 287 + Math.sin((frame + idx * 20) / 25) * 40) % 1920 + 1920) % 1920;
          const r = (idx % 3 + 1) * 3.5 * pulse;
          return <circle key={idx} cx={cx} cy={cy} r={r} fill={accent} opacity={0.6} />;
        })}
      </svg>

      {/* 3. Subtle grid lines */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${accent}08 1px, transparent 1px), linear-gradient(90deg, ${accent}08 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
          opacity: 0.6,
        }}
      />

      {/* 4. Procedural shifting film grain */}
      <AbsoluteFill style={{ opacity: 0.05, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
        <svg width="100%" height="100%">
          <filter id={`grain-${seed}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} />
          </filter>
          <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
        </svg>
      </AbsoluteFill>

      {/* 5. Edge vignette */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
}

/**
 * Kinetic text layer with spring pop, word stagger, and emphasis highlighting.
 */
function KineticTextLayer({
  text,
  size,
  align,
  color,
  accentColor,
  fontFamily,
  fontWeight,
  role,
  startFrame,
  sceneFrame,
}: {
  text: string;
  size: number;
  align: 'center' | 'left' | 'right';
  color: string;
  accentColor: string;
  fontFamily: string;
  fontWeight: number;
  role?: string;
  startFrame: number;
  sceneFrame: number;
}) {
  const { fps } = useVideoConfig();
  const local = sceneFrame - startFrame;
  const words = text.split(' ');

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
          background: `${accentColor}18`,
          border: `1.5px solid ${accentColor}44`,
          color: accentColor,
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

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
        textAlign: align,
        gap: `0 ${size * 0.22}px`,
        lineHeight: role === 'title' ? 1.08 : 1.25,
        letterSpacing: role === 'title' ? '-0.03em' : 0,
        textShadow: `0 6px 20px rgba(0,0,0,0.6)`,
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

function LayerView({ layer, doc, sceneFrame }: { layer: Layer; doc: MotionDocument; sceneFrame: number }) {
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
  const box: CSSProperties = {
    position: 'absolute',
    left: (x - layer.w / 2) * width,
    top: (y - layer.h / 2) * height,
    width: layer.w * width,
    height: layer.h * height,
    transform: `rotate(${rot}deg) scale(${sc})`,
    opacity: op,
    filter: fx.blur ? `blur(${fx.blur}px)` : undefined,
    clipPath: fx.clip < 1 && layer.effect === 'wipe' ? `inset(0 ${(1 - fx.clip) * 100}% 0 0)` : undefined,
  };
  const base = Math.min(width, height);

  if (layer.type === 'text') {
    const size = layer.fontSize ?? (layer.role === 'title' ? base * 0.088 * s.layout.titleScale : layer.role === 'caption' ? base * 0.042 : layer.role === 'label' ? base * 0.032 : base * 0.05);
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
          fontFamily={fontFamily}
          fontWeight={fontWeight}
          role={layer.role}
          startFrame={layer.startFrame}
          sceneFrame={sceneFrame}
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

function SceneView({ scene, doc, isFirst, sceneIndex }: { scene: Scene; doc: MotionDocument; isFirst: boolean; sceneIndex: number }) {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const t = scene.transition === 'cut' || isFirst ? 1 : interpolate(frame, [0, TRANSITION], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const bg = scene.background ?? doc.style.palette.background;
  const accent = doc.style.palette.accent;

  // Subtle continuous slow drift so the scene is always dynamically alive
  const drift = 1 + 0.025 * (frame / Math.max(1, scene.durationFrames));

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
      {/* Dynamic Background with Film Grain and Glow */}
      <DynamicBackground bg={bg} accent={accent} sceneIndex={sceneIndex} />

      <AbsoluteFill style={style}>
        <AbsoluteFill style={{ inset: `${pad * 100}%` }}>
          {scene.layers.map((l) => (
            <LayerView key={l.id} layer={l} doc={doc} sceneFrame={frame} />
          ))}
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function HookOverlay({ doc }: { doc: MotionDocument }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const h = doc.hook;
  if (!h) return null;
  const r = h.recipe as { durationSec?: number; animation?: { in?: string }; palette?: { ink?: string; accent?: string; background?: string } };
  const len = Math.round((r.durationSec ?? 2) * fps);
  if (frame >= len) return null;
  const inT = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  const outT = interpolate(frame, [len - 8, len], [1, 0], { extrapolateLeft: 'clamp' });
  const pal = { ink: r.palette?.ink ?? doc.style.palette.ink, accent: r.palette?.accent ?? doc.style.palette.accent, bg: r.palette?.background ?? doc.style.palette.background };
  const s = spring({ frame, fps, config: { damping: 9, stiffness: 130 } });

  return (
    <AbsoluteFill style={{ background: pal.bg, alignItems: 'center', justifyContent: 'center', opacity: outT, zIndex: 10 }}>
      <DynamicBackground bg={pal.bg} accent={pal.accent} sceneIndex={99} />
      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '0 8%' }}>
        <div
          style={{
            display: 'inline-block',
            marginBottom: '16px',
            padding: '6px 18px',
            borderRadius: '999px',
            background: `${pal.accent}22`,
            border: `1.5px solid ${pal.accent}55`,
            color: pal.accent,
            fontSize: Math.min(width, height) * 0.032,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            boxShadow: `0 0 20px ${pal.accent}44`,
          }}
        >
          KITA BONGKAR
        </div>
        <div
          style={{
            fontFamily: `${doc.style.typography.display}, 'Chivo Variable', sans-serif`,
            fontWeight: 800,
            fontSize: Math.min(width, height) * 0.095,
            color: pal.ink,
            transform: `scale(${0.8 + 0.2 * s})`,
            opacity: inT,
            lineHeight: 1.06,
            textShadow: '0 8px 30px rgba(0,0,0,0.7)',
          }}
        >
          {h.text}
          <div
            style={{
              height: Math.min(width, height) * 0.012,
              background: pal.accent,
              width: `${Math.min(100, inT * 100)}%`,
              margin: '0.4em auto 0',
              borderRadius: '999px',
              boxShadow: `0 0 15px ${pal.accent}`,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function MotionComp({ doc }: { doc: MotionDocument }) {
  let from = 0;
  return (
    <AbsoluteFill style={{ background: doc.style.palette.background }}>
      {doc.scenes.map((s, i) => {
        const start = from;
        from += s.durationFrames;
        const overlap = i === 0 || s.transition === 'cut' ? 0 : Math.min(TRANSITION, s.durationFrames - 1);
        return (
          <Sequence key={s.id} from={start - overlap} durationInFrames={s.durationFrames + overlap} name={s.name || s.id}>
            <SceneView scene={s} doc={doc} isFirst={i === 0} sceneIndex={i} />
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
      <HookOverlay doc={doc} />
    </AbsoluteFill>
  );
}

/** Cover: the first scene's title on the style ground, with the accent rule. */
export function CoverComp({ doc, coverTitle }: { doc: MotionDocument; coverTitle?: string }) {
  const { width, height } = useVideoConfig();
  const title = coverTitle ?? doc.title;
  const s = doc.style;
  return (
    <AbsoluteFill style={{ background: s.palette.background, overflow: 'hidden' }}>
      <DynamicBackground bg={s.palette.background} accent={s.palette.accent} sceneIndex={0} />
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
          KITA BONGKAR
        </div>
        <div style={{ width: '22%', height: Math.min(width, height) * 0.016, background: s.palette.accent, marginBottom: '4%', borderRadius: '999px', boxShadow: `0 0 16px ${s.palette.accent}` }} />
        <div style={{ fontFamily: `${s.typography.display}, 'Chivo Variable', sans-serif`, fontWeight: s.typography.displayWeight, color: s.palette.ink, fontSize: Math.min(width, height) * 0.095, lineHeight: 1.05, letterSpacing: '-0.03em', textShadow: '0 8px 30px rgba(0,0,0,0.8)' }}>
          {title}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
