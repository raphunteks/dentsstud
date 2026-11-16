import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { type Database, projectDocuments, projectOperations, projectVersions, projects, syncConflicts } from '@dentweb/database';
import { MotionDocument, applyOperation, durationOf, newDocument, type Format, type Operation } from '@dentweb/motion-schema';
import { DB } from '../../infra/tokens.js';
import { AuditService } from '../../infra/infra.module.js';
import { StorageService } from '../../infra/storage.js';
import { Errors } from '../../infra/errors.js';

const hash = (d: unknown) => createHash('sha256').update(JSON.stringify(d)).digest('hex');

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  async own(userId: string, id: string, opts: { allowDeleted?: boolean } = {}) {
    const [p] = await this.db.select().from(projects).where(and(eq(projects.id, id), eq(projects.ownerId, userId), opts.allowDeleted ? undefined : isNull(projects.deletedAt)));
    if (!p) throw Errors.notFound('Project');
    return p;
  }

  list(userId: string, trash = false) {
    return this.db
      .select()
      .from(projects)
      .where(and(eq(projects.ownerId, userId), trash ? sql`${projects.deletedAt} is not null` : isNull(projects.deletedAt), sql`${projects.status} <> 'SYSTEM'`))
      .orderBy(desc(projects.updatedAt))
      .limit(200);
  }

  async create(userId: string, i: { name: string; format: Format; document?: unknown; status?: string }) {
    const doc = i.document ? MotionDocument.parse(i.document) : newDocument(i.format, i.name);
    return this.db.transaction(async (tx) => {
      const [p] = await tx
        .insert(projects)
        .values({ ownerId: userId, name: i.name, status: i.status ?? 'ACTIVE', width: doc.width, height: doc.height, fps: doc.fps, durationFrames: durationOf(doc), currentRevision: 1 })
        .returning();
      await tx.insert(projectDocuments).values({ projectId: p!.id, schemaVersion: 1, revision: 1, document: doc, checksum: hash(doc) });
      return p!;
    });
  }

  async update(userId: string, id: string, i: { name?: string }) {
    await this.own(userId, id);
    const [p] = await this.db.update(projects).set(i).where(eq(projects.id, id)).returning();
    return p!;
  }

  async trash(userId: string, id: string) {
    await this.own(userId, id);
    await this.db.update(projects).set({ deletedAt: new Date() }).where(eq(projects.id, id));
    return { ok: true };
  }

  async restore(userId: string, id: string) {
    await this.own(userId, id, { allowDeleted: true });
    await this.db.update(projects).set({ deletedAt: null }).where(eq(projects.id, id));
    return { ok: true };
  }

  async document(userId: string, id: string) {
    const p = await this.own(userId, id);
    const [d] = await this.db.select().from(projectDocuments).where(eq(projectDocuments.projectId, id));
    return { project: p, revision: d!.revision, document: d!.document as MotionDocument, checksum: d!.checksum };
  }

  private async write(id: string, doc: MotionDocument, revision: number, op: { operationId: string; baseRevision: number; payload: unknown } | null) {
    await this.db.transaction(async (tx) => {
      const [cur] = await tx.select().from(projectDocuments).where(eq(projectDocuments.projectId, id)).for('update');
      if (cur!.revision !== revision - 1) throw Errors.conflict('REVISION_CONFLICT', 'Dokumen berubah di perangkat lain');
      await tx.update(projectDocuments).set({ document: doc, revision, checksum: hash(doc) }).where(eq(projectDocuments.projectId, id));
      await tx.update(projects).set({ currentRevision: revision, width: doc.width, height: doc.height, fps: doc.fps, durationFrames: durationOf(doc) }).where(eq(projects.id, id));
      if (op) await tx.insert(projectOperations).values({ projectId: id, operationId: op.operationId, baseRevision: op.baseRevision, resultRevision: revision, payload: op.payload });
    });
  }

  /** Whole-document save with optimistic concurrency. */
  async putDocument(userId: string, id: string, document: unknown, baseRevision: number) {
    const cur = await this.document(userId, id);
    if (baseRevision !== cur.revision) {
      throw Errors.conflict('REVISION_CONFLICT', `Revisi server ${cur.revision}, revisi Anda ${baseRevision}`);
    }
    const doc = MotionDocument.parse(document);
    await this.write(id, doc, cur.revision + 1, null);
    return { revision: cur.revision + 1 };
  }

  /**
   * Offline sync: an idempotent batch of operations. If the base is stale, the ops are rebased onto
   * the latest revision when they still apply; otherwise a conflict copy is made — local work is never lost.
   */
  async applyOps(userId: string, id: string, i: { operationId: string; baseRevision: number; ops: Operation[] }) {
    const [dup] = await this.db.select().from(projectOperations).where(eq(projectOperations.operationId, i.operationId));
    if (dup) return { revision: Number(dup.resultRevision), duplicate: true };
    const cur = await this.document(userId, id);
    try {
      let doc = cur.document;
      for (const op of i.ops) doc = applyOperation(doc, op);
      await this.write(id, doc, cur.revision + 1, { operationId: i.operationId, baseRevision: i.baseRevision, payload: i.ops });
      return { revision: cur.revision + 1, rebased: i.baseRevision !== cur.revision };
    } catch (e) {
      if ((e as { response?: { error?: { code?: string } } }).response?.error?.code === 'REVISION_CONFLICT') throw e;
      // Not mergeable: keep the member's intent as a conflict copy built from their own base.
      const copy = await this.create(userId, { name: `${cur.project.name} (konflik ${new Date().toISOString().slice(0, 16)})`, format: cur.document.format, document: cur.document });
      let doc = cur.document;
      const applied: Operation[] = [];
      for (const op of i.ops) {
        try {
          doc = applyOperation(doc, op);
          applied.push(op);
        } catch {
          /* skip ops that cannot apply */
        }
      }
      await this.putDocument(userId, copy.id, doc, 1).catch(() => undefined);
      const [c] = await this.db
        .insert(syncConflicts)
        .values({ projectId: id, userId, localRevision: i.baseRevision, remoteRevision: cur.revision, status: 'COPIED', resolution: { copyProjectId: copy.id, error: (e as Error).message, appliedOps: applied.length, totalOps: i.ops.length } })
        .returning();
      await this.audit.log({ actorId: userId, action: 'sync.conflict', targetType: 'project', targetId: id, metadata: { copy: copy.id } });
      return { revision: cur.revision, conflict: { id: c!.id, copyProjectId: copy.id } };
    }
  }

  /** Immutable snapshot (used by renders and version history). */
  async snapshot(userId: string, id: string) {
    const cur = await this.document(userId, id);
    const [existing] = await this.db.select().from(projectVersions).where(and(eq(projectVersions.projectId, id), eq(projectVersions.revision, cur.revision)));
    if (existing) return { ...existing, document: cur.document };
    const key = `snapshots/${id}/${cur.revision}.json`;
    await this.storage.putBuffer(key, Buffer.from(JSON.stringify(cur.document)), 'application/json');
    const [v] = await this.db.insert(projectVersions).values({ projectId: id, revision: cur.revision, snapshotRef: key, checksum: cur.checksum }).onConflictDoNothing().returning();
    return { ...(v ?? (await this.db.select().from(projectVersions).where(and(eq(projectVersions.projectId, id), eq(projectVersions.revision, cur.revision))))[0]!), document: cur.document };
  }

  async versions(userId: string, id: string) {
    await this.own(userId, id);
    return this.db.select().from(projectVersions).where(eq(projectVersions.projectId, id)).orderBy(desc(projectVersions.revision));
  }

  async conflicts(userId: string) {
    return this.db.select().from(syncConflicts).where(eq(syncConflicts.userId, userId)).orderBy(desc(syncConflicts.createdAt)).limit(50);
  }
}
