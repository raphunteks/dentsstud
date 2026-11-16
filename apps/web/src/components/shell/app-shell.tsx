'use client';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Role } from '@dentweb/shared-types';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Mark, Skeleton, Status } from '@/components/ui';
import type { NavGroup } from './nav';

interface Dash {
  activeRuns: { id: string; currentStage: string | null; progress: number }[];
  ai: { status: string };
}

export function AppShell({ nav, children, requireRole, variant }: { nav: NavGroup[]; children: ReactNode; requireRole?: Role; variant: 'member' | 'admin' }) {
  const session = useSession();
  const router = useRouter();
  const path = usePathname();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const dash = useQuery({ queryKey: ['me-dashboard'], queryFn: () => api<Dash>('/me/dashboard'), enabled: session.isSuccess, refetchInterval: 15_000 });

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (session.isError) router.replace(`/login?next=${encodeURIComponent(path)}`);
    if (session.data && requireRole && session.data.user.role !== requireRole) router.replace('/dashboard');
  }, [session.isError, session.data, requireRole, router, path]);

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    qc.clear();
    router.replace('/login');
  }

  if (!session.data || (requireRole && session.data.user.role !== requireRole)) {
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy>
        <Skeleton className="h-8 w-40" />
      </div>
    );
  }
  const user = session.data.user;

  const sidebar = (
    <nav aria-label="Navigasi utama" className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-5">
      <Link href={variant === 'admin' ? '/admin' : '/dashboard'} className="px-2">
        <Mark />
        {variant === 'admin' && <span className="ml-8 mt-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-accent">Superadmin</span>}
      </Link>
      {nav.map((g) => (
        <div key={g.label} className="grid gap-0.5">
          <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{g.label}</p>
          {g.items.map((it) => {
            const active = path === it.href || (it.href !== '/admin' && it.href !== '/dashboard' && path.startsWith(it.href));
            return it.phase ? (
              <span key={it.href} aria-disabled className="flex h-9 cursor-not-allowed items-center justify-between rounded-lg px-2 text-sm text-muted/60" title={`Tersedia di Fase ${it.phase}`}>
                {it.label}
                <span className="font-mono text-[10px]">F{it.phase}</span>
              </span>
            ) : (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active ? 'page' : undefined}
                className={clsx('flex h-9 items-center rounded-lg px-2 text-sm transition-colors', active ? 'bg-surface-2 font-medium text-text' : 'text-muted hover:bg-surface-2/60 hover:text-text')}
              >
                {active && <span aria-hidden className="mr-2 h-4 w-0.5 rounded bg-accent" />}
                {it.label}
              </Link>
            );
          })}
        </div>
      ))}
      <div className="mt-auto grid gap-3">
        {variant === 'member' && (
          <div className="rounded-xl border border-line p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Produksi aktif</p>
            {dash.data?.activeRuns.length ? (
              dash.data.activeRuns.slice(0, 3).map((r) => (
                <div key={r.id} className="mt-2">
                  <div className="flex justify-between text-xs">
                    <span>{r.currentStage ?? 'Antre'}</span>
                    <span className="num">{r.progress}%</span>
                  </div>
                  <div className="mt-1 h-1 rounded bg-surface-2">
                    <div className="h-1 rounded bg-accent" style={{ width: `${r.progress}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="mt-1 text-xs text-muted">Belum ada produksi berjalan.</p>
            )}
          </div>
        )}
        <Link href="/settings/claude" className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-xs hover:bg-surface-2">
          <span>Claude</span>
          {dash.data ? <Status value={dash.data.ai.status} /> : <Skeleton className="h-4 w-16" />}
        </Link>
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.displayName}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <button onClick={logout} className="rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-text">
            Keluar
          </button>
        </div>
        {user.role === 'SUPERADMIN' && (
          <Link href={variant === 'admin' ? '/dashboard' : '/admin'} className="px-1 text-xs text-accent underline-offset-4 hover:underline">
            {variant === 'admin' ? 'Buka dashboard member' : 'Buka Superadmin'}
          </Link>
        )}
      </div>
    </nav>
  );

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[264px_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-surface lg:block">{sidebar}</aside>
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <Mark />
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-nav" className="h-11 rounded-lg border border-line px-3 text-sm">
          {open ? 'Tutup' : 'Menu'}
        </button>
      </div>
      {open && (
        <div id="mobile-nav" className="fixed inset-0 top-[61px] z-40 bg-surface lg:hidden">
          {sidebar}
        </div>
      )}
      <main id="main" className="min-w-0 px-4 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>
    </div>
  );
}
