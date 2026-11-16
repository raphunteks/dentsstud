import { randomUUID } from 'node:crypto';
import { applyOperation, MotionDocument, Operation } from '@dentweb/motion-schema';
import { localDb } from './store.js';
import { request, ApiFailure } from '../ipc/api-client.js';

/** Offline project cache + operation journal (SQLite). Local changes are never discarded. */
function init() {
  localDb().exec(`CREATE TABLE IF NOT EXISTS projects_cache (id TEXT PRIMARY KEY, name TEXT NOT NULL, revision INTEGER NOT NULL, document TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')));`);
}

export async function cacheProject(projectId: string) {
  init();
  const r = await request<{ revision: number; document: unknown; project: { name: string } }>('GET', `/projects/${projectId}/document`);
  localDb().prepare("INSERT INTO projects_cache(id,name,revision,document,updated_at) VALUES(?,?,?,?,datetime('now')) ON CONFLICT(id) DO UPDATE SET name=excluded.name, revision=excluded.revision, document=excluded.document, updated_at=excluded.updated_at").run(projectId, r.project.name, r.revision, JSON.stringify(r.document));
  return { projectId, revision: r.revision };
}

export function localProjects() {
  init();
  const rows = localDb().prepare('SELECT id, name, revision, document, updated_at FROM projects_cache ORDER BY updated_at DESC').all() as { id: string; name: string; revision: number; document: string; updated_at: string }[];
  const pending = localDb().prepare("SELECT project_id, count(*) n FROM operation_journal WHERE status='PENDING' GROUP BY project_id").all() as { project_id: string; n: number }[];
  return rows.map((r) => ({ id: r.id, name: r.name, revision: r.revision, updatedAt: r.updated_at, document: JSON.parse(r.document) as MotionDocument, pendingOps: pending.find((p) => p.project_id === r.id)?.n ?? 0 }));
}

/** Applies ops locally (works offline) and journals them for sync. */
export function localOp(projectId: string, rawOps: unknown[]) {
  init();
  const row = localDb().prepare('SELECT revision, document FROM projects_cache WHERE id = ?').get(projectId) as { revision: number; document: string } | undefined;
  if (!row) throw new Error('Project belum tersedia offline');
  const ops = rawOps.map((o) => Operation.parse(o));
  let doc = MotionDocument.parse(JSON.parse(row.document));
  for (const op of ops) doc = applyOperation(doc, op);
  localDb().prepare("UPDATE projects_cache SET document = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(doc), projectId);
  localDb().prepare('INSERT INTO operation_journal(id, project_id, base_revision, payload) VALUES(?,?,?,?)').run(randomUUID(), projectId, row.revision, JSON.stringify(ops));
  return { document: doc };
}

export async function syncAll() {
  init();
  const rows = localDb().prepare("SELECT id, project_id, base_revision, payload FROM operation_journal WHERE status='PENDING' ORDER BY created_at").all() as { id: string; project_id: string; base_revision: number; payload: string }[];
  const results: { projectId: string; status: string; conflictCopy?: string }[] = [];
  for (const r of rows) {
    try {
      const res = await request<{ revision: number; conflict?: { copyProjectId: string } }>('POST', `/projects/${r.project_id}/operations`, { operationId: r.id, baseRevision: r.base_revision, ops: JSON.parse(r.payload) });
      localDb().prepare("UPDATE operation_journal SET status = ? WHERE id = ?").run(res.conflict ? 'CONFLICT_COPIED' : 'SYNCED', r.id);
      results.push({ projectId: r.project_id, status: res.conflict ? 'CONFLICT_COPIED' : 'SYNCED', conflictCopy: res.conflict?.copyProjectId });
    } catch (e) {
      if (e instanceof ApiFailure && e.status === 0) break; // still offline: keep the journal
      results.push({ projectId: r.project_id, status: `ERROR: ${(e as Error).message}` });
    }
  }
  for (const pid of new Set(rows.map((r) => r.project_id))) await cacheProject(pid).catch(() => undefined);
  return results;
}
