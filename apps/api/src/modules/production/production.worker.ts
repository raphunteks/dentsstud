import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { type Database, memberProductionSettings, memberTtsAccounts, memberVoicePreferences, notifications, ttsProviderConfigs, voiceProfiles } from '@dentweb/database';
import { DB, ENV } from '../../infra/tokens.js';
import type { Env } from '../../config/env.js';
import { SettingsService } from '../../infra/settings.service.js';
import { NotificationService } from '../../infra/notifications.service.js';
import { PRODUCTION_QUEUE, QueueService, SCHEDULER_QUEUE, redisConnection } from '../../infra/queues.js';
import { ProductionEngine } from './engine.js';
import { ProductionService, type OrderInput } from './production.service.js';

type Schedule = { enabled?: boolean; times?: string[]; timezone?: string; topics?: string[]; presetId?: string | null; hookMode?: 'AUTO' | 'NONE' };

/** Local wall-clock date and HH:MM in a time zone (falls back to UTC on an unknown zone). */
export function localSlot(now: Date, timeZone: string) {
  let tz = timeZone;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
  } catch {
    tz = 'UTC';
  }
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** BullMQ consumers for production runs and the minute scheduler. Enabled with PRODUCTION_WORKER / SCHEDULER_ENABLED. */
@Injectable()
export class ProductionWorker implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('ProductionWorker');
  private workers: Worker[] = [];
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Database,
    private readonly queues: QueueService,
    private readonly engine: ProductionEngine,
    private readonly svc: ProductionService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationService,
  ) {}

  async onModuleInit() {
    const connection = redisConnection(this.env.REDIS_URL);
    if (this.env.PRODUCTION_WORKER) {
      this.workers.push(
        new Worker(
          PRODUCTION_QUEUE,
          async (job) => {
            const runId = (job.data as { runId: string }).runId;
            const r = await this.engine.process(runId);
            if (r === 'delayed') await this.queues.production.add('run', { runId }, { jobId: `run-${runId}-${Date.now()}`, delay: 10_000 });
            return r;
          },
          { connection, prefix: this.env.QUEUE_PREFIX, concurrency: this.env.PRODUCTION_CONCURRENCY, lockDuration: 120_000 },
        ),
      );
    }
    if (this.env.SCHEDULER_ENABLED) {
      await this.queues.scheduler.upsertJobScheduler(
        'production-tick',
        { every: 60_000 },
        { name: 'tick', opts: { removeOnComplete: true, removeOnFail: 10 } },
      );
      this.workers.push(new Worker(SCHEDULER_QUEUE, async () => this.tick(new Date()), { connection, prefix: this.env.QUEUE_PREFIX, concurrency: 1 }));
    }
    for (const w of this.workers) w.on('failed', (job, err) => this.log.warn(`${w.name} job ${job?.id} failed: ${err.message}`));
  }

  async onModuleDestroy() {
    await Promise.allSettled(this.workers.map((w) => w.close()));
  }

  /** One scheduler tick: recover stale runs, then create orders for due schedule slots (idempotent per slot). */
  async tick(now: Date) {
    await this.svc.recoverStale();
    if (!(await this.settings.flag('scheduler', true))) return { created: 0, disabled: true };
    const rows = await this.db.select().from(memberProductionSettings);
    let created = 0;
    for (const s of rows) {
      const cfg = s.scheduleConfig as Schedule;
      if (!cfg.enabled || !cfg.times?.length || s.videosPerDay <= 0) continue;
      const { date, time } = localSlot(now, cfg.timezone ?? 'UTC');
      if (!cfg.times.includes(time)) continue;
      const slotIdx = [...cfg.times].sort().indexOf(time);
      const perSlot = Math.ceil(s.videosPerDay / cfg.times.length);
      const quantity = Math.min(perSlot, s.videosPerDay - perSlot * slotIdx);
      if (quantity <= 0) continue;
      try {
        const input = await this.inputFor(s.userId, cfg, quantity, s.defaultWorkers, s.preferredFormat as OrderInput['format']);
        const r = await this.svc.createOrder(s.userId, input, `sched-${date}-${time}`, { kind: 'SCHEDULED' });
        if (!r.duplicate) created++;
      } catch (e) {
        await this.notifications.notify(s.userId, 'schedule.skipped', { slot: `${date} ${time}`, message: (e as Error).message });
      }
    }
    return { created };
  }

  private async inputFor(userId: string, cfg: Schedule, quantity: number, workers: number, format: OrderInput['format']): Promise<OrderInput> {
    const [pref] = await this.db.select().from(memberVoicePreferences).where(eq(memberVoicePreferences.userId, userId));
    let voice: OrderInput['voice'] = { mode: 'NONE' };
    if (pref?.voiceId) {
      const [v] = await this.db.select().from(voiceProfiles).where(eq(voiceProfiles.id, pref.voiceId));
      const hasMemberAcc = v ? (await this.db.select().from(memberTtsAccounts).where(eq(memberTtsAccounts.userId, userId))).some((a) => a.provider === v.provider) : false;
      const isGlobalCadangan = v?.provider === 'cadangan' && !!(await this.db.select({ e: ttsProviderConfigs.isEnabled }).from(ttsProviderConfigs).where(eq(ttsProviderConfigs.provider, 'cadangan')))[0]?.e;
      if (v?.status === 'PUBLISHED' && (hasMemberAcc || isGlobalCadangan)) {
        voice = { mode: 'TTS', voiceId: v.id, emotion: pref.emotion, speed: Number(pref.speed), pitch: pref.pitch == null ? null : Number(pref.pitch), instructions: pref.instructions };
      }
    }
    const all = cfg.topics ?? [];
    const offset = all.length ? Math.floor(Date.now() / 86_400_000) % all.length : 0;
    const topics = [...all.slice(offset), ...all.slice(0, offset)];
    return {
      quantity, workers, format, topicMode: topics.length ? 'UMUM' : 'BEBAS', topic: '', topics, voice,
      presetId: cfg.presetId ?? null, referenceAssetIds: [], hook: { mode: cfg.hookMode ?? 'AUTO' }, notes: 'Produksi otomatis terjadwal', start: true,
    };
  }
}
