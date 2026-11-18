import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ENV } from './tokens.js';
import type { Env } from '../config/env.js';

export const RENDER_QUEUE = 'dw-render';
export const PRODUCTION_QUEUE = 'dw-production';
export const SCHEDULER_QUEUE = 'dw-scheduler';

export function redisConnection(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username || undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    tls: u.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

/** BullMQ producers. Workers live in apps/render-worker (outbound pull; no public port). */
@Injectable()
export class QueueService implements OnModuleDestroy {
  readonly render: Queue;
  readonly production: Queue;
  readonly scheduler: Queue;
  constructor(@Inject(ENV) env: Env) {
    const connection = redisConnection(env.REDIS_URL);
    const prefix = env.QUEUE_PREFIX;
    const defaults = { removeOnComplete: { count: 20, age: 3600 }, removeOnFail: { count: 50, age: 86400 } };
    this.render = new Queue(RENDER_QUEUE, { connection, prefix, defaultJobOptions: { ...defaults, attempts: 2, backoff: { type: 'exponential', delay: 10_000 } } });
    this.production = new Queue(PRODUCTION_QUEUE, { connection, prefix, defaultJobOptions: { ...defaults, attempts: 1 } });
    this.scheduler = new Queue(SCHEDULER_QUEUE, { connection, prefix, defaultJobOptions: defaults });
  }
  async onModuleDestroy() {
    await Promise.allSettled([this.render.close(), this.production.close(), this.scheduler.close()]);
  }
}
