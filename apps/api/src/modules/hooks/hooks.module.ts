import { Controller, Delete, Get, HttpCode, Inject, Injectable, Module, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { type Database, hookPresets, hookVersions } from '@dentweb/database';
import { HookRecipe, FORMATS } from '@dentweb/content-schema';
import type { SessionUser } from '@dentweb/shared-types';
import { ApiZodBody, ZBody } from '../../common/zod.js';
import { CurrentUser, Roles } from '../../common/auth-context.js';
import { DB } from '../../infra/tokens.js';
import { AuditService } from '../../infra/infra.module.js';
import { Errors } from '../../infra/errors.js';
import { MediaService } from '../media/media.service.js';

const slug = z.string().min(2).max(150).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const HookInput = z.object({ slug, name: z.string().min(2).max(200), formats: z.array(z.enum(FORMATS)).min(1), recipe: HookRecipe, previewAssetId: z.uuid().nullish() });
const HookPatch = HookInput.omit({ slug: true }).partial();

@Injectable()
export class HooksService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly media: MediaService,
  ) {}

  private async view(h: typeof hookPresets.$inferSelect) {
    const [v] = await this.db.select().from(hookVersions).where(and(eq(hookVersions.hookId, h.id), eq(hookVersions.version, h.currentVersion)));
    return { ...h, recipe: v?.recipe ?? null, previewUrl: await this.media.url(h.previewAssetId) };
  }

  async list(publishedOnly: boolean) {
    const rows = await this.db.select().from(hookPresets).where(publishedOnly ? eq(hookPresets.status, 'PUBLISHED') : undefined).orderBy(desc(hookPresets.updatedAt));
    return Promise.all(rows.map((r) => this.view(r)));
  }

  async get(id: string, publishedOnly: boolean) {
    const [h] = await this.db.select().from(hookPresets).where(publishedOnly ? and(eq(hookPresets.id, id), eq(hookPresets.status, 'PUBLISHED')) : eq(hookPresets.id, id));
    if (!h) throw Errors.notFound('Hook');
    return this.view(h);
  }

  async create(actorId: string, i: z.infer<typeof HookInput>) {
    try {
      const h = await this.db.transaction(async (tx) => {
        const [h] = await tx.insert(hookPresets).values({ slug: i.slug, name: i.name, status: 'DRAFT', config: { formats: i.formats }, previewAssetId: i.previewAssetId ?? null }).returning();
        await tx.insert(hookVersions).values({ hookId: h!.id, version: 1, recipe: i.recipe });
        return h!;
      });
      await this.audit.log({ actorId, action: 'hook.create', targetType: 'hook_preset', targetId: h.id });
      return this.view(h);
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw Errors.conflict('SLUG_TAKEN', 'Slug hook sudah dipakai');
      throw e;
    }
  }

  async update(actorId: string, id: string, i: z.infer<typeof HookPatch>) {
    const cur = await this.get(id, false);
    const h = await this.db.transaction(async (tx) => {
      let version = cur.currentVersion;
      if (i.recipe) {
        version += 1;
        await tx.insert(hookVersions).values({ hookId: id, version, recipe: i.recipe });
      }
      const [h] = await tx
        .update(hookPresets)
        .set({ name: i.name, previewAssetId: i.previewAssetId, currentVersion: version, config: i.formats ? { ...(cur.config as object), formats: i.formats } : undefined })
        .where(eq(hookPresets.id, id))
        .returning();
      return h!;
    });
    await this.audit.log({ actorId, action: 'hook.update', targetType: 'hook_preset', targetId: id });
    return this.view(h);
  }

  async setStatus(actorId: string, id: string, to: 'PUBLISHED' | 'DRAFT') {
    const cur = await this.get(id, false);
    if (to === 'PUBLISHED' && (!cur.recipe || !HookRecipe.safeParse(cur.recipe).success)) throw Errors.invalid('HOOK_RECIPE_INVALID', 'Recipe hook tidak valid');
    const [h] = await this.db.update(hookPresets).set({ status: to }).where(eq(hookPresets.id, id)).returning();
    await this.audit.log({ actorId, action: to === 'PUBLISHED' ? 'hook.publish' : 'hook.unpublish', targetType: 'hook_preset', targetId: id });
    return this.view(h!);
  }

  async remove(actorId: string, id: string) {
    const cur = await this.get(id, false);
    if (cur.status === 'PUBLISHED') throw Errors.conflict('HOOK_PUBLISHED', 'Unpublish hook sebelum dihapus');
    await this.db.delete(hookPresets).where(eq(hookPresets.id, id));
    await this.audit.log({ actorId, action: 'hook.delete', targetType: 'hook_preset', targetId: id });
    return { ok: true };
  }
}

@ApiTags('hooks')
@Controller('hooks')
class HooksController {
  constructor(private readonly svc: HooksService) {}
  @Get() list() { return this.svc.list(true); }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string) { return this.svc.get(id, true); }
}

@ApiTags('admin-hooks')
@Roles('SUPERADMIN')
@Controller('admin/hooks')
class AdminHooksController {
  constructor(private readonly svc: HooksService) {}
  @Get() list() { return this.svc.list(false); }
  @Post() @ApiZodBody(HookInput) create(@CurrentUser() me: SessionUser, @ZBody(HookInput) b: z.infer<typeof HookInput>) { return this.svc.create(me.id, b); }
  @Patch(':id') @ApiZodBody(HookPatch) update(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(HookPatch) b: z.infer<typeof HookPatch>) { return this.svc.update(me.id, id, b); }
  @Delete(':id') remove(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(me.id, id); }
  @HttpCode(200) @Post(':id/preview') async preview(@Param('id', ParseUUIDPipe) id: string) { const h = await this.svc.get(id, false); return { previewUrl: h.previewUrl, recipe: h.recipe }; }
  @HttpCode(200) @Post(':id/publish') publish(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) { return this.svc.setStatus(me.id, id, 'PUBLISHED'); }
  @HttpCode(200) @Post(':id/unpublish') unpublish(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) { return this.svc.setStatus(me.id, id, 'DRAFT'); }
}

@Module({ controllers: [HooksController, AdminHooksController], providers: [HooksService], exports: [HooksService] })
export class HooksModule {}
