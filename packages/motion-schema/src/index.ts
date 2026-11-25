import { z } from 'zod';

/** Motion document: the single source of truth for the editor, Remotion and the AI Motion Director. */
export const MOTION_SCHEMA_VERSION = 1;
export const FORMAT_SIZE = { '9:16': { width: 1080, height: 1920 }, '16:9': { width: 1920, height: 1080 }, '1:1': { width: 1080, height: 1080 } } as const;
export type Format = keyof typeof FORMAT_SIZE;

const color = z.string().regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
const id = z.string().min(1).max(64);
export const EASINGS = ['linear', 'easeIn', 'easeOut', 'easeInOut', 'spring'] as const;
export const ANIMATABLE = ['x', 'y', 'scale', 'rotation', 'opacity'] as const;
export type AnimProp = (typeof ANIMATABLE)[number];

export const Keyframe = z.object({ frame: z.number().int().min(0), value: z.number(), easing: z.enum(EASINGS).default('easeOut') });
export type Keyframe = z.infer<typeof Keyframe>;

const LayerBase = z.object({
  id,
  name: z.string().max(120).default(''),
  /** Relative to the scene (0..1 of width/height), anchor = centre. */
  x: z.number().min(-2).max(3).default(0.5),
  y: z.number().min(-2).max(3).default(0.5),
  w: z.number().min(0).max(4).default(0.8),
  h: z.number().min(0).max(4).default(0.2),
  rotation: z.number().min(-3600).max(3600).default(0),
  scale: z.number().min(0).max(20).default(1),
  opacity: z.number().min(0).max(1).default(1),
  startFrame: z.number().int().min(0).default(0),
  durationFrames: z.number().int().min(1).optional(),
  keyframes: z.partialRecord(z.enum(ANIMATABLE), z.array(Keyframe).max(60)).default({}),
  effect: z.enum(['none', 'fade', 'rise', 'pop', 'wipe', 'typewriter', 'blur']).default('none'),
  locked: z.boolean().default(false),
  hidden: z.boolean().default(false),
});

export const TextLayer = LayerBase.extend({
  type: z.literal('text'),
  text: z.string().max(2000),
  role: z.enum(['title', 'body', 'caption', 'label']).default('body'),
  fontSize: z.number().min(8).max(400).optional(),
  fontWeight: z.number().int().min(100).max(900).optional(),
  color: color.optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  background: color.optional(),
});
export const ShapeLayer = LayerBase.extend({
  type: z.literal('shape'),
  shape: z.enum(['rect', 'circle', 'line']).default('rect'),
  fill: color.optional(),
  stroke: color.optional(),
  strokeWidth: z.number().min(0).max(80).default(0),
  radius: z.number().min(0).max(1).default(0),
});
export const ImageLayer = LayerBase.extend({ type: z.literal('image'), assetId: z.uuid().optional(), src: z.string().max(2000).optional(), fit: z.enum(['cover', 'contain']).default('cover') });
export const VideoLayer = LayerBase.extend({ type: z.literal('video'), assetId: z.uuid().optional(), src: z.string().max(2000).optional(), muted: z.boolean().default(true), fit: z.enum(['cover', 'contain']).default('cover') });
export const Layer = z.discriminatedUnion('type', [TextLayer, ShapeLayer, ImageLayer, VideoLayer]);
export type Layer = z.infer<typeof Layer>;

export const Scene = z.object({
  id,
  name: z.string().max(120).default(''),
  durationFrames: z.number().int().min(1).max(30 * 600),
  background: color.optional(),
  transition: z.enum(['cut', 'fade', 'slide', 'wipe', 'zoom']).default('fade'),
  narration: z.string().max(4000).optional(),
  layers: z.array(Layer).max(80).default([]),
});
export type Scene = z.infer<typeof Scene>;

export const AudioTrack = z.object({
  id,
  kind: z.enum(['narration', 'music', 'sfx']),
  assetId: z.uuid().optional(),
  src: z.string().max(2000).optional(),
  startFrame: z.number().int().min(0).default(0),
  durationFrames: z.number().int().min(1).optional(),
  volume: z.number().min(0).max(2).default(1),
});
export type AudioTrack = z.infer<typeof AudioTrack>;

export const Style = z.object({
  presetSlug: z.string().max(150).optional(),
  presetName: z.string().max(120).optional(),
  palette: z.object({
    background: color,
    surface: color.optional(),
    ink: color,
    accent: color,
    muted: color.optional(),
    secondary: color.optional(),
    highlight: color.optional(),
  }),
  typography: z.object({ display: z.string().max(120), body: z.string().max(120), displayWeight: z.number().int().default(600) }),
  motion: z.object({ easing: z.enum(EASINGS).default('easeOut'), intensity: z.number().min(0).max(1).default(0.5), transition: z.enum(['cut', 'fade', 'slide', 'wipe', 'zoom']).default('fade') }),
  layout: z.object({ titleScale: z.number().default(1), safeArea: z.number().default(0.06), textAlign: z.enum(['left', 'center']).default('left') }),
});
export type Style = z.infer<typeof Style>;

export const DEFAULT_STYLE: Style = {
  palette: { background: '#141210', ink: '#f4efe5', accent: '#d9a441', muted: '#a09b92' },
  typography: { display: 'Chivo', body: 'Chivo', displayWeight: 600 },
  motion: { easing: 'easeOut', intensity: 0.5, transition: 'fade' },
  layout: { titleScale: 1, safeArea: 0.06, textAlign: 'left' },
};

export const BrandOverlay = z.object({
  name: z.string().max(120).optional(),
  logoUrl: z.string().max(2000).optional(),
  logoAssetId: z.uuid().optional(),
});
export type BrandOverlay = z.infer<typeof BrandOverlay>;

export const MotionDocument = z.object({
  schemaVersion: z.literal(MOTION_SCHEMA_VERSION),
  title: z.string().max(255).default('Tanpa judul'),
  format: z.enum(['9:16', '16:9', '1:1']),
  width: z.number().int().min(160).max(3840),
  height: z.number().int().min(160).max(3840),
  fps: z.number().int().min(12).max(60),
  preset: z.object({ id: z.uuid(), version: z.number().int(), name: z.string().optional(), slug: z.string().optional() }).nullish(),
  hook: z.object({ id: z.uuid(), version: z.number().int(), text: z.string().max(200), recipe: z.record(z.string(), z.unknown()) }).nullish(),
  brand: BrandOverlay.nullish(),
  style: Style.default(DEFAULT_STYLE),
  scenes: z.array(Scene).min(1).max(200),
  audio: z.array(AudioTrack).max(50).default([]),
});
export type MotionDocument = z.infer<typeof MotionDocument>;
export type MotionDocumentInput = z.input<typeof MotionDocument>;

export const durationOf = (d: Pick<MotionDocument, 'scenes'>) => d.scenes.reduce((a, s) => a + s.durationFrames, 0);

export function newDocument(format: Format, title = 'Project baru', fps = 30): MotionDocument {
  const { width, height } = FORMAT_SIZE[format];
  return MotionDocument.parse({
    schemaVersion: 1, title, format, width, height, fps,
    scenes: [{ id: 's1', name: 'Scene 1', durationFrames: fps * 4, layers: [{ id: 't1', type: 'text', role: 'title', text: title, y: 0.42, effect: 'rise' }] }],
  });
}

// ---------------- interpolation (pure; used by the editor preview and Remotion) ----------------
const EASE: Record<(typeof EASINGS)[number], (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t * t,
  easeOut: (t) => 1 - (1 - t) ** 3,
  easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  spring: (t) => 1 - Math.cos(t * Math.PI * 4.5) * Math.exp(-t * 6),
};

/** Value of an animatable prop at `frame` (scene-relative): keyframes win, else the static value. */
export function valueAt(layer: Pick<Layer, AnimProp | 'keyframes'>, prop: AnimProp, frame: number): number {
  const kfs = layer.keyframes?.[prop];
  if (!kfs || kfs.length === 0) return layer[prop];
  const ks = [...kfs].sort((a, b) => a.frame - b.frame);
  if (frame <= ks[0]!.frame) return ks[0]!.value;
  const last = ks[ks.length - 1]!;
  if (frame >= last.frame) return last.value;
  for (let i = 0; i < ks.length - 1; i++) {
    const a = ks[i]!;
    const b = ks[i + 1]!;
    if (frame >= a.frame && frame <= b.frame) {
      const t = b.frame === a.frame ? 1 : (frame - a.frame) / (b.frame - a.frame);
      return a.value + (b.value - a.value) * EASE[b.easing](t);
    }
  }
  return last.value;
}

/** Entrance effect: progress 0..1 over the first `len` frames of the layer. */
export function effectAt(effect: Layer['effect'], local: number, len = 18) {
  const t = Math.max(0, Math.min(1, local / len));
  const e = EASE.easeOut(t);
  switch (effect) {
    case 'fade': return { opacity: e, dy: 0, scale: 1, clip: 1, blur: 0 };
    case 'rise': return { opacity: e, dy: (1 - e) * 0.04, scale: 1, clip: 1, blur: 0 };
    case 'pop': return { opacity: Math.min(1, t * 3), dy: 0, scale: 0.8 + 0.2 * EASE.spring(t), clip: 1, blur: 0 };
    case 'wipe': return { opacity: 1, dy: 0, scale: 1, clip: e, blur: 0 };
    case 'blur': return { opacity: e, dy: 0, scale: 1, clip: 1, blur: (1 - e) * 16 };
    case 'typewriter': return { opacity: 1, dy: 0, scale: 1, clip: t, blur: 0 };
    default: return { opacity: 1, dy: 0, scale: 1, clip: 1, blur: 0 };
  }
}

// ---------------- operations (editor + sync) ----------------
export const Operation = z.discriminatedUnion('op', [
  z.object({ op: z.literal('replaceDocument'), document: MotionDocument }),
  z.object({ op: z.literal('updateScene'), sceneId: id, patch: Scene.partial().omit({ id: true, layers: true }) }),
  z.object({ op: z.literal('addScene'), scene: Scene, index: z.number().int().min(0).optional() }),
  z.object({ op: z.literal('removeScene'), sceneId: id }),
  z.object({ op: z.literal('moveScene'), sceneId: id, index: z.number().int().min(0) }),
  z.object({ op: z.literal('addLayer'), sceneId: id, layer: Layer }),
  z.object({ op: z.literal('updateLayer'), sceneId: id, layerId: id, patch: z.record(z.string(), z.unknown()) }),
  z.object({ op: z.literal('removeLayer'), sceneId: id, layerId: id }),
  z.object({ op: z.literal('setMeta'), patch: z.object({ title: z.string().max(255).optional(), style: Style.optional(), preset: MotionDocument.shape.preset.optional(), brand: MotionDocument.shape.brand.optional(), audio: z.array(AudioTrack).max(50).optional() }) }),
]);
export type Operation = z.infer<typeof Operation>;

/** Applies an operation immutably and re-validates the whole document. Throws on invalid results. */
export function applyOperation(doc: MotionDocument, op: Operation): MotionDocument {
  const d: MotionDocument = JSON.parse(JSON.stringify(doc)) as MotionDocument;
  const scene = (sid: string) => {
    const s = d.scenes.find((x) => x.id === sid);
    if (!s) throw new Error(`Scene ${sid} tidak ada`);
    return s;
  };
  switch (op.op) {
    case 'replaceDocument':
      return MotionDocument.parse(op.document);
    case 'updateScene':
      Object.assign(scene(op.sceneId), op.patch);
      break;
    case 'addScene':
      if (d.scenes.some((s) => s.id === op.scene.id)) throw new Error('ID scene duplikat');
      d.scenes.splice(op.index ?? d.scenes.length, 0, op.scene);
      break;
    case 'removeScene':
      if (d.scenes.length <= 1) throw new Error('Minimal satu scene');
      d.scenes = d.scenes.filter((s) => s.id !== op.sceneId);
      break;
    case 'moveScene': {
      const i = d.scenes.findIndex((s) => s.id === op.sceneId);
      if (i < 0) throw new Error('Scene tidak ada');
      const [s] = d.scenes.splice(i, 1);
      d.scenes.splice(Math.min(op.index, d.scenes.length), 0, s!);
      break;
    }
    case 'addLayer': {
      const s = scene(op.sceneId);
      if (s.layers.some((l) => l.id === op.layer.id)) throw new Error('ID layer duplikat');
      s.layers.push(op.layer);
      break;
    }
    case 'updateLayer': {
      const s = scene(op.sceneId);
      const i = s.layers.findIndex((l) => l.id === op.layerId);
      if (i < 0) throw new Error('Layer tidak ada');
      const { id: _i, type: _t, ...patch } = op.patch as Record<string, unknown>;
      s.layers[i] = { ...s.layers[i]!, ...patch } as Layer;
      break;
    }
    case 'removeLayer':
      scene(op.sceneId).layers = scene(op.sceneId).layers.filter((l) => l.id !== op.layerId);
      break;
    case 'setMeta':
      Object.assign(d, Object.fromEntries(Object.entries(op.patch).filter(([, v]) => v !== undefined)));
      break;
  }
  return MotionDocument.parse(d);
}
