import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { SessionUser } from '@dentweb/shared-types';
import { ApiZodBody, ZBody } from '../../common/zod.js';
import { CurrentUser, Roles } from '../../common/auth-context.js';
import { Errors } from '../../infra/errors.js';
import { loadEnv } from '../../config/env.js';
import { ImportsService } from './imports.service.js';

const InitInput = z.object({ kind: z.enum(['preset', 'voice', 'hook']), source: z.enum(['LOCAL_FOLDER', 'DASHBOARD_UPLOAD']).default('DASHBOARD_UPLOAD') });
const BatchInput = z.object({ batchId: z.uuid() });

const tmpDir = () => {
  const d = resolve(loadEnv().STORAGE_DIR, '_scratch', 'uploads');
  mkdirSync(d, { recursive: true });
  return d;
};

@ApiTags('admin-imports')
@Roles('SUPERADMIN')
@Controller('admin/imports')
export class ImportsController {
  constructor(private readonly svc: ImportsService) {}

  @Post('init')
  @ApiZodBody(InitInput)
  init(@CurrentUser() me: SessionUser, @ZBody(InitInput) b: z.infer<typeof InitInput>) {
    return this.svc.init(me.id, b.kind, b.source);
  }

  /** multipart: files[] + paths (JSON array of relative paths, same order). A .zip is extracted with limits. */
  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', 200, {
      storage: diskStorage({ destination: (_r, _f, cb) => cb(null, tmpDir()), filename: (_r, _f, cb) => cb(null, randomUUID()) }),
      limits: { fileSize: 300 * 1024 * 1024, files: 200, fields: 10, fieldSize: 1024 * 1024 },
    }),
  )
  upload(@Query('batchId', ParseUUIDPipe) batchId: string, @UploadedFiles() files: Express.Multer.File[], @Body('paths') paths?: string) {
    if (!files?.length) throw Errors.invalid('IMPORT_EMPTY', 'Tidak ada file');
    let rel: string[] = [];
    try {
      rel = paths ? (JSON.parse(paths) as string[]) : [];
    } catch {
      throw Errors.invalid('IMPORT_PATHS', 'paths harus JSON array');
    }
    return this.svc.addFiles(batchId, files, rel);
  }

  @HttpCode(200)
  @Post('validate')
  @ApiZodBody(BatchInput)
  validate(@CurrentUser() me: SessionUser, @ZBody(BatchInput) b: { batchId: string }) {
    return this.svc.validate(me.id, b.batchId);
  }

  @HttpCode(200)
  @Post('commit')
  @ApiZodBody(BatchInput)
  commit(@CurrentUser() me: SessionUser, @ZBody(BatchInput) b: { batchId: string }) {
    return this.svc.commit(me.id, b.batchId);
  }

  @Get()
  list() {
    return this.svc.list();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.get(id);
  }

  @HttpCode(200)
  @Post(':id/cancel')
  cancel(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.cancel(me.id, id);
  }

  @Get(':id/errors')
  errors(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.errors(id);
  }
}
