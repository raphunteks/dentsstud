import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { BridgeError, get, invoke } from './bridge';

interface Info { version: string; platform: string; arch: string; apiBase: string; secureStorage: boolean }
interface SessionUser { id: string; email: string; displayName: string; role: string }
interface Dash {
  stats: { readyToUpload: number; inProduction: number; uploaded: number; failed: number };
  license: { status: string; activeDevices: number };
  ai: { status: string; method: string | null };
}

const btn = 'inline-flex h-10 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-medium transition active:translate-y-px disabled:opacity-50';
const primary = `${btn} bg-accent text-accent-contrast hover:brightness-110`;
const ghost = `${btn} border border-line bg-surface hover:bg-surface-2`;
const input = 'h-11 w-full rounded-[10px] border border-line bg-surface px-3.5 text-[15px] outline-none focus:border-accent';

function Mark() {
  return (
    <span className="inline-flex items-center gap-2 font-display font-medium tracking-[-0.02em]">
      <span aria-hidden className="grid size-6 place-items-center rounded-[7px] bg-text">
        <span className="size-2 rounded-full bg-accent" />
      </span>
      DENTSWEB<span className="font-normal text-muted">STUDIO</span>
    </span>
  );
}
const Pill = ({ ok, children }: { ok?: boolean | null; children: ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs">
    <span className={clsx('size-1.5 rounded-full', ok === true ? 'bg-ok' : ok === false ? 'bg-bad' : 'bg-warn')} />
    {children}
  </span>
);
const Card = ({ children, className }: { children: ReactNode; className?: string }) => <section className={clsx('rounded-card border border-line bg-surface p-5', className)}>{children}</section>;
const errMsg = (e: unknown) => (e instanceof BridgeError ? e.message : (e as Error)?.message ?? 'Gagal');

export function App() {
  const info = useQuery({ queryKey: ['info'], queryFn: () => invoke<Info>('app:info') });
  const session = useQuery({ queryKey: ['session'], queryFn: () => invoke<{ user: SessionUser } | null>('auth:session') });
  const offline = useQuery({ queryKey: ['offline'], queryFn: () => invoke<{ valid: boolean; until?: string; reason?: string }>('license:offline-status') });

  if (session.isLoading) return <div className="grid min-h-dvh place-items-center text-muted">Memuat…</div>;
  if (session.isError) {
    return (
      <Shell info={info.data}>
        <Card>
          <h1 className="font-display text-2xl font-medium">Server tidak dapat dihubungi</h1>
          <p className="mt-2 text-sm text-muted">{errMsg(session.error)}</p>
          <p className="mt-2 text-sm">
            Mode offline: {offline.data?.valid ? <Pill ok>aktivasi berlaku sampai {new Date(offline.data.until!).toLocaleString('id-ID')}</Pill> : <Pill ok={false}>{offline.data?.reason}</Pill>}
          </p>
          <div className="mt-4 flex gap-2">
            <button className={ghost} onClick={() => session.refetch()}>Coba lagi</button>
          </div>
        </Card>
      </Shell>
    );
  }
  if (!session.data) return <Login info={info.data} />;
  return <Home user={session.data.user} info={info.data} />;
}

type Upd =
  | { state: 'idle' | 'checking' | 'none' }
  | { state: 'available'; version: string; notes: string | null; mode: 'install' | 'download' }
  | { state: 'downloading'; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string };

function UpdateBanner() {
  const [u, setU] = useState<Upd>({ state: 'idle' });
  useEffect(() => {
    void invoke<Upd>('update:state').then(setU).catch(() => undefined);
    const b = window.dentsweb ?? window.dentweb;
    return b ? b.onEvent((e) => e.channel === 'update:state' && setU(e.data as Upd)) : undefined;
  }, []);
  const apply = () => void invoke<Upd>('update:apply').catch(() => undefined);
  if (u.state === 'available')
    return (
      <div role="status" className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-accent/10 px-6 py-2.5 text-sm">
        <span>Versi {u.version} tersedia.{u.notes ? ` ${u.notes.slice(0, 140)}` : ''}</span>
        <button className={primary} onClick={apply}>{u.mode === 'install' ? 'Unduh & pasang' : 'Unduh DMG'}</button>
      </div>
    );
  if (u.state === 'downloading') return <div role="status" className="border-b border-line px-6 py-2.5 text-sm">Mengunduh pembaruan… {u.percent}%</div>;
  if (u.state === 'ready')
    return (
      <div role="status" className="flex items-center justify-between gap-3 border-b border-line bg-accent/10 px-6 py-2.5 text-sm">
        <span>Versi {u.version} siap dipasang.</span>
        <button className={primary} onClick={apply}>Mulai ulang & pasang</button>
      </div>
    );
  return null;
}

function Shell({ info, children }: { info?: Info; children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (typeof window !== 'undefined' && (localStorage.getItem('dentsweb-theme') as 'light' | 'dark')) || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dentsweb-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  return (
    <div className="min-h-dvh">
      <UpdateBanner />
      <header className="flex items-center justify-between border-b border-line px-6 py-3.5 pl-24" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <Mark />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Ganti tema"
            title={theme === 'light' ? 'Ganti ke tema gelap' : 'Ganti ke tema terang'}
            className="flex size-7 items-center justify-center rounded-lg border border-line bg-surface text-xs text-muted transition hover:bg-surface-2 hover:text-text cursor-pointer"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <span className="num text-xs text-muted">v{info?.version} · {info?.platform}/{info?.arch}</span>
        </div>
      </header>
      <main className="mx-auto max-w-[1100px] px-6 py-8">{children}</main>
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
    <Shell info={info}>
      <div className="mx-auto max-w-[440px] pt-4">
        <Card className="p-7 shadow-lg border-line/80">
          {!challenge ? (
            <div>
              <div className="mb-6 flex rounded-[10px] border border-line bg-surface-2 p-1">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setClientError(null); }}
                  className={clsx('flex-1 rounded-[8px] py-1.5 text-sm font-medium transition cursor-pointer', mode === 'login' ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text')}
                >
                  Masuk
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('register'); setClientError(null); }}
                  className={clsx('flex-1 rounded-[8px] py-1.5 text-sm font-medium transition cursor-pointer', mode === 'register' ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text')}
                >
                  Daftar Member Baru
                </button>
              </div>

              {mode === 'login' ? (
                <form className="grid gap-4" onSubmit={(e) => (e.preventDefault(), login.mutate())}>
                  <div>
                    <h1 className="font-display text-2xl font-medium tracking-[-0.02em]">Masuk ke Studio</h1>
                    <p className="mt-1 text-xs text-muted">Gunakan email & password akun Superadmin atau Member Anda.</p>
                  </div>
                  <label className="grid gap-1.5 text-sm">
                    Email
                    <input className={input} type="email" autoComplete="email" placeholder="nama@email.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    Password
                    <input className={input} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </label>
                  {login.isError && <p role="alert" className="text-sm text-bad">{errMsg(login.error)}</p>}
                  <button className={primary} disabled={login.isPending}>
                    {login.isPending ? 'Memproses…' : 'Lanjut'}
                  </button>
                  {info && !info.secureStorage && <p className="text-xs text-warn">Keychain OS tidak tersedia: sesi hanya disimpan selama aplikasi terbuka.</p>}
                </form>
              ) : (
                <form className="grid gap-4" onSubmit={handleRegisterSubmit}>
                  <div>
                    <h1 className="font-display text-2xl font-medium tracking-[-0.02em]">Buat Akun Member</h1>
                    <p className="mt-1 text-xs text-muted">Daftar akun member baru DENTSWEB STUDIO. Kode verifikasi akan dikirim ke email Anda.</p>
                  </div>
                  <label className="grid gap-1.5 text-sm">
                    Nama Lengkap
                    <input className={input} type="text" autoComplete="name" required placeholder="Budi Santoso" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    Email
                    <input className={input} type="email" autoComplete="email" required placeholder="member@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    Password
                    <input className={input} type="password" autoComplete="new-password" required placeholder="Min. 10 karakter (huruf & angka)" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </label>
                  {(clientError || register.isError) && <p role="alert" className="text-sm text-bad">{clientError ?? errMsg(register.error)}</p>}
                  <button className={primary} disabled={register.isPending}>
                    {register.isPending ? 'Mendaftarkan…' : 'Daftar dan Kirim Kode'}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <form className="grid gap-4" onSubmit={(e) => (e.preventDefault(), verify.mutate(code))}>
              <h1 className="font-display text-2xl font-medium tracking-[-0.02em]">Kode OTP</h1>
              <p className="text-sm text-muted">Kode verifikasi 6 digit dikirim ke <strong className="text-text">{email}</strong>.</p>
              <input
                aria-label="Kode OTP"
                autoFocus
                inputMode="numeric"
                className={`${input} h-14 text-center font-mono text-2xl tracking-[0.5em]`}
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setCode(v);
                  if (v.length === 6) verify.mutate(v);
                }}
              />
              {verify.isError && <p role="alert" className="text-sm text-bad">{errMsg(verify.error)}</p>}
              <button className={primary} disabled={verify.isPending}>
                {verify.isPending ? 'Memverifikasi…' : 'Verifikasi'}
              </button>
              <button type="button" className="text-sm text-muted hover:text-text cursor-pointer" onClick={() => { setChallenge(null); setCode(''); }}>
                ← Kembali
              </button>
            </form>
          )}
        </Card>
      </div>
    </Shell>
  );
}

function Home({ user, info }: { user: SessionUser; info?: Info }) {
  const qc = useQueryClient();
  const dash = useQuery({ queryKey: ['dash'], queryFn: () => get<Dash>('/me/dashboard'), refetchInterval: 20_000 });
  const offline = useQuery({ queryKey: ['offline'], queryFn: () => invoke<{ valid: boolean; until?: string; reason?: string }>('license:offline-status') });
  const activate = useMutation({ mutationFn: () => invoke<{ offlineUntil: string }>('license:activate'), onSuccess: () => qc.invalidateQueries() });
  const detect = useQuery({ queryKey: ['claude-detect'], queryFn: () => invoke<{ installed: boolean; version?: string; path?: string }>('claude:detect') });
  const test = useMutation({
    mutationFn: () => invoke<{ ok: boolean; answer?: string; error?: string; latencyMs?: number }>('claude:test', { prompt: 'Jawab singkat dalam bahasa Indonesia: apa ibu kota Indonesia?' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dash'] }),
  });
  const logout = useMutation({ mutationFn: () => invoke('auth:logout'), onSuccess: () => qc.invalidateQueries() });

  const s = dash.data?.stats;
  const [tab, setTab] = useState<'home' | 'render' | 'offline' | 'import'>('home');
  const tabs: [typeof tab, string][] = [['home', 'Beranda'], ['render', 'Render lokal'], ['offline', 'Project offline'], ...(user.role === 'SUPERADMIN' ? ([['import', 'Import folder']] as [typeof tab, string][]) : [])];
  if (tab !== 'home')
    return (
      <Shell info={info}>
        <nav aria-label="Menu desktop" className="mb-6 flex gap-1">{tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} aria-current={tab === k} className={clsx('h-9 rounded-lg px-3 text-sm', tab === k ? 'bg-surface-2 font-medium' : 'text-muted')}>{l}</button>)}</nav>
        {tab === 'render' && <LocalRender />}
        {tab === 'offline' && <OfflineProjects />}
        {tab === 'import' && <FolderImport />}
      </Shell>
    );
  return (
    <Shell info={info}>
      <nav aria-label="Menu desktop" className="mb-6 flex gap-1">{tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} aria-current={tab === k} className={clsx('h-9 rounded-lg px-3 text-sm', tab === k ? 'bg-surface-2 font-medium' : 'text-muted')}>{l}</button>)}</nav>
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Desktop · {user.role}</p>
          <h1 className="font-display text-3xl font-medium tracking-[-0.02em]">Halo, {user.displayName}</h1>
        </div>
        <button className={ghost} onClick={() => logout.mutate()}>Keluar</button>
      </div>
      {dash.isError && <p className="mb-4 text-sm text-bad">{errMsg(dash.error)}</p>}
      <div className="grid grid-cols-4 gap-3">
        {[['Siap upload', s?.readyToUpload], ['Sedang diproduksi', s?.inProduction], ['Diunggah', s?.uploaded], ['Gagal', s?.failed]].map(([k, v]) => (
          <Card key={String(k)}>
            <p className="text-sm text-muted">{k}</p>
            <p className="num mt-3 text-3xl">{v ?? '—'}</p>
          </Card>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Card>
          <h2 className="font-display text-lg font-medium">Lisensi perangkat ini</h2>
          <p className="mt-3 flex flex-wrap gap-2 text-sm">
            Server: <Pill ok={dash.data?.license.status === 'ACTIVE'}>{dash.data?.license.status ?? '…'}</Pill>
            Offline: <Pill ok={offline.data?.valid}>{offline.data?.valid ? `sampai ${new Date(offline.data.until!).toLocaleString('id-ID')}` : 'belum aktif'}</Pill>
          </p>
          <button className={`${primary} mt-4`} disabled={activate.isPending} onClick={() => activate.mutate()}>
            {activate.isPending ? 'Mengaktifkan…' : 'Aktifkan perangkat ini'}
          </button>
          {activate.isError && <p role="alert" className="mt-2 text-sm text-bad">{errMsg(activate.error)}</p>}
          {activate.isSuccess && <p className="mt-2 text-sm text-ok">Perangkat aktif. Bukti offline berlaku sampai {new Date(activate.data.offlineUntil).toLocaleString('id-ID')}.</p>}
        </Card>
        <Card>
          <h2 className="font-display text-lg font-medium">Claude Code (lokal)</h2>
          <p className="mt-3 text-sm">
            {detect.isLoading ? 'Mendeteksi…' : detect.data?.installed ? <Pill ok>Terpasang {detect.data.version}</Pill> : <Pill ok={false}>Tidak ditemukan</Pill>}{' '}
            · status server <Pill ok={dash.data?.ai.status === 'CONNECTED'}>{dash.data?.ai.status ?? '…'}</Pill>
          </p>
          {!detect.data?.installed && !detect.isLoading && (
            <p className="mt-2 text-sm text-muted">Pasang Claude Code resmi dari Anthropic, login di terminal, lalu deteksi ulang.</p>
          )}
          <div className="mt-4 flex gap-2">
            <button className={ghost} onClick={() => detect.refetch()}>Deteksi ulang</button>
            <button className={primary} disabled={!detect.data?.installed || test.isPending} onClick={() => test.mutate()}>
              {test.isPending ? 'Menunggu jawaban…' : 'Tes jawab'}
            </button>
          </div>
          {test.data && (test.data.ok ? <p className="mt-3 rounded-lg bg-surface-2 p-3 text-sm">{test.data.answer} <span className="num text-xs text-muted">({test.data.latencyMs} ms)</span></p> : <p className="mt-3 text-sm text-bad">{test.data.error}</p>)}
          {test.isError && <p className="mt-3 text-sm text-bad">{errMsg(test.error)}</p>}
        </Card>
      </div>
    </Shell>
  );
}



function LocalRender() {
  const qc = useQueryClient();
  const cap = useQuery({ queryKey: ['render-cap'], queryFn: () => invoke<{ chrome: string | null }>('render:capability') });
  const jobs = useQuery({ queryKey: ['jobs'], queryFn: () => get<{ id: string; projectName: string; mode: string; status: string; progress: number; outputs: { url: string; format: string }[] }[]>('/render/jobs'), refetchInterval: 4000 });
  const [prog, setProg] = useState<Record<string, number>>({});
  useEffect(() => {
    const b = window.dentsweb ?? window.dentweb;
    return b ? b.onEvent((e) => e.channel === 'render:progress' && e.data.jobId && setProg((p) => ({ ...p, [e.data.jobId!]: e.data.progress }))) : undefined;
  }, []);
  const run = useMutation({ mutationFn: (jobId: string) => invoke('render:local', { jobId }), onSettled: () => qc.invalidateQueries({ queryKey: ['jobs'] }) });
  const local = jobs.data?.filter((j) => j.mode === 'LOCAL') ?? [];
  return (
    <div className="grid gap-3">
      <h1 className="font-display text-2xl font-medium">Render lokal</h1>
      <p className="text-sm text-muted">Browser render: {cap.data?.chrome ? <Pill ok>{cap.data.chrome.split(/[\\/]/).pop()}</Pill> : <Pill ok={false}>Chrome/Edge tidak ditemukan</Pill>} · Buat job "Render lokal" dari Motion Editor di web, lalu jalankan di sini.</p>
      {run.isError && <p role="alert" className="text-sm text-bad">{errMsg(run.error)}</p>}
      {local.length === 0 && <Card><p className="text-sm text-muted">Belum ada job render lokal.</p></Card>}
      {local.map((j) => (
        <Card key={j.id} className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="font-medium">{j.projectName}</p><p className="text-xs text-muted">{j.status} · {Math.round((prog[j.id] ?? j.progress / 100) * 100)}%</p></div>
          <div className="flex gap-2">
            {j.status === 'AWAITING_LOCAL' && <button className={primary} disabled={!cap.data?.chrome || run.isPending} onClick={() => run.mutate(j.id)}>Render di komputer ini</button>}
            {j.status === 'RUNNING' && <button className={ghost} onClick={() => invoke('render:cancel', { jobId: j.id })}>Hentikan</button>}
            {j.outputs.map((o) => <button key={o.url} className={ghost} onClick={() => invoke('shell:open-external', { url: o.url.startsWith('http') ? o.url : `${'https://'}${o.url}` }).catch(() => undefined)}>Hasil {o.format}</button>)}
          </div>
        </Card>
      ))}
    </div>
  );
}

function OfflineProjects() {
  const qc = useQueryClient();
  const remote = useQuery({ queryKey: ['remote-projects'], queryFn: () => get<{ id: string; name: string }[]>('/projects'), retry: false });
  const local = useQuery({ queryKey: ['local-projects'], queryFn: () => invoke<{ id: string; name: string; revision: number; pendingOps: number; document: { title: string; scenes: { id: string; name: string; layers: { id: string; type: string; text?: string }[] }[] } }[]>('projects:local-list') });
  const cache = useMutation({ mutationFn: (projectId: string) => invoke('projects:cache', { projectId }), onSuccess: () => qc.invalidateQueries({ queryKey: ['local-projects'] }) });
  const op = useMutation({ mutationFn: (v: { projectId: string; ops: object[] }) => invoke('projects:local-op', v), onSuccess: () => qc.invalidateQueries({ queryKey: ['local-projects'] }) });
  const sync = useMutation({ mutationFn: () => invoke<{ status: string; conflictCopy?: string }[]>('projects:sync'), onSuccess: () => qc.invalidateQueries() });
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between"><h1 className="font-display text-2xl font-medium">Project offline</h1><button className={primary} disabled={sync.isPending} onClick={() => sync.mutate()}>Sinkronkan sekarang</button></div>
      {sync.data && <p className="text-sm" role="status">{sync.data.length} operasi diproses{sync.data.some((r) => r.conflictCopy) ? ' · ada konflik: salinan project dibuat, tidak ada perubahan yang hilang' : ''}.</p>}
      {remote.data && <Card><h2 className="font-medium">Simpan untuk offline</h2><div className="mt-2 flex flex-wrap gap-2">{remote.data.map((p) => <button key={p.id} className={ghost} onClick={() => cache.mutate(p.id)}>{p.name}</button>)}</div></Card>}
      {remote.isError && <p className="text-sm text-muted">Sedang offline: daftar project server tidak tersedia, project tersimpan tetap bisa disunting.</p>}
      {local.data?.map((p) => (
        <Card key={p.id}>
          <div className="flex items-center justify-between"><h2 className="font-medium">{p.document.title}</h2><Pill ok={p.pendingOps === 0}>{p.pendingOps ? `${p.pendingOps} perubahan menunggu sync` : `rev ${p.revision}`}</Pill></div>
          <div className="mt-3 grid gap-2">
            {p.document.scenes.flatMap((sc) => sc.layers.filter((l) => l.type === 'text').map((l) => (
              <label key={l.id} className="grid gap-1 text-xs text-muted">{sc.name || sc.id}
                <input className={input} defaultValue={l.text} onBlur={(e) => e.target.value !== l.text && op.mutate({ projectId: p.id, ops: [{ op: 'updateLayer', sceneId: sc.id, layerId: l.id, patch: { text: e.target.value } }] })} />
              </label>
            )))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function FolderImport() {
  const [kind, setKind] = useState<'preset' | 'voice' | 'hook'>('preset');
  const [p, setP] = useState(0);
  useEffect(() => {
    const b = window.dentsweb ?? window.dentweb;
    return b ? b.onEvent((e) => e.channel === 'import:progress' && setP(e.data.progress)) : undefined;
  }, []);
  const run = useMutation({ mutationFn: () => invoke<{ canceled?: boolean; validated?: { id: string; status: string; items: { originalPath: string; status: string; validationErrors: string[] }[] }; skipped?: string[] }>('import:folder', { kind }) });
  const commit = useMutation({ mutationFn: (batchId: string) => invoke<{ status: string }>('api:mutate', { method: 'POST', path: '/admin/imports/commit', body: { batchId } }) });
  const v = run.data?.validated;
  return (
    <div className="grid gap-4">
      <h1 className="font-display text-2xl font-medium">Import folder lokal</h1>
      <Card className="flex flex-wrap items-center gap-3">
        <select aria-label="Jenis konten" className={`${input} w-auto`} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="preset">Preset gaya</option><option value="voice">Suara</option><option value="hook">Hook</option></select>
        <button className={primary} disabled={run.isPending} onClick={() => (setP(0), run.mutate())}>{run.isPending ? `Mengunggah ${Math.round(p * 100)}%` : 'Pilih folder dan validasi'}</button>
      </Card>
      {run.isError && <p role="alert" className="text-sm text-bad">{errMsg(run.error)}</p>}
      {v && (
        <Card>
          <div className="flex items-center justify-between"><h2 className="font-medium">Hasil validasi · {v.status}</h2>
            <button className={primary} disabled={commit.isPending || !v.items.some((i) => i.status === 'VALID')} onClick={() => commit.mutate(v.id)}>Commit sebagai Draft</button></div>
          <ul className="mt-3 grid gap-2 text-sm">{v.items.map((i) => <li key={i.originalPath}><Pill ok={i.status === 'VALID' ? true : i.status === 'DUPLICATE' ? null : false}>{i.status}</Pill> <span className="font-mono text-xs">{i.originalPath}</span>{i.validationErrors.length > 0 && <span className="block text-xs text-muted">{i.validationErrors.join(' · ')}</span>}</li>)}</ul>
          {!!run.data?.skipped?.length && <p className="mt-2 text-xs text-muted">Dilewati: {run.data.skipped.slice(0, 10).join(', ')}</p>}
          {commit.data && <p className="mt-2 text-sm text-ok" role="status">Status commit: {commit.data.status}. Publikasikan dari Content Library.</p>}
        </Card>
      )}
    </div>
  );
}
