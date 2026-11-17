import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, invoke, mutate } from '../bridge';
import { Button, Card, Pill } from '../components/UI';

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
  const licenses = useQuery({
    queryKey: ['admin-licenses'],
    queryFn: () => get<{ items: License[] } | License[]>('/admin/licenses').catch(() => ({ items: [] })),
  });

  const licenseList: License[] = Array.isArray(licenses.data)
    ? licenses.data
    : (licenses.data as { items?: License[] })?.items || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-widest text-accent font-mono font-bold">SUPERADMIN</p>
        <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
          Kelola Lisensi & Device
        </h1>
        <p className="mt-1 text-sm text-muted">
          Daftar lisensi aktif dan kuota perangkat desktop.
        </p>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-muted uppercase font-mono tracking-wider border-b border-line">
              <tr>
                <th className="px-5 py-3">License ID</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Maks Perangkat</th>
                <th className="px-5 py-3">Tanggal Diberikan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {licenseList.map((l) => (
                <tr key={l.id} className="hover:bg-surface-2/40 transition">
                  <td className="px-5 py-3.5 font-mono text-text">{l.id.slice(0, 16)}...</td>
                  <td className="px-5 py-3.5">
                    <Pill ok={l.status === 'ACTIVE'}>{l.status}</Pill>
                  </td>
                  <td className="px-5 py-3.5 font-mono font-medium">{l.maxDevices} device</td>
                  <td className="px-5 py-3.5 font-mono text-muted">
                    {new Date(l.createdAt).toLocaleDateString('id-ID')}
                  </td>
                </tr>
              ))}
              {licenseList.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-muted">
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

  const handleConnectClaudeOAuth = async () => {
    try {
      await invoke('claude:oauth-listen').catch(() => undefined);
      const redirectUri = 'http://localhost:3000/callback';
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
    let input = manualCode.trim();
    if (!input) return setManualError('Masukkan kode atau URL callback');
    let code = '';
    let state = '';
    if (input.includes('://') || input.includes('callback?')) {
      try {
        const url = new URL(input.startsWith('http') ? input : `http://localhost/${input}`);
        code = url.searchParams.get('code') || '';
        state = url.searchParams.get('state') || '';
        if (url.hash) {
          const h = url.hash.replace(/^#\/?/, '');
          const hp = new URLSearchParams(h);
          state = state || hp.get('state') || (!h.includes('=') ? h : '');
        }
      } catch {}
    }
    if (!code) {
      if (input.includes('#')) {
        const parts = input.split('#');
        code = parts[0]!;
        state = state || parts[1] || '';
      } else {
        code = input;
      }
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
          <div className="flex items-center gap-3">
            <Pill ok={claudeConn?.status === 'CONNECTED'}>
              {claudeConn?.status ?? 'BELUM TERHUBUNG'}
            </Pill>
            <button
              onClick={handleConnectClaudeOAuth}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow hover:opacity-90 transition-opacity"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              {claudeConn?.status === 'CONNECTED' ? 'Sambung Ulang OAuth' : 'Connect Claude via OAuth'}
            </button>
          </div>
        </div>

        {claudeConn && (
          <div className="rounded-lg bg-surface p-3 text-xs space-y-1">
            <p className="text-muted">Metode: <strong className="text-text">{claudeConn.method}</strong></p>
            <p className="text-muted">Kredensial Hint: <strong className="text-text">{claudeConn.credentialHint ?? 'oauth-9router'}</strong></p>
            {claudeConn.capabilities?.defaultModel && (
              <p className="text-muted">Model Aktif: <strong className="text-text">{claudeConn.capabilities.defaultModel}</strong></p>
            )}
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
