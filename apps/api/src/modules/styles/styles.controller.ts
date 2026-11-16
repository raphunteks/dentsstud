import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { PresetRecipe } from '@dentweb/content-schema';
import type { SessionUser } from '@dentweb/shared-types';
import { ApiZodBody, ZBody, ZodPipe } from '../../common/zod.js';
import { CurrentUser, Roles } from '../../common/auth-context.js';
import { StylesService } from './styles.service.js';

const slug = z.string().min(2).max(150).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const CategoryInput = z.object({ slug: slug.max(100), name: z.string().min(2).max(150), description: z.string().max(2000).nullish() });
const CategoryPatch = CategoryInput.partial().extend({ isActive: z.boolean().optional() });
const ReorderInput = z.object({ ids: z.array(z.uuid()).min(1).max(200) });
const PresetInput = z.object({
  categoryId: z.uuid(), slug, name: z.string().min(2).max(200), description: z.string().max(2000).optional(),
  recipe: PresetRecipe, thumbnailAssetId: z.uuid().nullish(), previewAssetId: z.uuid().nullish(),
});
const PresetPatch = PresetInput.omit({ slug: true }).partial();
const ListQuery = z.object({
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(), categoryId: z.uuid().optional(), category: z.string().max(100).optional(),
  q: z.string().max(200).optional(), cursor: z.uuid().optional(), limit: z.coerce.number().int().min(1).max(100).default(24),
});
const RollbackInput = z.object({ version: z.number().int().min(1) });

@ApiTags('styles')
@Controller('styles')
export class StylesController {
  constructor(private readonly svc: StylesService) {}

  @Get('presets')
  presets(@Query(new ZodPipe(ListQuery)) q: z.infer<typeof ListQuery>) {
    return this.svc.list({ ...q, categorySlug: q.category, status: undefined }, true);
  }

  @Get('presets/:id')
  preset(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getPublished(id);
  }
}

@ApiTags('admin-styles')
@Roles('SUPERADMIN')
@Controller('admin/styles')
export class AdminStylesController {
  constructor(private readonly svc: StylesService) {}

  @Get('categories')
  categories() {
    return this.svc.adminCategories();
  }

  @Post('categories')
  @ApiZodBody(CategoryInput)
  createCategory(@CurrentUser() me: SessionUser, @ZBody(CategoryInput) b: z.infer<typeof CategoryInput>) {
    return this.svc.createCategory(me.id, b);
  }

  @Patch('categories/:id')
  @ApiZodBody(CategoryPatch)
  updateCategory(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(CategoryPatch) b: z.infer<typeof CategoryPatch>) {
    return this.svc.updateCategory(me.id, id, b);
  }

  @Delete('categories/:id')
  deleteCategory(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.deleteCategory(me.id, id);
  }

  @HttpCode(200)
  @Post('categories/reorder')
  @ApiZodBody(ReorderInput)
  reorder(@CurrentUser() me: SessionUser, @ZBody(ReorderInput) b: { ids: string[] }) {
    return this.svc.reorder(me.id, b.ids);
  }

  @Get('presets')
  list(@Query(new ZodPipe(ListQuery)) q: z.infer<typeof ListQuery>) {
    return this.svc.list({ ...q, categorySlug: q.category }, false);
  }

  @Post('presets')
  @ApiZodBody(PresetInput)
  create(@CurrentUser() me: SessionUser, @ZBody(PresetInput) b: z.infer<typeof PresetInput>) {
    return this.svc.create(me.id, b);
  }

  @Get('presets/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getAdmin(id);
  }

  @Patch('presets/:id')
  @ApiZodBody(PresetPatch)
  update(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(PresetPatch) b: z.infer<typeof PresetPatch>) {
    return this.svc.update(me.id, id, b);
  }

  @Delete('presets/:id')
  remove(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(me.id, id);
  }

  @Post('presets/:id/duplicate')
  duplicate(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.duplicate(me.id, id);
  }

  @HttpCode(200)
  @Post('presets/:id/preview')
  async preview(@Param('id', ParseUUIDPipe) id: string) {
    const p = await this.svc.getAdmin(id);
    return { thumbnailUrl: p.thumbnailUrl, previewUrl: p.previewUrl, recipe: p.version?.recipe ?? null };
  }

  @HttpCode(200)
  @Post('presets/:id/publish')
  publish(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.setStatus(me.id, id, 'publish');
  }

  @HttpCode(200)
  @Post('presets/:id/unpublish')
  unpublish(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.setStatus(me.id, id, 'unpublish');
  }

  @HttpCode(200)
  @Post('presets/:id/archive')
  archive(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.setStatus(me.id, id, 'archive');
  }

  @HttpCode(200)
  @Post('presets/:id/restore')
  restore(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.setStatus(me.id, id, 'restore');
  }

  @Get('presets/:id/versions')
  versions(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.versions(id);
  }

  @HttpCode(200)
  @Post('presets/:id/rollback')
  @ApiZodBody(RollbackInput)
  rollback(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(RollbackInput) b: { version: number }) {
    return this.svc.rollback(me.id, id, b.version);
  }
}
