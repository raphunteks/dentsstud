import { makeCancelSignal, renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MotionDocument } from '@dentweb/motion-schema';

/** Prebuilt Remotion bundle shipped with this package (scripts/bundle.mjs). */
export const BUNDLE_DIR = fileURLToPath(new URL('../../bundle', import.meta.url));
export type OutputFormat = 'mp4' | 'webm' | 'gif';
const CODEC = { mp4: 'h264', webm: 'vp8', gif: 'gif' } as const;

export interface RenderOptions {
  doc: unknown;
  outPath: string;
  format?: OutputFormat;
  serveUrl?: string;
  browserExecutable?: string | null;
  concurrency?: number | null;
  onProgress?: (p: number, stage: string) => void;
  signal?: AbortSignal;
}

/** Renders a validated MotionDocument with Remotion + FFmpeg (bundled compositor). */
export async function renderDocument(o: RenderOptions) {
  const doc = MotionDocument.parse(o.doc);
  const serveUrl = o.serveUrl ?? BUNDLE_DIR;
  if (!o.serveUrl && !existsSync(BUNDLE_DIR)) throw new Error('Bundle Remotion belum dibangun (pnpm --filter @dentweb/remotion-compositions build)');
  const inputProps = { doc };
  const browserExecutable = o.browserExecutable ?? process.env.REMOTION_BROWSER_EXECUTABLE ?? null;
  let composition;
  try {
    composition = await selectComposition({ serveUrl, id: 'DentswebMotion', inputProps, browserExecutable });
  } catch {
    composition = await selectComposition({ serveUrl, id: 'DentwebMotion', inputProps, browserExecutable });
  }
  const { cancelSignal, cancel } = makeCancelSignal();
  o.signal?.addEventListener('abort', () => cancel());
  const format = o.format ?? 'mp4';
  await renderMedia({
    composition,
    serveUrl,
    codec: CODEC[format],
    outputLocation: o.outPath,
    inputProps,
    browserExecutable,
    concurrency: o.concurrency ?? null,
    cancelSignal,
    everyNthFrame: format === 'gif' ? 2 : 1,
    onProgress: ({ progress, stitchStage }) => o.onProgress?.(progress, stitchStage),
  });
  return { outPath: o.outPath, durationInFrames: composition.durationInFrames, fps: composition.fps, width: composition.width, height: composition.height };
}

export async function renderCover(o: { doc: unknown; outPath: string; title?: string; serveUrl?: string; browserExecutable?: string | null }) {
  const doc = MotionDocument.parse(o.doc);
  const serveUrl = o.serveUrl ?? BUNDLE_DIR;
  const inputProps = { doc, coverTitle: o.title };
  const browserExecutable = o.browserExecutable ?? process.env.REMOTION_BROWSER_EXECUTABLE ?? null;
  let composition;
  try {
    composition = await selectComposition({ serveUrl, id: 'DentswebCover', inputProps, browserExecutable });
  } catch {
    composition = await selectComposition({ serveUrl, id: 'DentwebCover', inputProps, browserExecutable });
  }
  await renderStill({ composition, serveUrl, output: o.outPath, inputProps, browserExecutable, imageFormat: 'png' });
  return { outPath: o.outPath };
}
