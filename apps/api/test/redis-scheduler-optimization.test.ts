import { describe, expect, it, vi } from 'vitest';
import { QueueService } from '../src/infra/queues.js';
import { ProductionWorker } from '../src/modules/production/production.worker.js';
import type { Env } from '../src/config/env.js';

describe('Upstash Redis & Scheduler Optimization', () => {
  const fakeEnv = {
    REDIS_URL: 'redis://127.0.0.1:6379',
    QUEUE_PREFIX: 'dentweb-test',
    PRODUCTION_WORKER: true,
    PRODUCTION_CONCURRENCY: 2,
    SCHEDULER_ENABLED: true,
  } as Env;

  describe('QueueService default job options', () => {
    it('configures conservative removeOnComplete and removeOnFail defaults to protect Upstash free tier', async () => {
      const qs = new QueueService(fakeEnv);
      try {
        expect(qs.render.defaultJobOptions?.removeOnComplete).toEqual({ count: 20, age: 3600 });
        expect(qs.render.defaultJobOptions?.removeOnFail).toEqual({ count: 50, age: 86400 });

        expect(qs.production.defaultJobOptions?.removeOnComplete).toEqual({ count: 20, age: 3600 });
        expect(qs.production.defaultJobOptions?.removeOnFail).toEqual({ count: 50, age: 86400 });

        expect(qs.scheduler.defaultJobOptions?.removeOnComplete).toEqual({ count: 20, age: 3600 });
        expect(qs.scheduler.defaultJobOptions?.removeOnFail).toEqual({ count: 50, age: 86400 });
      } finally {
        await qs.onModuleDestroy();
      }
    });
  });

  describe('ProductionWorker scheduler options', () => {
    it('configures repeat job template with removeOnComplete: true and removeOnFail: 10', async () => {
      const upsertJobSchedulerSpy = vi.fn().mockResolvedValue(undefined);
      const fakeQueueService = {
        scheduler: {
          upsertJobScheduler: upsertJobSchedulerSpy,
        },
        production: {
          add: vi.fn(),
        },
      } as unknown as QueueService;

      const fakeDb = {} as any;
      const fakeEngine = {} as any;
      const fakeSvc = {} as any;

      const worker = new ProductionWorker(
        fakeEnv,
        fakeDb,
        fakeQueueService,
        fakeEngine,
        fakeSvc,
      );

      await worker.onModuleInit();
      try {
        expect(upsertJobSchedulerSpy).toHaveBeenCalledWith(
          'production-tick',
          { every: 60_000 },
          { name: 'tick', opts: { removeOnComplete: true, removeOnFail: 10 } },
        );
      } finally {
        await worker.onModuleDestroy();
      }
    });
  });

  describe('cleanupSchedulerKeys stale key detection logic', () => {
    it('filters stale repeatable job keys and preserves the active next delayed job', () => {
      const keys = [
        'dentweb:dw-scheduler:repeat:production-tick:1700000000000',
        'dentweb:dw-scheduler:repeat:production-tick:1700000060000',
        'dentweb:dw-scheduler:repeat:production-tick:1700000120000',
      ];
      const nextMillis = '1700000120000';
      const keptKey = `dentweb:dw-scheduler:repeat:production-tick:${nextMillis}`;
      const staleKeys = keys.filter((k) => k !== keptKey);

      expect(keys.length).toBe(3);
      expect(staleKeys.length).toBe(2);
      expect(keptKey).toBe('dentweb:dw-scheduler:repeat:production-tick:1700000120000');
      expect(staleKeys).toEqual([
        'dentweb:dw-scheduler:repeat:production-tick:1700000000000',
        'dentweb:dw-scheduler:repeat:production-tick:1700000060000',
      ]);
    });
  });
});
