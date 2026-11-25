'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { api, fmtDate } from '@/lib/api';
import { Button, Card, Empty, ErrorNote, PageHead, Skeleton, Status } from '@/components/ui';
import { Progress, Tabs } from '@/components/ui/extra';

interface Run { id: string; status: string; progress: number; currentStage: string | null; topic: string | null; kind: string; sequence: number; createdAt: string; resultId: string | null; error: { message?: string; stage?: string } | null }
interface Stage { id: string; stageCode: string; attemptNumber: number; status: string; startedAt: string; completedAt: string | null }
interface Ev { id: string; eventType: string; agentCode: string | null; message: string; createdAt: string; metadata?: Record<string, unknown> }
interface RunDetail extends Run { stages: Stage[]; config: { format: string } | null }

const STAGES = [
  ['RESEARCH', 'Riset'],
  ['SCRIPT', 'Naskah'],
  ['FACT_CHECK', 'Cek fakta'],
  ['MOTION', 'Motion & render'],
  ['QC', 'Quality control'],
  ['SOCIAL', 'Paket sosial'],
] as const;
const ACTIVE = ['QUEUED', 'RUNNING', 'CANCELLING', 'PAUSED'];
const AGENT: Record<string, string> = { research: 'Riset', scriptwriter: 'Penulis naskah', fact_checker: 'Pemeriksa fakta', motion_director: 'Motion director', qc: 'QC', social_media: 'Sosial media' };

function RunPanel({ id }: { id: string }) {
  const qc = useQueryClient();
  const [tech, setTech] = useState(false);
  const run = useQuery({ queryKey: ['run', id], queryFn: () => api<RunDetail>(`/production/runs/${id}`), refetchInterval: (q) => (q.state.data && ACTIVE.includes(q.state.data.status) ? 3000 : false) });
  const [events, setEvents] = useState<Ev[]>([]);
  const feedRef = useRef<HTMLOListElement>(null);

  // Live activity via SSE; falls back to polling the events endpoint if the stream drops.
  useEffect(() => {
    setEvents([]);
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let after: string | undefined;
    const push = (e: Ev) => setEvents((x) => (x.some((y) => y.id === e.id) ? x : [...x, e]));
    const poll = async () => {
      const list = await api<Ev[]>(`/production/runs/${id}/events${after ? `?after=${encodeURIComponent(after)}` : ''}`).catch(() => []);
      list.forEach(push);
      if (list.length) after = list[list.length - 1]!.createdAt;
    };
    es = new EventSource(`/api/v1/production/runs/${id}/stream`, { withCredentials: true });
    es.addEventListener('event', (m) => {
      const e = JSON.parse((m as MessageEvent).data) as Ev;
      push(e);
      after = e.createdAt;
    });
    es.addEventListener('state', () => qc.invalidateQueries({ queryKey: ['run', id] }));
    es.onerror = () => {
      es?.close();
      if (!timer) {
        void poll();
        timer = setInterval(poll, 4000);
      }
    };
    return () => {
      es?.close();
      if (timer) clearInterval(timer);
    };
  }, [id, qc]);

  const techLogs = useQuery({ queryKey: ['run-tech', id], queryFn: () => api<Ev[]>(`/production/runs/${id}/events?technical=1`), enabled: tech, refetchInterval: tech ? 5000 : false });

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  const act = useMutation({
    mutationFn: (a: 'cancel' | 'retry' | 'resume') => api(`/production/runs/${id}/${a}`, { method: 'POST' }),
    onSuccess: (_d, a) => {
      toast.success(a === 'cancel' ? 'Permintaan berhenti dikirim' : a === 'retry' ? 'Produksi diulang dari awal' : 'Produksi dilanjutkan');
      qc.invalidateQueries({ queryKey: ['run', id] });
      qc.invalidateQueries({ queryKey: ['runs'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (run.isLoading) return <Skeleton className="h-96 rounded-card" />;
  if (run.isError) return <ErrorNote error={run.error} onRetry={() => run.refetch()} />;
  const r = run.data!;
  const stageState = (code: string) => {
    const s = r.stages.filter((x) => x.stageCode === code);
    if (s.some((x) => x.status === 'COMPLETED')) return 'COMPLETED';
    if (r.currentStage === code && ACTIVE.includes(r.status)) return 'RUNNING';
    if (s.some((x) => x.status === 'FAILED')) return 'FAILED';
    return 'WAITING';
  };

  return (
    <div className="grid gap-5 min-w-0 max-w-full overflow-hidden">
      <Card className="p-5 min-w-0 max-w-full overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 min-w-0">
          <div className="min-w-0 max-w-full">
            <p className="font-mono text-xs text-muted">{r.kind === 'REVISION' ? 'Revisi' : `Video #${r.sequence}`} · {r.config?.format}</p>
            <h2 className="mt-1 truncate font-display text-xl font-medium text-text">{r.topic ?? 'Topik dipilih AI…'}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Status value={r.status} />
            {ACTIVE.includes(r.status) && r.status !== 'CANCELLING' && <Button variant="ghost" className="h-9 text-xs" loading={act.isPending} onClick={() => act.mutate('cancel')}>Hentikan</Button>}
            {['FAILED', 'CANCELLED'].includes(r.status) && !r.resultId && (
              <>
                <Button className="h-9 text-xs" loading={act.isPending} onClick={() => act.mutate('resume')}>Lanjutkan</Button>
                <Button variant="ghost" className="h-9 text-xs" onClick={() => act.mutate('retry')}>Ulang dari awal</Button>
              </>
            )}
            {r.resultId && <Link href={`/results/${r.resultId}`} className="inline-flex h-9 items-center rounded-[10px] bg-accent px-4 text-xs font-semibold text-accent-contrast">Lihat hasil</Link>}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1"><Progress value={r.progress} label="Progres produksi" /></div>
          <span className="num w-12 text-right font-mono text-sm font-semibold text-accent">{r.progress}%</span>
        </div>
        {r.error?.message && <p role="alert" className="mt-4 rounded-xl border border-bad/40 bg-bad/5 px-4 py-3 text-sm text-bad">{r.error.message}</p>}
        <ol className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 min-w-0">
          {STAGES.map(([code, label], i) => {
            const st = stageState(code);
            return (
              <li
                key={code}
                className={clsx(
                  'min-w-0 rounded-xl border p-3.5 flex flex-col justify-between transition-colors',
                  st === 'RUNNING' && 'border-accent bg-accent/10 ring-2 ring-accent/20 shadow-sm',
                  st === 'COMPLETED' && 'border-emerald-500/40 bg-emerald-500/5',
                  st === 'FAILED' && 'border-red-500/40 bg-red-500/5',
                  st === 'WAITING' && 'border-line bg-surface-2/40 opacity-70'
                )}
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-muted mb-1.5">
                  <span className="font-semibold">{String(i + 1).padStart(2, '0')}</span>
                  {st === 'COMPLETED' && <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>}
                  {st === 'RUNNING' && <span className="inline-block size-2 rounded-full bg-accent animate-ping" />}
                  {st === 'FAILED' && <span className="text-red-500 font-bold">✕</span>}
                </div>
                <p className="text-xs sm:text-sm font-semibold text-text leading-tight">{label}</p>
                <p className={clsx('mt-2 text-[11px] font-medium', st === 'COMPLETED' ? 'text-emerald-600 dark:text-emerald-400' : st === 'FAILED' ? 'text-bad' : st === 'RUNNING' ? 'text-accent font-semibold' : 'text-muted')}>
                  {st === 'COMPLETED' ? 'Selesai' : st === 'RUNNING' ? 'Berjalan…' : st === 'FAILED' ? 'Gagal' : 'Menunggu'}
                </p>
              </li>
            );
          })}
        </ol>
      </Card>

      <Card className="p-5 min-w-0 max-w-full overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-semibold text-text">Aktivitas & Log Terminal</h3>
            {ACTIVE.includes(r.status) && (
              <span className="flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                <span className="inline-block size-1.5 rounded-full bg-blue-500 animate-pulse" />
                LIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Tabs label="Mode log" value={tech ? 'tech' : 'feed'} onChange={(v) => setTech(v === 'tech')} items={[{ value: 'feed', label: 'Feed' }, { value: 'tech', label: 'Log teknis' }]} />
            {tech && techLogs.data && (
              <button
                type="button"
                onClick={() => {
                  const text = techLogs.data?.map((e) => `${e.createdAt}  ${e.eventType.padEnd(20)} ${e.agentCode ?? '-'}  ${e.message}${e.metadata && Object.keys(e.metadata).length ? `  ${JSON.stringify(e.metadata)}` : ''}`).join('\n') ?? '';
                  navigator.clipboard.writeText(text);
                  toast.success('Log teknis disalin ke clipboard');
                }}
                className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted hover:border-text/30 hover:text-text transition-colors"
              >
                Salin log
              </button>
            )}
          </div>
        </div>
        {!tech ? (
          <ol ref={feedRef} className="mt-4 grid max-h-[420px] gap-2.5 overflow-y-auto pr-1 text-sm min-w-0" aria-live="polite">
            {events.length === 0 && <li className="text-sm text-muted py-4 text-center">Menunggu aktivitas pertama…</li>}
            {events.map((e) => (
              <li key={e.id} className="grid grid-cols-[68px_1fr] gap-3 text-xs sm:text-sm items-start py-1 border-b border-line/40 last:border-0 min-w-0">
                <time className="num font-mono text-[11px] text-muted shrink-0 pt-0.5" dateTime={e.createdAt}>
                  {new Date(e.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </time>
                <div className="min-w-0 break-words">
                  <p className={clsx(e.eventType.includes('fail') && 'text-bad font-medium', e.eventType.includes('warning') && 'text-warn font-medium')}>
                    {e.agentCode && (
                      <span className="mr-1.5 inline-block rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-text border border-line">
                        {AGENT[e.agentCode] ?? e.agentCode}
                      </span>
                    )}
                    {e.message}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <pre className="mt-4 max-h-[420px] overflow-x-auto overflow-y-auto rounded-xl bg-surface-2 p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all select-text border border-line">
            {techLogs.data?.map((e) => `${e.createdAt}  ${e.eventType.padEnd(20)} ${e.agentCode ?? '-'}  ${e.message}${e.metadata && Object.keys(e.metadata).length ? `  ${JSON.stringify(e.metadata)}` : ''}`).join('\n') ?? 'Memuat log teknis…'}
          </pre>
        )}
      </Card>
    </div>
  );
}

function ProgressInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const selected = sp.get('run');
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const runs = useQuery({
    queryKey: ['runs', filter],
    queryFn: () => api<Run[]>(`/production/runs?limit=100${filter === 'active' ? '&status=QUEUED,RUNNING,CANCELLING,PAUSED' : ''}`),
    refetchInterval: 4000,
  });
  const list = runs.data ?? [];
  const current = selected ?? list[0]?.id ?? null;

  return (
    <div className="space-y-6 min-w-0 max-w-full">
      <PageHead eyebrow="Produksi" title="Progress" actions={<Link href="/create-content" className="inline-flex h-10 items-center rounded-[10px] bg-accent px-4 text-sm font-medium text-accent-contrast">Buat konten</Link>} />

      {/* Top: Unified Run Selector (Aktif / Semua) across Desktop, Tablet & Mobile */}
      <div className="space-y-3 rounded-2xl border border-line bg-surface/80 p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Tabs label="Filter produksi" value={filter} onChange={setFilter} items={[{ value: 'active', label: 'Aktif' }, { value: 'all', label: 'Semua' }]} />
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 font-mono text-xs text-muted border border-line">
              {list.length} antrean
            </span>
          </div>
          {runs.isFetching && !runs.isLoading && (
            <span className="text-[11px] font-mono text-muted animate-pulse">Menyelaraskan data…</span>
          )}
        </div>

        {runs.isLoading && <Skeleton className="h-20 rounded-xl" />}
        {runs.isError && <ErrorNote error={runs.error} onRetry={() => runs.refetch()} />}

        {!runs.isLoading && list.length === 0 && (
          <div className="py-4 text-center">
            <p className="text-sm font-medium text-text">Tidak ada antrean produksi pada tab {filter === 'active' ? 'Aktif' : 'Semua'}.</p>
            <p className="text-xs text-muted mt-1">Klik tombol &ldquo;Buat konten&rdquo; untuk memulai produksi video baru.</p>
          </div>
        )}

        {!runs.isLoading && list.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-1 pt-1 scrollbar-thin">
            {list.map((r) => {
              const isSelected = current === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => router.replace(`/progress?run=${r.id}`)}
                  className={clsx(
                    'group shrink-0 w-72 rounded-xl border p-3.5 text-left transition-all duration-200 cursor-pointer shadow-xs',
                    isSelected
                      ? 'border-accent bg-accent/10 ring-2 ring-accent/30 shadow-sm'
                      : 'border-line bg-surface hover:border-text/30 hover:bg-surface-2/60'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs sm:text-sm font-semibold text-text group-hover:text-accent transition-colors">
                      {r.topic ?? 'Topik dipilih AI'}
                    </p>
                    <span className="font-mono text-xs font-bold text-accent">{r.progress}%</span>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted">
                    <Status value={r.status} />
                    <span className="font-mono text-[10px]">{fmtDate(r.createdAt)}</span>
                  </div>
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={clsx('h-full transition-all duration-300', isSelected ? 'bg-accent' : 'bg-muted/40')}
                      style={{ width: `${Math.min(100, Math.max(0, r.progress))}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* KE BAWAH: Full-width Detail Panel (Gambar 2) without cramped side column */}
      <div className="min-w-0 max-w-full overflow-hidden">
        {current ? (
          <RunPanel key={current} id={current} />
        ) : (
          <Empty title="Pilih produksi" body="Pilih salah satu produksi di atas untuk melihat tahap, aktivitas agen dan log teknis." />
        )}
      </div>
    </div>
  );
}

export default function ProgressPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-card" />}>
      <ProgressInner />
    </Suspense>
  );
}
