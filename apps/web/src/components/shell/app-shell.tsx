'use client';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Role } from '@dentweb/shared-types';
import { api, fmtDate } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Skeleton } from '@/components/ui';
import { ADMIN_NAV, MEMBER_NAV, type NavGroup } from './nav';
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
  IconChevronDown,
  IconChevronRight,
  IconPanelToggle,
} from './icons';

interface Dash {
  activeRuns: { id: string; currentStage: string | null; progress: number }[];
  ai: { status: string };
}

interface NotificationItem {
  id: string;
  type?: string;
  title?: string;
  body?: string;
  message?: string;
  payload?: Record<string, unknown>;
  isRead?: boolean;
  readAt?: string | null;
  createdAt?: string;
  actionTab?: string | null;
  targetId?: string | null;
}

function notifHref(n: NotificationItem): string | null {
  if (n.actionTab === 'hasil') return n.targetId ? `/results/${n.targetId}` : '/results';
  if (n.actionTab === 'progress') return n.targetId ? `/progress?run=${n.targetId}` : '/progress';
  if (n.actionTab === 'bantuan') return '/help';
  if (n.actionTab === 'pengaturan') return n.type?.startsWith('license.') ? '/settings/license' : '/settings/production';
  return null;
}

function notifTitle(n: NotificationItem): string {
  if (n.title?.trim()) return n.title.trim();
  if (n.type) return n.type.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return 'Pemberitahuan';
}

function notifBody(n: NotificationItem): string {
  if (n.body?.trim()) return n.body.trim();
  if (n.message?.trim()) return n.message.trim();
  const p = n.payload;
  if (p && typeof p.message === 'string' && p.message.trim()) return p.message.trim();
  return '';
}

const ROUTE_ICONS: Record<string, typeof IconHome> = {
  '/dashboard': IconHome,
  '/create-content': IconCreate,
  '/progress': IconProgress,
  '/results': IconResults,
  '/styles': IconStyles,
  '/voices': IconVoices,
  '/studio/projects': IconStudio,
  '/studio/render': IconSystem,
  '/settings/claude': IconClaude,
  '/settings/voice-accounts': IconVoices,
  '/settings/brand': IconSettings,
  '/settings/production': IconProgress,
  '/settings/license': IconLicense,
  '/settings/about': IconReleases,
  '/help': IconHelp,
  '/admin': IconHome,
  '/admin/members': IconUsers,
  '/admin/licenses': IconLicense,
  '/admin/content': IconStyles,
  '/admin/content/import': IconCreate,
  '/admin/voices': IconVoices,
  '/admin/ai-providers': IconClaude,
  '/admin/workflows': IconWorkflow,
  '/admin/production': IconProgress,
  '/admin/results': IconResults,
  '/admin/quotas': IconAnalytics,
  '/admin/releases': IconReleases,
  '/admin/support': IconSupport,
  '/admin/analytics': IconAnalytics,
  '/admin/system': IconSystem,
};

function ThemeIcon({ dark }: { dark: boolean }) {
  return dark ? (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
    </svg>
  ) : (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

function NotificationBell({ collapsed }: { collapsed?: boolean }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pushPerm, setPushPerm] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('unsupported');
  const popRef = useRef<HTMLDivElement>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      try {
        const res = await api<NotificationItem[] | { items?: NotificationItem[] }>('/notifications');
        const list = Array.isArray(res) ? res : (res?.items ?? []);
        for (const item of list) seenIdsRef.current.add(item.id);
        return list;
      } catch {
        return [] as NotificationItem[];
      }
    },
    refetchInterval: 30_000,
    retry: false,
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPerm(window.Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    let closed = false;
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      es = new EventSource('/api/v1/notifications/stream', { withCredentials: true });
      es.addEventListener('notification', (ev) => {
        try {
          const item = JSON.parse((ev as MessageEvent).data) as NotificationItem;
          if (!item?.id) return;
          const isNew = !seenIdsRef.current.has(item.id);
          seenIdsRef.current.add(item.id);
          qc.setQueryData<NotificationItem[]>(['notifications'], (prev = []) => [item, ...prev.filter((x) => x.id !== item.id)].slice(0, 50));
          if (isNew && 'Notification' in window && window.Notification.permission === 'granted') {
            const push = new window.Notification(notifTitle(item), { body: notifBody(item) || undefined });
            const href = notifHref(item);
            push.onclick = () => {
              window.focus();
              if (href) router.push(href);
            };
          }
        } catch {
          // ignore malformed SSE event
        }
      });
      es.onerror = () => {
        es?.close();
        if (!closed) retryTimer = setTimeout(connect, 10_000);
      };
    };

    connect();
    return () => {
      closed = true;
      es?.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [qc, router]);

  const markRead = useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAll = useMutation({
    mutationFn: () => api('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const items = q.data ?? [];
  const unread = items.filter((n) => !(n.isRead || n.readAt)).length;

  const enablePush = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const perm = await window.Notification.requestPermission();
    setPushPerm(perm);
  };

  return (
    <div ref={popRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifikasi"
        title="Notifikasi"
        className="relative rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-text transition-colors cursor-pointer"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-bad px-1 text-[9px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={clsx(
            'absolute z-50 w-80 max-w-[calc(100vw-32px)] rounded-2xl border border-line bg-surface p-3 shadow-xl',
            collapsed ? 'bottom-0 left-12' : 'bottom-10 left-0',
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
            <span className="text-xs font-semibold text-text">Notifikasi ({unread})</span>
            <div className="flex items-center gap-2">
              {pushPerm === 'default' && (
                <button
                  type="button"
                  onClick={() => void enablePush()}
                  className="text-[11px] font-medium text-muted hover:text-text cursor-pointer"
                >
                  Aktifkan Push
                </button>
              )}
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => markAll.mutate()}
                  disabled={markAll.isPending}
                  className="text-[11px] font-medium text-accent hover:underline cursor-pointer"
                >
                  Tandai semua dibaca
                </button>
              )}
            </div>
          </div>
          <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto text-xs">
            {items.length === 0 && <li className="py-6 text-center text-muted">Belum ada notifikasi.</li>}
            {items.map((n) => {
              const isRead = Boolean(n.isRead || n.readAt);
              const href = notifHref(n);
              const title = notifTitle(n);
              const body = notifBody(n);
              return (
                <li
                  key={n.id}
                  onClick={() => {
                    if (!isRead) markRead.mutate(n.id);
                    if (href) {
                      setOpen(false);
                      router.push(href);
                    }
                  }}
                  className={clsx(
                    'rounded-xl border p-2.5 transition-colors',
                    href && 'cursor-pointer hover:bg-surface-2/60',
                    isRead ? 'border-line/50 bg-surface text-muted' : 'border-accent/30 bg-accent/5 text-text',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium leading-snug text-text">{title}</p>
                    {!isRead && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markRead.mutate(n.id);
                        }}
                        className="shrink-0 text-[10px] text-accent hover:underline cursor-pointer"
                      >
                        Baca
                      </button>
                    )}
                  </div>
                  {body && <p className="mt-1 text-[11px] text-muted leading-relaxed">{body}</p>}
                  {n.createdAt && <p className="mt-1 font-mono text-[10px] text-muted">{fmtDate(n.createdAt)}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export function AppShell({
  children,
  requireRole,
  variant,
  nav,
}: {
  children: ReactNode;
  requireRole?: Role;
  variant: 'member' | 'admin';
  nav?: NavGroup[];
}) {
  const session = useSession();
  const router = useRouter();
  const path = usePathname();
  const qc = useQueryClient();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('dentsweb-theme');
    const resolved: 'light' | 'dark' =
      saved === 'dark' || saved === 'light'
        ? saved
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    setTheme(resolved);
    document.documentElement.setAttribute('data-theme', resolved);
  }, []);

  const toggleTheme = () => {
    setTheme((curr) => {
      const next = curr === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('dentsweb-theme', next);
      return next;
    });
  };

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const isSectionOpen = (id: string) => openSections[id] ?? true;
  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
  };

  const dash = useQuery({
    queryKey: ['me-dashboard'],
    queryFn: () => api<Dash>('/me/dashboard'),
    enabled: session.isSuccess && variant === 'member',
    refetchInterval: variant === 'member' ? 15_000 : false,
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
  const sections: NavGroup[] = nav ?? (variant === 'admin' ? ADMIN_NAV : MEMBER_NAV);

  const isActive = (href: string) => {
    if (path === href) return true;
    if (href === '/admin' || href === '/dashboard' || href === '/admin/content') return false;
    return path.startsWith(`${href}/`);
  };

  const sidebarContent = (
    <div className={clsx('flex h-full flex-col justify-between py-4 select-none', collapsed ? 'px-2' : 'px-3')}>
      {/* HEADER: Brand & Toggle */}
      <div>
        <div className={clsx('flex items-center pb-4 border-b border-line', collapsed ? 'justify-center' : 'justify-between px-2')}>
          {!collapsed ? (
            <Link href={isSuperadmin && variant === 'admin' ? '/admin' : '/dashboard'} className="flex items-center gap-3">
              <img src="/logo.svg" alt="DENTSWEB STUDIO" className="h-9 w-9 shrink-0 rounded-xl object-contain shadow-sm" />
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
            <Link
              href={isSuperadmin && variant === 'admin' ? '/admin' : '/dashboard'}
              title="DENTSWEB STUDIO"
              className="flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden shadow-sm"
            >
              <img src="/logo.svg" alt="DENTSWEB STUDIO" className="h-9 w-9 object-contain" />
            </Link>
          )}

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
        <div className="mt-4 space-y-4 overflow-y-auto max-h-[calc(100vh-230px)] pr-1">
          {sections.map((sec) => {
            const open = isSectionOpen(sec.id);
            return (
              <div key={sec.id} className="space-y-1">
                {!collapsed ? (
                  <button
                    onClick={() => toggleSection(sec.id)}
                    className="flex w-full items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted hover:text-text transition-colors"
                  >
                    <span>{sec.label}</span>
                    <span className="text-muted/70">
                      {open ? <IconChevronDown className="h-3 w-3" /> : <IconChevronRight className="h-3 w-3" />}
                    </span>
                  </button>
                ) : (
                  <div className="my-2 border-t border-line/60" />
                )}

                {(collapsed || open) && (
                  <div className="space-y-0.5">
                    {sec.items.map((it) => {
                      const Icon = ROUTE_ICONS[it.href] ?? IconSettings;
                      const active = isActive(it.href);
                      const showLive = it.badge === 'LIVE' && (dash.data?.activeRuns.length ?? 0) > 0;

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
                                : 'text-muted hover:bg-surface-2 hover:text-text',
                            )}
                          >
                            <Icon className="h-5 w-5" />
                            {showLive && (
                              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
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
                              : 'text-muted hover:bg-surface-2 hover:text-text',
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Icon className={clsx('h-4 w-4 shrink-0 transition-transform group-hover:scale-110', active ? 'text-white' : 'text-muted')} />
                            <span className="truncate">{it.label}</span>
                          </div>
                          {it.badge && (it.badge !== 'LIVE' || showLive) && (
                            <span
                              className={clsx(
                                'rounded-full px-2 py-0.5 text-[10px] font-bold leading-none uppercase',
                                it.badge === 'LIVE'
                                  ? active
                                    ? 'bg-white/20 text-white'
                                    : 'bg-accent/15 text-accent animate-pulse'
                                  : active
                                    ? 'bg-white/20 text-white'
                                    : 'bg-surface-2 text-muted',
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

      {/* FOOTER: User Card & Actions */}
      <div className={clsx('pt-3 border-t border-line space-y-2', collapsed ? 'px-0' : 'px-2')}>
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

        <div className={clsx('flex items-center gap-2', collapsed ? 'justify-center flex-col' : 'justify-between')}>
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

          <div className={clsx('flex items-center gap-1', collapsed && 'flex-col')}>
            <NotificationBell collapsed={collapsed} />
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
              aria-label={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
              className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-text transition-colors cursor-pointer"
            >
              <ThemeIcon dark={theme === 'dark'} />
            </button>
            <button
              onClick={logout}
              title="Keluar"
              aria-label="Keluar"
              className="rounded-lg p-1.5 text-muted hover:bg-bad/10 hover:text-bad transition-colors cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Superadmin / Member portal switcher (accessible in both expanded & collapsed states) */}
        {isSuperadmin && (
          <Link
            href={variant === 'admin' ? '/dashboard' : '/admin'}
            title={variant === 'admin' ? 'Buka Dashboard Member' : 'Buka Superadmin Portal'}
            className={clsx(
              'block text-center rounded-lg border border-line/60 bg-surface-2/40 py-1 text-[11px] font-medium text-accent hover:bg-surface-2 transition-colors',
              collapsed && 'px-1 text-[10px]',
            )}
          >
            {collapsed ? (variant === 'admin' ? '←M' : 'SA→') : variant === 'admin' ? '← Dashboard Member' : 'Buka Superadmin Portal →'}
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={clsx(
        'lg:grid lg:min-h-dvh transition-all duration-300',
        collapsed ? 'lg:grid-cols-[68px_1fr]' : 'lg:grid-cols-[260px_1fr]',
      )}
    >
      {/* DESKTOP SIDEBAR */}
      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-surface lg:block z-30">
        {sidebarContent}
      </aside>

      {/* MOBILE BAR */}
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="DENTSWEB STUDIO" className="h-8 w-8 rounded-lg object-contain" />
          <span className="font-semibold text-sm">DENTSWEB STUDIO</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
            aria-label={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
            className="rounded-lg border border-line p-1.5 text-muted hover:bg-surface-2 hover:text-text transition-colors cursor-pointer"
          >
            <ThemeIcon dark={theme === 'dark'} />
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium cursor-pointer"
          >
            {mobileOpen ? 'Tutup' : 'Menu'}
          </button>
        </div>
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
