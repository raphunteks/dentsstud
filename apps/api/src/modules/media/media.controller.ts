import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'node:fs';
import { open, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Inject } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { type Database, mediaAssets } from '@dentweb/database';
import { checkFileType, extOf } from '@dentweb/content-schema';
import type { SessionUser } from '@dentweb/shared-types';
import { CurrentUser } from '../../common/auth-context.js';
import { DB } from '../../infra/tokens.js';
import { loadEnv } from '../../config/env.js';
import { Errors } from '../../infra/errors.js';
import { SettingsService } from '../../infra/settings.service.js';
import { MediaService } from './media.service.js';

const MEMBER_TYPES = ['png', 'jpg', 'jpeg', 'webp', 'mp4', 'webm', 'mp3', 'wav', 'ogg'];

/** Member media library (images, clips, audio recordings) used by projects and revisions. */
@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(
    private readonly media: MediaService,
    private readonly settings: SettingsService,
    @Inject(DB) private readonly db: Database,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({ destination: (_r, _f, cb) => { const d = resolve(loadEnv().STORAGE_DIR, '_scratch', 'uploads'); mkdirSync(d, { recursive: true }); cb(null, d); }, filename: (_r, _f, cb) => cb(null, randomUUID()) }),
      limits: { fileSize: 524_288_000, files: 1 },
    }),
  )
  async upload(@CurrentUser() me: SessionUser, @UploadedFile() f: Express.Multer.File) {
    if (!f) throw Errors.invalid('MEDIA_EMPTY', 'File kosong');
    try {
      const maxBytes = await this.settings.num('upload.maxBytes', 314_572_800);
      if (f.size > maxBytes) {
        throw Errors.invalid('MEDIA_TOO_LARGE', `Ukuran file melebihi batas sistem (${Math.round(maxBytes / (1024 * 1024))} MB)`);
      }
      const ext = extOf(f.originalname);
      if (!MEMBER_TYPES.includes(ext)) throw Errors.invalid('MEDIA_TYPE', 'Tipe file tidak didukung (gambar, video, atau audio)');
      const fh = await open(f.path, 'r');
      const head = Buffer.alloc(16);
      await fh.read(head, 0, 16, 0);
      await fh.close();
      const bad = checkFileType(f.originalname, head, f.size);
      if (bad) throw Errors.invalid('MEDIA_TYPE', bad);
      const row = await this.media.ingestFile(me.id, f.path, f.originalname, { move: true, metadata: { kind: 'member-upload' } });
      return { id: row.id, filename: row.filename, mimeType: row.mimeType, sizeBytes: row.sizeBytes, url: await this.media.url(row.id, 6 * 3600) };
    } finally {
      await rm(f.path, { force: true });
    }
  }

  @Get()
  async list(@CurrentUser() me: SessionUser) {
    const rows = await this.db.select().from(mediaAssets).where(and(eq(mediaAssets.ownerId, me.id), eq(mediaAssets.status, 'READY'), sql`${mediaAssets.metadata}->>'kind' = 'member-upload'`)).orderBy(desc(mediaAssets.createdAt)).limit(200);
    return Promise.all(rows.map(async (r) => ({ id: r.id, filename: r.filename, mimeType: r.mimeType, sizeBytes: r.sizeBytes, url: await this.media.url(r.id, 6 * 3600) })));
  }

  @Delete(':id')
  async remove(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    const [row] = await this.db
      .update(mediaAssets)
      .set({ status: 'DELETED' })
      .where(and(eq(mediaAssets.id, id), eq(mediaAssets.ownerId, me.id), eq(mediaAssets.status, 'READY')))
      .returning({ id: mediaAssets.id });
    if (!row) throw Errors.notFound('Media');
    return { ok: true, id: row.id };
  }
}
