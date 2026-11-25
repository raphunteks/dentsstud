import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import type { SessionUser } from '@dentweb/shared-types';
import { CurrentUser, Roles } from '../../common/auth-context.js';
import { ZBody, ZQuery } from '../../common/zod.js';
import { LmsService } from './lms.service.js';

const CompleteInput = z.object({ completed: z.boolean() });
const ChecklistInput = z.object({ index: z.number().int().min(0).max(100), checked: z.boolean() });
const PromptQuery = z.object({ stage: z.string().max(80).optional(), q: z.string().max(120).optional(), fav: z.string().max(4).optional() });
const FilterQuery = z.object({ category: z.string().max(80).optional(), q: z.string().max(120).optional() });

const ModuleCreate = z.object({ slug: z.string().min(1).max(120), title: z.string().min(1).max(200), subtitle: z.string().max(400).optional(), badge: z.string().max(40).optional(), sortOrder: z.number().int().optional() });
const ModulePatch = ModuleCreate.partial();

const LessonCreate = z.object({
  moduleId: z.string().uuid(),
  slug: z.string().min(1).max(140),
  title: z.string().min(1).max(220),
  duration: z.string().max(20).optional(),
  videoUrl: z.string().max(500).optional(),
  chapters: z.array(z.object({ time: z.string(), label: z.string() })).optional(),
  summary: z.string().max(4000).optional(),
  checklist: z.array(z.string()).optional(),
  lessonPrompt: z.string().max(4000).optional(),
  sortOrder: z.number().int().optional(),
});
const LessonPatch = LessonCreate.partial();

const PromptCreate = z.object({ stage: z.string().min(1).max(80), title: z.string().min(1).max(200), description: z.string().max(400).optional(), promptText: z.string().min(1).max(4000), tags: z.array(z.string()).optional() });
const PromptPatch = PromptCreate.partial();

const RecipeCreate = z.object({ category: z.string().min(1).max(80), title: z.string().min(1).max(200), description: z.string().max(400).optional(), palette: z.array(z.string()).optional(), fonts: z.string().max(160).optional(), pacing: z.string().max(120).optional(), modeCerita: z.string().max(120).optional(), promptTemplate: z.string().max(2000).optional() });
const RecipePatch = RecipeCreate.partial();

const GlossaryCreate = z.object({ category: z.string().min(1).max(80), term: z.string().min(1).max(160), definition: z.string().min(1).max(1000), example: z.string().max(600).optional() });
const GlossaryPatch = GlossaryCreate.partial();

const EffectCreate = z.object({ category: z.string().min(1).max(80), name: z.string().min(1).max(160), description: z.string().max(600).optional(), useCase: z.string().max(400).optional(), promptSnippet: z.string().max(400).optional() });
const EffectPatch = EffectCreate.partial();

const UpdateCreate = z.object({ version: z.string().min(1).max(40), title: z.string().min(1).max(200), releasedAt: z.string().max(40).optional(), highlights: z.array(z.string()).optional() });
const UpdatePatch = UpdateCreate.partial();

@ApiTags('lms')
@Controller('lms')
export class LmsController {
  constructor(private readonly lms: LmsService) {}

  @Get('overview')
  overview(@CurrentUser() user: SessionUser) {
    return this.lms.overview(user.id);
  }

  @Get('modules')
  modules(@CurrentUser() user: SessionUser) {
    return this.lms.listModules(user.id);
  }

  @Get('lessons/:slug')
  lesson(@CurrentUser() user: SessionUser, @Param('slug') slug: string) {
    return this.lms.getLessonBySlug(user.id, slug);
  }

  @Post('lessons/:id/complete')
  @HttpCode(200)
  complete(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(CompleteInput) body: z.infer<typeof CompleteInput>) {
    return this.lms.setLessonComplete(user.id, id, body.completed);
  }

  @Post('lessons/:id/checklist')
  @HttpCode(200)
  checklist(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(ChecklistInput) body: z.infer<typeof ChecklistInput>) {
    return this.lms.setChecklistItem(user.id, id, body.index, body.checked);
  }

  @Get('prompts')
  prompts(@CurrentUser() user: SessionUser, @ZQuery(PromptQuery) q: z.infer<typeof PromptQuery>) {
    return this.lms.listPrompts(user.id, q);
  }

  @Post('prompts/:id/favorite')
  @HttpCode(200)
  favoritePrompt(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.lms.togglePromptFavorite(user.id, id);
  }

  @Post('prompts/:id/copy')
  @HttpCode(200)
  copyPrompt(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.lms.recordPromptCopy(user.id, id);
  }

  @Get('recipes')
  recipes(@ZQuery(FilterQuery) q: z.infer<typeof FilterQuery>) {
    return this.lms.listRecipes(q);
  }

  @Get('glossary')
  glossary(@ZQuery(FilterQuery) q: z.infer<typeof FilterQuery>) {
    return this.lms.listGlossary(q);
  }

  @Get('effects')
  effects(@ZQuery(FilterQuery) q: z.infer<typeof FilterQuery>) {
    return this.lms.listEffects(q);
  }

  @Get('updates')
  updates() {
    return this.lms.listUpdates();
  }

  @Get('skill-download')
  skillDownload() {
    return this.lms.getSkillDownloadInfo();
  }

  @Get('skill-download/file')
  skillDownloadFile(@Res() res: Response) {
    const buf = this.lms.getSkillZipBuffer();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="dentsweb-motion-v2.3.0.zip"');
    res.setHeader('Content-Length', String(buf.length));
    res.send(buf);
  }

  @Post('progress/reset')
  @HttpCode(200)
  reset(@CurrentUser() user: SessionUser) {
    return this.lms.resetProgress(user.id);
  }
}

@ApiTags('admin-lms')
@Roles('SUPERADMIN')
@Controller('admin/lms')
export class AdminLmsController {
  constructor(private readonly lms: LmsService) {}

  @Get('analytics')
  analytics() {
    return this.lms.adminAnalytics();
  }

  @Post('modules')
  createModule(@ZBody(ModuleCreate) b: z.infer<typeof ModuleCreate>) { return this.lms.createModule(b); }
  @Patch('modules/:id')
  updateModule(@Param('id', ParseUUIDPipe) id: string, @ZBody(ModulePatch) b: z.infer<typeof ModulePatch>) { return this.lms.updateModule(id, b); }
  @Delete('modules/:id')
  deleteModule(@Param('id', ParseUUIDPipe) id: string) { return this.lms.deleteModule(id); }

  @Post('lessons')
  createLesson(@ZBody(LessonCreate) b: z.infer<typeof LessonCreate>) { return this.lms.createLesson(b); }
  @Patch('lessons/:id')
  updateLesson(@Param('id', ParseUUIDPipe) id: string, @ZBody(LessonPatch) b: z.infer<typeof LessonPatch>) { return this.lms.updateLesson(id, b); }
  @Delete('lessons/:id')
  deleteLesson(@Param('id', ParseUUIDPipe) id: string) { return this.lms.deleteLesson(id); }

  @Post('prompts')
  createPrompt(@ZBody(PromptCreate) b: z.infer<typeof PromptCreate>) { return this.lms.createPrompt(b); }
  @Patch('prompts/:id')
  updatePrompt(@Param('id', ParseUUIDPipe) id: string, @ZBody(PromptPatch) b: z.infer<typeof PromptPatch>) { return this.lms.updatePrompt(id, b); }
  @Delete('prompts/:id')
  deletePrompt(@Param('id', ParseUUIDPipe) id: string) { return this.lms.deletePrompt(id); }

  @Post('recipes')
  createRecipe(@ZBody(RecipeCreate) b: z.infer<typeof RecipeCreate>) { return this.lms.createRecipe(b); }
  @Patch('recipes/:id')
  updateRecipe(@Param('id', ParseUUIDPipe) id: string, @ZBody(RecipePatch) b: z.infer<typeof RecipePatch>) { return this.lms.updateRecipe(id, b); }
  @Delete('recipes/:id')
  deleteRecipe(@Param('id', ParseUUIDPipe) id: string) { return this.lms.deleteRecipe(id); }

  @Post('glossary')
  createGlossary(@ZBody(GlossaryCreate) b: z.infer<typeof GlossaryCreate>) { return this.lms.createGlossary(b); }
  @Patch('glossary/:id')
  updateGlossary(@Param('id', ParseUUIDPipe) id: string, @ZBody(GlossaryPatch) b: z.infer<typeof GlossaryPatch>) { return this.lms.updateGlossary(id, b); }
  @Delete('glossary/:id')
  deleteGlossary(@Param('id', ParseUUIDPipe) id: string) { return this.lms.deleteGlossary(id); }

  @Post('effects')
  createEffect(@ZBody(EffectCreate) b: z.infer<typeof EffectCreate>) { return this.lms.createEffect(b); }
  @Patch('effects/:id')
  updateEffect(@Param('id', ParseUUIDPipe) id: string, @ZBody(EffectPatch) b: z.infer<typeof EffectPatch>) { return this.lms.updateEffect(id, b); }
  @Delete('effects/:id')
  deleteEffect(@Param('id', ParseUUIDPipe) id: string) { return this.lms.deleteEffect(id); }

  @Post('updates')
  createUpdate(@ZBody(UpdateCreate) b: z.infer<typeof UpdateCreate>) { return this.lms.createUpdate(b); }
  @Patch('updates/:id')
  updateUpdate(@Param('id', ParseUUIDPipe) id: string, @ZBody(UpdatePatch) b: z.infer<typeof UpdatePatch>) { return this.lms.updateUpdate(id, b); }
  @Delete('updates/:id')
  deleteUpdate(@Param('id', ParseUUIDPipe) id: string) { return this.lms.deleteUpdate(id); }
}
