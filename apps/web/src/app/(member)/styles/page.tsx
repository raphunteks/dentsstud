'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { api } from '@/lib/api';
import { Empty, ErrorNote, Input, PageHead, Skeleton } from '@/components/ui';
import { Modal } from '@/components/ui/extra';

interface Cat { id: string; slug: string; name: string; presetCount: number }
interface Preset { id: string; name: string; description: string; thumbnailUrl: string | null; previewUrl: string | null; category: { name: string } }

export default function StylesGallery() {
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const [open, setOpen] = useState<Preset | null>(null);
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api<{ categories: Cat[]; total: number }>('/styles/categories') });
  const list = useQuery({ queryKey: ['presets', cat, dq], queryFn: () => api<{ items: Preset[] }>(`/styles/presets?limit=100${cat ? `&category=${cat}` : ''}${dq ? `&q=${encodeURIComponent(dq)}` : ''}`) });
  return (
    <>
      <PageHead eyebrow="Studio" title={`Galeri gaya · ${cats.data?.total ?? 0} preset`} />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button onClick={() => setCat('')} aria-pressed={!cat} className={`h-9 rounded-full border px-3 text-sm ${!cat ? 'border-text bg-text text-bg' : 'border-line bg-surface'}`}>Semua <span className="num opacity-70">{cats.data?.total ?? 0}</span></button>
        {cats.data?.categories.map((c) => (
          <button key={c.id} onClick={() => setCat(c.slug)} aria-pressed={cat === c.slug} className={`h-9 rounded-full border px-3 text-sm ${cat === c.slug ? 'border-text bg-text text-bg' : 'border-line bg-surface'}`}>
            {c.name} <span className="num opacity-70">{c.presetCount}</span>
          </button>
        ))}
        <Input aria-label="Cari gaya" placeholder="Cari gaya" value={q} onChange={(e) => setQ(e.target.value)} className="ml-auto h-9 max-w-xs" />
      </div>
      {list.isError && <ErrorNote error={list.error} onRetry={() => list.refetch()} />}
      {list.isLoading && <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-card" />)}</div>}
      {list.data?.items.length === 0 && <Empty title={cat ? 'Kategori ini masih kosong' : 'Katalog gaya masih kosong'} body="Preset akan muncul setelah Superadmin mengimpor dan mempublikasikannya." />}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {list.data?.items.map((p) => (
          <button key={p.id} onClick={() => setOpen(p)} className="group overflow-hidden rounded-card border border-line bg-surface text-left transition-transform hover:-translate-y-0.5">
            <div className="lit relative aspect-[3/4] overflow-hidden bg-surface-2">
              {p.thumbnailUrl ? (
                <img src={p.thumbnailUrl} alt={p.name} loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
              ) : null}
            </div>
            <div className="p-3"><p className="font-medium">{p.name}</p><p className="text-xs text-muted">{p.category.name}</p></div>
          </button>
        ))}
      </div>
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.name ?? ''}>
        {open && (
          <div className="grid gap-4">
            <div className="lit aspect-[9/16] max-h-[60vh] overflow-hidden rounded-xl bg-black">
              {open.previewUrl ? (
                <video
                  key={open.id}
                  src={open.previewUrl}
                  poster={open.thumbnailUrl ?? undefined}
                  controls
                  autoPlay
                  loop
                  playsInline
                  preload="auto"
                  className="size-full object-cover"
                />
              ) : open.thumbnailUrl ? (
                <img src={open.thumbnailUrl} alt={open.name} className="size-full object-cover" />
              ) : null}
            </div>
            <p className="text-sm text-muted">{open.description || open.category.name}</p>
            <Link
              href={`/create-content?preset=${encodeURIComponent(open.id)}`}
              className="inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-accent px-4 text-sm font-medium text-accent-contrast hover:brightness-110 transition"
            >
              Gunakan Gaya Ini →
            </Link>
          </div>
        )}
      </Modal>
    </>
  );
}
