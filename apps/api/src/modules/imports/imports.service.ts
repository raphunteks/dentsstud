import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { mkdir, open, readFile, readdir, rename, rm, stat, lstat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import {
  type Database, hookPresets, hookVersions, importBatches, importItems, presetAssets, styleCategories, visualPresetVersions, visualPresets,
  voiceProfiles, voiceSamples, voiceVersions,
} from '@dentweb/database';
import { AnyManifest, PresetRecipe, checkFileType, safeRelPath, type FileEntry } from '@dentweb/content-schema';
import { DB, ENV } from '../../infra/tokens.js';
import type { Env } from '../../config/env.js';
import { AuditService } from '../../infra/infra.module.js';
import { StorageService } from '../../infra/storage.js';
import { Errors } from '../../infra/errors.js';
import { MediaService } from '../media/media.service.js';
import { extractZip } from './zip.js';

export type ImportKind = 'preset' | 'voice' | 'hook';
type ItemStatus = 'VALID' | 'INVALID' | 'DUPLICATE' | 'COMMITTED' | 'FAILED';

interface Pkg {
  root: string;
  manifest?: AnyManifest;
  errors: string[];
  checksum: string;
  status: ItemStatus;
}

@Injectable()
export class ImportsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly storage: StorageService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
  ) {}

  private dir(batchId: string) {
    return this.storage.scratch('imports', batchId, 'files');
  }

  private async batch(id: string) {
    const [b] = await this.db.select().from(importBatches).where(eq(importBatches.id, id));
    if (!b) throw Errors.notFound('Batch import');
    return b;
  }

  async init(actorId: string, kind: ImportKind, source: 'LOCAL_FOLDER' | 'DASHBOARD_UPLOAD') {
    const [b] = await this.db.insert(importBatches).values({ createdBy: actorId, kind, source, status: 'STAGING', summary: { files: 0, bytes: 0 } }).returning();
    await mkdir(this.dir(b!.id), { recursive: true });
    await this.audit.log({ actorId, action: 'import.init', targetType: 'import_batch', targetId: b!.id, metadata: { kind, source } });
    return b!;
  }

  /** Moves multer temp files into staging under their sanitized relative paths, or extracts a zip. */
  async addFiles(batchId: string, files: { path: string; originalname: string; size: number }[], relPaths: string[]) {
    const b = await this.batch(batchId);
    if (b.status !== 'STAGING') throw Errors.conflict('IMPORT_LOCKED', 'Batch sudah divalidasi atau ditutup');
    const root = this.dir(batchId);
    const summary = b.summary as { files: number; bytes: number };
    const added: string[] = [];
    try {
      for (const [i, f] of files.entries()) {
        const rel = safeRelPath(relPaths[i] ?? f.originalname);
        if (!rel) throw Errors.invalid('IMPORT_PATH', `Path tidak aman: ${relPaths[i] ?? f.originalname}`);
        if (summary.bytes + f.size > this.env.UPLOAD_MAX_BYTES) throw Errors.invalid('IMPORT_TOO_LARGE', 'Total upload melebihi batas');
        if (rel.toLowerCase().endsWith('.zip')) {
          const out = await extractZip(f.path, root, { maxEntries: 2000, maxTotalBytes: this.env.UPLOAD_MAX_BYTES - summary.bytes, maxRatio: 100 });
          for (const p of out) {
            const s = await stat(join(root, p));
            summary.files += 1;
            summary.bytes += s.size;
          }
          added.push(...out);
          await rm(f.path, { force: true });
          continue;
        }
        const dest = join(root, rel);
        await mkdir(dirname(dest), { recursive: true });
        await rename(f.path, dest);
        summary.files += 1;
        summary.bytes += f.size;
        added.push(rel);
      }
    } finally {
      await Promise.all(files.map((f) => rm(f.path, { force: true })));
    }
    await this.db.update(importBatches).set({ summary }).where(eq(importBatches.id, batchId));
    return { added: added.length, summary };
  }

  private async walk(root: string, base = root): Promise<string[]> {
    const out: string[] = [];
    for (const e of await readdir(root, { withFileTypes: true })) {
      const p = join(root, e.name);
      const l = await lstat(p);
      if (l.isSymbolicLink()) continue;
      if (e.isDirectory()) out.push(...(await this.walk(p, base)));
      else out.push(relative(base, p));
    }
    return out;
  }

  private async head(path: string) {
    const fh = await open(path, 'r');
    try {
      const buf = Buffer.alloc(16);
      await fh.read(buf, 0, 16, 0);
      return buf;
    } finally {
      await fh.close();
    }
  }

  private async validatePackage(kind: ImportKind, root: string, rootRel: string): Promise<Pkg> {
    const errors: string[] = [];
    const pkg: Pkg = { root: rootRel, errors, checksum: '', status: 'INVALID' };
    let raw: unknown;
    try {
      const txt = await readFile(join(root, 'manifest.json'), 'utf8');
      if (txt.length > 2e6) throw new Error('manifest terlalu besar');
      raw = JSON.parse(txt);
    } catch (e) {
      errors.push(`manifest.json tidak dapat dibaca: ${(e as Error).message}`);
      return pkg;
    }
    const parsed = AnyManifest.safeParse(raw);
    if (!parsed.success) {
      errors.push(...parsed.error.issues.slice(0, 20).map((i) => `manifest.${i.path.join('.')}: ${i.message}`));
      return pkg;
    }
    const m = parsed.data;
    pkg.manifest = m;
    if (m.kind !== kind) errors.push(`Batch ini untuk ${kind}, manifest berjenis ${m.kind}`);

    const hashes: string[] = [];
    for (const f of m.files as FileEntry[]) {
      const p = join(root, f.path);
      const s = await stat(p).catch(() => null);
      if (!s?.isFile()) {
        errors.push(`File hilang: ${f.path}`);
        continue;
      }
      const typeErr = checkFileType(f.path, await this.head(p), s.size);
      if (typeErr) errors.push(typeErr);
      const sha = await StorageService.hashFile(p);
      if (sha !== f.sha256) errors.push(`Checksum tidak cocok: ${f.path}`);
      hashes.push(`${f.path}:${sha}`);
    }
    const roles = (r: string) => (m.files as FileEntry[]).filter((f) => f.role === r);

    if (m.kind === 'preset') {
      const [cat] = await this.db.select().from(styleCategories).where(eq(styleCategories.slug, m.category));
      if (!cat) errors.push(`Kategori tidak dikenal: ${m.category}`);
      if (roles('thumbnail').length !== 1) errors.push('Preset wajib punya tepat 1 file thumbnail');
      const rf = (m.files as FileEntry[]).find((f) => f.path === m.recipe);
      if (!rf) errors.push(`Recipe ${m.recipe} tidak terdaftar di files`);
      else {
        try {
          const rec = PresetRecipe.safeParse(JSON.parse(await readFile(join(root, m.recipe), 'utf8')));
          if (!rec.success) errors.push(...rec.error.issues.slice(0, 10).map((i) => `recipe.${i.path.join('.')}: ${i.message}`));
          else {
            const listed = new Set((m.files as FileEntry[]).map((f) => f.path));
            for (const p of [...rec.data.typography.fontFiles, ...rec.data.textures.map((t) => t.path)]) if (!listed.has(p)) errors.push(`Recipe merujuk file yang tidak terdaftar: ${p}`);
          }
        } catch (e) {
          errors.push(`recipe tidak valid: ${(e as Error).message}`);
        }
      }
      const [dup] = await this.db.select({ id: visualPresets.id }).from(visualPresets).where(eq(visualPresets.slug, m.slug));
      if (dup) pkg.status = 'DUPLICATE';
    }
    if (m.kind === 'voice') {
      if (m.sample && !(m.files as FileEntry[]).some((f) => f.path === m.sample!.path && f.role === 'sample')) errors.push('sample.path harus terdaftar di files dengan role "sample"');
      const [dup] = await this.db.select({ id: voiceProfiles.id }).from(voiceProfiles).where(eq(voiceProfiles.slug, m.slug));
      if (dup) pkg.status = 'DUPLICATE';
    }
    if (m.kind === 'hook') {
      const [dup] = await this.db.select({ id: hookPresets.id }).from(hookPresets).where(eq(hookPresets.slug, m.slug));
      if (dup) pkg.status = 'DUPLICATE';
    }
    pkg.checksum = createHash('sha256').update(JSON.stringify(m)).update(hashes.sort().join('|')).digest('hex');
    if (errors.length) pkg.status = 'INVALID';
    else if (pkg.status !== 'DUPLICATE') pkg.status = 'VALID';
    if (pkg.status === 'DUPLICATE') errors.push(`Slug "${m.slug}" sudah ada di katalog`);
    return pkg;
  }

  async validate(actorId: string, batchId: string) {
    const b = await this.batch(batchId);
    if (!['STAGING', 'VALIDATED'].includes(b.status)) throw Errors.conflict('IMPORT_LOCKED', `Batch berstatus ${b.status}`);
    const root = this.dir(batchId);
    const all = await this.walk(root);
    const roots = all.filter((p) => p === 'manifest.json' || p.endsWith('/manifest.json')).map((p) => dirname(p));
    const pkgs: Pkg[] = [];
    if (roots.length === 0) pkgs.push({ root: '.', errors: ['Tidak ada manifest.json di upload ini'], checksum: '0'.repeat(64), status: 'INVALID' });
    for (const r of roots) pkgs.push(await this.validatePackage(b.kind as ImportKind, join(root, r), r));
    // same slug twice inside one batch
    const seen = new Map<string, number>();
    for (const p of pkgs) if (p.manifest) seen.set(p.manifest.slug, (seen.get(p.manifest.slug) ?? 0) + 1);
    for (const p of pkgs) if (p.manifest && seen.get(p.manifest.slug)! > 1) (p.status = 'INVALID'), p.errors.push(`Slug ${p.manifest.slug} muncul lebih dari sekali di batch`);

    await this.db.transaction(async (tx) => {
      await tx.delete(importItems).where(eq(importItems.batchId, batchId));
      await tx.insert(importItems).values(
        pkgs.map((p) => ({ batchId, originalPath: p.root, checksum: p.checksum || '0'.repeat(64), itemType: b.kind, status: p.status, validationErrors: p.errors })),
      );
      const counts = pkgs.reduce<Record<string, number>>((a, p) => ((a[p.status] = (a[p.status] ?? 0) + 1), a), {});
      await tx.update(importBatches).set({ status: 'VALIDATED', summary: { ...(b.summary as object), packages: pkgs.length, ...counts } }).where(eq(importBatches.id, batchId));
    });
    await this.audit.log({ actorId, action: 'import.validate', targetType: 'import_batch', targetId: batchId, metadata: { packages: pkgs.length } });
    return this.get(batchId);
  }

  async commit(actorId: string, batchId: string) {
    const b = await this.batch(batchId);
    if (b.status !== 'VALIDATED') throw Errors.conflict('IMPORT_NOT_VALIDATED', 'Validasi batch terlebih dahulu');
    const items = await this.db.select().from(importItems).where(and(eq(importItems.batchId, batchId), eq(importItems.status, 'VALID')));
    const root = this.dir(batchId);
    let committed = 0;
    let failed = 0;
    for (const it of items) {
      try {
        const pkgRoot = join(root, it.originalPath);
        const m = AnyManifest.parse(JSON.parse(await readFile(join(pkgRoot, 'manifest.json'), 'utf8')));
        const assets = new Map<string, { id: string; role: string }>();
        for (const f of m.files as FileEntry[]) {
          const row = await this.media.ingestFile(actorId, join(pkgRoot, f.path), f.path.split('/').pop()!, { metadata: { importBatch: batchId, path: f.path, role: f.role, rights: m.rights } });
          assets.set(f.path, { id: row.id, role: f.role });
        }
        const targetId = await this.db.transaction(async (tx) => {
          if (m.kind === 'preset') {
            const [cat] = await tx.select().from(styleCategories).where(eq(styleCategories.slug, m.category));
            const recipe = PresetRecipe.parse(JSON.parse(await readFile(join(pkgRoot, m.recipe), 'utf8')));
            const thumb = [...assets.values()].find((a) => a.role === 'thumbnail');
            const prev = [...assets.values()].find((a) => a.role === 'preview');
            const [p] = await tx
              .insert(visualPresets)
              .values({ categoryId: cat!.id, slug: m.slug, name: m.name, description: m.description, status: 'DRAFT', currentVersion: 1, thumbnailAssetId: thumb?.id, previewAssetId: prev?.id, createdBy: actorId })
              .returning();
            const [v] = await tx.insert(visualPresetVersions).values({ presetId: p!.id, version: 1, manifest: m, recipe, checksum: it.checksum, createdBy: actorId }).returning();
            const list = [...assets.entries()];
            if (list.length) await tx.insert(presetAssets).values(list.map(([path, a], i) => ({ presetVersionId: v!.id, assetId: a.id, assetRole: `${a.role}:${path}`.slice(0, 60), sortOrder: i })));
            return p!.id;
          }
          if (m.kind === 'hook') {
            const prev = [...assets.values()].find((a) => a.role === 'preview');
            const [h] = await tx.insert(hookPresets).values({ slug: m.slug, name: m.name, status: 'DRAFT', config: { formats: m.compatibility.formats, rights: m.rights }, previewAssetId: prev?.id }).returning();
            await tx.insert(hookVersions).values({ hookId: h!.id, version: 1, recipe: m.recipe });
            return h!.id;
          }
          const sample = m.sample ? assets.get(m.sample.path) : undefined;
          const [vp] = await tx
            .insert(voiceProfiles)
            .values({
              provider: m.provider, providerVoiceId: m.providerVoiceId, slug: m.slug, name: m.name, description: m.description, language: m.language,
              voiceAttributes: m.attributes, capabilities: m.capabilities, synthesisConfig: m.synthesis, sampleAssetId: sample?.id, status: 'DRAFT', createdBy: actorId,
            })
            .returning();
          await tx.insert(voiceVersions).values({ voiceId: vp!.id, version: 1, config: { manifest: m } });
          if (sample) await tx.insert(voiceSamples).values({ voiceId: vp!.id, assetId: sample.id, language: m.language, sampleText: m.sample?.text });
          return vp!.id;
        });
        await this.db.update(importItems).set({ status: 'COMMITTED', targetId }).where(eq(importItems.id, it.id));
        committed++;
      } catch (e) {
        failed++;
        await this.db.update(importItems).set({ status: 'FAILED', validationErrors: [`Commit gagal: ${(e as Error).message}`] }).where(eq(importItems.id, it.id));
      }
    }
    const status = failed === 0 && committed > 0 ? 'COMMITTED' : committed > 0 ? 'PARTIAL' : 'FAILED';
    await this.db.update(importBatches).set({ status, finishedAt: new Date(), summary: { ...(b.summary as object), committed, failed } }).where(eq(importBatches.id, batchId));
    await rm(this.storage.scratch('imports', batchId), { recursive: true, force: true });
    await this.audit.log({ actorId, action: 'import.commit', targetType: 'import_batch', targetId: batchId, metadata: { committed, failed } });
    return this.get(batchId);
  }

  async cancel(actorId: string, batchId: string) {
    const b = await this.batch(batchId);
    if (['COMMITTED', 'PARTIAL'].includes(b.status)) throw Errors.conflict('IMPORT_LOCKED', 'Batch sudah di-commit');
    await this.db.update(importBatches).set({ status: 'CANCELLED', finishedAt: new Date() }).where(eq(importBatches.id, batchId));
    await rm(this.storage.scratch('imports', batchId), { recursive: true, force: true });
    await this.audit.log({ actorId, action: 'import.cancel', targetType: 'import_batch', targetId: batchId });
    return { ok: true };
  }

  async list(limit = 50) {
    return this.db.select().from(importBatches).orderBy(desc(importBatches.createdAt)).limit(limit);
  }

  async get(id: string) {
    const b = await this.batch(id);
    const items = await this.db.select().from(importItems).where(eq(importItems.batchId, id));
    return { ...b, items };
  }

  async errors(id: string) {
    await this.batch(id);
    return this.db.select().from(importItems).where(and(eq(importItems.batchId, id), inArray(importItems.status, ['INVALID', 'DUPLICATE', 'FAILED'])));
  }
}
