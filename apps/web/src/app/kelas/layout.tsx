'use client';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Modal } from '@/components/ui/extra';
import { Input, Skeleton } from '@/components/ui';

const LMS_NAV = [
  { href: '/kelas', label: 'Beranda' },
  { href: '/kelas/materi', label: 'Kelas' },
  { href: '/kelas/racik', label: 'Racik Prompt' },
  { href: '/kelas/prompt', label: 'Koleksi Prompt' },
  { href: '/kelas/gaya', label: 'Resep Gaya' },
  { href: '/kelas/kamus', label: 'Kamus Motion' },
  { href: '/kelas/efek', label: 'Video Efek' },
  { href: '/kelas/update', label: 'Log Update' },
  { href: '/kelas/unduh', label: 'Download Skill' },
];

interface OverviewLite {
  stats: { completedLessons: number; totalLessons: number; percent: number };
  nextLesson: { slug: string; title: string } | null;
  modules: { id: string; title: string; lessons: { id: string; slug: string; title: string }[] }[];
}

export default function KelasLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthRoute = pathname === '/kelas/login' || pathname === '/kelas/register';
  const session = useSession();
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const [mobileNav, setMobileNav] = useState(false);

  const overviewQ = useQuery({
    queryKey: ['lms-overview'],
    enabled: !isAuthRoute && Boolean(session.data?.user),
    queryFn: () => api<OverviewLite>('/lms/overview'),
  });
  const promptsQ = useQuery({
    queryKey: ['lms-prompts-all'],
    enabled: searchOpen,
    queryFn: () => api<{ items: { id: string; title: string; stage: string }[] }>('/lms/prompts'),
  });
  const glossaryQ = useQuery({
    queryKey: ['lms-glossary-all'],
    enabled: searchOpen,
    queryFn: () => api<{ items: { id: string; term: string; category: string }[] }>('/lms/glossary'),
  });

  useEffect(() => {
    if (isAuthRoute) return;
    if (session.isFetched && !session.data?.user) {
      router.replace(`/kelas/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthRoute, session.isFetched, session.data, pathname, router]);

  useEffect(() => {
    if (isAuthRoute) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAuthRoute]);

  const searchHits = useMemo(() => {
    const term = q.trim().toLowerCase();
    const hits: { type: string; title: string; sub: string; href: string }[] = [];
    for (const m of overviewQ.data?.modules ?? []) {
      for (const l of m.lessons) {
        if (!term || `${l.title} ${m.title}`.toLowerCase().includes(term)) {
          hits.push({ type: 'Materi', title: l.title, sub: m.title, href: `/kelas/materi/${l.slug}` });
        }
      }
    }
    for (const p of promptsQ.data?.items ?? []) {
      if (!term || `${p.title} ${p.stage}`.toLowerCase().includes(term)) {
        hits.push({ type: 'Prompt', title: p.title, sub: p.stage, href: `/kelas/prompt?q=${encodeURIComponent(p.title)}` });
      }
    }
    for (const g of glossaryQ.data?.items ?? []) {
      if (!term || `${g.term} ${g.category}`.toLowerCase().includes(term)) {
        hits.push({ type: 'Kamus', title: g.term, sub: g.category, href: `/kelas/kamus?q=${encodeURIComponent(g.term)}` });
      }
    }
    return hits.slice(0, 14);
  }, [q, overviewQ.data, promptsQ.data, glossaryQ.data]);

  if (isAuthRoute) return <>{children}</>;
  if (session.isLoading || !session.data?.user) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <Skeleton className="h-96 rounded-card" />
      </div>
    );
  }

  const pct = overviewQ.data?.stats.percent ?? 0;
  const r = 13;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ - (pct / 100) * circ;
  const nextSlug = overviewQ.data?.nextLesson?.slug;

  const navContent = (
    <div className="flex h-full flex-col justify-between p-4">
      <div className="space-y-5">
        <Link href="/kelas" className="flex items-center gap-2.5 px-2">
          <img src="/logo.svg" alt="DENTSWEB MOTION" className="h-8 w-8 rounded-lg object-contain" />
          <div className="min-w-0">
            <p className="truncate text-xs font-bold tracking-tight">DENTSWEB MOTION</p>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted">LMS Kelas Member</p>
          </div>
        </Link>

        <div className="space-y-1">
          <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted">BELAJAR</p>
          {LMS_NAV.map((it) => {
            const active = it.href === '/kelas' ? pathname === '/kelas' : pathname.startsWith(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => setMobileNav(false)}
                className={clsx(
                  'block rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-accent text-accent-contrast' : 'text-text hover:bg-surface-2',
                )}
              >
                {it.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 border-t border-line pt-3">
        <Link
          href="/dashboard"
          className="block rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-center text-xs font-medium hover:bg-surface-2"
        >
          ← Kembali ke Studio
        </Link>
        {session.data.user.role === 'SUPERADMIN' && (
          <Link
            href="/admin/lms"
            className="block rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-center text-xs font-medium text-accent hover:bg-accent/15"
          >
            Kelola LMS (Superadmin)
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-surface lg:block z-30">{navContent}</aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileNav((o) => !o)}
              className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium lg:hidden"
            >
              {mobileNav ? 'Tutup' : 'Menu'}
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-9 w-56 items-center justify-between rounded-xl border border-line bg-surface-2/60 px-3 text-xs text-muted hover:text-text sm:w-72"
            >
              <span>Cari materi, prompt, kamus...</span>
              <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2" title={`Progres belajar ${pct}%`}>
              <svg className="h-8 w-8 -rotate-90" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-surface-2" />
                <circle
                  cx="16"
                  cy="16"
                  r={r}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray={circ}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  className="text-accent transition-all duration-300"
                />
              </svg>
              <span className="hidden font-mono text-xs font-semibold sm:inline">{pct}%</span>
            </div>

            {nextSlug && (
              <Link
                href={`/kelas/materi/${nextSlug}`}
                className="inline-flex h-9 items-center rounded-xl bg-accent px-3.5 text-xs font-semibold text-accent-contrast hover:opacity-95"
              >
                Lanjut belajar →
              </Link>
            )}
          </div>
        </header>

        {mobileNav && (
          <div className="fixed inset-0 top-[57px] z-40 bg-surface lg:hidden">{navContent}</div>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">
          <div className="mx-auto max-w-[1160px]">{children}</div>
        </main>
      </div>

      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Cari di DENTSWEB MOTION LMS (⌘K)">
        <div className="grid gap-3">
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ketik kata kunci materi, prompt, atau istilah..." />
          <div className="max-h-72 divide-y divide-line overflow-y-auto">
            {searchHits.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">Tidak ditemukan hasil untuk "{q}".</p>
            ) : (
              searchHits.map((h, i) => (
                <Link
                  key={`${h.href}-${i}`}
                  href={h.href}
                  onClick={() => setSearchOpen(false)}
                  className="flex items-center justify-between gap-2 py-2.5 text-xs hover:bg-surface-2/60 px-2 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-text">{h.title}</p>
                    <p className="text-[11px] text-muted">{h.sub}</p>
                  </div>
                  <span className="rounded bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase text-muted">{h.type}</span>
                </Link>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
