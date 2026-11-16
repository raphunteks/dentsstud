import { lstat, readdir } from 'node:fs/promises';
import { openAsBlob } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { request, requestForm } from '../ipc/api-client.js';

const ALLOWED = /\.(json|png|jpe?g|webp|mp4|webm|mp3|wav|ogg|ttf|otf|woff2|txt|md)$/i;

/** Scans a folder the Superadmin picked: no symlinks, no hidden files, allowed types only, bounded. */
export async function scanFolder(root: string) {
  const files: { abs: string; rel: string; size: number }[] = [];
  const skipped: string[] = [];
  let total = 0;
  async function walk(dir: string, depth: number) {
    if (depth > 8) return;
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      const abs = join(dir, e.name);
      const st = await lstat(abs);
      if (st.isSymbolicLink()) { skipped.push(`${e.name} (symlink)`); continue; }
      if (st.isDirectory()) { await walk(abs, depth + 1); continue; }
      if (!ALLOWED.test(e.name)) { skipped.push(relative(root, abs)); continue; }
      total += st.size;
      if (files.length >= 2000 || total > 500 * 1024 * 1024) throw new Error('Folder melebihi batas import (2000 file / 500 MB)');
      files.push({ abs, rel: relative(root, abs).split(sep).join('/'), size: st.size });
    }
  }
  await walk(root, 0);
  return { files, total, skipped };
}

export async function importFolder(root: string, kind: 'preset' | 'voice' | 'hook', onProgress: (p: number) => void) {
  const scan = await scanFolder(root);
  if (!scan.files.length) throw new Error('Tidak ada file yang bisa diimpor di folder ini');
  const batch = await request<{ id: string }>('POST', '/admin/imports/init', { kind, source: 'LOCAL_FOLDER' });
  for (let i = 0; i < scan.files.length; i += 40) {
    const chunk = scan.files.slice(i, i + 40);
    const fd = new FormData();
    fd.append('paths', JSON.stringify(chunk.map((f) => f.rel)));
    for (const f of chunk) fd.append('files', await openAsBlob(f.abs), f.rel.split('/').pop()!);
    await requestForm(`/admin/imports/upload?batchId=${batch.id}`, fd);
    onProgress(Math.min(1, (i + chunk.length) / scan.files.length));
  }
  const validated = await request('POST', '/admin/imports/validate', { batchId: batch.id });
  return { validated, skipped: scan.skipped };
}
