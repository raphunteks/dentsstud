import clsx from 'clsx';
import { useState } from 'react';
import type { NavTab, SessionUser } from '../types';
import { Mark, Pill } from './UI';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  user: SessionUser;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  activeCount?: number;
  presetsCount?: number;
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
}: SidebarProps) {
  const isSuperadmin = user.role === 'SUPERADMIN';
  const [collapsed, setCollapsed] = useState(false);

  // Accordion open/close state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    utama: true,
    produksi: true,
    studio: true,
    engine: true,
    admin: true,
    pengaturan: true,
  });

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const navItemClass = (tab: NavTab) =>
    clsx(
      'group flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 cursor-pointer select-none',
      currentTab === tab
        ? 'bg-primary text-white shadow-md shadow-primary/20 font-semibold'
        : 'text-muted hover:bg-surface-2 hover:text-text'
    );

  const miniItemClass = (tab: NavTab) =>
    clsx(
      'relative flex h-10 w-10 mx-auto items-center justify-center rounded-xl transition-all cursor-pointer',
      currentTab === tab
        ? 'bg-primary text-white shadow-md scale-105'
        : 'text-muted hover:bg-surface-2 hover:text-text'
    );

  return (
    <aside
      className={clsx(
        'flex h-full flex-col border-r border-line bg-surface select-none transition-[width] duration-200 ease-out',
        collapsed ? 'w-[68px]' : 'w-[260px]'
      )}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {/* Brand Header with Toggle (Gambar 2 & 3) */}
      <div className={clsx('flex items-center pb-4 pt-4 border-b border-line', collapsed ? 'justify-center px-2' : 'justify-between px-4')}>
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow font-bold text-sm">
              D
            </div>
            <div>
              <span className="block font-display font-semibold tracking-tight text-sm text-text leading-tight">
                DENTSWEB STUDIO
              </span>
              <span className="block text-[10px] text-muted leading-tight">
                {isSuperadmin ? 'Superadmin Desktop' : 'Motion Studio'}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow font-bold text-sm">
            D
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
          className={clsx(
            'flex h-8 w-8 items-center justify-center rounded-xl border border-line text-muted hover:bg-surface-2 hover:text-text transition-colors shadow-2xs cursor-pointer',
            collapsed && 'mt-2'
          )}
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

      {/* Navigation Groups with Accordions (Gambar 2 & 3) */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4 pr-1">
        {/* UTAMA */}
        <div className="space-y-1">
          {!collapsed ? (
            <button
              onClick={() => toggleSection('utama')}
              className="flex w-full items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted hover:text-text transition-colors"
            >
              <span>Utama</span>
              <svg className={clsx('h-3 w-3 transition-transform', openSections.utama ? 'rotate-0' : '-rotate-90')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          ) : (
            <div className="my-1 border-t border-line/60" />
          )}

          {(collapsed || openSections.utama) && (
            <div>
              {collapsed ? (
                <button onClick={() => onSelectTab('beranda')} title="Beranda" className={miniItemClass('beranda')}>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </button>
              ) : (
                <button onClick={() => onSelectTab('beranda')} className={navItemClass('beranda')}>
                  <div className="flex items-center gap-3">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    <span>Beranda</span>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>

        {/* PRODUKSI */}
        <div className="space-y-1">
          {!collapsed ? (
            <button
              onClick={() => toggleSection('produksi')}
              className="flex w-full items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted hover:text-text transition-colors"
            >
              <span>Produksi</span>
              <svg className={clsx('h-3 w-3 transition-transform', openSections.produksi ? 'rotate-0' : '-rotate-90')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          ) : (
            <div className="my-1 border-t border-line/60" />
          )}

          {(collapsed || openSections.produksi) && (
            <div className="space-y-0.5">
              {collapsed ? (
                <>
                  <button onClick={() => onSelectTab('buat-konten')} title="Buat Konten" className={miniItemClass('buat-konten')}>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <button onClick={() => onSelectTab('progress')} title="Progress Antrean" className={miniItemClass('progress')}>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {activeCount > 0 && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-accent animate-ping" />}
                  </button>
                  <button onClick={() => onSelectTab('hasil')} title="Hasil Video" className={miniItemClass('hasil')}>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => onSelectTab('buat-konten')} className={navItemClass('buat-konten')}>
                    <div className="flex items-center gap-3">
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      <span>+ Buat Konten</span>
                    </div>
                  </button>
                  <button onClick={() => onSelectTab('progress')} className={navItemClass('progress')}>
                    <div className="flex items-center gap-3">
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>Progress</span>
                    </div>
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent animate-pulse">
                      LIVE
                    </span>
                  </button>
                  <button onClick={() => onSelectTab('hasil')} className={navItemClass('hasil')}>
                    <div className="flex items-center gap-3">
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <span>Hasil</span>
                    </div>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* STUDIO */}
        <div className="space-y-1">
          {!collapsed ? (
            <button
              onClick={() => toggleSection('studio')}
              className="flex w-full items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted hover:text-text transition-colors"
            >
              <span>Studio</span>
              <svg className={clsx('h-3 w-3 transition-transform', openSections.studio ? 'rotate-0' : '-rotate-90')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          ) : (
            <div className="my-1 border-t border-line/60" />
          )}

          {(collapsed || openSections.studio) && (
            <div className="space-y-0.5">
              {collapsed ? (
                <>
                  <button onClick={() => onSelectTab('galeri-gaya')} title="Galeri Gaya" className={miniItemClass('galeri-gaya')}>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button onClick={() => onSelectTab('suara')} title="Katalog Suara" className={miniItemClass('suara')}>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => onSelectTab('galeri-gaya')} className={navItemClass('galeri-gaya')}>
                    <div className="flex items-center gap-3">
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Galeri Gaya</span>
                    </div>
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-mono text-muted">
                      {presetsCount}
                    </span>
                  </button>
                  <button onClick={() => onSelectTab('suara')} className={navItemClass('suara')}>
                    <div className="flex items-center gap-3">
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                      <span>Suara</span>
                    </div>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* ENGINE DESKTOP */}
        <div className="space-y-1">
          {!collapsed ? (
            <button
              onClick={() => toggleSection('engine')}
              className="flex w-full items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted hover:text-text transition-colors"
            >
              <span>Engine Desktop</span>
              <svg className={clsx('h-3 w-3 transition-transform', openSections.engine ? 'rotate-0' : '-rotate-90')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          ) : (
            <div className="my-1 border-t border-line/60" />
          )}

          {(collapsed || openSections.engine) && (
            <div className="space-y-0.5">
              {collapsed ? (
                <>
                  <button onClick={() => onSelectTab('render-lokal')} title="Render Lokal Remotion" className={miniItemClass('render-lokal')}>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button onClick={() => onSelectTab('project-offline')} title="Project Offline" className={miniItemClass('project-offline')}>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </button>
                  <button onClick={() => onSelectTab('import-folder')} title="Import Folder Materi" className={miniItemClass('import-folder')}>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => onSelectTab('render-lokal')} className={navItemClass('render-lokal')}>
                    <div className="flex items-center gap-3">
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span>Render Lokal</span>
                    </div>
                  </button>
                  <button onClick={() => onSelectTab('project-offline')} className={navItemClass('project-offline')}>
                    <div className="flex items-center gap-3">
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <span>Project Offline</span>
                    </div>
                  </button>
                  <button onClick={() => onSelectTab('import-folder')} className={navItemClass('import-folder')}>
                    <div className="flex items-center gap-3">
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span>Import Folder</span>
                    </div>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* SUPERADMIN SECTION (Gambar 2 & 3) */}
        {isSuperadmin && (
          <div className="space-y-1">
            {!collapsed ? (
              <button
                onClick={() => toggleSection('admin')}
                className="flex w-full items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-accent hover:text-text transition-colors"
              >
                <span>Administrasi</span>
                <svg className={clsx('h-3 w-3 transition-transform', openSections.admin ? 'rotate-0' : '-rotate-90')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            ) : (
              <div className="my-1 border-t border-accent/40" />
            )}

            {(collapsed || openSections.admin) && (
              <div className="space-y-0.5">
                {collapsed ? (
                  <>
                    <button onClick={() => onSelectTab('admin-members')} title="Kelola Member" className={miniItemClass('admin-members')}>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </button>
                    <button onClick={() => onSelectTab('admin-licenses')} title="Kelola Lisensi" className={miniItemClass('admin-licenses')}>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </button>
                    <button onClick={() => onSelectTab('admin-ai-providers')} title="AI Claude & OAuth" className={miniItemClass('admin-ai-providers')}>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </button>
                    <button onClick={() => onSelectTab('admin-system')} title="Sistem & VPS" className={miniItemClass('admin-system')}>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => onSelectTab('admin-members')} className={navItemClass('admin-members')}>
                      <div className="flex items-center gap-3">
                        <svg className="h-4 w-4 shrink-0 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <span>Admin Members</span>
                      </div>
                    </button>
                    <button onClick={() => onSelectTab('admin-licenses')} className={navItemClass('admin-licenses')}>
                      <div className="flex items-center gap-3">
                        <svg className="h-4 w-4 shrink-0 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                        <span>Admin Licenses</span>
                      </div>
                    </button>
                    <button onClick={() => onSelectTab('admin-ai-providers')} className={navItemClass('admin-ai-providers')}>
                      <div className="flex items-center gap-3">
                        <svg className="h-4 w-4 shrink-0 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>AI Claude & OAuth</span>
                      </div>
                    </button>
                    <button onClick={() => onSelectTab('admin-system')} className={navItemClass('admin-system')}>
                      <div className="flex items-center gap-3">
                        <svg className="h-4 w-4 shrink-0 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                        </svg>
                        <span>Admin System</span>
                      </div>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* PENGATURAN */}
        <div className="space-y-1">
          {!collapsed ? (
            <button
              onClick={() => toggleSection('pengaturan')}
              className="flex w-full items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted hover:text-text transition-colors"
            >
              <span>Pengaturan</span>
              <svg className={clsx('h-3 w-3 transition-transform', openSections.pengaturan ? 'rotate-0' : '-rotate-90')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          ) : (
            <div className="my-1 border-t border-line/60" />
          )}

          {(collapsed || openSections.pengaturan) && (
            <div className="space-y-0.5">
              {collapsed ? (
                <>
                  <button onClick={() => onSelectTab('pengaturan')} title="Pengaturan & Lisensi" className={miniItemClass('pengaturan')}>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <button onClick={() => onSelectTab('bantuan')} title="Bantuan & FAQ" className={miniItemClass('bantuan')}>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => onSelectTab('pengaturan')} className={navItemClass('pengaturan')}>
                    <div className="flex items-center gap-3">
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Pengaturan</span>
                    </div>
                  </button>
                  <button onClick={() => onSelectTab('bantuan')} className={navItemClass('bantuan')}>
                    <div className="flex items-center gap-3">
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Bantuan</span>
                    </div>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* User Profile Card (Gambar 2 & 3) */}
      <div className={clsx('border-t border-line py-3', collapsed ? 'px-1' : 'px-3')}>
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
            <div className="flex items-center gap-1">
              <button
                onClick={onToggleTheme}
                title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
                className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-text transition-colors"
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
              <button
                onClick={onLogout}
                title="Keluar"
                className="rounded-lg p-1.5 text-muted hover:bg-bad/10 hover:text-bad transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
