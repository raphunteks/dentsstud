import yauzl from 'yauzl';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { safeRelPath } from '@dentweb/content-schema';

export interface ZipLimits {
  maxEntries: number;
  maxTotalBytes: number;
  maxRatio: number;
}

/** Bounded ZIP extraction: no traversal, no symlinks, entry/size/ratio limits enforced while streaming. */
export async function extractZip(zipPath: string, destRoot: string, limits: ZipLimits): Promise<string[]> {
  const zip = await new Promise<yauzl.ZipFile>((res, rej) => yauzl.open(zipPath, { lazyEntries: true, autoClose: true, strictFileNames: true, validateEntrySizes: true }, (e, z) => (e ? rej(e) : res(z!))));
  if (zip.entryCount > limits.maxEntries) {
    zip.close();
    throw new Error(`Arsip berisi ${zip.entryCount} entri (maks ${limits.maxEntries})`);
  }
  const written: string[] = [];
  let total = 0;
  return new Promise((resolve, reject) => {
    const fail = (e: Error) => {
      zip.close();
      reject(e);
    };
    zip.on('error', fail);
    zip.on('end', () => resolve(written));
    zip.on('entry', (entry: yauzl.Entry) => {
      if (entry.fileName.endsWith('/')) return zip.readEntry();
      const mode = (entry.externalFileAttributes >>> 16) & 0o170000;
      if (mode === 0o120000) return fail(new Error(`Symlink ditolak: ${entry.fileName}`));
      const rel = safeRelPath(entry.fileName);
      if (!rel) {
        if (/(^|\/)(__MACOSX|\.DS_Store)/.test(entry.fileName)) return zip.readEntry();
        return fail(new Error(`Path tidak aman di arsip: ${entry.fileName}`));
      }
      if (entry.compressedSize > 0 && entry.uncompressedSize / entry.compressedSize > limits.maxRatio) return fail(new Error(`Rasio kompresi mencurigakan (ZIP bomb): ${rel}`));
      total += entry.uncompressedSize;
      if (total > limits.maxTotalBytes) return fail(new Error('Ukuran total arsip melebihi batas'));
      zip.openReadStream(entry, async (err, rs) => {
        if (err || !rs) return fail(err ?? new Error('stream'));
        const out = join(destRoot, rel);
        try {
          await mkdir(dirname(out), { recursive: true });
          let n = 0;
          const guard = new Transform({
            transform(chunk: Buffer, _e, cb) {
              n += chunk.length;
              if (n > entry.uncompressedSize) return cb(new Error(`Ukuran entri tidak sesuai header: ${rel}`));
              cb(null, chunk);
            },
          });
          await pipeline(rs, guard, createWriteStream(out, { flags: 'wx' }));
          written.push(rel);
          zip.readEntry();
        } catch (e) {
          fail(e as Error);
        }
      });
    });
    zip.readEntry();
  });
}
