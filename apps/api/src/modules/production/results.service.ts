import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { type Database, factCheckReports, productionOrders, productionRuns, qcReports, renderOutputs, researchSources, socialMetadata, videoResults } from '@dentweb/database';
import { DB } from '../../infra/tokens.js';
import { Errors } from '../../infra/errors.js';
import { AuditService } from '../../infra/infra.module.js';
import { StorageService } from '../../infra/storage.js';
import { MediaService } from '../media/media.service.js';
import { ProductionService, type OrderInput } from './production.service.js';
import type { OrderConfig } from './engine.js';

export const ResultPatch = z.object({ title: z.string().trim().min(1).max(255).optional(), status: z.enum(['READY', 'UPLOADED']).optional() });
export const SocialPatch = z.object({
  caption: z.string().max(2200).optional(),
  hashtags: z.array(z.string().regex(/^#[\p{L}\p{N}_]{2,40}$/u)).max(30).optional(),
  firstComment: z.string().max(500).optional(),
  coverText: z.string().max(80).nullish(),
});
export const RevoiceInput = z.object({
  voice: z.object({ mode: z.enum(['TTS', 'NONE', 'UPLOAD']), voiceId: z.uuid().nullish(), uploadAssetId: z.uuid().nullish(), emotion: z.string().max(50).nullish(), speed: z.number().min(0.5).max(2).optional(), pitch: z.number().min(-20).max(20).nullish(), instructions: z.string().max(1000).nullish() }),
});
export const RerenderInput = z.object({
  format: z.enum(['9:16', '16:9', '1:1']).optional(),
  presetId: z.uuid().nullish(),
  hook: z.object({ mode: z.enum(['AUTO', 'PRESET', 'NONE']), hookId: z.uuid().nullish() }).optional(),
});
export const TABS = ['READY', 'UPLOADED', 'FAILED', 'ALL', 'TRASH'] as const;

@Injectable()
export class ResultsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly storage: StorageService,
    private readonly media: MediaService,
    private readonly production: ProductionService,
    private readonly audit: AuditService,
  ) {}

  async list(userId: string | null, tab: (typeof TABS)[number]) {
    if (tab === 'FAILED') {
      // Failed productions have no video; they are listed from runs so the member can retry.
      const runs = await this.production.listRuns(userId, ['FAILED'], 100);
      return runs.map((r) => ({ kind: 'run' as const, id: r.id, title: r.topic ?? 'Produksi gagal', status: 'FAILED', error: r.error, createdAt: r.createdAt, currentStage: r.currentStage }));
    }
    const conds = [];
    if (userId) conds.push(eq(videoResults.userId, userId));
    if (tab === 'TRASH') conds.push(isNotNull(videoResults.deletedAt));
    else conds.push(isNull(videoResults.deletedAt));
    if (tab === 'READY' || tab === 'UPLOADED') conds.push(eq(videoResults.status, tab));
    const rows = await this.db
      .select({ r: videoResults, s: socialMetadata })
      .from(videoResults)
      .leftJoin(socialMetadata, eq(socialMetadata.resultId, videoResults.id))
      .where(and(...conds))
      .orderBy(desc(videoResults.createdAt))
      .limit(200);
    return Promise.all(rows.map(async ({ r, s }) => ({ kind: 'result' as const, ...r, coverUrl: await this.media.url(r.coverAssetId, 900), captionPreview: s?.caption.slice(0, 160) ?? '' })));
  }

  async own(userId: string | null, id: string, opts: { allowDeleted?: boolean } = {}) {
    const [r] = await this.db.select().from(videoResults).where(userId ? and(eq(videoResults.id, id), eq(videoResults.userId, userId)) : eq(videoResults.id, id));
    if (!r || (r.deletedAt && !opts.allowDeleted)) throw Errors.notFound('Hasil video');
    return r;
  }

  private async output(r: typeof videoResults.$inferSelect) {
    const [o] = await this.db.select().from(renderOutputs).where(eq(renderOutputs.id, r.renderOutputId));
    if (!o) throw Errors.notFound('File video');
    return o;
  }

  async get(userId: string | null, id: string) {
    const r = await this.own(userId, id, { allowDeleted: true });
    const o = await this.output(r);
    const [social] = await this.db.select().from(socialMetadata).where(eq(socialMetadata.resultId, id));
    const [run] = await this.db.select().from(productionRuns).where(eq(productionRuns.id, r.runId));
    const sources = await this.db.select().from(researchSources).where(eq(researchSources.runId, r.runId));
    const [fact] = await this.db.select().from(factCheckReports).where(eq(factCheckReports.runId, r.runId)).orderBy(desc(factCheckReports.createdAt)).limit(1);
    const [qc] = await this.db.select().from(qcReports).where(eq(qcReports.runId, r.runId)).orderBy(desc(qcReports.createdAt)).limit(1);
    const revisions = await this.db.select({ id: videoResults.id, revision: videoResults.revision, createdAt: videoResults.createdAt }).from(videoResults).where(and(eq(videoResults.parentResultId, id), isNull(videoResults.deletedAt)));
    return {
      ...r,
      file: { format: o.format, sizeBytes: o.sizeBytes, checksum: o.checksum },
      videoUrl: await this.storage.signedUrl(o.objectKey, { ttlSec: 900, mime: 'video/mp4' }),
      coverUrl: await this.media.url(r.coverAssetId, 900),
      social: social ?? null,
      run: run ? { id: run.id, topic: run.topic, projectId: run.projectId, kind: run.kind } : null,
      sources,
      factCheck: fact ?? null,
      qc: qc ?? null,
      revisions,
    };
  }

  async patch(actorId: string, userId: string, id: string, p: z.infer<typeof ResultPatch>) {
    await this.own(userId, id);
    const [row] = await this.db
      .update(videoResults)
      .set({ ...(p.title ? { title: p.title } : {}), ...(p.status ? { status: p.status, publishedAt: p.status === 'UPLOADED' ? new Date() : null } : {}) })
      .where(eq(videoResults.id, id))
      .returning();
    await this.audit.log({ actorId, action: 'result.update', targetType: 'video_result', targetId: id, metadata: p });
    return row;
  }

  async trash(actorId: string, userId: string, id: string) {
    await this.own(userId, id);
    await this.db.update(videoResults).set({ deletedAt: new Date() }).where(eq(videoResults.id, id));
    await this.audit.log({ actorId, action: 'result.trash', targetType: 'video_result', targetId: id });
    return { ok: true };
  }

  async restore(actorId: string, userId: string, id: string) {
    const r = await this.own(userId, id, { allowDeleted: true });
    if (!r.deletedAt) throw Errors.conflict('NOT_DELETED', 'Video tidak berada di sampah');
    await this.db.update(videoResults).set({ deletedAt: null }).where(eq(videoResults.id, id));
    await this.audit.log({ actorId, action: 'result.restore', targetType: 'video_result', targetId: id });
    return { ok: true };
  }

  async downloadUrl(userId: string, id: string) {
    const r = await this.own(userId, id);
    const o = await this.output(r);
    const safe = r.title.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 80) || 'dentweb-video';
    return this.storage.signedUrl(o.objectKey, { ttlSec: 600, filename: `${safe}.${o.format}`, mime: 'video/mp4' });
  }

  async coverUrl(userId: string, id: string) {
    const r = await this.own(userId, id);
    if (!r.coverAssetId) throw Errors.notFound('Cover');
    return (await this.media.url(r.coverAssetId, 600))!;
  }

  async social(userId: string, id: string) {
    await this.own(userId, id);
    const [s] = await this.db.select().from(socialMetadata).where(eq(socialMetadata.resultId, id));
    if (!s) throw Errors.notFound('Metadata sosial');
    return s;
  }

  async patchSocial(actorId: string, userId: string, id: string, p: z.infer<typeof SocialPatch>) {
    await this.social(userId, id);
    const [row] = await this.db.update(socialMetadata).set(p).where(eq(socialMetadata.resultId, id)).returning();
    await this.audit.log({ actorId, action: 'result.social.update', targetType: 'video_result', targetId: id });
    return row;
  }

  /** Revision: a new run that reuses the parent's research, script and fact check, then renders again with new settings. */
  async revise(userId: string, id: string, change: { voice?: OrderConfig['voice']; format?: OrderConfig['format']; presetId?: string | null; hook?: OrderConfig['hook'] }, idempotencyKey: string) {
    const r = await this.own(userId, id);
    const [run] = await this.db.select().from(productionRuns).where(eq(productionRuns.id, r.runId));
    const [order] = await this.db.select().from(productionOrders).where(eq(productionOrders.id, run!.orderId));
    const cfg = order!.requestConfig as OrderConfig & { topics?: string[] };
    const input: OrderInput = {
      quantity: 1,
      workers: 1,
      format: change.format ?? cfg.format,
      topicMode: 'PERSIS',
      topic: run!.topic ?? cfg.topic ?? r.title,
      topics: [],
      voice: change.voice ?? cfg.voice,
      presetId: change.presetId === undefined ? (cfg.presetId ?? null) : change.presetId,
      referenceAssetIds: [],
      hook: change.hook ?? { mode: cfg.hook.mode, hookId: cfg.hook.hookId ?? null },
      notes: cfg.notes ?? '',
      start: true,
    };
    return this.production.createOrder(userId, input, idempotencyKey, { kind: 'REVISION', revisionOf: { resultId: r.id, runId: r.runId, reuseStages: ['RESEARCH', 'SCRIPT', 'FACT_CHECK'] } });
  }
}
