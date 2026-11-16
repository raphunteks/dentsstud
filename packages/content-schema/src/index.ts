import { z } from 'zod';

/**
 * Import package contracts (v1.1 §4.8). A package is a folder with manifest.json at its root.
 * Nothing here executes code: recipes are declarative JSON consumed by the Remotion compositions.
 */
export const SCHEMA_VERSION = 1;
export const FORMATS = ['9:16', '16:9', '1:1'] as const;
export type Format = (typeof FORMATS)[number];

const slug = z.string().min(2).max(150).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug: huruf kecil, angka, tanda hubung');
const relPath = z
  .string()
  .min(1)
  .max(300)
  .refine((p) => !p.startsWith('/') && !p.includes('\\') && !p.split('/').some((s) => s === '..' || s === '.' || s === ''), 'path relatif tanpa ..');
const sha256 = z.string().regex(/^[a-f0-9]{64}$/, 'sha256 hex');
const color = z.string().regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'warna #RRGGBB');

export const Rights = z.object({
  license: z.string().min(2).max(200),
  attribution: z.string().max(500).optional(),
  source: z.string().max(500).optional(),
  nonCommercialOnly: z.boolean().default(false),
});

export const FileEntry = z.object({
  path: relPath,
  sha256,
  role: z.enum(['thumbnail', 'preview', 'recipe', 'asset', 'font', 'sample', 'license']),
});
export type FileEntry = z.infer<typeof FileEntry>;

/** Declarative visual recipe: palette, type, motion and layer templates. */
export const PresetRecipe = z.object({
  palette: z.object({ background: color, surface: color.optional(), ink: color, accent: color, muted: color.optional() }),
  typography: z.object({
    display: z.string().min(1).max(120),
    body: z.string().min(1).max(120),
    displayWeight: z.number().int().min(100).max(900).default(600),
    fontFiles: z.array(relPath).default([]),
  }),
  motion: z.object({
    easing: z.enum(['linear', 'easeIn', 'easeOut', 'easeInOut', 'spring']).default('easeOut'),
    intensity: z.number().min(0).max(1).default(0.5),
    transition: z.enum(['cut', 'fade', 'slide', 'wipe', 'zoom']).default('fade'),
  }),
  layout: z.object({
    titleScale: z.number().min(0.5).max(2).default(1),
    safeArea: z.number().min(0).max(0.2).default(0.06),
    textAlign: z.enum(['left', 'center']).default('left'),
  }),
  textures: z.array(z.object({ path: relPath, blend: z.enum(['normal', 'multiply', 'screen', 'overlay']).default('normal'), opacity: z.number().min(0).max(1).default(0.3) })).default([]),
});
export type PresetRecipe = z.infer<typeof PresetRecipe>;

export const PresetManifest = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  kind: z.literal('preset'),
  slug,
  name: z.string().min(2).max(200),
  category: slug,
  description: z.string().max(2000).default(''),
  compatibility: z.object({ formats: z.array(z.enum(FORMATS)).min(1), minAppVersion: z.string().max(40).optional() }),
  rights: Rights,
  recipe: relPath.default('recipe.json'),
  files: z.array(FileEntry).min(1).max(200),
});
export type PresetManifest = z.infer<typeof PresetManifest>;

export const HookRecipe = z.object({
  durationSec: z.number().min(0.5).max(8),
  style: z.enum(['bongkar', 'bold', 'glass', 'neon', 'komik', 'custom']).default('custom'),
  text: z.object({ maxWords: z.number().int().min(1).max(20).default(8), case: z.enum(['as-is', 'upper', 'title']).default('as-is') }),
  animation: z.object({ in: z.enum(['pop', 'slide', 'type', 'mask', 'scale']).default('pop'), emphasis: z.enum(['none', 'shake', 'pulse', 'underline']).default('none') }),
  palette: z.object({ ink: color, accent: color, background: color.optional() }).optional(),
});
export type HookRecipe = z.infer<typeof HookRecipe>;

export const HookManifest = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  kind: z.literal('hook'),
  slug,
  name: z.string().min(2).max(200),
  compatibility: z.object({ formats: z.array(z.enum(FORMATS)).min(1) }),
  rights: Rights,
  recipe: HookRecipe,
  files: z.array(FileEntry).max(50).default([]),
});
export type HookManifest = z.infer<typeof HookManifest>;

export const TTS_PROVIDERS = ['gemini', 'elevenlabs', 'cadangan'] as const;
export type TtsProvider = (typeof TTS_PROVIDERS)[number];

export const VoiceCapabilities = z.object({ emotion: z.boolean().default(false), speed: z.boolean().default(false), pitch: z.boolean().default(false), instructions: z.boolean().default(false) });

export const VoiceManifest = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  kind: z.literal('voice'),
  slug,
  name: z.string().min(2).max(150),
  provider: z.enum(TTS_PROVIDERS),
  /** Gemini prebuilt voice name, ElevenLabs voice_id, or the fallback engine's voice id. */
  providerVoiceId: z.string().min(1).max(255),
  language: z.string().min(2).max(40),
  description: z.string().max(2000).default(''),
  attributes: z.object({ gender: z.enum(['male', 'female', 'neutral']).optional(), age: z.enum(['child', 'young', 'adult', 'senior']).optional(), tone: z.string().max(80).optional() }).default({}),
  capabilities: VoiceCapabilities.default({ emotion: false, speed: false, pitch: false, instructions: false }),
  synthesis: z.object({ model: z.string().max(120).optional(), stability: z.number().min(0).max(1).optional(), similarityBoost: z.number().min(0).max(1).optional() }).default({}),
  rights: Rights,
  sample: z.object({ path: relPath, text: z.string().max(1000).optional() }).optional(),
  files: z.array(FileEntry).max(20).default([]),
});
export type VoiceManifest = z.infer<typeof VoiceManifest>;

export const AnyManifest = z.discriminatedUnion('kind', [PresetManifest, HookManifest, VoiceManifest]);
export type AnyManifest = z.infer<typeof AnyManifest>;

/** Allowed file types: extension → MIME + magic-byte check. SVG/HTML/JS are never accepted. */
export const ALLOWED_FILES: Record<string, { mime: string; magic?: (b: Uint8Array) => boolean; maxBytes: number }> = {
  png: { mime: 'image/png', magic: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47, maxBytes: 20e6 },
  jpg: { mime: 'image/jpeg', magic: (b) => b[0] === 0xff && b[1] === 0xd8, maxBytes: 20e6 },
  jpeg: { mime: 'image/jpeg', magic: (b) => b[0] === 0xff && b[1] === 0xd8, maxBytes: 20e6 },
  webp: { mime: 'image/webp', magic: (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP', maxBytes: 20e6 },
  mp4: { mime: 'video/mp4', magic: (b) => ascii(b, 4, 4) === 'ftyp', maxBytes: 300e6 },
  webm: { mime: 'video/webm', magic: (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3, maxBytes: 300e6 },
  mp3: { mime: 'audio/mpeg', magic: (b) => ascii(b, 0, 3) === 'ID3' || (b[0] === 0xff && (b[1]! & 0xe0) === 0xe0), maxBytes: 30e6 },
  wav: { mime: 'audio/wav', magic: (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WAVE', maxBytes: 60e6 },
  ogg: { mime: 'audio/ogg', magic: (b) => ascii(b, 0, 4) === 'OggS', maxBytes: 30e6 },
  json: { mime: 'application/json', maxBytes: 2e6 },
  txt: { mime: 'text/plain', maxBytes: 1e6 },
  md: { mime: 'text/markdown', maxBytes: 1e6 },
  ttf: { mime: 'font/ttf', magic: (b) => (b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0) || ascii(b, 0, 4) === 'true', maxBytes: 10e6 },
  otf: { mime: 'font/otf', magic: (b) => ascii(b, 0, 4) === 'OTTO', maxBytes: 10e6 },
  woff2: { mime: 'font/woff2', magic: (b) => ascii(b, 0, 4) === 'wOF2', maxBytes: 10e6 },
};
function ascii(b: Uint8Array, off: number, len: number) {
  return String.fromCharCode(...b.subarray(off, off + len));
}
export const extOf = (p: string) => p.toLowerCase().split('.').pop() ?? '';

export function checkFileType(path: string, head: Uint8Array, size: number): string | null {
  const rule = ALLOWED_FILES[extOf(path)];
  if (!rule) return `Tipe file tidak didukung: ${path}`;
  if (size > rule.maxBytes) return `File terlalu besar: ${path}`;
  if (rule.magic && !rule.magic(head)) return `Isi file tidak sesuai ekstensinya: ${path}`;
  return null;
}

/** Normalizes a client-provided relative path; returns null if unsafe. */
export function safeRelPath(input: string): string | null {
  const p = input.replace(/\\/g, '/').replace(/^\.\/+/, '');
  if (!p || p.startsWith('/') || /^[a-zA-Z]:/.test(p) || p.includes('\0')) return null;
  const parts = p.split('/');
  if (parts.some((s) => s === '..' || s === '' || s === '.')) return null;
  if (parts.some((s) => s.startsWith('.') && s !== '.gitkeep')) return null; // hidden files (.DS_Store, .git)
  return parts.join('/');
}
