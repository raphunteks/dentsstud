'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, ErrorNote, PageHead, Skeleton, Status } from '@/components/ui';

interface Provider {
  code: string;
  name: string;
  kind: string;
  notes: string | null;
  methods: { method: string; available: boolean; reason: string | null }[];
}

export default function AiProvidersPage() {
  const q = useQuery({ queryKey: ['ai-providers'], queryFn: () => api<Provider[]>('/ai/providers') });
  const d = useQuery({ queryKey: ['admin-dash'], queryFn: () => api<{ aiProviderHealth: Record<string, number> }>('/admin/dashboard') });
  return (
    <>
      <PageHead eyebrow="06 · AI provider center" title="Provider registry" />
      {q.isError && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
      {!q.data && <Skeleton className="h-40 rounded-card" />}
      {q.data?.map((p) => (
        <Card key={p.code} className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-medium">{p.name}</h2>
            <span className="font-mono text-xs text-muted">{p.code} · {p.kind}</span>
          </div>
          {p.notes && <p className="mt-2 max-w-3xl text-sm text-muted">{p.notes}</p>}
          <ul className="mt-5 grid gap-3 md:grid-cols-3">
            {p.methods.map((m) => (
              <li key={m.method} className="rounded-xl border border-line p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs">{m.method}</span>
                  <Status value={m.available ? 'ok' : 'bad'} label={m.available ? 'available' : 'UNSUPPORTED'} />
                </div>
                {m.reason && <p className="mt-2 text-muted">{m.reason}</p>}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <span className="text-muted">Koneksi member:</span>
            {d.data && Object.entries(d.data.aiProviderHealth).map(([s, n]) => <Status key={s} value={s} label={`${s} ${n}`} />)}
          </div>
        </Card>
      ))}
    </>
  );
}
