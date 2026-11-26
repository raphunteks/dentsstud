import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { get, toMediaUrl } from '../bridge';
import { Card, Input, Modal, Button } from '../components/UI';
import { Icon } from '../components/Icons';
import type { NavTab } from '../types';

interface Cat {
  id: string;
  slug: string;
  name: string;
  presetCount: number;
}

interface Preset {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  category: { name: string; slug?: string };
}

interface GaleriGayaViewProps {
  onNavigate: (tab: NavTab, opts?: { presetId?: string }) => void;
}

export function GaleriGayaView({ onNavigate }: GaleriGayaViewProps) {
  const [activeCat, setActiveCat] = useState('');
  const [search, setSearch] = useState('');
  const dq = useDeferredValue(search);
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);

  const cats = useQuery({
    queryKey: ['categories'],
    queryFn: () => get<{ categories: Cat[]; total: number }>('/styles/categories').catch(() => ({ categories: [], total: 0 })),
  });

  const list = useQuery({
    queryKey: ['presets', activeCat, dq],
    queryFn: () =>
      get<{ items: Preset[] }>(
        `/styles/presets?limit=100${activeCat ? `&category=${activeCat}` : ''}${dq ? `&q=${encodeURIComponent(dq)}` : ''}`
      ).catch(() => ({ items: [] })),
  });

  const items = list.data?.items ?? [];
  const totalPresets = cats.data?.total ?? items.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted font-mono">KATALOG STUDIO</p>
          <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
            Galeri Gaya Visual
          </h1>
          <p className="mt-1 text-sm text-muted">
            Katalog preset komposisi motion graphic siap pakai untuk Reels & TikTok 9:16.
          </p>
        </div>
        <div className="w-full sm:w-72">
          <Input
            placeholder="Cari gaya..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 text-xs"
          />
        </div>
      </div>

      {/* Categories Filter Tabs (Real categories from DB) */}
      <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveCat('')}
          className={clsx(
            'rounded-full border px-3.5 py-1 text-xs transition cursor-pointer',
            !activeCat
              ? 'border-accent bg-accent text-accent-contrast font-semibold shadow-xs'
              : 'border-line bg-surface text-muted hover:text-text'
          )}
        >
          Semua <span className="opacity-70 ml-1 font-mono">{totalPresets}</span>
        </button>
        {cats.data?.categories?.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.slug)}
            className={clsx(
              'rounded-full border px-3.5 py-1 text-xs transition cursor-pointer',
              activeCat === c.slug
                ? 'border-accent bg-accent text-accent-contrast font-semibold shadow-xs'
                : 'border-line bg-surface text-muted hover:text-text'
            )}
          >
            {c.name} <span className="opacity-70 ml-1 font-mono">{c.presetCount}</span>
          </button>
        ))}
      </div>

      {/* Loading Skeleton */}
      {list.isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-surface-2 border border-line" />
          ))}
        </div>
      )}

      {/* Empty State matching Web */}
      {!list.isLoading && items.length === 0 && (
        <div className="rounded-2xl border border-line bg-surface p-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-muted">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="font-display text-lg font-medium text-text">
            {activeCat ? 'Kategori ini masih kosong' : 'Katalog gaya masih kosong'}
          </h3>
          <p className="mt-2 text-xs text-muted max-w-md mx-auto">
            Preset akan muncul setelah Superadmin mengimpor dan mempublikasikannya melalui Import Folder atau CMS.
          </p>
        </div>
      )}

      {/* Style Grid */}
      {!list.isLoading && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {items.map((item) => (
            <Card
              key={item.id}
              onClick={() => setSelectedPreset(item)}
              className="group relative cursor-pointer overflow-hidden p-0 hover:border-accent hover:shadow-md transition-all duration-200"
            >
              {/* Visual Preview / Video or Thumbnail */}
              <div className="relative aspect-[3/4] w-full bg-gradient-to-br from-neutral-800 to-neutral-900 flex flex-col justify-between p-3 text-white overflow-hidden">
                {item.thumbnailUrl ? (
                  <img
                    src={toMediaUrl(item.thumbnailUrl)}
                    alt={item.name}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : null}
                <div className="relative z-10 flex items-center justify-between">
                  <span className="rounded bg-black/60 px-2 py-0.5 text-[9px] uppercase font-semibold text-white/90">
                    {item.category?.name || 'Gaya'}
                  </span>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white">
                    <Icon name="play" className="w-2.5 h-2.5 fill-current ml-0.5" />
                  </span>
                </div>
                <div className="relative z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 -mx-3 -mb-3 pt-6">
                  <p className="font-display text-sm font-bold group-hover:text-accent transition-colors leading-tight">
                    {item.name}
                  </p>
                  <p className="text-[10px] opacity-75 line-clamp-2 mt-1">
                    {item.description || item.category?.name}
                  </p>
                </div>
              </div>
              <div className="p-3 bg-surface border-t border-line">
                <span className="text-xs font-semibold text-accent group-hover:underline">
                  Lihat Detail & Pakai →
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <Modal
        open={!!selectedPreset}
        onClose={() => setSelectedPreset(null)}
        title={selectedPreset?.name ?? ''}
      >
        {selectedPreset && (
          <div className="space-y-4">
            <div className="relative aspect-[9/16] max-h-[50vh] mx-auto w-full max-w-xs rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-950 flex items-center justify-center overflow-hidden">
              {selectedPreset.previewUrl ? (
                <video
                  key={selectedPreset.id}
                  src={toMediaUrl(selectedPreset.previewUrl)}
                  poster={selectedPreset.thumbnailUrl ? toMediaUrl(selectedPreset.thumbnailUrl) : undefined}
                  controls
                  autoPlay
                  loop
                  playsInline
                  preload="auto"
                  className="size-full object-cover"
                />
              ) : selectedPreset.thumbnailUrl ? (
                <img
                  src={toMediaUrl(selectedPreset.thumbnailUrl)}
                  alt={selectedPreset.name}
                  className="size-full object-cover"
                />
              ) : (
                <div className="p-6 text-center text-muted">
                  <p className="font-display text-lg font-bold text-text">{selectedPreset.name}</p>
                  <p className="text-xs mt-1 uppercase">{selectedPreset.category?.name}</p>
                </div>
              )}
            </div>
            <p className="text-sm text-text leading-relaxed">
              {selectedPreset.description || selectedPreset.category?.name}
            </p>
            <div className="pt-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSelectedPreset(null)}>
                Tutup
              </Button>
              <Button
                onClick={() => {
                  const pid = selectedPreset.id;
                  setSelectedPreset(null);
                  onNavigate('buat-konten', { presetId: pid });
                }}
              >
                Gunakan Gaya Ini di Pesanan
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}