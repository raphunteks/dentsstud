import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { get, mutate } from '../bridge';
import { Button, Card, Pill, errMsg } from '../components/UI';
import type { NavTab, RunItem } from '../types';

interface ProgressViewProps {
  onNavigate: (tab: NavTab) => void;
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
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
