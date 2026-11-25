import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type Database, featureFlags, systemSettings } from '@dentweb/database';
import { DB } from './tokens.js';

const DEFAULTS = {
  'auth.otp.ttlSeconds': 600,
  'auth.otp.maxAttempts': 5,
  'auth.otp.resendCooldownSeconds': 60,
  'auth.session.ttlHours': 12,
  'auth.refresh.ttlDays': 30,
  'license.defaultMaxDevices': 2,
  'license.offlineGraceHours': 72,
  'upload.maxBytes': 314_572_800,
  'render.maxResolution': 1920,
} as const;
type Key = keyof typeof DEFAULTS;

@Injectable()
export class SettingsService {
  private cache = new Map<string, { v: unknown; at: number }>();
  private flagCache = new Map<string, { v: boolean; at: number }>();
  constructor(@Inject(DB) private readonly db: Database) {}

  async num(key: Key | string, fallback?: number): Promise<number> {
    const def = (DEFAULTS as Record<string, number>)[key] ?? fallback ?? 0;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < 30_000) return Number(hit.v);
    const [row] = await this.db.select().from(systemSettings).where(eq(systemSettings.key, key));
    const v = row ? Number(row.value) : def;
    this.cache.set(key, { v, at: Date.now() });
    return Number.isFinite(v) ? v : def;
  }

  async raw<T>(key: string, fallback: T): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < 30_000) return hit.v as T;
    const [row] = await this.db.select().from(systemSettings).where(eq(systemSettings.key, key));
    const v = row ? (row.value as T) : fallback;
    this.cache.set(key, { v, at: Date.now() });
    return v;
  }

  async flag(key: string, fallback = true): Promise<boolean> {
    const hit = this.flagCache.get(key);
    if (hit && Date.now() - hit.at < 30_000) return hit.v;
    const [row] = await this.db.select().from(featureFlags).where(eq(featureFlags.key, key));
    const v = row ? row.enabled : fallback;
    this.flagCache.set(key, { v, at: Date.now() });
    return v;
  }

  invalidate(key?: string) {
    if (key) {
      this.cache.delete(key);
      this.flagCache.delete(key);
    } else {
      this.cache.clear();
      this.flagCache.clear();
    }
  }
}
