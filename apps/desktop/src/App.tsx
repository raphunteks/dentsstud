import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { get, invoke, mutate, setMediaBase } from './bridge';
import { Button, Card, ErrorBoundary, Input, Mark, Pill, errMsg } from './components/UI';
import { Icon } from './components/Icons';
import { Sidebar } from './components/Sidebar';
import { BerandaView } from './views/BerandaView';
import { BuatKontenView } from './views/BuatKontenView';
import { ProgressView } from './views/ProgressView';
import { HasilView } from './views/HasilView';
import { GaleriGayaView } from './views/GaleriGayaView';
import { SuaraView } from './views/SuaraView';
import { PengaturanView } from './views/PengaturanView';
import { BantuanView } from './views/BantuanView';
import { FolderImportView, LocalRenderView, OfflineProjectsView } from './views/DesktopEngineViews';
import { AdminOfficeView } from './views/AdminOfficeView';
import { AdminSocialView, SocialView } from './views/SocialView';
import { AdminLmsView, LmsView } from './views/LmsView';
import {
  AdminAIProvidersView,
  AdminAnalyticsView,
  AdminContentView,
  AdminDashboardView,
  AdminLicensesView,
  AdminMembersView,
  AdminProductionView,
  AdminQuotasView,
  AdminReleasesView,
  AdminResultsView,
  AdminSupportView,
  AdminSystemView,
  AdminVoicesView,
  AdminWorkflowsView,
} from './views/SuperadminViews';
import type { CreatePrefill, Dash, Info, NavTab, OfflineStatus, SessionUser, UpdateState } from './types';

interface NotificationItem {
  id: string;
  type?: string;
  title?: string;
  body?: string;
  payload?: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
  actionTab?: string | null;
  targetId?: string | null;
}

function formatNotif(n: NotificationItem): { title: string; body: string; tab: NavTab | null } {
  const p = (n.payload ?? {}) as Record<string, unknown>;
  const topic = typeof p.topic === 'string' ? p.topic : typeof p.title === 'string' ? p.title : '';
  const tabMap: Record<string, NavTab> = {
    hasil: 'hasil',
    progress: 'progress',
    bantuan: 'bantuan',
    pengaturan: 'pengaturan',
    beranda: 'beranda',
  };
  let tab: NavTab | null = n.actionTab && tabMap[n.actionTab] ? tabMap[n.actionTab]! : null;
  let title = n.title?.trim() || '';
  let body = n.body?.trim() || '';

  if (!tab) {
    if (n.type === 'production.completed') tab = 'hasil';
    else if (n.type === 'production.failed' || n.type === 'schedule.skipped') tab = 'progress';
    else if (n.type === 'support.reply') tab = 'bantuan';
    else if (n.type?.startsWith('license.') || n.type === 'member.status_changed') tab = 'pengaturan';
  }
  if (!title || !body) {
    switch (n.type) {
      case 'production.completed':
        title ||= 'Video selesai diproduksi';
        body ||= topic ? `"${topic}" siap diunggah.` : 'Video baru Anda siap diunggah.';
        break;
      case 'production.failed':
        title ||= 'Produksi video gagal';
        body ||= (typeof p.error === 'string' ? p.error : topic) || 'Terjadi kendala saat produksi.';
        break;
      case 'schedule.skipped':
        title ||= 'Jadwal otomatis dilewati';
        body ||= (typeof p.reason === 'string' ? p.reason : 'Kuota harian atau syarat produksi belum terpenuhi.');
        break;
      case 'support.reply':
        title ||= 'Balasan tiket support';
        body ||= (typeof p.subject === 'string' ? p.subject : 'Admin membalas tiket bantuan Anda.');
        break;
      case 'license.granted':
        title ||= 'Lisensi diaktifkan';
        body ||= 'Lisensi DENTSWEB STUDIO Anda telah aktif.';
        break;
      case 'license.revoked':
        title ||= 'Lisensi dicabut';
        body ||= 'Lisensi Anda telah dicabut oleh administrator.';
        break;
      case 'member.status_changed':
        title ||= 'Status akun diperbarui';
        body ||= typeof p.status === 'string' ? `Status akun Anda sekarang: ${p.status}` : 'Status akun Anda diperbarui oleh admin.';
        break;
      default:
        title ||= 'Notifikasi Studio';
        body ||= topic || n.type || 'Pembaruan baru tersedia.';
    }
  }
  return { title, body, tab };
}

export function App() {
  const [offlineMode, setOfflineMode] = useState(false);
  const info = useQuery({ queryKey: ['info'], queryFn: () => invoke<Info>('app:info') });
  const session = useQuery({ queryKey: ['session'], queryFn: () => invoke<{ user: SessionUser } | null>('auth:session'), retry: false });
  const offline = useQuery({ queryKey: ['offline'], queryFn: () => invoke<OfflineStatus>('license:offline-status') });
  const localProjs = useQuery({
    queryKey: ['local-projects-check'],
    queryFn: () => invoke<unknown[]>('projects:local-list').catch(() => []),
  });

  useEffect(() => {
    if (info.data?.apiBase) setMediaBase(info.data.apiBase);
  }, [info.data?.apiBase]);

  if (session.isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg text-muted">
        <div className="text-center space-y-2">
          <Mark />
          <p className="text-xs text-muted pt-2 animate-pulse">Menghubungkan ke studio…</p>
        </div>
      </div>
    );
  }

  if (offlineMode) {
    const offlineUser: SessionUser = { id: 'offline', email: 'offline@local', displayName: 'Mode Offline', role: 'MEMBER' };
    return (
      <StudioShell
        user={offlineUser}
        info={info.data}
        offline={offline.data}
        offlineMode
        onExitOffline={() => {
          setOfflineMode(false);
          void session.refetch();
        }}
      />
    );
  }

  if (session.isError) {
    const canOffline = Boolean(offline.data?.valid || (localProjs.data && localProjs.data.length > 0));
    return (
      <div className="grid min-h-dvh place-items-center bg-bg p-4">
        <Card className="max-w-md w-full p-6 text-center space-y-4">
          <Mark className="justify-center" />
          <h1 className="font-display text-xl font-medium text-text">Server tidak dapat dihubungi</h1>
          <p className="text-xs text-muted">{errMsg(session.error)}</p>
          <div className="space-y-2">
            <Button onClick={() => session.refetch()} className="w-full">
              ↻ Coba Sambung Lagi
            </Button>
            {canOffline && (
              <Button variant="outline" onClick={() => setOfflineMode(true)} className="w-full">
                <Icon name="folder" className="w-4 h-4" /> Masuk Mode Studio Offline
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  if (!session.data) {
    return <Login info={info.data} />;
  }

  return <StudioShell user={session.data.user} info={info.data} offline={offline.data} />;
}

function StudioShell({
  user,
  info,
  offline,
  offlineMode = false,
  onExitOffline,
}: {
  user: SessionUser;
  info?: Info;
  offline?: OfflineStatus;
  offlineMode?: boolean;
  onExitOffline?: () => void;
}) {
  const qc = useQueryClient();
  const [currentTab, setCurrentTab] = useState<NavTab>(offlineMode ? 'project-offline' : 'beranda');
  const [createPrefill, setCreatePrefill] = useState<CreatePrefill | undefined>(undefined);
  const [resultsSubTab, setResultsSubTab] = useState<'READY' | 'UPLOADED' | 'FAILED' | 'ALL' | 'TRASH'>('ALL');
  const [socialResultId, setSocialResultId] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const bellBtnRef = useRef<HTMLButtonElement | null>(null);
  const [notifPos, setNotifPos] = useState<{ top: number; right: number }>({ top: 52, right: 16 });
  const [updState, setUpdState] = useState<UpdateState>({ state: 'idle' });

  useEffect(() => {
    if (!notifOpen) return;
    const syncPos = () => {
      const rect = bellBtnRef.current?.getBoundingClientRect();
      if (!rect) return;
      setNotifPos({
        top: Math.round(rect.bottom + 8),
        right: Math.max(12, Math.round(window.innerWidth - rect.right)),
      });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotifOpen(false);
    };
    syncPos();
    window.addEventListener('resize', syncPos);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', syncPos);
      window.removeEventListener('keydown', onKey);
    };
  }, [notifOpen]);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (typeof window !== 'undefined' && (localStorage.getItem('dentsweb-theme') as 'light' | 'dark')) || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dentsweb-theme', theme);
  }, [theme]);

  // Subscribe to update:state + real-time notification:new / notification:click events
  useEffect(() => {
    void invoke<UpdateState>('update:state').then((s) => s && setUpdState(s)).catch(() => undefined);
    const bridge = window.dentsweb ?? window.dentweb;
    return bridge?.onEvent?.((e) => {
      if (e.channel === 'update:state' && e.data) setUpdState(e.data as UpdateState);
      if (e.channel === 'notification:new' && e.data?.id) {
        const incoming = e.data as NotificationItem;
        qc.setQueryData<NotificationItem[]>(['notifications'], (prev) => {
          const arr = Array.isArray(prev) ? prev : [];
          if (arr.some((x) => x.id === incoming.id)) return arr;
          return [incoming, ...arr];
        });
      }
      if (e.channel === 'notification:click' && e.data) {
        const { tab } = formatNotif(e.data as NotificationItem);
        if (tab) setCurrentTab(tab);
      }
    });
  }, [qc]);

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  const dash = useQuery({
    queryKey: ['dash'],
    queryFn: () => get<Dash>('/me/dashboard').catch(() => undefined),
    enabled: !offlineMode,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const notifsQ = useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      get<unknown>('/notifications')
        .then((r) => (Array.isArray(r) ? (r as NotificationItem[]) : Array.isArray((r as any)?.items) ? ((r as any).items as NotificationItem[]) : []))
        .catch(() => []),
    enabled: !offlineMode,
    refetchInterval: 30_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => mutate('POST', `/notifications/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => mutate('POST', '/notifications/read-all', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const logout = useMutation({
    mutationFn: () => invoke('auth:logout'),
    onSuccess: () => {
      qc.clear();
      qc.invalidateQueries();
    },
  });

  const handleNavigate = (
    tab: NavTab,
    opts?: { presetId?: string; voiceId?: string; topic?: string; notes?: string; resultsTab?: 'READY' | 'UPLOADED' | 'FAILED' | 'ALL' | 'TRASH'; socialResultId?: string }
  ) => {
    if (opts?.presetId || opts?.voiceId || opts?.topic || opts?.notes) {
      setCreatePrefill({ presetId: opts.presetId, voiceId: opts.voiceId, topic: opts.topic, notes: opts.notes });
    }
    if (opts?.resultsTab) {
      setResultsSubTab(opts.resultsTab);
    }
    if (opts?.socialResultId) {
      setSocialResultId(opts.socialResultId);
    }
    setCurrentTab(tab);
  };

  const isSuperadmin = !offlineMode && user.role === 'SUPERADMIN';
  const isAdminOnlyTab = currentTab.startsWith('admin-') || currentTab === 'import-folder';
  const notifs = notifsQ.data ?? [];
  const unreadCount = notifs.filter((n) => !n.readAt).length;

  return (
    <div className="flex h-dvh w-screen overflow-hidden bg-bg text-text">
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(t) => handleNavigate(t)}
        user={user}
        onLogout={() => (offlineMode ? onExitOffline?.() : logout.mutate())}
        theme={theme}
        onToggleTheme={toggleTheme}
        activeCount={dash.data?.stats?.inProduction ?? 0}
        presetsCount={dash.data?.catalog?.publishedPresets ?? 0}
        offlineMode={offlineMode}
      />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header
          className="relative z-40 flex h-11 items-center justify-between border-b border-line bg-surface/50 backdrop-blur-xs px-6 select-none shrink-0"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold capitalize tracking-wide text-text">
              {currentTab.replace(/-/g, ' ')}
            </span>
            {offlineMode && <Pill variant="accent">MODE OFFLINE</Pill>}
          </div>

          <div
            className="flex items-center gap-3 text-xs text-muted"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            {(updState.state === 'available' || updState.state === 'ready') && (
              <button
                onClick={() => void invoke('update:apply')}
                className="rounded-full bg-accent/20 px-2.5 py-0.5 text-[11px] font-semibold text-accent hover:bg-accent/30 cursor-pointer"
              >
                {updState.state === 'ready' ? `↻ Install v${updState.version}` : `⬇ Update v${updState.version}`}
              </button>
            )}

            {offlineMode && onExitOffline && (
              <button
                onClick={onExitOffline}
                className="rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-[11px] text-text hover:border-accent cursor-pointer"
              >
                Sambung Ulang
              </button>
            )}

            {/* In-App Notifications Bell (Portal to document.body z-[9999]) */}
            {!offlineMode && (
              <div className="relative">
                <button
                  ref={bellBtnRef}
                  onClick={() => setNotifOpen((o) => !o)}
                  title="Notifikasi"
                  aria-expanded={notifOpen}
                  className="relative rounded-lg p-1.5 hover:bg-surface-2 text-muted hover:text-text transition cursor-pointer"
                >
                  <Icon name="bell" className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-bad px-1 text-[9px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen &&
                  typeof document !== 'undefined' &&
                  createPortal(
                    <>
                      <div
                        className="fixed inset-0 z-[9998]"
                        onClick={() => setNotifOpen(false)}
                        aria-hidden="true"
                      />
                      <div
                        role="dialog"
                        aria-label="Notifikasi"
                        style={{ top: notifPos.top, right: notifPos.right }}
                        className="fixed z-[9999] w-80 max-w-[calc(100vw-24px)] max-h-[75vh] flex flex-col rounded-2xl border border-line bg-surface shadow-2xl p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between border-b border-line pb-2 shrink-0">
                          <span className="text-xs font-semibold text-text">Notifikasi ({unreadCount} baru)</span>
                          {unreadCount > 0 && (
                            <button
                              onClick={() => markAllRead.mutate()}
                              className="text-[11px] text-accent hover:underline cursor-pointer"
                            >
                              Tandai semua dibaca
                            </button>
                          )}
                        </div>
                        <div className="overflow-y-auto space-y-1.5 pr-0.5">
                          {notifs.length === 0 ? (
                            <p className="py-4 text-center text-xs text-muted">Belum ada notifikasi.</p>
                          ) : (
                            notifs.slice(0, 20).map((n) => {
                              const fmt = formatNotif(n);
                              return (
                                <div
                                  key={n.id}
                                  onClick={() => {
                                    if (!n.readAt) markRead.mutate(n.id);
                                    if (fmt.tab) {
                                      setCurrentTab(fmt.tab);
                                      setNotifOpen(false);
                                    }
                                  }}
                                  className={clsx(
                                    'rounded-xl border p-2.5 text-xs transition cursor-pointer hover:border-accent',
                                    n.readAt ? 'border-line/50 bg-surface opacity-75' : 'border-accent/50 bg-accent/5'
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="font-semibold text-text leading-snug">{fmt.title}</p>
                                    {!n.readAt && <span className="mt-1 size-2 shrink-0 rounded-full bg-accent" />}
                                  </div>
                                  <p className="text-[11px] text-muted mt-0.5 leading-relaxed">{fmt.body}</p>
                                  {n.createdAt && (
                                    <p className="text-[10px] font-mono text-muted/80 mt-1">
                                      {new Date(n.createdAt).toLocaleString('id-ID', {
                                        day: 'numeric',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </p>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </>,
                    document.body,
                  )}
              </div>
            )}

            <span className="num font-mono text-[11px]">v{info?.version ?? '1.0.19'}</span>
          </div>
        </header>

        {/* Main Canvas */}
        <main className="flex-1 overflow-y-auto px-6 py-6 md:px-8">
          <div className="mx-auto max-w-[1200px]">
            <ErrorBoundary key={currentTab} onReset={() => setCurrentTab(offlineMode ? 'project-offline' : 'beranda')}>
              {isAdminOnlyTab && !isSuperadmin ? (
                <Card className="p-10 text-center space-y-3">
                  <h2 className="font-display text-lg font-semibold text-bad">Akses Ditolak</h2>
                  <p className="text-xs text-muted">Halaman ini hanya dapat diakses oleh Superadmin.</p>
                  <Button size="sm" onClick={() => setCurrentTab('beranda')}>Kembali ke Beranda</Button>
                </Card>
              ) : (
                <>
                  {currentTab === 'beranda' && (
                    <BerandaView user={user} dash={dash.data} offline={offline} onNavigate={handleNavigate} />
                  )}
                  {currentTab === 'buat-konten' && (
                    <BuatKontenView onSuccess={() => dash.refetch()} onNavigate={handleNavigate} prefill={createPrefill} />
                  )}
                  {currentTab === 'progress' && <ProgressView onNavigate={handleNavigate} />}
                  {currentTab === 'hasil' && <HasilView onNavigate={handleNavigate} initialSubTab={resultsSubTab} />}
                  {currentTab === 'sosial-media' && <SocialView initialResultId={socialResultId} />}
                  {currentTab === 'kelas-lms' && <LmsView onNavigate={handleNavigate} />}
                  {currentTab === 'galeri-gaya' && <GaleriGayaView onNavigate={handleNavigate} />}
                  {currentTab === 'suara' && <SuaraView onNavigate={handleNavigate} />}
                  {currentTab === 'pengaturan' && (
                    <PengaturanView user={user} dash={dash.data} offline={offline} info={info} updateState={updState} />
                  )}
                  {currentTab === 'bantuan' && <BantuanView />}
                  {currentTab === 'render-lokal' && <LocalRenderView />}
                  {currentTab === 'project-offline' && <OfflineProjectsView />}
                  {currentTab === 'import-folder' && <FolderImportView />}
                  {currentTab === 'admin-dashboard' && <AdminDashboardView onNavigate={handleNavigate} />}
                  {currentTab === 'admin-members' && <AdminMembersView />}
                  {currentTab === 'admin-licenses' && <AdminLicensesView />}
                  {currentTab === 'admin-content' && <AdminContentView />}
                  {currentTab === 'admin-voices' && <AdminVoicesView />}
                  {currentTab === 'admin-ai-providers' && <AdminAIProvidersView />}
                  {currentTab === 'admin-workflows' && <AdminWorkflowsView />}
                  {currentTab === 'admin-production' && <AdminProductionView />}
                  {currentTab === 'admin-results' && <AdminResultsView />}
                  {currentTab === 'admin-quotas' && <AdminQuotasView />}
                  {currentTab === 'admin-releases' && <AdminReleasesView info={info} />}
                  {currentTab === 'admin-support' && <AdminSupportView />}
                  {currentTab === 'admin-analytics' && <AdminAnalyticsView />}
                  {currentTab === 'admin-system' && <AdminSystemView />}
                  {currentTab === 'admin-office' && <AdminOfficeView />}
                  {currentTab === 'admin-social' && <AdminSocialView />}
                  {currentTab === 'admin-lms' && <AdminLmsView />}
                </>
              )}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}

function Login({ info }: { info?: Info }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [clientError, setClientError] = useState<string | null>(null);

  // Forgot password state
  const [forgotSent, setForgotSent] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [resetNewPw, setResetNewPw] = useState('');

  // Server API URL config
  const [showServerCfg, setShowServerCfg] = useState(false);
  const [apiBaseInput, setApiBaseInput] = useState(info?.apiBase ?? 'https://motion.dentsweb.my.id');

  useEffect(() => {
    if (info?.apiBase) setApiBaseInput(info.apiBase);
  }, [info?.apiBase]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const login = useMutation({
    mutationFn: () => invoke<{ challengeId: string }>('auth:login', { email, password }),
    onSuccess: (r) => {
      setClientError(null);
      setChallenge(r.challengeId);
      setResendCooldown(60);
    },
  });

  const register = useMutation({
    mutationFn: () => invoke<{ challengeId: string }>('auth:register', { email, password, displayName }),
    onSuccess: (r) => {
      setClientError(null);
      setChallenge(r.challengeId);
      setResendCooldown(60);
    },
  });

  const verify = useMutation({
    mutationFn: (c: string) => invoke('auth:verify', { challengeId: challenge, code: c }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session'] }),
    onError: () => setCode(''),
  });

  const resendOtp = useMutation({
    mutationFn: () => invoke('auth:resend', { challengeId: challenge }),
    onSuccess: () => setResendCooldown(60),
  });

  const forgotReq = useMutation({
    mutationFn: () => mutate('POST', '/auth/password/forgot', { email: email.trim() }),
    onSuccess: () => {
      setForgotSent(true);
      setClientError(null);
    },
  });

  const resetReq = useMutation({
    mutationFn: () =>
      mutate('POST', '/auth/password/reset', {
        email: email.trim(),
        code: resetCode.trim(),
        newPassword: resetNewPw,
      }),
    onSuccess: () => {
      setForgotSent(false);
      setResetCode('');
      setResetNewPw('');
      setMode('login');
      setClientError(null);
      alert('Password berhasil direset! Silakan masuk dengan password baru Anda.');
    },
  });

  const saveServerUrl = useMutation({
    mutationFn: () => invoke<{ apiBase: string }>('config:set-api-base', { apiBase: apiBaseInput.trim() }),
    onSuccess: (res) => {
      setMediaBase(res.apiBase);
      qc.invalidateQueries({ queryKey: ['info'] });
      setShowServerCfg(false);
    },
  });

  function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (displayName.trim().length < 2) return setClientError('Nama minimal 2 karakter');
    if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return setClientError('Password minimal 10 karakter dan harus mengandung huruf & angka');
    }
    setClientError(null);
    register.mutate();
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-bg p-4">
      <div className="mx-auto w-full max-w-[420px] space-y-3">
        <Card className="p-7 shadow-xl border-line">
          <div className="text-center mb-6">
            <Mark className="justify-center" />
          </div>

          {!challenge ? (
            <div>
              {mode !== 'forgot' && (
                <div className="mb-6 flex rounded-xl border border-line bg-surface-2 p-1">
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setClientError(null); }}
                    className={clsx(
                      'flex-1 rounded-lg py-1.5 text-xs font-semibold transition cursor-pointer',
                      mode === 'login' ? 'bg-surface text-text shadow-xs' : 'text-muted hover:text-text'
                    )}
                  >
                    Masuk
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('register'); setClientError(null); }}
                    className={clsx(
                      'flex-1 rounded-lg py-1.5 text-xs font-semibold transition cursor-pointer',
                      mode === 'register' ? 'bg-surface text-text shadow-xs' : 'text-muted hover:text-text'
                    )}
                  >
                    Daftar Member
                  </button>
                </div>
              )}

              {mode === 'login' && (
                <form className="grid gap-4" onSubmit={(e) => (e.preventDefault(), login.mutate())}>
                  <div>
                    <h1 className="font-display text-xl font-semibold tracking-tight text-text">Masuk ke Studio</h1>
                    <p className="mt-1 text-xs text-muted">Gunakan email & password akun Superadmin atau Member Anda.</p>
                  </div>
                  <label className="grid gap-1.5 text-xs font-medium text-text">
                    Email
                    <Input type="email" autoComplete="email" placeholder="nama@email.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-text">
                    <span className="flex items-center justify-between">
                      <span>Password</span>
                      <button
                        type="button"
                        onClick={() => { setMode('forgot'); setForgotSent(false); setClientError(null); }}
                        className="text-[11px] text-accent hover:underline cursor-pointer"
                      >
                        Lupa password?
                      </button>
                    </span>
                    <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </label>
                  {login.isError && <p role="alert" className="text-xs text-bad">{errMsg(login.error)}</p>}
                  <Button disabled={login.isPending}>{login.isPending ? 'Memproses…' : 'Lanjut'}</Button>
                </form>
              )}

              {mode === 'register' && (
                <form className="grid gap-4" onSubmit={handleRegisterSubmit}>
                  <div>
                    <h1 className="font-display text-xl font-semibold tracking-tight text-text">Buat Akun Member</h1>
                    <p className="mt-1 text-xs text-muted">Daftar akun member baru DENTSWEB STUDIO.</p>
                  </div>
                  <label className="grid gap-1.5 text-xs font-medium text-text">
                    Nama Lengkap
                    <Input type="text" autoComplete="name" required placeholder="Nama Lengkap Anda" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-text">
                    Email
                    <Input type="email" autoComplete="email" required placeholder="member@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-text">
                    Password
                    <Input type="password" autoComplete="new-password" required placeholder="Min. 10 karakter (huruf & angka)" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </label>
                  {(clientError || register.isError) && (
                    <p role="alert" className="text-xs text-bad">{clientError ?? errMsg(register.error)}</p>
                  )}
                  <Button disabled={register.isPending}>{register.isPending ? 'Mendaftarkan…' : 'Daftar dan Kirim Kode'}</Button>
                </form>
              )}

              {mode === 'forgot' && (
                <div className="grid gap-4">
                  <div>
                    <h1 className="font-display text-xl font-semibold tracking-tight text-text">Reset Password</h1>
                    <p className="mt-1 text-xs text-muted">Masukkan email Anda untuk menerima kode OTP reset password.</p>
                  </div>
                  {!forgotSent ? (
                    <form className="grid gap-3" onSubmit={(e) => (e.preventDefault(), forgotReq.mutate())}>
                      <Input type="email" required placeholder="nama@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                      {forgotReq.isError && <p className="text-xs text-bad">{errMsg(forgotReq.error)}</p>}
                      <Button disabled={forgotReq.isPending}>{forgotReq.isPending ? 'Mengirim…' : 'Kirim Kode Reset'}</Button>
                    </form>
                  ) : (
                    <form className="grid gap-3" onSubmit={(e) => (e.preventDefault(), resetReq.mutate())}>
                      <Input placeholder="Kode OTP 6 digit" required value={resetCode} onChange={(e) => setResetCode(e.target.value)} />
                      <Input type="password" placeholder="Password baru (min. 10 karakter)" required value={resetNewPw} onChange={(e) => setResetNewPw(e.target.value)} />
                      {resetReq.isError && <p className="text-xs text-bad">{errMsg(resetReq.error)}</p>}
                      <Button disabled={resetReq.isPending}>{resetReq.isPending ? 'Menyimpan…' : 'Simpan Password Baru'}</Button>
                    </form>
                  )}
                  <button type="button" onClick={() => setMode('login')} className="text-xs text-muted hover:text-text cursor-pointer">
                    ← Kembali ke Masuk
                  </button>
                </div>
              )}
            </div>
          ) : (
            <form className="grid gap-4" onSubmit={(e) => (e.preventDefault(), verify.mutate(code))}>
              <h1 className="font-display text-xl font-semibold tracking-tight text-text">Kode Verifikasi OTP</h1>
              <p className="text-xs text-muted">
                Kode verifikasi 6 digit telah dikirim ke <strong className="text-text">{email}</strong>.
              </p>
              <Input
                aria-label="Kode OTP"
                autoFocus
                inputMode="numeric"
                className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setCode(v);
                  if (v.length === 6) verify.mutate(v);
                }}
              />
              {verify.isError && <p role="alert" className="text-xs text-bad">{errMsg(verify.error)}</p>}
              {resendOtp.isError && <p role="alert" className="text-xs text-bad">{errMsg(resendOtp.error)}</p>}
              <Button disabled={verify.isPending}>{verify.isPending ? 'Memverifikasi…' : 'Verifikasi & Masuk'}</Button>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  className="text-xs text-muted hover:text-text cursor-pointer"
                  onClick={() => { setChallenge(null); setCode(''); }}
                >
                  ← Kembali
                </button>
                <button
                  type="button"
                  disabled={resendCooldown > 0 || resendOtp.isPending}
                  onClick={() => resendOtp.mutate()}
                  className="text-xs text-accent hover:underline disabled:opacity-40 cursor-pointer"
                >
                  {resendCooldown > 0 ? `Kirim ulang (${resendCooldown}s)` : 'Kirim ulang kode OTP'}
                </button>
              </div>
            </form>
          )}
        </Card>

        {/* Server API URL Config Toggle */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowServerCfg((s) => !s)}
            className="inline-flex items-center gap-1.5 text-[11px] text-muted hover:text-text cursor-pointer"
          >
            <Icon name="settings" className="w-3.5 h-3.5" /> Server: {info?.apiBase ?? 'https://motion.dentsweb.my.id'}
          </button>
          {showServerCfg && (
            <Card className="mt-2 p-3 text-left space-y-2">
              <div className="flex gap-2">
                <Input
                  value={apiBaseInput}
                  onChange={(e) => setApiBaseInput(e.target.value)}
                  placeholder="https://motion.dentsweb.my.id"
                  className="h-8 text-xs font-mono flex-1"
                />
                <Button size="sm" disabled={saveServerUrl.isPending} onClick={() => saveServerUrl.mutate()}>
                  Simpan
                </Button>
              </div>
              {saveServerUrl.isError && <p className="text-[11px] text-bad">{errMsg(saveServerUrl.error)}</p>}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
