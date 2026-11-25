import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { type Database, notifications } from '@dentweb/database';
import { DB, ENV, REDIS } from './tokens.js';
import type { Env } from '../config/env.js';

export interface FormattedNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
  actionTab: string | null;
  targetId: string | null;
}

const CHANNEL = 'dw:notifications';

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export function formatNotification(row: {
  id: string;
  type: string;
  payload: unknown;
  readAt: Date | string | null;
  createdAt: Date | string;
}): FormattedNotification {
  const payload = (row.payload && typeof row.payload === 'object' ? row.payload : {}) as Record<string, unknown>;
  let title = '';
  let body = '';
  let actionTab: string | null = null;
  let targetId: string | null = null;

  switch (row.type) {
    case 'production.completed': {
      title = 'Video selesai diproduksi';
      body = str(payload.topic)
        ? `Video "${str(payload.topic)}" siap ditinjau dan diunggah.`
        : 'Video hasil produksi Anda siap ditinjau dan diunggah.';
      actionTab = 'hasil';
      targetId = str(payload.resultId) || str(payload.runId) || null;
      break;
    }
    case 'production.failed': {
      title = 'Produksi video gagal';
      body = str(payload.message) || 'Terjadi kendala saat produksi video. Periksa log untuk detail.';
      actionTab = 'progress';
      targetId = str(payload.runId) || null;
      break;
    }
    case 'schedule.skipped': {
      const slot = str(payload.slot);
      const msg = str(payload.message);
      title = 'Jadwal produksi dilewati';
      body = slot ? `Slot ${slot}: ${msg || 'tidak dapat dijalankan.'}` : msg || 'Slot jadwal otomatis dilewati.';
      actionTab = 'pengaturan';
      break;
    }
    case 'support.reply': {
      const subject = str(payload.subject);
      title = 'Balasan tiket bantuan';
      body = subject ? `Tim DENTSWEB membalas tiket "${subject}".` : 'Tim DENTSWEB membalas tiket bantuan Anda.';
      actionTab = 'bantuan';
      targetId = str(payload.ticketId) || null;
      break;
    }
    case 'license.granted': {
      const maxDevices = typeof payload.maxDevices === 'number' ? payload.maxDevices : null;
      title = 'Lisensi aktif diberikan';
      body = maxDevices ? `Lisensi Anda aktif (maks. ${maxDevices} perangkat).` : 'Lisensi DENTSWEB STUDIO Anda kini aktif.';
      actionTab = 'pengaturan';
      targetId = str(payload.licenseId) || null;
      break;
    }
    case 'license.revoked': {
      title = 'Lisensi dicabut';
      body = 'Lisensi Anda telah dicabut oleh Superadmin. Hubungi admin untuk informasi lebih lanjut.';
      actionTab = 'pengaturan';
      targetId = str(payload.licenseId) || null;
      break;
    }
    case 'member.status_changed': {
      const status = str(payload.status) || 'UPDATED';
      const reason = str(payload.reason);
      title = 'Status akun diperbarui';
      body = `Status akun Anda diubah menjadi ${status}${reason ? `: ${reason}` : ''}.`;
      actionTab = 'pengaturan';
      break;
    }
    case 'ai.provider_switched': {
      const from = str(payload.fromProvider) || 'AI sebelumnya';
      const to = str(payload.toProvider) || 'AI cadangan';
      const reason = str(payload.reason);
      title = 'AI Provider otomatis beralih';
      body = `Beralih dari ${from} ke ${to}${reason ? ` (${reason})` : ''}.`;
      actionTab = 'pengaturan';
      break;
    }
    default: {
      title = str(payload.title) || row.type.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      body = str(payload.body) || str(payload.message) || 'Pemberitahuan baru dari DENTSWEB STUDIO.';
      actionTab = str(payload.actionTab) || null;
      targetId = str(payload.targetId) || null;
      break;
    }
  }

  return {
    id: row.id,
    type: row.type,
    title,
    body,
    payload,
    readAt: row.readAt ? new Date(row.readAt).toISOString() : null,
    createdAt: new Date(row.createdAt).toISOString(),
    actionTab,
    targetId,
  };
}

@Injectable()
export class NotificationService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Notifications');
  private readonly bus = new EventEmitter();
  private sub: Redis | null = null;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(ENV) private readonly env: Env,
  ) {
    this.bus.setMaxListeners(500);
  }

  async onModuleInit() {
    if (this.env.NODE_ENV === 'test') return;
    try {
      this.sub = this.redis.duplicate({ maxRetriesPerRequest: null, lazyConnect: true });
      this.sub.on('error', (err) => this.log.debug(`Redis sub error: ${err.message}`));
      this.sub.on('message', (_channel, raw) => {
        try {
          const parsed = JSON.parse(raw) as { userId: string; notification: FormattedNotification };
          if (parsed?.userId && parsed?.notification) {
            this.bus.emit(`user:${parsed.userId}`, parsed.notification);
          }
        } catch {
          // ignore malformed pub/sub message
        }
      });
      await this.sub.subscribe(CHANNEL);
    } catch (err) {
      this.log.warn(`Redis notification subscriber unavailable, using local bus: ${(err as Error).message}`);
      this.sub = null;
    }
  }

  async onModuleDestroy() {
    if (this.sub) {
      await this.sub.quit().catch(() => undefined);
      this.sub = null;
    }
  }

  async notify(userId: string, type: string, payload: Record<string, unknown> = {}): Promise<FormattedNotification> {
    const [row] = await this.db
      .insert(notifications)
      .values({ userId, type, payload })
      .returning();
    const formatted = formatNotification(row!);
    const published = await this.publish(userId, formatted);
    if (!published) {
      this.bus.emit(`user:${userId}`, formatted);
    }
    return formatted;
  }

  private async publish(userId: string, notification: FormattedNotification): Promise<boolean> {
    if (!this.sub || this.env.NODE_ENV === 'test') return false;
    try {
      await this.redis.publish(CHANNEL, JSON.stringify({ userId, notification }));
      return true;
    } catch {
      return false;
    }
  }

  async list(userId: string, limit = 50): Promise<FormattedNotification[]> {
    const rows = await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
    return rows.map(formatNotification);
  }

  async markRead(userId: string, id: string) {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId), isNull(notifications.readAt)));
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return { ok: true };
  }

  subscribe(userId: string, handler: (n: FormattedNotification) => void): () => void {
    const evt = `user:${userId}`;
    this.bus.on(evt, handler);
    return () => {
      this.bus.off(evt, handler);
    };
  }
}
