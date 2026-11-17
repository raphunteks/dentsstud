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
    { id: 'RESEARCH', label: 'Riset' },
    { id: 'SCRIPT', label: 'Naskah' },
    { id: 'FACT_CHECK', label: 'Cek fakta' },
    { id: 'MOTION', label: 'Motion & render' },
    { id: 'QC', label: 'QC' },
    { id: 'SOCIAL', label: 'Paket sosial' },
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
                      #{r.sequence || r.id.slice(0, 6)}
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
                {STAGES.map((s, idx) => (
                  <div
                    key={s.id}
                    className="rounded-lg border border-line bg-surface-2/40 p-2 text-center"
                  >
                    <span className="block text-[10px] text-muted font-mono">0{idx + 1}</span>
                    <span className="block text-xs font-medium text-text mt-0.5">{s.label}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
