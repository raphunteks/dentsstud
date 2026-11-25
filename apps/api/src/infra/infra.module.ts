import { Global, Inject, Injectable, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { createDatabase, type Database, auditLogs } from '@dentweb/database';
import nodemailer, { type Transporter } from 'nodemailer';
import { Redis } from 'ioredis';
import { loadEnv, type Env } from '../config/env.js';
import { Cipher } from './crypto.js';
import { SettingsService } from './settings.service.js';
import { StorageService } from './storage.js';
import { QueueService } from './queues.js';
import { ErrorReportsService, MetricsRegistry } from './observability.js';
import { NotificationService } from './notifications.service.js';
import { DB, ENV, MAIL_TRANSPORT, REDIS } from './tokens.js';

@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Database) {}
  async log(entry: { actorId: string | null; action: string; targetType: string; targetId?: string | null; metadata?: Record<string, unknown>; ip?: string }) {
    await this.db.insert(auditLogs).values({
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      metadata: entry.metadata ?? {},
      ipAddress: entry.ip?.slice(0, 64) ?? null,
    });
  }
}

export interface SentMail {
  to: string;
  subject: string;
  text: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');
  /** Outbox only populated when NODE_ENV=test (assertions in e2e tests). */
  readonly testOutbox: SentMail[] = [];
  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: Transporter | null,
    @Inject(ENV) private readonly env: Env,
  ) {}

  get configured() {
    return this.transport !== null;
  }

  async send(mail: SentMail & { html?: string }) {
    if (this.env.NODE_ENV === 'test') {
      this.testOutbox.push(mail);
      return;
    }
    if (!this.transport) {
      // Development only: env validation forbids this in production.
      this.logger.warn(`SMTP belum dikonfigurasi. [DEV] Email ke ${mail.to}: ${mail.subject} — ${mail.text}`);
      return;
    }
    await this.transport.sendMail({ from: this.env.MAIL_FROM, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
  }
}

@Injectable()
class ShutdownHooks implements OnApplicationShutdown {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}
  async onApplicationShutdown() {
    await Promise.allSettled([this.db.$client.end(), this.redis.quit()]);
  }
}

@Global()
@Module({
  providers: [
    { provide: ENV, useFactory: () => loadEnv() },
    { provide: DB, inject: [ENV], useFactory: (env: Env) => createDatabase(env.DATABASE_URL) },
    {
      provide: REDIS,
      inject: [ENV],
      useFactory: (env: Env) => new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true, enableOfflineQueue: true }),
    },
    { provide: Cipher, inject: [ENV], useFactory: (env: Env) => new Cipher(env.SECRETS_MASTER_KEY) },
    {
      provide: MAIL_TRANSPORT,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS
          ? nodemailer.createTransport({
              host: env.SMTP_HOST,
              port: env.SMTP_PORT,
              secure: env.SMTP_SECURE,
              auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
            })
          : null,
    },
    MailService,
    AuditService,
    SettingsService,
    StorageService,
    QueueService,
    ErrorReportsService,
    MetricsRegistry,
    NotificationService,
    ShutdownHooks,
  ],
  exports: [ENV, DB, REDIS, Cipher, MailService, AuditService, SettingsService, StorageService, QueueService, ErrorReportsService, MetricsRegistry, NotificationService],
})
export class InfraModule {}
