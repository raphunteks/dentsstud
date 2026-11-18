import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { get, invoke, mutate } from '../bridge';
import { Button, Card, Pill, errMsg } from '../components/UI';
import type { Dash, OfflineStatus, SessionUser } from '../types';

interface PengaturanViewProps {
  user: SessionUser;
  dash?: Dash;
  offline?: OfflineStatus;
}

export function PengaturanView({ user, dash, offline }: PengaturanViewProps) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'license' | 'claude' | 'profile'>('license');
  const [apiKey, setApiKey] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  const aiConns = useQuery({
    queryKey: ['ai-conns'],
    queryFn: () => get<{ id: string; provider: string; method: string; status: string; capabilities: { defaultModel?: string; models?: string[] } }[]>('/ai/connections').catch(() => []),
  });
  const activeConn = Array.isArray(aiConns.data) ? aiConns.data.find((c) => c.status === 'CONNECTED') : null;

  const exchangeManual = useMutation({
    mutationFn: async () => {
      const input = manualCode.trim();
      if (input.startsWith('sk-ant-')) {
        return mutate('POST', '/ai/connections/start', { provider: 'anthropic', method: 'API_KEY', apiKey: input });
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
      if (!code) throw new Error('Kode otorisasi tidak ditemukan');
      return get(`/ai/connections/callback?code=${encodeURIComponent(code)}${state ? `&state=${encodeURIComponent(state)}` : ''}`);
    },
    onSuccess: () => {
      setManualCode('');
      setManualError(null);
      alert('Akun Claude berhasil terhubung via kode otorisasi!');
      qc.invalidateQueries({ queryKey: ['dash'] });
    },
    onError: (err: any) => setManualError(err?.message || 'Gagal menukar kode otorisasi'),
  });

  const saveApiKey = useMutation({
    mutationFn: () => mutate('POST', '/ai/connections/start', { provider: 'anthropic', method: 'API_KEY', apiKey: apiKey.trim() }),
    onSuccess: () => {
      setApiKey('');
      setKeyError(null);
      alert('Koneksi Claude berhasil disimpan dan diverifikasi!');
      qc.invalidateQueries({ queryKey: ['dash'] });
    },
    onError: (err: any) => setKeyError(err?.message || 'Gagal memverifikasi kredensial'),
  });

  const activate = useMutation({
    mutationFn: () => invoke<{ offlineUntil: string }>('license:activate'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dash'] });
      qc.invalidateQueries({ queryKey: ['offline'] });
    },
  });

  const detect = useQuery({
    queryKey: ['claude-detect'],
    queryFn: () => invoke<{ installed: boolean; version?: string; path?: string }>('claude:detect'),
  });

  useEffect(() => {
    const bridge = (window as any).dentsweb || (window as any).dentweb;
    const unlisten = bridge?.onEvent?.((e: { channel: string }) => {
      if (e.channel === 'claude:connected') {
        qc.invalidateQueries({ queryKey: ['dash'] });
        qc.invalidateQueries({ queryKey: ['claude-detect'] });
      }
    });
    return () => {
      if (typeof unlisten === 'function') unlisten();
    };
  }, [qc]);

  const testClaude = useMutation({
    mutationFn: () =>
      invoke<{ ok: boolean; answer?: string; error?: string; latencyMs?: number }>('claude:test', {
        prompt: 'Jawab singkat dalam bahasa Indonesia: apa ibu kota Indonesia?',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dash'] }),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <h1 className="font-display text-2xl font-medium tracking-tight text-text">
          Pengaturan Studio
        </h1>
        <p className="mt-1 text-sm text-muted">
          Kelola lisensi perangkat, koneksi AI Claude Code, dan profil akun Anda.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-line pb-2">
        {[
          { id: 'license', label: 'Lisensi & Perangkat' },
          { id: 'claude', label: 'Claude AI & CLI' },
          { id: 'profile', label: 'Profil Akun' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as typeof activeTab)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
              activeTab === t.id
                ? 'bg-surface-2 text-text shadow-xs'
                : 'text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'license' && (
        <div className="space-y-4 max-w-2xl">
          <Card className="p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-text">
              Status Lisensi Komputer Ini
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-line">
                <span className="text-muted">Status Lisensi Server</span>
                <Pill ok={dash?.license.status === 'ACTIVE'}>{dash?.license.status ?? 'ACTIVE'}</Pill>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-line">
                <span className="text-muted">Aktivasi Offline</span>
                <Pill ok={offline?.valid}>
                  {offline?.valid
                    ? `Aktif sampai ${new Date(offline.until!).toLocaleString('id-ID')}`
                    : 'Belum diaktifkan di komputer ini'}
                </Pill>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-line">
                <span className="text-muted">Maksimum Perangkat</span>
                <span className="font-mono font-medium text-text">{dash?.license.activeDevices ?? 1} / 10 perangkat</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted">Worker Paralel</span>
                <span className="font-mono font-medium text-text">Maks 4 worker simultan</span>
              </div>
            </div>

            <div className="pt-2">
              <Button
                disabled={activate.isPending}
                onClick={() => activate.mutate()}
                className="w-full sm:w-auto"
              >
                {activate.isPending ? 'Mengaktifkan…' : 'Aktifkan Perangkat Ini'}
              </Button>
              {activate.isError && (
                <p role="alert" className="mt-2 text-xs text-bad">
                  {errMsg(activate.error)}
                </p>
              )}
              {activate.isSuccess && (
                <p className="mt-2 text-xs text-ok">
                  ✓ Komputer berhasil diaktivasi secara offline s/d{' '}
                  {new Date(activate.data.offlineUntil).toLocaleString('id-ID')}.
                </p>
              )}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'claude' && (
        <div className="space-y-4 max-w-2xl">
          <Card className="p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-text">
              Koneksi Claude Code (Lokal)
            </h2>
            <p className="text-xs text-muted leading-relaxed">
              DENTSWEB STUDIO dapat memanfaatkan Claude Code CLI resmi yang terpasang di perangkat Anda untuk eksekusi agent lokal.
            </p>
            <div className="space-y-3 text-sm pt-2">
              <div className="flex justify-between items-center py-2 border-b border-line">
                <span className="text-muted">Deteksi Claude CLI</span>
                {detect.isLoading ? (
                  <Pill>Mendeteksi…</Pill>
                ) : detect.data?.installed ? (
                  <Pill ok>Terpasang v{detect.data.version}</Pill>
                ) : (
                  <Pill ok={false}>Tidak ditemukan</Pill>
                )}
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted">Koneksi Server AI</span>
                <Pill ok={dash?.ai.status === 'CONNECTED'}>{dash?.ai.status ?? 'CONNECTED'}</Pill>
              </div>

              {activeConn && (
                <div className="pt-2 border-t border-line/50">
                  <label className="block text-[11px] font-semibold text-text mb-1">
                    Model AI Aktif (Claude Pro / Max / Team):
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={activeConn.capabilities?.defaultModel ?? 'claude-3-7-sonnet-20250219'}
                      onChange={async (e) => {
                        const newModel = e.target.value;
                        try {
                          await mutate('POST', `/ai/connections/${activeConn.id}/model`, { model: newModel });
                          qc.invalidateQueries({ queryKey: ['ai-conns'] });
                          qc.invalidateQueries({ queryKey: ['dash'] });
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
                  <p className="text-[10px] text-muted mt-1 leading-relaxed">
                    *<strong>Claude 3.7 Sonnet</strong> adalah model flagship tertinggi & tercanggih dari Anthropic (Februari 2025) dengan penalaran mendalam.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => detect.refetch()} size="sm">
                Deteksi Ulang CLI
              </Button>
              <Button
                disabled={!detect.data?.installed || testClaude.isPending}
                onClick={() => testClaude.mutate()}
                size="sm"
              >
                {testClaude.isPending ? 'Menunggu jawaban…' : 'Uji Respon Claude'}
              </Button>
            </div>

            {testClaude.data && (
              <div className="mt-3 rounded-xl border border-line bg-surface-2 p-3 text-xs">
                {testClaude.data.ok ? (
                  <p className="text-text">
                    {testClaude.data.answer}{' '}
                    <span className="num text-muted">({testClaude.data.latencyMs} ms)</span>
                  </p>
                ) : (
                  <p className="text-bad">{testClaude.data.error}</p>
                )}
              </div>
            )}
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-base font-semibold text-text">
                  Connect Claude via OAuth (9Router)
                </h2>
                <p className="text-xs text-muted leading-relaxed mt-1">
                  Hubungkan akun Claude Pro/Team langsung lewat OAuth browser tanpa input API key manual.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={async () => {
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
                  }}
                >
                  Connect Otomatis
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      const redirectUri = 'https://platform.claude.com/oauth/code/callback';
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
                      alert(`Gagal membuka otorisasi: ${err?.message || 'Error'}`);
                    }
                  }}
                >
                  Buka Otorisasi (Tampilkan Kode)
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <div>
              <h2 className="font-display text-base font-semibold text-text">
                Tempel Kode / URL Callback (9Router Fallback)
              </h2>
              <p className="text-xs text-muted leading-relaxed mt-1">
                Jika Claude menampilkan kode di layar atau redirect callback terhalang, tempelkan teks kode atau URL callback di sini:
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!manualCode.trim()) return setManualError('Masukkan kode atau URL callback');
                exchangeManual.mutate();
              }}
              className="space-y-3"
            >
              <input
                type="text"
                placeholder="http://localhost:3000/callback?code=... atau Kode#State"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-text placeholder:text-muted focus:border-accent focus:outline-hidden"
              />
              {manualError && <p className="text-xs text-bad">{manualError}</p>}
              <Button size="sm" variant="ghost" disabled={exchangeManual.isPending}>
                {exchangeManual.isPending ? 'Menukar token…' : 'Tukar Kode & Hubungkan'}
              </Button>
            </form>
          </Card>

          <Card className="p-6 space-y-4">
            <div>
              <h2 className="font-display text-base font-semibold text-text">
                Input API Key / OAuth Token (9Router)
              </h2>
              <p className="text-xs text-muted leading-relaxed mt-1">
                Masukkan API Key Anthropic (<code>sk-ant-api...</code>) atau Token OAuth Claude Code (<code>sk-ant-oat...</code>) milik akun Anda.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (apiKey.trim().length < 20) return setKeyError('Token / Key minimal 20 karakter');
                saveApiKey.mutate();
              }}
              className="space-y-3"
            >
              <input
                type="password"
                placeholder="sk-ant-api... atau sk-ant-oat..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-xs font-mono text-text outline-none focus:border-accent"
              />
              {keyError && <p className="text-xs text-bad">{keyError}</p>}
              <Button type="submit" size="sm" disabled={saveApiKey.isPending}>
                {saveApiKey.isPending ? 'Memverifikasi…' : 'Verifikasi & Simpan Kredensial'}
              </Button>
            </form>
          </Card>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="space-y-4 max-w-2xl">
          <Card className="p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-text">
              Informasi Pengguna
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-line">
                <span className="text-muted">Nama Lengkap</span>
                <span className="font-medium text-text">{user.displayName}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-line">
                <span className="text-muted">Email Terdaftar</span>
                <span className="font-mono text-text">{user.email}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted">Peran (Role)</span>
                <span className="rounded bg-accent/20 px-2 py-0.5 text-xs font-bold text-accent">
                  {user.role}
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
