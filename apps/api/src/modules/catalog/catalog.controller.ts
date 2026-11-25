import { Controller, Get, HttpCode, Inject, Module, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import { type Database, styleCategories, visualPresets, voiceProfiles, hookPresets, productionRuns, videoResults } from '@dentweb/database';
import type { SessionUser } from '@dentweb/shared-types';
import { CurrentUser, Public } from '../../common/auth-context.js';
import { DB } from '../../infra/tokens.js';
import { NotificationService } from '../../infra/notifications.service.js';
import { AiConnectionsModule } from '../ai-connections/ai-connections.module.js';
import { AiConnectionsService } from '../ai-connections/ai-connections.service.js';
import { LicensesModule } from '../licenses/licenses.module.js';
import { LicenseService } from '../licenses/license.service.js';

/** Counts are always computed from PUBLISHED rows of ACTIVE categories — never hardcoded. */
@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly ai: AiConnectionsService,
    private readonly licenses: LicenseService,
    private readonly notifications: NotificationService,
  ) {}

  @Public()
  @Get('styles/categories')
  async categories() {
    const rows = await this.db
      .select({
        id: styleCategories.id,
        slug: styleCategories.slug,
        name: styleCategories.name,
        description: styleCategories.description,
        sortOrder: styleCategories.sortOrder,
        presetCount: sql<number>`count(${visualPresets.id}) filter (where ${visualPresets.status} = 'PUBLISHED')`.mapWith(Number),
      })
      .from(styleCategories)
      .leftJoin(visualPresets, eq(visualPresets.categoryId, styleCategories.id))
      .where(eq(styleCategories.isActive, true))
      .groupBy(styleCategories.id)
      .orderBy(asc(styleCategories.sortOrder), asc(styleCategories.name));
    return { categories: rows, total: rows.reduce((a, r) => a + r.presetCount, 0) };
  }

  /** Member home: statistics from the member's own data only. */
  @Get('me/dashboard')
  async dashboard(@CurrentUser() user: SessionUser) {
    const [results, runs, [inProdCount], [presets], [voices], [hooks], ai, license] = await Promise.all([
      this.db.select({ status: videoResults.status, n: count() }).from(videoResults).where(and(eq(videoResults.userId, user.id), sql`${videoResults.deletedAt} is null`)).groupBy(videoResults.status),
      this.db
        .select({ id: productionRuns.id, status: productionRuns.status, currentStage: productionRuns.currentStage, progress: productionRuns.progress, startedAt: productionRuns.startedAt, topic: productionRuns.topic })
        .from(productionRuns)
        .where(and(eq(productionRuns.userId, user.id), sql`${productionRuns.status} in ('QUEUED','RUNNING','CANCELLING')`))
        .limit(10),
      this.db
        .select({ n: count() })
        .from(productionRuns)
        .where(and(eq(productionRuns.userId, user.id), sql`${productionRuns.status} in ('QUEUED','RUNNING','CANCELLING')`)),
      this.db.select({ n: count() }).from(visualPresets).where(eq(visualPresets.status, 'PUBLISHED')),
      this.db.select({ n: count() }).from(voiceProfiles).where(eq(voiceProfiles.status, 'PUBLISHED')),
      this.db.select({ n: count() }).from(hookPresets).where(eq(hookPresets.status, 'PUBLISHED')),
      this.ai.status(user.id),
      this.licenses.summary(user.id),
    ]);
    const by = Object.fromEntries(results.map((r) => [r.status, r.n])) as Record<string, number>;
    const failedRuns = (await this.db.select({ n: count() }).from(productionRuns).where(and(eq(productionRuns.userId, user.id), eq(productionRuns.status, 'FAILED'))))[0]!.n;
    return {
      stats: { readyToUpload: by.READY ?? 0, inProduction: inProdCount!.n, uploaded: by.UPLOADED ?? 0, failed: (by.FAILED ?? 0) + failedRuns },
      activeRuns: runs,
      catalog: { publishedPresets: presets!.n, publishedVoices: voices!.n, publishedHooks: hooks!.n },
      ai: { status: ai.status, method: ai.connection?.method ?? null },
      license: { status: license.status, activeDevices: license.activeDevices, entitlements: license.entitlements },
    };
  }

  @Get('notifications')
  async listNotifications(@CurrentUser() user: SessionUser) {
    return this.notifications.list(user.id, 50);
  }

  @Get('notifications/stream')
  streamNotifications(@CurrentUser() user: SessionUser, @Req() req: Request, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(': connected\n\n');

    const unsubscribe = this.notifications.subscribe(user.id, (n) => {
      res.write(`event: notification\ndata: ${JSON.stringify(n)}\n\n`);
    });
    const ping = setInterval(() => {
      res.write(': ping\n\n');
    }, 25_000);

    req.on('close', () => {
      clearInterval(ping);
      unsubscribe();
      res.end();
    });
  }

  @HttpCode(200)
  @Post('notifications/:id/read')
  async readNotification(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(user.id, id);
  }

  @HttpCode(200)
  @Post('notifications/read-all')
  async readAllNotifications(@CurrentUser() user: SessionUser) {
    return this.notifications.markAllRead(user.id);
  }
}

@Module({ imports: [AiConnectionsModule, LicensesModule], controllers: [CatalogController] })
export class CatalogModule {}
