import React from 'react';
import { interpolate, spring } from 'remotion';
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

/** Auto-fit font size so hookTitle (<=22 chars) NEVER overflows 720px width. */
export function fitHookFontSize(text: string, maxPx = 50, minPx = 30): number {
  const len = text.trim().length;
  if (len <= 12) return maxPx;
  if (len <= 16) return Math.round(maxPx * 0.86);
  if (len <= 20) return Math.round(maxPx * 0.76);
  return Math.max(minPx, Math.round(maxPx * 0.68));
}

// ---------------------------------------------------------------------------
// 1. NEWS BROADCAST (Dokumenter)
// ---------------------------------------------------------------------------
export const NewsBroadcastLayout: React.FC<LayoutRenderProps> = ({
  hookTitle,
  kicker,
  topic,
  palette,
  scene,
  sceneIdx,
  frame,
  fps,
}) => {
  const pop = spring({ frame: frame % 90, fps, config: { damping: 14, stiffness: 140 } });
  const tickerX = -((frame * 3.2) % 1200);
  const pulseDot = Math.sin(frame * 0.25) > 0 ? 1 : 0.3;

  return (
    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, #0b132b 0%, ${palette.skyMid} 55%, #070d1f 100%)` }}>
      {/* Top Breaking News Red Banner */}
      <div
        style={{
          position: 'absolute',
          top: 52,
          left: 36,
          right: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#dc2626',
          padding: '12px 20px',
          borderRadius: 6,
          boxShadow: '0 8px 24px rgba(220,38,38,0.45)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 12, height: 12, borderRadius: 99, background: '#ffffff', opacity: pulseDot }} />
          <span style={{ color: '#ffffff', fontSize: 18, fontWeight: 900, letterSpacing: 2.5 }}>
            LIVE REPORT
          </span>
        </div>
        <span style={{ color: '#fee2e2', fontSize: 15, fontWeight: 700, letterSpacing: 1.5 }}>
          {kicker.slice(0, 20)}
        </span>
      </div>

      {/* Broadcast Headline */}
      <div style={{ position: 'absolute', top: 124, left: 40, right: 40 }}>
        <div
          style={{
            fontSize: fitHookFontSize(hookTitle, 46, 30),
            fontWeight: 900,
            color: '#ffffff',
            lineHeight: 1.08,
            textTransform: 'uppercase',
            borderLeft: '8px solid #ef4444',
            paddingLeft: 18,
          }}
        >
          {hookTitle}
        </div>
      </div>

      {/* Split Evidence Monitor Card */}
      <div
        style={{
          position: 'absolute',
          top: 280,
          left: 40,
          right: 40,
          height: 540,
          background: '#0f172a',
          border: '2px solid rgba(148,163,184,0.35)',
          borderRadius: 12,
          overflow: 'hidden',
          transform: `scale(${interpolate(pop, [0, 1], [0.97, 1])})`,
        }}
      >
        {/* Upper Graphic Evidence Visual */}
        <div style={{ height: 320, position: 'relative', background: `radial-gradient(circle at 50% 45%, ${palette.accent}44, #090f21 75%)` }}>
          <svg width="640" height="320" viewBox="0 0 640 320">
            {/* World/radar grid */}
            {Array.from({ length: 8 }).map((_, i) => (
              <line key={`nh-${i}`} x1={0} y1={i * 45} x2={640} y2={i * 45} stroke="#38bdf8" strokeOpacity={0.14} />
            ))}
            {Array.from({ length: 10 }).map((_, i) => (
              <line key={`nv-${i}`} x1={i * 70} y1={0} x2={i * 70} y2={320} stroke="#38bdf8" strokeOpacity={0.14} />
            ))}
            {/* Animated broadcast signal rings */}
            <circle cx={320} cy={160} r={55 + ((frame * 2) % 85)} fill="none" stroke="#ef4444" strokeWidth={2.5} opacity={0.75} />
            <circle cx={320} cy={160} r={42} fill="#ef4444" fillOpacity={0.22} stroke="#ef4444" strokeWidth={3} />
            <text x={320} y={176} textAnchor="middle" fill="#ffffff" fontSize={44} fontWeight={900}>
              {scene.metric.slice(0, 14)}
            </text>
          </svg>
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              background: 'rgba(15,23,42,0.88)',
              border: '1px solid #ef4444',
              padding: '6px 14px',
              borderRadius: 4,
              color: '#fca5a5',
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: 1.5,
            }}
          >
            BUKTI 0{sceneIdx + 1} / 04
          </div>
        </div>

        {/* Lower Split Data Strip */}
        <div style={{ padding: '24px 28px', borderTop: '3px solid #ef4444', background: '#111827' }}>
          <div style={{ color: '#38bdf8', fontSize: 17, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
            {scene.label}
          </div>
          <div style={{ color: '#f8fafc', fontSize: 28, fontWeight: 700, lineHeight: 1.25 }}>
            {scene.detail}
          </div>
        </div>
      </div>

      {/* Running News Ticker */}
      <div
        style={{
          position: 'absolute',
          top: 848,
          left: 0,
          right: 0,
          height: 46,
          background: '#b91c1c',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          borderTop: '2px solid #fca5a5',
          borderBottom: '2px solid #7f1d1d',
        }}
      >
        <div
          style={{
            whiteSpace: 'nowrap',
            color: '#ffffff',
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: 1.5,
            transform: `translateX(${tickerX}px)`,
          }}
        >
          {`BREAKING: ${topic.toUpperCase()}  ●  ${scene.label.toUpperCase()}: ${scene.metric}  ●  DENTSWEB INVESTIGASI  ●  ${topic.toUpperCase()}  ●  ${scene.detail.toUpperCase()}`}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 2. FORENSIC DOSSIER (Film Bukti)
// ---------------------------------------------------------------------------
export const ForensicDossierLayout: React.FC<LayoutRenderProps> = ({
  hookTitle,
  kicker,
  palette,
  scene,
  scenes,
  sceneIdx,
  frame,
}) => {
  const pulsePin = 1 + Math.sin(frame * 0.14) * 0.12;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: palette.isLight
          ? 'linear-gradient(180deg, #d6bfa0 0%, #bfa27e 100%)'
          : 'linear-gradient(180deg, #1b1713 0%, #2a221b 55%, #120f0c 100%)',
      }}
    >
      {/* Cork/Lighttable Grid + Red Investigation Strings */}
      <svg width="720" height="1280" viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0 }}>
        {Array.from({ length: 16 }).map((_, i) => (
          <line key={`fg-${i}`} x1={0} y1={i * 80} x2={720} y2={i * 80} stroke="#f59e0b" strokeOpacity={0.08} />
        ))}
        {/* Connecting red yarn strings */}
        <line x1={180} y1={350} x2={520} y2={480} stroke="#dc2626" strokeWidth={3.5} />
        <line x1={520} y1={480} x2={240} y2={760} stroke="#dc2626" strokeWidth={3.5} />
        <line x1={180} y1={350} x2={240} y2={760} stroke="#dc2626" strokeWidth={2} strokeDasharray="8 6" />
        {/* Red pushpins */}
        <circle cx={180} cy={350} r={11 * pulsePin} fill="#dc2626" stroke="#ffffff" strokeWidth={2.5} />
        <circle cx={520} cy={480} r={11 * pulsePin} fill="#dc2626" stroke="#ffffff" strokeWidth={2.5} />
        <circle cx={240} cy={760} r={11 * pulsePin} fill="#dc2626" stroke="#ffffff" strokeWidth={2.5} />
      </svg>

      {/* Case File Header */}
      <div style={{ position: 'absolute', top: 56, left: 42, right: 42 }}>
        <div
          style={{
            display: 'inline-block',
            background: '#fef3c7',
            color: '#451a03',
            padding: '6px 14px',
            fontFamily: '"Courier New", monospace',
            fontWeight: 900,
            fontSize: 16,
            letterSpacing: 2,
            border: '2px solid #78350f',
            marginBottom: 14,
          }}
        >
          BERKAS #{sceneIdx + 1}04 — {kicker.slice(0, 18)}
        </div>
        <div
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: fitHookFontSize(hookTitle, 46, 30),
            fontWeight: 900,
            color: palette.isLight ? '#1c1917' : '#fef3c7',
            lineHeight: 1.08,
            textTransform: 'uppercase',
          }}
        >
          {hookTitle}
        </div>
      </div>

      {/* Main Pinned Evidence Dossier Card */}
      <div
        style={{
          position: 'absolute',
          top: 320,
          left: 52,
          right: 52,
          background: '#f5efe0',
          color: '#1c1917',
          borderRadius: 4,
          padding: '32px 28px',
          border: '2px solid #78350f',
          boxShadow: '0 20px 40px rgba(0,0,0,0.45)',
          transform: 'rotate(-1.5deg)',
        }}
      >
        {/* Red pushpin at top center */}
        <div
          style={{
            position: 'absolute',
            top: -14,
            left: '50%',
            width: 26,
            height: 26,
            marginLeft: -13,
            borderRadius: 99,
            background: '#dc2626',
            border: '3px solid #ffffff',
          }}
        />
        <div style={{ fontFamily: '"Courier New", monospace', fontSize: 17, fontWeight: 800, color: '#991b1b', letterSpacing: 2, marginBottom: 10 }}>
          {`[TEMUAN 0${sceneIdx + 1}] ${scene.label.toUpperCase()}`}
        </div>
        <div style={{ fontSize: 58, fontWeight: 900, color: '#0f172a', lineHeight: 1.05, marginBottom: 14 }}>
          {scene.metric}
        </div>
        <div style={{ fontFamily: '"Courier New", monospace', fontSize: 23, fontWeight: 700, color: '#334155', lineHeight: 1.35 }}>
          {scene.detail}
        </div>

        {/* Mini Evidence Index Strip */}
        <div style={{ display: 'flex', gap: 10, marginTop: 22, borderTop: '2px dashed #a8a29e', paddingTop: 14 }}>
          {scenes.slice(0, 4).map((s, idx) => (
            <div
              key={`ev-${idx}`}
              style={{
                flex: 1,
                padding: '6px 8px',
                background: idx === sceneIdx ? '#dc2626' : '#e7e5e4',
                color: idx === sceneIdx ? '#ffffff' : '#44403c',
                fontSize: 13,
                fontWeight: 800,
                textAlign: 'center',
                borderRadius: 3,
              }}
            >
              {`0${idx + 1}`}
            </div>
          ))}
        </div>

        {/* Stamped DEKLASIFIKASI */}
        <div
          style={{
            position: 'absolute',
            right: 22,
            top: 22,
            border: '4px solid #dc2626',
            color: '#dc2626',
            padding: '5px 12px',
            fontWeight: 900,
            fontSize: 18,
            letterSpacing: 3,
            transform: 'rotate(11deg)',
            opacity: 0.85,
          }}
        >
          DEKLASIFIKASI
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 3. HANDDRAWN BOARD (Gambar Tangan)
// ---------------------------------------------------------------------------
export const HanddrawnBoardLayout: React.FC<LayoutRenderProps> = ({
  hookTitle,
  kicker,
  palette,
  scene,
  sceneIdx,
  frame,
}) => {
  const isChalk = palette.id === 'chalkboard';
  const bg = isChalk ? '#16382b' : palette.id === 'whiteboard' ? '#ffffff' : '#f8f3e6';
  const ink = isChalk ? '#f8fafc' : '#1e293b';
  const strokeDash = Math.max(0, 900 - (frame % 150) * 10);

  return (
    <div style={{ position: 'absolute', inset: 0, background: bg }}>
      {/* Subtle ruled paper / chalk dust */}
      <svg width="720" height="1280" viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0 }}>
        {!isChalk &&
          Array.from({ length: 22 }).map((_, i) => (
            <line key={`hb-${i}`} x1={0} y1={70 + i * 56} x2={720} y2={70 + i * 56} stroke="#94a3b8" strokeOpacity={0.22} />
          ))}
        {!isChalk && <line x1={68} y1={0} x2={68} y2={1280} stroke="#f43f5e" strokeOpacity={0.35} strokeWidth={2} />}

        {/* Real-time animated hand-drawn diagram (strokeDashoffset) */}
        <g transform="translate(80, 310)">
          <rect
            x={10}
            y={10}
            width={540}
            height={360}
            rx={18}
            fill="none"
            stroke={ink}
            strokeWidth={4}
            strokeDasharray="16 8"
            opacity={0.4}
          />
          {/* Animated sketchy node flowchart */}
          <path
            d="M 70 250 C 130 100, 250 100, 300 190 C 350 280, 440 240, 490 95"
            fill="none"
            stroke={isChalk ? '#fde047' : '#0284c7'}
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray="900"
            strokeDashoffset={strokeDash}
          />
          <circle cx={70} cy={250} r={22} fill={isChalk ? '#86efac' : '#f97316'} stroke={ink} strokeWidth={4} />
          <circle cx={300} cy={190} r={28} fill={isChalk ? '#fde047' : '#0284c7'} stroke={ink} strokeWidth={4} />
          <circle cx={490} cy={95} r={24} fill="#f43f5e" stroke={ink} strokeWidth={4} />
          {/* Hand-drawn arrow tip */}
          <path d="M 465 95 L 495 85 L 492 118" fill="none" stroke={ink} strokeWidth={5} strokeLinecap="round" />
          <text x={280} y={325} textAnchor="middle" fill={ink} fontSize={26} fontWeight={800}>
            {scene.label.toUpperCase()}
          </text>
        </g>
      </svg>

      {/* Hand-underlined Title */}
      <div style={{ position: 'absolute', top: 68, left: 82, right: 44 }}>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: 2.5, color: isChalk ? '#86efac' : '#b45309', marginBottom: 8 }}>
          {kicker}
        </div>
        <div
          style={{
            fontSize: fitHookFontSize(hookTitle, 46, 30),
            fontWeight: 900,
            color: ink,
            lineHeight: 1.08,
          }}
        >
          {hookTitle}
        </div>
        <svg width="460" height="18" viewBox="0 0 460 18" style={{ marginTop: 6 }}>
          <path d="M 4 12 Q 160 2 452 10" fill="none" stroke={isChalk ? '#fde047' : '#f43f5e'} strokeWidth={6} strokeLinecap="round" />
        </svg>
      </div>

      {/* Pinned Sticky Note Fact */}
      <div
        style={{
          position: 'absolute',
          top: 715,
          left: 88,
          right: 88,
          background: '#fef08a',
          color: '#1c1917',
          padding: '24px 28px',
          borderRadius: 4,
          boxShadow: '0 14px 28px rgba(0,0,0,0.22)',
          transform: `rotate(${sceneIdx % 2 === 0 ? -1.5 : 1.5}deg)`,
          borderLeft: '8px solid #eab308',
        }}
      >
        <div style={{ fontSize: 44, fontWeight: 900, color: '#9a3412', lineHeight: 1.05 }}>{scene.metric}</div>
        <div style={{ fontSize: 23, fontWeight: 700, color: '#1c1917', marginTop: 8, lineHeight: 1.25 }}>{scene.detail}</div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 4. ISOMETRIC CUTAWAY (Gaya Studio / 3D)
// ---------------------------------------------------------------------------
export const IsometricCutawayLayout: React.FC<LayoutRenderProps> = ({
  hookTitle,
  kicker,
  palette,
  scene,
  sceneIdx,
  frame,
  progress,
}) => {
  const explode = interpolate(progress, [0, 0.4, 0.8], [32, 74, 48]);
  const flowPos = (frame * 5) % 100;

  return (
    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, #061c36 0%, ${palette.skyMid} 60%, #041224 100%)` }}>
      {/* Technical Blueprint Grid + Exploded Isometric Cutaway */}
      <svg width="720" height="1280" viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0 }}>
        {Array.from({ length: 18 }).map((_, i) => (
          <line key={`ig-h-${i}`} x1={0} y1={i * 72} x2={720} y2={i * 72} stroke="#38bdf8" strokeOpacity={0.14} />
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`ig-v-${i}`} x1={i * 72} y1={0} x2={i * 72} y2={1280} stroke="#38bdf8" strokeOpacity={0.14} />
        ))}

        {/* Exploded 3-Layer Isometric Architecture */}
        <g transform="translate(360, 560)">
          {[1, 0, -1].map((layer) => {
            const dy = layer * explode;
            const active = (sceneIdx % 3) - 1 === layer;
            return (
              <g key={`iso-${layer}`} transform={`translate(0, ${dy})`}>
                <polygon
                  points="0,-105 215,-5 0,95 -215,-5"
                  fill={active ? palette.accent : '#0f294a'}
                  fillOpacity={active ? 0.38 : 0.85}
                  stroke={active ? '#fde047' : '#38bdf8'}
                  strokeWidth={active ? 4 : 2}
                />
                <polygon
                  points="0,-52 108,-2 0,48 -108,-2"
                  fill={palette.accentGlow}
                  fillOpacity={0.3}
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />
              </g>
            );
          })}
          {/* Vertical cutaway axis & animated flow dot */}
          <line x1={0} y1={-190} x2={0} y2={190} stroke="#fde047" strokeWidth={2} strokeDasharray="6 6" />
          <circle cx={0} cy={-160 + (flowPos / 100) * 320} r={8} fill="#fde047" />
          {/* Dimension callout pointer */}
          <polyline points="175,-45 245,-110 310,-110" fill="none" stroke="#38bdf8" strokeWidth={2.5} />
          <circle cx={175} cy={-45} r={6} fill="#fde047" />
        </g>
      </svg>

      {/* Top Spec Header */}
      <div style={{ position: 'absolute', top: 62, left: 40, right: 40 }}>
        <div style={{ color: '#38bdf8', fontSize: 16, fontWeight: 800, letterSpacing: 3, marginBottom: 8 }}>
          {`CUTAWAY 3D // ${kicker}`}
        </div>
        <div style={{ fontSize: fitHookFontSize(hookTitle, 46, 30), fontWeight: 900, color: '#ffffff', lineHeight: 1.08 }}>
          {hookTitle}
        </div>
      </div>

      {/* Floating Side Spec Readout */}
      <div
        style={{
          position: 'absolute',
          top: 780,
          left: 40,
          right: 40,
          background: 'rgba(6, 28, 54, 0.88)',
          border: '2px solid #38bdf8',
          borderRadius: 10,
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 18,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ color: '#7dd3fc', fontSize: 15, fontWeight: 800, letterSpacing: 2 }}>{scene.label.toUpperCase()}</div>
          <div style={{ color: '#ffffff', fontSize: 22, fontWeight: 700, marginTop: 4 }}>{scene.detail}</div>
        </div>
        <div style={{ background: '#0284c7', padding: '12px 18px', borderRadius: 8, textAlign: 'center', minWidth: 145 }}>
          <div style={{ color: '#fde047', fontSize: 28, fontWeight: 900 }}>{scene.metric}</div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 5. COMIC PANEL (Kartun)
// ---------------------------------------------------------------------------
export const ComicPanelLayout: React.FC<LayoutRenderProps> = ({
  hookTitle,
  kicker,
  scene,
  sceneIdx,
  frame,
  fps,
}) => {
  const bubblePop = spring({ frame: frame % 95, fps, config: { damping: 10, stiffness: 180 } });
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#fef08a' }}>
      {/* Halftone dots background */}
      <svg width="720" height="1280" viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0, opacity: 0.2 }}>
        {Array.from({ length: 14 }).map((_, r) =>
          Array.from({ length: 9 }).map((__, c) => (
            <circle key={`ht-${r}-${c}`} cx={40 + c * 80} cy={40 + r * 90} r={8} fill="#e11d48" />
          )),
        )}
      </svg>

      {/* Bold Comic Masthead */}
      <div
        style={{
          position: 'absolute',
          top: 52,
          left: 36,
          right: 36,
          background: '#e11d48',
          border: '6px solid #0f172a',
          boxShadow: '8px 8px 0 #0f172a',
          padding: '14px 20px',
          transform: 'rotate(-1deg)',
        }}
      >
        <div style={{ color: '#fef08a', fontSize: 15, fontWeight: 900, letterSpacing: 2.5 }}>{kicker.toUpperCase()}</div>
        <div style={{ color: '#ffffff', fontSize: fitHookFontSize(hookTitle, 44, 28), fontWeight: 900, lineHeight: 1.06, marginTop: 4 }}>
          {hookTitle}
        </div>
      </div>

      {/* 3-Panel Comic Grid */}
      <div style={{ position: 'absolute', top: 238, left: 36, right: 36, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Panel 1: Wide Action Panel */}
        <div
          style={{
            height: 350,
            background: '#38bdf8',
            border: '6px solid #0f172a',
            boxShadow: '8px 8px 0 #0f172a',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <svg width="648" height="350" viewBox="0 0 648 350">
            {/* Action speed burst */}
            <polygon
              points="324,175 0,0 120,0 324,175 260,0 390,0 324,175 540,0 648,0 324,175 648,140 648,240 324,175 580,350 420,350 324,175 220,350 60,350 324,175 0,240 0,130"
              fill="#ffffff"
              opacity={0.3}
            />
            <polygon
              points="324,30 375,115 475,85 430,175 520,235 415,245 395,330 324,265 250,330 230,245 130,235 215,175 170,85 270,115"
              fill="#facc15"
              stroke="#0f172a"
              strokeWidth={6}
              transform={`rotate(${Math.sin(frame * 0.08) * 5} 324 175)`}
            />
            <text x={324} y={192} textAnchor="middle" fill="#0f172a" fontSize={44} fontWeight={900}>
              {scene.metric.slice(0, 14)}
            </text>
          </svg>
          <div
            style={{
              position: 'absolute',
              top: 14,
              left: 14,
              background: '#fef08a',
              border: '3px solid #0f172a',
              padding: '4px 12px',
              fontWeight: 900,
              fontSize: 16,
              color: '#0f172a',
            }}
          >
            {`PANEL #${sceneIdx + 1}`}
          </div>
        </div>

        {/* Bottom 2 Split Panels */}
        <div style={{ display: 'flex', gap: 18, height: 270 }}>
          <div
            style={{
              flex: 1,
              background: '#ffffff',
              border: '6px solid #0f172a',
              boxShadow: '8px 8px 0 #0f172a',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              transform: `scale(${interpolate(bubblePop, [0, 1], [0.85, 1])})`,
            }}
          >
            <div style={{ color: '#e11d48', fontSize: 16, fontWeight: 900, textTransform: 'uppercase', marginBottom: 6 }}>
              {scene.label}
            </div>
            <div style={{ color: '#0f172a', fontSize: 23, fontWeight: 900, lineHeight: 1.2 }}>
              “{scene.detail}”
            </div>
          </div>
          <div
            style={{
              width: 210,
              background: '#f97316',
              border: '6px solid #0f172a',
              boxShadow: '8px 8px 0 #0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
            }}
          >
            <div style={{ fontSize: 54, fontWeight: 900, color: '#ffffff', textShadow: '4px 4px 0 #0f172a' }}>
              {`0${sceneIdx + 1}`}
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', background: '#fef08a', padding: '2px 10px', border: '2px solid #0f172a' }}>
              POW!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 6. SWISS EDITORIAL (Grafis & Cetak)
// ---------------------------------------------------------------------------
export const SwissEditorialLayout: React.FC<LayoutRenderProps> = ({
  hookTitle,
  kicker,
  palette,
  scene,
  sceneIdx,
  frame,
}) => {
  const accentBg = palette.id === 'swiss_red' ? '#dc2626' : palette.id === 'light_paper' ? '#b45309' : '#1d4ed8';
  const slide = interpolate(frame % 120, [0, 20], [-20, 0], { extrapolateRight: 'clamp' });

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#f5f2eb', color: '#0f172a' }}>
      {/* Asymmetric Bold Color Block */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '68%', height: 520, background: accentBg }} />
      <div style={{ position: 'absolute', top: 520, right: 0, width: '32%', height: 390, background: '#0f172a' }} />

      {/* Oversized Swiss Edition Number */}
      <div
        style={{
          position: 'absolute',
          top: 44,
          right: 34,
          fontSize: 120,
          fontWeight: 900,
          lineHeight: 0.85,
          color: '#0f172a',
          letterSpacing: -6,
        }}
      >
        {`0${sceneIdx + 1}`}
      </div>

      {/* Left-aligned Stark Swiss Headline */}
      <div style={{ position: 'absolute', top: 96, left: 42, width: 430, transform: `translateX(${slide}px)` }}>
        <div style={{ color: '#fef08a', fontSize: 16, fontWeight: 900, letterSpacing: 3, marginBottom: 14 }}>
          {kicker.toUpperCase()}
        </div>
        <div
          style={{
            color: '#ffffff',
            fontSize: fitHookFontSize(hookTitle, 50, 32),
            fontWeight: 900,
            lineHeight: 1.02,
            letterSpacing: -1,
            textTransform: 'uppercase',
          }}
        >
          {hookTitle}
        </div>
      </div>

      {/* Crisp Editorial Data Grid */}
      <div style={{ position: 'absolute', top: 556, left: 42, width: 420 }}>
        <div style={{ height: 6, width: 96, background: '#0f172a', marginBottom: 18 }} />
        <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 2.5, color: accentBg, textTransform: 'uppercase' }}>
          {scene.label}
        </div>
        <div style={{ fontSize: 58, fontWeight: 900, color: '#0f172a', lineHeight: 1.05, marginTop: 8 }}>
          {scene.metric}
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#334155', lineHeight: 1.3, marginTop: 12 }}>
          {scene.detail}
        </div>
      </div>

      {/* Right Dark Column Vertical Label */}
      <div
        style={{
          position: 'absolute',
          top: 560,
          right: 28,
          width: 175,
          color: '#f8fafc',
          fontSize: 17,
          fontWeight: 800,
          lineHeight: 1.5,
          letterSpacing: 1.5,
        }}
      >
        <div>EDITION</div>
        <div style={{ color: '#fef08a', fontSize: 28, fontWeight: 900 }}>2026</div>
        <div style={{ marginTop: 24, borderTop: '2px solid #ffffff', paddingTop: 14 }}>
          SWISS GRID SYSTEM
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 7. DATAVIZ HUD (Infografis)
// ---------------------------------------------------------------------------
export const DatavizHudLayout: React.FC<LayoutRenderProps> = ({
  slug,
  hookTitle,
  kicker,
  palette,
  scene,
  sceneIdx,
  frame,
}) => {
  const seed = hashSlug(slug);
  const bars = [0.42, 0.68, 0.54, 0.92, 0.76, 0.61].map((v, i) =>
    Math.min(1, v * (0.75 + ((seed + i * 17) % 35) / 100) * Math.min(1, (frame + 15) / 40)),
  );
  const sweepDeg = (frame * 3) % 360;

  return (
    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, #030a18 0%, #071933 60%, #020712 100%)` }}>
      {/* Tactical HUD Corner Brackets + Radar + Animated Chart */}
      <svg width="720" height="1280" viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0 }}>
        {/* Radar circles */}
        <circle cx={550} cy={355} r={115} fill="none" stroke="#22d3ee" strokeOpacity={0.28} strokeWidth={2} />
        <circle cx={550} cy={355} r={75} fill="none" stroke="#22d3ee" strokeOpacity={0.22} strokeWidth={1.5} />
        <line
          x1={550}
          y1={355}
          x2={550 + Math.cos((sweepDeg * Math.PI) / 180) * 115}
          y2={355 + Math.sin((sweepDeg * Math.PI) / 180) * 115}
          stroke="#22d3ee"
          strokeWidth={3}
        />

        {/* Animated Bar Chart Panel */}
        <g transform="translate(52, 505)">
          <rect x={0} y={0} width={616} height={310} rx={12} fill="#081529" stroke="#22d3ee" strokeOpacity={0.45} strokeWidth={2} />
          {[0, 1, 2, 3].map((g) => (
            <line key={`dg-${g}`} x1={24} y1={50 + g * 68} x2={592} y2={50 + g * 68} stroke="#38bdf8" strokeOpacity={0.16} />
          ))}
          {bars.map((h, i) => {
            const bh = h * 220;
            const bx = 46 + i * 90;
            const isPeak = i === (sceneIdx + 2) % bars.length;
            return (
              <g key={`db-${i}`}>
                <rect
                  x={bx}
                  y={270 - bh}
                  width={54}
                  height={bh}
                  rx={6}
                  fill={isPeak ? '#f43f5e' : palette.accent}
                  opacity={isPeak ? 1 : 0.78}
                />
                <text x={bx + 27} y={295} textAnchor="middle" fill="#94a3b8" fontSize={14} fontWeight={700}>
                  {`T${i + 1}`}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Top HUD Header */}
      <div style={{ position: 'absolute', top: 58, left: 42, right: 42 }}>
        <div style={{ color: '#22d3ee', fontSize: 16, fontWeight: 800, letterSpacing: 3, marginBottom: 8 }}>
          {`TELEMETRI // ${kicker}`}
        </div>
        <div style={{ fontSize: fitHookFontSize(hookTitle, 46, 30), fontWeight: 900, color: '#ffffff', lineHeight: 1.08 }}>
          {hookTitle}
        </div>
      </div>

      {/* KPI Big Counter Card */}
      <div
        style={{
          position: 'absolute',
          top: 258,
          left: 52,
          width: 375,
          background: 'rgba(14, 116, 144, 0.22)',
          border: '2px solid #22d3ee',
          borderRadius: 12,
          padding: '20px 24px',
        }}
      >
        <div style={{ color: '#67e8f9', fontSize: 15, fontWeight: 800, letterSpacing: 2 }}>{scene.label.toUpperCase()}</div>
        <div style={{ color: '#ffffff', fontSize: 54, fontWeight: 900, marginTop: 6, lineHeight: 1.05 }}>
          {scene.metric}
        </div>
        <div style={{ color: '#cbd5e1', fontSize: 19, fontWeight: 600, marginTop: 8 }}>{scene.detail}</div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 8. ARCADE GAME (Gim)
// ---------------------------------------------------------------------------
export const ArcadeGameLayout: React.FC<LayoutRenderProps> = ({
  hookTitle,
  kicker,
  scene,
  sceneIdx,
  frame,
  progress,
}) => {
  const hpPct = Math.round(interpolate(progress, [0, 0.5, 1], [100, 65, 92]));
  const score = 1200 + Math.floor(frame * 15);
  const bob = Math.sin(frame * 0.22) * 8;

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0b0618', fontFamily: '"Courier New", monospace' }}>
      {/* CRT Outer Pixel Frame + Scanlines */}
      <div
        style={{
          position: 'absolute',
          inset: 22,
          border: '6px solid #a855f7',
          borderRadius: 18,
          background: 'linear-gradient(180deg, #160a30 0%, #24104d 55%, #0d0620 100%)',
          overflow: 'hidden',
        }}
      >
        <svg width="676" height="1236" viewBox="0 0 676 1236" style={{ position: 'absolute', inset: 0, opacity: 0.16 }}>
          {Array.from({ length: 60 }).map((_, i) => (
            <line key={`sc-${i}`} x1={0} y1={i * 20} x2={676} y2={i * 20} stroke="#000000" strokeWidth={3} />
          ))}
        </svg>

        {/* Top Arcade HUD: HP Bar + Score */}
        <div style={{ position: 'relative', padding: '24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#facc15', fontSize: 15, fontWeight: 900 }}>{`HP ${hpPct}%`}</div>
            <div style={{ width: 220, height: 18, background: '#1e1b4b', border: '3px solid #ffffff', marginTop: 4 }}>
              <div style={{ width: `${hpPct}%`, height: '100%', background: hpPct > 50 ? '#22c55e' : '#ef4444' }} />
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#38bdf8', fontSize: 15, fontWeight: 900 }}>{`STAGE 0${sceneIdx + 1}`}</div>
            <div style={{ color: '#ffffff', fontSize: 24, fontWeight: 900 }}>{`PTS ${score}`}</div>
          </div>
        </div>

        {/* Arcade Title */}
        <div style={{ padding: '10px 28px', textAlign: 'center' }}>
          <div style={{ color: '#f472b6', fontSize: 15, fontWeight: 900, letterSpacing: 3 }}>{kicker.toUpperCase()}</div>
          <div
            style={{
              color: '#facc15',
              fontSize: fitHookFontSize(hookTitle, 42, 28),
              fontWeight: 900,
              lineHeight: 1.1,
              marginTop: 6,
              textShadow: '4px 4px 0 #7e22ce',
            }}
          >
            {hookTitle}
          </div>
        </div>

        {/* Center 16-bit Pixel Arena & Hero Sprite */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
          <svg width="360" height="300" viewBox="0 0 360 300">
            {/* Pixel floor */}
            <rect x={20} y={248} width={320} height={24} fill="#4c1d95" stroke="#a855f7" strokeWidth={4} />
            {/* 16-bit Pixel Trophy / Shield Sprite */}
            <g transform={`translate(180, ${140 + bob})`}>
              <rect x={-56} y={-56} width={112} height={112} fill="#22d3ee" stroke="#ffffff" strokeWidth={6} />
              <rect x={-36} y={-36} width={72} height={72} fill="#facc15" />
              <rect x={-16} y={-16} width={32} height={32} fill="#ef4444" />
            </g>
            <text x={180} y={232} textAnchor="middle" fill="#ffffff" fontSize={32} fontWeight={900}>
              {scene.metric.slice(0, 14)}
            </text>
          </svg>
        </div>

        {/* Classic RPG Dialog Box */}
        <div
          style={{
            margin: '16px 28px 0',
            background: '#0f172a',
            border: '5px solid #ffffff',
            borderRadius: 8,
            padding: '20px 22px',
          }}
        >
          <div style={{ color: '#38bdf8', fontSize: 17, fontWeight: 900, marginBottom: 6 }}>
            {`▶ ${scene.label.toUpperCase()}`}
          </div>
          <div style={{ color: '#ffffff', fontSize: 22, fontWeight: 700, lineHeight: 1.3 }}>
            {scene.detail}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 9. CINEMA REEL (Sinema)
// ---------------------------------------------------------------------------
export const CinemaReelLayout: React.FC<LayoutRenderProps> = ({
  hookTitle,
  kicker,
  palette,
  scene,
  sceneIdx,
  frame,
  fps,
}) => {
  const sec = Math.floor(frame / fps);
  const tc = `00:00:${String(sec).padStart(2, '0')}:${String(frame % fps).padStart(2, '0')}`;
  const blink = Math.floor(frame / 15) % 2 === 0;

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#09090b' }}>
      {/* Top & Bottom Cinema Letterbox Bars */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 112, background: '#000000', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: '"Courier New", monospace' }}>
          <div style={{ width: 12, height: 12, borderRadius: 99, background: '#ef4444', opacity: blink ? 1 : 0.2 }} />
          <span style={{ color: '#ffffff', fontSize: 18, fontWeight: 800 }}>REC ● {tc}</span>
        </div>
        <span style={{ color: '#a1a1aa', fontSize: 15, fontWeight: 700, letterSpacing: 2 }}>{kicker.slice(0, 18)}</span>
      </div>

      {/* Main Cinema Frame Window */}
      <div
        style={{
          position: 'absolute',
          top: 112,
          left: 0,
          right: 0,
          bottom: 210,
          background: `linear-gradient(160deg, ${palette.skyTop} 0%, ${palette.skyMid} 52%, ${palette.skyBottom} 100%)`,
          overflow: 'hidden',
        }}
      >
        {/* Viewfinder corner framing marks */}
        <svg width="720" height="958" viewBox="0 0 720 958" style={{ position: 'absolute', inset: 0 }}>
          <path d="M 36 86 L 36 36 L 86 36" fill="none" stroke="#ffffff" strokeWidth={3} opacity={0.7} />
          <path d="M 634 36 L 684 36 L 684 86" fill="none" stroke="#ffffff" strokeWidth={3} opacity={0.7} />
          <path d="M 36 872 L 36 922 L 86 922" fill="none" stroke="#ffffff" strokeWidth={3} opacity={0.7} />
          <path d="M 634 922 L 684 922 L 684 872" fill="none" stroke="#ffffff" strokeWidth={3} opacity={0.7} />
          {/* Anamorphic horizontal flare */}
          <rect x={0} y={435} width={720} height={8} fill={palette.accentGlow} opacity={0.35} />
          <circle cx={360} cy={439} r={110} fill={palette.accentGlow} opacity={0.18} />
        </svg>

        {/* Polaroid / Film Scene Card */}
        <div
          style={{
            position: 'absolute',
            top: 64,
            left: 52,
            right: 52,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: fitHookFontSize(hookTitle, 48, 30),
              fontWeight: 900,
              color: palette.ink,
              lineHeight: 1.08,
              textShadow: '0 4px 18px rgba(0,0,0,0.75)',
            }}
          >
            {hookTitle}
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            top: 320,
            left: 64,
            right: 64,
            background: 'rgba(9, 9, 11, 0.72)',
            border: '2px solid rgba(255,255,255,0.28)',
            borderRadius: 8,
            padding: '32px 28px',
            textAlign: 'center',
          }}
        >
          <div style={{ color: palette.accentGlow, fontSize: 17, fontWeight: 800, letterSpacing: 3, marginBottom: 10 }}>
            {`ADEGAN 0${sceneIdx + 1} — ${scene.label.toUpperCase()}`}
          </div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 58, fontWeight: 900, color: '#ffffff', lineHeight: 1.05 }}>
            {scene.metric}
          </div>
          <div style={{ color: '#e4e4e7', fontSize: 23, fontWeight: 600, marginTop: 14, lineHeight: 1.35 }}>
            {scene.detail}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 10. EAST ASIAN SCROLL (Asia Timur)
// ---------------------------------------------------------------------------
export const EastAsianScrollLayout: React.FC<LayoutRenderProps> = ({
  hookTitle,
  kicker,
  palette,
  scene,
  sceneIdx,
  frame,
}) => {
  const waveShift = Math.sin(frame * 0.06) * 18;
  return (
    <div style={{ position: 'absolute', inset: 0, background: palette.isLight ? '#f3ead8' : '#261a2e' }}>
      {/* Wooden Scroll Rollers Top & Bottom */}
      <div style={{ position: 'absolute', top: 34, left: 26, right: 26, height: 22, borderRadius: 12, background: '#5c3a21', border: '2px solid #92400e' }} />
      <div style={{ position: 'absolute', top: 896, left: 26, right: 26, height: 22, borderRadius: 12, background: '#5c3a21', border: '2px solid #92400e' }} />

      {/* Scroll Inner Paper Canvas */}
      <div
        style={{
          position: 'absolute',
          top: 56,
          left: 44,
          right: 44,
          height: 840,
          background: '#f7efe0',
          borderLeft: '4px solid #b45309',
          borderRight: '4px solid #b45309',
          overflow: 'hidden',
        }}
      >
        {/* Ukiyo-e Rising Sun + Great Waves SVG */}
        <svg width="632" height="840" viewBox="0 0 632 840" style={{ position: 'absolute', inset: 0 }}>
          <circle cx={316} cy={380} r={145} fill="#dc2626" opacity={0.85} />
          <path
            d={`M -40 560 Q ${120 + waveShift} 430 280 545 T 670 520 L 670 840 L -40 840 Z`}
            fill="#1e3a5f"
            stroke="#0f172a"
            strokeWidth={4}
          />
          <path
            d={`M -40 640 Q ${190 - waveShift} 535 360 645 T 670 620 L 670 840 L -40 840 Z`}
            fill="#0f2942"
            stroke="#f7efe0"
            strokeWidth={3}
          />
        </svg>

        {/* Red Hanko Seal Stamp */}
        <div
          style={{
            position: 'absolute',
            top: 28,
            right: 28,
            width: 58,
            height: 58,
            border: '4px solid #b91c1c',
            background: '#dc2626',
            color: '#fef2f2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Georgia, serif',
            fontWeight: 900,
            fontSize: 22,
            borderRadius: 4,
          }}
        >
          {`0${sceneIdx + 1}`}
        </div>

        {/* Poetic Scroll Title */}
        <div style={{ position: 'relative', padding: '32px 104px 0 32px' }}>
          <div style={{ color: '#991b1b', fontSize: 16, fontWeight: 800, letterSpacing: 3, marginBottom: 8 }}>
            {kicker.toUpperCase()}
          </div>
          <div
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: fitHookFontSize(hookTitle, 44, 28),
              fontWeight: 900,
              color: '#1c1917',
              lineHeight: 1.08,
            }}
          >
            {hookTitle}
          </div>
        </div>

        {/* Story Scroll Fact Plaque */}
        <div
          style={{
            position: 'absolute',
            left: 32,
            right: 32,
            bottom: 34,
            background: 'rgba(247, 239, 224, 0.94)',
            border: '3px solid #991b1b',
            padding: '20px 24px',
          }}
        >
          <div style={{ color: '#991b1b', fontSize: 16, fontWeight: 900, letterSpacing: 2 }}>{scene.label.toUpperCase()}</div>
          <div style={{ fontFamily: 'Georgia, serif', color: '#1c1917', fontSize: 44, fontWeight: 900, marginTop: 4 }}>{scene.metric}</div>
          <div style={{ color: '#292524', fontSize: 22, fontWeight: 700, marginTop: 6 }}>{scene.detail}</div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 11. CINEMATIC 3D (Sejarah / Peta)
// ---------------------------------------------------------------------------
export const Cinematic3DLayout: React.FC<LayoutRenderProps> = ({
  hookTitle,
  kicker,
  palette,
  scene,
  sceneIdx,
  frame,
  progress,
}) => {
  const camScale = interpolate(progress, [0, 0.5, 1], [0.96, 1.08, 1.0]);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(180deg, ${palette.skyTop} 0%, ${palette.skyMid} 48%, ${palette.skyBottom} 64%, ${palette.groundTop} 65%, ${palette.groundBottom} 100%)`,
      }}
    >
      {/* Architectural / Topographic Horizon + Wireframe Scale Comparison */}
      <svg
        width="720"
        height="1280"
        viewBox="0 0 720 1280"
        style={{ position: 'absolute', inset: 0, transform: `scale(${camScale})`, transformOrigin: 'center 55%' }}
      >
        {/* Sun/horizon glow */}
        <circle cx={360} cy={520} r={190} fill={palette.accentGlow} opacity={0.22} />
        {/* Monument / mountain silhouette */}
        <path
          d="M 40 820 L 180 510 L 310 640 L 420 420 L 555 620 L 680 820 Z"
          fill="#1e293b"
          stroke={palette.accentGlow}
          strokeWidth={3}
        />
        {/* Wireframe comparison grid */}
        <rect x={470} y={420} width={140} height={360} fill="none" stroke={palette.accentGlow} strokeWidth={2} strokeDasharray="6 4" />
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`wf-${i}`} x1={470} y1={450 + i * 33} x2={610} y2={450 + i * 33} stroke={palette.accentGlow} strokeOpacity={0.45} />
        ))}
        {/* Callout pointer */}
        <circle cx={420} cy={420} r={7} fill={palette.accentGlow} />
        <polyline points="420,420 340,340 120,340" fill="none" stroke="#ffffff" strokeWidth={2.5} />
        <text x={120} y={326} fill="#ffffff" fontSize={22} fontWeight={800}>
          {scene.label.toUpperCase()}
        </text>
      </svg>

      {/* Cinematic Serif Header */}
      <div style={{ position: 'absolute', top: 68, left: 40, right: 40, textAlign: 'center' }}>
        <div style={{ color: palette.accentGlow, fontSize: 17, fontWeight: 800, letterSpacing: 4, marginBottom: 10 }}>
          {kicker.toUpperCase()}
        </div>
        <div
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: fitHookFontSize(hookTitle, 50, 32),
            fontWeight: 900,
            color: '#ffffff',
            lineHeight: 1.06,
            textShadow: '0 6px 24px rgba(0,0,0,0.85)',
          }}
        >
          {hookTitle}
        </div>
      </div>

      {/* Bottom Scale Callout Metric */}
      <div style={{ position: 'absolute', top: 750, left: 48, right: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 54, fontWeight: 900, color: palette.accentGlow, textShadow: '0 4px 18px rgba(0,0,0,0.9)' }}>
          {scene.metric}
        </div>
        <div style={{ fontSize: 23, fontWeight: 700, color: '#f8fafc', textShadow: '0 2px 10px rgba(0,0,0,0.95)', marginTop: 4 }}>
          {`[${sceneIdx + 1}/4] ${scene.detail}`}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 12. PRODUCT KEYNOTE (Promo / Keynote)
// ---------------------------------------------------------------------------
export const ProductKeynoteLayout: React.FC<LayoutRenderProps> = ({
  hookTitle,
  kicker,
  palette,
  scene,
  sceneIdx,
  frame,
  fps,
}) => {
  const floatY = Math.sin(frame * 0.06) * 10;
  const shimmerX = ((frame * 12) % 900) - 250;
  const cardSpring = spring({ frame: frame % 120, fps, config: { damping: 14, stiffness: 120 } });

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #05070e 0%, #0f172a 55%, #02040a 100%)' }}>
      {/* Stage Spotlight Cone */}
      <svg width="720" height="1280" viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0 }}>
        <polygon points="360,0 70,960 650,960" fill={palette.accent} opacity={0.14} />
        <ellipse cx={360} cy={835} rx={250} ry={34} fill={palette.accentGlow} opacity={0.22} />
      </svg>

      {/* Minimal Keynote Title */}
      <div style={{ position: 'absolute', top: 76, left: 42, right: 42, textAlign: 'center' }}>
        <div style={{ color: '#93c5fd', fontSize: 16, fontWeight: 700, letterSpacing: 4, marginBottom: 12 }}>
          {kicker.toUpperCase()}
        </div>
        <div
          style={{
            fontSize: fitHookFontSize(hookTitle, 48, 30),
            fontWeight: 900,
            color: '#ffffff',
            lineHeight: 1.06,
            letterSpacing: -0.5,
          }}
        >
          {hookTitle}
        </div>
      </div>

      {/* Floating Frosted Glass Spec Card with Shimmer */}
      <div
        style={{
          position: 'absolute',
          top: 315 + floatY,
          left: 56,
          right: 56,
          height: 430,
          borderRadius: 28,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 100%)',
          border: '2px solid rgba(255,255,255,0.28)',
          overflow: 'hidden',
          padding: '40px 36px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transform: `scale(${interpolate(cardSpring, [0, 1], [0.95, 1])})`,
        }}
      >
        {/* Animated diagonal glass shimmer */}
        <div
          style={{
            position: 'absolute',
            top: -80,
            left: shimmerX,
            width: 110,
            height: 600,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)',
            transform: 'rotate(22deg)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#60a5fa', fontSize: 16, fontWeight: 800, letterSpacing: 2.5 }}>
            {scene.label.toUpperCase()}
          </span>
          <span style={{ color: '#94a3b8', fontSize: 15, fontWeight: 700 }}>{`0${sceneIdx + 1} / 04`}</span>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 64, fontWeight: 900, color: '#ffffff', letterSpacing: -1.5, lineHeight: 1.05 }}>
            {scene.metric}
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#cbd5e1', marginTop: 18, lineHeight: 1.35 }}>
            {scene.detail}
          </div>
        </div>

        {/* Minimal Spec Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
          {[0, 1, 2, 3].map((d) => (
            <div
              key={`kd-${d}`}
              style={{
                width: d === sceneIdx ? 34 : 10,
                height: 10,
                borderRadius: 99,
                background: d === sceneIdx ? '#60a5fa' : 'rgba(255,255,255,0.25)',
              }}
            />
          ))}
        </div>
      </div>
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
