import { Body, Controller, Get, Inject, Injectable, Param, ParseUUIDPipe, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Response } from 'express';
import { type Database, appReleases } from '@dentweb/database';
import type { SessionUser } from '@dentweb/shared-types';
import { CurrentUser, Public, Roles } from '../../common/auth-context.js';
import { ZodPipe, ZBody, ApiZodBody } from '../../common/zod.js';
import { DB } from '../../infra/tokens.js';
import { Errors } from '../../infra/errors.js';
import { AuditService } from '../../infra/infra.module.js';
import { StorageService } from '../../infra/storage.js';
import { loadEnv } from '../../config/env.js';

const PLATFORM = z.enum(['darwin', 'win32']);
const ARCH = z.enum(['x64', 'arm64', 'universal']);
const CHANNEL = z.enum(['stable', 'beta']);
const SEMVER = z.string().regex(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/, 'Versi harus semver, mis. 1.2.0');
const ReleaseMeta = z.object({ platform: PLATFORM, arch: ARCH, channel: CHANNEL.default('stable'), version: SEMVER, releaseNotes: z.string().max(5000).default('') });
const ReleasePatch = z.object({ isActive: z.boolean().optional(), releaseNotes: z.string().max(5000).optional() });
const LatestQuery = z.object({ platform: PLATFORM, arch: z.string().max(20).default('x64'), channel: CHANNEL.default('stable') });
const EXT: Record<string, string[]> = { darwin: ['.dmg', '.zip'], win32: ['.exe'] };

async function digests(file: string) {
  const s256 = createHash('sha256');
  const s512 = createHash('sha512');
  await new Promise<void>((ok, fail) => createReadStream(file).on('data', (c) => (s256.update(c), s512.update(c))).on('end', ok).on('error', fail));
  return { sha256: s256.digest('hex'), sha512: s512.digest('base64') };
}

/** Minimal YAML writer for the electron-updater feed (values are controlled strings/numbers). */
const q = (v: string) => `'${v.replace(/'/g, "''")}'`;

@Injectable()
export class ReleasesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  private view(r: typeof appReleases.$inferSelect) {
    return {
      id: r.id, platform: r.platform, arch: r.architecture, channel: r.channel, version: r.version, filename: r.filename, sizeBytes: r.sizeBytes,
      checksum: r.checksum, sha512: r.sha512, releaseNotes: r.releaseNotes, isActive: r.isActive, downloads: r.downloads, publishedAt: r.createdAt,
      downloadUrl: `/api/v1/releases/${r.id}/download`,
    };
  }

  async latest(platform: string, arch: string, channel: string) {
    const archs = arch === 'universal' ? ['universal'] : [arch, 'universal'];
    const rows = await this.db
      .select()
      .from(appReleases)
      .where(and(eq(appReleases.platform, platform), eq(appReleases.channel, channel), eq(appReleases.isActive, true), inArray(appReleases.architecture, archs)))
      .orderBy(desc(appReleases.createdAt))
      .limit(20);
    // Highest semver wins, not the newest upload (protects against re-uploading an older build).
    const cmp = (a: string, b: string) => {
      const pa = a.split(/[.-]/).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
      const pb = b.split(/[.-]/).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
      for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return Number(pa[i]) - Number(pb[i]);
      return (pa.length === 3 ? 1 : 0) - (pb.length === 3 ? 1 : 0);
    };
    const r = rows.sort((a, b) => cmp(b.version, a.version))[0];
    return r ? this.view(r) : null;
  }

  async list() {
    return (await this.db.select().from(appReleases).orderBy(desc(appReleases.createdAt)).limit(200)).map((r) => this.view(r));
  }

  async create(actorId: string, meta: z.infer<typeof ReleaseMeta>, file: Express.Multer.File) {
    try {
      const ext = file.originalname.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? '';
      if (!EXT[meta.platform]!.includes(ext)) throw Errors.invalid('RELEASE_FILE', `Installer ${meta.platform} harus ${EXT[meta.platform]!.join(' / ')}`);
      const [dup] = await this.db.select({ id: appReleases.id }).from(appReleases).where(and(eq(appReleases.platform, meta.platform), eq(appReleases.architecture, meta.arch), eq(appReleases.channel, meta.channel), eq(appReleases.version, meta.version)));
      if (dup) throw Errors.conflict('RELEASE_EXISTS', 'Versi ini sudah dirilis untuk platform dan kanal tersebut');
      const d = await digests(file.path);
      const filename = file.originalname.replace(/[^\w.-]+/g, '-').slice(0, 200);
      const key = `releases/${meta.platform}/${meta.arch}/${meta.channel}/${meta.version}/${filename}`;
      const stored = await this.storage.putFile(key, file.path, 'application/octet-stream', { move: true });
      const [row] = await this.db
        .insert(appReleases)
        .values({ platform: meta.platform, architecture: meta.arch, channel: meta.channel, version: meta.version, artifactKey: key, filename, sizeBytes: stored.size, checksum: d.sha256, sha512: d.sha512, releaseNotes: meta.releaseNotes || null })
        .returning();
      await this.audit.log({ actorId, action: 'release.create', targetType: 'app_release', targetId: row!.id, metadata: { platform: meta.platform, arch: meta.arch, version: meta.version, channel: meta.channel } });
      return this.view(row!);
    } finally {
      await rm(file.path, { force: true });
    }
  }

  async patch(actorId: string, id: string, p: z.infer<typeof ReleasePatch>) {
    const [row] = await this.db.update(appReleases).set(p).where(eq(appReleases.id, id)).returning();
    if (!row) throw Errors.notFound('Rilis');
    await this.audit.log({ actorId, action: 'release.update', targetType: 'app_release', targetId: id, metadata: p });
    return this.view(row);
  }

  async downloadUrl(id: string) {
    const [r] = await this.db.select().from(appReleases).where(and(eq(appReleases.id, id), eq(appReleases.isActive, true)));
    if (!r) throw Errors.notFound('Rilis');
    await this.db.update(appReleases).set({ downloads: sql`${appReleases.downloads} + 1` }).where(eq(appReleases.id, id));
    return this.storage.signedUrl(r.artifactKey, { ttlSec: 1800, filename: r.filename, mime: 'application/octet-stream' });
  }

  /** electron-updater "generic" provider feed: latest.yml (Windows) / latest-mac.yml (macOS). */
  async feed(channel: string, platform: string, arch: string) {
    const r = await this.latest(platform, arch, channel);
    if (!r) return null;
    const url = `${r.id}/${encodeURIComponent(r.filename)}`;
    return [
      `version: ${r.version}`,
      'files:',
      `  - url: ${q(url)}`,
      `    sha512: ${r.sha512}`,
      `    size: ${r.sizeBytes}`,
      `path: ${q(url)}`,
      `sha512: ${r.sha512}`,
      `releaseDate: ${q(new Date(r.publishedAt).toISOString())}`,
      ...(r.releaseNotes ? [`releaseNotes: ${q(r.releaseNotes)}`] : []),
      '',
    ].join('\n');
  }
}

@ApiTags('releases')
@Controller('releases')
export class ReleasesController {
  constructor(private readonly svc: ReleasesService) {}

  @Public()
  @Get('latest')
  latest(@Query(new ZodPipe(LatestQuery)) q: z.infer<typeof LatestQuery>) {
    return this.svc.latest(q.platform, q.arch, q.channel);
  }

  @Public()
  @Get(':id/download')
  async download(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    res.redirect(302, await this.svc.downloadUrl(id));
  }

  /** Feed base for electron-updater: /releases/feed/:channel/:platform/:arch → latest.yml | latest-mac.yml | <id>/<file>. */
  @Public()
  @Get('feed/:channel/:platform/:arch/:file')
  async feed(@Param('channel') channel: string, @Param('platform') platform: string, @Param('arch') arch: string, @Param('file') file: string, @Res() res: Response) {
    const c = CHANNEL.safeParse(channel);
    const p = PLATFORM.safeParse(platform);
    if (!c.success || !p.success || !/^[\w-]{1,20}$/.test(arch)) throw Errors.notFound('Feed');
    if (file !== 'latest.yml' && file !== 'latest-mac.yml') throw Errors.notFound('Feed');
    const yml = await this.svc.feed(c.data, p.data, arch);
    if (!yml) throw Errors.notFound('Rilis');
    res.type('text/yaml').set('cache-control', 'no-cache').send(yml);
  }

  @Public()
  @Get('feed/:channel/:platform/:arch/:id/:file')
  async feedFile(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    res.redirect(302, await this.svc.downloadUrl(id));
  }
}

@ApiTags('admin')
@Roles('SUPERADMIN')
@Controller('admin/releases')
export class AdminReleasesController {
  constructor(private readonly svc: ReleasesService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({ destination: (_r, _f, cb) => { const d = resolve(loadEnv().STORAGE_DIR, '_scratch', 'releases'); mkdirSync(d, { recursive: true }); cb(null, d); }, filename: (_r, _f, cb) => cb(null, randomUUID()) }),
      limits: { fileSize: 2 * 1024 * 1024 * 1024, files: 1 },
    }),
  )
  create(@CurrentUser() me: SessionUser, @UploadedFile() file: Express.Multer.File, @Body(new ZodPipe(ReleaseMeta)) b: z.infer<typeof ReleaseMeta>) {
    if (!file) throw Errors.invalid('RELEASE_FILE', 'File installer wajib diunggah');
    return this.svc.create(me.id, b, file);
  }

  @Patch(':id')
  @ApiZodBody(ReleasePatch)
  patch(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(ReleasePatch) b: z.infer<typeof ReleasePatch>) {
    return this.svc.patch(me.id, id, b);
  }
}

