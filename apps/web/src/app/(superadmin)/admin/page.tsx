'use client';
import { useQuery } from '@tanstack/react-query';
import { api, fmtBytes } from '@/lib/api';
import { Card, ErrorNote, PageHead, Skeleton, Status } from '@/components/ui';

interface Dash {
  totalMembers: number;
  activeSessions: number;
  productionJobs: Record<string, number>;
  renderQueue: number;
  storageBytes: number;
  openIncidents: number;
  aiProviderHealth: Record<string, number>;
  catalog: { categories: number; publishedPresets: number; publishedVoices: number };
  onlineWorkers: number;
}
interface Metrics {
  uptimeSec: number;
  dbLatencyMs: number;
  redisLatencyMs: number | null;
  memory: { rss: number };
  pool: { total: number; idle: number; waiting: number };
}

export default function AdminDashboard() {
  const d = useQuery({ queryKey: ['admin-dash'], queryFn: () => api<Dash>('/admin/dashboard'), refetchInterval: 30_000 });
  const m = useQuery({ queryKey: ['admin-metrics'], queryFn: () => api<Metrics>('/admin/metrics'), refetchInterval: 15_000 });
  const runs = d.data ? Object.values(d.data.productionJobs).reduce((a, b) => a + b, 0) : 0;
  const tiles = d.data
    ? [
        ['Total member', d.data.totalMembers],
        ['Sesi aktif', d.data.activeSessions],
        ['Production jobs', runs],
        ['Render queue', d.data.renderQueue],
        ['Worker online', d.data.onlineWorkers],
        ['Storage', fmtBytes(d.data.storageBytes)],
        ['Insiden terbuka', d.data.openIncidents],
        ['Preset published', `${d.data.catalog.publishedPresets} / ${d.data.catalog.categories} kategori`],
      ]
    : [];
  return (
    <>
      <PageHead eyebrow="01 · Global dashboard" title="Control Center" />
      {d.isError && <ErrorNote error={d.error} onRetry={() => d.refetch()} />}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {d.data
          ? tiles.map(([k, v]) => (
              <Card key={String(k)} className="p-5">
                <p className="text-sm text-muted">{k}</p>
                <p className="num mt-3 text-2xl font-medium md:text-3xl">{v}</p>
              </Card>
            ))
          : Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-28 rounded-card" />)}
      </div>
      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-display text-lg font-medium">AI provider health</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {d.data && Object.keys(d.data.aiProviderHealth).length === 0 && <p className="text-sm text-muted">Belum ada member yang menghubungkan Claude.</p>}
            {d.data &&
              Object.entries(d.data.aiProviderHealth).map(([s, n]) => (
                <span key={s} className="inline-flex items-center gap-2">
                  <Status value={s} /> <span className="num text-sm">{n}</span>
                </span>
              ))}
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="font-display text-lg font-medium">System metrics</h2>
          {m.data ? (
            <dl className="num mt-4 grid grid-cols-2 gap-3 text-sm">
              <dt className="text-muted">DB latency</dt>
              <dd>{m.data.dbLatencyMs} ms</dd>
              <dt className="text-muted">Redis latency</dt>
              <dd>{m.data.redisLatencyMs === null ? 'down' : `${m.data.redisLatencyMs} ms`}</dd>
              <dt className="text-muted">Pool (total/idle/waiting)</dt>
              <dd>
                {m.data.pool.total}/{m.data.pool.idle}/{m.data.pool.waiting}
              </dd>
              <dt className="text-muted">API RSS</dt>
              <dd>{fmtBytes(m.data.memory.rss)}</dd>
              <dt className="text-muted">Uptime</dt>
              <dd>{Math.round(m.data.uptimeSec / 60)} menit</dd>
            </dl>
          ) : (
            <Skeleton className="mt-4 h-24" />
          )}
        </Card>
      </div>
    </>
  );
}
