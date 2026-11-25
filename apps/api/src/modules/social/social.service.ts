import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { type Database, secretVault, systemSettings, videoResults } from '@dentweb/database';
import { DB, ENV } from '../../infra/tokens.js';
import type { Env } from '../../config/env.js';
import { Cipher, redact } from '../../infra/crypto.js';
import { AuditService } from '../../infra/infra.module.js';
import { NotificationService } from '../../infra/notifications.service.js';
import { SettingsService } from '../../infra/settings.service.js';
import { Errors } from '../../infra/errors.js';
import {
  composeCaption,
  getPlatformSpec,
  publishToPlatform,
  SOCIAL_PLATFORM_CODES,
  SOCIAL_PLATFORMS,
  type SocialPlatformCode,
  validatePostForPlatform,
} from './social-platforms.js';

export type SocialPostStatus = 'IDEA' | 'DRAFT' | 'SCHEDULED' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED';

export interface SocialAccountDto {
  id: string;
  userId: string;
  platform: SocialPlatformCode;
  handle: string;
  displayName: string;
  externalId: string | null;
  instanceUrl: string | null;
  boardId: string | null;
  status: string;
  lastError: string | null;
  connectedAt: string;
  updatedAt: string;
}

export interface SocialPostDto {
  id: string;
  userId: string;
  accountId: string | null;
  accountHandle?: string | null;
  resultId: string | null;
  platform: SocialPlatformCode;
  status: SocialPostStatus;
  title: string | null;
  caption: string;
  hashtags: string[];
  firstComment: string | null;
  mediaUrl: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  externalPostId: string | null;
  externalUrl: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformAdminConfig {
  enabled: boolean;
  clientId: string;
  clientSecretRef?: string | null;
  hasClientSecret?: boolean;
  redirectUri: string;
  dailyLimitPerMember: number;
}

export interface SocialAdminConfig {
  autoPublishEnabled: boolean;
  platforms: Record<SocialPlatformCode, PlatformAdminConfig>;
}

const CONFIG_KEY = 'social.publisher.config';

function defaultPlatformConfig(code: SocialPlatformCode, publicUrl: string): PlatformAdminConfig {
  return {
    enabled: true,
    clientId: '',
    clientSecretRef: null,
    hasClientSecret: false,
    redirectUri: `${publicUrl.replace(/\/+$/, '')}/api/v1/social/oauth/${code}/callback`,
    dailyLimitPerMember: 10,
  };
}

function mapAccount(r: Record<string, unknown>): SocialAccountDto {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    platform: String(r.platform) as SocialPlatformCode,
    handle: String(r.handle),
    displayName: String(r.display_name ?? ''),
    externalId: r.external_id ? String(r.external_id) : null,
    instanceUrl: r.instance_url ? String(r.instance_url) : null,
    boardId: r.board_id ? String(r.board_id) : null,
    status: String(r.status ?? 'CONNECTED'),
    lastError: r.last_error ? String(r.last_error) : null,
    connectedAt: new Date(String(r.connected_at)).toISOString(),
    updatedAt: new Date(String(r.updated_at)).toISOString(),
  };
}

function mapPost(r: Record<string, unknown>): SocialPostDto {
  const rawTags = r.hashtags;
  const hashtags = Array.isArray(rawTags) ? rawTags.map(String) : [];
  return {
    id: String(r.id),
    userId: String(r.user_id),
    accountId: r.account_id ? String(r.account_id) : null,
    accountHandle: r.account_handle ? String(r.account_handle) : null,
    resultId: r.result_id ? String(r.result_id) : null,
    platform: String(r.platform) as SocialPlatformCode,
    status: String(r.status) as SocialPostStatus,
    title: r.title ? String(r.title) : null,
    caption: String(r.caption ?? ''),
    hashtags,
    firstComment: r.first_comment ? String(r.first_comment) : null,
    mediaUrl: r.media_url ? String(r.media_url) : null,
    scheduledAt: r.scheduled_at ? new Date(String(r.scheduled_at)).toISOString() : null,
    publishedAt: r.published_at ? new Date(String(r.published_at)).toISOString() : null,
    externalPostId: r.external_post_id ? String(r.external_post_id) : null,
    externalUrl: r.external_url ? String(r.external_url) : null,
    lastError: r.last_error ? String(r.last_error) : null,
    createdAt: new Date(String(r.created_at)).toISOString(),
    updatedAt: new Date(String(r.updated_at)).toISOString(),
  };
}

@Injectable()
export class SocialService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Social');
  private timer: NodeJS.Timeout | null = null;
  private tickBusy = false;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly cipher: Cipher,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() {
    if (this.env.NODE_ENV === 'test') return;
    try {
      await this.ensureSchema();
      this.timer = setInterval(() => {
        void this.processDueScheduledPosts();
      }, 30_000);
      this.timer.unref();
    } catch (err) {
      this.log.warn(`Social module init warning: ${(err as Error).message}`);
    }
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async ensureSchema() {
    await this.db.$client.query(`
      CREATE TABLE IF NOT EXISTS social_accounts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        platform text NOT NULL,
        handle text NOT NULL,
        display_name text NOT NULL DEFAULT '',
        external_id text,
        instance_url text,
        board_id text,
        secret_ref uuid,
        status text NOT NULL DEFAULT 'CONNECTED',
        last_error text,
        connected_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_social_accounts_user ON social_accounts(user_id);

      CREATE TABLE IF NOT EXISTS social_posts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_id uuid REFERENCES social_accounts(id) ON DELETE SET NULL,
        result_id uuid,
        platform text NOT NULL,
        status text NOT NULL DEFAULT 'DRAFT',
        title text,
        caption text NOT NULL DEFAULT '',
        hashtags jsonb NOT NULL DEFAULT '[]'::jsonb,
        first_comment text,
        media_url text,
        scheduled_at timestamptz,
        published_at timestamptz,
        external_post_id text,
        external_url text,
        last_error text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_social_posts_user ON social_posts(user_id);
      CREATE INDEX IF NOT EXISTS idx_social_posts_sched ON social_posts(status, scheduled_at);
    `);
  }

  private async storeSecret(ownerId: string, purpose: string, plain: string, existingRef?: string | null): Promise<string> {
    const ciphertext = this.cipher.encrypt(plain, `${purpose}:${ownerId}`);
    if (existingRef) {
      await this.db.update(secretVault).set({ ciphertext }).where(and(eq(secretVault.id, existingRef), eq(secretVault.ownerId, ownerId)));
      return existingRef;
    }
    const [s] = await this.db.insert(secretVault).values({ ownerId, purpose, ciphertext }).returning({ id: secretVault.id });
    return s!.id;
  }

  private async readSecret(ownerId: string, ref: string, purpose: string): Promise<string> {
    const [s] = await this.db.select().from(secretVault).where(and(eq(secretVault.id, ref), eq(secretVault.ownerId, ownerId)));
    if (!s) throw Errors.notFound('Kredensial sosial');
    return this.cipher.decrypt(s.ciphertext, `${purpose}:${ownerId}`);
  }

  async getAdminConfig(): Promise<SocialAdminConfig> {
    const stored = await this.settings.raw<Partial<SocialAdminConfig> | null>(CONFIG_KEY, null);
    const platforms = {} as Record<SocialPlatformCode, PlatformAdminConfig>;
    for (const code of SOCIAL_PLATFORM_CODES) {
      const def = defaultPlatformConfig(code, this.env.WEB_ORIGIN);
      const cur = stored?.platforms?.[code];
      platforms[code] = {
        enabled: cur?.enabled ?? def.enabled,
        clientId: cur?.clientId ?? def.clientId,
        hasClientSecret: Boolean(cur?.clientSecretRef),
        redirectUri: cur?.redirectUri || def.redirectUri,
        dailyLimitPerMember: typeof cur?.dailyLimitPerMember === 'number' ? cur.dailyLimitPerMember : def.dailyLimitPerMember,
      };
    }
    return {
      autoPublishEnabled: stored?.autoPublishEnabled ?? true,
      platforms,
    };
  }

  async patchAdminConfig(
    actorId: string,
    patch: {
      autoPublishEnabled?: boolean;
      platforms?: Partial<
        Record<
          SocialPlatformCode,
          { enabled?: boolean; clientId?: string; clientSecret?: string; redirectUri?: string; dailyLimitPerMember?: number }
        >
      >;
    },
  ): Promise<SocialAdminConfig> {
    const stored = await this.settings.raw<Partial<SocialAdminConfig> | null>(CONFIG_KEY, null);
    const nextPlatforms = {} as Record<SocialPlatformCode, PlatformAdminConfig>;
    for (const code of SOCIAL_PLATFORM_CODES) {
      const def = defaultPlatformConfig(code, this.env.WEB_ORIGIN);
      const cur = stored?.platforms?.[code];
      const upd = patch.platforms?.[code];
      let clientSecretRef = cur?.clientSecretRef ?? null;
      if (upd?.clientSecret && upd.clientSecret.trim()) {
        clientSecretRef = await this.storeSecret(actorId, `social:oauth:${code}`, upd.clientSecret.trim(), clientSecretRef);
      }
      nextPlatforms[code] = {
        enabled: upd?.enabled ?? cur?.enabled ?? def.enabled,
        clientId: upd?.clientId !== undefined ? upd.clientId.trim() : (cur?.clientId ?? def.clientId),
        clientSecretRef,
        redirectUri: upd?.redirectUri !== undefined ? upd.redirectUri.trim() : (cur?.redirectUri || def.redirectUri),
        dailyLimitPerMember:
          upd?.dailyLimitPerMember !== undefined
            ? Math.max(1, Math.min(200, Math.round(upd.dailyLimitPerMember)))
            : (cur?.dailyLimitPerMember ?? def.dailyLimitPerMember),
      };
    }
    const next: SocialAdminConfig = {
      autoPublishEnabled: patch.autoPublishEnabled ?? stored?.autoPublishEnabled ?? true,
      platforms: nextPlatforms,
    };
    await this.db
      .insert(systemSettings)
      .values({ key: CONFIG_KEY, value: next, updatedBy: actorId, updatedAt: new Date() })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value: next, updatedBy: actorId, updatedAt: new Date() } });
    this.settings.invalidate(CONFIG_KEY);
    await this.audit.log({ actorId, action: 'admin.social.config_updated', targetType: 'system_setting', targetId: CONFIG_KEY });
    return this.getAdminConfig();
  }

  async listPlatforms() {
    const cfg = await this.getAdminConfig();
    return {
      autoPublishEnabled: cfg.autoPublishEnabled,
      items: SOCIAL_PLATFORM_CODES.map((code) => ({
        ...SOCIAL_PLATFORMS[code],
        enabled: cfg.platforms[code].enabled,
        dailyLimitPerMember: cfg.platforms[code].dailyLimitPerMember,
        oauthConfigured: Boolean(cfg.platforms[code].clientId && cfg.platforms[code].hasClientSecret),
      })),
    };
  }

  async listAccounts(userId: string) {
    const { rows } = await this.db.$client.query(
      `SELECT * FROM social_accounts WHERE user_id = $1 ORDER BY connected_at DESC`,
      [userId],
    );
    return { items: rows.map((r) => mapAccount(r as Record<string, unknown>)) };
  }

  async connectAccount(
    userId: string,
    input: {
      platform: SocialPlatformCode;
      handle: string;
      displayName?: string;
      accessToken: string;
      externalId?: string;
      instanceUrl?: string;
      boardId?: string;
    },
  ) {
    const spec = getPlatformSpec(input.platform);
    if (!spec) throw Errors.invalid('SOCIAL_INVALID', 'Platform tidak dikenal.');
    const cfg = await this.getAdminConfig();
    if (!cfg.platforms[input.platform].enabled) {
      throw Errors.invalid('SOCIAL_INVALID', `Platform ${spec.name} sedang dinonaktifkan oleh Superadmin.`);
    }
    const handle = input.handle.trim().replace(/^@/, '');
    if (!handle) throw Errors.invalid('SOCIAL_INVALID', 'Handle atau nama akun wajib diisi.');
    const token = input.accessToken.trim();
    if (!token) throw Errors.invalid('SOCIAL_INVALID', 'Token / App Password wajib diisi.');

    const secretRef = await this.storeSecret(userId, `social:account:${input.platform}`, token);
    const { rows } = await this.db.$client.query(
      `INSERT INTO social_accounts (user_id, platform, handle, display_name, external_id, instance_url, board_id, secret_ref, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'CONNECTED')
       RETURNING *`,
      [
        userId,
        input.platform,
        handle,
        input.displayName?.trim() || `@${handle}`,
        input.externalId?.trim() || null,
        input.instanceUrl?.trim() || null,
        input.boardId?.trim() || null,
        secretRef,
      ],
    );
    await this.audit.log({ actorId: userId, action: 'social.account.connected', targetType: 'social_account', targetId: String(rows[0]?.id ?? ''), metadata: { platform: input.platform, handle } });
    return { account: mapAccount(rows[0] as Record<string, unknown>) };
  }

  async disconnectAccount(userId: string, accountId: string) {
    const { rows } = await this.db.$client.query(
      `DELETE FROM social_accounts WHERE id = $1 AND user_id = $2 RETURNING id, secret_ref, platform`,
      [accountId, userId],
    );
    if (!rows.length) throw Errors.notFound('Akun sosial');
    const secretRef = rows[0]?.secret_ref ? String(rows[0].secret_ref) : null;
    if (secretRef) {
      await this.db.delete(secretVault).where(and(eq(secretVault.id, secretRef), eq(secretVault.ownerId, userId)));
    }
    await this.audit.log({ actorId: userId, action: 'social.account.disconnected', targetType: 'social_account', targetId: accountId });
    return { ok: true };
  }

  async listPosts(userId: string, filter?: { status?: string; platform?: string }) {
    const conds = ['p.user_id = $1'];
    const params: unknown[] = [userId];
    if (filter?.status) {
      params.push(filter.status);
      conds.push(`p.status = $${params.length}`);
    }
    if (filter?.platform) {
      params.push(filter.platform);
      conds.push(`p.platform = $${params.length}`);
    }
    const { rows } = await this.db.$client.query(
      `SELECT p.*, a.handle AS account_handle
       FROM social_posts p
       LEFT JOIN social_accounts a ON a.id = p.account_id
       WHERE ${conds.join(' AND ')}
       ORDER BY COALESCE(p.scheduled_at, p.created_at) DESC
       LIMIT 200`,
      params,
    );
    return { items: rows.map((r) => mapPost(r as Record<string, unknown>)) };
  }

  async createPost(
    userId: string,
    input: {
      platform: SocialPlatformCode;
      accountId?: string | null;
      resultId?: string | null;
      status?: SocialPostStatus;
      title?: string | null;
      caption?: string;
      hashtags?: string[];
      firstComment?: string | null;
      mediaUrl?: string | null;
      scheduledAt?: string | null;
    },
  ) {
    const spec = getPlatformSpec(input.platform);
    if (!spec) throw Errors.invalid('SOCIAL_INVALID', 'Platform tidak dikenal.');
    let mediaUrl = input.mediaUrl?.trim() || null;
    if (!mediaUrl && input.resultId) {
      const [resRow] = await this.db
        .select({ id: videoResults.id })
        .from(videoResults)
        .where(and(eq(videoResults.id, input.resultId), eq(videoResults.userId, userId)));
      if (resRow?.id) {
        mediaUrl = `${this.env.WEB_ORIGIN.replace(/\/+$/, '')}/api/v1/results/${resRow.id}/download`;
      }
    }
    const status: SocialPostStatus = input.status ?? (input.scheduledAt ? 'SCHEDULED' : 'DRAFT');
    if (status === 'SCHEDULED' && !input.scheduledAt) {
      throw Errors.invalid('SOCIAL_INVALID', 'scheduledAt wajib diisi untuk status SCHEDULED.');
    }
    const caption = input.caption ?? '';
    const hashtags = Array.isArray(input.hashtags) ? input.hashtags.map((h) => h.trim()).filter(Boolean) : [];
    if (status !== 'IDEA') {
      const fullText = composeCaption(caption, hashtags);
      if (fullText.length > spec.maxChars) {
        throw Errors.invalid('SOCIAL_INVALID', `Caption + hashtag melebihi batas ${spec.name} (${fullText.length}/${spec.maxChars} karakter).`);
      }
    }
    const { rows } = await this.db.$client.query(
      `INSERT INTO social_posts (user_id, account_id, result_id, platform, status, title, caption, hashtags, first_comment, media_url, scheduled_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
       RETURNING *`,
      [
        userId,
        input.accountId || null,
        input.resultId || null,
        input.platform,
        status,
        input.title?.trim() || null,
        caption,
        JSON.stringify(hashtags),
        input.firstComment?.trim() || null,
        mediaUrl,
        input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null,
      ],
    );
    return { post: mapPost(rows[0] as Record<string, unknown>) };
  }

  async updatePost(
    userId: string,
    postId: string,
    patch: {
      accountId?: string | null;
      platform?: SocialPlatformCode;
      status?: SocialPostStatus;
      title?: string | null;
      caption?: string;
      hashtags?: string[];
      firstComment?: string | null;
      mediaUrl?: string | null;
      scheduledAt?: string | null;
    },
  ) {
    const existing = await this.db.$client.query(`SELECT * FROM social_posts WHERE id = $1 AND user_id = $2`, [postId, userId]);
    if (!existing.rows.length) throw Errors.notFound('Postingan sosial');
    const cur = mapPost(existing.rows[0] as Record<string, unknown>);
    const nextPlatform = patch.platform ?? cur.platform;
    const nextCaption = patch.caption !== undefined ? patch.caption : cur.caption;
    const nextHashtags = patch.hashtags !== undefined ? patch.hashtags : cur.hashtags;
    const nextStatus = patch.status ?? cur.status;
    if (nextStatus !== 'IDEA') {
      const spec = getPlatformSpec(nextPlatform);
      const fullText = composeCaption(nextCaption, nextHashtags);
      if (spec && fullText.length > spec.maxChars) {
        throw Errors.invalid('SOCIAL_INVALID', `Caption + hashtag melebihi batas ${spec.name} (${fullText.length}/${spec.maxChars} karakter).`);
      }
    }
    const { rows } = await this.db.$client.query(
      `UPDATE social_posts
       SET account_id = $1, platform = $2, status = $3, title = $4, caption = $5,
           hashtags = $6::jsonb, first_comment = $7, media_url = $8, scheduled_at = $9, updated_at = now()
       WHERE id = $10 AND user_id = $11
       RETURNING *`,
      [
        patch.accountId !== undefined ? patch.accountId : cur.accountId,
        nextPlatform,
        nextStatus,
        patch.title !== undefined ? patch.title : cur.title,
        nextCaption,
        JSON.stringify(nextHashtags),
        patch.firstComment !== undefined ? patch.firstComment : cur.firstComment,
        patch.mediaUrl !== undefined ? patch.mediaUrl : cur.mediaUrl,
        patch.scheduledAt !== undefined ? (patch.scheduledAt ? new Date(patch.scheduledAt).toISOString() : null) : cur.scheduledAt,
        postId,
        userId,
      ],
    );
    return { post: mapPost(rows[0] as Record<string, unknown>) };
  }

  async deletePost(userId: string, postId: string) {
    const { rowCount } = await this.db.$client.query(`DELETE FROM social_posts WHERE id = $1 AND user_id = $2`, [postId, userId]);
    if (!rowCount) throw Errors.notFound('Postingan sosial');
    return { ok: true };
  }

  async publishPost(userId: string, postId: string) {
    const cfg = await this.getAdminConfig();
    if (!cfg.autoPublishEnabled) {
      throw Errors.invalid('SOCIAL_INVALID', 'Auto-publish langsung sedang dinonaktifkan oleh Superadmin.');
    }
    const { rows } = await this.db.$client.query(`SELECT * FROM social_posts WHERE id = $1 AND user_id = $2`, [postId, userId]);
    if (!rows.length) throw Errors.notFound('Postingan sosial');
    const post = mapPost(rows[0] as Record<string, unknown>);
    const pCfg = cfg.platforms[post.platform];
    if (!pCfg?.enabled) throw Errors.invalid('SOCIAL_INVALID', `Platform ${SOCIAL_PLATFORMS[post.platform].name} sedang dinonaktifkan.`);

    // Enforce per-member daily limit
    const { rows: countRows } = await this.db.$client.query(
      `SELECT COUNT(*)::int AS c FROM social_posts WHERE user_id = $1 AND platform = $2 AND status = 'PUBLISHED' AND published_at >= date_trunc('day', now())`,
      [userId, post.platform],
    );
    const todayCount = Number((countRows[0] as { c?: number } | undefined)?.c ?? 0);
    if (todayCount >= pCfg.dailyLimitPerMember) {
      throw Errors.invalid('SOCIAL_INVALID', `Batas harian ${SOCIAL_PLATFORMS[post.platform].name} tercapai (${todayCount}/${pCfg.dailyLimitPerMember} post/hari).`);
    }

    // Resolve connected account
    let accountRow: Record<string, unknown> | undefined;
    if (post.accountId) {
      const a = await this.db.$client.query(`SELECT * FROM social_accounts WHERE id = $1 AND user_id = $2`, [post.accountId, userId]);
      accountRow = a.rows[0] as Record<string, unknown> | undefined;
    } else {
      const a = await this.db.$client.query(`SELECT * FROM social_accounts WHERE user_id = $1 AND platform = $2 ORDER BY connected_at DESC LIMIT 1`, [userId, post.platform]);
      accountRow = a.rows[0] as Record<string, unknown> | undefined;
    }
    if (!accountRow) {
      throw Errors.invalid('SOCIAL_INVALID', `Belum ada akun ${SOCIAL_PLATFORMS[post.platform].name} yang terhubung. Hubungkan akun terlebih dahulu di tab Akun Terhubung.`);
    }

    const fullText = composeCaption(post.caption, post.hashtags);
    const validation = validatePostForPlatform(post.platform, fullText, Boolean(post.mediaUrl));
    if (!validation.ok) throw Errors.invalid('SOCIAL_INVALID', validation.error);

    await this.db.$client.query(`UPDATE social_posts SET status = 'PUBLISHING', last_error = null, updated_at = now() WHERE id = $1`, [postId]);

    try {
      const secretRef = accountRow.secret_ref ? String(accountRow.secret_ref) : null;
      if (!secretRef) throw new Error('Kredensial akun tidak ditemukan di secret vault.');
      const accessToken = await this.readSecret(userId, secretRef, `social:account:${post.platform}`);
      const res = await publishToPlatform({
        platform: post.platform,
        caption: post.caption,
        hashtags: post.hashtags,
        firstComment: post.firstComment,
        title: post.title,
        mediaUrl: post.mediaUrl,
        credentials: {
          accessToken,
          handle: String(accountRow.handle ?? ''),
          externalId: accountRow.external_id ? String(accountRow.external_id) : undefined,
          instanceUrl: accountRow.instance_url ? String(accountRow.instance_url) : undefined,
          boardId: accountRow.board_id ? String(accountRow.board_id) : undefined,
        },
      });
      const updated = await this.db.$client.query(
        `UPDATE social_posts
         SET status = 'PUBLISHED', published_at = now(), external_post_id = $1, external_url = $2, last_error = null, account_id = $3, updated_at = now()
         WHERE id = $4
         RETURNING *`,
        [res.externalPostId, res.externalUrl, String(accountRow.id), postId],
      );
      if (post.resultId) {
        await this.db
          .update(videoResults)
          .set({ status: 'UPLOADED' })
          .where(and(eq(videoResults.id, post.resultId), eq(videoResults.userId, userId)));
      }
      await this.notifications
        .notify(userId, 'social.published', {
          postId,
          platform: SOCIAL_PLATFORMS[post.platform].name,
          caption: post.caption,
          externalUrl: res.externalUrl,
        })
        .catch(() => undefined);
      await this.audit.log({ actorId: userId, action: 'social.post.published', targetType: 'social_post', targetId: postId, metadata: { platform: post.platform, externalPostId: res.externalPostId } });
      return { post: mapPost(updated.rows[0] as Record<string, unknown>) };
    } catch (err) {
      const message = redact((err as Error).message || 'Gagal publish postingan').slice(0, 400);
      await this.db.$client.query(
        `UPDATE social_posts SET status = 'FAILED', last_error = $1, updated_at = now() WHERE id = $2`,
        [message, postId],
      );
      await this.notifications
        .notify(userId, 'social.failed', { postId, platform: SOCIAL_PLATFORMS[post.platform].name, message })
        .catch(() => undefined);
      throw Errors.invalid('SOCIAL_INVALID', message);
    }
  }

  private async processDueScheduledPosts() {
    if (this.tickBusy) return;
    this.tickBusy = true;
    try {
      const cfg = await this.getAdminConfig();
      if (!cfg.autoPublishEnabled) return;
      const { rows } = await this.db.$client.query(
        `SELECT id, user_id FROM social_posts WHERE status = 'SCHEDULED' AND scheduled_at <= now() ORDER BY scheduled_at ASC LIMIT 10`,
      );
      for (const r of rows) {
        const postId = String((r as Record<string, unknown>).id);
        const userId = String((r as Record<string, unknown>).user_id);
        await this.publishPost(userId, postId).catch((err) => {
          this.log.warn(`Scheduled social post ${postId} failed: ${(err as Error).message}`);
        });
      }
    } catch (err) {
      this.log.debug(`Social scheduler tick skipped: ${(err as Error).message}`);
    } finally {
      this.tickBusy = false;
    }
  }

  async adminOverview() {
    const [accRes, countsRes, queueRes] = await Promise.all([
      this.db.$client.query(`SELECT COUNT(*)::int AS total FROM social_accounts WHERE status = 'CONNECTED'`),
      this.db.$client.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'SCHEDULED')::int AS scheduled,
           COUNT(*) FILTER (WHERE status = 'PUBLISHED')::int AS published,
           COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed,
           COUNT(*) FILTER (WHERE status = 'DRAFT')::int AS drafts,
           COUNT(*) FILTER (WHERE status = 'IDEA')::int AS ideas
         FROM social_posts`,
      ),
      this.db.$client.query(
        `SELECT p.*, u.email AS user_email, u.display_name AS user_name, a.handle AS account_handle
         FROM social_posts p
         JOIN users u ON u.id = p.user_id
         LEFT JOIN social_accounts a ON a.id = p.account_id
         ORDER BY p.updated_at DESC
         LIMIT 50`,
      ),
    ]);
    const c = (countsRes.rows[0] as Record<string, number> | undefined) ?? {};
    return {
      summary: {
        connectedAccounts: Number((accRes.rows[0] as { total?: number } | undefined)?.total ?? 0),
        scheduled: Number(c.scheduled ?? 0),
        published: Number(c.published ?? 0),
        failed: Number(c.failed ?? 0),
        drafts: Number(c.drafts ?? 0),
        ideas: Number(c.ideas ?? 0),
      },
      recentPosts: queueRes.rows.map((r) => {
        const row = r as Record<string, unknown>;
        return {
          ...mapPost(row),
          userEmail: String(row.user_email ?? ''),
          userName: row.user_name ? String(row.user_name) : null,
        };
      }),
    };
  }
}
