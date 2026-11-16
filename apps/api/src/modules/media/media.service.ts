import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { type Database, mediaAssets } from '@dentweb/database';
import { extOf, ALLOWED_FILES } from '@dentweb/content-schema';
import { DB } from '../../infra/tokens.js';
import { StorageService, objectKeyFor } from '../../infra/storage.js';

export type MediaRow = typeof mediaAssets.$inferSelect;

@Injectable()
export class MediaService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly storage: StorageService,
  ) {}

  /** Stores a local file content-addressed and registers it. Same bytes for the same owner → same row. */
  async ingestFile(ownerId: string, file: string, filename: string, opts: { move?: boolean; metadata?: Record<string, unknown>; mime?: string } = {}): Promise<MediaRow> {
    const sha = await StorageService.hashFile(file);
    const [existing] = await this.db.select().from(mediaAssets).where(and(eq(mediaAssets.sha256, sha), eq(mediaAssets.ownerId, ownerId), eq(mediaAssets.status, 'READY')));
    if (existing && (await this.storage.exists(existing.objectKey))) return existing;
    const ext = extOf(filename);
    const mime = opts.mime ?? ALLOWED_FILES[ext]?.mime ?? 'application/octet-stream';
    const key = objectKeyFor(sha, ext || 'bin');
    const stored = await this.storage.putFile(key, file, mime, { move: opts.move });
    const [row] = await this.db
      .insert(mediaAssets)
      .values({ ownerId, objectKey: key, filename: filename.slice(0, 255), mimeType: mime, sizeBytes: stored.size, sha256: sha, metadata: opts.metadata ?? {}, status: 'READY' })
      .returning();
    return row!;
  }

  async ingestBuffer(ownerId: string, buf: Buffer, filename: string, mime: string, metadata: Record<string, unknown> = {}) {
    const tmp = this.storage.scratch('ingest', `${Date.now()}-${Math.random().toString(36).slice(2)}-${filename.replace(/[^\w.-]/g, '_')}`);
    const { mkdir, writeFile } = await import('node:fs/promises');
    const { dirname } = await import('node:path');
    await mkdir(dirname(tmp), { recursive: true });
    await writeFile(tmp, buf);
    return this.ingestFile(ownerId, tmp, filename, { move: true, mime, metadata });
  }

  async get(id: string) {
    const [m] = await this.db.select().from(mediaAssets).where(eq(mediaAssets.id, id));
    return m ?? null;
  }

  async url(id: string | null | undefined, ttlSec = 600) {
    if (!id) return null;
    const m = await this.get(id);
    return m ? this.storage.signedUrl(m.objectKey, { ttlSec }) : null;
  }
}
