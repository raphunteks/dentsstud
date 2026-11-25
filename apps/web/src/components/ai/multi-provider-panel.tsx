'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import type { AiProviderCode } from '@dentweb/shared-types';
import { api, ApiError, fmtDate } from '@/lib/api';
import { Button, Card, Empty, ErrorNote, Field, Input, Skeleton, Status } from '@/components/ui';
import { Select } from '@/components/ui/extra';

export interface AiConn {
  id: string;
  provider: string;
  method: string;
  status: string;
  credentialHint: string | null;
  lastError: string | null;
  lastCheckedAt: string | null;
  capabilities: {
    models?: string[];
    defaultModel?: string;
    priority?: number;
    active?: boolean;
    label?: string | null;
    baseUrl?: string | null;
    cooldownUntil?: string | null;
    inCooldown?: boolean;
    version?: string;
  };
}

export interface AiProviderInfo {
  code: string;
  name: string;
  kind: string;
  notes: string | null;
  methods: { method: string; available: boolean; reason: string | null }[];
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Claude (Anthropic)',
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  custom_gateway: 'Custom Gateway / 9Router',
};

const METHOD_LABELS: Record<string, string> = {
  API_KEY: 'API Key',
  OAUTH_PKCE: 'OAuth PKCE',
  CLAUDE_CODE_LOCAL: 'Claude Code (Desktop)',
  GATEWAY_KEY: 'Gateway / 9Router',
};

const FALLBACK_MODELS: Record<string, string[]> = {
  anthropic: ['claude-sonnet-4-5-20250929', 'claude-sonnet-4-20250514', 'claude-3-7-sonnet-20250219', 'claude-3-5-haiku-20241022'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  openai: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini'],
  openrouter: ['anthropic/claude-sonnet-4', 'google/gemini-2.5-pro', 'openai/gpt-4o', 'deepseek/deepseek-chat-v3-0324'],
  custom_gateway: ['claude-sonnet-4-5', 'gpt-4o', 'gemini-2.5-flash'],
};

function modelOptionsFor(c: AiConn): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of [c.capabilities?.defaultModel, ...(c.capabilities?.models ?? []), ...(FALLBACK_MODELS[c.provider] ?? [])]) {
    if (m && !seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
  }
  return out;
}

export function MultiProviderPanel({ isAdmin = false }: { isAdmin?: boolean }) {
  const qc = useQueryClient();
  const conns = useQuery({ queryKey: ['ai-connections'], queryFn: () => api<AiConn[]>('/ai/connections') });
  const providers = useQuery({ queryKey: ['ai-providers'], queryFn: () => api<AiProviderInfo[]>('/ai/providers'), staleTime: 5 * 60_000 });

  const [selectedProvider, setSelectedProvider] = useState<AiProviderCode>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [label, setLabel] = useState('');
  const [keyError, setKeyError] = useState<string>();
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState<string>();
  const [answers, setAnswers] = useState<Record<string, { answer: string; model: string; latencyMs: number }>>({});

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ai-connections'] });
    qc.invalidateQueries({ queryKey: ['dash'] });
    qc.invalidateQueries({ queryKey: ['me-dashboard'] });
    if (isAdmin) qc.invalidateQueries({ queryKey: ['admin-dash'] });
  };

  const connectKey = useMutation({
    mutationFn: () => {
      const isGw = selectedProvider === 'custom_gateway';
      return api<{ connection: AiConn }>('/ai/connections/start', {
        method: 'POST',
        json: isGw
          ? { provider: 'custom_gateway', method: 'GATEWAY_KEY', apiKey: apiKey.trim(), baseUrl: baseUrl.trim(), label: label.trim() || undefined }
          : { provider: selectedProvider, method: 'API_KEY', apiKey: apiKey.trim(), label: label.trim() || undefined },
      });
    },
    onSuccess: (r) => {
      setApiKey('');
      setBaseUrl('');
      setLabel('');
      setKeyError(undefined);
      toast[r.connection.status === 'CONNECTED' ? 'success' : 'warning'](`${PROVIDER_LABELS[r.connection.provider] ?? r.connection.provider}: ${r.connection.status}`);
      invalidate();
    },
    onError: (e) => setKeyError(e instanceof ApiError ? e.message : (e as Error).message),
  });

  const connectOAuth = useMutation({
    mutationFn: (provider: string) => {
      const isLocal =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.origin.includes('localhost'));
      const redirectUri =
        provider === 'anthropic'
          ? isLocal
            ? 'http://localhost:3000/callback'
            : 'https://platform.claude.com/oauth/code/callback'
          : typeof window !== 'undefined'
            ? `${window.location.origin}/callback`
            : undefined;
      return api<{ authorizeUrl: string }>('/ai/connections/start', {
        method: 'POST',
        json: { provider, method: 'OAUTH_PKCE', redirectUri },
      });
    },
    onSuccess: (r) => {
      window.location.href = r.authorizeUrl;
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const exchangeManual = useMutation({
    mutationFn: async () => {
      const input = manualCode.trim();
      if (input.startsWith('sk-ant-')) {
        return api<{ connection: AiConn }>('/ai/connections/start', {
          method: 'POST',
          json: { provider: 'anthropic', method: 'API_KEY', apiKey: input },
        });
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
          if (url.searchParams.get('code')) code = url.searchParams.get('code')!;
          if (url.searchParams.get('state')) state = url.searchParams.get('state')!;
          if (url.hash) {
            const h = url.hash.replace(/^#\/?/, '');
            const hp = new URLSearchParams(h);
            if (hp.get('code')) code = hp.get('code')!;
            if (hp.get('state')) state = hp.get('state')!;
            else if (!state && !h.includes('=')) state = h;
          }
        } catch {
          // fallback
        }
      }
      if (code.includes('#')) {
        const parts = code.split('#');
        code = parts[0]!.trim();
        if (!state && parts[1]) state = parts[1].trim();
      }
      if (!code) throw new Error('Kode otorisasi tidak ditemukan');
      return api(`/ai/connections/callback?code=${encodeURIComponent(code)}${state ? `&state=${encodeURIComponent(state)}` : ''}`);
    },
    onSuccess: () => {
      setManualCode('');
      setManualError(undefined);
      toast.success('Akun berhasil terhubung via kode otorisasi!');
      invalidate();
    },
    onError: (e) => setManualError(e instanceof ApiError ? e.message : (e as Error).message),
  });

  const patchConn = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { priority?: number; active?: boolean; label?: string; defaultModel?: string; resetCooldown?: boolean } }) =>
      api<AiConn>(`/ai/connections/${id}`, { method: 'PATCH', json: data }),
    onSuccess: () => {
      toast.success('Pengaturan koneksi diperbarui');
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const check = useMutation({
    mutationFn: (id: string) => api<AiConn>(`/ai/connections/${id}/check`, { method: 'POST' }),
    onSuccess: (c) => {
      toast(`Cek koneksi (${PROVIDER_LABELS[c.provider] ?? c.provider}): ${c.status}`);
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const test = useMutation({
    mutationFn: (id: string) => api<{ answer: string; model: string; latencyMs: number }>(`/ai/connections/${id}/test`, { method: 'POST', json: {} }),
    onSuccess: (r, id) => {
      setAnswers((a) => ({ ...a, [id]: r }));
      toast.success('Tes jawab berhasil');
    },
    onError: (e) => {
      toast.error((e as Error).message);
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/ai/connections/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Koneksi dihapus beserta kredensialnya');
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const ordered = [...(conns.data ?? [])].sort((a, b) => (a.capabilities?.priority ?? 50) - (b.capabilities?.priority ?? 50));

  const movePriority = async (idx: number, dir: -1 | 1) => {
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= ordered.length) return;
    const a = ordered[idx]!;
    const b = ordered[swapIdx]!;
    const pA = idx + 1;
    const pB = swapIdx + 1;
    try {
      await Promise.all([
        api(`/ai/connections/${a.id}`, { method: 'PATCH', json: { priority: pB } }),
        api(`/ai/connections/${b.id}`, { method: 'PATCH', json: { priority: pA } }),
      ]);
      toast.success('Urutan prioritas Auto-Switch diperbarui');
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const activeProvInfo = providers.data?.find((p) => p.code === selectedProvider);
  const oauthMethod = activeProvInfo?.methods.find((m) => m.method === 'OAUTH_PKCE');

  return (
    <div className="grid gap-5">
      {/* Auto-Fallback Info Banner */}
      <Card className="border-accent/30 bg-accent/5 p-4 text-xs text-text leading-relaxed">
        <strong className="font-semibold">Auto-Fallback Router Aktif:</strong> Produksi otomatis memilih koneksi AI aktif berdasarkan{' '}
        <strong>urutan prioritas (#1, #2, …)</strong>. Jika provider utama terkena limit <code>HTTP 429</code> atau kuota habis, sistem otomatis menempatkannya dalam <em>cooldown 10 menit</em>, mengirim notifikasi real-time, dan langsung beralih ke provider cadangan berikutnya.
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr] items-start">
        {/* Left: Connected Providers & Priority Order */}
        <div className="grid gap-4">
          {conns.isError && <ErrorNote error={conns.error} onRetry={() => conns.refetch()} />}
          {conns.isLoading && <Skeleton className="h-36 rounded-card" />}
          {conns.data?.length === 0 && (
            <Empty
              title="Belum ada provider AI terhubung"
              body="Tambahkan Claude (OAuth / API Key), Google Gemini, OpenAI, OpenRouter, atau Custom Gateway / 9Router di panel kanan."
            />
          )}

          {ordered.map((c, idx) => {
            const isActive = c.capabilities?.active !== false;
            const inCooldown = Boolean(c.capabilities?.inCooldown || (c.capabilities?.cooldownUntil && new Date(c.capabilities.cooldownUntil).getTime() > Date.now()));
            const statusValue = !isActive ? 'DISABLED' : inCooldown ? 'UNAVAILABLE' : c.status;
            const statusLabel = !isActive ? 'NONAKTIF' : inCooldown ? 'COOLDOWN' : c.status;
            const models = modelOptionsFor(c);

            return (
              <Card key={c.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="num rounded-md bg-surface-2 px-2 py-0.5 font-mono text-xs font-semibold text-accent border border-line">
                        #{idx + 1}
                      </span>
                      <p className="font-medium text-text">
                        {c.capabilities?.label || PROVIDER_LABELS[c.provider] || c.provider}
                      </p>
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">
                        {METHOD_LABELS[c.method] ?? c.method}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {PROVIDER_LABELS[c.provider] ?? c.provider}
                      {c.credentialHint ? ` · ${c.credentialHint}` : ''}
                      {c.capabilities?.baseUrl ? ` · ${c.capabilities.baseUrl}` : ''}
                      {' · '}Dicek {fmtDate(c.lastCheckedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="quiet" className="h-8 px-2 text-xs" disabled={idx === 0} onClick={() => void movePriority(idx, -1)} title="Naikkan prioritas">
                      ↑
                    </Button>
                    <Button variant="quiet" className="h-8 px-2 text-xs" disabled={idx === ordered.length - 1} onClick={() => void movePriority(idx, 1)} title="Turunkan prioritas">
                      ↓
                    </Button>
                    <Status value={statusValue} label={statusLabel} />
                  </div>
                </div>

                {inCooldown && c.capabilities?.cooldownUntil && (
                  <p className="mt-2 text-xs text-warn">
                    Dalam cooldown hingga {fmtDate(c.capabilities.cooldownUntil)} — klik Reset Cooldown untuk mencoba lagi sekarang.
                  </p>
                )}
                {c.lastError && <p className="mt-2 text-xs text-bad">{c.lastError}</p>}

                {c.method !== 'CLAUDE_CODE_LOCAL' && (
                  <div className="mt-3 border-t border-line/50 pt-3">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-text">Model Aktif</label>
                      <span className="num font-mono text-[10px] text-muted">{models.length} model</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={c.capabilities?.defaultModel ?? models[0] ?? ''}
                        onChange={async (e) => {
                          const newModel = e.target.value;
                          try {
                            await api(`/ai/connections/${c.id}/model`, { method: 'POST', json: { model: newModel } });
                            toast.success(`Model diubah ke ${newModel}`);
                            invalidate();
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Gagal mengubah model');
                          }
                        }}
                        className="rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-text focus:border-accent focus:outline-hidden"
                      >
                        {models.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {answers[c.id] && (
                  <div className="mt-3 rounded-lg bg-surface-2 p-3 text-xs">
                    <p className="whitespace-pre-wrap">{answers[c.id]!.answer}</p>
                    <p className="num mt-1.5 font-mono text-[11px] text-muted">
                      {answers[c.id]!.model} · {answers[c.id]!.latencyMs} ms
                    </p>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    className="h-9 text-xs"
                    onClick={() => patchConn.mutate({ id: c.id, data: { active: !isActive } })}
                  >
                    {isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  </Button>
                  {inCooldown && (
                    <Button
                      variant="ghost"
                      className="h-9 text-xs text-accent"
                      onClick={() => patchConn.mutate({ id: c.id, data: { resetCooldown: true } })}
                    >
                      Reset Cooldown
                    </Button>
                  )}
                  <Button variant="ghost" className="h-9 text-xs" loading={check.isPending && check.variables === c.id} onClick={() => check.mutate(c.id)}>
                    Segarkan Model
                  </Button>
                  {c.method !== 'CLAUDE_CODE_LOCAL' && (
                    <Button variant="ghost" className="h-9 text-xs" loading={test.isPending && test.variables === c.id} onClick={() => test.mutate(c.id)}>
                      Tes jawab
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    className="h-9 text-xs"
                    loading={remove.isPending && remove.variables === c.id}
                    onClick={() => confirm('Hapus koneksi dan kredensial ini?') && remove.mutate(c.id)}
                  >
                    Hapus
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Right: Add New Provider Connection */}
        <div className="grid content-start gap-4">
          <Card className="p-5">
            <h2 className="font-display text-lg font-medium">Tambah Koneksi AI Provider</h2>
            <p className="mt-1 text-xs text-muted">
              Pilih salah satu dari 5 provider untuk dijadikan sumber utama atau cadangan Auto-Switch.
            </p>

            <div className="mt-4 grid gap-3">
              <Field id="ai-prov" label="Provider AI">
                <Select
                  id="ai-prov"
                  value={selectedProvider}
                  onChange={(e) => {
                    setSelectedProvider(e.target.value as AiProviderCode);
                    setKeyError(undefined);
                  }}
                >
                  <option value="anthropic">Claude (Anthropic) — OAuth / API Key</option>
                  <option value="gemini">Google Gemini — API Key / OAuth</option>
                  <option value="openai">OpenAI (GPT-4.1 / 4o) — API Key</option>
                  <option value="openrouter">OpenRouter (Multi-Model) — API Key</option>
                  <option value="custom_gateway">Custom Gateway / 9Router — URL + Key</option>
                </Select>
              </Field>

              {activeProvInfo?.notes && <p className="text-xs text-muted">{activeProvInfo.notes}</p>}

              {oauthMethod && oauthMethod.available && (
                <div className="rounded-xl border border-line bg-surface-2/50 p-3">
                  <Button
                    type="button"
                    className="w-full"
                    loading={connectOAuth.isPending}
                    onClick={() => connectOAuth.mutate(selectedProvider)}
                  >
                    Connect {PROVIDER_LABELS[selectedProvider]} via OAuth PKCE
                  </Button>
                </div>
              )}

              {oauthMethod && !oauthMethod.available && (
                <div className="rounded-xl border border-line bg-surface-2/50 p-3 text-xs space-y-2">
                  <p className="text-muted">
                    OAuth {PROVIDER_LABELS[selectedProvider]} belum dikonfigurasi oleh Superadmin. Gunakan <strong>API Key</strong> di bawah, atau sambungkan via <strong>9Router Gateway</strong>:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() => {
                        setSelectedProvider('custom_gateway');
                        setBaseUrl('http://localhost:20128/v1');
                        setLabel('9Router Gateway');
                        setKeyError(undefined);
                      }}
                    >
                      Pakai Preset 9Router (localhost:20128)
                    </Button>
                  </div>
                </div>
              )}

              <form
                className="grid gap-3 pt-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (selectedProvider === 'custom_gateway' && !baseUrl.trim()) {
                    return setKeyError('Base URL gateway wajib diisi (mis. https://router.domain.com/v1)');
                  }
                  if (apiKey.trim().length < (selectedProvider === 'custom_gateway' ? 4 : 8)) {
                    return setKeyError('API Key / Token terlalu pendek');
                  }
                  connectKey.mutate();
                }}
              >
                <Field id="ai-label" label="Label (opsional)">
                  <Input
                    id="ai-label"
                    placeholder={`Mis. ${PROVIDER_LABELS[selectedProvider]} Cadangan`}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </Field>

                {selectedProvider === 'custom_gateway' && (
                  <Field id="ai-base" label="Gateway Base URL (HTTPS)">
                    <Input
                      id="ai-base"
                      type="url"
                      placeholder="https://9router.domainanda.com/v1"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                    />
                  </Field>
                )}

                <Field
                  id="ai-key"
                  label={selectedProvider === 'custom_gateway' ? 'Gateway Bearer Key' : `${PROVIDER_LABELS[selectedProvider]} API Key`}
                  error={keyError}
                >
                  <Input
                    id="ai-key"
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={
                      selectedProvider === 'anthropic'
                        ? 'sk-ant-api… atau sk-ant-oat…'
                        : selectedProvider === 'gemini'
                          ? 'AIza…'
                          : selectedProvider === 'openrouter'
                            ? 'sk-or-v1-…'
                            : 'sk-…'
                    }
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    invalid={!!keyError}
                  />
                </Field>

                <Button type="submit" loading={connectKey.isPending}>
                  Simpan &amp; Verifikasi
                </Button>
              </form>
            </div>
          </Card>

          {selectedProvider === 'anthropic' && (
            <Card className="p-5">
              <h3 className="font-display text-base font-medium">Tempel Kode / URL Callback OAuth (9Router Fallback)</h3>
              <p className="mt-1 text-xs text-muted">
                Jika redirect otomatis terhalang, tempelkan URL callback atau <code>Kode#State</code> di bawah:
              </p>
              <form
                className="mt-3 grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!manualCode.trim()) return setManualError('Masukkan kode atau URL callback');
                  exchangeManual.mutate();
                }}
              >
                <Field id="manualCode" label="Kode otorisasi atau URL callback" error={manualError}>
                  <Input
                    id="manualCode"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="http://localhost:3000/callback?code=… atau Kode#State"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    invalid={!!manualError}
                  />
                </Field>
                <Button type="submit" variant="ghost" loading={exchangeManual.isPending}>
                  Tukar Kode &amp; Hubungkan
                </Button>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
