import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { get, mutate } from '../bridge';
import { Button, Card, Pill, errMsg } from '../components/UI';
import type { NavTab, RunItem, EventItem } from '../types';

interface ProgressViewProps {
  onNavigate: (tab: NavTab) => void;
}

const AGENT_LABELS: Record<string, { name: string; color: string }> = {
  research: { name: 'Riset', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  scriptwriter: { name: 'Penulis Naskah', color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30' },
  fact_checker: { name: 'Cek Fakta', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  motion_director: { name: 'Motion Director', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  qc: { name: 'QC Kualitas', color: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30' },
  social_media: { name: 'Sosial Media', color: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30' },
};

function RunActivitySection({ run }: { run: RunItem }) {
  const [tab, setTab] = useState<'feed' | 'terminal'>('feed');
  const [copied, setCopied] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const isActive = run.status === 'RUNNING' || run.status === 'QUEUED';

  const eventsQuery = useQuery({
    queryKey: ['run-events', run.id],
    queryFn: () => get<EventItem[]>(`/production/runs/${run.id}/events`).catch(() => []),
    refetchInterval: isActive ? 2500 : 15000,
  });

  const techQuery = useQuery({
    queryKey: ['run-tech-events', run.id],
    queryFn: () => get<EventItem[]>(`/production/runs/${run.id}/events?technical=1`).catch(() => []),
    refetchInterval: isActive ? 2500 : 15000,
  });

  const events = eventsQuery.data || [];
  const techEvents = techQuery.data || [];

  useEffect(() => {
    if (tab === 'terminal' && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [techEvents.length, tab]);

  const copyLogs = () => {
    const text = techEvents
      .map(
        (e) =>
          `${e.createdAt}  ${e.eventType.padEnd(20)} ${e.agentCode ?? '-'}  ${e.message}${
            e.metadata && Object.keys(e.metadata).length ? `  ${JSON.stringify(e.metadata)}` : ''
          }`,
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="pt-3 border-t border-line space-y-3">
      {/* Activity Header with Tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text">Aktivitas & Log Terminal</span>
          {isActive ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
              <span className="size-1.5 rounded-full bg-blue-500 animate-pulse" />
              LIVE REALTIME
            </span>
          ) : (
            <span className="text-[10px] font-mono text-muted">
              {events.length} aktivitas tersimpan
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setTab('feed')}
              className={clsx(
                'rounded-md px-2.5 py-1 font-medium transition-colors',
                tab === 'feed'
                  ? 'bg-surface text-text shadow-xs font-semibold'
                  : 'text-muted hover:text-text',
              )}
            >
              Feed Aktivitas
            </button>
            <button
              type="button"
              onClick={() => setTab('terminal')}
              className={clsx(
                'rounded-md px-2.5 py-1 font-medium transition-colors',
                tab === 'terminal'
                  ? 'bg-surface text-text shadow-xs font-semibold'
                  : 'text-muted hover:text-text',
              )}
            >
              Log Terminal
            </button>
          </div>

          <button
            type="button"
            onClick={copyLogs}
            className="rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] text-muted hover:text-text hover:border-text/30 transition-colors"
          >
            {copied ? '✓ Tersalin' : 'Salin log'}
          </button>
        </div>
      </div>

      {/* Mode 1: Feed Aktivitas */}
      {tab === 'feed' && (
        <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1 rounded-xl border border-line/60 bg-surface-2/20 p-2.5">
          {events.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted">
              {isActive ? 'Menunggu aktivitas agen dimulai…' : 'Tidak ada catatan aktivitas.'}
            </div>
          ) : (
            events.map((e) => {
              const ag = e.agentCode ? AGENT_LABELS[e.agentCode] : null;
              const isDone = e.eventType.includes('completed') || e.eventType.includes('done');
              const isFail = e.eventType.includes('fail') || e.eventType.includes('error');

              return (
                <div
                  key={e.id}
                  className="flex items-start gap-2.5 rounded-lg border border-line/50 bg-surface p-2 text-xs transition-colors hover:border-line"
                >
                  <time className="font-mono text-[10px] text-muted shrink-0 pt-0.5">
                    {new Date(e.createdAt).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </time>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {ag ? (
                        <span className={clsx('rounded px-1.5 py-0.2 text-[9px] font-semibold border', ag.color)}>
                          {ag.name}
                        </span>
                      ) : (
                        <span className="rounded bg-surface-2 px-1.5 py-0.2 text-[9px] font-mono text-muted border border-line">
                          system
                        </span>
                      )}
                      <span className={clsx('font-mono text-[10px] font-semibold', isDone ? 'text-emerald-600 dark:text-emerald-400' : isFail ? 'text-red-500' : 'text-text')}>
                        {e.eventType}
                      </span>
                    </div>
                    <p className="text-muted leading-relaxed text-[11px] break-words">
                      {e.message}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Mode 2: Log Teknis (Terminal Monospace) */}
      {tab === 'terminal' && (
        <div className="rounded-xl border border-line/60 bg-[#0c0e12] overflow-hidden shadow-inner font-mono text-[11px]">
          {/* Terminal Titlebar */}
          <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-red-500/80 inline-block" />
              <span className="size-2 rounded-full bg-yellow-500/80 inline-block" />
              <span className="size-2 rounded-full bg-green-500/80 inline-block" />
              <span className="ml-2 font-mono text-[10px] text-white/40">
                dentsweb-pipeline.log ({run.id.slice(0, 8)})
              </span>
            </div>
            <span className="text-[9px] text-white/40">
              {techEvents.length} entri
            </span>
          </div>

          {/* Terminal Content */}
          <div className="max-h-[260px] overflow-y-auto p-3 space-y-1 text-white/80 leading-relaxed select-text font-mono text-[10px]">
            {techEvents.length === 0 ? (
              <div className="text-white/40 py-4 text-center">Menunggu entri log server…</div>
            ) : (
              techEvents.map((e) => {
                const isDone = e.eventType.includes('completed') || e.eventType.includes('done');
                const isFail = e.eventType.includes('fail') || e.eventType.includes('error');
                const isStart = e.eventType.includes('started');

                return (
                  <div key={e.id} className="flex gap-2 items-start hover:bg-white/5 px-1 py-0.5 rounded transition-colors">
                    <span className="text-white/35 shrink-0 select-none">
                      {new Date(e.createdAt).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                    <span
                      className={clsx(
                        'shrink-0 font-bold',
                        isDone ? 'text-emerald-400' : isFail ? 'text-red-400' : isStart ? 'text-blue-400' : 'text-amber-400',
                      )}
                    >
                      [{e.eventType}]
                    </span>
                    {e.agentCode && (
                      <span className="text-purple-300 font-semibold shrink-0">
                        @{e.agentCode}
                      </span>
                    )}
                    <span className="text-white/90 break-all flex-1">
                      {e.message}
                      {e.metadata && Object.keys(e.metadata).length > 0 && (
                        <span className="text-white/40 ml-1.5">
                          {JSON.stringify(e.metadata)}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}

export function ProgressView({ onNavigate }: ProgressViewProps) {
  const qc = useQueryClient();

  const runs = useQuery({
    queryKey: ['runs'],
    queryFn: () => get<RunItem[]>('/production/runs').catch(() => []),
    refetchInterval: (query) => (query.state.data?.some((r) => r.status === 'RUNNING' || r.status === 'QUEUED') ? 3000 : 15000),
  });

  const retryRun = useMutation({
    mutationFn: (id: string) => mutate('POST', `/production/runs/${id}/retry`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['runs'] }),
  });

  const cancelRun = useMutation({
    mutationFn: (id: string) => mutate('POST', `/production/runs/${id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['runs'] }),
  });

  const STAGES = [
    { id: 'RESEARCH', label: 'Riset', desc: 'Fakta & Sumber' },
    { id: 'SCRIPT', label: 'Naskah', desc: 'Narasi & Scene' },
    { id: 'FACT_CHECK', label: 'Cek Fakta', desc: 'Verifikasi Klaim' },
    { id: 'MOTION', label: 'Motion & Render', desc: 'Remotion Video' },
    { id: 'QC', label: 'QC', desc: 'Kualitas & Durasi' },
    { id: 'SOCIAL', label: 'Paket Sosial', desc: 'Caption & Cover' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-medium tracking-tight text-text">
              Status Produksi
            </h1>
            <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-bold text-blue-600 dark:text-blue-400">
              LIVE
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            Pantau proses otomatis setiap pipeline produksi video Anda secara langsung.
          </p>
        </div>
        <Button onClick={() => onNavigate('buat-konten')} size="sm">
          ＋ Tambah Produksi
        </Button>
      </div>

      {runs.isLoading && (
        <Card className="p-8 text-center text-muted">Memuat data produksi…</Card>
      )}

      {runs.data && runs.data.length === 0 && (
        <Card className="p-12 text-center space-y-3">
          <span className="text-4xl">⚡</span>
          <h3 className="font-display text-lg font-medium text-text">
            Belum ada antrean produksi berjalan
          </h3>
          <p className="text-sm text-muted max-w-md mx-auto">
            Semua proses produksi telah selesai atau belum ada pesanan baru.
          </p>
          <div className="pt-2">
            <Button onClick={() => onNavigate('buat-konten')}>
              Buat Konten Baru Sekarang
            </Button>
          </div>
        </Card>
      )}

      {runs.data && runs.data.length > 0 && (
        <div className="space-y-4">
          {runs.data.map((r) => (
            <Card key={r.id} className="p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted">
                      #{r.sequence || (r.id ? r.id.slice(0, 6) : '-')}
                    </span>
                    <Pill
                      ok={
                        r.status === 'COMPLETED'
                          ? true
                          : r.status === 'FAILED'
                          ? false
                          : null
                      }
                    >
                      {r.status}
                    </Pill>
                  </div>
                  <h3 className="font-display text-base font-semibold text-text">
                    {r.topic || 'Topik Edukasi Otomatis'}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {r.status === 'RUNNING' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelRun.mutate(r.id)}
                    >
                      Hentikan
                    </Button>
                  )}
                  {r.status === 'FAILED' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => retryRun.mutate(r.id)}
                    >
                      Ulangi
                    </Button>
                  )}
                  {r.status === 'COMPLETED' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onNavigate('hasil')}
                    >
                      Lihat Hasil →
                    </Button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted">
                  <span>Tahap aktif: <strong className="text-text">{r.currentStage || 'Antrean'}</strong></span>
                  <span className="font-mono font-bold text-accent">{r.progress || 0}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full bg-accent transition-all duration-300"
                    style={{ width: `${r.progress || 0}%` }}
                  />
                </div>
              </div>

              {/* Pipeline Stage Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-2 border-t border-line">
                {STAGES.map((s, idx) => {
                  const stageOrder = ['RESEARCH', 'SCRIPT', 'FACT_CHECK', 'MOTION', 'QC', 'SOCIAL'];
                  const currentIdx = stageOrder.indexOf(r.currentStage || '');
                  const isCompleted = r.status === 'COMPLETED' || (r.status === 'RUNNING' && currentIdx > idx);
                  const isActive = (r.status === 'RUNNING' && (r.currentStage === s.id || (currentIdx === -1 && idx === 0))) || (r.status === 'QUEUED' && idx === 0);
                  const isFailed = r.status === 'FAILED' && (r.currentStage === s.id || (currentIdx === -1 && idx === 0));

                  return (
                    <div
                      key={s.id}
                      className={clsx(
                        'rounded-lg border p-2 text-center transition-all',
                        isCompleted && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                        isActive && 'border-accent bg-accent/15 text-accent ring-2 ring-accent/30 font-semibold shadow-sm',
                        isFailed && 'border-red-500/40 bg-red-500/10 text-red-500 font-semibold',
                        !isCompleted && !isActive && !isFailed && 'border-line bg-surface-2/40 text-muted opacity-60',
                      )}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                        <span>0{idx + 1}</span>
                        {isCompleted && <span className="font-bold">✓</span>}
                        {isActive && <span className="inline-block size-2 rounded-full bg-accent animate-ping" />}
                        {isFailed && <span className="font-bold">✕</span>}
                      </div>
                      <span className="block text-xs font-semibold mt-0.5">{s.label}</span>
                      <span className="block text-[9px] text-muted truncate mt-0.5">{s.desc}</span>
                    </div>
                  );
                })}
              </div>

              {/* Real-time Activity Feed & Terminal Logs */}
              <RunActivitySection run={r} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
