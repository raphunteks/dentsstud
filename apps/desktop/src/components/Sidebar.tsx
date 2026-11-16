import clsx from 'clsx';
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
  presetsCount = 81,
}: SidebarProps) {
  const isSuperadmin = user.role === 'SUPERADMIN';

  const navItemClass = (tab: NavTab, isSpecial?: boolean) =>
    clsx(
      'group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150 cursor-pointer select-none',
      currentTab === tab
        ? isSpecial
          ? 'bg-accent text-accent-contrast shadow-sm font-semibold'
          : 'bg-surface-2 text-text shadow-xs font-semibold'
        : isSpecial
        ? 'border border-accent/40 bg-accent/5 text-accent hover:bg-accent/15'
        : 'text-muted hover:bg-surface-2/60 hover:text-text'
    );

  return (
    <aside
      className="flex h-full w-[260px] flex-col border-r border-line bg-surface select-none"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {/* Brand Header */}
      <div className="border-b border-line px-5 py-4">
        <Mark />
      </div>

      {/* Nav List */}
      <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6">
        {/* PRODUKSI */}
        <div className="space-y-1">
          <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted/80">
            Produksi
          </p>
          <button
            onClick={() => onSelectTab('beranda')}
            className={navItemClass('beranda')}
          >
            <span className="flex items-center gap-2.5">
              <span className="text-base">🏠</span>
              Beranda
            </span>
          </button>
          <button
            onClick={() => onSelectTab('buat-konten')}
            className={navItemClass('buat-konten', true)}
          >
            <span className="flex items-center gap-2.5">
              <span className="text-base font-bold">＋</span>
              Buat Konten
            </span>
          </button>
          <button
            onClick={() => onSelectTab('progress')}
            className={navItemClass('progress')}
          >
            <span className="flex items-center gap-2.5">
              <span className="text-base">⚡</span>
              Progress
            </span>
            <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
              LIVE
            </span>
          </button>
          <button
            onClick={() => onSelectTab('hasil')}
            className={navItemClass('hasil')}
          >
            <span className="flex items-center gap-2.5">
              <span className="text-base">🎬</span>
              Hasil
            </span>
          </button>
        </div>

        {/* STUDIO */}
        <div className="space-y-1">
          <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted/80">
            Studio
          </p>
          <button
            onClick={() => onSelectTab('galeri-gaya')}
            className={navItemClass('galeri-gaya')}
          >
            <span className="flex items-center gap-2.5">
              <span className="text-base">🎨</span>
              Galeri Gaya
            </span>
            <span className="num rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted font-mono">
              {presetsCount}
            </span>
          </button>
          <button
            onClick={() => onSelectTab('suara')}
            className={navItemClass('suara')}
          >
            <span className="flex items-center gap-2.5">
              <span className="text-base">🎙️</span>
              Suara
            </span>
          </button>
          <button
            onClick={() => onSelectTab('pengaturan')}
            className={navItemClass('pengaturan')}
          >
            <span className="flex items-center gap-2.5">
              <span className="text-base">⚙️</span>
              Pengaturan
            </span>
          </button>
          <button
            onClick={() => onSelectTab('bantuan')}
            className={navItemClass('bantuan')}
          >
            <span className="flex items-center gap-2.5">
              <span className="text-base">💬</span>
              Bantuan
            </span>
          </button>
        </div>

        {/* DESKTOP ENGINE */}
        <div className="space-y-1">
          <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted/80">
            Engine Desktop
          </p>
          <button
            onClick={() => onSelectTab('render-lokal')}
            className={navItemClass('render-lokal')}
          >
            <span className="flex items-center gap-2.5">
              <span className="text-base">🖥️</span>
              Render Lokal
            </span>
          </button>
          <button
            onClick={() => onSelectTab('project-offline')}
            className={navItemClass('project-offline')}
          >
            <span className="flex items-center gap-2.5">
              <span className="text-base">💾</span>
              Project Offline
            </span>
          </button>
          {isSuperadmin && (
            <button
              onClick={() => onSelectTab('import-folder')}
              className={navItemClass('import-folder')}
            >
              <span className="flex items-center gap-2.5">
                <span className="text-base">📁</span>
                Import Folder
              </span>
            </button>
          )}
        </div>

        {/* SUPERADMIN ONLY */}
        {isSuperadmin && (
          <div className="space-y-1">
            <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
              Superadmin
            </p>
            <button
              onClick={() => onSelectTab('admin-members')}
              className={navItemClass('admin-members')}
            >
              <span className="flex items-center gap-2.5">
                <span className="text-base">👥</span>
                Kelola Member
              </span>
            </button>
            <button
              onClick={() => onSelectTab('admin-licenses')}
              className={navItemClass('admin-licenses')}
            >
              <span className="flex items-center gap-2.5">
                <span className="text-base">🔑</span>
                Kelola Lisensi
              </span>
            </button>
            <button
              onClick={() => onSelectTab('admin-system')}
              className={navItemClass('admin-system')}
            >
              <span className="flex items-center gap-2.5">
                <span className="text-base">📊</span>
                Status Sistem
              </span>
            </button>
          </div>
        )}
      </nav>

      {/* Production Widget & User Profile Footer */}
      <div className="border-t border-line p-3.5 space-y-3">
        {/* Active Production Mini-Card */}
        <div className="rounded-xl border border-line bg-surface-2/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-text">
              <span className={clsx('size-2 rounded-full', activeCount > 0 ? 'bg-ok animate-pulse' : 'bg-muted/40')} />
              {activeCount > 0 ? 'Sedang produksi' : 'Siap produksi'}
            </span>
            <span className="text-[10px] text-muted font-mono">{activeCount} aktif</span>
          </div>
          {activeCount > 0 ? (
            <div className="mt-2 space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                <div className="h-full w-2/3 bg-accent animate-pulse" />
              </div>
              <p className="truncate text-[10px] text-muted">Pipeline AI & motion render...</p>
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-muted">Semua pipeline stanby.</p>
          )}
        </div>

        {/* User Card */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-semibold text-text">{user.displayName}</span>
              {isSuperadmin && (
                <span className="rounded bg-accent/20 px-1 py-0.2 text-[9px] font-bold text-accent">
                  ADMIN
                </span>
              )}
            </div>
            <p className="truncate text-[10px] text-muted">{user.email}</p>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleTheme}
              title={theme === 'light' ? 'Mode Gelap' : 'Mode Terang'}
              className="flex size-7 items-center justify-center rounded-lg border border-line bg-surface text-xs text-muted hover:text-text cursor-pointer"
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button
              type="button"
              onClick={onLogout}
              title="Keluar"
              className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-muted hover:text-bad hover:border-bad/40 cursor-pointer"
            >
              Keluar
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
