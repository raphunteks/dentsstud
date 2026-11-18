/**
 * Cleanup script to remove stale repeatable job hashes from Redis.
 * BullMQ repeatable schedulers can leave behind completed job hashes without TTL,
 * which accumulates over time and exhausts Upstash Redis limits.
 *
 * Usage:
 *   pnpm --filter @dentweb/api cleanup:scheduler
 *   pnpm cleanup:scheduler
 *   node --env-file-if-exists=../../.env dist/scripts/cleanup-scheduler-keys.js [--dry-run] [--all]
 */
import { Redis } from 'ioredis';
import { redisConnection, SCHEDULER_QUEUE } from '../src/infra/queues.js';

export interface CleanupSchedulerOptions {
  redisUrl?: string;
  queuePrefix?: string;
  jobSchedulerId?: string;
  dryRun?: boolean;
  keepNextDelayed?: boolean;
  batchSize?: number;
}

export interface CleanupResult {
  totalFound: number;
  staleCount: number;
  deletedCount: number;
  keptKey: string | null;
  dryRun: boolean;
}

export async function cleanupSchedulerKeys(options: CleanupSchedulerOptions = {}): Promise<CleanupResult> {
  const redisUrl = options.redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
  const prefix = options.queuePrefix ?? process.env.QUEUE_PREFIX ?? 'dentweb';
  const jobSchedulerId = options.jobSchedulerId ?? 'production-tick';
  const dryRun = options.dryRun ?? false;
  const keepNextDelayed = options.keepNextDelayed ?? true;
  const batchSize = options.batchSize ?? 100;

  const connOpts = redisConnection(redisUrl);
  const redis = new Redis(connOpts);

  try {
    const queueName = SCHEDULER_QUEUE;
    const keyPattern = `${prefix}:${queueName}:repeat:${jobSchedulerId}:*`;
    const repeatZset = `${prefix}:${queueName}:repeat`;
    const completedZset = `${prefix}:${queueName}:completed`;
    const failedZset = `${prefix}:${queueName}:failed`;

    // Check currently scheduled next iteration timestamp from BullMQ repeat zset
    let keptKey: string | null = null;
    if (keepNextDelayed) {
      const nextMillis = await redis.zscore(repeatZset, jobSchedulerId);
      if (nextMillis) {
        keptKey = `${prefix}:${queueName}:repeat:${jobSchedulerId}:${nextMillis}`;
      }
    }

    // Scan Redis for keys matching pattern without blocking
    let cursor = '0';
    const matchingKeys: string[] = [];
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', keyPattern, 'COUNT', batchSize);
      cursor = nextCursor;
      if (keys.length > 0) {
        matchingKeys.push(...keys);
      }
    } while (cursor !== '0');

    // Filter stale keys (excluding the active scheduled job if keepNextDelayed is set)
    const staleKeys = keptKey ? matchingKeys.filter((k) => k !== keptKey) : matchingKeys;

    let deletedCount = 0;
    if (!dryRun && staleKeys.length > 0) {
      const keyPrefixToRemove = `${prefix}:${queueName}:`;
      const chunk = 500;
      for (let i = 0; i < staleKeys.length; i += chunk) {
        const slice = staleKeys.slice(i, i + chunk);
        const jobIds = slice.map((k) => k.slice(keyPrefixToRemove.length));

        const pipeline = redis.pipeline();
        for (const k of slice) {
          pipeline.unlink(k);
        }
        if (jobIds.length > 0) {
          pipeline.zrem(completedZset, ...jobIds);
          pipeline.zrem(failedZset, ...jobIds);
        }
        const results = await pipeline.exec();
        if (results) {
          for (const [err] of results) {
            if (err) {
              throw err;
            }
          }
        }
        deletedCount += slice.length;
      }
    }

    return {
      totalFound: matchingKeys.length,
      staleCount: staleKeys.length,
      deletedCount,
      keptKey,
      dryRun,
    };
  } finally {
    await redis.quit();
  }
}

// Direct execution CLI
const isDirectRun =
  import.meta.url === `file://${process.argv[1]}` ||
  (process.argv[1] && (process.argv[1].endsWith('cleanup-scheduler-keys.js') || process.argv[1].endsWith('cleanup-scheduler-keys.ts')));

if (isDirectRun) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const all = args.includes('--all');

  console.log(`[cleanup-scheduler] Starting cleanup (dryRun: ${dryRun}, keepNextDelayed: ${!all})...`);
  cleanupSchedulerKeys({ dryRun, keepNextDelayed: !all })
    .then((res) => {
      console.log(`[cleanup-scheduler] Done:
  - Total keys matching pattern: ${res.totalFound}
  - Kept active key: ${res.keptKey ?? 'none'}
  - Stale keys found: ${res.staleCount}
  - Keys deleted: ${res.dryRun ? '0 (dry-run)' : res.deletedCount}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[cleanup-scheduler] Failed:', err);
      process.exit(1);
    });
}
