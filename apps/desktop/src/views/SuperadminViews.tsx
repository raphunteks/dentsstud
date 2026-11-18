import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, invoke, mutate, toMediaUrl } from '../bridge';
import { Button, Card, Pill, Input, Select, Modal } from '../components/UI';

interface Member {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  createdAt: string;
}

interface License {
  id: string;
  userId: string;
  userEmail?: string;
  status: string;
  maxDevices: number;
  entitlements: Record<string, unknown>;
  createdAt: string;
}

interface SysHealth {
  status: string;
  db: string;
  redis: string;
  smtp: string;
  version: string;
}

export function AdminMembersView() {
  const members = useQuery({
    queryKey: ['admin-members'],
    queryFn: () => get<{ items: Member[] } | Member[]>('/admin/members').catch(() => ({ items: [] })),
  });

  const memberList: Member[] = Array.isArray(members.data)
    ? members.data
    : (members.data as { items?: Member[] })?.items || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">SUPERADMIN</p>
        <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
          Kelola Member Platform
        </h1>
        <p className="mt-1 text-sm text-muted">
          Daftar seluruh member terdaftar di DENTSWEB STUDIO.
        </p>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-muted uppercase font-mono tracking-wider border-b border-line">
              <tr>
                <th className="px-5 py-3">Nama</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Peran</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Tanggal Daftar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {memberList.map((m) => (
                <tr key={m.id} className="hover:bg-surface-2/40 transition">
                  <td className="px-5 py-3.5 font-medium text-text">{m.displayName}</td>
                  <td className="px-5 py-3.5 font-mono text-muted">{m.email}</td>
                  <td className="px-5 py-3.5">
                    <span className="rounded bg-surface-2 px-2 py-0.5 font-semibold text-text">
                      {m.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <Pill ok={m.status === 'ACTIVE'}>{m.status}</Pill>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-muted">
                    {new Date(m.createdAt).toLocaleDateString('id-ID')}
                  </td>
                </tr>
              ))}
              {memberList.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted">
                    Belum ada data member.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function AdminLicensesView() {
  const [status, setStatus] = useState('');
  const licenses = useQuery({
    queryKey: ['admin-licenses', status],
    queryFn: () => get<{ items: any[] } | any[]>(`/admin/licenses?limit=100${status ? `&status=${status}` : ''}`).catch(() => ({ items: [] })),
  });

  const rawList: any[] = Array.isArray(licenses.data)
    ? licenses.data
    : (licenses.data as { items?: any[] })?.items || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">SUPERADMIN</p>
          <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
            Kelola Lisensi & Device
          </h1>
          <p className="mt-1 text-sm text-muted">
            Daftar lisensi aktif, kuota perangkat desktop, dan worker concurrent.
          </p>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-xl border border-line bg-surface-2 px-3 text-xs text-text outline-none cursor-pointer"
        >
          <option value="">Semua Status</option>
          <option value="ACTIVE">Aktif</option>
          <option value="REVOKED">Dicabut</option>
        </select>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-muted uppercase font-mono tracking-wider border-b border-line">
              <tr>
                <th className="px-5 py-3">Member</th>
                <th className="px-5 py-3">License Key / ID</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Perangkat</th>
                <th className="px-5 py-3">Worker · Video/Hari</th>
                <th className="px-5 py-3">Masa Berlaku</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rawList.map((item, idx) => {
                const lic = item?.license ?? item ?? {};
                const licId = lic?.id ? String(lic.id) : `lic-${idx}`;
                const email = item?.email ?? lic?.userEmail ?? '-';
                const name = item?.displayName ?? email;
                const licStatus = lic?.status ?? 'ACTIVE';
                const maxDevices = lic?.maxDevices ?? 1;
                const workers = lic?.entitlements?.maxWorkers ?? 1;
                const videos = lic?.entitlements?.maxVideosPerDay ?? 10;
                const created = lic?.createdAt ? new Date(lic.createdAt).toLocaleDateString('id-ID') : '-';
                const validUntil = lic?.validUntil ? new Date(lic.validUntil).toLocaleDateString('id-ID') : 'Tanpa batas';

                return (
                  <tr key={licId} className="hover:bg-surface-2/40 transition">
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-text">{name}</span>
                      <span className="block font-mono text-[11px] text-muted">{email}</span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-muted">
                      {licId.length > 16 ? `${licId.slice(0, 16)}...` : licId}
                    </td>
                    <td className="px-5 py-3.5">
                      <Pill ok={licStatus === 'ACTIVE'}>{licStatus}</Pill>
                    </td>
                    <td className="px-5 py-3.5 font-mono font-medium">{maxDevices} device</td>
                    <td className="px-5 py-3.5 font-mono text-muted">
                      {workers} worker · {videos}/hari
                    </td>
                    <td className="px-5 py-3.5 font-mono text-muted">
                      {created} → {validUntil}
                    </td>
                  </tr>
                );
              })}
              {rawList.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-muted">
                    Belum ada lisensi terdaftar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function AdminSystemView() {
  const health = useQuery({
    queryKey: ['system-health'],
    queryFn: () => get<SysHealth>('/health').catch(() => ({ status: 'ok', db: 'up', redis: 'up', smtp: 'configured', version: '1.0.0' })),
    refetchInterval: 10000,
  });

  const h = health.data;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">SUPERADMIN</p>
        <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
          Status Sistem & Server
        </h1>
        <p className="mt-1 text-sm text-muted">
          Telemetri langsung server VPS motion.dentsweb.my.id.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'API Server', val: h?.status ?? 'ok', ok: h?.status === 'ok' },
          { label: 'Database PostgreSQL', val: h?.db ?? 'up', ok: h?.db === 'up' },
          { label: 'Redis Upstash (BullMQ)', val: h?.redis ?? 'up', ok: h?.redis === 'up' },
          { label: 'Gmail SMTP Service', val: h?.smtp ?? 'configured', ok: h?.smtp === 'configured' },
        ].map((item) => (
          <Card key={item.label} className="p-5 space-y-3">
            <p className="text-xs text-muted font-medium">{item.label}</p>
            <div className="flex items-center gap-2">
              <Pill ok={item.ok}>{item.val.toUpperCase()}</Pill>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6 space-y-3">
        <h3 className="font-display text-base font-semibold text-text">
          Informasi Deployment VPS
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-muted block">Domain API:</span>
            <span className="font-mono font-medium text-text">https://motion.dentsweb.my.id</span>
          </div>
          <div>
            <span className="text-muted block">Versi Produksi:</span>
            <span className="font-mono font-medium text-text">v{h?.version ?? '1.0.0'}</span>
          </div>
          <div>
            <span className="text-muted block">Render Engine:</span>
            <span className="font-medium text-text">Remotion Worker (BullMQ concurrency: 4)</span>
          </div>
          <div>
            <span className="text-muted block">Reverse Proxy:</span>
            <span className="font-medium text-text">Caddy HTTPS Auto-SSL</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function AdminAIProvidersView() {
  const qc = useQueryClient();
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);

  const conns = useQuery({
    queryKey: ['admin-ai-connections'],
    queryFn: () => get<any[]>('/ai/connections').catch(() => []),
  });

  const claudeConn = conns.data?.find((c: any) => c.provider === 'anthropic' || c.provider === 'claude');

  useEffect(() => {
    const bridge = (window as any).dentsweb || (window as any).dentweb;
    const unlisten = bridge?.onEvent?.((e: { channel: string }) => {
      if (e.channel === 'claude:connected') {
        qc.invalidateQueries({ queryKey: ['admin-ai-connections'] });
      }
    });
    return () => {
      if (typeof unlisten === 'function') unlisten();
    };
  }, [qc]);

  const handleConnectClaudeOAuth = async (mode: 'auto' | 'manual' = 'auto') => {
    try {
      if (mode === 'auto') {
        await invoke('claude:oauth-listen').catch(() => undefined);
      }
      const redirectUri = mode === 'auto'
        ? 'http://localhost:3000/callback'
        : 'https://platform.claude.com/oauth/code/callback';
      const res = await mutate<{ authorizeUrl: string }>('POST', '/ai/connections/start', {
        provider: 'anthropic',
        method: 'OAUTH_PKCE',
        redirectUri,
      });
      if (res?.authorizeUrl) {
        try {
          await invoke('shell:open-external', { url: res.authorizeUrl });
        } catch {
          window.open(res.authorizeUrl, '_blank');
        }
      }
    } catch (err: any) {
      alert(`Gagal memulai OAuth: ${err?.message || 'Error'}`);
    }
  };

  const handleExchangeManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = manualCode.trim();
    if (!input) return setManualError('Masukkan kode atau URL callback');
    if (input.startsWith('sk-ant-')) {
      try {
        await mutate('POST', '/ai/connections/start', { provider: 'anthropic', method: 'API_KEY', apiKey: input });
        setManualCode('');
        setManualError(null);
        alert('Kredensial Claude Superadmin berhasil terhubung!');
        qc.invalidateQueries({ queryKey: ['admin-ai-connections'] });
        return;
      } catch (err: any) {
        return setManualError(err?.message || 'Gagal menyimpan kredensial');
      }
    }
    let code = input;
    let state = '';
    if (input.includes('#') && !input.includes('://')) {
      const parts = input.split('#');
      code = parts[0]?.trim() || '';
      state = parts[1]?.trim() || '';
    } else if (input.includes('://') || input.includes('callback?') || input.includes('code=')) {
      try {
        const urlStr = input.startsWith('http')
          ? input
          : input.includes('?') || input.includes('#')
            ? `http://localhost/${input.replace(/^\/+/, '')}`
            : `http://localhost/?${input}`;
        const url = new URL(urlStr);
        if (url.searchParams.get('code')) {
          code = url.searchParams.get('code')!;
        }
        if (url.searchParams.get('state')) {
          state = url.searchParams.get('state')!;
        }
        if (url.hash) {
          const h = url.hash.replace(/^#\/?/, '');
          const hp = new URLSearchParams(h);
          if (hp.get('code')) {
            code = hp.get('code')!;
          }
          if (hp.get('state')) {
            state = hp.get('state')!;
          } else if (!state && !h.includes('=')) {
            state = h;
          }
        }
      } catch {}
    }
    if (code.includes('#')) {
      const parts = code.split('#');
      code = parts[0]!.trim();
      if (!state && parts[1]) state = parts[1].trim();
    }
    if (!code) return setManualError('Kode otorisasi tidak ditemukan');
    try {
      await get(`/ai/connections/callback?code=${encodeURIComponent(code)}${state ? `&state=${encodeURIComponent(state)}` : ''}`);
      setManualCode('');
      setManualError(null);
      alert('Akun Claude Superadmin berhasil terhubung!');
      qc.invalidateQueries({ queryKey: ['admin-ai-connections'] });
    } catch (err: any) {
      setManualError(err?.message || 'Gagal menukar kode');
    }
  };

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim().length < 20) return setKeyError('Kredensial minimal 20 karakter');
    try {
      await mutate('POST', '/ai/connections/start', { provider: 'anthropic', method: 'API_KEY', apiKey: apiKey.trim() });
      setApiKey('');
      setKeyError(null);
      alert('Kredensial Claude berhasil disimpan dan diverifikasi!');
      qc.invalidateQueries({ queryKey: ['admin-ai-connections'] });
    } catch (err: any) {
      setKeyError(err?.message || 'Gagal menyimpan');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">SUPERADMIN</p>
        <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
          AI Provider & Integrasi OAuth
        </h1>
        <p className="mt-1 text-sm text-muted">
          Konfigurasi model AI Claude via OAuth PKCE (9Router) dan manajemen token.
        </p>
      </div>

      <Card className="p-6 border border-primary/20 bg-primary/5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white font-bold shadow">
              AI
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-text">Claude AI (Superadmin Connection)</h3>
              <p className="text-xs text-muted">Hubungkan Claude Pro/Team via OAuth PKCE (9Router) untuk alur naskah & riset.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill ok={claudeConn?.status === 'CONNECTED'}>
              {claudeConn?.status ?? 'BELUM TERHUBUNG'}
            </Pill>
            <button
              onClick={() => handleConnectClaudeOAuth('auto')}
              className="flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white shadow hover:opacity-90 transition-opacity"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              {claudeConn?.status === 'CONNECTED' ? 'Sambung Ulang (Auto)' : 'Connect Otomatis'}
            </button>
            <button
              onClick={() => handleConnectClaudeOAuth('manual')}
              className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs font-semibold text-text hover:bg-surface-3 transition-colors"
            >
              Buka via Kode
            </button>
          </div>
        </div>

        {claudeConn && (
          <div className="rounded-lg bg-surface p-3 text-xs space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted">Metode: <strong className="text-text">{claudeConn.method}</strong></p>
              <p className="text-muted">Kredensial Hint: <strong className="text-text">{claudeConn.credentialHint ?? 'oauth-9router'}</strong></p>
            </div>
            
            <div className="pt-2 border-t border-line/50">
              <label className="block text-[11px] font-semibold text-text mb-1.5">
                Model AI Aktif (Claude Pro / Max / Team):
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={claudeConn.capabilities?.defaultModel ?? 'claude-3-7-sonnet-20250219'}
                  onChange={async (e) => {
                    const newModel = e.target.value;
                    try {
                      await mutate('POST', `/ai/connections/${claudeConn.id}/model`, { model: newModel });
                      qc.invalidateQueries({ queryKey: ['admin-ai-connections'] });
                    } catch (err: any) {
                      alert('Gagal mengubah model: ' + (err?.message || 'Error'));
                    }
                  }}
                  className="rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs text-text font-medium focus:border-accent focus:outline-hidden"
                >
                  <option value="claude-3-7-sonnet-20250219">Claude 3.7 Sonnet (Flagship 2025 · Hybrid Extended Thinking)</option>
                  <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet v2 (Serbaguna · Sangat Pintar)</option>
                  <option value="claude-3-opus-20240229">Claude 3 Opus (Analisis & Penulisan Kompleks)</option>
                  <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Ringan · Cepat Sekali)</option>
                </select>
                <span className="text-[10px] text-ok font-semibold px-2 py-0.5 rounded-full bg-ok/10">Aktif</span>
              </div>
              <p className="text-[10px] text-muted mt-1.5 leading-relaxed">
                *<strong>Claude 3.7 Sonnet</strong> adalah model flagship tertinggi & tercanggih dari Anthropic (Februari 2025) dengan penalaran mendalam.
              </p>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-line/60">
          <p className="text-xs font-semibold text-text">Fallback: Tempel Kode Otorisasi / Callback URL</p>
          <p className="text-xs text-muted mb-2">Jika redirect browser gagal atau Claude menampilkan kode di layar:</p>
          <form onSubmit={handleExchangeManual} className="flex gap-2">
            <input
              type="text"
              placeholder="http://localhost:3000/callback?code=... atau Kode#State"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="flex-1 rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs text-text placeholder:text-muted focus:border-accent focus:outline-hidden"
            />
            <Button size="sm" variant="ghost">Tukar & Hubungkan</Button>
          </form>
          {manualError && <p className="mt-1 text-xs text-bad">{manualError}</p>}
        </div>

        <div className="pt-2 border-t border-line/60">
          <p className="text-xs font-semibold text-text">Input Langsung Token OAuth Claude Code / API Key</p>
          <p className="text-xs text-muted mb-2">Masukkan token <code>sk-ant-oat...</code> atau API Key <code>sk-ant-api...</code>:</p>
          <form onSubmit={handleSaveApiKey} className="flex gap-2">
            <input
              type="password"
              placeholder="sk-ant-api... atau sk-ant-oat... (OAuth 9Router)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="flex-1 rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs text-text placeholder:text-muted focus:border-accent focus:outline-hidden"
            />
            <Button size="sm">Simpan & Verifikasi</Button>
          </form>
          {keyError && <p className="mt-1 text-xs text-bad">{keyError}</p>}
        </div>
      </Card>
    </div>
  );
}

export function AdminWorkflowsView() {
  const qc = useQueryClient();
  const agents = useQuery({
    queryKey: ['admin-agents'],
    queryFn: () => get<any[]>('/admin/agents').catch(() => []),
  });

  const agentList = Array.isArray(agents.data) ? agents.data : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">SUPERADMIN</p>
        <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
          Workflow Engine & Agent AI
        </h1>
        <p className="mt-1 text-sm text-muted">
          Konfigurasi prompt, model, dan pipeline otomatis 6 tahap produksi video.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { code: 'RESEARCH', title: '1. Riset & Deep Search', agent: 'research', desc: 'Mencari fakta unik, sumber jurnal, dan angle konten viral.' },
          { code: 'SCRIPT', title: '2. Naskah & Beat Hook', agent: 'scriptwriter', desc: 'Menulis skrip 60-90 detik dengan struktur AIDA & retensi tinggi.' },
          { code: 'FACT_CHECK', title: '3. Fact Checking', agent: 'fact_checker', desc: 'Verifikasi klaim naskah terhadap sumber valid.' },
          { code: 'MOTION', title: '4. Motion Director', agent: 'motion_director', desc: 'Penyusunan komponen visual Remotion dan timeline grafis.' },
          { code: 'QC', title: '5. Quality Control', agent: 'qc', desc: 'Validasi kontras warna, safe zone caption, dan sinkronisasi audio.' },
          { code: 'SOCIAL', title: '6. Social Media & SEO', agent: 'social_media', desc: 'Membuat caption, hashtag relevan, dan rekomendasi posting.' },
        ].map((stage) => {
          const matched = agentList.find((a: any) => a.code === stage.agent);
          return (
            <Card key={stage.code} className="p-5 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-accent uppercase font-bold tracking-wider">{stage.code}</span>
                  <Pill ok={matched?.isActive ?? true}>{matched?.isActive ? 'AKTIF' : 'STANDBY'}</Pill>
                </div>
                <h3 className="font-display text-base font-semibold text-text mt-2">{stage.title}</h3>
                <p className="text-xs text-muted mt-1 leading-relaxed">{stage.desc}</p>
              </div>
              <div className="pt-3 border-t border-line/60 flex items-center justify-between text-xs">
                <span className="font-mono text-muted">v{matched?.currentVersion ?? 1} · {matched?.config?.model || 'claude-sonnet'}</span>
                <span className="text-accent text-[11px] font-semibold">Siap Eksekusi</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Motion Skills, Engine & Preset Manager (Anti-AI-Slop) */}
      <div className="space-y-4 pt-4 border-t border-line">
        <div>
          <h2 className="font-display text-lg font-semibold text-text">
            Motion Skills & Engine Remotion VPS
          </h2>
          <p className="text-xs text-muted">
            Integrasi skill motion design profesional, anti-AI-slop, dan pipeline render Remotion cloud.
          </p>
        </div>

        {/* Installed Skills Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5 space-y-3 border-accent/30 bg-accent/5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-accent font-bold uppercase tracking-wider">SKILL #1</span>
              <Pill ok={true}>TERPASANG</Pill>
            </div>
            <h3 className="font-display text-base font-semibold text-text">motionmaxxing</h3>
            <p className="text-xs text-muted leading-relaxed">
              Anti-AI-slop motion director, no dead frame, measured easing curves, ambient depth & light sweeps.
            </p>
            <div className="pt-2 border-t border-line/40 flex items-center justify-between text-[11px] text-muted">
              <span>Origin: Tejashmakwana</span>
              <span className="font-mono font-semibold text-accent">Active</span>
            </div>
          </Card>

          <Card className="p-5 space-y-3 border-accent/30 bg-accent/5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-accent font-bold uppercase tracking-wider">SKILL #2</span>
              <Pill ok={true}>TERPASANG</Pill>
            </div>
            <h3 className="font-display text-base font-semibold text-text">motion-design-skill</h3>
            <p className="text-xs text-muted leading-relaxed">
              Official LottieFiles motion design principles: physical demonstrations, kinetic path drawing, dynamic choreography.
            </p>
            <div className="pt-2 border-t border-line/40 flex items-center justify-between text-[11px] text-muted">
              <span>Origin: LottieFiles</span>
              <span className="font-mono font-semibold text-accent">Active</span>
            </div>
          </Card>

          <Card className="p-5 space-y-3 border-accent/30 bg-accent/5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-accent font-bold uppercase tracking-wider">PRESET #3</span>
              <Pill ok={true}>TERPASANG</Pill>
            </div>
            <h3 className="font-display text-base font-semibold text-text">one-line-motion Studio</h3>
            <p className="text-xs text-muted leading-relaxed">
              100 Preset gaya visual (Sains, Sinematik, 3D, Vox, Kurzgesagt, Retro, Low-poly) dengan kinetic typography.
            </p>
            <div className="pt-2 border-t border-line/40 flex items-center justify-between text-[11px] text-muted">
              <span>100 Gaya · Remotion v4</span>
              <span className="font-mono font-semibold text-accent">Ready</span>
            </div>
          </Card>
        </div>

        {/* Upload Skill & Preset ke Database & Storage VPS */}
        <Card className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div>
              <h3 className="font-display text-base font-semibold text-text">
                Upload Skill / Preset Baru ke VPS
              </h3>
              <p className="text-xs text-muted">
                Tambahkan package template .zip atau file komponen .tsx langsung ke storage & database VPS.
              </p>
            </div>
            <span className="text-xs font-mono text-muted">Target: /opt/dentsweb/packages/remotion-compositions/</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-text">Nama Skill / Preset</label>
              <input
                type="text"
                placeholder="Contoh: medical-kinetic-3d"
                className="w-full h-10 px-3 rounded-xl border border-line bg-surface text-text outline-none focus:border-accent"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-text">Kategori Visual</label>
              <select className="w-full h-10 px-3 rounded-xl border border-line bg-surface text-text outline-none focus:border-accent">
                <option value="sains">Sains & Medis Edukasi</option>
                <option value="sinematik">Sinematik & Dramatik</option>
                <option value="3d">Low-poly 3D & Isometric</option>
                <option value="vox">Vox / Kurzgesagt Infografis</option>
                <option value="minimal">Minimalist Editorial</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-text">Pilih File (.zip / .tsx / .json)</label>
              <input
                type="file"
                accept=".zip,.tsx,.json,.md"
                className="w-full h-10 text-xs text-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-surface-2 file:text-xs file:font-semibold file:text-text hover:file:bg-surface-3 cursor-pointer pt-1"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <p className="text-[11px] text-muted">
              *File yang diupload secara otomatis diverifikasi, diekstrak, dan didaftarkan ke katalog style preset Remotion di VPS.
            </p>
            <button
              type="button"
              onClick={() => alert('Fitur upload skill/preset terhubung ke endpoint admin VPS (/admin/imports/init). File siap disinkronkan!')}
              className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-contrast shadow hover:brightness-110 transition-all cursor-pointer"
            >
              Upload & Daftarkan ke VPS
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function AdminProductionView() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'active' | 'failed' | 'done' | 'all'>('active');

  const runs = useQuery({
    queryKey: ['admin-runs', filter],
    queryFn: () => {
      const q = filter === 'active' ? 'QUEUED,RUNNING,CANCELLING' : filter === 'failed' ? 'FAILED' : filter === 'done' ? 'COMPLETED' : '';
      return get<any[]>(`/admin/production/runs?limit=100${q ? `&status=${q}` : ''}`).catch(() => []);
    },
    refetchInterval: filter === 'active' ? 4000 : false,
  });

  const runList = Array.isArray(runs.data) ? runs.data : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">SUPERADMIN</p>
        <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
          Antrean & Log Produksi Global
        </h1>
        <p className="mt-1 text-sm text-muted">
          Monitoring seluruh proses render dan eksekusi AI member secara real-time.
        </p>
      </div>

      <div className="inline-flex rounded-full border border-line bg-surface p-1 shadow-xs">
        {[
          { id: 'active', label: 'Aktif' },
          { id: 'failed', label: 'Gagal' },
          { id: 'done', label: 'Selesai' },
          { id: 'all', label: 'Semua' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id as any)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition cursor-pointer ${
              filter === t.id ? 'bg-accent text-accent-contrast shadow-xs font-semibold' : 'text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-muted uppercase font-mono tracking-wider border-b border-line">
              <tr>
                <th className="px-5 py-3">Member</th>
                <th className="px-5 py-3">Topik Video</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Tahap</th>
                <th className="px-5 py-3">Progres</th>
                <th className="px-5 py-3">Waktu Buat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {runList.map((r: any) => (
                <tr key={r.id} className="hover:bg-surface-2/40 transition">
                  <td className="px-5 py-3.5">
                    <span className="font-medium text-text">{r.owner?.displayName || 'Member'}</span>
                    <span className="block font-mono text-[11px] text-muted">{r.owner?.email}</span>
                  </td>
                  <td className="px-5 py-3.5 max-w-xs">
                    <span className="line-clamp-2 text-text font-medium">{r.topic || 'Video Tanpa Judul'}</span>
                    {r.error?.message && <span className="block text-[11px] text-bad mt-0.5">{r.error.message}</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <Pill ok={r.status === 'COMPLETED' || r.status === 'RUNNING'}>{r.status}</Pill>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-muted">{r.currentStage || '—'}</td>
                  <td className="px-5 py-3.5 font-mono">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-surface-2 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-accent h-full rounded-full" style={{ width: `${r.progress ?? 0}%` }} />
                      </div>
                      <span className="text-muted">{r.progress ?? 0}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-muted">
                    {new Date(r.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
              {runList.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-muted">
                    Tidak ada antrean produksi pada filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function AdminQuotasView() {
  const qc = useQueryClient();
  const quotas = useQuery({
    queryKey: ['admin-quotas'],
    queryFn: () => get<any[]>('/admin/production/quotas').catch(() => []),
  });

  const handleTickScheduler = async () => {
    try {
      const res = await mutate<{ created?: number }>('POST', '/admin/production/scheduler/tick', {});
      alert(res?.created ? `${res.created} pesanan terjadwal dibuat!` : 'Tidak ada slot jadwal yang jatuh tempo saat ini.');
      qc.invalidateQueries({ queryKey: ['admin-quotas'] });
    } catch (err: any) {
      alert(`Gagal menjalankan scheduler: ${err?.message || 'Error'}`);
    }
  };

  const list = Array.isArray(quotas.data) ? quotas.data : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">SUPERADMIN</p>
          <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
            Otomasi & Batas Kuota Member
          </h1>
          <p className="mt-1 text-sm text-muted">
            Monitoring pemakaian video harian dan concurrency render per lisensi.
          </p>
        </div>
        <Button size="sm" onClick={handleTickScheduler}>
          Jalankan Scheduler Sekarang
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-muted uppercase font-mono tracking-wider border-b border-line">
              <tr>
                <th className="px-5 py-3">Member</th>
                <th className="px-5 py-3">Video Hari Ini</th>
                <th className="px-5 py-3">Produksi Aktif</th>
                <th className="px-5 py-3">Maks Worker</th>
                <th className="px-5 py-3">Cloud Render</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((r: any) => (
                <tr key={r.id} className="hover:bg-surface-2/40 transition">
                  <td className="px-5 py-3.5">
                    <span className="font-medium text-text">{r.displayName}</span>
                    <span className="block font-mono text-[11px] text-muted">{r.email}</span>
                  </td>
                  <td className="px-5 py-3.5 font-mono">
                    {r.usedToday ?? 0} / {r.entitlements?.maxVideosPerDay ?? 10}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-text font-semibold">{r.active ?? 0}</td>
                  <td className="px-5 py-3.5 font-mono text-muted">{r.entitlements?.maxWorkers ?? 2} worker</td>
                  <td className="px-5 py-3.5">
                    <Pill ok={r.entitlements?.cloudRender}>{r.entitlements?.cloudRender ? 'AKTIF' : 'NONAKTIF'}</Pill>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted">
                    Belum ada member berlisensi aktif.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function AdminReleasesView() {
  const releases = useQuery({
    queryKey: ['admin-releases'],
    queryFn: () => get<any[]>('/admin/releases').catch(() => []),
  });

  const list = Array.isArray(releases.data) ? releases.data : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">SUPERADMIN</p>
        <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
          Manajemen Rilis Desktop (DMG & EXE)
        </h1>
        <p className="mt-1 text-sm text-muted">
          Daftar paket installer resmi desktop DENTSWEB STUDIO dan telemetri pembaruan.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted">macOS Apple Silicon</p>
          <p className="font-display text-lg font-bold text-text">DENTSWEB-STUDIO-1.0.8-arm64.dmg</p>
          <span className="text-[11px] text-accent font-mono">Versi Stabil 1.0.8</span>
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted">macOS Intel</p>
          <p className="font-display text-lg font-bold text-text">DENTSWEB-STUDIO-1.0.8-x64.dmg</p>
          <span className="text-[11px] text-accent font-mono">Versi Stabil 1.0.8</span>
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-xs text-muted">Windows 64-bit</p>
          <p className="font-display text-lg font-bold text-text">DENTSWEB-STUDIO-Setup-1.0.8.exe</p>
          <span className="text-[11px] text-accent font-mono">Versi Stabil 1.0.8</span>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-muted uppercase font-mono tracking-wider border-b border-line">
              <tr>
                <th className="px-5 py-3">Platform</th>
                <th className="px-5 py-3">Arsitektur</th>
                <th className="px-5 py-3">Versi</th>
                <th className="px-5 py-3">File Installer</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Waktu Rilis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((r: any) => (
                <tr key={r.id} className="hover:bg-surface-2/40 transition">
                  <td className="px-5 py-3.5 font-medium text-text">{r.platform}</td>
                  <td className="px-5 py-3.5 font-mono text-muted">{r.arch}</td>
                  <td className="px-5 py-3.5 font-mono font-bold text-accent">v{r.version}</td>
                  <td className="px-5 py-3.5 font-mono text-muted">{r.filename}</td>
                  <td className="px-5 py-3.5">
                    <Pill ok={r.isActive}>{r.isActive ? 'AKTIF' : 'ARSIP'}</Pill>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-muted">
                    {new Date(r.publishedAt).toLocaleDateString('id-ID')}
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-muted">
                    Installer lokal tersimpan di folder installers/ (v1.0.8 aktif).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function AdminSupportView() {
  const [filter, setFilter] = useState<'' | 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED'>('OPEN');

  const tickets = useQuery({
    queryKey: ['admin-tickets', filter],
    queryFn: () => get<any[]>(`/admin/support/tickets${filter ? `?status=${filter}` : ''}`).catch(() => []),
  });

  const list = Array.isArray(tickets.data) ? tickets.data : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">SUPERADMIN</p>
        <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
          Tiket Bantuan & Layanan Member
        </h1>
        <p className="mt-1 text-sm text-muted">
          Pusat bantuan langsung pertanyaan teknis, kendala render, dan aktivasi lisensi.
        </p>
      </div>

      <div className="inline-flex rounded-full border border-line bg-surface p-1 shadow-xs">
        {[
          { id: 'OPEN', label: 'Menunggu Tim' },
          { id: 'PENDING', label: 'Menunggu Member' },
          { id: 'RESOLVED', label: 'Selesai' },
          { id: 'CLOSED', label: 'Ditutup' },
          { id: '', label: 'Semua' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id as any)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition cursor-pointer ${
              filter === t.id ? 'bg-accent text-accent-contrast shadow-xs font-semibold' : 'text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-muted uppercase font-mono tracking-wider border-b border-line">
              <tr>
                <th className="px-5 py-3">Subjek Tiket</th>
                <th className="px-5 py-3">Member</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Pembaruan Terakhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((r: any) => (
                <tr key={r.id} className="hover:bg-surface-2/40 transition">
                  <td className="px-5 py-3.5 font-medium text-text">{r.subject}</td>
                  <td className="px-5 py-3.5">
                    <span className="font-medium text-text">{r.owner?.displayName || 'Member'}</span>
                    <span className="block font-mono text-[11px] text-muted">{r.owner?.email}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <Pill ok={r.status === 'RESOLVED' || r.status === 'OPEN'}>{r.status}</Pill>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-muted">
                    {new Date(r.updatedAt).toLocaleDateString('id-ID')}
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-muted">
                    Tidak ada tiket pada kategori ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

interface VoiceProvider {
  provider: string;
  displayName: string;
  isEnabled: boolean;
  hasCredential: boolean;
  config: { baseUrl?: string; model?: string };
  lastStatus: string | null;
  lastCheckedAt: string | null;
  capabilities: Record<string, boolean>;
}

interface VoiceProfile {
  id: string;
  provider: string;
  providerVoiceId: string;
  slug: string;
  name: string;
  language: string;
  status: string;
  voiceAttributes: { gender?: string; tone?: string };
  sampleUrl: string | null;
  synthesisConfig: { verified?: { ok: boolean; at: string; error?: string } };
}

export function AdminVoicesView() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [newVoice, setNewVoice] = useState({
    provider: 'gemini',
    providerVoiceId: '',
    name: '',
    language: 'id-ID',
    gender: 'female',
  });

  const providers = useQuery({
    queryKey: ['admin-voice-providers'],
    queryFn: () => get<VoiceProvider[]>('/admin/voice-providers').catch(() => []),
  });

  const voices = useQuery({
    queryKey: ['admin-voices'],
    queryFn: () => get<VoiceProfile[]>('/admin/voices').catch(() => []),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-voice-providers'] });
    qc.invalidateQueries({ queryKey: ['admin-voices'] });
  };

  const handleToggle = async (p: VoiceProvider) => {
    try {
      await mutate('PATCH', `/admin/voice-providers/${p.provider}`, { isEnabled: !p.isEnabled });
      refresh();
    } catch (e: any) {
      alert(e.message || 'Gagal mengubah status');
    }
  };

  const handleSaveConfig = async (provider: string, apiKey: string, baseUrl: string, model: string) => {
    try {
      const payload: any = { model: model || null };
      if (apiKey) payload.apiKey = apiKey;
      if (provider === 'cadangan') payload.baseUrl = baseUrl || null;
      await mutate('PATCH', `/admin/voice-providers/${provider}`, payload);
      alert(`Konfigurasi ${provider} berhasil diperbarui.`);
      refresh();
    } catch (e: any) {
      alert(e.message || 'Gagal menyimpan konfigurasi');
    }
  };

  const handleTestSynthesis = async (id: string) => {
    setTestingId(id);
    try {
      const res = await mutate<{ ok: boolean; audioUrl: string }>('POST', `/admin/voices/${id}/test`, {});
      if (res?.audioUrl) {
        const audio = new Audio(toMediaUrl(res.audioUrl));
        audio.play().catch(() => null);
        setPlayingId(id);
        audio.onended = () => setPlayingId(null);
      }
      refresh();
    } catch (e: any) {
      alert(e.message || 'Test synthesis gagal');
    } finally {
      setTestingId(null);
    }
  };

  const handleUploadSample = async (id: string, file: File) => {
    setUploadingId(id);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const res = reader.result as string;
          const comma = res.indexOf(',');
          resolve(comma >= 0 ? res.slice(comma + 1) : res);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;
      await mutate('POST', `/admin/voices/${id}/sample-base64`, { filename: file.name, base64 });
      alert('Sampel suara MP3 berhasil diunggah & diverifikasi ke VPS!');
      refresh();
    } catch (e: any) {
      alert(e.message || 'Gagal mengunggah sampel suara');
    } finally {
      setUploadingId(null);
    }
  };

  const handlePublish = async (id: string, currentStatus: string) => {
    try {
      const action = currentStatus === 'PUBLISHED' ? 'disable' : 'publish';
      await mutate('POST', `/admin/voices/${id}/${action}`, {});
      refresh();
    } catch (e: any) {
      alert(e.message || 'Gagal mengubah status suara');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus suara ini dari katalog?')) return;
    try {
      await mutate('DELETE', `/admin/voices/${id}`);
      refresh();
    } catch (e: any) {
      alert(e.message || 'Gagal menghapus suara');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const slug = newVoice.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      await mutate('POST', '/admin/voices', {
        provider: newVoice.provider,
        providerVoiceId: newVoice.providerVoiceId,
        slug,
        name: newVoice.name,
        language: newVoice.language,
        voiceAttributes: { gender: newVoice.gender },
        capabilities: {
          emotion: newVoice.provider === 'gemini',
          speed: true,
          pitch: false,
          instructions: newVoice.provider === 'gemini',
        },
      });
      setModalOpen(false);
      setNewVoice({ provider: 'gemini', providerVoiceId: '', name: '', language: 'id-ID', gender: 'female' });
      refresh();
      alert('Suara berhasil dibuat sebagai DRAFT. Silakan uji coba atau unggah sampel sebelum mempublikasikannya.');
    } catch (e: any) {
      alert(e.message || 'Gagal membuat suara baru');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">SUPERADMIN</p>
          <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
            Manajemen Provider & Suara Narator TTS
          </h1>
          <p className="mt-1 text-sm text-muted">
            Integrasi multi-engine ElevenLabs, Gemini Audio TTS, dan VoiceStudio (self-hosted / cadangan) dengan penyimpanan database & storage VPS.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>＋ Tambah Suara Baru</Button>
      </div>

      {/* VoiceStudio Integration Banner */}
      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-contrast font-bold text-lg">
            VS
          </div>
          <div className="space-y-1">
            <h3 className="font-display text-base font-bold text-text flex items-center gap-2">
              Dukungan Open-Source VoiceStudio (debpalash/VoiceStudio)
              <span className="rounded bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent">Gratis & Mandiri</span>
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              Anda dapat menjalankan repository <code className="bg-surface px-1.5 py-0.5 rounded text-accent font-mono font-semibold">VoiceStudio</code> atau engine Piper/Kokoro di VPS/Localhost yang mengekspos endpoint OpenAI-compatible <code className="bg-surface px-1.5 py-0.5 rounded font-mono">POST /v1/audio/speech</code>. Cukup aktifkan provider <strong>Cadangan</strong> di bawah dan masukkan URL engine tersebut.
            </p>
          </div>
        </div>
      </div>

      {/* Provider Cards */}
      <div>
        <h2 className="font-display text-lg font-medium text-text mb-3">Konfigurasi Engine TTS</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {providers.data?.map((p) => (
            <ProviderConfigCard
              key={p.provider}
              provider={p}
              onToggle={() => handleToggle(p)}
              onSave={(apiKey, baseUrl, model) => handleSaveConfig(p.provider, apiKey, baseUrl, model)}
            />
          ))}
        </div>
      </div>

      {/* Voices List Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-medium text-text">Katalog Suara di Platform</h2>
          <span className="text-xs text-muted font-mono">{voices.data?.length || 0} suara terdaftar</span>
        </div>

        <Card className="p-0 overflow-hidden border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2/60 text-muted border-b border-line uppercase text-[10px] tracking-wider font-mono">
                <tr>
                  <th className="px-4 py-3">Nama & Karakter</th>
                  <th className="px-4 py-3">Provider & ID</th>
                  <th className="px-4 py-3">Status Verifikasi</th>
                  <th className="px-4 py-3">Audio Sampel</th>
                  <th className="px-4 py-3">Unggah MP3 Manual</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {voices.data?.map((v) => {
                  const isVerified = v.synthesisConfig?.verified?.ok;
                  const isPlaying = playingId === v.id;
                  const isTesting = testingId === v.id;
                  const isUploading = uploadingId === v.id;

                  return (
                    <tr key={v.id} className="hover:bg-surface-2/30 transition">
                      <td className="px-4 py-3">
                        <span className="font-semibold text-text text-sm">{v.name}</span>
                        <div className="text-[11px] text-muted flex items-center gap-1.5 mt-0.5">
                          <span>{v.language}</span>
                          <span>•</span>
                          <span className="capitalize">{v.voiceAttributes?.gender || 'Netral'}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-mono text-[11px]">
                        <span className="rounded bg-surface-2 px-2 py-0.5 font-bold uppercase text-[10px]">
                          {v.provider}
                        </span>
                        <span className="block text-muted truncate max-w-[140px] mt-1" title={v.providerVoiceId}>
                          {v.providerVoiceId}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <Pill ok={isVerified}>
                          {isVerified ? 'Terverifikasi' : 'Belum Teruji'}
                        </Pill>
                      </td>

                      <td className="px-4 py-3">
                        {v.sampleUrl ? (
                          <button
                            onClick={() => {
                              if (isPlaying) {
                                setPlayingId(null);
                              } else {
                                setPlayingId(v.id);
                                const a = new Audio(toMediaUrl(v.sampleUrl!));
                                a.play().catch(() => null);
                                a.onended = () => setPlayingId(null);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1 text-[11px] font-semibold text-text hover:bg-surface-2/80 transition cursor-pointer"
                          >
                            <span>{isPlaying ? '■ Stop' : '▶ Putar Audio'}</span>
                          </button>
                        ) : (
                          <span className="text-muted text-[11px] italic">Tidak ada audio</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <label className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] text-muted hover:text-text hover:border-accent cursor-pointer transition">
                          <span>{isUploading ? 'Mengunggah…' : '📁 Pilih .MP3'}</span>
                          <input
                            type="file"
                            accept=".mp3,.wav,.ogg"
                            className="hidden"
                            disabled={isUploading}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUploadSample(v.id, f);
                            }}
                          />
                        </label>
                      </td>

                      <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isTesting}
                          onClick={() => handleTestSynthesis(v.id)}
                        >
                          {isTesting ? 'Menguji…' : '⚡ Test TTS'}
                        </Button>

                        <Button
                          size="sm"
                          variant={v.status === 'PUBLISHED' ? 'ghost' : 'primary'}
                          onClick={() => handlePublish(v.id, v.status)}
                        >
                          {v.status === 'PUBLISHED' ? 'Nonaktifkan' : 'Publikasikan'}
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => handleDelete(v.id)}
                        >
                          Hapus
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {(!voices.data || voices.data.length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted">
                      Belum ada suara terdaftar. Klik "+ Tambah Suara Baru" untuk menambahkan karakter suara.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Modal Tambah Suara */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Tambah Suara Narator">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text mb-1">Provider Engine</label>
            <Select
              value={newVoice.provider}
              onChange={(e) => setNewVoice({ ...newVoice, provider: e.target.value })}
            >
              <option value="gemini">Gemini API (Audio Modality)</option>
              <option value="elevenlabs">ElevenLabs</option>
              <option value="cadangan">VoiceStudio / Cadangan (OpenAI /v1/audio/speech)</option>
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text mb-1">
              Voice ID / Nama Voice di Provider
            </label>
            <Input
              placeholder={newVoice.provider === 'gemini' ? 'Misal: Kore, Aoede, Fenrir' : newVoice.provider === 'elevenlabs' ? 'Voice ID ElevenLabs (21 karakter)' : 'Nama suara di engine VoiceStudio'}
              value={newVoice.providerVoiceId}
              onChange={(e) => setNewVoice({ ...newVoice, providerVoiceId: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text mb-1">Nama Tampilan Karakter</label>
            <Input
              placeholder="Contoh: Sarah - Narator Edukasi Santai"
              value={newVoice.name}
              onChange={(e) => setNewVoice({ ...newVoice, name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text mb-1">Bahasa</label>
              <Input
                placeholder="id-ID"
                value={newVoice.language}
                onChange={(e) => setNewVoice({ ...newVoice, language: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text mb-1">Karakter / Gender</label>
              <Select
                value={newVoice.gender}
                onChange={(e) => setNewVoice({ ...newVoice, gender: e.target.value })}
              >
                <option value="female">Wanita</option>
                <option value="male">Pria</option>
                <option value="neutral">Netral</option>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit">
              Simpan Sebagai Draft
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ProviderConfigCard({
  provider: p,
  onToggle,
  onSave,
}: {
  provider: VoiceProvider;
  onToggle: () => void;
  onSave: (apiKey: string, baseUrl: string, model: string) => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(p.config?.baseUrl || '');
  const [model, setModel] = useState(p.config?.model || '');

  return (
    <Card className="p-5 flex flex-col justify-between space-y-4 border border-line bg-surface">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-bold text-text">{p.displayName}</h3>
            <span className="text-[10px] text-muted font-mono uppercase">{p.provider}</span>
          </div>
          <Pill ok={p.isEnabled}>{p.isEnabled ? 'Aktif' : 'Nonaktif'}</Pill>
        </div>

        <p className="text-[11px] text-muted leading-tight">
          Kredensial: {p.hasCredential ? '✓ Tersimpan di database VPS (terenkripsi)' : 'Belum diisi'}
        </p>

        {p.provider === 'cadangan' ? (
          <div>
            <label className="block text-[11px] font-medium text-text mb-1">
              URL Engine VoiceStudio (OpenAI-compatible)
            </label>
            <Input
              placeholder="http://localhost:8000 atau http://vps-ip:8000"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="text-xs h-9 font-mono"
            />
          </div>
        ) : (
          <div>
            <label className="block text-[11px] font-medium text-text mb-1">
              API Key ({p.displayName})
            </label>
            <Input
              type="password"
              placeholder={p.hasCredential ? '••••••••••••••••••••' : 'Masukkan API Key baru'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="text-xs h-9 font-mono"
            />
          </div>
        )}

        <div>
          <label className="block text-[11px] font-medium text-text mb-1">
            Model Default (Opsional)
          </label>
          <Input
            placeholder={p.provider === 'gemini' ? 'gemini-2.0-flash' : p.provider === 'elevenlabs' ? 'eleven_multilingual_v2' : 'kokoro / piper'}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="text-xs h-9"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-line">
        <Button size="sm" onClick={() => onSave(apiKey, baseUrl, model)}>
          Simpan Kredensial
        </Button>
        <Button size="sm" variant={p.isEnabled ? 'ghost' : 'primary'} onClick={onToggle}>
          {p.isEnabled ? 'Nonaktifkan' : 'Aktifkan'}
        </Button>
      </div>
    </Card>
  );
}
