import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type Database, systemSettings } from '@dentweb/database';
import { DB } from './tokens.js';

const DEFAULTS = {
  'auth.otp.ttlSeconds': 600,
  'auth.otp.maxAttempts': 5,
  'auth.otp.resendCooldownSeconds': 60,
  'auth.session.ttlHours': 12,
  'auth.refresh.ttlDays': 30,
  'license.defaultMaxDevices': 2,
  'license.offlineGraceHours': 72,
} as const;
type Key = keyof typeof DEFAULTS;

@Injectable()
export class SettingsService {
  private cache = new Map<string, { v: unknown; at: number }>();
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
  invalidate(key?: string) {
    if (key) this.cache.delete(key);
    else this.cache.clear();
  }
}
