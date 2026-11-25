import { Controller, Get, Inject, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import type { Database } from '@dentweb/database';
import { Public } from '../../common/auth-context.js';
import { DB, REDIS } from '../../infra/tokens.js';
import { MailService } from '../../infra/infra.module.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly mail: MailService,
  ) {}

  @Public()
  @Get()
  async health() {
    const check = async (fn: () => Promise<unknown>) => {
      try {
        await fn();
        return 'up';
      } catch {
        return 'down';
      }
    };
    const [db, redis] = await Promise.all([check(() => this.db.execute(sql`select 1`)), check(() => this.redis.ping())]);
    return { status: db === 'up' && redis === 'up' ? 'ok' : 'degraded', db, redis, smtp: this.mail.configured ? 'configured' : 'not_configured', version: process.env.APP_VERSION ?? '1.0.14' };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
