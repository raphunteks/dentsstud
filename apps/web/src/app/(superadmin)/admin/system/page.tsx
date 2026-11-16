'use client';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, fmtDate } from '@/lib/api';
import { Button, Card, ErrorNote, Input, PageHead, Skeleton } from '@/components/ui';

interface Setting { key: string; value: unknown; updatedAt: string }
interface Flag { key: string; enabled: boolean }
interface Log { log: { id: string; action: string; targetType: string; metadata: unknown; createdAt: string; ipAddress: string | null }; actorEmail: string | null }

export default function SystemPage() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ['admin-settings'], queryFn: () => api<Setting[]>('/admin/settings') });
  const flags = useQuery({ queryKey: ['admin-flags'], queryFn: () => api<Flag[]>('/admin/feature-flags') });
  const [action, setAction] = useState('');
  const logs = useInfiniteQuery({
    queryKey: ['admin-audit', action],
    initialPageParam: '',
    queryFn: ({ pageParam }) => api<{ items: Log[]; nextCursor: string | null }>(`/admin/audit-logs?limit=30${action ? `&action=${encodeURIComponent(action)}` : ''}${pageParam ? `&cursor=${pageParam}` : ''}`),
    getNextPageParam: (l) => l.nextCursor ?? undefined,
  });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) => api(`/admin/settings/${encodeURIComponent(key)}`, { method: 'PATCH', json: { value } }),
    onSuccess: () => (toast.success('Tersimpan'), qc.invalidateQueries({ queryKey: ['admin-settings'] })),
    onError: (e) => toast.error((e as Error).message),
  });
  const flip = useMutation({
    mutationFn: (f: Flag) => api(`/admin/feature-flags/${f.key}`, { method: 'PATCH', json: { enabled: !f.enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-flags'] }),
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <>
      <PageHead eyebrow="14 · System & security" title="Sistem" />
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <h2 className="font-display text-lg font-medium">Global settings</h2>
          {settings.isError && <ErrorNote error={settings.error} />}
          {!settings.data && <Skeleton className="mt-3 h-40" />}
          <ul className="mt-3 grid gap-2">
            {settings.data?.map((s) => {
              const isObj = typeof s.value === 'object';
              const cur = draft[s.key] ?? JSON.stringify(s.value);
              return (
                <li key={s.key} className="grid grid-cols-[1fr_160px_auto] items-center gap-2 text-sm">
                  <label htmlFor={`s-${s.key}`} className="font-mono text-xs">{s.key}</label>
                  <Input id={`s-${s.key}`} className="h-9 font-mono text-xs" value={cur} disabled={isObj} onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))} />
                  <Button
                    variant="ghost"
                    className="h-9"
                    disabled={isObj || cur === JSON.stringify(s.value)}
                    onClick={() => {
                      try {
                        save.mutate({ key: s.key, value: JSON.parse(cur) });
                      } catch {
                        toast.error('Nilai harus JSON valid');
                      }
                    }}
                  >
                    Simpan
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="font-display text-lg font-medium">Feature flags</h2>
          <ul className="mt-3 grid gap-2">
            {flags.data?.map((f) => (
              <li key={f.key} className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs">{f.key}</span>
                <button
                  role="switch"
                  aria-checked={f.enabled}
                  aria-label={f.key}
                  onClick={() => flip.mutate(f)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${f.enabled ? 'bg-accent' : 'bg-surface-2'}`}
                >
                  <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${f.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-medium">Audit log</h2>
          <Input aria-label="Filter aksi" placeholder="Filter aksi, mis. license" value={action} onChange={(e) => setAction(e.target.value)} className="h-9 max-w-[240px]" />
        </div>
        {logs.isError && <ErrorNote error={logs.error} />}
        <ul className="mt-3 grid font-mono text-xs">
          {logs.data?.pages.flatMap((p) => p.items).map((l) => (
            <li key={l.log.id} className="grid grid-cols-[180px_1fr_auto] gap-3 border-b border-line py-2 last:border-0">
              <span className="text-muted">{fmtDate(l.log.createdAt)}</span>
              <span>
                {l.log.action} <span className="text-muted">· {l.actorEmail ?? 'system'}</span>
              </span>
              <span className="text-muted">{l.log.ipAddress ?? ''}</span>
            </li>
          ))}
        </ul>
        {logs.hasNextPage && (
          <Button variant="ghost" className="mt-3" loading={logs.isFetchingNextPage} onClick={() => logs.fetchNextPage()}>
            Muat lebih banyak
          </Button>
        )}
      </Card>
    </>
  );
}
