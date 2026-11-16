import { Body, Controller, Get, Headers, HttpCode, Inject, Injectable, Param, ParseUUIDPipe, Patch, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Response } from 'express';
import {
  type Database, errorReports, mediaAssets, productionRuns, renderJobs, users,
} from '@dentweb/database';
import type { SessionUser } from '@dentweb/shared-types';
import { CurrentUser, Public, Roles } from '../../common/auth-context.js';
import { ApiZodBody, ZBody, ZodPipe, ZQuery } from '../../common/zod.js';
import { DB, ENV } from '../../infra/tokens.js';
import type { Env } from '../../config/env.js';
import { Errors } from '../../infra/errors.js';
import { AuditService } from '../../infra/infra.module.js';
import { ErrorReportsService, MetricsRegistry } from '../../infra/observability.js';
import { QueueService } from '../../infra/queues.js';

const ClientError = z.object({
  source: z.enum(['web', 'desktop']),
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional(),
  url: z.string().max(500).optional(),
  release: z.string().max(40).optional(),
});
const ErrorPatch = z.object({ status: z.enum(['OPEN', 'RESOLVED', 'IGNORED']) });
const Days = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });

@Injectable()
export class AnalyticsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async overview(days: number) {
    const since = new Date(Date.now() - days * 86_400_000);
    const daily = await this.db.execute<{ day: string; completed: number; failed: number; cancelled: number; total: number }>(sql`
      select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
        count(*) filter (where status = 'COMPLETED')::int as completed,
        count(*) filter (where status = 'FAILED')::int as failed,
        count(*) filter (where status = 'CANCELLED')::int as cancelled,
        count(*)::int as total
      from production_runs where created_at >= ${since} group by 1 order by 1`);
    const stages = await this.db.execute<{ stage: string; avg_sec: number; runs: number }>(sql`
      select stage_code as stage, round(avg(extract(epoch from (completed_at - started_at)))::numeric, 1)::float as avg_sec, count(*)::int as runs
      from production_stage_runs where status = 'COMPLETED' and started_at >= ${since} and completed_at is not null and coalesce(input_ref, '') not like 'reuse:%'
      group by 1`);
    const render = await this.db.execute<{ mode: string; jobs: number; avg_sec: number | null; failed: number }>(sql`
      select j.mode, count(distinct j.id)::int as jobs,
        round(avg(extract(epoch from (a.finished_at - a.started_at))) filter (where a.status = 'COMPLETED')::numeric, 1)::float as avg_sec,
        count(distinct j.id) filter (where j.status = 'FAILED')::int as failed
      from render_jobs j left join render_attempts a on a.job_id = j.id where j.created_at >= ${since} group by 1`);
    const topErrors = await this.db.execute<{ message: string; n: number }>(sql`
      select coalesce(error->>'message', 'Tidak diketahui') as message, count(*)::int as n
      from production_runs where status = 'FAILED' and created_at >= ${since} group by 1 order by 2 desc limit 5`);
    const [members] = (await this.db.execute<{ active: number; fresh: number; total: number }>(sql`
      select (select count(distinct user_id) from production_runs where created_at >= ${since})::int as active,
        (select count(*) from users where created_at >= ${since} and deleted_at is null)::int as fresh,
        (select count(*) from users where deleted_at is null)::int as total`)).rows;
    const [results] = (await this.db.execute<{ total: number; uploaded: number; revisions: number }>(sql`
      select count(*)::int as total, count(*) filter (where status = 'UPLOADED')::int as uploaded, count(*) filter (where revision > 1)::int as revisions
      from video_results where created_at >= ${since} and deleted_at is null`)).rows;
    const [{ n: narrations }] = (await this.db.select({ n: count() }).from(mediaAssets).where(and(gte(mediaAssets.createdAt, since), sql`${mediaAssets.metadata}->>'kind' = 'narration'`))) as [{ n: number }];
    const d = daily.rows;
    const completed = d.reduce((a, r) => a + r.completed, 0);
    const failed = d.reduce((a, r) => a + r.failed, 0);
    return {
      days,
      daily: d,
      totals: { runs: d.reduce((a, r) => a + r.total, 0), completed, failed, successRate: completed + failed ? Math.round((completed / (completed + failed)) * 1000) / 10 : null },
      stages: stages.rows,
      render: render.rows,
      topErrors: topErrors.rows,
      members,
      results: { ...results, narrations },
    };
  }
}

@ApiTags('ops')
@Controller()
export class OpsController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Database,
    private readonly errors: ErrorReportsService,
    private readonly metrics: MetricsRegistry,
    private readonly queues: QueueService,
  ) {}

  /** Client-side error reports (web + desktop). Rate limited; stores no request body beyond the given fields. */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('telemetry/errors')
  @HttpCode(202)
  @ApiZodBody(ClientError)
  async clientError(@CurrentUser() me: SessionUser | undefined, @Body(new ZodPipe(ClientError)) b: z.infer<typeof ClientError>) {
    await this.errors.record({ source: b.source, message: b.message, stack: b.stack, userId: me?.id ?? null, context: { url: b.url?.replace(/\?.*$/, ''), release: b.release } });
    return { accepted: true };
  }

  /** Prometheus scrape endpoint; disabled unless METRICS_TOKEN is set. */
  @Public()
  @Get('metrics')
  async scrape(@Headers('authorization') auth: string | undefined, @Res() res: Response) {
    const token = this.env.METRICS_TOKEN;
    const given = Buffer.from((auth ?? '').replace(/^Bearer\s+/i, ''));
    if (!token) throw Errors.notFound('Endpoint');
    const want = Buffer.from(token);
    if (given.length !== want.length || !timingSafeEqual(given, want)) throw Errors.unauthorized();
    const runs = await this.db.select({ status: productionRuns.status, n: count() }).from(productionRuns).groupBy(productionRuns.status);
    const jobs = await this.db.select({ status: renderJobs.status, n: count() }).from(renderJobs).groupBy(renderJobs.status);
    const [{ n: openErrors }] = (await this.db.select({ n: count() }).from(errorReports).where(eq(errorReports.status, 'OPEN'))) as [{ n: number }];
    const queueCounts = await Promise.all(
      (['render', 'production', 'scheduler'] as const).map(async (q) => [q, await this.queues[q].getJobCounts('waiting', 'active', 'delayed', 'failed')] as const),
    );
    const mem = process.memoryUsage();
    const lines = [
      this.metrics.render(),
      '# TYPE dentweb_production_runs gauge',
      ...runs.map((r) => `dentweb_production_runs{status="${r.status}"} ${r.n}`),
      '# TYPE dentweb_render_jobs gauge',
      ...jobs.map((r) => `dentweb_render_jobs{status="${r.status}"} ${r.n}`),
      '# TYPE dentweb_queue_jobs gauge',
      ...queueCounts.flatMap(([q, c]) => Object.entries(c).map(([state, n]) => `dentweb_queue_jobs{queue="${q}",state="${state}"} ${n}`)),
      '# TYPE dentweb_error_reports_open gauge',
      `dentweb_error_reports_open ${openErrors}`,
      '# TYPE dentweb_process_resident_memory_bytes gauge',
      `dentweb_process_resident_memory_bytes ${mem.rss}`,
      '# TYPE dentweb_db_pool_connections gauge',
      `dentweb_db_pool_connections{state="total"} ${this.db.$client.totalCount}`,
      `dentweb_db_pool_connections{state="idle"} ${this.db.$client.idleCount}`,
      `dentweb_db_pool_connections{state="waiting"} ${this.db.$client.waitingCount}`,
      '',
    ];
    res.type('text/plain; version=0.0.4').send(lines.join('\n'));
  }
}

@ApiTags('admin')
@Roles('SUPERADMIN')
@Controller('admin')
export class AdminInsightsController {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly analytics: AnalyticsService,
    private readonly audit: AuditService,
  ) {}

  @Get('analytics')
  overview(@ZQuery(Days) q: z.infer<typeof Days>) {
    return this.analytics.overview(q.days);
  }

  @Get('errors')
  async list(@ZQuery(z.object({ status: z.enum(['OPEN', 'RESOLVED', 'IGNORED']).optional() })) q: { status?: string }) {
    return this.db
      .select({ e: errorReports, email: users.email })
      .from(errorReports)
      .leftJoin(users, eq(users.id, errorReports.userId))
      .where(q.status ? eq(errorReports.status, q.status) : undefined)
      .orderBy(desc(errorReports.lastSeenAt))
      .limit(200)
      .then((rows) => rows.map((r) => ({ ...r.e, userEmail: r.email })));
  }

  @Patch('errors/:id')
  @ApiZodBody(ErrorPatch)
  async patch(@CurrentUser() me: SessionUser, @Param('id', ParseUUIDPipe) id: string, @ZBody(ErrorPatch) b: z.infer<typeof ErrorPatch>) {
    const [row] = await this.db.update(errorReports).set({ status: b.status }).where(eq(errorReports.id, id)).returning();
    if (!row) throw Errors.notFound('Laporan error');
    await this.audit.log({ actorId: me.id, action: 'error_report.update', targetType: 'error_report', targetId: id, metadata: b });
    return row;
  }
}

