import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { type Database, errorReports } from '@dentweb/database';
import { DB } from './tokens.js';
import { redact } from './crypto.js';

/** Normalises volatile parts (ids, numbers, urls) so the same bug groups under one fingerprint. */
export function fingerprintOf(source: string, message: string, stack?: string | null) {
  const norm = (s: string) =>
    s
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
      .replace(/https?:\/\/\S+/g, ':url')
      .replace(/\d+/g, ':n')
      .slice(0, 500);
  const frame = (stack ?? '').split('\n').find((l) => l.trim().startsWith('at ')) ?? '';
  return createHash('sha256').update(`${source}|${norm(message)}|${norm(frame.replace(/:\d+:\d+\)?$/, ''))}`).digest('hex');
}

/** Grouped error store (API 5xx + client reports). Never throws: reporting must not break the request. */
@Injectable()
export class ErrorReportsService {
  private readonly log = new Logger('ErrorReports');
  constructor(@Inject(DB) private readonly db: Database) {}

  async record(e: { source: 'api' | 'web' | 'desktop' | 'worker'; message: string; stack?: string | null; context?: Record<string, unknown>; userId?: string | null }) {
    try {
      const message = redact(e.message).slice(0, 2000);
      const stack = e.stack ? redact(e.stack).slice(0, 8000) : null;
      const fp = fingerprintOf(e.source, message, stack);
      await this.db
        .insert(errorReports)
        .values({ fingerprint: fp, source: e.source, message, stack, context: e.context ?? {}, userId: e.userId ?? null, status: 'OPEN' })
        .onConflictDoUpdate({
          target: errorReports.fingerprint,
          set: { occurrences: sql`${errorReports.occurrences} + 1`, lastSeenAt: sql`now()`, context: e.context ?? {}, status: sql`case when ${errorReports.status} = 'IGNORED' then 'IGNORED' else 'OPEN' end` },
        });
    } catch (err) {
      this.log.warn(`could not record error: ${(err as Error).message}`);
    }
  }
}

/** In-process HTTP metrics rendered in Prometheus text format. */
@Injectable()
export class MetricsRegistry {
  static readonly BUCKETS = [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
  private readonly counts = new Map<string, number>();
  private readonly hist = new Map<string, { buckets: number[]; sum: number; count: number }>();

  observe(method: string, route: string, status: number, seconds: number) {
    const k = `method="${method}",route="${route}",status="${status}"`;
    this.counts.set(k, (this.counts.get(k) ?? 0) + 1);
    const hk = `method="${method}",route="${route}"`;
    const h = this.hist.get(hk) ?? { buckets: MetricsRegistry.BUCKETS.map(() => 0), sum: 0, count: 0 };
    MetricsRegistry.BUCKETS.forEach((b, i) => {
      if (seconds <= b) h.buckets[i]!++;
    });
    h.sum += seconds;
    h.count++;
    this.hist.set(hk, h);
  }

  render() {
    const out: string[] = ['# HELP dentweb_http_requests_total HTTP requests by route and status', '# TYPE dentweb_http_requests_total counter'];
    for (const [k, v] of this.counts) out.push(`dentweb_http_requests_total{${k}} ${v}`);
    out.push('# HELP dentweb_http_request_duration_seconds HTTP request latency', '# TYPE dentweb_http_request_duration_seconds histogram');
    for (const [k, h] of this.hist) {
      MetricsRegistry.BUCKETS.forEach((b, i) => out.push(`dentweb_http_request_duration_seconds_bucket{${k},le="${b}"} ${h.buckets[i]}`));
      out.push(`dentweb_http_request_duration_seconds_bucket{${k},le="+Inf"} ${h.count}`);
      out.push(`dentweb_http_request_duration_seconds_sum{${k}} ${h.sum.toFixed(6)}`, `dentweb_http_request_duration_seconds_count{${k}} ${h.count}`);
    }
    return out.join('\n');
  }
}
