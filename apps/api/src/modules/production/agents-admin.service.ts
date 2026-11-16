import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, inArray, max } from 'drizzle-orm';
import { z } from 'zod';
import { type Database, agentDefinitions, agentPromptVersions, licenses, productionRuns, users, workflowDefinitions, workflowVersions } from '@dentweb/database';
import { DB } from '../../infra/tokens.js';
import { Errors } from '../../infra/errors.js';
import { AuditService } from '../../infra/infra.module.js';
import { CONTRACT } from './agents.js';

export const AgentPatch = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  description: z.string().trim().max(1000).optional(),
  isActive: z.boolean().optional(),
  config: z.object({ model: z.string().max(100).nullish(), temperature: z.number().min(0).max(1).optional(), maxTokens: z.number().int().min(256).max(32000).optional() }).optional(),
  systemPrompt: z.string().trim().min(20).max(20000).optional(),
});

/** Stages are fixed engine capabilities; a workflow chooses which optional ones run and their limits. */
const STAGE_ORDER = ['RESEARCH', 'SCRIPT', 'FACT_CHECK', 'MOTION', 'QC', 'SOCIAL'] as const;
const REQUIRED = ['RESEARCH', 'SCRIPT', 'MOTION', 'SOCIAL'];
const STAGE_AGENT: Record<string, string> = { RESEARCH: 'research', SCRIPT: 'scriptwriter', FACT_CHECK: 'fact_checker', MOTION: 'motion_director', QC: 'qc', SOCIAL: 'social_media' };
export const WorkflowDefinitionInput = z.object({
  stages: z
    .array(z.object({ code: z.enum(STAGE_ORDER), agent: z.string().max(100), timeoutSec: z.number().int().min(30).max(7200), maxAttempts: z.number().int().min(1).max(5) }))
    .min(4)
    .max(6),
});
export const WorkflowCreateInput = z.object({ workflowId: z.uuid(), definition: WorkflowDefinitionInput });

@Injectable()
export class AgentsAdminService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async agents() {
    const defs = await this.db.select().from(agentDefinitions).orderBy(agentDefinitions.code);
    return Promise.all(
      defs.map(async (a) => {
        const versions = await this.db
          .select({ version: agentPromptVersions.version, createdAt: agentPromptVersions.createdAt, systemPrompt: agentPromptVersions.systemPrompt })
          .from(agentPromptVersions)
          .where(eq(agentPromptVersions.agentId, a.id))
          .orderBy(desc(agentPromptVersions.version));
        return { ...a, systemPrompt: versions.find((v) => v.version === a.currentVersion)?.systemPrompt ?? '', outputContract: CONTRACT[a.code]?.shape ?? null, versions: versions.map(({ systemPrompt: _p, ...v }) => v) };
      }),
    );
  }

  async patchAgent(actorId: string, id: string, p: z.infer<typeof AgentPatch>) {
    const [a] = await this.db.select().from(agentDefinitions).where(eq(agentDefinitions.id, id));
    if (!a) throw Errors.notFound('Agent');
    await this.db.transaction(async (tx) => {
      let currentVersion = a.currentVersion;
      if (p.systemPrompt) {
        const [cur] = await tx.select().from(agentPromptVersions).where(and(eq(agentPromptVersions.agentId, id), eq(agentPromptVersions.version, a.currentVersion)));
        if (cur?.systemPrompt !== p.systemPrompt) {
          const [{ v }] = (await tx.select({ v: max(agentPromptVersions.version) }).from(agentPromptVersions).where(eq(agentPromptVersions.agentId, id))) as [{ v: number | null }];
          currentVersion = (v ?? 0) + 1;
          await tx.insert(agentPromptVersions).values({ agentId: id, version: currentVersion, systemPrompt: p.systemPrompt, inputSchema: cur?.inputSchema ?? {}, outputSchema: cur?.outputSchema ?? {} });
        }
      }
      await tx
        .update(agentDefinitions)
        .set({
          ...(p.name ? { name: p.name } : {}),
          ...(p.description !== undefined ? { description: p.description } : {}),
          ...(p.isActive !== undefined ? { isActive: p.isActive } : {}),
          ...(p.config ? { config: { ...(a.config as object), ...p.config } } : {}),
          currentVersion,
        })
        .where(eq(agentDefinitions.id, id));
    });
    await this.audit.log({ actorId, action: 'agent.update', targetType: 'agent', targetId: id, metadata: { fields: Object.keys(p) } });
    return (await this.agents()).find((x) => x.id === id);
  }

  /** Activate an earlier prompt version. */
  async rollbackAgent(actorId: string, id: string, version: number) {
    const [v] = await this.db.select().from(agentPromptVersions).where(and(eq(agentPromptVersions.agentId, id), eq(agentPromptVersions.version, version)));
    if (!v) throw Errors.notFound('Versi prompt');
    await this.db.update(agentDefinitions).set({ currentVersion: version }).where(eq(agentDefinitions.id, id));
    await this.audit.log({ actorId, action: 'agent.rollback', targetType: 'agent', targetId: id, metadata: { version } });
    return { ok: true };
  }

  async workflows() {
    const defs = await this.db.select().from(workflowDefinitions);
    return Promise.all(
      defs.map(async (w) => ({ ...w, versions: await this.db.select().from(workflowVersions).where(eq(workflowVersions.workflowId, w.id)).orderBy(desc(workflowVersions.version)) })),
    );
  }

  /** Structural checks + agent availability. Returns issues; empty = valid. */
  async check(def: z.infer<typeof WorkflowDefinitionInput>) {
    const issues: string[] = [];
    const codes = def.stages.map((s) => s.code);
    for (const r of REQUIRED) if (!codes.includes(r as (typeof STAGE_ORDER)[number])) issues.push(`Tahap wajib ${r} tidak ada`);
    if (new Set(codes).size !== codes.length) issues.push('Tahap tidak boleh duplikat');
    const order = codes.map((c) => STAGE_ORDER.indexOf(c));
    if (order.some((x, i) => i > 0 && x < order[i - 1]!)) issues.push(`Urutan tahap harus ${STAGE_ORDER.join(' → ')}`);
    for (const s of def.stages) if (s.agent !== STAGE_AGENT[s.code]) issues.push(`Tahap ${s.code} harus memakai agent ${STAGE_AGENT[s.code]}`);
    const agents = await this.db.select().from(agentDefinitions).where(inArray(agentDefinitions.code, def.stages.map((s) => s.agent)));
    for (const s of def.stages) {
      const a = agents.find((x) => x.code === s.agent);
      if (!a) issues.push(`Agent ${s.agent} tidak terdaftar`);
      else if (!a.isActive) issues.push(`Agent ${s.agent} nonaktif`);
      else {
        const [p] = await this.db.select().from(agentPromptVersions).where(and(eq(agentPromptVersions.agentId, a.id), eq(agentPromptVersions.version, a.currentVersion)));
        if (!p?.systemPrompt.trim()) issues.push(`Prompt agent ${s.agent} kosong`);
      }
    }
    return issues;
  }

  async createVersion(actorId: string, i: z.infer<typeof WorkflowCreateInput>) {
    const [w] = await this.db.select().from(workflowDefinitions).where(eq(workflowDefinitions.id, i.workflowId));
    if (!w) throw Errors.notFound('Workflow');
    const issues = await this.check(i.definition);
    if (issues.length) throw Errors.invalid('WORKFLOW_INVALID', 'Definisi workflow tidak valid', issues);
    const [{ v }] = (await this.db.select({ v: max(workflowVersions.version) }).from(workflowVersions).where(eq(workflowVersions.workflowId, w.id))) as [{ v: number | null }];
    const [row] = await this.db.insert(workflowVersions).values({ workflowId: w.id, version: (v ?? 0) + 1, definition: i.definition }).returning();
    await this.audit.log({ actorId, action: 'workflow.version.create', targetType: 'workflow_version', targetId: row!.id });
    return row;
  }

  private async version(id: string) {
    const [v] = await this.db.select().from(workflowVersions).where(eq(workflowVersions.id, id));
    if (!v) throw Errors.notFound('Versi workflow');
    return v;
  }

  async test(id: string) {
    const v = await this.version(id);
    const parsed = WorkflowDefinitionInput.safeParse(v.definition);
    const issues = parsed.success ? await this.check(parsed.data) : parsed.error.issues.map((x) => x.message);
    return { versionId: id, valid: issues.length === 0, issues };
  }

  async publish(actorId: string, id: string) {
    const v = await this.version(id);
    const t = await this.test(id);
    if (!t.valid) throw Errors.invalid('WORKFLOW_INVALID', 'Workflow tidak lolos pengujian', t.issues);
    await this.db.update(workflowDefinitions).set({ currentVersion: v.version, status: 'PUBLISHED' }).where(eq(workflowDefinitions.id, v.workflowId));
    await this.audit.log({ actorId, action: 'workflow.publish', targetType: 'workflow_version', targetId: id, metadata: { version: v.version } });
    return { ok: true, version: v.version };
  }

  /** Per-member usage vs entitlement for today (admin quotas page). */
  async quotas() {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const used = await this.db
      .select({ userId: productionRuns.userId, n: count() })
      .from(productionRuns)
      .where(and(eq(productionRuns.kind, 'PRODUCTION'), gte(productionRuns.createdAt, since)))
      .groupBy(productionRuns.userId);
    const active = await this.db
      .select({ userId: productionRuns.userId, n: count() })
      .from(productionRuns)
      .where(inArray(productionRuns.status, ['QUEUED', 'RUNNING', 'CANCELLING']))
      .groupBy(productionRuns.userId);
    const rows = await this.db
      .select({ id: users.id, email: users.email, displayName: users.displayName, entitlements: licenses.entitlements, licenseStatus: licenses.status })
      .from(users)
      .innerJoin(licenses, and(eq(licenses.userId, users.id), eq(licenses.status, 'ACTIVE')));
    return rows.map((r) => ({ ...r, usedToday: Number(used.find((u) => u.userId === r.id)?.n ?? 0), active: Number(active.find((u) => u.userId === r.id)?.n ?? 0) }));
  }
}
