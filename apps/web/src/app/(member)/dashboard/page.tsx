'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Card, Empty, ErrorNote, PageHead, Skeleton, Status } from '@/components/ui';

interface Dash {
  stats: { readyToUpload: number; inProduction: number; uploaded: number; failed: number };
  activeRuns: { id: string; status: string; currentStage: string | null; progress: number; topic: string | null }[];
  catalog: { publishedPresets: number; publishedVoices: number; publishedHooks: number };
  ai: { status: string; method: string | null };
  license: { status: string; activeDevices: number; entitlements: { maxWorkers: number; maxVideosPerDay: number } };
}
interface Cats {
  categories: { id: string; slug: string; name: string; presetCount: number }[];
  total: number;
}

const greet = () => {
  const h = new Date().getHours();
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
};

export default function DashboardPage() {
  const { data: s } = useSession();
  const [greeting, setGreeting] = useState('Selamat datang');
  useEffect(() => setGreeting(greet()), []);
  const dash = useQuery({ queryKey: ['me-dashboard'], queryFn: () => api<Dash>('/me/dashboard') });
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api<Cats>('/styles/categories'), staleTime: 15 * 60_000 });

  const stats = [
    { k: 'readyToUpload', label: 'Siap upload', href: '/results?tab=READY' },
    { k: 'inProduction', label: 'Sedang diproduksi', href: '/progress' },
    { k: 'uploaded', label: 'Diunggah', href: '/results?tab=UPLOADED' },
    { k: 'failed', label: 'Gagal', href: '/results?tab=FAILED' },
  ] as const;

  return (
    <>
      <PageHead
        eyebrow="Beranda"
        title={`${greeting}, ${s?.user.displayName.split(' ')[0] ?? ''}`}
        actions={<Link href="/create-content" className="inline-flex h-11 items-center rounded-[10px] bg-accent px-5 text-sm font-medium text-accent-contrast transition-transform active:scale-[0.98]">Buat konten baru</Link>}
      />
      {dash.isError && <ErrorNote error={dash.error} onRetry={() => dash.refetch()} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((st) => (
          <Link key={st.k} href={st.href} className="rounded-card border border-line bg-surface p-5 transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-text/30">
            <p className="text-sm text-muted">{st.label}</p>
            {dash.data ? <p className="num mt-3 text-4xl font-medium">{dash.data.stats[st.k]}</p> : <Skeleton className="mt-3 h-10 w-12" />}
          </Link>
        ))}
      </div>

      {!!dash.data?.activeRuns.length && (
        <Card className="mt-6 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-medium">Sedang diproduksi</h2>
            <Link href="/progress" className="text-sm underline">Lihat semua</Link>
          </div>
          <ul className="mt-4 grid gap-3">
            {dash.data.activeRuns.map((r) => (
              <li key={r.id}>
                <Link href={`/progress?run=${r.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                  <span className="truncate text-sm font-medium">{r.topic ?? 'Topik dipilih AI'}</span>
                  <span className="num font-mono text-xs text-muted">{r.currentStage ?? r.status} · {r.progress}%</span>
                  <span className="col-span-2 h-1 overflow-hidden rounded bg-surface-2"><span className="block h-full origin-left bg-accent transition-transform duration-500" style={{ transform: `scaleX(${r.progress / 100})` }} /></span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-medium">Mulai cepat</h2>
              <p className="mt-1 text-sm text-muted">Pesan konten dan produksi otomatis aktif setelah lisensi, koneksi Claude, dan katalog siap.</p>
            </div>
          </div>
          <ol className="mt-5 grid gap-2">
            <Check done={dash.data?.license.status === 'ACTIVE'} label="Lisensi nonkomersial aktif" href="/settings/license" />
            <Check done={dash.data?.ai.status === 'CONNECTED'} label="Claude terhubung" href="/settings/claude" />
            <Check done={(dash.data?.catalog.publishedPresets ?? 0) > 0} label="Preset gaya dipublikasikan Superadmin" />
            <Check done={(dash.data?.catalog.publishedVoices ?? 0) > 0} label="Suara narator dipublikasikan (opsional)" />
          </ol>
        </Card>
        <Card className="p-6">
          <h2 className="font-display text-xl font-medium">Status akun</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <Row k="Lisensi" v={dash.data ? <Status value={dash.data.license.status} /> : <Skeleton className="h-5 w-16" />} />
            <Row k="Perangkat aktif" v={<span className="num">{dash.data?.license.activeDevices ?? '—'}</span>} />
            <Row k="Worker maksimum" v={<span className="num">{dash.data?.license.entitlements.maxWorkers ?? '—'}</span>} />
            <Row k="Claude" v={dash.data ? <Status value={dash.data.ai.status} /> : <Skeleton className="h-5 w-16" />} />
          </dl>
        </Card>
      </div>

      <section className="mt-10" aria-labelledby="gallery-h">
        <div className="flex items-end justify-between pb-4">
          <h2 id="gallery-h" className="font-display text-xl font-medium">
            Katalog gaya <span className="num text-muted">· {cats.data?.total ?? 0} preset</span>
          </h2>
        </div>
        {cats.isError && <ErrorNote error={cats.error} onRetry={() => cats.refetch()} />}
        <div className="flex flex-wrap gap-2">
          {cats.data?.categories.map((c) => (
            <span key={c.id} data-chip className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm">
              {c.name}
              <span className="num text-xs text-muted">{c.presetCount}</span>
            </span>
          )) ?? Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}
        </div>
        {cats.data && cats.data.total === 0 && (
          <div className="mt-4">
            <Empty title="Katalog gaya masih kosong" body="Dua belas kategori sudah siap. Preset akan muncul di sini setelah Superadmin mengimpor dan mempublikasikannya." />
          </div>
        )}
      </section>
    </>
  );
}

function Check({ done, label, href }: { done?: boolean; label: string; href?: string }) {
  const body = (
    <span className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm">
      <span aria-hidden className={`grid size-5 place-items-center rounded-full border ${done ? 'border-ok bg-ok text-[oklch(16%_0_0)]' : 'border-line'}`}>
        {done ? '✓' : ''}
      </span>
      <span className={done ? 'text-muted line-through' : ''}>{label}</span>
      <span className="sr-only">{done ? 'selesai' : 'belum'}</span>
    </span>
  );
  return <li>{href && !done ? <Link href={href} className="block rounded-lg hover:bg-surface-2">{body}</Link> : body}</li>;
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-line pb-3 last:border-0">
      <dt className="text-muted">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
