'use client';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, fmtDate } from '@/lib/api';
import { Button, Card, ErrorNote, Input, PageHead, Skeleton, Status } from '@/components/ui';
import { Progress, Select, Table, Textarea } from '@/components/ui/extra';

interface Setting { key: string; value: unknown; updatedAt: string }
interface Flag { key: string; enabled: boolean }
interface Log { log: { id: string; action: string; targetType: string; metadata: unknown; createdAt: string; ipAddress: string | null }; actorEmail: string | null }
interface WorkerNode { id: string; name: string; status: string; lastHeartbeatAt: string | null; capabilities?: Record<string, unknown> }
interface RenderJob { id: string; mode: string; status: string; progress: number; format?: string; error?: string | null; createdAt: string; projectId?: string }
interface Incident { id: string; title: string; severity: string; status: string; summary?: string | null; createdAt: string; resolvedAt?: string | null }

export default function SystemPage() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ['admin-settings'], queryFn: () => api<Setting[]>('/admin/settings') });
  const flags = useQuery({ queryKey: ['admin-flags'], queryFn: () => api<Flag[]>('/admin/feature-flags') });
  const workers = useQuery({ queryKey: ['admin-workers'], queryFn: () => api<WorkerNode[]>('/admin/workers'), refetchInterval: 15_000 });
  const renderJobs = useQuery({ queryKey: ['admin-render-jobs'], queryFn: () => api<RenderJob[]>('/admin/render/jobs'), refetchInterval: 10_000 });
  const incidents = useQuery({
    queryKey: ['admin-incidents'],
    queryFn: async () => {
      try {
        const res = await api<Incident[] | { items?: Incident[] }>('/admin/incidents');
        return Array.isArray(res) ? res : (res?.items ?? []);
      } catch {
        return [] as Incident[];
      }
    },
  });

  const [action, setAction] = useState('');
  const [debouncedAction, setDebouncedAction] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedAction(action.trim()), 300);
    return () => clearTimeout(t);
  }, [action]);

  const logs = useInfiniteQuery({
    queryKey: ['admin-audit', debouncedAction],
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      api<{ items: Log[]; nextCursor: string | null }>(
        `/admin/audit-logs?limit=30${debouncedAction ? `&action=${encodeURIComponent(debouncedAction)}` : ''}${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    getNextPageParam: (l) => l.nextCursor ?? undefined,
  });

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [incTitle, setIncTitle] = useState('');
  const [incSeverity, setIncSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [incSummary, setIncSummary] = useState('');

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) => api(`/admin/settings/${encodeURIComponent(key)}`, { method: 'PATCH', json: { value } }),
    onSuccess: (_d, vars) => {
      toast.success('Tersimpan');
      setDraft((prev) => {
        const next = { ...prev };
        delete next[vars.key];
        return next;
      });
      qc.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const flip = useMutation({
    mutationFn: (f: Flag) => api(`/admin/feature-flags/${f.key}`, { method: 'PATCH', json: { enabled: !f.enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-flags'] }),
    onError: (e) => toast.error((e as Error).message),
  });

  const renderAct = useMutation({
    mutationFn: ({ id, a }: { id: string; a: 'cancel' | 'retry' }) => api(`/admin/render/jobs/${id}/${a}`, { method: 'POST' }),
    onSuccess: (_d, v) => {
      toast.success(v.a === 'cancel' ? 'Job render dihentikan' : 'Job render diantrekan ulang');
      qc.invalidateQueries({ queryKey: ['admin-render-jobs'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const createIncident = useMutation({
    mutationFn: () =>
      api('/admin/incidents', {
        method: 'POST',
        json: { title: incTitle.trim(), severity: incSeverity, summary: incSummary.trim() || undefined },
      }),
    onSuccess: () => {
      toast.success('Insiden dicatat');
      setIncTitle('');
      setIncSummary('');
      qc.invalidateQueries({ queryKey: ['admin-incidents'] });
      qc.invalidateQueries({ queryKey: ['admin-dash'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const patchIncident = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api(`/admin/incidents/${id}`, { method: 'PATCH', json: { status } }),
    onSuccess: () => {
      toast.success('Status insiden diperbarui');
      qc.invalidateQueries({ queryKey: ['admin-incidents'] });
      qc.invalidateQueries({ queryKey: ['admin-dash'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="grid gap-4">
      <PageHead eyebrow="14 · System & security" title="Sistem & VPS" />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <h2 className="font-display text-lg font-medium">Global settings</h2>
          {settings.isError && <ErrorNote error={settings.error} onRetry={() => settings.refetch()} />}
          {settings.isLoading && <Skeleton className="mt-3 h-40" />}
          <ul className="mt-3 grid gap-2">
            {settings.data?.map((s) => {
              const isObj = s.value !== null && typeof s.value === 'object';
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
          {flags.isError && <ErrorNote error={flags.error} onRetry={() => flags.refetch()} />}
          {flags.isLoading && <Skeleton className="mt-3 h-32" />}
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

      {/* Worker Nodes & Global Render Queue */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-medium">Worker Nodes</h2>
            <span className="font-mono text-xs text-muted">{workers.data?.length ?? 0} node</span>
          </div>
          {workers.isError && <ErrorNote error={workers.error} onRetry={() => workers.refetch()} />}
          {workers.isLoading && <Skeleton className="mt-3 h-28" />}
          <ul className="mt-3 grid gap-2 text-sm">
            {workers.data?.length === 0 && <li className="text-muted">Belum ada worker terdaftar.</li>}
            {workers.data?.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-medium">{w.name}</p>
                  <p className="text-[11px] text-muted">Heartbeat: {fmtDate(w.lastHeartbeatAt)}</p>
                </div>
                <Status value={w.status === 'ONLINE' ? 'ACTIVE' : 'DISABLED'} label={w.status} />
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-medium">Global Render Queue</h2>
            <span className="font-mono text-xs text-muted">{renderJobs.data?.length ?? 0} job</span>
          </div>
          {renderJobs.isError && <ErrorNote error={renderJobs.error} onRetry={() => renderJobs.refetch()} />}
          {renderJobs.isLoading && <Skeleton className="mt-3 h-32" />}
          {renderJobs.data?.length === 0 && <p className="mt-3 text-sm text-muted">Antrean render kosong.</p>}
          {!!renderJobs.data?.length && (
            <div className="mt-3">
              <Table head={['Job', 'Mode', 'Status', 'Progres', 'Dibuat', '']} minWidth={560}>
                {renderJobs.data.slice(0, 25).map((j) => (
                  <tr key={j.id}>
                    <td className="font-mono text-xs" title={j.id}>{j.id.slice(0, 8)}</td>
                    <td className="font-mono text-xs">{j.mode}</td>
                    <td>
                      <Status value={j.status} />
                      {j.error && <p className="mt-1 max-w-[180px] truncate text-[11px] text-bad" title={j.error}>{j.error}</p>}
                    </td>
                    <td className="w-28">
                      <Progress value={j.progress ?? 0} label={`Render ${j.id}`} />
                      <span className="num font-mono text-[10px] text-muted">{j.progress ?? 0}%</span>
                    </td>
                    <td className="text-xs text-muted">{fmtDate(j.createdAt)}</td>
                    <td className="whitespace-nowrap text-right">
                      {['QUEUED', 'RUNNING'].includes(j.status) && (
                        <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => renderAct.mutate({ id: j.id, a: 'cancel' })}>
                          Batal
                        </Button>
                      )}
                      {['FAILED', 'CANCELLED'].includes(j.status) && (
                        <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => renderAct.mutate({ id: j.id, a: 'retry' })}>
                          Ulangi
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
            </div>
          )}
        </Card>
      </div>

      {/* Incidents Manager */}
      <Card className="p-5">
        <h2 className="font-display text-lg font-medium">Incidents Manager</h2>
        <form
          className="mt-3 grid gap-2 sm:grid-cols-[1fr_140px_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            if (!incTitle.trim()) return toast.error('Judul insiden wajib diisi');
            createIncident.mutate();
          }}
        >
          <Input placeholder="Judul insiden (mis. Gangguan API TTS)" value={incTitle} onChange={(e) => setIncTitle(e.target.value)} className="h-10 text-sm" />
          <Select aria-label="Severity" value={incSeverity} onChange={(e) => setIncSeverity(e.target.value as typeof incSeverity)} className="h-10">
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </Select>
          <Textarea rows={1} placeholder="Ringkasan singkat (opsional)" value={incSummary} onChange={(e) => setIncSummary(e.target.value)} className="min-h-10 h-10 py-2 text-sm" />
          <Button type="submit" loading={createIncident.isPending} className="h-10">
            Catat Insiden
          </Button>
        </form>

        <ul className="mt-4 grid gap-2 text-sm">
          {incidents.data?.length === 0 && <li className="text-muted">Tidak ada insiden tercatat.</li>}
          {incidents.data?.map((inc) => (
            <li key={inc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{inc.title}</span>
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">{inc.severity}</span>
                </div>
                {inc.summary && <p className="mt-0.5 text-xs text-muted">{inc.summary}</p>}
                <p className="mt-1 font-mono text-[11px] text-muted">{fmtDate(inc.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Status value={inc.status === 'RESOLVED' ? 'ok' : inc.status === 'MITIGATED' ? 'warn' : 'bad'} label={inc.status} />
                {inc.status !== 'RESOLVED' && (
                  <Button variant="ghost" className="h-8 text-xs" onClick={() => patchIncident.mutate({ id: inc.id, status: 'RESOLVED' })}>
                    Tandai Selesai
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* Audit Log */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-medium">Audit log</h2>
          <Input aria-label="Filter aksi" placeholder="Filter aksi, mis. license" value={action} onChange={(e) => setAction(e.target.value)} className="h-9 max-w-[240px]" />
        </div>
        {logs.isError && <ErrorNote error={logs.error} onRetry={() => logs.refetch()} />}
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
    </div>
  );
}
