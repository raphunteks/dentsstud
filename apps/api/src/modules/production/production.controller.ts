import { Controller, Delete, Get, Headers, HttpCode, MessageEvent, Param, ParseUUIDPipe, Patch, Post, Query, Res, Sse } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Response } from 'express';
import type { SessionUser } from '@dentweb/shared-types';
import { ApiZodBody, ZBody, ZQuery } from '../../common/zod.js';
import { CurrentUser, Roles } from '../../common/auth-context.js';
import { Errors } from '../../infra/errors.js';
import { OrderInput, ProductionService } from './production.service.js';
import { ResultPatch, ResultsService, RerenderInput, RevoiceInput, SocialPatch, TABS } from './results.service.js';
import { AgentPatch, AgentsAdminService, WorkflowCreateInput } from './agents-admin.service.js';
import { ProductionWorker } from './production.worker.js';

const RunQuery = z.object({ status: z.string().max(200).optional(), limit: z.coerce.number().int().min(1).max(500).default(100) });
const EventsQuery = z.object({ after: z.iso.datetime().optional(), technical: z.enum(['0', '1']).default('0') });
const ResultsQuery = z.object({ tab: z.enum(TABS).default('READY') });
const idemKey = (h: string | undefined) => {
  const k = (h ?? '').trim();
  if (k && !/^[\w.:-]{8,128}$/.test(k)) throw Errors.invalid('IDEMPOTENCY_KEY', 'Idempotency-Key tidak valid');
  return k || randomUUID();
};
const statuses = (s?: string) => (s ? s.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean) : undefined);

function stream(fetch: (after?: string) => Promise<{ id?: string; createdAt: Date }[]>, state: () => Promise<{ status: string; progress: number; currentStage: string | null }>): Observable<MessageEvent> {
  return new Observable<MessageEvent>((sub) => {
    let after: string | undefined;
    const seen = new Set<string>();
    let closed = false;
    const loop = async () => {
      while (!closed) {
        try {
          const evs = await fetch(after);
          for (const e of evs) {
            const key = e.id ?? `${e.createdAt.toISOString()}`;
            if (seen.has(key)) continue;
            seen.add(key);
            sub.next({ type: 'event', data: e });
          }
          if (evs.length) after = evs[evs.length - 1]!.createdAt.toISOString();
          const s = await state();
          sub.next({ type: 'state', data: s });
          if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(s.status)) {
            sub.complete();
            return;
          }
        } catch (e) {
          sub.error(e);
          return;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
    };
    void loop();
    return () => {
      closed = true;
    };
  });
}

@ApiTags('production')
@Controller('production')
export class ProductionController {
  constructor(private readonly svc: ProductionService) {}

  @Get('readiness')
  readiness(@CurrentUser() me: SessionUser) {
    return this.svc.readiness(me.id);
  }

  @Post('orders')
  @ApiZodBody(OrderInput)
  create(@CurrentUser() me: SessionUser, @ZBody(OrderInput) b: OrderInput, @Headers('idempotency-key') key?: string) {
    return this.svc.createOrder(me.id, b, idemKey(key));
  }

  @Get('orders')
  orders(@CurrentUser() me: SessionUser) {
    return this.svc.listOrders(me.id);
  }

  @Get('orders/:id')
  order(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getOrder(me.id, id);
  }

  @Post('orders/:id/start')
  @HttpCode(200)
  start(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.startOrder(me.id, id);
  }

  @Get('runs')
  runs(@CurrentUser() me: SessionUser, @ZQuery(RunQuery) q: z.infer<typeof RunQuery>) {
    return this.svc.listRuns(me.id, statuses(q.status), q.limit);
  }

  @Get('active')
  active(@CurrentUser() me: SessionUser) {
    return this.svc.activeSummary(me.id);
  }

  @Get('runs/:id')
  run(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getRun(me.id, id);
  }

  @Get('runs/:id/stages')
  stages(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.stages(me.id, id);
  }

  @Get('runs/:id/events')
  events(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZQuery(EventsQuery) q: z.infer<typeof EventsQuery>) {
    return this.svc.events(me.id, id, q.after, q.technical === '1');
  }

  @Sse('runs/:id/stream')
  async live(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.svc.ownRun(me.id, id);
    return stream((after) => this.svc.events(me.id, id, after), () => this.svc.ownRun(me.id, id));
  }

  @Post('runs/:id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.cancel(me.id, me.id, id);
  }

  @Post('runs/:id/retry')
  @HttpCode(200)
  retry(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.restart(me.id, me.id, id, 'retry');
  }

  @Post('runs/:id/resume')
  @HttpCode(200)
  resume(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.restart(me.id, me.id, id, 'resume');
  }
}

@ApiTags('results')
@Controller('results')
export class ResultsController {
  constructor(private readonly svc: ResultsService) {}

  @Get()
  list(@CurrentUser() me: SessionUser, @ZQuery(ResultsQuery) q: z.infer<typeof ResultsQuery>) {
    return this.svc.list(me.id, q.tab);
  }

  @Get(':id')
  get(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.get(me.id, id);
  }

  @Patch(':id')
  @ApiZodBody(ResultPatch)
  patch(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(ResultPatch) b: z.infer<typeof ResultPatch>) {
    return this.svc.patch(me.id, me.id, id, b);
  }

  @Delete(':id')
  remove(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.trash(me.id, me.id, id);
  }

  @Post(':id/restore')
  @HttpCode(200)
  restore(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.restore(me.id, me.id, id);
  }

  /** Redirects to a short-lived signed URL; `?json=1` returns it instead (desktop downloader). */
  @Get(':id/download')
  async download(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Query('json') json: string | undefined, @Res() res: Response) {
    const url = await this.svc.downloadUrl(me.id, id);
    if (json === '1') res.json({ url });
    else res.redirect(302, url);
  }

  @Get(':id/cover')
  async cover(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Query('json') json: string | undefined, @Res() res: Response) {
    const url = await this.svc.coverUrl(me.id, id);
    if (json === '1') res.json({ url });
    else res.redirect(302, url);
  }

  @Get(':id/social')
  social(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.social(me.id, id);
  }

  @Patch(':id/social')
  @ApiZodBody(SocialPatch)
  patchSocial(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(SocialPatch) b: z.infer<typeof SocialPatch>) {
    return this.svc.patchSocial(me.id, me.id, id, b);
  }

  @Post(':id/revoice')
  @ApiZodBody(RevoiceInput)
  revoice(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(RevoiceInput) b: z.infer<typeof RevoiceInput>, @Headers('idempotency-key') key?: string) {
    return this.svc.revise(me.id, id, { voice: b.voice }, idemKey(key));
  }

  @Post(':id/rerender')
  @ApiZodBody(RerenderInput)
  rerender(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(RerenderInput) b: z.infer<typeof RerenderInput>, @Headers('idempotency-key') key?: string) {
    return this.svc.revise(me.id, id, { format: b.format, presetId: b.presetId, hook: b.hook ? { mode: b.hook.mode, hookId: b.hook.hookId ?? null } : undefined }, idemKey(key));
  }
}

@ApiTags('admin')
@Roles('SUPERADMIN')
@Controller('admin')
export class AdminProductionController {
  constructor(
    private readonly svc: ProductionService,
    private readonly results: ResultsService,
    private readonly agents: AgentsAdminService,
    private readonly worker: ProductionWorker,
  ) {}

  @Get('production/runs')
  runs(@ZQuery(RunQuery) q: z.infer<typeof RunQuery>) {
    return this.svc.listRuns(null, statuses(q.status), q.limit);
  }

  @Get('production/runs/:id')
  run(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getRun(null, id);
  }

  @Get('production/runs/:id/logs')
  logs(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.events(null, id, undefined, true);
  }

  @Post('production/runs/:id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.cancel(me.id, null, id);
  }

  @Post('production/runs/:id/retry')
  @HttpCode(200)
  retry(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.restart(me.id, null, id, 'resume');
  }

  @Post('production/scheduler/tick')
  @HttpCode(200)
  tick() {
    return this.worker.tick(new Date());
  }

  @Get('production/quotas')
  quotas() {
    return this.agents.quotas();
  }

  @Get('results')
  allResults(@ZQuery(ResultsQuery) q: z.infer<typeof ResultsQuery>) {
    return this.results.list(null, q.tab);
  }

  @Get('results/:id')
  result(@Param('id', ParseUUIDPipe) id: string) {
    return this.results.get(null, id);
  }

  @Get('agents')
  listAgents() {
    return this.agents.agents();
  }

  @Patch('agents/:id')
  @ApiZodBody(AgentPatch)
  patchAgent(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(AgentPatch) b: z.infer<typeof AgentPatch>) {
    return this.agents.patchAgent(me.id, id, b);
  }

  @Post('agents/:id/rollback/:version')
  @HttpCode(200)
  rollbackAgent(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Param('version') version: string) {
    return this.agents.rollbackAgent(me.id, id, Number(version));
  }

  @Get('workflows')
  workflows() {
    return this.agents.workflows();
  }

  @Post('workflows')
  @ApiZodBody(WorkflowCreateInput)
  createWorkflow(@CurrentUser() me: SessionUser, @ZBody(WorkflowCreateInput) b: z.infer<typeof WorkflowCreateInput>) {
    return this.agents.createVersion(me.id, b);
  }

  @Post('workflows/:id/test')
  @HttpCode(200)
  testWorkflow(@Param('id', ParseUUIDPipe) id: string) {
    return this.agents.test(id);
  }

  @Post('workflows/:id/publish')
  @HttpCode(200)
  publishWorkflow(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.agents.publish(me.id, id);
  }
}
