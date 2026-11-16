import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { get, invoke } from './bridge';
import { Button, Card, Input, Mark, errMsg } from './components/UI';
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
import { AdminLicensesView, AdminMembersView, AdminSystemView } from './views/SuperadminViews';
import type { Dash, Info, NavTab, OfflineStatus, SessionUser } from './types';

export function App() {
  const info = useQuery({ queryKey: ['info'], queryFn: () => invoke<Info>('app:info') });
  const session = useQuery({ queryKey: ['session'], queryFn: () => invoke<{ user: SessionUser } | null>('auth:session') });
  const offline = useQuery({ queryKey: ['offline'], queryFn: () => invoke<OfflineStatus>('license:offline-status') });

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

  if (session.isError) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg p-4">
        <Card className="max-w-md w-full p-6 text-center space-y-4">
          <Mark />
          <h1 className="font-display text-xl font-medium text-text">Server sedang dalam pemeliharaan</h1>
          <p className="text-xs text-muted">{errMsg(session.error)}</p>
          <Button onClick={() => session.refetch()} className="w-full">
            Coba lagi
          </Button>
        </Card>
      </div>
    );
  }

  if (!session.data) {
    return <Login info={info.data} />;
  }

  return <StudioShell user={session.data.user} info={info.data} offline={offline.data} />;
}

function StudioShell({ user, info, offline }: { user: SessionUser; info?: Info; offline?: OfflineStatus }) {
  const qc = useQueryClient();
  const [currentTab, setCurrentTab] = useState<NavTab>('beranda');

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (typeof window !== 'undefined' && (localStorage.getItem('dentsweb-theme') as 'light' | 'dark')) || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dentsweb-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  const dash = useQuery({
    queryKey: ['dash'],
    queryFn: () => get<Dash>('/me/dashboard').catch(() => undefined),
    refetchInterval: 15_000,
  });

  const logout = useMutation({
    mutationFn: () => invoke('auth:logout'),
    onSuccess: () => qc.invalidateQueries(),
  });

  return (
    <div className="flex h-dvh w-screen overflow-hidden bg-bg text-text">
      {/* Motion Lab Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        user={user}
        onLogout={() => logout.mutate()}
        theme={theme}
        onToggleTheme={toggleTheme}
        activeCount={dash.data?.stats?.inProduction ?? 0}
        presetsCount={dash.data?.catalog?.publishedPresets ?? 81}
      />

      {/* Main Workspace Frame */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* macOS Traffic Lights Drag Handle Header */}
        <header
          className={clsx(
            'flex h-11 items-center justify-between border-b border-line bg-surface/50 backdrop-blur-xs px-6 select-none shrink-0',
            info?.platform === 'darwin' ? 'pl-20' : 'pl-6'
          )}
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold capitalize tracking-wide text-text">
              {currentTab.replace('-', ' ')}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <span className="num font-mono text-[11px]">v{info?.version ?? '1.0.0'}</span>
          </div>
        </header>

        {/* View Content Canvas */}
        <main className="flex-1 overflow-y-auto px-6 py-6 md:px-8">
          <div className="mx-auto max-w-[1200px]">
            {currentTab === 'beranda' && (
              <BerandaView user={user} dash={dash.data} offline={offline} onNavigate={setCurrentTab} />
            )}
            {currentTab === 'buat-konten' && (
              <BuatKontenView onSuccess={() => dash.refetch()} onNavigate={setCurrentTab} />
            )}
            {currentTab === 'progress' && (
              <ProgressView onNavigate={setCurrentTab} />
            )}
            {currentTab === 'hasil' && (
              <HasilView onNavigate={setCurrentTab} />
            )}
            {currentTab === 'galeri-gaya' && (
              <GaleriGayaView onNavigate={setCurrentTab} />
            )}
            {currentTab === 'suara' && (
              <SuaraView onNavigate={setCurrentTab} />
            )}
            {currentTab === 'pengaturan' && (
              <PengaturanView user={user} dash={dash.data} offline={offline} />
            )}
            {currentTab === 'bantuan' && (
              <BantuanView />
            )}
            {currentTab === 'render-lokal' && (
              <LocalRenderView />
            )}
            {currentTab === 'project-offline' && (
              <OfflineProjectsView />
            )}
            {currentTab === 'import-folder' && (
              <FolderImportView />
            )}
            {currentTab === 'admin-members' && (
              <AdminMembersView />
            )}
            {currentTab === 'admin-licenses' && (
              <AdminLicensesView />
            )}
            {currentTab === 'admin-system' && (
              <AdminSystemView />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function Login({ info }: { info?: Info }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: () => invoke<{ challengeId: string }>('auth:login', { email, password }),
    onSuccess: (r) => {
      setClientError(null);
      setChallenge(r.challengeId);
    },
  });

  const register = useMutation({
    mutationFn: () => invoke<{ challengeId: string }>('auth:register', { email, password, displayName }),
    onSuccess: (r) => {
      setClientError(null);
      setChallenge(r.challengeId);
    },
  });

  const verify = useMutation({
    mutationFn: (c: string) => invoke('auth:verify', { challengeId: challenge, code: c }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session'] }),
    onError: () => setCode(''),
  });

  function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (displayName.trim().length < 2) {
      setClientError('Nama minimal 2 karakter');
      return;
    }
    if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setClientError('Password minimal 10 karakter dan harus mengandung huruf & angka');
      return;
    }
    setClientError(null);
    register.mutate();
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-bg p-4">
      <div className="mx-auto w-full max-w-[420px]">
        <Card className="p-7 shadow-xl border-line">
          <div className="text-center mb-6">
            <Mark className="justify-center" />
          </div>

          {!challenge ? (
            <div>
              <div className="mb-6 flex rounded-xl border border-line bg-surface-2 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setClientError(null);
                  }}
                  className={clsx(
                    'flex-1 rounded-lg py-1.5 text-xs font-semibold transition cursor-pointer',
                    mode === 'login' ? 'bg-surface text-text shadow-xs' : 'text-muted hover:text-text'
                  )}
                >
                  Masuk
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setClientError(null);
                  }}
                  className={clsx(
                    'flex-1 rounded-lg py-1.5 text-xs font-semibold transition cursor-pointer',
                    mode === 'register' ? 'bg-surface text-text shadow-xs' : 'text-muted hover:text-text'
                  )}
                >
                  Daftar Member
                </button>
              </div>

              {mode === 'login' ? (
                <form className="grid gap-4" onSubmit={(e) => (e.preventDefault(), login.mutate())}>
                  <div>
                    <h1 className="font-display text-xl font-semibold tracking-tight text-text">
                      Masuk ke Studio
                    </h1>
                    <p className="mt-1 text-xs text-muted">
                      Gunakan email & password akun Superadmin atau Member Anda.
                    </p>
                  </div>
                  <label className="grid gap-1.5 text-xs font-medium text-text">
                    Email
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="nama@email.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-text">
                    Password
                    <Input
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </label>
                  {login.isError && (
                    <p role="alert" className="text-xs text-bad">
                      {errMsg(login.error)}
                    </p>
                  )}
                  <Button disabled={login.isPending}>
                    {login.isPending ? 'Memproses…' : 'Lanjut'}
                  </Button>
                </form>
              ) : (
                <form className="grid gap-4" onSubmit={handleRegisterSubmit}>
                  <div>
                    <h1 className="font-display text-xl font-semibold tracking-tight text-text">
                      Buat Akun Member
                    </h1>
                    <p className="mt-1 text-xs text-muted">
                      Daftar akun member baru DENTSWEB STUDIO.
                    </p>
                  </div>
                  <label className="grid gap-1.5 text-xs font-medium text-text">
                    Nama Lengkap
                    <Input
                      type="text"
                      autoComplete="name"
                      required
                      placeholder="Nama Lengkap Anda"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-text">
                    Email
                    <Input
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="member@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-text">
                    Password
                    <Input
                      type="password"
                      autoComplete="new-password"
                      required
                      placeholder="Min. 10 karakter (huruf & angka)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </label>
                  {(clientError || register.isError) && (
                    <p role="alert" className="text-xs text-bad">
                      {clientError ?? errMsg(register.error)}
                    </p>
                  )}
                  <Button disabled={register.isPending}>
                    {register.isPending ? 'Mendaftarkan…' : 'Daftar dan Kirim Kode'}
                  </Button>
                </form>
              )}
            </div>
          ) : (
            <form className="grid gap-4" onSubmit={(e) => (e.preventDefault(), verify.mutate(code))}>
              <h1 className="font-display text-xl font-semibold tracking-tight text-text">
                Kode Verifikasi OTP
              </h1>
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
              {verify.isError && (
                <p role="alert" className="text-xs text-bad">
                  {errMsg(verify.error)}
                </p>
              )}
              <Button disabled={verify.isPending}>
                {verify.isPending ? 'Memverifikasi…' : 'Verifikasi & Masuk'}
              </Button>
              <button
                type="button"
                className="text-xs text-muted hover:text-text cursor-pointer"
                onClick={() => {
                  setChallenge(null);
                  setCode('');
                }}
              >
                ← Kembali
              </button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
