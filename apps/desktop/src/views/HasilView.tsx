import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';
import { get, mutate } from '../bridge';
import { Button, Card, Pill } from '../components/UI';
import type { NavTab, ResultItem } from '../types';

interface HasilViewProps {
  onNavigate: (tab: NavTab) => void;
}

export function HasilView({ onNavigate }: HasilViewProps) {
  const qc = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState<'READY' | 'UPLOADED' | 'FAILED' | 'ALL' | 'TRASH'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const results = useQuery({
    queryKey: ['results', activeSubTab],
    queryFn: () => get<ResultItem[]>(`/results?tab=${activeSubTab}`).catch(() => []),
  });

  const markUploaded = useMutation({
    mutationFn: (id: string) => mutate('POST', `/results/${id}/mark-uploaded`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['results'] }),
  });

  const copyCaption = (id: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const SUB_TABS = [
    { id: 'READY', label: 'Siap upload' },
    { id: 'UPLOADED', label: 'Diunggah' },
    { id: 'FAILED', label: 'Gagal' },
    { id: 'ALL', label: 'Semua' },
    { id: 'TRASH', label: 'Sampah' },
  ];

  // Real items fetched from backend API (PostgreSQL/Upstash)
  const displayItems = results.data ?? [];

  const filteredItems = displayItems.filter((it) => {
    if (activeSubTab === 'ALL') return true;
    if (activeSubTab === 'READY') return it.status === 'READY';
    if (activeSubTab === 'UPLOADED') return it.status === 'UPLOADED';
    if (activeSubTab === 'FAILED') return it.status === 'FAILED';
    if (activeSubTab === 'TRASH') return it.deletedAt !== null;
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-widest text-muted font-mono">PERPUSTAKAAN</p>
        <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
          Hasil Produksi Video
        </h1>
        <p className="mt-1 text-sm text-muted">
          Klik video untuk memutar, menyalin caption media sosial, atau menandai video sudah diunggah.
        </p>
      </div>

      {/* Sub Tabs Pill Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-line bg-surface p-1 shadow-xs">
          {SUB_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveSubTab(t.id as typeof activeSubTab)}
              className={clsx(
                'rounded-full px-4 py-1.5 text-xs font-medium transition cursor-pointer',
                activeSubTab === t.id
                  ? 'bg-accent text-accent-contrast shadow-xs font-semibold'
                  : 'text-muted hover:text-text'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Button size="sm" onClick={() => onNavigate('buat-konten')}>
          ＋ Buat Konten Baru
        </Button>
      </div>

      {results.isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-[9/16] rounded-xl bg-surface-2 animate-pulse border border-line" />
          ))}
        </div>
      )}

      {!results.isLoading && filteredItems.length === 0 && (
        <Card className="p-12 text-center space-y-3">
          <p className="font-display text-base font-medium text-text">
            {activeSubTab === 'TRASH'
              ? 'Sampah kosong'
              : activeSubTab === 'FAILED'
              ? 'Tidak ada produksi gagal'
              : 'Belum ada video di sini'}
          </p>
          <p className="text-xs text-muted max-w-sm mx-auto">
            {activeSubTab === 'READY'
              ? 'Video yang lolos QC muncul di sini lengkap dengan caption, hashtag, dan cover.'
              : 'Video berpindah tab sesuai statusnya.'}
          </p>
          {activeSubTab === 'READY' && (
            <div className="pt-2">
              <Button size="sm" onClick={() => onNavigate('buat-konten')}>
                ＋ Buat Konten Sekarang
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* 9:16 Video Card Grid Matching Motion Lab Screenshot */}
      {!results.isLoading && filteredItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredItems.map((item) => (
          <Card
            key={item.id}
            className="group relative flex flex-col overflow-hidden p-0 hover:border-text/30 transition-all shadow-xs"
          >
            {/* 9:16 Thumbnail Container */}
            <div className="relative aspect-[9/16] w-full bg-gradient-to-br from-neutral-800 to-neutral-900 overflow-hidden">
              {item.coverUrl ? (
                <img
                  src={item.coverUrl}
                  alt={item.title}
                  className="size-full object-cover group-hover:scale-102 transition duration-300"
                />
              ) : (
                <div className="flex size-full flex-col justify-between p-4 text-white">
                  <div className="flex items-center justify-between">
                    <span
                      className={clsx(
                        'rounded-full px-2.5 py-0.5 text-[10px] font-semibold',
                        item.status === 'UPLOADED'
                          ? 'bg-emerald-500/80 text-white'
                          : item.status === 'READY'
                          ? 'bg-blue-500/80 text-white'
                          : 'bg-red-500/80 text-white'
                      )}
                    >
                      • {item.status === 'UPLOADED' ? 'Diunggah' : item.status === 'READY' ? 'Siap upload' : 'Gagal'}
                    </span>
                    <span className="text-xs opacity-75">9:16</span>
                  </div>

                  <div className="space-y-2">
                    <span className="inline-block rounded bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
                      KITA BONGKAR
                    </span>
                    <h4 className="font-display text-sm font-bold leading-tight line-clamp-3">
                      {item.title}
                    </h4>
                  </div>

                  <div className="text-[10px] opacity-75 font-mono">
                    {new Date(item.createdAt).toLocaleDateString('id-ID', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Video Meta & Actions */}
            <div className="p-4 space-y-3 flex-1 flex flex-col justify-between bg-surface">
              <div>
                <p className="text-xs font-semibold text-text line-clamp-2">
                  {item.title}
                </p>
                <p className="text-[11px] text-muted line-clamp-2 mt-1">
                  {item.captionPreview}
                </p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-line">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => copyCaption(item.id, item.captionPreview)}
                >
                  {copiedId === item.id ? '✓ Caption Tersalin!' : '📋 Salin Caption'}
                </Button>

                {item.status === 'READY' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => markUploaded.mutate(item.id)}
                  >
                    ✓ Tandai Diunggah
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
        </div>
      )}
    </div>
  );
}
