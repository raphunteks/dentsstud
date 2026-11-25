import clsx from 'clsx';
import { useState } from 'react';
import type { NavTab, SessionUser } from '../types';
import { Icon, type IconName } from './Icons';
import logoSvg from '../assets/logo.svg';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  user: SessionUser;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  activeCount?: number;
  presetsCount?: number;
  offlineMode?: boolean;
}

interface NavItem {
  id: NavTab;
  label: string;
  icon: IconName;
  badge?: string | number;
  pulse?: boolean;
}

export function Sidebar({
  currentTab,
  onSelectTab,
  user,
  onLogout,
  theme,
  onToggleTheme,
  activeCount = 0,
  presetsCount = 0,
  offlineMode = false,
}: SidebarProps) {
  const isSuperadmin = !offlineMode && user.role === 'SUPERADMIN';
  const [collapsed, setCollapsed] = useState(false);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    utama: true,
    produksi: true,
    studio: true,
    engine: true,
    admin: true,
    pengaturan: true,
  });

  const toggleSection = (id: string) => setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));

  const navItemClass = (tab: NavTab) =>
    clsx(
      'group flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-100 cursor-pointer select-none',
      currentTab === tab
        ? 'bg-accent text-accent-contrast shadow-md shadow-accent/25 font-semibold'
        : 'text-muted hover:bg-surface-2 hover:text-text'
    );

  const miniItemClass = (tab: NavTab) =>
    clsx(
      'relative flex h-10 w-10 mx-auto items-center justify-center rounded-xl transition-colors duration-100 cursor-pointer text-base',
      currentTab === tab
        ? 'bg-accent text-accent-contrast shadow-md scale-105'
        : 'text-muted hover:bg-surface-2 hover:text-text'
    );

  const sections: { id: string; title: string; accent?: boolean; items: NavItem[] }[] = offlineMode
    ? [
        {
          id: 'engine',
          title: 'Mode Offline',
          accent: true,
          items: [
            { id: 'project-offline', label: 'Project Offline', icon: 'folder' },
            { id: 'render-lokal', label: 'Render Lokal', icon: 'monitor' },
            { id: 'pengaturan', label: 'Pengaturan', icon: 'settings' },
          ],
        },
      ]
    : [
        {
          id: 'utama',
          title: 'Utama',
          items: [{ id: 'beranda', label: 'Beranda', icon: 'home' }],
        },
        {
          id: 'produksi',
          title: 'Produksi',
          items: [
            { id: 'buat-konten', label: 'Buat Konten', icon: 'plus' },
            {
              id: 'progress',
              label: 'Progress',
              icon: 'bolt',
              badge: activeCount > 0 ? 'LIVE' : undefined,
              pulse: activeCount > 0,
            },
            { id: 'hasil', label: 'Hasil', icon: 'film' },
          ],
        },
        {
          id: 'studio',
          title: 'Studio',
          items: [
            { id: 'galeri-gaya', label: 'Galeri Gaya', icon: 'palette', badge: presetsCount || undefined },
            { id: 'suara', label: 'Suara', icon: 'mic' },
          ],
        },
        {
          id: 'engine',
          title: 'Engine Desktop',
          items: [
            { id: 'render-lokal', label: 'Render Lokal', icon: 'monitor' },
            { id: 'project-offline', label: 'Project Offline', icon: 'folder' },
            ...(isSuperadmin ? [{ id: 'import-folder' as NavTab, label: 'Import Folder', icon: 'package' as IconName }] : []),
          ],
        },
        ...(isSuperadmin
          ? [
              {
                id: 'admin',
                title: 'Administrasi (01–14)',
                accent: true,
                items: [
                  { id: 'admin-dashboard' as NavTab, label: '01 Control Center', icon: 'chart' as IconName },
                  { id: 'admin-members' as NavTab, label: '02 Member & Akses', icon: 'users' as IconName },
                  { id: 'admin-licenses' as NavTab, label: '03 Lisensi & Device', icon: 'key' as IconName },
                  { id: 'admin-content' as NavTab, label: '04 Content Library', icon: 'layers' as IconName },
                  { id: 'admin-voices' as NavTab, label: '05 Voice & TTS', icon: 'volume' as IconName },
                  { id: 'admin-ai-providers' as NavTab, label: '06 AI Provider', icon: 'cpu' as IconName },
                  { id: 'admin-workflows' as NavTab, label: '07 Workflow & Skills', icon: 'puzzle' as IconName },
                  { id: 'admin-production' as NavTab, label: '08 Produksi & Render', icon: 'activity' as IconName },
                  { id: 'admin-results' as NavTab, label: '09 Hasil Global', icon: 'film' as IconName },
                  { id: 'admin-quotas' as NavTab, label: '10 Kuota & Limit', icon: 'trending' as IconName },
                  { id: 'admin-releases' as NavTab, label: '11 Rilis Desktop', icon: 'download' as IconName },
                  { id: 'admin-support' as NavTab, label: '12 Support & Help', icon: 'ticket' as IconName },
                  { id: 'admin-analytics' as NavTab, label: '13 Analitik & Error', icon: 'search' as IconName },
                  { id: 'admin-system' as NavTab, label: '14 Sistem & VPS', icon: 'server' as IconName },
                ],
              },
            ]
          : []),
        {
          id: 'pengaturan',
          title: 'Pengaturan',
          items: [
            { id: 'pengaturan', label: 'Pengaturan', icon: 'settings' },
            { id: 'bantuan', label: 'Bantuan', icon: 'help' },
          ],
        },
      ];

  return (
    <aside
      className={clsx(
        'flex h-full flex-col border-r border-line bg-surface select-none transition-[width] duration-200 ease-out shrink-0',
        collapsed ? 'w-[68px]' : 'w-[260px]'
      )}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {isMac && (
        <div
          className="h-8 w-full shrink-0 select-none"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        />
      )}

      {/* Brand Header */}
      <div className={clsx('flex items-center pb-4 pt-2 border-b border-line', collapsed ? 'flex-col gap-2 px-2' : 'justify-between px-4')}>
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#10131F] p-1 shadow-sm ring-1 ring-white/10">
              <img src={logoSvg} alt="DENTSWEB STUDIO" className="h-full w-full object-contain" />
            </div>
            <div>
              <span className="block font-display font-semibold tracking-tight text-sm text-text leading-tight">
                DENTSWEB STUDIO
              </span>
              <span className="block text-[10px] text-muted leading-tight">
                {offlineMode ? 'Mode Studio Offline' : isSuperadmin ? 'Superadmin Desktop' : 'Motion Studio'}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#10131F] p-1 shadow-sm ring-1 ring-white/10">
            <img src={logoSvg} alt="DENTSWEB STUDIO" className="h-full w-full object-contain" />
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-line text-muted hover:bg-surface-2 hover:text-text transition-colors shadow-2xs cursor-pointer"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" />
            <path d="M9 3v18" stroke="currentColor" />
            {collapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 9l3 3-3 3" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 9l-3 3 3 3" />
            )}
          </svg>
        </button>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {sections.map((sec) => (
          <div key={sec.id} className="space-y-1">
            {!collapsed ? (
              <button
                onClick={() => toggleSection(sec.id)}
                className={clsx(
                  'flex w-full items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors cursor-pointer',
                  sec.accent ? 'text-accent hover:text-text' : 'text-muted hover:text-text'
                )}
              >
                <span>{sec.title}</span>
                <svg
                  className={clsx('h-3 w-3 transition-transform', openSections[sec.id] ? 'rotate-0' : '-rotate-90')}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            ) : (
              <div className={clsx('my-1 border-t', sec.accent ? 'border-accent/40' : 'border-line/60')} />
            )}

            {(collapsed || openSections[sec.id]) && (
              <div className="space-y-0.5">
                {sec.items.map((item) =>
                  collapsed ? (
                    <button
                      key={item.id}
                      onClick={() => onSelectTab(item.id)}
                      title={item.label}
                      className={miniItemClass(item.id)}
                    >
                      <Icon name={item.icon} className="w-4 h-4 shrink-0" />
                      {item.pulse && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-accent animate-ping" />
                      )}
                    </button>
                  ) : (
                    <button
                      key={item.id}
                      onClick={() => onSelectTab(item.id)}
                      className={navItemClass(item.id)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon name={item.icon} className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span
                          className={clsx(
                            'rounded-full px-2 py-0.5 text-[10px] font-mono shrink-0',
                            item.pulse
                              ? 'bg-accent/15 font-bold text-accent animate-pulse'
                              : currentTab === item.id
                                ? 'bg-black/20 text-accent-contrast'
                                : 'bg-surface-2 text-muted'
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* User Profile Card (Theme & Logout always visible even when collapsed) */}
      <div className={clsx('border-t border-line py-3', collapsed ? 'px-1.5' : 'px-3')}>
        <div className={clsx('flex items-center gap-2', collapsed ? 'flex-col justify-center' : 'justify-between')}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 border border-line font-bold text-xs uppercase text-accent">
              {user.displayName?.substring(0, 2) || 'DW'}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-text">{user.displayName}</p>
                <span className="inline-block rounded bg-accent/10 px-1.5 py-0.2 text-[9px] font-bold uppercase text-accent">
                  {offlineMode ? 'OFFLINE' : user.role}
                </span>
              </div>
            )}
          </div>

          <div className={clsx('flex items-center gap-1', collapsed && 'flex-col mt-1')}>
            <button
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
              className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-text transition-colors cursor-pointer"
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="w-4 h-4" />
            </button>
            <button
              onClick={onLogout}
              title={offlineMode ? 'Coba sambung ulang' : 'Keluar'}
              className="rounded-lg p-1.5 text-muted hover:bg-bad/10 hover:text-bad transition-colors cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
