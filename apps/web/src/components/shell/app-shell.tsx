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
import {
  IconHome,
  IconCreate,
  IconProgress,
  IconResults,
  IconStyles,
  IconVoices,
  IconStudio,
  IconClaude,
  IconLicense,
  IconSettings,
  IconHelp,
  IconUsers,
  IconSystem,
  IconAnalytics,
  IconWorkflow,
  IconReleases,
  IconSupport,
  IconUser,
  IconChevronDown,
  IconChevronRight,
  IconPanelToggle,
} from './icons';

interface Dash {
  activeRuns: { id: string; currentStage: string | null; progress: number }[];
  ai: { status: string };
}

interface NavEntry {
  href: string;
  label: string;
  icon: typeof IconHome;
  badge?: string;
  phase?: number;
}

interface NavSection {
  id: string;
  label: string;
  items: NavEntry[];
  superadminOnly?: boolean;
}

export function AppShell({
  children,
  requireRole,
  variant,
}: {
  children: ReactNode;
  requireRole?: Role;
  variant: 'member' | 'admin';
  nav?: unknown;
}) {
  const session = useSession();
  const router = useRouter();
  const path = usePathname();
  const qc = useQueryClient();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Accordion open/close state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    utama: true,
    produksi: true,
    studio: true,
    admin: true,
    pengaturan: true,
  });

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const dash = useQuery({
    queryKey: ['me-dashboard'],
    queryFn: () => api<Dash>('/me/dashboard'),
    enabled: session.isSuccess,
    refetchInterval: 15_000,
  });

  useEffect(() => setMobileOpen(false), [path]);

  useEffect(() => {
    if (session.isError) {
      if (typeof document !== 'undefined') {
        document.cookie = 'dw_auth=; Max-Age=0; path=/;';
        document.cookie = 'dw_sid=; Max-Age=0; path=/;';
      }
      qc.clear();
      router.replace(`/login?next=${encodeURIComponent(path)}`);
    }
    if (session.data && requireRole && session.data.user.role !== requireRole) router.replace('/dashboard');
  }, [session.isError, session.data, requireRole, router, path, qc]);

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    if (typeof document !== 'undefined') {
      document.cookie = 'dw_auth=; Max-Age=0; path=/;';
      document.cookie = 'dw_sid=; Max-Age=0; path=/;';
    }
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
  const isSuperadmin = user.role === 'SUPERADMIN';

  const sections: NavSection[] = [
    {
      id: 'utama',
      label: 'UTAMA',
      items: [{ href: isSuperadmin && variant === 'admin' ? '/admin' : '/dashboard', label: 'Beranda', icon: IconHome }],
    },
    {
      id: 'produksi',
      label: 'PRODUKSI',
      items: [
        { href: '/create-content', label: 'Buat Konten', icon: IconCreate },
        { href: '/progress', label: 'Progress', icon: IconProgress, badge: 'LIVE' },
        { href: '/results', label: 'Hasil', icon: IconResults },
      ],
    },
    {
      id: 'studio',
      label: 'STUDIO',
      items: [
        { href: '/styles', label: 'Galeri Gaya', icon: IconStyles },
        { href: '/voices', label: 'Suara', icon: IconVoices },
        { href: '/studio/projects', label: 'Motion Editor', icon: IconStudio },
        { href: '/studio/render', label: 'Render Center', icon: IconSystem },
      ],
    },
    ...(isSuperadmin
      ? [
          {
            id: 'admin',
            label: 'ADMINISTRASI',
            superadminOnly: true,
            items: [
              { href: '/admin/members', label: 'Member & Akses', icon: IconUsers },
              { href: '/admin/licenses', label: 'Lisensi & Device', icon: IconLicense },
              { href: '/admin/ai-providers', label: 'AI Provider & OAuth', icon: IconClaude },
              { href: '/admin/workflows', label: 'Workflow Engine', icon: IconWorkflow },
              { href: '/admin/production', label: 'Antrean Produksi', icon: IconProgress },
              { href: '/admin/quotas', label: 'Kuota & Limit', icon: IconAnalytics },
              { href: '/admin/system', label: 'Sistem & VPS', icon: IconSystem },
              { href: '/admin/releases', label: 'Rilis Desktop', icon: IconReleases },
              { href: '/admin/support', label: 'Tiket Support', icon: IconSupport },
            ],
          },
        ]
      : []),
    {
      id: 'pengaturan',
      label: 'PENGATURAN',
      items: [
        { href: '/settings/claude', label: 'Koneksi Claude AI', icon: IconClaude },
        { href: '/settings/license', label: 'Lisensi Saya', icon: IconLicense },
        { href: '/settings/brand', label: 'Brand & Watermark', icon: IconSettings },
        { href: '/help', label: 'Bantuan & FAQ', icon: IconHelp },
      ],
    },
  ];

  const sidebarContent = (
    <div className={clsx('flex h-full flex-col justify-between py-4 select-none', collapsed ? 'px-2' : 'px-3')}>
      {/* HEADER: Brand & Toggle */}
      <div>
        <div className={clsx('flex items-center pb-4 border-b border-line', collapsed ? 'justify-center' : 'justify-between px-2')}>
          {!collapsed ? (
            <Link href={isSuperadmin && variant === 'admin' ? '/admin' : '/dashboard'} className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-md font-bold">
                D
              </div>
              <div>
                <span className="block font-display font-semibold tracking-tight text-sm text-text leading-tight">
                  DENTSWEB STUDIO
                </span>
                <span className="block text-[10px] text-muted leading-tight">
                  {variant === 'admin' ? 'Superadmin Portal' : 'Motion Studio'}
                </span>
              </div>
            </Link>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-md font-bold">
              D
            </div>
          )}

          {/* Desktop Toggle Button (Gambar 4) */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
            title={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
            className="hidden lg:flex h-8 w-8 items-center justify-center rounded-xl border border-line text-muted hover:bg-surface-2 hover:text-text transition-colors shadow-2xs"
          >
            <IconPanelToggle className="h-4 w-4" collapsed={collapsed} />
          </button>
        </div>

        {/* ACCORDION NAVIGATION SECTIONS */}
        <div className="mt-4 space-y-4 overflow-y-auto max-h-[calc(100vh-210px)] pr-1">
          {sections.map((sec) => {
            const isOpen = !!openSections[sec.id];
            return (
              <div key={sec.id} className="space-y-1">
                {/* SECTION ACCORDION HEADER (Gambar 2 & 3) */}
                {!collapsed ? (
                  <button
                    onClick={() => toggleSection(sec.id)}
                    className="flex w-full items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted hover:text-text transition-colors"
                  >
                    <span>{sec.label}</span>
                    <span className="text-muted/70">
                      {isOpen ? <IconChevronDown className="h-3 w-3" /> : <IconChevronRight className="h-3 w-3" />}
                    </span>
                  </button>
                ) : (
                  <div className="my-2 border-t border-line/60" />
                )}

                {/* ITEMS */}
                {(collapsed || isOpen) && (
                  <div className="space-y-0.5">
                    {sec.items.map((it) => {
                      const Icon = it.icon;
                      const active =
                        path === it.href ||
                        (it.href !== '/admin' && it.href !== '/dashboard' && path.startsWith(it.href));

                      if (collapsed) {
                        return (
                          <Link
                            key={it.href}
                            href={it.href}
                            title={it.label}
                            className={clsx(
                              'relative flex h-10 w-10 mx-auto items-center justify-center rounded-xl transition-all',
                              active
                                ? 'bg-primary text-white shadow-md scale-105'
                                : 'text-muted hover:bg-surface-2 hover:text-text'
                            )}
                          >
                            <Icon className="h-5 w-5" />
                            {it.badge && (
                              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                              </span>
                            )}
                          </Link>
                        );
                      }

                      return (
                        <Link
                          key={it.href}
                          href={it.href}
                          className={clsx(
                            'group flex h-10 items-center justify-between rounded-xl px-3 text-sm transition-all',
                            active
                              ? 'bg-primary text-white font-medium shadow-md shadow-primary/20'
                              : 'text-muted hover:bg-surface-2 hover:text-text'
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Icon className={clsx('h-4 w-4 shrink-0 transition-transform group-hover:scale-110', active ? 'text-white' : 'text-muted')} />
                            <span className="truncate">{it.label}</span>
                          </div>
                          {it.badge && (
                            <span
                              className={clsx(
                                'rounded-full px-2 py-0.5 text-[10px] font-bold leading-none uppercase',
                                it.badge === 'LIVE'
                                  ? active
                                    ? 'bg-white/20 text-white'
                                    : 'bg-accent/15 text-accent animate-pulse'
                                  : active
                                  ? 'bg-white/20 text-white'
                                  : 'bg-surface-2 text-muted'
                              )}
                            >
                              {it.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* FOOTER: User Card (Gambar 2 & 3) */}
      <div className={clsx('pt-3 border-t border-line space-y-2', collapsed ? 'px-0' : 'px-2')}>
        {/* Active Production Banner (Member) */}
        {!collapsed && variant === 'member' && dash.data?.activeRuns.length ? (
          <div className="rounded-xl border border-line bg-surface-2/40 p-2 text-xs">
            <div className="flex justify-between items-center text-[11px] text-muted">
              <span>{dash.data.activeRuns[0].currentStage ?? 'Produksi'}</span>
              <span className="font-mono">{dash.data.activeRuns[0].progress}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${dash.data.activeRuns[0].progress}%` }}
              />
            </div>
          </div>
        ) : null}

        {/* User Card */}
        <div className={clsx('flex items-center gap-2', collapsed ? 'justify-center' : 'justify-between')}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 border border-line font-bold text-xs uppercase text-primary">
              {user.displayName?.substring(0, 2) || 'DW'}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-text">{user.displayName}</p>
                <span className="inline-block rounded bg-primary/10 px-1.5 py-0.2 text-[9px] font-bold uppercase text-primary">
                  {user.role}
                </span>
              </div>
            )}
          </div>

          {!collapsed && (
            <button
              onClick={logout}
              title="Keluar"
              className="rounded-lg p-1.5 text-muted hover:bg-bad/10 hover:text-bad transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>

        {/* Superadmin / Member portal switcher */}
        {!collapsed && isSuperadmin && (
          <Link
            href={variant === 'admin' ? '/dashboard' : '/admin'}
            className="block text-center rounded-lg border border-line/60 bg-surface-2/40 py-1 text-[11px] font-medium text-accent hover:bg-surface-2 transition-colors"
          >
            {variant === 'admin' ? '← Dashboard Member' : 'Buka Superadmin Portal →'}
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={clsx(
        'lg:grid lg:min-h-dvh transition-all duration-300',
        collapsed ? 'lg:grid-cols-[68px_1fr]' : 'lg:grid-cols-[260px_1fr]'
      )}
    >
      {/* DESKTOP SIDEBAR */}
      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-surface lg:block z-30">
        {sidebarContent}
      </aside>

      {/* MOBILE BAR */}
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold text-xs">
            D
          </div>
          <span className="font-semibold text-sm">DENTSWEB STUDIO</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium"
        >
          {mobileOpen ? 'Tutup' : 'Menu'}
        </button>
      </div>

      {/* MOBILE DRAWER */}
      {mobileOpen && (
        <div className="fixed inset-0 top-[57px] z-40 bg-surface/95 backdrop-blur-md lg:hidden">
          {sidebarContent}
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main id="main" className="min-w-0 px-4 py-6 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-[1240px]">{children}</div>
      </main>
    </div>
  );
}
