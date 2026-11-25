import yauzl from 'yauzl';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { safeRelPath } from '@dentweb/content-schema';
import { loadEnv } from '../../config/env.js';

export interface MotionSkill {
  id: string;
  name: string;
  description: string;
  content: string;
  active: boolean;
  sourceType: 'manual' | 'zip' | 'folder';
  filesCount: number;
  files: string[];
  totalBytes: number;
  storagePath: string;
  createdAt: string;
  updatedAt: string;
}

export interface RawSkillFile {
  path: string;
  content?: string;
  base64?: string;
  buffer?: Buffer;
}

export interface ParsedSkillBundle {
  name: string;
  description: string;
  content: string;
  filesCount: number;
  fileList: string[];
  totalBytes: number;
  files: { path: string; data: Buffer }[];
}

const MAX_ZIP_ENTRIES = 5000;
const MAX_ZIP_BYTES = 500 * 1024 * 1024;
const MAX_ZIP_RATIO = 150;

export function slugifySkill(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'skill'
  );
}

export function normalizeSkill(s: Partial<MotionSkill> & { id: string; name: string; content: string }): MotionSkill {
  const createdAt = s.createdAt ?? new Date().toISOString();
  const slug = slugifySkill(s.name);
  const files = Array.isArray(s.files) ? s.files : ['SKILL.md'];
  return {
    id: s.id,
    name: s.name,
    description: s.description ?? '',
    content: s.content,
    active: s.active ?? true,
    sourceType: s.sourceType ?? 'manual',
    filesCount: typeof s.filesCount === 'number' && s.filesCount > 0 ? s.filesCount : files.length || 1,
    files,
    totalBytes: typeof s.totalBytes === 'number' && s.totalBytes >= 0 ? s.totalBytes : Buffer.byteLength(s.content ?? '', 'utf8'),
    storagePath: s.storagePath ?? `objects/skills/${slug}`,
    createdAt,
    updatedAt: s.updatedAt ?? createdAt,
  };
}

export function parseFrontmatter(md: string): { name?: string; description?: string; body: string } {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { body: md };
  const yaml = m[1] ?? '';
  const body = m[2] ?? '';
  let name: string | undefined;
  let description: string | undefined;
  const lines = yaml.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const kv = line.match(/^(name|description)\s*:\s*(.*)$/i);
    if (!kv) continue;
    const key = kv[1]!.toLowerCase();
    let val = kv[2]!.trim();
    if (val === '|' || val === '>' || val === '|-' || val === '>-') {
      const multi: string[] = [];
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1]!)) {
        multi.push(lines[++i]!.trim());
      }
      val = multi.join(' ').trim();
    } else {
      val = val.replace(/^['"]|['"]$/g, '').trim();
    }
    if (key === 'name' && val) name = val;
    if (key === 'description' && val) description = val;
  }
  return { name, description, body };
}

function inferDescription(body: string): string {
  for (const line of body.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('```') || t.startsWith('---')) continue;
    return t.slice(0, 240);
  }
  return '';
}

function isMarkdownLike(path: string): boolean {
  return /\.(md|markdown|txt)$/i.test(path);
}

function toBuffer(f: RawSkillFile): Buffer {
  if (f.buffer) return f.buffer;
  if (f.base64) return Buffer.from(f.base64, 'base64');
  return Buffer.from(f.content ?? '', 'utf8');
}

export function extractSkillsFromFiles(rawFiles: RawSkillFile[], fallbackName?: string): ParsedSkillBundle[] {
  const clean: { path: string; data: Buffer; text?: string }[] = [];
  for (const f of rawFiles) {
    if (!f?.path) continue;
    const normalized = f.path.replace(/\\/g, '/').replace(/^\/+/, '');
    if (/(^|\/)(__MACOSX|\.DS_Store|node_modules|\.git)(\/|$)/i.test(normalized)) continue;
    const rel = safeRelPath(normalized);
    if (!rel) throw new Error(`Path file tidak aman: ${f.path}`);
    const data = toBuffer(f);
    const text = isMarkdownLike(rel) ? (f.content ?? data.toString('utf8')) : undefined;
    clean.push({ path: rel, data, text });
  }
  if (!clean.length) return [];

  const skillMdEntries = clean.filter((f) => basename(f.path).toLowerCase() === 'skill.md' && f.text?.trim());

  if (skillMdEntries.length > 0) {
    return skillMdEntries.map((entry) => {
      const dir = dirname(entry.path);
      const prefix = dir === '.' ? '' : `${dir}/`;
      const group = clean.filter((f) => (prefix ? f.path.startsWith(prefix) : true));
      const fm = parseFrontmatter(entry.text!);
      const dirName = dir !== '.' ? basename(dir) : undefined;
      const name = (fm.name || dirName || fallbackName || 'untitled-skill').slice(0, 120);
      const description = (fm.description || inferDescription(fm.body)).slice(0, 500);
      const relFiles = group.map((f) => ({ path: prefix ? f.path.slice(prefix.length) : f.path, data: f.data }));
      const totalBytes = relFiles.reduce((sum, f) => sum + f.data.length, 0);
      return {
        name,
        description,
        content: entry.text!,
        filesCount: relFiles.length,
        fileList: relFiles.map((f) => f.path),
        totalBytes,
        files: relFiles,
      };
    });
  }

  // No SKILL.md found — fall back to markdown files (or bundle all files under fallbackName if single-folder upload)
  const mdFiles = clean.filter((f) => f.text?.trim());
  if (!mdFiles.length) return [];

  if (mdFiles.length === 1 && clean.length > 1) {
    const primary = mdFiles[0]!;
    const fm = parseFrontmatter(primary.text!);
    const name = (fm.name || fallbackName || basename(primary.path).replace(/\.(md|markdown|txt)$/i, '') || 'untitled-skill').slice(0, 120);
    const description = (fm.description || inferDescription(fm.body)).slice(0, 500);
    const totalBytes = clean.reduce((sum, f) => sum + f.data.length, 0);
    return [
      {
        name,
        description,
        content: primary.text!,
        filesCount: clean.length,
        fileList: clean.map((f) => f.path),
        totalBytes,
        files: clean.map((f) => ({ path: f.path, data: f.data })),
      },
    ];
  }

  return mdFiles.map((f) => {
    const fm = parseFrontmatter(f.text!);
    const stem = basename(f.path).replace(/\.(md|markdown|txt)$/i, '');
    const name = (fm.name || (mdFiles.length === 1 && fallbackName ? fallbackName : stem) || 'untitled-skill').slice(0, 120);
    const description = (fm.description || inferDescription(fm.body)).slice(0, 500);
    return {
      name,
      description,
      content: f.text!,
      filesCount: 1,
      fileList: [basename(f.path)],
      totalBytes: f.data.length,
      files: [{ path: basename(f.path), data: f.data }],
    };
  });
}

function readZipEntries(zip: yauzl.ZipFile): Promise<RawSkillFile[]> {
  if (zip.entryCount > MAX_ZIP_ENTRIES) {
    zip.close();
    return Promise.reject(new Error(`Arsip berisi ${zip.entryCount} entri (maks ${MAX_ZIP_ENTRIES})`));
  }

  const out: RawSkillFile[] = [];
  let totalBytes = 0;

  return new Promise((resolvePromise, rejectPromise) => {
    const fail = (e: Error) => {
      zip.close();
      rejectPromise(e);
    };
    zip.on('error', fail);
    zip.on('end', () => resolvePromise(out));
    zip.on('entry', (entry: yauzl.Entry) => {
      if (entry.fileName.endsWith('/')) return zip.readEntry();
      const mode = (entry.externalFileAttributes >>> 16) & 0o170000;
      if (mode === 0o120000) return fail(new Error(`Symlink ditolak: ${entry.fileName}`));
      if (/(^|\/)(__MACOSX|\.DS_Store|node_modules|\.git)(\/|$)/i.test(entry.fileName)) return zip.readEntry();

      const rel = safeRelPath(entry.fileName);
      if (!rel) return fail(new Error(`Path tidak aman di arsip: ${entry.fileName}`));

      if (entry.compressedSize > 0 && entry.uncompressedSize / entry.compressedSize > MAX_ZIP_RATIO) {
        return fail(new Error(`Rasio kompresi mencurigakan: ${rel}`));
      }
      totalBytes += entry.uncompressedSize;
      if (totalBytes > MAX_ZIP_BYTES) return fail(new Error('Ukuran total arsip melebihi batas 500 MB'));

      zip.openReadStream(entry, (err, rs) => {
        if (err || !rs) return fail(err ?? new Error('Gagal membaca entri ZIP'));
        const chunks: Buffer[] = [];
        let size = 0;
        rs.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > entry.uncompressedSize + 4096 || size > MAX_ZIP_BYTES) {
            rs.destroy(new Error(`Ukuran entri tidak sesuai: ${rel}`));
            return;
          }
          chunks.push(chunk);
        });
        rs.on('error', (e) => fail(e));
        rs.on('end', () => {
          const buf = Buffer.concat(chunks);
          out.push({
            path: rel,
            buffer: buf,
            ...(isMarkdownLike(rel) ? { content: buf.toString('utf8') } : {}),
          });
          zip.readEntry();
        });
      });
    });
    zip.readEntry();
  });
}

export async function readZipSkillFiles(buffer: Buffer): Promise<RawSkillFile[]> {
  const zip = await new Promise<yauzl.ZipFile>((res, rej) =>
    yauzl.fromBuffer(buffer, { lazyEntries: true, autoClose: true, strictFileNames: true, validateEntrySizes: true }, (e, z) => (e ? rej(e) : res(z!))),
  );
  return readZipEntries(zip);
}

export async function readZipAllSkillFilesFromPath(zipPath: string): Promise<RawSkillFile[]> {
  const zip = await new Promise<yauzl.ZipFile>((res, rej) =>
    yauzl.open(zipPath, { lazyEntries: true, autoClose: true, strictFileNames: true, validateEntrySizes: true }, (e, z) => (e ? rej(e) : res(z!))),
  );
  return readZipEntries(zip);
}

function skillsContentRoot(): string {
  const candidates = [resolve(process.cwd(), 'content/skills'), resolve(process.cwd(), '../../content/skills')];
  for (const c of candidates) {
    if (existsSync(dirname(c))) return c;
  }
  return candidates[0]!;
}

/** Persist all skill files into VPS object storage (apps/api/.data/storage/objects/skills/<slug>/) AND mirror to content/skills/<slug>/. */
export async function persistSkillFiles(slug: string, files: { path: string; data: Buffer }[]): Promise<string> {
  const safeSlug = slugifySkill(slug);
  const relStoragePath = `objects/skills/${safeSlug}`;
  const roots: string[] = [];

  try {
    const storageDir = loadEnv().STORAGE_DIR;
    roots.push(resolve(storageDir, relStoragePath));
  } catch {
    roots.push(resolve(process.cwd(), '.data/storage', relStoragePath));
  }
  roots.push(join(skillsContentRoot(), safeSlug));

  for (const root of roots) {
    try {
      for (const f of files) {
        const rel = safeRelPath(f.path);
        if (!rel) continue;
        const target = join(root, rel);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, f.data);
      }
    } catch {
      // Non-fatal mirror failure
    }
  }
  return relStoragePath;
}
