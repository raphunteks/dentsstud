import type { CSSProperties } from 'react';
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { effectAt, valueAt, type Layer, type MotionDocument, type Scene } from '@dentweb/motion-schema';

const TRANSITION = 12;

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
    const size = layer.fontSize ?? (layer.role === 'title' ? base * 0.085 * s.layout.titleScale : layer.role === 'caption' ? base * 0.04 : layer.role === 'label' ? base * 0.03 : base * 0.05);
    const text = layer.effect === 'typewriter' ? layer.text.slice(0, Math.ceil(layer.text.length * fx.clip)) : layer.text;
    return (
      <div
        style={{
          ...box,
          display: 'flex',
          alignItems: 'center',
          justifyContent: (layer.align ?? s.layout.textAlign) === 'center' ? 'center' : layer.align === 'right' ? 'flex-end' : 'flex-start',
          textAlign: layer.align ?? s.layout.textAlign,
          color: layer.color ?? (layer.role === 'label' ? s.palette.accent : s.palette.ink),
          fontFamily: `${layer.role === 'title' ? s.typography.display : s.typography.body}, 'Chivo Variable', sans-serif`,
          fontWeight: layer.fontWeight ?? (layer.role === 'title' ? s.typography.displayWeight : 400),
          fontSize: size,
          lineHeight: layer.role === 'title' ? 1.04 : 1.3,
          letterSpacing: layer.role === 'title' ? '-0.03em' : 0,
          background: layer.background,
          padding: layer.background ? size * 0.3 : 0,
          borderRadius: layer.background ? size * 0.25 : 0,
          whiteSpace: 'pre-wrap',
        }}
      >
        {text}
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
          borderTop: layer.shape === 'line' ? `${Math.max(2, layer.strokeWidth)}px solid ${layer.stroke ?? s.palette.accent}` : undefined,
          height: layer.shape === 'line' ? 0 : box.height,
        }}
      />
    );
  }
  if (!layer.src) return null;
  if (layer.type === 'image') return <Img src={layer.src} style={{ ...box, objectFit: layer.fit }} />;
  return <OffthreadVideo src={layer.src} muted={layer.muted} style={{ ...box, objectFit: layer.fit }} />;
}

function SceneView({ scene, doc, isFirst }: { scene: Scene; doc: MotionDocument; isFirst: boolean }) {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const t = scene.transition === 'cut' || isFirst ? 1 : interpolate(frame, [0, TRANSITION], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const style: CSSProperties = { background: scene.background ?? doc.style.palette.background };
  if (scene.transition === 'fade') style.opacity = t;
  if (scene.transition === 'slide') style.transform = `translateX(${(1 - t) * width}px)`;
  if (scene.transition === 'zoom') (style.opacity = t), (style.transform = `scale(${1.1 - 0.1 * t})`);
  if (scene.transition === 'wipe') style.clipPath = `inset(0 ${(1 - t) * 100}% 0 0)`;
  const pad = doc.style.layout.safeArea;
  return (
    <AbsoluteFill style={style}>
      <AbsoluteFill style={{ inset: `${pad * 100}%` }}>
        {scene.layers.map((l) => (
          <LayerView key={l.id} layer={l} doc={doc} sceneFrame={frame} />
        ))}
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
  const inT = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const outT = interpolate(frame, [len - 8, len], [1, 0], { extrapolateLeft: 'clamp' });
  const pal = { ink: r.palette?.ink ?? doc.style.palette.ink, accent: r.palette?.accent ?? doc.style.palette.accent, bg: r.palette?.background ?? doc.style.palette.background };
  const scale = r.animation?.in === 'scale' || r.animation?.in === 'pop' ? 0.85 + 0.15 * inT : 1;
  return (
    <AbsoluteFill style={{ background: pal.bg, alignItems: 'center', justifyContent: 'center', opacity: outT }}>
      <div style={{ fontFamily: `${doc.style.typography.display}, 'Chivo Variable', sans-serif`, fontWeight: 800, fontSize: Math.min(width, height) * 0.1, color: pal.ink, transform: `scale(${scale})`, opacity: inT, textAlign: 'center', padding: '0 8%', lineHeight: 1 }}>
        {h.text}
        <div style={{ height: Math.min(width, height) * 0.012, background: pal.accent, width: `${inT * 100}%`, margin: '0.3em auto 0' }} />
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
            <SceneView scene={s} doc={doc} isFirst={i === 0} />
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
    <AbsoluteFill style={{ background: s.palette.background, padding: `${s.layout.safeArea * 100 + 4}%`, justifyContent: 'flex-end' }}>
      <div style={{ width: '18%', height: Math.min(width, height) * 0.014, background: s.palette.accent, marginBottom: '4%' }} />
      <div style={{ fontFamily: `${s.typography.display}, 'Chivo Variable', sans-serif`, fontWeight: s.typography.displayWeight, color: s.palette.ink, fontSize: Math.min(width, height) * 0.1, lineHeight: 1.02, letterSpacing: '-0.03em' }}>{title}</div>
    </AbsoluteFill>
  );
}
