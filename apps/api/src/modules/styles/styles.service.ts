import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, lt, or, sql, type SQL } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { type Database, presetAssets, styleCategories, visualPresetVersions, visualPresets } from '@dentweb/database';
import { PresetRecipe } from '@dentweb/content-schema';
import { DB } from '../../infra/tokens.js';
import { AuditService } from '../../infra/infra.module.js';
import { Errors } from '../../infra/errors.js';
import { MediaService } from '../media/media.service.js';

type Preset = typeof visualPresets.$inferSelect;

@Injectable()
export class StylesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly media: MediaService,
  ) {}

  // ---------------- categories ----------------
  async adminCategories() {
    return this.db
      .select({
        id: styleCategories.id, slug: styleCategories.slug, name: styleCategories.name, description: styleCategories.description,
        sortOrder: styleCategories.sortOrder, isActive: styleCategories.isActive,
        total: count(visualPresets.id),
        published: sql<number>`count(${visualPresets.id}) filter (where ${visualPresets.status} = 'PUBLISHED')`.mapWith(Number),
      })
      .from(styleCategories)
      .leftJoin(visualPresets, eq(visualPresets.categoryId, styleCategories.id))
      .groupBy(styleCategories.id)
      .orderBy(asc(styleCategories.sortOrder));
  }

  async createCategory(actorId: string, i: { slug: string; name: string; description?: string | null }) {
    const [mx] = await this.db.select({ m: sql<number>`coalesce(max(${styleCategories.sortOrder}),0)`.mapWith(Number) }).from(styleCategories);
    const [c] = await this.db
      .insert(styleCategories)
      .values({ slug: i.slug, name: i.name, description: i.description ?? null, sortOrder: mx!.m + 10 })
      .onConflictDoNothing()
      .returning();
    if (!c) throw Errors.conflict('SLUG_TAKEN', 'Slug kategori sudah dipakai');
    await this.audit.log({ actorId, action: 'category.create', targetType: 'style_category', targetId: c.id });
    return c;
  }

  async updateCategory(actorId: string, id: string, i: { name?: string; description?: string | null; isActive?: boolean; slug?: string }) {
    try {
      const [c] = await this.db.update(styleCategories).set(i).where(eq(styleCategories.id, id)).returning();
      if (!c) throw Errors.notFound('Kategori');
      await this.audit.log({ actorId, action: 'category.update', targetType: 'style_category', targetId: id, metadata: i });
      return c;
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw Errors.conflict('SLUG_TAKEN', 'Slug kategori sudah dipakai');
      throw e;
    }
  }

  async deleteCategory(actorId: string, id: string) {
    const [{ n }] = (await this.db.select({ n: count() }).from(visualPresets).where(eq(visualPresets.categoryId, id))) as [{ n: number }];
    if (n > 0) throw Errors.conflict('CATEGORY_NOT_EMPTY', `Kategori masih berisi ${n} preset. Pindahkan atau arsipkan terlebih dahulu; kategori bisa dinonaktifkan.`);
    const [c] = await this.db.delete(styleCategories).where(eq(styleCategories.id, id)).returning();
    if (!c) throw Errors.notFound('Kategori');
    await this.audit.log({ actorId, action: 'category.delete', targetType: 'style_category', targetId: id, metadata: { slug: c.slug } });
    return { ok: true };
  }

  async reorder(actorId: string, ids: string[]) {
    await this.db.transaction(async (tx) => {
      for (const [i, id] of ids.entries()) await tx.update(styleCategories).set({ sortOrder: (i + 1) * 10 }).where(eq(styleCategories.id, id));
    });
    await this.audit.log({ actorId, action: 'category.reorder', targetType: 'style_category', metadata: { ids } });
    return this.adminCategories();
  }

  // ---------------- presets ----------------
  private async withUrls<T extends Pick<Preset, 'thumbnailAssetId' | 'previewAssetId'>>(p: T) {
    return { ...p, thumbnailUrl: await this.media.url(p.thumbnailAssetId), previewUrl: await this.media.url(p.previewAssetId) };
  }

  async list(q: { status?: string; categoryId?: string; categorySlug?: string; q?: string; cursor?: string; limit: number }, publishedOnly: boolean) {
    const where: SQL[] = [];
    if (publishedOnly) where.push(eq(visualPresets.status, 'PUBLISHED'), eq(styleCategories.isActive, true));
    else if (q.status) where.push(eq(visualPresets.status, q.status));
    if (q.categoryId) where.push(eq(visualPresets.categoryId, q.categoryId));
    if (q.categorySlug) where.push(eq(styleCategories.slug, q.categorySlug));
    if (q.q) where.push(or(ilike(visualPresets.name, `%${q.q}%`), ilike(visualPresets.description, `%${q.q}%`))!);
    if (q.cursor) {
      const [c] = await this.db.select({ u: visualPresets.updatedAt }).from(visualPresets).where(eq(visualPresets.id, q.cursor));
      if (c) where.push(or(lt(visualPresets.updatedAt, c.u), and(eq(visualPresets.updatedAt, c.u), lt(visualPresets.id, q.cursor)))!);
    }
    const rows = await this.db
      .select({ p: visualPresets, category: { id: styleCategories.id, slug: styleCategories.slug, name: styleCategories.name } })
      .from(visualPresets)
      .innerJoin(styleCategories, eq(styleCategories.id, visualPresets.categoryId))
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(visualPresets.updatedAt), desc(visualPresets.id))
      .limit(q.limit + 1);
    const more = rows.length > q.limit;
    const items = await Promise.all(rows.slice(0, q.limit).map(async (r) => ({ ...(await this.withUrls(r.p)), category: r.category })));
    return { items, nextCursor: more ? items[items.length - 1]!.id : null };
  }

  async getAdmin(id: string) {
    const [p] = await this.db.select().from(visualPresets).where(eq(visualPresets.id, id));
    if (!p) throw Errors.notFound('Preset');
    const [v] = await this.db.select().from(visualPresetVersions).where(and(eq(visualPresetVersions.presetId, id), eq(visualPresetVersions.version, p.currentVersion)));
    return { ...(await this.withUrls(p)), version: v ?? null };
  }

  async getPublished(id: string) {
    const [p] = await this.db
      .select({ p: visualPresets })
      .from(visualPresets)
      .innerJoin(styleCategories, eq(styleCategories.id, visualPresets.categoryId))
      .where(and(eq(visualPresets.id, id), eq(visualPresets.status, 'PUBLISHED'), eq(styleCategories.isActive, true)));
    if (!p) throw Errors.notFound('Preset');
    const [v] = await this.db.select().from(visualPresetVersions).where(and(eq(visualPresetVersions.presetId, id), eq(visualPresetVersions.version, p.p.currentVersion)));
    return { ...(await this.withUrls(p.p)), recipe: v?.recipe ?? null, version: p.p.currentVersion };
  }

  private checksum(recipe: unknown, manifest: unknown) {
    return createHash('sha256').update(JSON.stringify({ recipe, manifest })).digest('hex');
  }

  async create(actorId: string, i: { categoryId: string; slug: string; name: string; description?: string; recipe: PresetRecipe; thumbnailAssetId?: string | null; previewAssetId?: string | null }) {
    const recipe = PresetRecipe.parse(i.recipe);
    try {
      return await this.db.transaction(async (tx) => {
        const [p] = await tx
          .insert(visualPresets)
          .values({ categoryId: i.categoryId, slug: i.slug, name: i.name, description: i.description ?? '', status: 'DRAFT', thumbnailAssetId: i.thumbnailAssetId ?? null, previewAssetId: i.previewAssetId ?? null, createdBy: actorId })
          .returning();
        const manifest = { source: 'dashboard', schemaVersion: 1 };
        await tx.insert(visualPresetVersions).values({ presetId: p!.id, version: 1, manifest, recipe, checksum: this.checksum(recipe, manifest), createdBy: actorId });
        await this.audit.log({ actorId, action: 'preset.create', targetType: 'visual_preset', targetId: p!.id });
        return p!;
      });
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw Errors.conflict('SLUG_TAKEN', 'Slug preset sudah dipakai');
      if ((e as { code?: string }).code === '23503') throw Errors.invalid('CATEGORY_INVALID', 'Kategori tidak ditemukan');
      throw e;
    }
  }

  /** Metadata edits in place; a recipe change creates a new immutable version (old projects keep theirs). */
  async update(actorId: string, id: string, i: { name?: string; description?: string; categoryId?: string; thumbnailAssetId?: string | null; previewAssetId?: string | null; recipe?: PresetRecipe }) {
    const cur = await this.getAdmin(id);
    if (cur.status === 'ARCHIVED') throw Errors.conflict('PRESET_ARCHIVED', 'Pulihkan preset sebelum diedit');
    return this.db.transaction(async (tx) => {
      const { recipe, ...meta } = i;
      let version = cur.currentVersion;
      if (recipe) {
        const r = PresetRecipe.parse(recipe);
        version += 1;
        const manifest = (cur.version?.manifest as object) ?? {};
        await tx.insert(visualPresetVersions).values({ presetId: id, version, manifest, recipe: r, checksum: this.checksum(r, manifest), createdBy: actorId });
      }
      const [p] = await tx.update(visualPresets).set({ ...meta, currentVersion: version }).where(eq(visualPresets.id, id)).returning();
      await this.audit.log({ actorId, action: 'preset.update', targetType: 'visual_preset', targetId: id, metadata: { newVersion: recipe ? version : null } });
      return p!;
    });
  }

  async setStatus(actorId: string, id: string, action: 'publish' | 'unpublish' | 'archive' | 'restore') {
    const p = await this.getAdmin(id);
    const allowed: Record<string, string[]> = { publish: ['DRAFT'], unpublish: ['PUBLISHED'], archive: ['DRAFT', 'PUBLISHED'], restore: ['ARCHIVED'] };
    if (!allowed[action]!.includes(p.status)) throw Errors.conflict('PRESET_STATE', `Tidak bisa ${action} dari status ${p.status}`);
    if (action === 'publish') {
      if (!p.thumbnailAssetId) throw Errors.invalid('PRESET_NO_THUMBNAIL', 'Preset wajib punya thumbnail sebelum dipublikasikan');
      if (!p.version || !PresetRecipe.safeParse(p.version.recipe).success) throw Errors.invalid('PRESET_RECIPE_INVALID', 'Recipe preset tidak valid');
    }
    const next = { publish: 'PUBLISHED', unpublish: 'DRAFT', archive: 'ARCHIVED', restore: 'DRAFT' }[action];
    const [u] = await this.db
      .update(visualPresets)
      .set({ status: next, publishedAt: action === 'publish' ? new Date() : p.publishedAt })
      .where(and(eq(visualPresets.id, id), eq(visualPresets.status, p.status)))
      .returning();
    if (!u) throw Errors.conflict('PRESET_STATE', 'Status berubah oleh proses lain, muat ulang');
    await this.audit.log({ actorId, action: `preset.${action}`, targetType: 'visual_preset', targetId: id });
    return u;
  }

  async duplicate(actorId: string, id: string) {
    const src = await this.getAdmin(id);
    const [{ n }] = (await this.db.select({ n: count() }).from(visualPresets).where(ilike(visualPresets.slug, `${src.slug}-salinan%`))) as [{ n: number }];
    const slug = `${src.slug}-salinan${n ? `-${n + 1}` : ''}`.slice(0, 150);
    return this.db.transaction(async (tx) => {
      const [p] = await tx
        .insert(visualPresets)
        .values({ categoryId: src.categoryId, slug, name: `${src.name} (salinan)`.slice(0, 200), description: src.description, status: 'DRAFT', thumbnailAssetId: src.thumbnailAssetId, previewAssetId: src.previewAssetId, createdBy: actorId })
        .returning();
      const v = src.version!;
      const [nv] = await tx.insert(visualPresetVersions).values({ presetId: p!.id, version: 1, manifest: v.manifest as object, recipe: v.recipe as object, checksum: v.checksum, createdBy: actorId }).returning();
      const assets = await tx.select().from(presetAssets).where(eq(presetAssets.presetVersionId, v.id));
      if (assets.length) await tx.insert(presetAssets).values(assets.map((a) => ({ presetVersionId: nv!.id, assetId: a.assetId, assetRole: a.assetRole, sortOrder: a.sortOrder })));
      await this.audit.log({ actorId, action: 'preset.duplicate', targetType: 'visual_preset', targetId: p!.id, metadata: { from: id } });
      return p!;
    });
  }

  versions(id: string) {
    return this.db
      .select({ id: visualPresetVersions.id, version: visualPresetVersions.version, checksum: visualPresetVersions.checksum, createdAt: visualPresetVersions.createdAt })
      .from(visualPresetVersions)
      .where(eq(visualPresetVersions.presetId, id))
      .orderBy(desc(visualPresetVersions.version));
  }

  /** Rollback = new version that copies an older one (history stays immutable). */
  async rollback(actorId: string, id: string, toVersion: number) {
    const p = await this.getAdmin(id);
    const [old] = await this.db.select().from(visualPresetVersions).where(and(eq(visualPresetVersions.presetId, id), eq(visualPresetVersions.version, toVersion)));
    if (!old) throw Errors.notFound('Versi');
    const version = p.currentVersion + 1;
    await this.db.transaction(async (tx) => {
      const [nv] = await tx.insert(visualPresetVersions).values({ presetId: id, version, manifest: old.manifest as object, recipe: old.recipe as object, checksum: old.checksum, createdBy: actorId }).returning();
      const assets = await tx.select().from(presetAssets).where(eq(presetAssets.presetVersionId, old.id));
      if (assets.length) await tx.insert(presetAssets).values(assets.map((a) => ({ presetVersionId: nv!.id, assetId: a.assetId, assetRole: a.assetRole, sortOrder: a.sortOrder })));
      await tx.update(visualPresets).set({ currentVersion: version }).where(eq(visualPresets.id, id));
    });
    await this.audit.log({ actorId, action: 'preset.rollback', targetType: 'visual_preset', targetId: id, metadata: { toVersion, newVersion: version } });
    return this.getAdmin(id);
  }

  async remove(actorId: string, id: string) {
    const p = await this.getAdmin(id);
    if (p.status === 'PUBLISHED') throw Errors.conflict('PRESET_PUBLISHED', 'Unpublish atau arsipkan preset sebelum dihapus');
    await this.db.delete(visualPresets).where(eq(visualPresets.id, id));
    await this.audit.log({ actorId, action: 'preset.delete', targetType: 'visual_preset', targetId: id, metadata: { slug: p.slug } });
    return { ok: true };
  }
}
