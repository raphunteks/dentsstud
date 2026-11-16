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
const ACTIVE = ['QUEUED', 'RUNNING', 'CANCELLING'];
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
    <div className="grid gap-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-muted">{r.kind === 'REVISION' ? 'Revisi' : `Video #${r.sequence}`} · {r.config?.format}</p>
            <h2 className="mt-1 truncate font-display text-xl font-medium">{r.topic ?? 'Topik dipilih AI…'}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Status value={r.status} />
            {ACTIVE.includes(r.status) && r.status !== 'CANCELLING' && <Button variant="ghost" className="h-9" loading={act.isPending} onClick={() => act.mutate('cancel')}>Hentikan</Button>}
            {['FAILED', 'CANCELLED'].includes(r.status) && !r.resultId && (
              <>
                <Button className="h-9" loading={act.isPending} onClick={() => act.mutate('resume')}>Lanjutkan</Button>
                <Button variant="ghost" className="h-9" onClick={() => act.mutate('retry')}>Ulang dari awal</Button>
              </>
            )}
            {r.resultId && <Link href={`/results/${r.resultId}`} className="inline-flex h-9 items-center rounded-[10px] bg-accent px-4 text-sm font-medium text-accent-contrast">Lihat hasil</Link>}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1"><Progress value={r.progress} label="Progres produksi" /></div>
          <span className="num w-10 text-right font-mono text-sm">{r.progress}%</span>
        </div>
        {r.error?.message && <p role="alert" className="mt-4 rounded-xl border border-bad/40 bg-bad/5 px-4 py-3 text-sm">{r.error.message}</p>}
        <ol className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {STAGES.map(([code, label], i) => {
            const st = stageState(code);
            return (
              <li key={code} className={clsx('rounded-xl border px-3 py-2.5', st === 'RUNNING' ? 'border-accent' : 'border-line')}>
                <p className="num font-mono text-[11px] text-muted">{String(i + 1).padStart(2, '0')}</p>
                <p className="text-sm font-medium">{label}</p>
                <p className={clsx('mt-0.5 text-xs', st === 'COMPLETED' ? 'text-ok' : st === 'FAILED' ? 'text-bad' : st === 'RUNNING' ? 'text-accent' : 'text-muted')}>
                  {st === 'COMPLETED' ? 'Selesai' : st === 'RUNNING' ? 'Berjalan…' : st === 'FAILED' ? 'Gagal' : 'Menunggu'}
                </p>
              </li>
            );
          })}
        </ol>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-base font-medium">Aktivitas</h3>
          <Tabs label="Mode log" value={tech ? 'tech' : 'feed'} onChange={(v) => setTech(v === 'tech')} items={[{ value: 'feed', label: 'Feed' }, { value: 'tech', label: 'Log teknis' }]} />
        </div>
        {!tech ? (
          <ol ref={feedRef} className="mt-4 grid max-h-[420px] gap-3 overflow-y-auto pr-1" aria-live="polite">
            {events.length === 0 && <li className="text-sm text-muted">Menunggu aktivitas pertama…</li>}
            {events.map((e) => (
              <li key={e.id} className="grid grid-cols-[64px_1fr] gap-3 text-sm">
                <time className="num font-mono text-xs text-muted" dateTime={e.createdAt}>{new Date(e.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
                <p className={clsx(e.eventType.includes('fail') && 'text-bad', e.eventType.includes('warning') && 'text-warn')}>
                  {e.agentCode && <span className="mr-1.5 font-medium">{AGENT[e.agentCode] ?? e.agentCode}:</span>}
                  {e.message}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <pre className="mt-4 max-h-[420px] overflow-auto rounded-xl bg-surface-2 p-4 font-mono text-xs leading-relaxed">
            {techLogs.data?.map((e) => `${e.createdAt}  ${e.eventType.padEnd(20)} ${e.agentCode ?? '-'}  ${e.message}${e.metadata && Object.keys(e.metadata).length ? `  ${JSON.stringify(e.metadata)}` : ''}`).join('\n') ?? 'Memuat…'}
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
    <>
      <PageHead eyebrow="Produksi" title="Progress" actions={<Link href="/create-content" className="inline-flex h-10 items-center rounded-[10px] bg-accent px-4 text-sm font-medium text-accent-contrast">Buat konten</Link>} />
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div>
          <Tabs label="Filter produksi" value={filter} onChange={setFilter} items={[{ value: 'active', label: 'Aktif' }, { value: 'all', label: 'Semua' }]} />
          {runs.isError && <div className="mt-3"><ErrorNote error={runs.error} onRetry={() => runs.refetch()} /></div>}
          {runs.isLoading && <Skeleton className="mt-3 h-64 rounded-card" />}
          <ul className="mt-3 grid gap-2">
            {list.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => router.replace(`/progress?run=${r.id}`)}
                  aria-current={current === r.id}
                  className={clsx('w-full rounded-xl border px-4 py-3 text-left transition-colors', current === r.id ? 'border-accent bg-accent/5' : 'border-line bg-surface hover:border-text/30')}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{r.topic ?? 'Topik dipilih AI'}</span>
                    <span className="num font-mono text-xs text-muted">{r.progress}%</span>
                  </span>
                  <span className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted">
                    <Status value={r.status} />
                    <span>{fmtDate(r.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!runs.isLoading && list.length === 0 && <div className="mt-3"><Empty title="Tidak ada produksi aktif" body="Pesanan baru akan muncul di sini dengan progres setiap tahap." /></div>}
        </div>
        <div className="min-w-0">{current ? <RunPanel key={current} id={current} /> : <Empty title="Pilih produksi" body="Pilih salah satu produksi untuk melihat tahap, aktivitas agen dan log teknis." />}</div>
      </div>
    </>
  );
}

export default function ProgressPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-card" />}>
      <ProgressInner />
    </Suspense>
  );
}
