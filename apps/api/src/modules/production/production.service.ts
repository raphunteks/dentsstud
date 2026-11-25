import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, gt, gte, inArray, isNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  type Database, hookPresets, mediaAssets, memberTtsAccounts, productionEvents, productionOrders, productionRuns, productionStageRuns, ttsProviderConfigs, users, videoResults,
  visualPresets, voiceProfiles, workflowDefinitions, workflowVersions, PRODUCTION_WORKFLOW,
} from '@dentweb/database';
import { DB } from '../../infra/tokens.js';
import { Errors } from '../../infra/errors.js';
import { AuditService } from '../../infra/infra.module.js';
import { QueueService } from '../../infra/queues.js';
import { LicenseService } from '../licenses/license.service.js';
import { AiConnectionsService } from '../ai-connections/ai-connections.service.js';
import type { OrderConfig } from './engine.js';

export const OrderInput = z
  .object({
    quantity: z.number().int().min(1).max(50),
    workers: z.number().int().min(1).max(16),
    format: z.enum(['9:16', '16:9', '1:1']),
    topicMode: z.enum(['BEBAS', 'UMUM', 'PERSIS']),
    topic: z.string().trim().max(500).default(''),
    topics: z.array(z.string().trim().min(2).max(500)).max(50).default([]),
    voice: z.object({
      mode: z.enum(['TTS', 'NONE', 'UPLOAD']),
      voiceId: z.uuid().nullish(),
      uploadAssetId: z.uuid().nullish(),
      emotion: z.string().max(50).nullish(),
      speed: z.number().min(0.5).max(2).optional(),
      pitch: z.number().min(-20).max(20).nullish(),
      instructions: z.string().max(1000).nullish(),
    }),
    presetId: z.uuid().nullish(),
    referenceAssetIds: z.array(z.uuid()).max(2).default([]),
    hook: z.object({ mode: z.enum(['AUTO', 'PRESET', 'NONE']), hookId: z.uuid().nullish() }),
    notes: z.string().trim().max(2000).default(''),
    start: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.topicMode !== 'BEBAS' && !v.topic && v.topics.length === 0) ctx.addIssue({ code: 'custom', path: ['topic'], message: 'Topik wajib diisi untuk mode ini' });
    if (v.voice.mode === 'TTS' && !v.voice.voiceId) ctx.addIssue({ code: 'custom', path: ['voice', 'voiceId'], message: 'Pilih suara narator' });
    if (v.voice.mode === 'UPLOAD' && !v.voice.uploadAssetId) ctx.addIssue({ code: 'custom', path: ['voice', 'uploadAssetId'], message: 'Unggah rekaman suara' });
    if (v.hook.mode === 'PRESET' && !v.hook.hookId) ctx.addIssue({ code: 'custom', path: ['hook', 'hookId'], message: 'Pilih hook' });
  });
export type OrderInput = z.infer<typeof OrderInput>;

const ACTIVE = ['QUEUED', 'RUNNING', 'CANCELLING'];
const startOfDay = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

@Injectable()
export class ProductionService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly queues: QueueService,
    private readonly licenses: LicenseService,
    private readonly ai: AiConnectionsService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------ validation
  async usageToday(userId: string) {
    const [{ n }] = (await this.db
      .select({ n: count() })
      .from(productionRuns)
      .where(and(eq(productionRuns.userId, userId), eq(productionRuns.kind, 'PRODUCTION'), gte(productionRuns.createdAt, startOfDay()), ne(productionRuns.status, 'CANCELLED')))) as [{ n: number }];
    return n;
  }

  /** Everything the wizard needs to enable/disable options honestly. */
  async readiness(userId: string) {
    const lic = await this.licenses.summary(userId);
    const ent = lic.entitlements;
    const claude = (await this.ai.resolveApiKey(userId)) !== null;
    const accounts = await this.db.select({ provider: memberTtsAccounts.provider }).from(memberTtsAccounts).where(eq(memberTtsAccounts.userId, userId));
    const [cadangan] = await this.db.select({ isEnabled: ttsProviderConfigs.isEnabled }).from(ttsProviderConfigs).where(eq(ttsProviderConfigs.provider, 'cadangan'));
    const ttsSet = new Set(accounts.map((a) => a.provider));
    if (cadangan?.isEnabled) ttsSet.add('cadangan');
    const [{ voices }] = (await this.db.select({ voices: count() }).from(voiceProfiles).where(eq(voiceProfiles.status, 'PUBLISHED'))) as [{ voices: number }];
    const [{ presets }] = (await this.db.select({ presets: count() }).from(visualPresets).where(eq(visualPresets.status, 'PUBLISHED'))) as [{ presets: number }];
    const [{ hooks }] = (await this.db.select({ hooks: count() }).from(hookPresets).where(eq(hookPresets.status, 'PUBLISHED'))) as [{ hooks: number }];
    const used = await this.usageToday(userId);
    return {
      license: lic.status,
      entitlements: ent,
      usedToday: used,
      remainingToday: Math.max(0, ent.maxVideosPerDay - used),
      claudeApiKey: claude,
      ttsAccounts: [...ttsSet],
      published: { voices, presets, hooks },
    };
  }

  private async validate(userId: string, i: OrderInput, opts: { revision?: boolean } = {}) {
    const lic = await this.licenses.summary(userId);
    if (lic.status !== 'ACTIVE') throw Errors.forbidden('Lisensi Anda tidak aktif. Hubungi Superadmin.');
    const ent = lic.entitlements;
    if (i.workers > Math.max(1, ent.maxWorkers)) throw Errors.invalid('ENTITLEMENT_WORKERS', `Lisensi Anda mengizinkan maksimal ${ent.maxWorkers} worker`);
    if (!ent.cloudRender) throw Errors.forbidden('Produksi otomatis membutuhkan render cloud, yang tidak termasuk dalam lisensi Anda');
    if (!opts.revision) {
      const used = await this.usageToday(userId);
      if (used + i.quantity > ent.maxVideosPerDay) throw Errors.invalid('QUOTA_DAILY', `Kuota harian tersisa ${Math.max(0, ent.maxVideosPerDay - used)} video`);
    }
    if (!(await this.ai.resolveApiKey(userId))) throw Errors.invalid('CLAUDE_NOT_CONNECTED', 'Hubungkan Claude dengan API key di Pengaturan → Claude sebelum memproduksi');
    if (i.presetId) {
      const [p] = await this.db.select({ id: visualPresets.id }).from(visualPresets).where(and(eq(visualPresets.id, i.presetId), eq(visualPresets.status, 'PUBLISHED')));
      if (!p) throw Errors.invalid('PRESET_UNAVAILABLE', 'Preset gaya tidak tersedia');
    }
    if (i.hook.mode === 'PRESET') {
      const [h] = await this.db.select({ id: hookPresets.id }).from(hookPresets).where(and(eq(hookPresets.id, i.hook.hookId!), eq(hookPresets.status, 'PUBLISHED')));
      if (!h) throw Errors.invalid('HOOK_UNAVAILABLE', 'Hook tidak tersedia');
    }
    if (i.voice.mode === 'TTS') {
      const [v] = await this.db.select().from(voiceProfiles).where(and(eq(voiceProfiles.id, i.voice.voiceId!), eq(voiceProfiles.status, 'PUBLISHED')));
      if (!v) throw Errors.invalid('VOICE_UNAVAILABLE', 'Suara narator tidak tersedia');
      const [acc] = await this.db.select({ p: memberTtsAccounts.provider }).from(memberTtsAccounts).where(and(eq(memberTtsAccounts.userId, userId), eq(memberTtsAccounts.provider, v.provider)));
      if (!acc) {
        const isGlobalCadangan = v.provider === 'cadangan' && !!(await this.db.select({ e: ttsProviderConfigs.isEnabled }).from(ttsProviderConfigs).where(eq(ttsProviderConfigs.provider, 'cadangan')))[0]?.e;
        if (!isGlobalCadangan) throw Errors.invalid('TTS_ACCOUNT_MISSING', `Atur akun ${v.provider} di Pengaturan → Akun Suara`);
      }
    }
    const own = async (id: string, kind: 'audio' | 'video') => {
      const [m] = await this.db.select().from(mediaAssets).where(and(eq(mediaAssets.id, id), eq(mediaAssets.ownerId, userId), eq(mediaAssets.status, 'READY')));
      if (!m || !m.mimeType.startsWith(`${kind}/`)) throw Errors.invalid('MEDIA_INVALID', kind === 'audio' ? 'Rekaman suara tidak valid' : 'Video referensi tidak valid');
    };
    if (i.voice.mode === 'UPLOAD') await own(i.voice.uploadAssetId!, 'audio');
    for (const r of i.referenceAssetIds) await own(r, 'video');
    return ent;
  }

  private async workflowVersion() {
    const [wf] = await this.db.select().from(workflowDefinitions).where(eq(workflowDefinitions.code, PRODUCTION_WORKFLOW.code));
    if (!wf) throw Errors.unavailable('WORKFLOW_MISSING', 'Workflow produksi belum di-seed');
    const [v] = await this.db.select().from(workflowVersions).where(and(eq(workflowVersions.workflowId, wf.id), eq(workflowVersions.version, wf.currentVersion)));
    if (!v) throw Errors.unavailable('WORKFLOW_MISSING', 'Versi workflow aktif tidak ditemukan');
    return v;
  }

  // ------------------------------------------------------------------ orders
  async createOrder(userId: string, i: OrderInput, idempotencyKey: string, extra: { revisionOf?: OrderConfig['revisionOf']; kind?: 'PRODUCTION' | 'REVISION' | 'SCHEDULED' } = {}) {
    const [dup] = await this.db.select().from(productionOrders).where(and(eq(productionOrders.userId, userId), eq(productionOrders.idempotencyKey, idempotencyKey)));
    if (dup) return { ...(await this.getOrder(userId, dup.id)), duplicate: true };
    await this.validate(userId, i, { revision: extra.kind === 'REVISION' });
    const wv = await this.workflowVersion();
    const topics = Array.from({ length: i.quantity }, (_, n) => (i.topics.length ? i.topics[n % i.topics.length]! : i.topic));
    const cfg: OrderConfig & { topics: string[] } = {
      format: i.format, topicMode: i.topicMode, topic: i.topic, topics, voice: i.voice, presetId: i.presetId ?? null, referenceAssetIds: i.referenceAssetIds,
      hook: { mode: i.hook.mode, hookId: i.hook.hookId ?? null }, notes: i.notes, workers: i.workers, revisionOf: extra.revisionOf ?? null,
    };
    const order = await this.db.transaction(async (tx) => {
      const [o] = await tx
        .insert(productionOrders)
        .values({ userId, requestConfig: cfg, quantity: i.quantity, status: i.start ? 'RUNNING' : 'DRAFT', idempotencyKey })
        .onConflictDoNothing()
        .returning();
      if (!o) return null;
      await tx.insert(productionRuns).values(
        topics.map((t, n) => ({ orderId: o.id, userId, workflowVersionId: wv.id, status: i.start ? 'QUEUED' : 'PAUSED', sequence: n + 1, topic: i.topicMode === 'BEBAS' ? null : t, kind: extra.kind === 'REVISION' ? 'REVISION' : 'PRODUCTION' })),
      );
      return o;
    });
    if (!order) {
      const [o] = await this.db.select().from(productionOrders).where(and(eq(productionOrders.userId, userId), eq(productionOrders.idempotencyKey, idempotencyKey)));
      return { ...(await this.getOrder(userId, o!.id)), duplicate: true };
    }
    if (i.start) await this.enqueueOrder(order.id);
    await this.audit.log({ actorId: userId, action: 'production.order', targetType: 'production_order', targetId: order.id, metadata: { quantity: i.quantity, workers: i.workers, kind: extra.kind ?? 'PRODUCTION' } });
    return { ...(await this.getOrder(userId, order.id)), duplicate: false };
  }

  private async enqueue(runId: string) {
    await this.queues.production.add('run', { runId }, { jobId: `run-${runId}-${Date.now()}` });
  }

  private async enqueueOrder(orderId: string) {
    const runs = await this.db.select({ id: productionRuns.id }).from(productionRuns).where(and(eq(productionRuns.orderId, orderId), eq(productionRuns.status, 'QUEUED')));
    for (const r of runs) await this.enqueue(r.id);
  }

  async startOrder(userId: string, id: string) {
    const [o] = await this.db.select().from(productionOrders).where(and(eq(productionOrders.id, id), eq(productionOrders.userId, userId)));
    if (!o) throw Errors.notFound('Pesanan');
    if (o.status !== 'DRAFT') throw Errors.conflict('ORDER_STARTED', 'Pesanan sudah dimulai');
    const cfg = o.requestConfig as OrderConfig;
    await this.validate(userId, { ...(cfg as unknown as OrderInput), quantity: 0 });
    await this.db.update(productionRuns).set({ status: 'QUEUED' }).where(and(eq(productionRuns.orderId, id), eq(productionRuns.status, 'PAUSED')));
    await this.db.update(productionOrders).set({ status: 'RUNNING' }).where(eq(productionOrders.id, id));
    await this.enqueueOrder(id);
    return this.getOrder(userId, id);
  }

  async listOrders(userId: string, limit = 50) {
    const rows = await this.db.select().from(productionOrders).where(eq(productionOrders.userId, userId)).orderBy(desc(productionOrders.createdAt)).limit(limit);
    return Promise.all(rows.map(async (o) => ({ ...o, runs: await this.runRows({ orderId: o.id }) })));
  }

  async getOrder(userId: string, id: string) {
    const [o] = await this.db.select().from(productionOrders).where(and(eq(productionOrders.id, id), eq(productionOrders.userId, userId)));
    if (!o) throw Errors.notFound('Pesanan');
    return { ...o, runs: await this.runRows({ orderId: o.id }) };
  }

  // ------------------------------------------------------------------ runs
  private async runRows(f: { orderId?: string; userId?: string | null; status?: string[]; limit?: number }) {
    const conds = [];
    if (f.orderId) conds.push(eq(productionRuns.orderId, f.orderId));
    if (f.userId) conds.push(eq(productionRuns.userId, f.userId));
    if (f.status?.length) conds.push(inArray(productionRuns.status, f.status));
    return this.db
      .select({ run: productionRuns, email: users.email, displayName: users.displayName })
      .from(productionRuns)
      .innerJoin(users, eq(users.id, productionRuns.userId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(f.orderId ? asc(productionRuns.sequence) : desc(productionRuns.createdAt))
      .limit(f.limit ?? 200)
      .then((rows) => rows.map((r) => ({ ...r.run, owner: { email: r.email, displayName: r.displayName } })));
  }

  listRuns(userId: string | null, status?: string[], limit = 100) {
    return this.runRows({ userId, status, limit });
  }

  async ownRun(userId: string | null, id: string) {
    const [r] = await this.db.select().from(productionRuns).where(userId ? and(eq(productionRuns.id, id), eq(productionRuns.userId, userId)) : eq(productionRuns.id, id));
    if (!r) throw Errors.notFound('Produksi');
    return r;
  }

  async getRun(userId: string | null, id: string) {
    const r = await this.ownRun(userId, id);
    const [o] = await this.db.select().from(productionOrders).where(eq(productionOrders.id, r.orderId));
    return { ...r, config: o?.requestConfig ?? null, stages: await this.stages(userId, id) };
  }

  async stages(userId: string | null, id: string) {
    await this.ownRun(userId, id);
    return this.db.select().from(productionStageRuns).where(eq(productionStageRuns.runId, id)).orderBy(asc(productionStageRuns.startedAt));
  }

  async events(userId: string | null, id: string, after?: string, technical = false) {
    await this.ownRun(userId, id);
    const conds = [eq(productionEvents.runId, id)];
    if (after) conds.push(gt(productionEvents.createdAt, new Date(after)));
    const rows = await this.db.select().from(productionEvents).where(and(...conds)).orderBy(asc(productionEvents.createdAt)).limit(500);
    // Members get the activity feed; technical metadata only for Superadmin or on request for own runs.
    return technical ? rows : rows.map(({ metadata: _m, ...e }) => e);
  }

  async cancel(actorId: string, userId: string | null, id: string) {
    const r = await this.ownRun(userId, id);
    if (['PAUSED', 'QUEUED'].includes(r.status)) {
      await this.db.update(productionRuns).set({ status: 'CANCELLED', completedAt: new Date() }).where(eq(productionRuns.id, id));
      await this.db.insert(productionEvents).values({ runId: id, eventType: 'run.cancelled', message: 'Produksi dibatalkan sebelum dimulai.' });
    } else if (r.status === 'RUNNING') {
      await this.db.update(productionRuns).set({ status: 'CANCELLING' }).where(eq(productionRuns.id, id));
      await this.db.insert(productionEvents).values({ runId: id, eventType: 'run.cancelling', message: 'Permintaan berhenti diterima; menunggu tahap berjalan berhenti.' });
    } else throw Errors.conflict('RUN_NOT_ACTIVE', 'Produksi tidak sedang berjalan');
    await this.audit.log({ actorId, action: 'production.cancel', targetType: 'production_run', targetId: id });
    return this.ownRun(null, id);
  }

  /** resume = continue from the last completed stage; retry = start over (old stages are superseded, kept for history). */
  async restart(actorId: string, userId: string | null, id: string, mode: 'resume' | 'retry') {
    const r = await this.ownRun(userId, id);
    if (!['FAILED', 'CANCELLED', 'PAUSED'].includes(r.status)) throw Errors.conflict('RUN_NOT_RESTARTABLE', 'Hanya produksi yang gagal atau dihentikan yang dapat dilanjutkan');
    if (r.resultId) throw Errors.conflict('RUN_HAS_RESULT', 'Produksi ini sudah menghasilkan video');
    const active = await this.db.select({ n: count() }).from(productionRuns).where(and(eq(productionRuns.userId, r.userId), inArray(productionRuns.status, ACTIVE)));
    if ((active[0]?.n ?? 0) >= 50) throw Errors.tooMany('Terlalu banyak produksi aktif');
    if (mode === 'retry') await this.db.update(productionStageRuns).set({ status: 'SUPERSEDED' }).where(and(eq(productionStageRuns.runId, id), eq(productionStageRuns.status, 'COMPLETED')));
    await this.db
      .update(productionRuns)
      .set({ status: 'QUEUED', error: null, completedAt: null, progress: mode === 'retry' ? 0 : r.progress, ...(mode === 'retry' ? { startedAt: null, currentStage: null, projectId: null, renderJobId: null } : {}) })
      .where(eq(productionRuns.id, id));
    await this.db.update(productionOrders).set({ status: 'RUNNING' }).where(eq(productionOrders.id, r.orderId));
    await this.db.insert(productionEvents).values({ runId: id, eventType: `run.${mode}`, message: mode === 'retry' ? 'Produksi diulang dari awal.' : 'Produksi dilanjutkan dari checkpoint.' });
    await this.enqueue(id);
    await this.audit.log({ actorId, action: `production.${mode}`, targetType: 'production_run', targetId: id });
    return this.ownRun(null, id);
  }

  /** Re-enqueue runs whose worker died (no heartbeat for 5 minutes). Called by the scheduler tick. */
  async recoverStale() {
    const stale = await this.db
      .select({ id: productionRuns.id })
      .from(productionRuns)
      .where(and(eq(productionRuns.status, 'RUNNING'), sql`${productionRuns.heartbeatAt} < now() - interval '5 minutes'`));
    for (const s of stale) {
      await this.db.update(productionRuns).set({ status: 'QUEUED' }).where(and(eq(productionRuns.id, s.id), eq(productionRuns.status, 'RUNNING')));
      await this.db.insert(productionEvents).values({ runId: s.id, eventType: 'run.recovered', message: 'Worker tidak merespons; produksi dilanjutkan dari checkpoint terakhir.' });
      await this.enqueue(s.id);
    }
    const cancelling = await this.db
      .select({ id: productionRuns.id })
      .from(productionRuns)
      .where(and(eq(productionRuns.status, 'CANCELLING'), sql`${productionRuns.heartbeatAt} < now() - interval '5 minutes'`));
    for (const c of cancelling) await this.db.update(productionRuns).set({ status: 'CANCELLED', completedAt: new Date() }).where(eq(productionRuns.id, c.id));
    return stale.length;
  }

  async activeSummary(userId: string) {
    const rows = await this.db
      .select({ id: productionRuns.id, status: productionRuns.status, progress: productionRuns.progress, stage: productionRuns.currentStage, topic: productionRuns.topic })
      .from(productionRuns)
      .where(and(eq(productionRuns.userId, userId), inArray(productionRuns.status, ACTIVE)))
      .orderBy(desc(productionRuns.createdAt))
      .limit(20);
    return rows;
  }

  async counts(userId: string) {
    const rs = await this.db
      .select({ status: videoResults.status, n: count() })
      .from(videoResults)
      .where(and(eq(videoResults.userId, userId), isNull(videoResults.deletedAt)))
      .groupBy(videoResults.status);
    const runs = await this.db.select({ status: productionRuns.status, n: count() }).from(productionRuns).where(eq(productionRuns.userId, userId)).groupBy(productionRuns.status);
    const by = (rows: { status: string; n: number }[], s: string[]) => rows.filter((r) => s.includes(r.status)).reduce((a, r) => a + Number(r.n), 0);
    return { ready: by(rs, ['READY']), uploaded: by(rs, ['UPLOADED']), producing: by(runs, ACTIVE), failed: by(runs, ['FAILED']) };
  }
}
