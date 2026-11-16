import { Controller, Get, Param, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Public } from '../../common/auth-context.js';
import { StorageService } from '../../infra/storage.js';
import { Errors } from '../../infra/errors.js';
import { ALLOWED_FILES, extOf } from '@dentweb/content-schema';

/** Serves local-driver objects through short-lived HMAC-signed links (S3 uses presigned URLs instead). */
@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Public()
  @Get(':k')
  async get(@Param('k') k: string, @Query('exp') exp: string, @Query('sig') sig: string, @Query('fn') fn: string | undefined, @Res({ passthrough: true }) res: Response) {
    const key = this.storage.verifySigned(k, exp ?? '', fn, sig ?? '');
    if (!key || this.storage.driver !== 'local') throw Errors.forbidden('Tautan file tidak valid atau kedaluwarsa');
    const path = this.storage.localFile(key);
    const s = await stat(path).catch(() => null);
    if (!s) throw Errors.notFound('File');
    const mime = ALLOWED_FILES[extOf(key)]?.mime ?? (key.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    const filename = fn ? Buffer.from(fn, 'base64url').toString().replace(/["\r\n]/g, '') : null;
    if (filename) res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return new StreamableFile(createReadStream(path), { type: mime, length: s.size });
  }
}
