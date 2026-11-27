import React from 'react';
import { Easing, interpolate, spring } from 'remotion';
import type { ArchetypePalette, ViralSceneSpec, VisualLayoutId } from './ViralStyleComp';

export interface LayoutRenderProps {
  slug: string;
  hookTitle: string;
  kicker: string;
  topic: string;
  palette: ArchetypePalette;
  scene: ViralSceneSpec;
  scenes: ViralSceneSpec[];
  sceneIdx: number;
  frame: number;
  fps: number;
  progress: number;
}

function hashSlug(slug: string): number {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Auto-fit font size so hookTitle (<=22 chars) NEVER clips horizontally at 720px width. */
export function fitHookFontSize(text: string, maxPx = 50, minPx = 30): number {
  const len = text.trim().length;
  if (len <= 12) return maxPx;
  if (len <= 16) return Math.round(maxPx * 0.86);
  if (len <= 20) return Math.round(maxPx * 0.76);
  return Math.max(minPx, Math.round(maxPx * 0.68));
}

/** Shared clean anti-slop typographic header: zero badges, zero borders, pure editorial hierarchy. */
const CleanWorldHeader: React.FC<{
  hookTitle: string;
  metric: string;
  detail: string;
  ink: string;
  accent: string;
  isLight?: boolean;
  serif?: boolean;
  align?: 'center' | 'left';
  frame: number;
  fps: number;
}> = ({ hookTitle, metric, detail, ink, accent, isLight, serif, align = 'center', frame, fps }) => {
  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 120 } });
  const shadow = isLight
    ? '0 2px 12px rgba(255,255,255,0.92)'
    : '0 6px 24px rgba(0,0,0,0.85), 0 2px 6px rgba(0,0,0,0.9)';
  return (
    <div
      style={{
        position: 'absolute',
        top: 76,
        left: 44,
        right: 44,
        textAlign: align,
        transform: `translateY(${interpolate(enter, [0, 1], [-20, 0])}px)`,
        opacity: enter,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          fontFamily: serif ? 'Georgia, "Times New Roman", serif' : '"Chivo Variable", "Chivo", system-ui, sans-serif',
          fontSize: fitHookFontSize(hookTitle, 50, 30),
          fontWeight: 900,
          lineHeight: 1.05,
          letterSpacing: serif ? 0 : -0.8,
          color: ink,
          textShadow: shadow,
          textTransform: 'uppercase',
        }}
      >
        {hookTitle}
      </div>
      <div
        style={{
          marginTop: 14,
          fontSize: 22,
          fontWeight: 700,
          color: accent,
          textShadow: shadow,
        }}
      >
        {metric} · {detail.slice(0, 38)}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 1. NEWS BROADCAST (Dokumenter — Clean Full-Screen Investigative Globe & Signal)
// ---------------------------------------------------------------------------
export const NewsBroadcastLayout: React.FC<LayoutRenderProps> = ({
  hookTitle,
  palette,
  scene,
  frame,
  fps,
}) => {
  const pulseR = ((frame * 3.5) % 210) + 45;
  const sweep = (frame * 1.4) % 360;

  return (
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 52%, ${palette.skyMid} 0%, #091224 58%, #040812 100%)` }}>
      <svg width="720" height="1280" viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0 }}>
        {/* Clean meridian globe & live broadcast signal wave */}
        <g transform="translate(360, 610)">
          <circle cx={0} cy={0} r={220} fill="none" stroke="#38bdf8" strokeOpacity={0.28} strokeWidth={2} />
          <ellipse cx={0} cy={0} rx={125} ry={220} fill="none" stroke="#38bdf8" strokeOpacity={0.22} strokeWidth={1.6} />
          <ellipse cx={0} cy={0} rx={220} ry={84} fill="none" stroke="#38bdf8" strokeOpacity={0.22} strokeWidth={1.6} />
          <circle cx={0} cy={0} r={pulseR} fill="none" stroke="#ef4444" strokeWidth={3} opacity={Math.max(0, 1 - pulseR / 255)} />
          <line
            x1={0}
            y1={0}
            x2={Math.cos((sweep * Math.PI) / 180) * 220}
            y2={Math.sin((sweep * Math.PI) / 180) * 220}
            stroke="#ef4444"
            strokeWidth={2.5}
            opacity={0.75}
          />
          <circle cx={0} cy={0} r={16} fill="#ef4444" />
          {/* Thin surgical callout */}
          <polyline points="80,-65 165,-145 275,-145" fill="none" stroke="#ffffff" strokeWidth={1.8} />
          <text x={170} y={-156} fill="#ffffff" fontSize={18} fontWeight={800}>{scene.label.toUpperCase()}</text>
        </g>
        {/* Clean red editorial accent hairline */}
        <rect x={44} y={248} width={110} height={5} rx={2} fill="#ef4444" />
      </svg>

      <CleanWorldHeader hookTitle={hookTitle} metric={scene.metric} detail={scene.detail} ink="#ffffff" accent="#fca5a5" align="left" frame={frame} fps={fps} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 2. FORENSIC DOSSIER (Film Bukti — Illuminated Lighttable & Connected Nodes)
// ---------------------------------------------------------------------------
export const ForensicDossierLayout: React.FC<LayoutRenderProps> = ({
  slug,
  hookTitle,
  palette,
  scene,
  frame,
  fps,
}) => {
  const seed = hashSlug(slug);
  const drift = Math.sin(frame * 0.04) * 10;
  const nodes = [
    { x: 185, y: 495 + (seed % 30) },
    { x: 525, y: 560 - (seed % 25) },
    { x: 255, y: 765 },
    { x: 485, y: 810 },
  ];

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 48%, #2d241b 0%, #17120d 62%, #0c0907 100%)' }}>
      <svg width="720" height="1280" viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0 }}>
        {/* Illuminated evidence web (pure graphic, zero stamp/badge clutter) */}
        <line x1={nodes[0].x} y1={nodes[0].y} x2={nodes[1].x} y2={nodes[1].y} stroke="#dc2626" strokeWidth={3} opacity={0.85} />
        <line x1={nodes[1].x} y1={nodes[1].y} x2={nodes[2].x} y2={nodes[2].y} stroke="#dc2626" strokeWidth={3} opacity={0.85} />
        <line x1={nodes[2].x} y1={nodes[2].y} x2={nodes[3].x} y2={nodes[3].y} stroke="#f59e0b" strokeWidth={2.2} strokeDasharray="8 6" />
        <line x1={nodes[0].x} y1={nodes[0].y} x2={nodes[2].x} y2={nodes[2].y} stroke="#f59e0b" strokeWidth={1.8} opacity={0.45} />

        {/* Magnifying spotlight lens orbiting center */}
        <g transform={`translate(${360 + drift}, 625)`}>
          <circle cx={0} cy={0} r={130} fill="#fef3c7" fillOpacity={0.08} stroke="#fbbf24" strokeWidth={3.5} />
          <line x1={94} y1={94} x2={175} y2={175} stroke="#fbbf24" strokeWidth={12} strokeLinecap="round" />
          <text x={0} y={14} textAnchor="middle" fill="#fef3c7" fontSize={42} fontWeight={900} fontFamily="Georgia, serif">
            {scene.metric.slice(0, 12)}
          </text>
        </g>

        {nodes.map((n, i) => (
          <g key={`fn-${i}`}>
            <circle cx={n.x} cy={n.y} r={16} fill="#dc2626" opacity={0.25} />
            <circle cx={n.x} cy={n.y} r={7} fill="#ef4444" stroke="#fef3c7" strokeWidth={2} />
          </g>
        ))}
      </svg>

      <CleanWorldHeader hookTitle={hookTitle} metric={scene.label.toUpperCase()} detail={scene.detail} ink="#fef3c7" accent="#fbbf24" serif frame={frame} fps={fps} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 3. HANDDRAWN BOARD (Gambar Tangan — Pure Paper/Chalk Real-Time Ink Drawing)
// ---------------------------------------------------------------------------
export const HanddrawnBoardLayout: React.FC<LayoutRenderProps> = ({
  hookTitle,
  palette,
  scene,
  frame,
  fps,
}) => {
  const isChalk = palette.id === 'chalkboard';
  const bg = isChalk ? 'radial-gradient(circle at 50% 45%, #1e4d3b 0%, #102a20 100%)' : 'linear-gradient(180deg, #faf6ed 0%, #efe6d4 100%)';
  const ink = isChalk ? '#f8fafc' : '#1c1917';
  const strokeDash = Math.max(0, 960 - (frame % 160) * 10);

  return (
    <div style={{ position: 'absolute', inset: 0, background: bg }}>
      <svg width="720" height="1280" viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0 }}>
        {/* Live hand-drawn botanical / explainer ink arc */}
        <g transform="translate(360, 620)">
          <path
            d="M -230 120 C -160 -120, -40 -120, 15 20 C 75 160, 165 110, 230 -115"
            fill="none"
            stroke={isChalk ? '#fde047' : '#b45309'}
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray="960"
            strokeDashoffset={strokeDash}
          />
          <circle cx={-230} cy={120} r={16} fill={isChalk ? '#86efac' : '#0284c7'} stroke={ink} strokeWidth={3.5} />
          <circle cx={15} cy={20} r={24} fill={isChalk ? '#fde047' : '#f97316'} stroke={ink} strokeWidth={3.5} />
          <circle cx={230} cy={-115} r={18} fill="#e11d48" stroke={ink} strokeWidth={3.5} />
          {/* Hand-drawn underline & metric */}
          <text x={0} y={235} textAnchor="middle" fill={ink} fontSize={48} fontWeight={900} fontFamily="Georgia, serif">
            {scene.metric}
          </text>
          <path d="M -130 256 Q 0 244 130 256" fill="none" stroke={isChalk ? '#86efac' : '#e11d48'} strokeWidth={5} strokeLinecap="round" />
        </g>
      </svg>

      <CleanWorldHeader hookTitle={hookTitle} metric={scene.label.toUpperCase()} detail={scene.detail} ink={ink} accent={isChalk ? '#fde047' : '#b45309'} isLight={!isChalk} serif={!isChalk} frame={frame} fps={fps} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 4. ISOMETRIC CUTAWAY (Gaya Studio / 3D — Full-Screen Exploded Layers)
// ---------------------------------------------------------------------------
export const IsometricCutawayLayout: React.FC<LayoutRenderProps> = ({
  hookTitle,
  palette,
  scene,
  sceneIdx,
  frame,
  fps,
  progress,
}) => {
  const explode = interpolate(progress, [0, 0.4, 0.8], [26, 72, 46], { easing: Easing.inOut(Easing.ease) });
  const flowPos = (frame * 5) % 100;

  return (
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 48%, ${palette.skyMid} 0%, #05162c 60%, #020a16 100%)` }}>
      <svg width="720" height="1280" viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0 }}>
        {/* Ground studio perspective grid */}
        <g opacity={0.2}>
          {Array.from({ length: 12 }).map((_, i) => (
            <line key={`igv-${i}`} x1={360 + (i - 5.5) * 30} y1={790} x2={360 + (i - 5.5) * 140} y2={1280} stroke="#38bdf8" />
          ))}
        </g>

        <g transform="translate(360, 610)">
          {[1, 0, -1].map((layer) => {
            const active = (sceneIdx % 3) - 1 === layer;
            return (
              <g key={`il-${layer}`} transform={`translate(0, ${layer * explode})`}>
                <polygon
                  points="0,-95 205,0 0,95 -205,0"
                  fill={active ? palette.accent : '#0f294a'}
                  fillOpacity={active ? 0.36 : 0.85}
                  stroke={active ? '#fde047' : '#38bdf8'}
                  strokeWidth={active ? 3.5 : 2}
                />
                <polygon points="0,-46 100,0 0,46 -100,0" fill={palette.accentGlow} fillOpacity={0.26} stroke="#ffffff" strokeWidth={1.2} />
              </g>
            );
          })}
          <line x1={0} y1={-190} x2={0} y2={190} stroke="#fde047" strokeWidth={2} strokeDasharray="6 6" />
          <circle cx={0} cy={-165 + (flowPos / 100) * 330} r={7} fill="#fde047" />
          <polyline points="175,-45 235,-105 315,-105" fill="none" stroke="#7dd3fc" strokeWidth={1.8} />
          <text x={238} y={-114} fill="#7dd3fc" fontSize={16} fontWeight={800}>{scene.label.slice(0, 14).toUpperCase()}</text>
        </g>
      </svg>

      <CleanWorldHeader hookTitle={hookTitle} metric={scene.metric} detail={scene.detail} ink="#ffffff" accent="#7dd3fc" frame={frame} fps={fps} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 5. COMIC PANEL (Kartun — Full-Screen Cel-Shaded Pop World)
// ---------------------------------------------------------------------------
export const ComicPanelLayout: React.FC<LayoutRenderProps> = ({
  hookTitle,
  scene,
  frame,
  fps,
}) => {
  const pop = spring({ frame: frame % 75, fps, config: { damping: 10, stiffness: 160 } });
  const rot = Math.sin(frame * 0.05) * 6;

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #38bdf8 0%, #fde047 62%, #fb923c 100%)' }}>
      <svg width="720" height="1280" viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0 }}>
        {/* Sunburst rays */}
        <g transform={`translate(360, 620) rotate(${frame * 0.3})`} opacity={0.22}>
          {Array.from({ length: 14 }).map((_, i) => (
            <polygon key={`cr-${i}`} points="0,0 -44,-780 44,-780" fill="#ffffff" transform={`rotate(${i * (360 / 14)})`} />
          ))}
        </g>
        {/* Expressive cel-shaded centerpiece burst */}
        <g transform={`translate(360, 620) scale(${interpolate(pop, [0, 1], [0.88, 1])}) rotate(${rot})`}>
          <circle cx={0} cy={0} r={190} fill="#ffffff" stroke="#0f172a" strokeWidth={8} />
          <circle cx={0} cy={0} r={154} fill="#f43f5e" stroke="#0f172a" strokeWidth={5} />
          <text x={0} y={18} textAnchor="middle" fill="#ffffff" fontSize={54} fontWeight={900}>
            {scene.metric.slice(0, 10)}
          </text>
        </g>
      </svg>

      <CleanWorldHeader hookTitle={hookTitle} metric={scene.label.toUpperCase()} detail={scene.detail} ink="#0f172a" accent="#be123c" isLight frame={frame} fps={fps} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 6. SWISS EDITORIAL (Grafis & Cetak — Pure Asymmetric Swiss Poster Geometry)
// ---------------------------------------------------------------------------
export const SwissEditorialLayout: React.FC<LayoutRenderProps> = ({
  hookTitle,
  palette,
  scene,
  frame,
  fps,
}) => {
  const accentBg = palette.id === 'swiss_red' ? '#dc2626' : palette.id === 'light_paper' ? '#b45309' : '#1d4ed8';
  const shift = Math.sin(frame * 0.04) * 14;

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#f5f1e8' }}>
      <svg width="720" height="1280" viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0 }}>
        {/* Pure Bauhaus / Swiss Constructivist geometric composition */}
        <rect x={0} y={0} width={720} height={420} fill={accentBg} />
        <circle cx={520 + shift} cy={680} r={195} fill="#0f172a" />
        <circle cx={210 - shift * 0.6} cy={740} r={115} fill={accentBg} opacity={0.9} />
        <rect x={44} y={530} width={280} height={14} fill="#0f172a" />
        <text x={520 + shift} y={698} textAnchor="middle" fill="#f5f1e8" fontSize={54} fontWeight={900}>
          {scene.metric.slice(0, 10)}
        </text>
      </svg>

      <CleanWorldHeader hookTitle={hookTitle} metric={scene.label.toUpperCase()} detail={scene.detail} ink="#ffffff" accent="#fef08a" align="left" frame={frame} fps={fps} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 7. DATAVIZ HUD (Infografis — Full-Screen Kinetic Data Sculptures)
// ---------------------------------------------------------------------------
export const DatavizHudLayout: React.FC<LayoutRenderProps> = ({
  slug,
  hookTitle,
  palette,
  scene,
  sceneIdx,
  frame,
  fps,
}) => {
  const seed = hashSlug(slug);
  const bars = [0.42, 0.72, 0.58, 0.94, 0.76, 0.64].map((v, i) =>
    Math.min(1, v * (0.78 + ((seed + i * 19) % 30) / 100) * Math.min(1, (frame + 12) / 36)),
  );

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 45%, #0a2540 0%, #04101f 62%, #02060d 100%)' }}>
      <svg width="720" height="1280" viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0 }}>
        {/* Clean full-bleed rising kinetic bar sculpture + trend spline */}
        <g transform="translate(66, 420)">
          {bars.map((h, i) => {
            const bh = h * 410;
            const bx = i * 102;
            const peak = i === (sceneIdx + 2) % bars.length;
            return (
              <rect
                key={`kb-${i}`}
                x={bx}
                y={450 - bh}
                width={68}
                height={bh}
                rx={12}
                fill={peak ? '#f43f5e' : palette.accent}
                opacity={peak ? 1 : 0.75}
              />
            );
          })}
          <polyline
            points={bars.map((h, i) => `${i * 102 + 34},${430 - h * 410}`).join(' ')}
            fill="none"
            stroke="#fde047"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>

      <CleanWorldHeader hookTitle={hookTitle} metric={scene.metric} detail={scene.detail} ink="#ffffff" accent="#22d3ee" frame={frame} fps={fps} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 8. ARCADE GAME (Gim — Clean Retro Pixel World, Zero HP/Stage Clutter)
// ---------------------------------------------------------------------------
export const ArcadeGameLayout: React.FC<LayoutRenderProps> = ({
  hookTitle,
  scene,
  frame,
  fps,
}) => {
  const bob = Math.sin(frame * 0.2) * 14;
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #120729 0%, #2b105c 56%, #0b0518 100%)' }}>
      <svg width="720" height="1280" viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0 }}>
        {/* Retro synthwave perspective floor */}
        <g opacity={0.32}>
          {Array.from({ length: 12 }).map((_, i) => (
            <line key={`agv-${i}`} x1={360 + (i - 5.5) * 32} y1={770} x2={360 + (i - 5.5) * 140} y2={1280} stroke="#f472b6" strokeWidth={1.6} />
          ))}
          {Array.from({ length: 7 }).map((_, i) => (
            <line key={`agh-${i}`} x1={0} y1={770 + i * 72} x2={720} y2={770 + i * 72} stroke="#a855f7" strokeWidth={1.6} />
          ))}
        </g>
        {/* Pixelated floating crystal relic */}
        <g transform={`translate(360, ${595 + bob})`}>
          <rect x={-96} y={-96} width={192} height={192} fill="#22d3ee" stroke="#ffffff" strokeWidth={8} />
          <rect x={-62} y={-62} width={124} height={124} fill="#facc15" />
          <rect x={-28} y={-28} width={56} height={56} fill="#f43f5e" />
        </g>
      </svg>

      <CleanWorldHeader hookTitle={hookTitle} metric={scene.metric} detail={scene.detail} ink="#facc15" accent="#38bdf8" frame={frame} fps={fps} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 9. CINEMA REEL (Sinema — Pure Anamorphic Atmospheric Film Frame)
// ---------------------------------------------------------------------------
export const CinemaReelLayout: React.FC<LayoutRenderProps> = ({
  hookTitle,
  palette,
  scene,
  frame,
  fps,
  progress,
}) => {
  const drift = interpolate(progress, [0, 1], [-24, 24]);
  return (
    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${palette.skyTop} 0%, ${palette.skyMid} 50%, ${palette.skyBottom} 76%, #09090b 100%)` }}>
      <svg width="720" height="1280" viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0 }}>
        {/* Soft anamorphic light flare & silhouette horizon */}
        <circle cx={360 + drift} cy={595} r={175} fill={palette.accentGlow} opacity={0.28} />
        <rect x={0} y={590} width={720} height={8} fill={palette.accentGlow} opacity={0.45} />
        <path d="M 0 790 L 140 650 L 295 730 L 460 580 L 620 715 L 720 660 L 720 1280 L 0 1280 Z" fill="#09090b" opacity={0.86} />
      </svg>

      <CleanWorldHeader hookTitle={hookTitle} metric={scene.metric} detail={scene.detail} ink="#ffffff" accent={palette.accentGlow} serif frame={frame} fps={fps} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 10. EAST ASIAN SCROLL (Asia Timur — Pure Washi Painting & Ukiyo-e Waves)
// ---------------------------------------------------------------------------
export const EastAsianScrollLayout: React.FC<LayoutRenderProps> = ({
  hookTitle,
  palette,
  scene,
  frame,
  fps,
}) => {
  const waveShift = Math.sin(frame * 0.05) * 22;
  return (
    <div style={{ position: 'absolute', inset: 0, background: palette.isLight ? 'linear-gradient(180deg, #f7efe0 0%, #eadbc0 100%)' : 'linear-gradient(180deg, #2b1d3d 0%, #6b3556 52%, #e68a6e 100%)' }}>
      <svg width="720" height="1280" viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0 }}>
        {/* Crimson rising sun & sweeping Ukiyo-e waves */}
        <circle cx={360} cy={520} r={168} fill="#dc2626" opacity={0.88} />
        <path
          d={`M -40 730 Q ${150 + waveShift} 580 340 710 T 760 690 L 760 1280 L -40 1280 Z`}
          fill="#1e3a5f"
          stroke="#0f172a"
          strokeWidth={4}
        />
        <path
          d={`M -40 835 Q ${220 - waveShift} 705 420 835 T 760 805 L 760 1280 L -40 1280 Z`}
          fill="#0f2942"
          stroke="#f7efe0"
          strokeWidth={3}
        />
      </svg>

      <CleanWorldHeader
        hookTitle={hookTitle}
        metric={scene.metric}
        detail={scene.detail}
        ink={palette.isLight ? '#1c1917' : '#fff1f2'}
        accent={palette.isLight ? '#991b1b' : '#fde047'}
        isLight={palette.isLight}
        serif
        frame={frame}
        fps={fps}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 11. CINEMATIC 3D (Sejarah / Peta — Atmospheric Monument + Wireframe Scale)
// ---------------------------------------------------------------------------
export const Cinematic3DLayout: React.FC<LayoutRenderProps> = ({
  hookTitle,
  palette,
  scene,
  frame,
  fps,
  progress,
}) => {
  const camScale = interpolate(progress, [0, 0.5, 1], [0.96, 1.07, 1.0]);
  return (
    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${palette.skyTop} 0%, ${palette.skyMid} 48%, ${palette.skyBottom} 64%, ${palette.groundTop} 65%, ${palette.groundBottom} 100%)` }}>
      <svg width="720" height="1280" viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0, transform: `scale(${camScale})`, transformOrigin: 'center 55%' }}>
        <circle cx={360} cy={520} r={185} fill={palette.accentGlow} opacity={0.22} />
        <path d="M 40 840 L 195 520 L 325 655 L 430 430 L 560 630 L 680 840 Z" fill="#1e293b" stroke={palette.accentGlow} strokeWidth={3} />
        <rect x={475} y={430} width={130} height={370} fill="none" stroke={palette.accentGlow} strokeWidth={2} strokeDasharray="6 4" />
        <circle cx={430} cy={430} r={6} fill={palette.accentGlow} />
        <polyline points="430,430 345,355 120,355" fill="none" stroke="#ffffff" strokeWidth={2} />
        <text x={120} y={342} fill="#ffffff" fontSize={20} fontWeight={800}>{scene.label.toUpperCase()}</text>
      </svg>

      <CleanWorldHeader hookTitle={hookTitle} metric={scene.metric} detail={scene.detail} ink="#ffffff" accent={palette.accentGlow} serif frame={frame} fps={fps} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 12. PRODUCT KEYNOTE (Promo / Keynote — Studio Spotlight & Floating Prism)
// ---------------------------------------------------------------------------
export const ProductKeynoteLayout: React.FC<LayoutRenderProps> = ({
  hookTitle,
  palette,
  scene,
  frame,
  fps,
}) => {
  const floatY = Math.sin(frame * 0.06) * 12;
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 42%, #1a2847 0%, #080d1a 58%, #02040a 100%)' }}>
      <svg width="720" height="1280" viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0 }}>
        <polygon points="360,0 85,960 635,960" fill={palette.accent} opacity={0.13} />
        <ellipse cx={360} cy={835} rx={235} ry={32} fill={palette.accentGlow} opacity={0.22} />
        {/* Floating sculptural glass prism */}
        <g transform={`translate(360, ${585 + floatY})`}>
          <polygon points="0,-175 160,-45 102,155 -102,155 -160,-45" fill={palette.accent} fillOpacity={0.26} stroke="#93c5fd" strokeWidth={3.5} />
          <polygon points="0,-115 98,-25 64,98 -64,98 -98,-25" fill="#ffffff" fillOpacity={0.14} stroke="#ffffff" strokeWidth={2} />
          <text x={0} y={14} textAnchor="middle" fill="#ffffff" fontSize={44} fontWeight={900}>
            {scene.metric.slice(0, 10)}
          </text>
        </g>
      </svg>

      <CleanWorldHeader hookTitle={hookTitle} metric={scene.label.toUpperCase()} detail={scene.detail} ink="#ffffff" accent="#93c5fd" frame={frame} fps={fps} />
    </div>
  );
};

export const LAYOUT_COMPONENTS: Record<VisualLayoutId, React.FC<LayoutRenderProps>> = {
  'news-broadcast': NewsBroadcastLayout,
  'forensic-dossier': ForensicDossierLayout,
  'handdrawn-board': HanddrawnBoardLayout,
  'isometric-cutaway': IsometricCutawayLayout,
  'comic-panel': ComicPanelLayout,
  'swiss-editorial': SwissEditorialLayout,
  'dataviz-hud': DatavizHudLayout,
  'arcade-game': ArcadeGameLayout,
  'cinema-reel': CinemaReelLayout,
  'east-asian-scroll': EastAsianScrollLayout,
  'cinematic-3d': Cinematic3DLayout,
  'product-keynote': ProductKeynoteLayout,
};
