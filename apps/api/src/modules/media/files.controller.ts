import { Controller, Get, Param, Query, Req, Res, StreamableFile } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
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
  async get(
    @Param('k') k: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Query('fn') fn: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const key = this.storage.verifySigned(k, exp ?? '', fn, sig ?? '');
    if (!key || this.storage.driver !== 'local') throw Errors.forbidden('Tautan file tidak valid atau kedaluwarsa');
    const path = this.storage.localFile(key);
    const s = await stat(path).catch(() => null);
    if (!s) throw Errors.notFound('File');
    const mime = ALLOWED_FILES[extOf(key)]?.mime ?? (key.endsWith('.mp4') ? 'video/mp4' : key.endsWith('.mp3') ? 'audio/mpeg' : 'application/octet-stream');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const filename = fn ? Buffer.from(fn, 'base64url').toString().replace(/["\r\n]/g, '') : null;
    if (filename) res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10) || 0;
      const end = parts[1] ? parseInt(parts[1], 10) : s.size - 1;

      if (start >= s.size || end >= s.size) {
        res.status(416);
        res.setHeader('Content-Range', `bytes */${s.size}`);
        return;
      }

      const chunksize = end - start + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${s.size}`);
      res.setHeader('Content-Length', chunksize);
      res.setHeader('Content-Type', mime);

      return new StreamableFile(createReadStream(path, { start, end }));
    }

    res.status(200);
    return new StreamableFile(createReadStream(path), { type: mime, length: s.size });
  }
}
