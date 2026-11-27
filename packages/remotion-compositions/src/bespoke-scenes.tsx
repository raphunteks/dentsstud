import React from 'react';
import { Easing, interpolate, spring } from 'remotion';
import type { ArchetypePalette, ViralSceneSpec } from './ViralStyleComp';

export interface BespokeSceneProps {
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

export function fitCleanTitle(text: string, maxPx = 52, minPx = 32): number {
  const len = text.trim().length;
  if (len <= 12) return maxPx;
  if (len <= 16) return Math.round(maxPx * 0.86);
  if (len <= 20) return Math.round(maxPx * 0.76);
  return Math.max(minPx, Math.round(maxPx * 0.68));
}

const CleanHeroHeader: React.FC<{
  hookTitle: string;
  metric: string;
  detail: string;
  color: string;
  accent: string;
  isLight?: boolean;
  serif?: boolean;
  frame: number;
  fps: number;
}> = ({ hookTitle, metric, detail, color, accent, isLight, serif, frame, fps }) => {
  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 120 } });
  const shadow = isLight
    ? '0 2px 14px rgba(255,255,255,0.92)'
    : '0 6px 26px rgba(0,0,0,0.82), 0 2px 6px rgba(0,0,0,0.9)';
  return (
    <div
      style={{
        position: 'absolute',
        top: 76,
        left: 44,
        right: 44,
        textAlign: 'center',
        transform: `translateY(${interpolate(enter, [0, 1], [-24, 0])}px)`,
        opacity: enter,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          fontFamily: serif ? 'Georgia, "Times New Roman", serif' : '"Chivo Variable", "Chivo", system-ui, sans-serif',
          fontSize: fitCleanTitle(hookTitle, 52, 32),
          fontWeight: 900,
          lineHeight: 1.04,
          letterSpacing: serif ? 0 : -0.8,
          color,
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
          letterSpacing: 0.4,
        }}
      >
        {metric} · {detail.slice(0, 38)}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 1. ISOMETRIK DIBONGKAR — Chip Neuralink 3D Isometric Cutaway
// ---------------------------------------------------------------------------
const IsometrikDibongkarScene: React.FC<BespokeSceneProps> = ({ hookTitle, scene, frame, fps, progress }) => {
  const explode = interpolate(progress, [0, 0.35, 0.72, 1], [18, 76, 62, 38], { easing: Easing.inOut(Easing.ease) });
  const pulse = 0.65 + Math.sin(frame * 0.16) * 0.35;
  const threadWave = Math.sin(frame * 0.08) * 14;

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 44%, #103b66 0%, #071d38 55%, #030b17 100%)' }}>
      <svg width="720" height="1280" viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0 }}>
        {/* Ground studio perspective grid */}
        <g opacity={0.22}>
          {Array.from({ length: 13 }).map((_, i) => (
            <line key={`nv-${i}`} x1={360 + (i - 6) * 28} y1={780} x2={360 + (i - 6) * 130} y2={1280} stroke="#38bdf8" strokeWidth={1.2} />
          ))}
          {Array.from({ length: 8 }).map((_, i) => {
            const t = i / 7;
            const y = 780 + t * t * 500;
            return <line key={`nh-${i}`} x1={0} y1={y} x2={720} y2={y} stroke="#38bdf8" strokeWidth={1.1} />;
          })}
        </g>

        {/* Soft floor light pool */}
        <ellipse cx={360} cy={830} rx={240} ry={48} fill="#38bdf8" opacity={0.14} />

        {/* Exploded 4-Layer Neuralink N1 Implant Cutaway */}
        <g transform="translate(360, 560)">
          {/* Layer 4 (Bottom): 1,024 Neural Micron Threads penetrating cortex */}
          <g transform={`translate(0, ${explode * 1.45})`}>
            <path
              d={`M -185 65 Q -90 ${35 + threadWave} 0 65 T 185 65`}
              fill="none"
              stroke="#f472b6"
              strokeWidth={3}
              opacity={0.75}
            />
            {Array.from({ length: 13 }).map((_, i) => {
              const x = -120 + i * 20;
              const yEnd = 68 + Math.sin(frame * 0.12 + i) * 12;
              return (
                <g key={`th-${i}`}>
                  <line x1={x} y1={-12} x2={x + Math.sin(i) * 8} y2={yEnd} stroke="#38bdf8" strokeWidth={1.8} opacity={0.85} />
                  <circle cx={x + Math.sin(i) * 8} cy={yEnd} r={3.5} fill="#fde047" opacity={pulse} />
                </g>
              );
            })}
          </g>

          {/* Layer 3: Silicon ASIC Processor Die */}
          <g transform={`translate(0, ${explode * 0.45})`}>
            <polygon points="0,-74 165,0 0,74 -165,0" fill="#0f294a" stroke="#38bdf8" strokeWidth={2.5} />
            <polygon points="0,-42 92,0 0,42 -92,0" fill="#0284c7" stroke="#bae6fd" strokeWidth={2} />
            <polygon points="0,-22 48,0 0,22 -48,0" fill="#fde047" opacity={0.85} />
          </g>

          {/* Layer 2: Inductive Charging Coil & Micro-Battery */}
          <g transform={`translate(0, ${-explode * 0.45})`}>
            <ellipse cx={0} cy={0} rx={155} ry={66} fill="#1e3a5f" fillOpacity={0.78} stroke="#7dd3fc" strokeWidth={2.5} />
            <ellipse cx={0} cy={0} rx={118} ry={48} fill="none" stroke="#f59e0b" strokeWidth={5} strokeDasharray="14 6" />
            <ellipse cx={0} cy={0} rx={82} ry={34} fill="none" stroke="#f59e0b" strokeWidth={3} />
          </g>

          {/* Layer 1 (Top): Hermetic Titanium Cap */}
          <g transform={`translate(0, ${-explode * 1.4})`}>
            <ellipse cx={0} cy={0} rx={164} ry={70} fill="#cbd5e1" stroke="#ffffff" strokeWidth={2.5} />
            <ellipse cx={0} cy={-6} rx={152} ry={60} fill="#94a3b8" opacity={0.65} />
            <ellipse cx={-35} cy={-18} rx={65} ry={18} fill="#ffffff" opacity={0.35} />
          </g>

          {/* Surgical Callout Pointers */}
          <circle cx={155} cy={-explode * 1.4} r={5} fill="#fde047" />
          <polyline points={`155,${-explode * 1.4} 215,${-explode * 1.4 - 36} 305,${-explode * 1.4 - 36}`} fill="none" stroke="#e2e8f0" strokeWidth={1.6} />
          <text x={218} y={-explode * 1.4 - 44} fill="#e2e8f0" fontSize={16} fontWeight={700}>TITANIUM SEAL</text>

          <circle cx={-120} cy={explode * 1.45 + 48} r={5} fill="#38bdf8" />
          <polyline points={`-120,${explode * 1.45 + 48} -190,${explode * 1.45 + 88} -310,${explode * 1.45 + 88}`} fill="none" stroke="#7dd3fc" strokeWidth={1.6} />
          <text x={-310} y={explode * 1.45 + 78} fill="#7dd3fc" fontSize={16} fontWeight={700}>1.024 ELEKTRODA</text>
        </g>
      </svg>

      <CleanHeroHeader hookTitle={hookTitle} metric={scene.metric} detail={scene.detail} color="#ffffff" accent="#7dd3fc" frame={frame} fps={fps} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 2. SEJARAH 3D — Kota Bawah Tanah Derinkuyu 85m Berlapis Tanah
// ---------------------------------------------------------------------------
const Sejarah3DScene: React.FC<BespokeSceneProps> = ({ hookTitle, scene, frame, fps, progress }) => {
  const depthPan = interpolate(progress, [0, 0.3, 0.8, 1], [0, -140, -240, -180], { easing: Easing.inOut(Easing.ease) });
  const torchGlow = 0.7 + Math.sin(frame * 0.25) * 0.3;

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #1b1834 0%, #6d4637 28%, #d4944e 42%, #3d2817 43%, #140c06 100%)' }}>
      <svg width="720" height="1280" viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0 }}>
        <g transform={`translate(0, ${depthPan})`}>
          {/* Sunset horizon & Anatolian hills */}
          <circle cx={560} cy={380} r={78} fill="#fde047" opacity={0.35} />
          <path d="M 0 510 L 160 440 L 340 485 L 520 430 L 720 495 L 720 1560 L 0 1560 Z" fill="#4a2e1a" />
          {/* Geological soil strata layers */}
          <path d="M 0 650 Q 360 630 720 660 L 720 1560 L 0 1560 Z" fill="#3a2313" />
          <path d="M 0 850 Q 360 880 720 845 L 720 1560 L 0 1560 Z" fill="#29170b" />
          <path d="M 0 1070 Q 360 1045 720 1085 L 720 1560 L 0 1560 Z" fill="#1a0f07" />

          {/* Vertical central ventilation shaft */}
          <rect x={344} y={485} width={32} height={760} fill="#0c0704" stroke="#92400e" strokeWidth={2} />

          {/* Carved underground chambers & connecting tunnels (18 levels simplified into rich cutaway) */}
          {[
            { x: 130, y: 580, w: 170, h: 68 },
            { x: 420, y: 615, w: 185, h: 72 },
            { x: 115, y: 745, w: 195, h: 78 },
            { x: 410, y: 790, w: 190, h: 74 },
            { x: 145, y: 925, w: 170, h: 82 },
            { x: 425, y: 965, w: 175, h: 78 },
            { x: 190, y: 1120, w: 340, h: 96 },
          ].map((c, i) => (
            <g key={`ch-${i}`}>
              <line x1={360} y1={c.y + c.h / 2} x2={c.x + c.w / 2} y2={c.y + c.h / 2} stroke="#0c0704" strokeWidth={22} />
              <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={24} fill="#120a05" stroke="#b45309" strokeWidth={2.5} />
              {/* Warm flickering torch light inside chamber */}
              <circle cx={c.x + c.w * 0.5} cy={c.y + c.h * 0.5} r={22} fill="#f59e0b" opacity={0.22 * torchGlow} />
              <circle cx={c.x + c.w * 0.5} cy={c.y + c.h * 0.5} r={5} fill="#fde047" opacity={torchGlow} />
            </g>
          ))}

          {/* Depth scale ruler on right */}
          <line x1={648} y1={495} x2={648} y2={1220} stroke="#fbbf24" strokeWidth={2} strokeDasharray="6 6" />
          <text x={636} y={512} textAnchor="end" fill="#fef3c7" fontSize={17} fontWeight={800}>0 M</text>
          <text x={636} y={860} textAnchor="end" fill="#fde047" fontSize={18} fontWeight={800}>-45 M</text>
          <text x={636} y={1215} textAnchor="end" fill="#fbbf24" fontSize={22} fontWeight={900}>-85 M</text>
        </g>
      </svg>

      <CleanHeroHeader hookTitle={hookTitle} metric={scene.metric} detail={scene.detail} color="#fef3c7" accent="#fbbf24" serif frame={frame} fps={fps} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 3. TUBUH ANIME — Jantung 200 BPM + Pembuluh Darah Anime
// ---------------------------------------------------------------------------
const TubuhAnimeScene: React.FC<BespokeSceneProps> = ({ hookTitle, scene, frame, fps }) => {
  // 200 BPM = 3.33 beats/sec -> rapid energetic anime pulse
  const beat = 1 + Math.pow(Math.max(0, Math.sin(frame * 0.35)), 3) * 0.14;
  const ecgOffset = (frame * 16) % 720;

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, #580b23 0%, #1c0512 58%, #090208 100%)' }}>
      <svg width="720" height="1280" viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0 }}>
        {/* Shonen Anime Radial Speed Lines */}
        <g transform="translate(360, 580)" opacity={0.28}>
          {Array.from({ length: 24 }).map((_, i) => (
            <polygon
              key={`sl-${i}`}
              points="0,0 -8,-720 8,-720"
              fill={i % 2 === 0 ? '#f43f5e' : '#38bdf8'}
              transform={`rotate(${i * 15 + (frame % 3)})`}
            />
          ))}
        </g>

        {/* Glowing Branching Arteries */}
        <g stroke="#fb7185" strokeWidth={12} fill="none" strokeLinecap="round" opacity={0.55}>
          <path d="M 360 440 C 310 310 210 260 110 230" />
          <path d="M 360 440 C 420 300 520 250 620 220" />
          <path d="M 360 720 C 300 840 190 910 95 970" />
          <path d="M 360 720 C 430 850 540 910 640 960" />
        </g>

        {/* Adrenaline / Dopamine Energy Orbs racing along arteries */}
        {Array.from({ length: 12 }).map((_, i) => {
          const t = ((frame * 0.04 + i / 12) % 1);
          const angle = (i * Math.PI) / 6;
          const dist = 120 + t * 280;
          return (
            <circle
              key={`orb-${i}`}
              cx={360 + Math.cos(angle) * dist}
              cy={580 + Math.sin(angle) * dist}
              r={8}
              fill={i % 2 === 0 ? '#38bdf8' : '#fde047'}
              opacity={1 - t}
            />
          );
        })}

        {/* Stylized High-Energy Anime Heart */}
        <g transform={`translate(360, 585) scale(${beat})`}>
          <circle cx={0} cy={0} r={185} fill="#f43f5e" opacity={0.18} />
          <path
            d="M 0 148 C -155 58 -182 -76 -88 -124 C -32 -152 0 -98 0 -68 C 0 -98 32 -152 88 -124 C 182 -76 155 58 0 148 Z"
            fill="#e11d48"
            stroke="#fff1f2"
            strokeWidth={6}
          />
          <path d="M -68 -68 Q -42 -96 -14 -72" fill="none" stroke="#ffffff" strokeWidth={8} strokeLinecap="round" opacity={0.7} />
        </g>

        {/* Live Electric Cyan ECG Spike Line */}
        <polyline
          points="0,840 160,840 215,840 250,760 285,920 325,695 365,935 405,795 445,840 720,840"
          fill="none"
          stroke="#22d3ee"
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="720"
          strokeDashoffset={720 - ecgOffset}
        />
      </svg>

      <CleanHeroHeader hookTitle={hookTitle} metric={scene.metric} detail={scene.detail} color="#ffffff" accent="#fde047" frame={frame} fps={fps} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 4. DUNIA 2D — Kamar Jam 3 Pagi + Jam Berdetak
// ---------------------------------------------------------------------------
const Dunia2DScene: React.FC<BespokeSceneProps> = ({ hookTitle, scene, frame, fps }) => {
  const drift = Math.sin(frame * 0.04) * 14;
  const secAngle = ((frame * 6) % 360) - 90;

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #1b1d3a 0%, #2a2c54 55%, #191830 100%)' }}>
      <svg width="720" height="1280" viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0 }}>
        {/* Bedroom Window with Midnight Moon & Stars */}
        <rect x={84} y={295} width={250} height={310} rx={14} fill="#0f1535" stroke="#475569" strokeWidth={8} />
        <circle cx={245} cy={380} r={34} fill="#fef08a" />
        <circle cx={260} cy={372} r={30} fill="#0f1535" />
        <circle cx={145} cy={360} r={3} fill="#ffffff" />
        <circle cx={190} cy={425} r={2.5} fill="#ffffff" />
        <circle cx={280} cy={470} r={3} fill="#ffffff" />
        <line x1={209} y1={295} x2={209} y2={605} stroke="#475569" strokeWidth={6} />
        <line x1={84} y1={450} x2={334} y2={450} stroke="#475569" strokeWidth={6} />

        {/* Wall Analog Clock ticking at 03:00 */}
        <g transform="translate(525, 420)">
          <circle cx={0} cy={0} r={96} fill="#fef3c7" stroke="#b45309" strokeWidth={10} />
          <line x1={0} y1={0} x2={48} y2={0} stroke="#1c1917" strokeWidth={8} strokeLinecap="round" />
          <line x1={0} y1={0} x2={0} y2={-64} stroke="#1c1917" strokeWidth={6} strokeLinecap="round" />
          <line
            x1={0}
            y1={0}
            x2={Math.cos((secAngle * Math.PI) / 180) * 74}
            y2={Math.sin((secAngle * Math.PI) / 180) * 74}
            stroke="#dc2626"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <circle cx={0} cy={0} r={7} fill="#dc2626" />
        </g>

        {/* Warm Bedside Lamp Cone */}
        <polygon points="555,700 410,960 700,960" fill="#fde047" opacity={0.14} />
        <path d="M 520 700 L 590 700 L 575 640 L 535 640 Z" fill="#f59e0b" stroke="#fef3c7" strokeWidth={3} />
        <rect x={551} y={700} width={8} height={60} fill="#94a3b8" />

        {/* Cozy Bed & Sleepless Silhouette + Floating Overthinking Clouds */}
        <rect x={60} y={760} width={450} height={150} rx={24} fill="#312e81" stroke="#6366f1" strokeWidth={4} />
        <ellipse cx={145} cy={755} rx={58} ry={26} fill="#e2e8f0" />
        <circle cx={165} cy={725} r={34} fill="#fde68a" />
        <circle cx={155} cy={720} r={4} fill="#0f172a" />
        <circle cx={175} cy={720} r={4} fill="#0f172a" />

        {/* Drifting thought cloud */}
        <g transform={`translate(${245 + drift}, 625)`} opacity={0.85}>
          <circle cx={0} cy={55} r={10} fill="#e2e8f0" />
          <circle cx={22} cy={30} r={16} fill="#e2e8f0" />
          <ellipse cx={82} cy={-8} rx={78} ry={36} fill="#f8fafc" />
          <text x={82} y={0} textAnchor="middle" fill="#312e81" fontSize={22} fontWeight={900}>03:00 AM...</text>
        </g>
      </svg>

      <CleanHeroHeader hookTitle={hookTitle} metric={scene.metric} detail={scene.detail} color="#fef3c7" accent="#fde047" frame={frame} fps={fps} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 5. KARTUN CEL — Gaji Terbang Jadi Paket Belanja
// ---------------------------------------------------------------------------
const KartunCelScene: React.FC<BespokeSceneProps> = ({ hookTitle, scene, frame, fps }) => {
  const bounce = spring({ frame: frame % 60, fps, config: { damping: 9, stiffness: 160 } });
  const flyX = ((frame * 6.5) % 620) - 80;

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #38bdf8 0%, #7dd3fc 52%, #fef08a 53%, #fde047 100%)' }}>
      <svg width="720" height="1280" viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0 }}>
        {/* Fluffy cel-shaded clouds */}
        <g fill="#ffffff" stroke="#0f172a" strokeWidth={5}>
          <ellipse cx={140} cy={310} rx={74} ry={34} />
          <ellipse cx={580} cy={365} rx={86} ry={38} />
        </g>

        {/* Expressive Cartoon Wallet on Left */}
        <g transform={`translate(165, 675) scale(${interpolate(bounce, [0, 1], [0.92, 1.04])})`}>
          <rect x={-95} y={-68} width={190} height={136} rx={22} fill="#b45309" stroke="#0f172a" strokeWidth={7} />
          <rect x={25} y={-24} width={78} height={48} rx={12} fill="#f59e0b" stroke="#0f172a" strokeWidth={6} />
          <circle cx={58} cy={0} r={10} fill="#fef08a" stroke="#0f172a" strokeWidth={4} />
          {/* Surprised cartoon eyes */}
          <circle cx={-42} cy={-16} r={14} fill="#ffffff" stroke="#0f172a" strokeWidth={4} />
          <circle cx={-8} cy={-16} r={14} fill="#ffffff" stroke="#0f172a" strokeWidth={4} />
          <circle cx={-38} cy={-16} r={5} fill="#0f172a" />
          <circle cx={-4} cy={-16} r={5} fill="#0f172a" />
        </g>

        {/* Winged Rupiah Bills Flying Away */}
        {[0, 1, 2].map((i) => {
          const x = 180 + ((flyX + i * 160) % 440);
          const y = 520 - Math.sin((frame + i * 20) * 0.14) * 55 - i * 28;
          const flap = Math.sin(frame * 0.45 + i) * 18;
          return (
            <g key={`bill-${i}`} transform={`translate(${x}, ${y}) rotate(${-10 + i * 6})`}>
              <polygon points="-30,-10 -65,-38 -45,10" fill="#ffffff" stroke="#0f172a" strokeWidth={4} transform={`rotate(${flap})`} />
              <polygon points="30,-10 65,-38 45,10" fill="#ffffff" stroke="#0f172a" strokeWidth={4} transform={`rotate(${-flap})`} />
              <rect x={-48} y={-24} width={96} height={48} rx={8} fill="#22c55e" stroke="#0f172a" strokeWidth={5} />
              <text x={0} y={8} textAnchor="middle" fill="#ffffff" fontSize={22} fontWeight={900}>Rp</text>
            </g>
          );
        })}

        {/* Stack of Shopping Parcels Landing on Right */}
        <g transform="translate(530, 710)">
          <rect x={-78} y={-55} width={156} height={118} rx={12} fill="#fb923c" stroke="#0f172a" strokeWidth={7} />
          <rect x={-16} y={-55} width={32} height={118} fill="#f43f5e" stroke="#0f172a" strokeWidth={4} />
          <rect x={-56} y={-148} width={112} height={94} rx={10} fill="#facc15" stroke="#0f172a" strokeWidth={7} />
          <text x={0} y={-92} textAnchor="middle" fill="#0f172a" fontSize={24} fontWeight={900}>COD</text>
        </g>
      </svg>

      <CleanHeroHeader hookTitle={hookTitle} metric={scene.metric} detail={scene.detail} color="#0f172a" accent="#e11d48" isLight frame={frame} fps={fps} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 6. PETA RELIEF — Palung Mariana 11.000m + Kapal Selam + Sonar
// ---------------------------------------------------------------------------
const PetaReliefScene: React.FC<BespokeSceneProps> = ({ hookTitle, scene, frame, fps, progress }) => {
  const subY = interpolate(progress, [0, 0.5, 1], [370, 620, 790]);
  const sonarR = ((frame * 4.5) % 240) + 30;

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #0ea5e9 0%, #0369a1 22%, #0c2d54 48%, #041024 78%, #020612 100%)' }}>
      <svg width="720" height="1280" viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0 }}>
        {/* Ocean surface waves */}
        <path d="M 0 265 Q 180 245 360 265 T 720 265 L 720 290 L 0 290 Z" fill="#38bdf8" opacity={0.35} />

        {/* Steep Mariana Trench Bathymetric Canyon Walls */}
        <path d="M 0 380 L 185 520 L 245 860 L 295 1180 L 0 1180 Z" fill="#07192f" stroke="#38bdf8" strokeWidth={2.5} />
        <path d="M 720 360 L 540 535 L 475 880 L 425 1180 L 720 1180 Z" fill="#07192f" stroke="#38bdf8" strokeWidth={2.5} />

        {/* Expanding Sonar Ping Rings */}
        <circle cx={360} cy={subY} r={sonarR} fill="none" stroke="#22d3ee" strokeWidth={2.5} opacity={Math.max(0, 1 - sonarR / 270)} />
        <circle cx={360} cy={subY} r={((sonarR + 120) % 240) + 30} fill="none" stroke="#22d3ee" strokeWidth={2} opacity={0.45} />

        {/* Deep-Sea Research Submersible with Volumetric Headlight Cone */}
        <g transform={`translate(${360 + Math.sin(frame * 0.05) * 24}, ${subY})`}>
          <polygon points="52,6 240,115 240,-45" fill="#fde047" opacity={0.22} />
          <ellipse cx={0} cy={0} rx={58} ry={26} fill="#facc15" stroke="#0f172a" strokeWidth={4} />
          <rect x={-18} y={-38} width={30} height={18} rx={6} fill="#eab308" stroke="#0f172a" strokeWidth={3} />
          <circle cx={24} cy={-2} r={11} fill="#38bdf8" stroke="#ffffff" strokeWidth={3} />
        </g>

        {/* Bathymetric Depth Markers */}
        <text x={668} y={420} textAnchor="end" fill="#7dd3fc" fontSize={18} fontWeight={800}>-1.000 M</text>
        <text x={668} y={660} textAnchor="end" fill="#38bdf8" fontSize={19} fontWeight={800}>-6.000 M</text>
        <text x={668} y={920} textAnchor="end" fill="#fde047" fontSize={22} fontWeight={900}>-11.000 M</text>
      </svg>

      <CleanHeroHeader hookTitle={hookTitle} metric={scene.metric} detail={scene.detail} color="#ffffff" accent="#fde047" frame={frame} fps={fps} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 7. PROMO PRODUK — Kacamata Spasial Hologram Studio
// ---------------------------------------------------------------------------
const PromoProdukScene: React.FC<BespokeSceneProps> = ({ hookTitle, scene, frame, fps }) => {
  const floatY = Math.sin(frame * 0.06) * 12;
  const shimmerX = ((frame * 10) % 520) - 260;

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 42%, #1d2c4c 0%, #090e1c 56%, #03050a 100%)' }}>
      <svg width="720" height="1280" viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0 }}>
        {/* Volumetric Studio Top Spotlight */}
        <polygon points="360,0 90,940 630,940" fill="#60a5fa" opacity={0.11} />
        <ellipse cx={360} cy={835} rx={240} ry={34} fill="#38bdf8" opacity={0.18} />

        {/* Projected Translucent Holographic Arcs in Mid-Air */}
        <g transform={`translate(360, ${440 + floatY * 0.5})`} opacity={0.75}>
          <path d="M -210 20 A 220 90 0 0 1 210 20" fill="none" stroke="#38bdf8" strokeWidth={2.5} strokeDasharray="8 6" />
          <rect x={-170} y={-88} width={104} height={58} rx={12} fill="#38bdf8" fillOpacity={0.16} stroke="#7dd3fc" strokeWidth={2} />
          <rect x={-48} y={-106} width={104} height={68} rx={12} fill="#a855f7" fillOpacity={0.2} stroke="#e9d5ff" strokeWidth={2} />
          <rect x={72} y={-88} width={104} height={58} rx={12} fill="#22d3ee" fillOpacity={0.16} stroke="#a5f3fc" strokeWidth={2} />
        </g>

        {/* Sleek Floating Spatial-Computing Glasses */}
        <g transform={`translate(360, ${620 + floatY})`}>
          {/* Aluminum frame */}
          <path
            d="M -185 -46 C -185 -84 185 -84 185 -46 L 195 28 C 195 82 62 96 22 44 C 8 28 -8 28 -22 44 C -62 96 -195 82 -195 28 Z"
            fill="#0f172a"
            stroke="#e2e8f0"
            strokeWidth={7}
          />
          {/* Curved glass visor reflection */}
          <path
            d="M -172 -38 C -172 -70 172 -70 172 -38 L 180 22 C 180 68 58 80 22 36 C 8 20 -8 20 -22 36 C -58 80 -180 68 -180 22 Z"
            fill="#1e3a8a"
            fillOpacity={0.62}
          />
          <line x1={shimmerX} y1={-75} x2={shimmerX + 75} y2={85} stroke="#ffffff" strokeWidth={18} opacity={0.22} />
        </g>
      </svg>

      <CleanHeroHeader hookTitle={hookTitle} metric={scene.metric} detail={scene.detail} color="#ffffff" accent="#93c5fd" frame={frame} fps={fps} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 8. BIKIN DARI NOL — Kanvas Grid 3D Dibangun Dari 1 Prompt Teks
// ---------------------------------------------------------------------------
const BikinDariNolScene: React.FC<BespokeSceneProps> = ({ hookTitle, scene, frame, fps, progress }) => {
  const assemble = interpolate(progress, [0, 0.5, 1], [0.25, 1, 1], { easing: Easing.out(Easing.cubic) });
  const typedLen = Math.min(28, Math.floor((frame % 120) / 3) + 4);
  const promptText = 'Buat adegan 3D edukasi viral...'.slice(0, typedLen);

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 48%, #16183b 0%, #090b1c 58%, #04050e 100%)' }}>
      <svg width="720" height="1280" viewBox="0 0 720 1280" style={{ position: 'absolute', inset: 0 }}>
        {/* 3D Perspective Wireframe Canvas Grid */}
        <g opacity={0.26}>
          {Array.from({ length: 13 }).map((_, i) => (
            <line key={`bgv-${i}`} x1={360 + (i - 6) * 32} y1={760} x2={360 + (i - 6) * 140} y2={1280} stroke="#818cf8" strokeWidth={1.3} />
          ))}
          {Array.from({ length: 8 }).map((_, i) => {
            const t = i / 7;
            return <line key={`bgh-${i}`} x1={0} y1={760 + t * t * 520} x2={720} y2={760 + t * t * 520} stroke="#818cf8" strokeWidth={1.2} />;
          })}
        </g>

        {/* Assembling 3D Wireframe Cube & Glowing Planes */}
        <g transform={`translate(360, 610) scale(${assemble})`}>
          {/* Back wireframe cube */}
          <polygon points="0,-165 165,-75 165,95 0,185 -165,95 -165,-75" fill="#4f46e5" fillOpacity={0.18} stroke="#818cf8" strokeWidth={3} />
          <line x1={0} y1={-165} x2={0} y2={185} stroke="#22d3ee" strokeWidth={2} strokeDasharray="6 6" />
          <line x1={-165} y1={-75} x2={165} y2={95} stroke="#22d3ee" strokeWidth={2} strokeDasharray="6 6" />
          <line x1={165} y1={-75} x2={-165} y2={95} stroke="#22d3ee" strokeWidth={2} strokeDasharray="6 6" />
          {/* Extruded glowing core prism */}
          <polygon points="0,-88 88,-40 0,8 -88,-40" fill="#22d3ee" fillOpacity={0.85} />
          <polygon points="-88,-40 0,8 0,104 -88,56" fill="#6366f1" fillOpacity={0.85} />
          <polygon points="88,-40 0,8 0,104 88,56" fill="#a855f7" fillOpacity={0.85} />
        </g>
      </svg>

      {/* Single Clean Prompt Input Bar */}
      <div
        style={{
          position: 'absolute',
          top: 268,
          left: 68,
          right: 68,
          padding: '16px 24px',
          borderRadius: 999,
          background: 'rgba(15, 23, 42, 0.78)',
          border: '2px solid rgba(129, 140, 248, 0.7)',
          color: '#e0e7ff',
          fontFamily: '"Courier New", monospace',
          fontSize: 21,
          fontWeight: 700,
          textAlign: 'center',
        }}
      >
        {`> ${promptText}|`}
      </div>

      <CleanHeroHeader hookTitle={hookTitle} metric={scene.metric} detail={scene.detail} color="#ffffff" accent="#22d3ee" frame={frame} fps={fps} />
    </div>
  );
};

export const BESPOKE_SCENES: Record<string, React.FC<BespokeSceneProps>> = {
  'isometrik-dibongkar': IsometrikDibongkarScene,
  'sejarah-3d': Sejarah3DScene,
  'tubuh-anime': TubuhAnimeScene,
  'dunia-2d': Dunia2DScene,
  'kartun-cel': KartunCelScene,
  'peta-relief': PetaReliefScene,
  'promo-produk': PromoProdukScene,
  'bikin-dari-nol': BikinDariNolScene,
};
