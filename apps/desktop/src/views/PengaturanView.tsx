import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { get, invoke, mutate, pickAndUploadMedia, setMediaBase, toMediaUrl } from '../bridge';
import { Button, Card, Input, Pill, Select, Textarea, errMsg } from '../components/UI';
import { Icon } from '../components/Icons';
import { AiProvidersPanel } from '../components/AiProvidersPanel';
import type { Dash, Info, OfflineStatus, SessionUser, UpdateState } from '../types';

interface PengaturanViewProps {
  user: SessionUser;
  dash?: Dash;
  offline?: OfflineStatus;
  info?: Info;
  updateState?: UpdateState;
}

const DEFAULT_MODELS = [
  'claude-3-7-sonnet-20250219',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
];

export function PengaturanView({ user, dash, offline, info, updateState }: PengaturanViewProps) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'license' | 'claude' | 'brand' | 'production' | 'voice-accounts' | 'updates' | 'profile'>('license');
  const [apiKey, setApiKey] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  // Server API URL state
  const [apiBaseInput, setApiBaseInput] = useState(info?.apiBase ?? 'https://motion.dentsweb.my.id');
  const [apiBaseMsg, setApiBaseMsg] = useState<string | null>(null);

  // Profile & Password state
  const [displayName, setDisplayName] = useState(user.displayName);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');

  // Brand state
  const [brandName, setBrandName] = useState('');
  const [niche, setNiche] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('');
  const [cta, setCta] = useState('');
  const [logoAssetId, setLogoAssetId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Production schedule state (draft strings for comma/newline safety)
  const [schedEnabled, setSchedEnabled] = useState(false);
  const [schedTimesDraft, setSchedTimesDraft] = useState('09:00, 18:00');
  const [schedTopicsDraft, setSchedTopicsDraft] = useState('');
  const [schedFormat, setSchedFormat] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [schedTimezone, setSchedTimezone] = useState('Asia/Jakarta');

  // Voice Accounts state
  const [vaKey, setVaKey] = useState<Record<string, string>>({});
  const [vaUrl, setVaUrl] = useState<Record<string, string>>({});

  useEffect(() => {
    if (info?.apiBase) setApiBaseInput(info.apiBase);
  }, [info?.apiBase]);

  const aiConns = useQuery({
    queryKey: ['ai-conns'],
    queryFn: () =>
      get<{ id: string; provider: string; method: string; status: string; capabilities: { defaultModel?: string; models?: string[] } }[]>('/ai/connections').catch(() => []),
  });
  const activeConn = Array.isArray(aiConns.data) ? aiConns.data.find((c) => c.status === 'CONNECTED') : null;
  const availableModels = Array.from(new Set([...(activeConn?.capabilities?.models ?? []), ...DEFAULT_MODELS]));

  const devicesQ = useQuery({
    queryKey: ['my-devices'],
    queryFn: () => get<{ id: string; label: string; platform: string; architecture: string; lastSeenAt?: string }[]>('/devices').catch(() => []),
    enabled: activeTab === 'license',
  });

  const brandQ = useQuery({
    queryKey: ['my-brand'],
    queryFn: () =>
      get<{ brandName?: string; niche?: string; targetAudience?: string; tone?: string; defaultCta?: string; logoAssetId?: string | null; logoUrl?: string | null }>('/settings/brand').catch(() => null),
    enabled: activeTab === 'brand',
  });

  useEffect(() => {
    if (!brandQ.data) return;
    setBrandName(brandQ.data.brandName ?? '');
    setNiche(brandQ.data.niche ?? '');
    setAudience(brandQ.data.targetAudience ?? '');
    setTone(brandQ.data.tone ?? '');
    setCta(brandQ.data.defaultCta ?? '');
    setLogoAssetId(brandQ.data.logoAssetId ?? null);
    setLogoUrl(brandQ.data.logoUrl ?? null);
  }, [brandQ.data]);

  const prodQ = useQuery({
    queryKey: ['my-prod-settings'],
    queryFn: () =>
      get<{ enabled?: boolean; times?: string[]; topics?: string[]; format?: '9:16' | '16:9' | '1:1'; timezone?: string }>('/settings/production').catch(() => null),
    enabled: activeTab === 'production',
  });

  useEffect(() => {
    if (!prodQ.data) return;
    setSchedEnabled(Boolean(prodQ.data.enabled));
    setSchedTimesDraft((prodQ.data.times ?? ['09:00']).join(', '));
    setSchedTopicsDraft((prodQ.data.topics ?? []).join('\n'));
    if (prodQ.data.format) setSchedFormat(prodQ.data.format);
    if (prodQ.data.timezone) setSchedTimezone(prodQ.data.timezone);
  }, [prodQ.data]);

  const voiceAcctsQ = useQuery({
    queryKey: ['my-voice-accounts'],
    queryFn: () =>
      get<{ provider: string; status: string; credentialHint?: string | null; config?: { baseUrl?: string }; lastError?: string | null }[]>('/settings/voice-accounts').catch(() => []),
    enabled: activeTab === 'voice-accounts',
  });

  type LatestRelease = {
    version: string;
    platform: string;
    arch: string;
    filename: string;
    sizeBytes?: number;
    releaseNotes?: string;
    publishedAt?: string;
    downloadUrl?: string;
  };

  const latestReleasesQ = useQuery({
    queryKey: ['desktop-latest-releases'],
    queryFn: async () => {
      const [arm64, x64, win] = await Promise.all([
        get<LatestRelease>('/releases/latest?platform=darwin&arch=arm64').catch(() => null),
        get<LatestRelease>('/releases/latest?platform=darwin&arch=x64').catch(() => null),
        get<LatestRelease>('/releases/latest?platform=win32&arch=x64').catch(() => null),
      ]);
      return { arm64, x64, win };
    },
    enabled: activeTab === 'updates',
  });

  const revokeDevice = useMutation({
    mutationFn: (id: string) => mutate('DELETE', `/devices/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-devices'] });
      qc.invalidateQueries({ queryKey: ['dash'] });
    },
  });

  const setApiBaseMut = useMutation({
    mutationFn: () => invoke<{ apiBase: string }>('config:set-api-base', { apiBase: apiBaseInput.trim() }),
    onSuccess: (res) => {
      setMediaBase(res.apiBase);
      setApiBaseMsg('URL Server diperbarui. Silakan login ulang untuk menyambungkan sesi.');
      qc.clear();
      qc.invalidateQueries();
    },
    onError: (e) => setApiBaseMsg(errMsg(e)),
  });

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
          const urlStr = input.startsWith('http') ? input : `http://localhost/${input.replace(/^\/+/, '')}`;
          const url = new URL(urlStr);
          if (url.searchParams.get('code')) code = url.searchParams.get('code')!;
          if (url.searchParams.get('state')) state = url.searchParams.get('state')!;
        } catch {}
      }
      if (!code) throw new Error('Kode otorisasi tidak ditemukan');
      return get(`/ai/connections/callback?code=${encodeURIComponent(code)}${state ? `&state=${encodeURIComponent(state)}` : ''}`);
    },
    onSuccess: () => {
      setManualCode('');
      setManualError(null);
      qc.invalidateQueries({ queryKey: ['ai-conns'] });
      qc.invalidateQueries({ queryKey: ['dash'] });
    },
    onError: (err: any) => setManualError(err?.message || 'Gagal menukar kode otorisasi'),
  });

  const saveApiKey = useMutation({
    mutationFn: () => mutate('POST', '/ai/connections/start', { provider: 'anthropic', method: 'API_KEY', apiKey: apiKey.trim() }),
    onSuccess: () => {
      setApiKey('');
      setKeyError(null);
      qc.invalidateQueries({ queryKey: ['ai-conns'] });
      qc.invalidateQueries({ queryKey: ['dash'] });
    },
    onError: (err: any) => setKeyError(err?.message || 'Gagal memverifikasi kredensial'),
  });

  const disconnectAi = useMutation({
    mutationFn: (id: string) => mutate('DELETE', `/ai/connections/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-conns'] });
      qc.invalidateQueries({ queryKey: ['dash'] });
    },
  });

  const activate = useMutation({
    mutationFn: () => invoke<{ offlineUntil: string }>('license:activate'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dash'] });
      qc.invalidateQueries({ queryKey: ['offline'] });
      qc.invalidateQueries({ queryKey: ['my-devices'] });
    },
  });

  const detect = useQuery({
    queryKey: ['claude-detect'],
    queryFn: () => invoke<{ installed: boolean; version?: string; path?: string }>('claude:detect'),
  });

  useEffect(() => {
    const bridge = window.dentsweb ?? window.dentweb;
    const unlisten = bridge?.onEvent?.((e: { channel: string }) => {
      if (e.channel === 'claude:connected') {
        qc.invalidateQueries({ queryKey: ['ai-conns'] });
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-conns'] });
      qc.invalidateQueries({ queryKey: ['dash'] });
    },
  });

  const saveBrand = useMutation({
    mutationFn: () =>
      mutate('PUT', '/settings/brand', {
        brandName: brandName.trim(),
        niche: niche.trim(),
        targetAudience: audience.trim(),
        tone: tone.trim(),
        defaultCta: cta.trim(),
        logoAssetId,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-brand'] }),
  });

  const saveProd = useMutation({
    mutationFn: () =>
      mutate('PUT', '/settings/production', {
        enabled: schedEnabled,
        times: schedTimesDraft.split(',').map((s) => s.trim()).filter(Boolean),
        topics: schedTopicsDraft.split('\n').map((s) => s.trim()).filter(Boolean),
        format: schedFormat,
        timezone: schedTimezone,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-prod-settings'] }),
  });

  const saveProfile = useMutation({
    mutationFn: () => mutate('PATCH', '/me', { displayName: displayName.trim() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session'] }),
  });

  const changePassword = useMutation({
    mutationFn: () => mutate('POST', '/auth/password/change', { currentPassword: curPw, newPassword: newPw }),
    onSuccess: () => {
      setCurPw('');
      setNewPw('');
    },
  });

  const saveVoiceAcct = useMutation({
    mutationFn: ({ provider }: { provider: string }) =>
      mutate('PUT', `/settings/voice-accounts/${provider}`, {
        ...(vaKey[provider]?.trim() ? { apiKey: vaKey[provider]!.trim() } : {}),
        ...(vaUrl[provider]?.trim() ? { baseUrl: vaUrl[provider]!.trim() } : {}),
      }),
    onSuccess: (_d, vars) => {
      setVaKey((p) => ({ ...p, [vars.provider]: '' }));
      qc.invalidateQueries({ queryKey: ['my-voice-accounts'] });
    },
  });

  const deleteVoiceAcct = useMutation({
    mutationFn: (provider: string) => mutate('DELETE', `/settings/voice-accounts/${provider}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-voice-accounts'] }),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <h1 className="font-display text-2xl font-medium tracking-tight text-text">Pengaturan Studio</h1>
        <p className="mt-1 text-sm text-muted">
          Kelola lisensi, perangkat aktif, koneksi Claude AI, brand watermark, jadwal otomatis, akun suara, dan profil.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-line pb-2">
        {[
          { id: 'license', label: 'Lisensi & Perangkat' },
          { id: 'claude', label: 'AI Provider & CLI' },
          { id: 'brand', label: 'Brand & Watermark' },
          { id: 'production', label: 'Jadwal Otomatis' },
          { id: 'voice-accounts', label: 'Akun Suara TTS' },
          { id: 'updates', label: 'Update & Rilis' },
          { id: 'profile', label: 'Profil & Keamanan' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as typeof activeTab)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
              activeTab === t.id ? 'bg-surface-2 text-text shadow-xs border border-line' : 'text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'license' && (
        <div className="space-y-4 max-w-2xl">
          <Card className="p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-text">Status Lisensi Komputer Ini</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-line">
                <span className="text-muted">Status Lisensi Server</span>
                <Pill ok={dash?.license?.status === 'ACTIVE' ? true : dash ? false : null}>
                  {dash?.license?.status ?? 'MEMUAT...'}
                </Pill>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-line">
                <span className="text-muted">Aktivasi Offline</span>
                <Pill ok={offline?.valid}>
                  {offline?.valid ? `Aktif s/d ${new Date(offline.until!).toLocaleString('id-ID')}` : 'Belum diaktifkan'}
                </Pill>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted">Perangkat Terdaftar</span>
                <span className="font-mono font-medium text-text">{dash?.license?.activeDevices ?? devicesQ.data?.length ?? 0} aktif</span>
              </div>
            </div>
            <Button disabled={activate.isPending} onClick={() => activate.mutate()}>
              {activate.isPending ? 'Mengaktifkan…' : 'Aktifkan Perangkat Ini'}
            </Button>
            {activate.isError && <p role="alert" className="text-xs text-bad">{errMsg(activate.error)}</p>}
            {activate.isSuccess && (
              <p className="text-xs text-ok">✓ Aktif offline s/d {new Date(activate.data.offlineUntil).toLocaleString('id-ID')}.</p>
            )}
          </Card>

          {/* Perangkat Aktif */}
          <Card className="p-6 space-y-3">
            <h2 className="font-display text-base font-semibold text-text">Perangkat Aktif ({devicesQ.data?.length ?? 0})</h2>
            {(devicesQ.data ?? []).length === 0 ? (
              <p className="text-xs text-muted">Belum ada perangkat terdaftar.</p>
            ) : (
              <div className="space-y-2">
                {(devicesQ.data ?? []).map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-xl border border-line bg-surface-2/40 p-3 text-xs">
                    <div>
                      <p className="font-semibold text-text">{d.label}</p>
                      <p className="text-muted font-mono">{d.platform} · {d.architecture}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={revokeDevice.isPending}
                      onClick={() => {
                        if (confirm(`Cabut akses perangkat "${d.label}"?`)) revokeDevice.mutate(d.id);
                      }}
                    >
                      Hapus
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Pembaruan Aplikasi & Server API URL */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-text">Pembaruan Aplikasi Desktop</h2>
                <p className="text-xs text-muted">Versi terpasang: v{info?.version ?? '1.0.16'} ({info?.platform}/{info?.arch})</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void invoke('update:check')}>
                  Cek Pembaruan
                </Button>
                {(updateState?.state === 'available' || updateState?.state === 'ready') && (
                  <Button size="sm" onClick={() => void invoke('update:apply')}>
                    {updateState.state === 'ready' ? 'Install & Restart' : `Unduh v${updateState.version}`}
                  </Button>
                )}
              </div>
            </div>
            {updateState && updateState.state !== 'idle' && (
              <p className="text-xs font-mono text-muted">
                Status update:{' '}
                {updateState.state === 'checking'
                  ? 'Memeriksa server…'
                  : updateState.state === 'none'
                    ? 'Anda sudah menggunakan versi terbaru.'
                    : updateState.state === 'available'
                      ? `Tersedia v${updateState.version}`
                      : updateState.state === 'downloading'
                        ? `Mengunduh ${updateState.percent}%`
                        : updateState.state === 'ready'
                          ? `v${updateState.version} siap dipasang.`
                          : updateState.state === 'error'
                            ? `Error: ${updateState.message}`
                            : ''}
              </p>
            )}

            <div className="pt-3 border-t border-line space-y-2">
              <label className="block text-xs font-semibold text-text">URL Server API</label>
              <div className="flex gap-2">
                <Input
                  value={apiBaseInput}
                  onChange={(e) => setApiBaseInput(e.target.value)}
                  placeholder="https://motion.dentsweb.my.id"
                  className="flex-1 h-9 text-xs font-mono"
                />
                <Button size="sm" variant="ghost" disabled={setApiBaseMut.isPending} onClick={() => setApiBaseMut.mutate()}>
                  Simpan URL
                </Button>
              </div>
              {apiBaseMsg && <p className="text-xs text-muted">{apiBaseMsg}</p>}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'claude' && (
        <div className="space-y-4 max-w-3xl">
          <Card className="p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-sm font-semibold text-text">Deteksi Claude Code CLI Lokal</h2>
              {detect.isLoading ? <Pill>Mendeteksi…</Pill> : detect.data?.installed ? <Pill ok>Terpasang v{detect.data.version}</Pill> : <Pill ok={false}>Tidak ditemukan</Pill>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => detect.refetch()} size="sm">Deteksi Ulang CLI</Button>
              <Button disabled={!detect.data?.installed || testClaude.isPending} onClick={() => testClaude.mutate()} size="sm">
                {testClaude.isPending ? 'Menunggu jawaban…' : 'Uji Respon Claude CLI'}
              </Button>
            </div>
            {testClaude.data && (
              <div className="rounded-xl border border-line bg-surface-2 p-3 text-xs">
                {testClaude.data.ok ? (
                  <p className="text-text">{testClaude.data.answer} <span className="num text-muted">({testClaude.data.latencyMs} ms)</span></p>
                ) : (
                  <p className="text-bad">{testClaude.data.error}</p>
                )}
              </div>
            )}
          </Card>

          <AiProvidersPanel />
        </div>
      )}

      {activeTab === 'brand' && (
        <div className="space-y-4 max-w-2xl">
          <Card className="p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-text">Profil Brand & Watermark Video</h2>
            <div className="grid gap-3">
              <label className="grid gap-1 text-xs font-medium text-text">
                Nama Brand / Klinik
                <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Mis. Klinik Gigi Senyum Sehat" className="h-9 text-xs" />
              </label>
              <label className="grid gap-1 text-xs font-medium text-text">
                Niche / Bidang
                <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Mis. Edukasi Kesehatan Gigi" className="h-9 text-xs" />
              </label>
              <label className="grid gap-1 text-xs font-medium text-text">
                Target Audiens
                <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Mis. Dewasa muda 20-40 tahun" className="h-9 text-xs" />
              </label>
              <label className="grid gap-1 text-xs font-medium text-text">
                Gaya Bahasa (Tone)
                <Input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Mis. Ramah, informatif, tidak menggurui" className="h-9 text-xs" />
              </label>
              <label className="grid gap-1 text-xs font-medium text-text">
                CTA Default
                <Input value={cta} onChange={(e) => setCta(e.target.value)} placeholder="Mis. Simpan video ini & cek gigi rutin 6 bulan sekali!" className="h-9 text-xs" />
              </label>
              <div className="space-y-2 pt-2 border-t border-line">
                <p className="text-xs font-medium text-text">Logo / Watermark Video</p>
                <div className="flex items-center gap-3">
                  {logoUrl && <img src={toMediaUrl(logoUrl)} alt="Logo" className="h-12 w-12 rounded-lg border border-line object-contain bg-surface-2 p-1" />}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const up = await pickAndUploadMedia('image');
                        if (!up.canceled) {
                          setLogoAssetId(up.id);
                          setLogoUrl(up.url);
                        }
                      } catch (e) {
                        alert(errMsg(e));
                      }
                    }}
                  >
                    <Icon name="image" className="w-3.5 h-3.5" /> Unggah Logo PNG/WebP
                  </Button>
                </div>
              </div>
            </div>
            {saveBrand.isError && <p className="text-xs text-bad">{errMsg(saveBrand.error)}</p>}
            {saveBrand.isSuccess && <p className="text-xs text-ok">✓ Profil brand disimpan!</p>}
            <Button size="sm" disabled={saveBrand.isPending} onClick={() => saveBrand.mutate()}>
              {saveBrand.isPending ? 'Menyimpan…' : 'Simpan Profil Brand'}
            </Button>
          </Card>
        </div>
      )}

      {activeTab === 'production' && (
        <div className="space-y-4 max-w-2xl">
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-text">Jadwal Produksi Otomatis</h2>
                <p className="text-xs text-muted">Biarkan sistem memproduksi konten harian secara terjadwal.</p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input type="checkbox" checked={schedEnabled} onChange={(e) => setSchedEnabled(e.target.checked)} className="accent-accent size-4" />
                Aktifkan Jadwal
              </label>
            </div>
            <div className="grid gap-3">
              <label className="grid gap-1 text-xs font-medium text-text">
                Jam Produksi (pisahkan dengan koma, mis. 09:00, 18:00)
                <Input value={schedTimesDraft} onChange={(e) => setSchedTimesDraft(e.target.value)} className="h-9 text-xs font-mono" />
              </label>
              <label className="grid gap-1 text-xs font-medium text-text">
                Daftar Topik Antrean (satu topik per baris)
                <Textarea rows={4} value={schedTopicsDraft} onChange={(e) => setSchedTopicsDraft(e.target.value)} placeholder="Cara menyikat gigi yang benar&#10;Bahaya karang gigi dibiarkan" className="text-xs" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-xs font-medium text-text">
                  Format Default
                  <Select value={schedFormat} onChange={(e) => setSchedFormat(e.target.value as typeof schedFormat)} className="h-9 text-xs">
                    <option value="9:16">9:16 Reels/TikTok</option>
                    <option value="16:9">16:9 YouTube</option>
                    <option value="1:1">1:1 Square</option>
                  </Select>
                </label>
                <label className="grid gap-1 text-xs font-medium text-text">
                  Zona Waktu
                  <Input value={schedTimezone} onChange={(e) => setSchedTimezone(e.target.value)} className="h-9 text-xs font-mono" />
                </label>
              </div>
            </div>
            {saveProd.isError && <p className="text-xs text-bad">{errMsg(saveProd.error)}</p>}
            {saveProd.isSuccess && <p className="text-xs text-ok">✓ Jadwal produksi disimpan!</p>}
            <Button size="sm" disabled={saveProd.isPending} onClick={() => saveProd.mutate()}>
              {saveProd.isPending ? 'Menyimpan…' : 'Simpan Jadwal'}
            </Button>
          </Card>
        </div>
      )}

      {activeTab === 'voice-accounts' && (
        <div className="space-y-4 max-w-2xl">
          {['elevenlabs', 'gemini', 'cadangan'].map((prov) => {
            const cur = (voiceAcctsQ.data ?? []).find((a) => a.provider === prov);
            return (
              <Card key={prov} className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-sm font-semibold text-text uppercase">{prov}</h3>
                    <p className="text-xs text-muted">
                      {prov === 'cadangan'
                        ? 'Server TTS kustom (opsional — VoiceStudio global sudah tersedia gratis).'
                        : `API Key pribadi untuk provider ${prov}.`}
                    </p>
                  </div>
                  <Pill ok={cur?.status === 'CONNECTED' ? true : cur ? false : null}>
                    {cur?.status ?? 'BELUM DIATUR'} {cur?.credentialHint ? `(${cur.credentialHint})` : ''}
                  </Pill>
                </div>
                <div className="flex flex-wrap gap-2">
                  {prov === 'cadangan' ? (
                    <Input
                      placeholder="https://tts.domainanda.com"
                      value={vaUrl[prov] ?? cur?.config?.baseUrl ?? ''}
                      onChange={(e) => setVaUrl((p) => ({ ...p, [prov]: e.target.value }))}
                      className="flex-1 h-9 text-xs font-mono"
                    />
                  ) : (
                    <Input
                      type="password"
                      placeholder={`API Key ${prov}...`}
                      value={vaKey[prov] ?? ''}
                      onChange={(e) => setVaKey((p) => ({ ...p, [prov]: e.target.value }))}
                      className="flex-1 h-9 text-xs font-mono"
                    />
                  )}
                  <Button size="sm" disabled={saveVoiceAcct.isPending} onClick={() => saveVoiceAcct.mutate({ provider: prov })}>
                    Simpan
                  </Button>
                  {cur && (
                    <Button size="sm" variant="ghost" disabled={deleteVoiceAcct.isPending} onClick={() => deleteVoiceAcct.mutate(prov)}>
                      Hapus
                    </Button>
                  )}
                </div>
                {cur?.lastError && <p className="text-xs text-bad">{cur.lastError}</p>}
              </Card>
            );
          })}
          {saveVoiceAcct.isError && <p className="text-xs text-bad">{errMsg(saveVoiceAcct.error)}</p>}
        </div>
      )}

      {activeTab === 'updates' && (() => {
        const curVersion = info?.version ?? '1.0.16';
        const plat = info?.platform === 'win32' ? 'win32' : 'darwin';
        const archKey = info?.arch === 'x64' ? 'x64' : 'arm64';
        const myLatest =
          plat === 'win32'
            ? latestReleasesQ.data?.win
            : archKey === 'x64'
              ? latestReleasesQ.data?.x64
              : latestReleasesQ.data?.arm64;
        const primaryRelease = myLatest ?? latestReleasesQ.data?.arm64 ?? latestReleasesQ.data?.win ?? latestReleasesQ.data?.x64;
        const isUpToDate = primaryRelease ? primaryRelease.version === curVersion : true;
        const downloads = [
          { key: 'arm64', label: 'macOS Apple Silicon (M1/M2/M3/M4)', rel: latestReleasesQ.data?.arm64 },
          { key: 'x64', label: 'macOS Intel (x64)', rel: latestReleasesQ.data?.x64 },
          { key: 'win', label: 'Windows 10/11 (x64)', rel: latestReleasesQ.data?.win },
        ];

        return (
          <div className="space-y-4 max-w-2xl">
            <Card className="p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-text">Update & Rilis Desktop</h2>
                  <p className="text-xs text-muted mt-0.5">Periksa pembaruan otomatis atau unduh installer terbaru DENTSWEB STUDIO.</p>
                </div>
                <Pill ok={isUpToDate}>{isUpToDate ? 'Versi Terbaru' : `Tersedia v${primaryRelease?.version}`}</Pill>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="rounded-xl border border-line bg-surface-2/40 p-3.5">
                  <p className="text-[11px] font-mono uppercase text-muted">Versi Terpasang</p>
                  <p className="mt-1 font-display text-lg font-semibold text-text">v{curVersion}</p>
                  <p className="text-[11px] font-mono text-muted">{info?.platform ?? 'darwin'} / {info?.arch ?? 'arm64'}</p>
                </div>
                <div className="rounded-xl border border-line bg-surface-2/40 p-3.5">
                  <p className="text-[11px] font-mono uppercase text-muted">Versi Terbaru Server</p>
                  <p className="mt-1 font-display text-lg font-semibold text-accent">
                    {latestReleasesQ.isLoading ? 'Memeriksa…' : primaryRelease ? `v${primaryRelease.version}` : `v${curVersion}`}
                  </p>
                  <p className="text-[11px] font-mono text-muted">
                    {primaryRelease?.publishedAt ? new Date(primaryRelease.publishedAt).toLocaleDateString('id-ID') : 'Channel stable'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button size="sm" variant="primary" onClick={() => { void invoke('update:check'); void latestReleasesQ.refetch(); }}>
                  <Icon name="download" className="w-3.5 h-3.5 mr-1.5 inline" />
                  Cek Pembaruan Sekarang
                </Button>
                {(updateState?.state === 'available' || updateState?.state === 'ready') && (
                  <Button size="sm" variant="outline" onClick={() => void invoke('update:apply')}>
                    Pasang & Muat Ulang
                  </Button>
                )}
              </div>

              {updateState && updateState.state !== 'idle' && (
                <p className="text-xs font-mono text-muted">
                  Status updater:{' '}
                  {updateState.state === 'checking'
                    ? 'Memeriksa pembaruan di server…'
                    : updateState.state === 'none'
                      ? 'Aplikasi sudah pada versi terbaru.'
                      : updateState.state === 'available'
                        ? `Pembaruan v${updateState.version} tersedia.`
                        : updateState.state === 'downloading'
                          ? `Mengunduh pembaruan (${updateState.percent}%)…`
                          : updateState.state === 'ready'
                            ? `v${updateState.version} siap dipasang — klik Pasang & Muat Ulang.`
                            : updateState.state === 'error'
                              ? `Error: ${updateState.message}`
                              : ''}
                </p>
              )}
            </Card>

            {primaryRelease?.releaseNotes && (
              <Card className="p-6 space-y-2">
                <h3 className="font-display text-sm font-semibold text-text">Catatan Rilis (v{primaryRelease.version})</h3>
                <p className="text-xs text-muted whitespace-pre-wrap leading-relaxed">{primaryRelease.releaseNotes}</p>
              </Card>
            )}

            <Card className="p-6 space-y-3">
              <h3 className="font-display text-sm font-semibold text-text">Unduh Installer Manual</h3>
              <p className="text-xs text-muted">Pilih installer sesuai sistem operasi jika ingin memasang ulang secara manual.</p>
              <div className="space-y-2">
                {downloads.map((d) => (
                  <div key={d.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-2/40 px-4 py-3">
                    <div>
                      <p className="text-xs font-semibold text-text">{d.label}</p>
                      <p className="text-[11px] font-mono text-muted">
                        {d.rel ? `v${d.rel.version} · ${d.rel.filename}` : 'Memuat rilis…'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!d.rel?.downloadUrl}
                      onClick={() => d.rel?.downloadUrl && void invoke('shell:open-external', { url: toMediaUrl(d.rel.downloadUrl) })}
                    >
                      <Icon name="download" className="w-3.5 h-3.5 mr-1.5 inline" />
                      Unduh
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        );
      })()}

      {activeTab === 'profile' && (
        <div className="space-y-4 max-w-2xl">
          <Card className="p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-text">Profil Akun</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-line">
                <span className="text-muted">Email Terdaftar</span>
                <span className="font-mono text-text">{user.email}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-line">
                <span className="text-muted">Peran (Role)</span>
                <span className="rounded bg-accent/20 px-2 py-0.5 text-xs font-bold text-accent">{user.role}</span>
              </div>
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-text">Nama Tampilan</label>
                <div className="flex gap-2">
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-9 text-xs" />
                  <Button size="sm" disabled={saveProfile.isPending || displayName.trim().length < 2} onClick={() => saveProfile.mutate()}>
                    Simpan
                  </Button>
                </div>
                {saveProfile.isSuccess && <p className="text-xs text-ok">✓ Nama berhasil diperbarui.</p>}
                {saveProfile.isError && <p className="text-xs text-bad">{errMsg(saveProfile.error)}</p>}
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-text">Ubah Password</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                changePassword.mutate();
              }}
              className="space-y-3"
            >
              <Input type="password" placeholder="Password saat ini" value={curPw} onChange={(e) => setCurPw(e.target.value)} className="h-9 text-xs" required />
              <Input type="password" placeholder="Password baru (min. 10 karakter)" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="h-9 text-xs" required />
              {changePassword.isError && <p className="text-xs text-bad">{errMsg(changePassword.error)}</p>}
              {changePassword.isSuccess && <p className="text-xs text-ok">✓ Password berhasil diperbarui.</p>}
              <Button type="submit" size="sm" disabled={changePassword.isPending || newPw.length < 10}>
                {changePassword.isPending ? 'Menyimpan…' : 'Perbarui Password'}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
