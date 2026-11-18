'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { Button, Card, ErrorNote, Field, Input, PageHead, Skeleton, Status } from '@/components/ui';

interface Provider {
  code: string;
  name: string;
  kind: string;
  notes: string | null;
  methods: { method: string; available: boolean; reason: string | null }[];
}

interface Conn {
  id: string;
  provider: string;
  method: string;
  status: string;
  credentialHint: string | null;
  lastError: string | null;
  lastCheckedAt: string | null;
  capabilities: { models?: string[]; defaultModel?: string; version?: string };
}

export default function AiProvidersPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['ai-providers'], queryFn: () => api<Provider[]>('/ai/providers') });
  const d = useQuery({ queryKey: ['admin-dash'], queryFn: () => api<{ aiProviderHealth: Record<string, number> }>('/admin/dashboard') });
  const conns = useQuery({ queryKey: ['ai-connections'], queryFn: () => api<Conn[]>('/ai/connections') });

  const [testResult, setTestResult] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState<string>();

  const exchangeManual = useMutation({
    mutationFn: async () => {
      const input = manualCode.trim();
      if (input.startsWith('sk-ant-')) {
        return api<{ connection: Conn }>('/ai/connections/start', {
          method: 'POST',
          json: { provider: 'anthropic', method: 'API_KEY', apiKey: input },
        });
      }
      let code = input;
      let state = '';
      if (input.includes('://') || input.includes('callback?') || input.includes('code=') || input.includes('#')) {
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
      toast.success('Akun Claude berhasil terhubung via kode otorisasi!');
      invalidate();
    },
    onError: (e) => setManualError(e instanceof ApiError ? e.message : (e as Error).message),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ai-connections'] });
    qc.invalidateQueries({ queryKey: ['admin-dash'] });
  };

  const connectApiKey = useMutation({
    mutationFn: () =>
      api<{ connection: Conn }>('/ai/connections/start', {
        method: 'POST',
        json: { provider: 'anthropic', method: 'API_KEY', apiKey: apiKey.trim() },
      }),
    onSuccess: () => {
      setApiKey('');
      setKeyError(null);
      toast.success('Kredensial Claude berhasil disimpan dan diverifikasi');
      invalidate();
    },
    onError: (e) => setKeyError(e instanceof ApiError ? e.message : 'Gagal menyimpan'),
  });

  const connectOAuth = useMutation({
    mutationFn: () => {
      const isLocal = typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.origin.includes('localhost')
      );
      return api<{ authorizeUrl: string }>('/ai/connections/start', {
        method: 'POST',
        json: {
          provider: 'anthropic',
          method: 'OAUTH_PKCE',
          redirectUri: isLocal
            ? 'http://localhost:3000/callback'
            : 'https://platform.claude.com/oauth/code/callback',
        },
      });
    },
    onSuccess: (r) => {
      window.location.href = r.authorizeUrl;
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const testConn = useMutation({
    mutationFn: (id: string) => api<{ answer: string; model: string; latencyMs: number }>(`/ai/connections/${id}/test`, { method: 'POST', json: {} }),
    onSuccess: (r) => {
      setTestResult(`[${r.model} - ${r.latencyMs}ms]: ${r.answer}`);
      toast.success('Koneksi Claude berhasil diuji!');
    },
    onError: (e) => {
      toast.error((e as Error).message);
      invalidate();
    },
  });

  const removeConn = useMutation({
    mutationFn: (id: string) => api(`/ai/connections/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Koneksi Claude diputuskan');
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const claudeConn = conns.data?.find((c) => c.provider === 'anthropic' || c.provider === 'claude');

  return (
    <div className="grid gap-6">
      <PageHead eyebrow="06 · AI provider center" title="Provider Registry & Koneksi OAuth" />

      {/* SUPERADMIN CLAUDE OAUTH INTEGRATION CARD */}
      <Card className="border border-primary/20 bg-primary/5 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold">Integrasi Claude AI (Akun Superadmin)</h2>
              <p className="text-sm text-muted">Hubungkan Claude via OAuth PKCE (9Router) untuk alur kerja agentik dan sintesis naskah studio.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {claudeConn ? (
              <Status value={claudeConn.status} label={claudeConn.status} />
            ) : (
              <span className="rounded-full bg-surface-2 px-3 py-1 text-xs text-muted">Belum Terhubung</span>
            )}
            <Button onClick={() => connectOAuth.mutate()} loading={connectOAuth.isPending} className="h-10">
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              {claudeConn ? 'Sambung Ulang OAuth' : 'Connect Claude via OAuth'}
            </Button>
            {claudeConn && (
              <>
                <Button variant="ghost" onClick={() => testConn.mutate(claudeConn.id)} loading={testConn.isPending} className="h-10">
                  Uji Model
                </Button>
                <Button variant="ghost" onClick={() => removeConn.mutate(claudeConn.id)} loading={removeConn.isPending} className="h-10 text-bad hover:bg-bad/10">
                  Putus
                </Button>
              </>
            )}
          </div>
        </div>

        {claudeConn && (
          <div className="mt-4 rounded-lg bg-surface p-3 text-xs">
            <div className="flex flex-wrap gap-4 text-muted">
              <span>Metode: <strong className="text-text">{claudeConn.method}</strong></span>
              <span>Hint: <strong className="text-text">{claudeConn.credentialHint ?? 'oauth-9router'}</strong></span>
              {claudeConn.capabilities.defaultModel && (
                <span>Model Default: <strong className="text-text">{claudeConn.capabilities.defaultModel}</strong></span>
              )}
            </div>
            {testResult && (
              <div className="mt-2 rounded bg-surface-2 p-2 font-mono text-[11px] text-emerald-600">
                {testResult}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 border-t border-line/60 pt-4">
          <p className="text-xs font-medium text-muted">Fallback: Tempel Kode Otorisasi / Callback URL jika redirect otomatis terhalang:</p>
          <form
            className="mt-2 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!manualCode.trim()) return setManualError('Masukkan kode atau URL callback');
              exchangeManual.mutate();
            }}
          >
            <div className="min-w-[280px] flex-1">
              <Input
                type="text"
                placeholder="http://localhost:3000/callback?code=... atau Kode#State"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                invalid={!!manualError}
                className="h-9 text-xs"
              />
            </div>
            <Button type="submit" loading={exchangeManual.isPending} variant="ghost" className="h-9 border border-line text-xs">
              Tukar & Hubungkan
            </Button>
          </form>
          {manualError && <p className="mt-1 text-xs text-bad">{manualError}</p>}
        </div>

        <div className="mt-4 border-t border-line/60 pt-4">
          <p className="text-xs font-medium text-muted">Atau masukkan API Key / OAuth Token (9Router) langsung:</p>
          <form
            className="mt-2 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (apiKey.trim().length < 20) return setKeyError('Kredensial minimal 20 karakter');
              connectApiKey.mutate();
            }}
          >
            <div className="min-w-[280px] flex-1">
              <Input
                type="password"
                placeholder="sk-ant-api... atau sk-ant-oat... (OAuth 9Router)"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                invalid={!!keyError}
                className="h-9 text-xs"
              />
            </div>
            <Button type="submit" loading={connectApiKey.isPending} className="h-9 text-xs">
              Simpan & Hubungkan
            </Button>
          </form>
          {keyError && <p className="mt-1 text-xs text-bad">{keyError}</p>}
        </div>
      </Card>

      {q.isError && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
      {!q.data && <Skeleton className="h-40 rounded-card" />}
      {q.data?.map((p) => (
        <Card key={p.code} className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-medium">{p.name}</h2>
            <span className="font-mono text-xs text-muted">
              {p.code} · {p.kind}
            </span>
          </div>
          {p.notes && <p className="mt-2 max-w-3xl text-sm text-muted">{p.notes}</p>}
          <ul className="mt-5 grid gap-3 md:grid-cols-3">
            {p.methods.map((m) => (
              <li key={m.method} className="rounded-xl border border-line p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs">{m.method}</span>
                  <Status value={m.available ? 'ok' : 'bad'} label={m.available ? 'available' : 'UNSUPPORTED'} />
                </div>
                {m.reason && <p className="mt-2 text-muted">{m.reason}</p>}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <span className="text-muted">Koneksi member:</span>
            {d.data && Object.entries(d.data.aiProviderHealth).map(([s, n]) => <Status key={s} value={s} label={`${s} ${n}`} />)}
          </div>
        </Card>
      ))}
    </div>
  );
}
