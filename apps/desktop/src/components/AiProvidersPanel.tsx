import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, invoke, mutate } from '../bridge';
import { Button, Card, Input, Pill, Select, errMsg } from './UI';
import { Icon } from './Icons';

export type ProviderId = 'anthropic' | 'gemini' | 'openai' | 'openrouter' | 'custom_gateway';

interface ProviderMeta {
  code: ProviderId;
  name: string;
  notes?: string;
  methods: { method: string; available: boolean; reason?: string }[];
  defaultModels?: string[];
}

interface AiConnection {
  id: string;
  provider: string;
  method: string;
  status: string;
  credentialHint?: string | null;
  lastError?: string | null;
  capabilities?: {
    models?: string[];
    defaultModel?: string;
    priority?: number;
    active?: boolean;
    label?: string;
    baseUrl?: string;
    cooldownUntil?: string | null;
    inCooldown?: boolean;
  };
}

const FALLBACK_PROVIDERS: ProviderMeta[] = [
  {
    code: 'anthropic',
    name: 'Anthropic Claude',
    methods: [
      { method: 'OAUTH_PKCE', available: true },
      { method: 'API_KEY', available: true },
      { method: 'CLAUDE_CODE_LOCAL', available: true },
    ],
    defaultModels: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001'],
  },
  {
    code: 'gemini',
    name: 'Google Gemini',
    methods: [
      { method: 'OAUTH_PKCE', available: true },
      { method: 'API_KEY', available: true },
    ],
    defaultModels: ['gemini-2.5-pro', 'gemini-2.5-flash'],
  },
  {
    code: 'openai',
    name: 'OpenAI',
    methods: [{ method: 'API_KEY', available: true }],
    defaultModels: ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini'],
  },
  {
    code: 'openrouter',
    name: 'OpenRouter',
    methods: [{ method: 'API_KEY', available: true }],
    defaultModels: ['anthropic/claude-sonnet-4.5', 'google/gemini-2.5-pro', 'openai/gpt-4.1'],
  },
  {
    code: 'custom_gateway',
    name: 'Custom / 9Router',
    methods: [{ method: 'GATEWAY_KEY', available: true }],
    defaultModels: ['claude-sonnet-4-6', 'gemini-2.5-pro', 'gpt-4.1'],
  },
];

function normalizeProviders(raw: unknown): ProviderMeta[] {
  const arr = toList<Record<string, unknown>>(raw);
  if (arr.length < 5) return FALLBACK_PROVIDERS;
  return arr.map((item) => {
    const code = String(item.code ?? item.id ?? 'anthropic') as ProviderId;
    const fb = FALLBACK_PROVIDERS.find((f) => f.code === code);
    const methodsRaw = Array.isArray(item.methods) ? item.methods : fb?.methods ?? [];
    const methods = methodsRaw.map((m) =>
      typeof m === 'string'
        ? { method: m, available: true }
        : {
            method: String((m as Record<string, unknown>).method ?? ''),
            available: Boolean((m as Record<string, unknown>).available ?? true),
            reason: typeof (m as Record<string, unknown>).reason === 'string' ? String((m as Record<string, unknown>).reason) : undefined,
          },
    );
    return {
      code,
      name: String(item.name ?? fb?.name ?? code),
      notes: typeof item.notes === 'string' ? item.notes : undefined,
      methods,
      defaultModels: fb?.defaultModels,
    };
  });
}

function toList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items as T[];
    if (Array.isArray(o.providers)) return o.providers as T[];
    if (Array.isArray(o.data)) return o.data as T[];
  }
  return [];
}

function getPriority(c: AiConnection, fallbackIndex: number): number {
  const p = c.capabilities?.priority;
  return typeof p === 'number' && Number.isFinite(p) ? p : (fallbackIndex + 1) * 10;
}

function isCoolingDown(c: AiConnection): boolean {
  if (c.capabilities?.inCooldown) return true;
  const until = c.capabilities?.cooldownUntil;
  if (!until) return false;
  const ts = Date.parse(until);
  return Number.isFinite(ts) && ts > Date.now();
}

export function AiProvidersPanel() {
  const qc = useQueryClient();
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [label, setLabel] = useState('');
  const [priority, setPriority] = useState('10');
  const [manualCode, setManualCode] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const providersQ = useQuery({
    queryKey: ['ai-providers'],
    queryFn: () => get<unknown>('/ai/providers').then((r) => normalizeProviders(r)).catch(() => FALLBACK_PROVIDERS),
  });

  const connsQ = useQuery({
    queryKey: ['ai-conns'],
    queryFn: () => get<unknown>('/ai/connections').then((r) => toList<AiConnection>(r)).catch(() => []),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['ai-conns'] });
    qc.invalidateQueries({ queryKey: ['admin-ai-connections'] });
    qc.invalidateQueries({ queryKey: ['dash'] });
  };

  useEffect(() => {
    const bridge = window.dentsweb ?? window.dentweb;
    return bridge?.onEvent?.((e: { channel: string }) => {
      if (e.channel === 'claude:connected') {
        invalidateAll();
        setFeedback({ ok: true, text: 'Koneksi OAuth AI berhasil tersambung.' });
      }
    });
  }, [qc]);

  const providers = providersQ.data && providersQ.data.length >= 5 ? providersQ.data : FALLBACK_PROVIDERS;
  const currentMeta = providers.find((p) => p.code === selectedProvider) ?? FALLBACK_PROVIDERS[0]!;

  const sortedConns = [...(connsQ.data ?? [])].sort((a, b) => getPriority(a, 0) - getPriority(b, 0));

  const connectKeyMut = useMutation({
    mutationFn: () => {
      const parsedPrio = Number.parseInt(priority, 10);
      const body: Record<string, unknown> = {
        provider: selectedProvider,
        method: selectedProvider === 'custom_gateway' ? 'GATEWAY_KEY' : 'API_KEY',
        apiKey: apiKey.trim(),
        ...(label.trim() ? { label: label.trim() } : {}),
        ...(Number.isFinite(parsedPrio) ? { priority: parsedPrio } : {}),
        ...(selectedProvider === 'custom_gateway' ? { baseUrl: baseUrl.trim() } : {}),
      };
      return mutate('POST', '/ai/connections/start', body);
    },
    onSuccess: () => {
      setApiKey('');
      setBaseUrl('');
      setLabel('');
      invalidateAll();
      setFeedback({ ok: true, text: `Koneksi ${currentMeta.name} berhasil diverifikasi & disimpan.` });
    },
    onError: (e) => setFeedback({ ok: false, text: `Gagal menyimpan koneksi: ${errMsg(e)}` }),
  });

  const patchMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      mutate('PATCH', `/ai/connections/${id}`, body),
    onSuccess: () => {
      invalidateAll();
      setFeedback({ ok: true, text: 'Pengaturan koneksi AI diperbarui.' });
    },
    onError: (e) => setFeedback({ ok: false, text: `Gagal memperbarui koneksi: ${errMsg(e)}` }),
  });

  const checkMut = useMutation({
    mutationFn: (id: string) =>
      mutate<{ connection?: AiConnection; ok?: boolean; models?: string[] }>('POST', `/ai/connections/${id}/check`, {}),
    onSuccess: (res) => {
      invalidateAll();
      const count = res?.connection?.capabilities?.models?.length ?? res?.models?.length;
      setFeedback({
        ok: true,
        text: count ? `Model berhasil disegarkan (${count} model tersedia) & status CONNECTED.` : 'Status koneksi & daftar model berhasil disegarkan.',
      });
    },
    onError: (e) => setFeedback({ ok: false, text: `Gagal menyegarkan model: ${errMsg(e)}` }),
  });

  const testMut = useMutation({
    mutationFn: (id: string) =>
      mutate<{ ok: boolean; answer?: string; error?: string; latencyMs?: number }>('POST', `/ai/connections/${id}/test`, {}),
    onSuccess: (res) =>
      setFeedback({
        ok: Boolean(res?.ok),
        text: res?.ok ? `Respon OK: ${res.answer ?? 'Siap'} (${res.latencyMs ?? 0} ms)` : `Uji gagal: ${res?.error ?? 'Error'}`,
      }),
    onError: (e) => setFeedback({ ok: false, text: `Uji gagal: ${errMsg(e)}` }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => mutate('DELETE', `/ai/connections/${id}`),
    onSuccess: () => {
      invalidateAll();
      setFeedback({ ok: true, text: 'Koneksi AI dihapus.' });
    },
    onError: (e) => setFeedback({ ok: false, text: `Gagal menghapus: ${errMsg(e)}` }),
  });

  async function startOAuth(provider: 'anthropic' | 'gemini') {
    try {
      await invoke('claude:oauth-listen').catch(() => undefined);
      const parsedPrio = Number.parseInt(priority, 10);
      const res = await mutate<{ authorizeUrl?: string; message?: string }>('POST', '/ai/connections/start', {
        provider,
        method: 'OAUTH_PKCE',
        redirectUri: 'http://localhost:3000/callback',
        ...(label.trim() ? { label: label.trim() } : {}),
        ...(Number.isFinite(parsedPrio) ? { priority: parsedPrio } : {}),
      });
      if (res?.authorizeUrl) {
        await invoke('shell:open-external', { url: res.authorizeUrl });
        setFeedback({ ok: true, text: `Browser dibuka untuk login OAuth ${provider.toUpperCase()}.` });
      } else if (res?.message) {
        setFeedback({ ok: false, text: res.message });
      }
    } catch (e) {
      setFeedback({ ok: false, text: `Gagal memulai OAuth: ${errMsg(e)}` });
    }
  }

  async function exchangeManualCallback() {
    const raw = manualCode.trim();
    if (!raw) return;
    try {
      let code = raw;
      let state = '';
      if (raw.includes('code=')) {
        const u = new URL(raw.startsWith('http') ? raw : `http://localhost/?${raw.replace(/^\?/, '')}`);
        code = u.searchParams.get('code') ?? raw;
        state = u.searchParams.get('state') ?? '';
      } else if (raw.includes('#')) {
        [code, state] = raw.split('#');
      }
      await get(`/ai/connections/callback?code=${encodeURIComponent(code)}${state ? `&state=${encodeURIComponent(state)}` : ''}`);
      setManualCode('');
      invalidateAll();
      setFeedback({ ok: true, text: 'Kode callback OAuth berhasil ditukar.' });
    } catch (e) {
      setFeedback({ ok: false, text: `Gagal menukar kode: ${errMsg(e)}` });
    }
  }

  function swapPriority(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= sortedConns.length) return;
    const cur = sortedConns[index]!;
    const other = sortedConns[target]!;
    const curP = getPriority(cur, index);
    const otherP = getPriority(other, target);
    const nextCurP = curP === otherP ? (dir < 0 ? Math.max(1, curP - 1) : curP + 1) : otherP;
    const nextOtherP = curP === otherP ? curP : curP;
    patchMut.mutate({ id: cur.id, body: { priority: nextCurP } });
    patchMut.mutate({ id: other.id, body: { priority: nextOtherP } });
  }

  const oauthMethod = currentMeta.methods.find((m) => m.method === 'OAUTH_PKCE');
  const supportsOAuth = Boolean(oauthMethod);
  const oauthAvailable = Boolean(oauthMethod && oauthMethod.available !== false);

  function apply9RouterPreset() {
    setSelectedProvider('custom_gateway');
    setBaseUrl('http://localhost:20128/v1');
    if (!label.trim()) setLabel('9Router Gateway');
    setFeedback({ ok: true, text: 'Preset 9Router Gateway (http://localhost:20128/v1) siap. Masukkan API Key 9Router lalu klik Verifikasi & Simpan.' });
  }

  return (
    <div className="space-y-4">
      {/* Auto-Fallback Banner */}
      <Card className="p-4 border-accent/30 bg-accent/5 flex items-start gap-3">
        <Icon name="bolt" className="w-4 h-4 text-accent mt-0.5 shrink-0" />
        <div className="text-xs text-muted space-y-0.5">
          <p className="font-semibold text-text">Multi-Provider Auto-Fallback Aktif</p>
          <p>
            Saat provider utama (mis. Claude) terkena limit HTTP 429 / kuota habis, sistem otomatis mengatur cooldown 10 menit, berpindah ke provider aktif urutan prioritas berikutnya, dan mengirim notifikasi real-time.
          </p>
        </div>
      </Card>

      {feedback && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-xs flex items-center justify-between gap-3 ${
            feedback.ok ? 'border-accent/40 bg-accent/10 text-text' : 'border-bad/40 bg-bad/10 text-bad'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-muted hover:text-text cursor-pointer">
            Tutup
          </button>
        </div>
      )}

      {/* Connections Priority List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-text">
            Urutan Auto-Switch Provider ({sortedConns.length})
          </h3>
          <span className="text-[11px] font-mono text-muted">Prioritas rendah = diprioritaskan</span>
        </div>

        {connsQ.isLoading ? (
          <Card className="p-5 text-center text-xs text-muted">Memuat koneksi AI…</Card>
        ) : sortedConns.length === 0 ? (
          <Card className="p-5 text-center text-xs text-muted">
            Belum ada koneksi AI. Tambahkan minimal satu provider di bawah ini.
          </Card>
        ) : (
          sortedConns.map((c, idx) => {
            const active = c.capabilities?.active !== false;
            const cooling = isCoolingDown(c);
            const prio = getPriority(c, idx);
            const fallbackMeta = providers.find((p) => p.code === c.provider);
            const models = Array.from(
              new Set([
                ...(c.capabilities?.models ?? []),
                ...(c.capabilities?.defaultModel ? [c.capabilities.defaultModel] : []),
                ...(fallbackMeta?.defaultModels ?? []),
              ]),
            );

            return (
              <Card key={c.id} className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] font-mono text-text">
                        #{idx + 1} · P{prio}
                      </span>
                      <span className="font-display text-sm font-semibold text-text uppercase">
                        {fallbackMeta?.name ?? c.provider}
                      </span>
                      {c.capabilities?.label && (
                        <span className="text-xs text-muted">({c.capabilities.label})</span>
                      )}
                      {!active ? (
                        <Pill ok={null}>NONAKTIF</Pill>
                      ) : cooling ? (
                        <Pill ok={false}>COOLDOWN</Pill>
                      ) : c.status === 'CONNECTED' ? (
                        <Pill ok={true}>CONNECTED</Pill>
                      ) : (
                        <Pill ok={false}>{c.status || 'INVALID'}</Pill>
                      )}
                      <span className="text-[11px] font-mono text-muted">{c.method}</span>
                    </div>

                    {c.capabilities?.baseUrl && (
                      <p className="text-[11px] font-mono text-muted truncate">{c.capabilities.baseUrl}</p>
                    )}
                    {cooling && c.capabilities?.cooldownUntil && (
                      <p className="text-[11px] text-bad">
                        Cooldown hingga {new Date(c.capabilities.cooldownUntil).toLocaleTimeString('id-ID')}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={idx === 0 || patchMut.isPending}
                      onClick={() => swapPriority(idx, -1)}
                      title="Naikkan prioritas"
                    >
                      Naik
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={idx === sortedConns.length - 1 || patchMut.isPending}
                      onClick={() => swapPriority(idx, 1)}
                      title="Turunkan prioritas"
                    >
                      Turun
                    </Button>
                    <Button
                      size="sm"
                      variant={active ? 'outline' : 'primary'}
                      disabled={patchMut.isPending}
                      onClick={() => patchMut.mutate({ id: c.id, body: { active: !active } })}
                    >
                      {active ? 'Nonaktifkan' : 'Aktifkan'}
                    </Button>
                    {cooling && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={patchMut.isPending}
                        onClick={() => patchMut.mutate({ id: c.id, body: { resetCooldown: true } })}
                      >
                        Reset Cooldown
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={checkMut.isPending}
                      onClick={() => checkMut.mutate(c.id)}
                    >
                      <Icon name="bolt" className="w-3 h-3 mr-1 inline" />
                      {checkMut.isPending ? 'Menyegarkan…' : 'Segarkan Model'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={testMut.isPending}
                      onClick={() => testMut.mutate(c.id)}
                    >
                      <Icon name="play" className="w-3 h-3 mr-1 inline" />
                      Test
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={deleteMut.isPending}
                      onClick={() => {
                        if (confirm(`Hapus koneksi ${fallbackMeta?.name ?? c.provider}?`)) deleteMut.mutate(c.id);
                      }}
                    >
                      Hapus
                    </Button>
                  </div>
                </div>

                {models.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line/60">
                    <span className="text-xs text-muted">Model Default ({models.length} model):</span>
                    <Select
                      value={c.capabilities?.defaultModel ?? models[0]}
                      onChange={(e) => patchMut.mutate({ id: c.id, body: { defaultModel: e.target.value } })}
                      className="h-8 text-xs max-w-xs"
                    >
                      {models.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Add Provider Form */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Icon name="cpu" className="w-4 h-4 text-accent" />
          <h3 className="font-display text-sm font-semibold text-text">Tambah Koneksi AI Provider</h3>
        </div>

        {/* 5 Provider Selector Pills */}
        <div className="flex flex-wrap gap-1.5">
          {providers.map((p) => (
            <Button
              key={p.code}
              size="sm"
              variant={selectedProvider === p.code ? 'primary' : 'outline'}
              onClick={() => {
                setSelectedProvider(p.code);
                setFeedback(null);
              }}
            >
              {p.name}
            </Button>
          ))}
        </div>

        {/* Common metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Input
            placeholder="Label opsional (mis. Claude Utama / 9Router Kantor)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="h-9 text-xs sm:col-span-2"
          />
          <Input
            type="number"
            min={1}
            max={999}
            placeholder="Prioritas (mis. 10)"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="h-9 text-xs font-mono"
          />
        </div>

        {supportsOAuth && (
          <div className="rounded-xl border border-line bg-surface-2/40 p-3.5 space-y-2.5">
            {oauthAvailable ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-text">Connect {currentMeta.name} via OAuth PKCE</p>
                    <p className="text-[11px] text-muted">Masuk melalui browser resmi tanpa menyalin API Key manual.</p>
                  </div>
                  <Button size="sm" onClick={() => void startOAuth(selectedProvider as 'anthropic' | 'gemini')}>
                    <Icon name="key" className="w-3.5 h-3.5 mr-1.5 inline" />
                    Connect OAuth
                  </Button>
                </div>
                <div className="flex gap-2 pt-2 border-t border-line/60">
                  <Input
                    placeholder="Fallback: tempel URL callback atau Kode#State"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="flex-1 h-8 text-xs"
                  />
                  <Button size="sm" variant="ghost" onClick={() => void exchangeManualCallback()}>
                    Tukar Kode
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-text">OAuth {currentMeta.name} Belum Dikonfigurasi</p>
                  <p className="text-[11px] text-muted">
                    {oauthMethod?.reason || 'Superadmin dapat mengisi Client ID OAuth di menu 06 AI Provider, atau gunakan API Key / 9Router Gateway di bawah.'}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={apply9RouterPreset}>
                  <Icon name="bolt" className="w-3.5 h-3.5 mr-1.5 inline" />
                  Gunakan 9Router Gateway
                </Button>
              </div>
            )}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (selectedProvider === 'custom_gateway' && !baseUrl.trim()) {
              return setFeedback({ ok: false, text: 'Base URL wajib diisi untuk Custom / 9Router Gateway.' });
            }
            if (apiKey.trim().length < 8) {
              return setFeedback({ ok: false, text: 'API Key / Token terlalu pendek.' });
            }
            connectKeyMut.mutate();
          }}
          className="space-y-2.5 pt-1"
        >
          {selectedProvider === 'custom_gateway' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-muted">Endpoint OpenAI-Compatible / Self-Hosted 9Router:</span>
                <Button type="button" size="sm" variant="ghost" onClick={apply9RouterPreset}>
                  Preset 9Router (http://localhost:20128/v1)
                </Button>
              </div>
              <Input
                placeholder="Base URL Gateway (mis. http://localhost:20128/v1 atau https://router.domain.com/v1)"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </div>
          )}
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder={
                selectedProvider === 'anthropic'
                  ? 'sk-ant-api... atau sk-ant-oat...'
                  : selectedProvider === 'gemini'
                    ? 'AIzaSy...'
                    : selectedProvider === 'openai'
                      ? 'sk-proj-... atau sk-...'
                      : selectedProvider === 'openrouter'
                        ? 'sk-or-v1-...'
                        : 'Gateway Bearer API Key'
              }
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="flex-1 h-9 text-xs font-mono"
            />
            <Button type="submit" size="sm" disabled={connectKeyMut.isPending}>
              {connectKeyMut.isPending ? 'Memverifikasi…' : 'Verifikasi & Simpan'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
