import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { type Database, mediaAssets, projects, renderAttempts, renderJobs, renderOutputs, workerNodes } from '@dentweb/database';
import { MotionDocument, newDocument, type Format } from '@dentweb/motion-schema';
import { DB, ENV } from '../../infra/tokens.js';
import type { Env } from '../../config/env.js';
import { AuditService } from '../../infra/infra.module.js';
import { SettingsService } from '../../infra/settings.service.js';
import { StorageService } from '../../infra/storage.js';
import { QueueService } from '../../infra/queues.js';
import { Errors } from '../../infra/errors.js';
import { MediaService } from '../media/media.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { LicenseService } from '../licenses/license.service.js';

export type RenderFormat = 'mp4' | 'webm' | 'gif';
type Job = typeof renderJobs.$inferSelect;
const ACTIVE = ['QUEUED', 'AWAITING_LOCAL', 'RUNNING', 'CANCELLING'];

@Injectable()
export class RenderService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly storage: StorageService,
    private readonly queues: QueueService,
    private readonly media: MediaService,
    private readonly projects: ProjectsService,
    private readonly licenses: LicenseService,
  ) {}

  private abs(url: string) {
    return url.startsWith('/') ? `${this.env.PUBLIC_API_ORIGIN}${url}` : url;
  }

  /** Resolves asset ids to long-lived signed URLs so the immutable snapshot is self-contained. */
  private async resolveAssets(userId: string, doc: MotionDocument) {
    const d: MotionDocument = JSON.parse(JSON.stringify(doc));
    const ids = new Set<string>();
    for (const s of d.scenes) for (const l of s.layers) if ((l.type === 'image' || l.type === 'video') && l.assetId) ids.add(l.assetId);
    for (const a of d.audio) if (a.assetId) ids.add(a.assetId);
    const map = new Map<string, string>();
    if (ids.size) {
      const rows = await this.db.select().from(mediaAssets).where(inArray(mediaAssets.id, [...ids]));
      for (const r of rows) {
        // Members may use their own media and media referenced by published catalog items (owned by Superadmin).
        if (r.ownerId !== userId && !(r.metadata as { importBatch?: string }).importBatch && !(r.metadata as { kind?: string }).kind?.startsWith('voice')) continue;
        map.set(r.id, this.abs(await this.storage.signedUrl(r.objectKey, { ttlSec: 6 * 3600 })));
      }
    }
    for (const s of d.scenes) for (const l of s.layers) if ((l.type === 'image' || l.type === 'video') && l.assetId) l.src = map.get(l.assetId) ?? l.src;
    for (const a of d.audio) if (a.assetId) a.src = map.get(a.assetId) ?? a.src;
    return d;
  }

  async create(userId: string, i: { projectId: string; mode: 'LOCAL' | 'CLOUD'; format: RenderFormat }) {
    if (i.mode === 'CLOUD') {
      const ent = (await this.licenses.summary(userId)).entitlements;
      if (!ent.cloudRender) throw Errors.forbidden('Lisensi Anda tidak mencakup render cloud');
      const [{ n }] = (await this.db.select({ n: count() }).from(renderJobs).where(and(eq(renderJobs.userId, userId), eq(renderJobs.mode, 'CLOUD'), inArray(renderJobs.status, ACTIVE)))) as [{ n: number }];
      const limit = await this.settings.num('quota.perMemberConcurrency', 2);
      if (n >= limit) throw Errors.tooMany(`Maksimal ${limit} render cloud bersamaan`);
    }
    const snap = await this.projects.snapshot(userId, i.projectId);
    const resolved = await this.resolveAssets(userId, MotionDocument.parse(snap.document));
    const [job] = await this.db
      .insert(renderJobs)
      .values({ userId, projectId: i.projectId, mode: i.mode, status: i.mode === 'CLOUD' ? 'QUEUED' : 'AWAITING_LOCAL', preset: { format: i.format, revision: snap.revision }, snapshotRef: snap.snapshotRef })
      .returning();
    await this.storage.putBuffer(`renders/${job!.id}/input.json`, Buffer.from(JSON.stringify(resolved)), 'application/json');
    if (i.mode === 'CLOUD') await this.queues.render.add('render', { jobId: job!.id }, { jobId: job!.id });
    await this.audit.log({ actorId: userId, action: 'render.create', targetType: 'render_job', targetId: job!.id, metadata: { mode: i.mode, format: i.format } });
    return this.view(job!);
  }

  private async view(j: Job) {
    const outs = await this.db.select().from(renderOutputs).where(eq(renderOutputs.jobId, j.id));
    return {
      ...j,
      outputs: await Promise.all(outs.map(async (o) => ({ ...o, url: await this.storage.signedUrl(o.objectKey, { ttlSec: 900, filename: `dentweb-${j.id.slice(0, 8)}.${o.format}` }) }))),
    };
  }

  async own(userId: string | null, id: string) {
    const [j] = await this.db.select().from(renderJobs).where(userId ? and(eq(renderJobs.id, id), eq(renderJobs.userId, userId)) : eq(renderJobs.id, id));
    if (!j) throw Errors.notFound('Render job');
    return j;
  }

  async list(userId: string | null, limit = 50) {
    const rows = await this.db
      .select({ j: renderJobs, projectName: projects.name })
      .from(renderJobs)
      .innerJoin(projects, eq(projects.id, renderJobs.projectId))
      .where(userId ? eq(renderJobs.userId, userId) : undefined)
      .orderBy(desc(renderJobs.createdAt))
      .limit(limit);
    return Promise.all(rows.map(async (r) => ({ ...(await this.view(r.j)), projectName: r.projectName })));
  }

  get = async (userId: string | null, id: string) => this.view(await this.own(userId, id));

  async cancel(userId: string | null, id: string) {
    const j = await this.own(userId, id);
    if (!ACTIVE.includes(j.status)) throw Errors.conflict('RENDER_STATE', `Job berstatus ${j.status}`);
    const next = j.status === 'RUNNING' ? 'CANCELLING' : 'CANCELLED';
    if (next === 'CANCELLED') await (await this.queues.render.getJob(id))?.remove().catch(() => undefined);
    await this.db.update(renderJobs).set({ status: next, completedAt: next === 'CANCELLED' ? new Date() : null }).where(eq(renderJobs.id, id));
    await this.audit.log({ actorId: userId, action: 'render.cancel', targetType: 'render_job', targetId: id });
    return this.get(userId, id);
  }

  async retry(userId: string | null, id: string) {
    const j = await this.own(userId, id);
    if (!['FAILED', 'CANCELLED'].includes(j.status)) throw Errors.conflict('RENDER_STATE', 'Hanya job gagal/dibatalkan yang bisa diulang');
    await this.db.update(renderJobs).set({ status: j.mode === 'CLOUD' ? 'QUEUED' : 'AWAITING_LOCAL', progress: 0, completedAt: null }).where(eq(renderJobs.id, id));
    if (j.mode === 'CLOUD') {
      await (await this.queues.render.getJob(id))?.remove().catch(() => undefined);
      await this.queues.render.add('render', { jobId: id }, { jobId: `${id}:${Date.now()}` });
    }
    await this.audit.log({ actorId: userId, action: 'render.retry', targetType: 'render_job', targetId: id });
    return this.get(userId, id);
  }

  // ------------- executor side (cloud worker via /internal, desktop via member routes) -------------
  async start(id: string, executor: { workerName?: string; capabilities?: Record<string, unknown> }) {
    const j = await this.own(null, id);
    if (!['QUEUED', 'AWAITING_LOCAL', 'RUNNING'].includes(j.status)) return { proceed: false, status: j.status };
    let workerId: string | null = null;
    if (executor.workerName) workerId = await this.heartbeat(executor.workerName, executor.capabilities ?? {});
    const [{ n }] = (await this.db.select({ n: count() }).from(renderAttempts).where(eq(renderAttempts.jobId, id))) as [{ n: number }];
    const [att] = await this.db.insert(renderAttempts).values({ jobId: id, attemptNumber: n + 1, workerId, status: 'RUNNING' }).returning();
    await this.db.update(renderJobs).set({ status: 'RUNNING', progress: 0 }).where(eq(renderJobs.id, id));
    const input = await this.storage.signedUrl(`renders/${id}/input.json`, { ttlSec: 3600 });
    return { proceed: true, attempt: att!.attemptNumber, inputUrl: this.abs(input), format: (j.preset as { format: RenderFormat }).format };
  }

  async progress(id: string, progress: number) {
    const j = await this.own(null, id);
    if (j.status === 'CANCELLING') return { cancel: true };
    if (j.status !== 'RUNNING') return { cancel: true };
    await this.db.update(renderJobs).set({ progress: Math.max(0, Math.min(100, Math.round(progress * 100))) }).where(eq(renderJobs.id, id));
    return { cancel: false };
  }

  async complete(id: string, file: string, format: RenderFormat) {
    const j = await this.own(null, id);
    if (j.status === 'CANCELLING') {
      await this.finishAttempt(id, 'CANCELLED', null);
      await this.db.update(renderJobs).set({ status: 'CANCELLED', completedAt: new Date() }).where(eq(renderJobs.id, id));
      return this.view((await this.own(null, id)));
    }
    const asset = await this.media.ingestFile(j.userId, file, `render-${id}.${format}`, { move: true, metadata: { kind: 'render', jobId: id } });
    await this.db.insert(renderOutputs).values({ jobId: id, objectKey: asset.objectKey, format, sizeBytes: asset.sizeBytes, checksum: asset.sha256 });
    await this.finishAttempt(id, 'COMPLETED', null);
    await this.db.update(renderJobs).set({ status: 'COMPLETED', progress: 100, completedAt: new Date() }).where(eq(renderJobs.id, id));
    return this.view(await this.own(null, id));
  }

  async fail(id: string, error: string) {
    await this.own(null, id);
    await this.finishAttempt(id, 'FAILED', { message: error.slice(0, 2000) });
    await this.db.update(renderJobs).set({ status: 'FAILED', completedAt: new Date() }).where(eq(renderJobs.id, id));
    return { ok: true };
  }

  private async finishAttempt(id: string, status: string, error: object | null) {
    const [last] = await this.db.select().from(renderAttempts).where(eq(renderAttempts.jobId, id)).orderBy(desc(renderAttempts.attemptNumber)).limit(1);
    if (last) await this.db.update(renderAttempts).set({ status, error, finishedAt: new Date() }).where(eq(renderAttempts.id, last.id));
  }

  async heartbeat(name: string, capabilities: Record<string, unknown>) {
    const [w] = await this.db
      .insert(workerNodes)
      .values({ name, capabilities, status: 'ONLINE', lastHeartbeatAt: new Date() })
      .onConflictDoUpdate({ target: workerNodes.name, set: { capabilities, status: 'ONLINE', lastHeartbeatAt: new Date() } })
      .returning();
    return w!.id;
  }

  /** Superadmin "Test Render" of a preset: a sample document in the preset's style rendered in the cloud. */
  async presetTest(adminId: string, preset: { id: string; name: string; currentVersion: number; version: { recipe: unknown } | null }, format: Format) {
    const recipe = (preset.version?.recipe ?? {}) as { palette?: object; typography?: object; motion?: object; layout?: object };
    const base = newDocument(format, preset.name);
    const doc = MotionDocument.parse({
      ...base,
      preset: { id: preset.id, version: preset.currentVersion, name: preset.name },
      style: { ...base.style, ...recipe, typography: { ...base.style.typography, ...(recipe.typography ?? {}) } },
      scenes: [
        { id: 's1', durationFrames: 75, layers: [{ id: 'l', type: 'text', role: 'label', text: 'TEST RENDER', y: 0.3, effect: 'fade' }, { id: 't', type: 'text', role: 'title', text: preset.name, y: 0.45, effect: 'rise' }, { id: 'r', type: 'shape', shape: 'rect', y: 0.58, w: 0.3, h: 0.008, effect: 'wipe' }] },
        { id: 's2', durationFrames: 75, layers: [{ id: 'b', type: 'text', role: 'body', text: 'Contoh paragraf isi video edukasi dengan gaya preset ini.', y: 0.5, effect: 'fade' }] },
      ],
    });
    const p = await this.projects.create(adminId, { name: `Test render: ${preset.name}`, format, document: doc, status: 'SYSTEM' });
    return this.create(adminId, { projectId: p.id, mode: 'CLOUD', format: 'mp4' });
  }

  /** Writes an uploaded executor file to scratch for ingestion. */
  async scratchFile(id: string, buf: Buffer, format: RenderFormat) {
    const p = this.storage.scratch('render-out', `${id}.${format}`);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, buf);
    return p;
  }
}
