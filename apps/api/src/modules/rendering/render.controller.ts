import { UseGuards, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UploadedFile, UseInterceptors, Body, CanActivate, ExecutionContext, Injectable, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Request } from 'express';
import type { SessionUser } from '@dentweb/shared-types';
import { ApiZodBody, ZBody } from '../../common/zod.js';
import { CurrentUser, Public, Roles } from '../../common/auth-context.js';
import { ENV } from '../../infra/tokens.js';
import { loadEnv, type Env } from '../../config/env.js';
import { Errors } from '../../infra/errors.js';
import { RenderService, type RenderFormat } from './render.service.js';
import { StylesService } from '../styles/styles.service.js';

const CreateInput = z.object({ projectId: z.uuid(), mode: z.enum(['LOCAL', 'CLOUD']), format: z.enum(['mp4', 'webm', 'gif']).default('mp4') });
const ProgressInput = z.object({ progress: z.number().min(0).max(1) });
const FailInput = z.object({ error: z.string().min(1).max(4000) });
const StartInput = z.object({ workerName: z.string().max(150).optional(), capabilities: z.record(z.string(), z.unknown()).optional() });
const upload = () =>
  FileInterceptor('file', {
    storage: diskStorage({ destination: (_r, _f, cb) => { const d = resolve(loadEnv().STORAGE_DIR, '_scratch', 'uploads'); mkdirSync(d, { recursive: true }); cb(null, d); }, filename: (_r, _f, cb) => cb(null, randomUUID()) }),
    limits: { fileSize: 2 * 1024 * 1024 * 1024, files: 1 },
  });
const fmtOf = (f: Express.Multer.File | undefined, given?: string): RenderFormat => {
  if (!f) throw Errors.invalid('RENDER_NO_FILE', 'File output kosong');
  const ext = (given ?? f.originalname.split('.').pop() ?? '').toLowerCase();
  if (!['mp4', 'webm', 'gif'].includes(ext)) throw Errors.invalid('RENDER_FORMAT', 'Format output tidak didukung');
  return ext as RenderFormat;
};

@ApiTags('render')
@Controller('render/jobs')
export class RenderController {
  constructor(private readonly svc: RenderService) {}

  @Post()
  @ApiZodBody(CreateInput)
  create(@CurrentUser() me: SessionUser, @ZBody(CreateInput) b: z.infer<typeof CreateInput>) {
    return this.svc.create(me.id, b);
  }

  @Get()
  list(@CurrentUser() me: SessionUser) {
    return this.svc.list(me.id);
  }

  @Get(':id')
  get(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.get(me.id, id);
  }

  @Get(':id/outputs')
  async outputs(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return (await this.svc.get(me.id, id)).outputs;
  }

  @HttpCode(200)
  @Post(':id/cancel')
  cancel(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.cancel(me.id, id);
  }

  @HttpCode(200)
  @Post(':id/retry')
  retry(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.retry(me.id, id);
  }

  // ---- LOCAL mode: the member's own desktop app executes and reports ----
  @HttpCode(200)
  @Post(':id/local/start')
  async localStart(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    const j = await this.svc.own(me.id, id);
    if (j.mode !== 'LOCAL') throw Errors.invalid('RENDER_MODE', 'Job ini bukan render lokal');
    return this.svc.start(id, {});
  }

  @HttpCode(200)
  @Post(':id/local/progress')
  @ApiZodBody(ProgressInput)
  async localProgress(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(ProgressInput) b: { progress: number }) {
    await this.svc.own(me.id, id);
    return this.svc.progress(id, b.progress);
  }

  @HttpCode(200)
  @Post(':id/local/output')
  @UseInterceptors(upload())
  async localOutput(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() f: Express.Multer.File) {
    await this.svc.own(me.id, id);
    return this.svc.complete(id, f.path, fmtOf(f));
  }

  @HttpCode(200)
  @Post(':id/local/fail')
  @ApiZodBody(FailInput)
  async localFail(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(FailInput) b: { error: string }) {
    await this.svc.own(me.id, id);
    return this.svc.fail(id, b.error);
  }
}

/** Shared-secret guard for the private worker channel. */
@Injectable()
export class WorkerGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}
  canActivate(ctx: ExecutionContext) {
    const got = ctx.switchToHttp().getRequest<Request>().headers['x-worker-token'];
    const want = this.env.WORKER_TOKEN;
    if (!want || typeof got !== 'string' || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) throw Errors.unauthorized('Token worker tidak valid');
    return true;
  }
}

@ApiTags('internal')
@Public()
@UseGuards(WorkerGuard)
@Controller('internal')
export class InternalRenderController {
  constructor(private readonly svc: RenderService) {}

  @HttpCode(200) @Post('workers/heartbeat')
  async heartbeat(@Body() b: { name?: string; capabilities?: Record<string, unknown> }) {
    if (!b?.name) throw Errors.invalid('WORKER_NAME', 'name wajib');
    return { id: await this.svc.heartbeat(String(b.name).slice(0, 150), b.capabilities ?? {}) };
  }
  @HttpCode(200) @Post('render/jobs/:id/start') @ApiZodBody(StartInput)
  start(@Param('id', ParseUUIDPipe) id: string, @ZBody(StartInput) b: z.infer<typeof StartInput>) { return this.svc.start(id, b); }
  @HttpCode(200) @Post('render/jobs/:id/progress') @ApiZodBody(ProgressInput)
  progress(@Param('id', ParseUUIDPipe) id: string, @ZBody(ProgressInput) b: { progress: number }) { return this.svc.progress(id, b.progress); }
  @HttpCode(200) @Post('render/jobs/:id/output') @UseInterceptors(upload())
  output(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() f: Express.Multer.File) { return this.svc.complete(id, f.path, fmtOf(f)); }
  @HttpCode(200) @Post('render/jobs/:id/fail') @ApiZodBody(FailInput)
  fail(@Param('id', ParseUUIDPipe) id: string, @ZBody(FailInput) b: { error: string }) { return this.svc.fail(id, b.error); }
}

@ApiTags('admin-render')
@Roles('SUPERADMIN')
@Controller('admin')
export class AdminRenderController {
  constructor(
    private readonly svc: RenderService,
    private readonly styles: StylesService,
  ) {}
  @Get('render/jobs') list() { return this.svc.list(null, 200); }
  @HttpCode(200) @Post('render/jobs/:id/cancel') cancel(@Param('id', ParseUUIDPipe) id: string) { return this.svc.cancel(null, id); }
  @HttpCode(200) @Post('render/jobs/:id/retry') retry(@Param('id', ParseUUIDPipe) id: string) { return this.svc.retry(null, id); }
  @HttpCode(202) @Post('styles/presets/:id/test-render')
  async testRender(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body() b: { format?: '9:16' | '16:9' | '1:1' }) {
    return this.svc.presetTest(me.id, await this.styles.getAdmin(id), b?.format ?? '9:16');
  }
}
