'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError, fmtDate } from '@/lib/api';
import { Button, Card, Empty, ErrorNote, Field, Input, PageHead, Skeleton, Status } from '@/components/ui';

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
interface Provider {
  code: string;
  name: string;
  notes: string | null;
  methods: { method: string; available: boolean; reason: string | null }[];
}

const METHOD_LABEL: Record<string, string> = { API_KEY: 'Claude API key', CLAUDE_CODE_LOCAL: 'Claude Code (desktop)', OAUTH_PKCE: 'OAuth PKCE' };

export default function ClaudeSettingsPage() {
  const qc = useQueryClient();
  const conns = useQuery({ queryKey: ['ai-connections'], queryFn: () => api<Conn[]>('/ai/connections') });
  const providers = useQuery({ queryKey: ['ai-providers'], queryFn: () => api<Provider[]>('/ai/providers'), staleTime: 5 * 60_000 });
  const [apiKey, setApiKey] = useState('');
  const [keyError, setKeyError] = useState<string>();
  const [answers, setAnswers] = useState<Record<string, { answer: string; model: string; latencyMs: number }>>({});
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ai-connections'] });
    qc.invalidateQueries({ queryKey: ['me-dashboard'] });
  };

  const connect = useMutation({
    mutationFn: () => api<{ connection: Conn }>('/ai/connections/start', { method: 'POST', json: { provider: 'anthropic', method: 'API_KEY', apiKey: apiKey.trim() } }),
    onSuccess: (r) => {
      setApiKey('');
      setKeyError(undefined);
      toast[r.connection.status === 'CONNECTED' ? 'success' : 'warning'](`Status koneksi: ${r.connection.status}`);
      invalidate();
    },
    onError: (e) => setKeyError(e instanceof ApiError ? e.message : 'Gagal menyimpan'),
  });
  const connectOAuth = useMutation({
    mutationFn: () =>
      api<{ authorizeUrl: string }>('/ai/connections/start', {
        method: 'POST',
        json: {
          provider: 'anthropic',
          method: 'OAUTH_PKCE',
          redirectUri: `${window.location.origin}/callback`,
        },
      }),
    onSuccess: (r) => {
      window.location.href = r.authorizeUrl;
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const check = useMutation({
    mutationFn: (id: string) => api<Conn>(`/ai/connections/${id}/check`, { method: 'POST' }),
    onSuccess: (c) => {
      toast(`Cek koneksi: ${c.status}`);
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const test = useMutation({
    mutationFn: (id: string) => api<{ answer: string; model: string; latencyMs: number }>(`/ai/connections/${id}/test`, { method: 'POST', json: {} }),
    onSuccess: (r, id) => setAnswers((a) => ({ ...a, [id]: r })),
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
  });

  const anthropic = providers.data?.find((p) => p.code === 'anthropic');

  return (
    <>
      <PageHead eyebrow="Pengaturan" title="Koneksi Claude" />
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="grid gap-4">
          {conns.isError && <ErrorNote error={conns.error} onRetry={() => conns.refetch()} />}
          {conns.isLoading && <Skeleton className="h-32" />}
          {conns.data?.length === 0 && <Empty title="Belum terhubung" body="Tambahkan Claude API key milik Anda, atau hubungkan Claude Code resmi dari aplikasi desktop." />}
          {conns.data?.map((c) => (
            <Card key={c.id} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{METHOD_LABEL[c.method] ?? c.method}</p>
                  <p className="text-sm text-muted">
                    {c.credentialHint && <span className="num">{c.credentialHint} · </span>}
                    Dicek {fmtDate(c.lastCheckedAt)}
                  </p>
                </div>
                <Status value={c.status} />
              </div>
              {c.lastError && <p className="mt-3 text-sm text-bad">{c.lastError}</p>}
              {c.capabilities.defaultModel && (
                <p className="mt-3 text-sm text-muted">
                  Model default: <span className="num text-text">{c.capabilities.defaultModel}</span> · {c.capabilities.models?.length ?? 0} model tersedia
                </p>
              )}
              {answers[c.id] && (
                <div className="mt-4 rounded-lg bg-surface-2 p-3 text-sm">
                  <p className="whitespace-pre-wrap">{answers[c.id]!.answer}</p>
                  <p className="num mt-2 text-xs text-muted">
                    {answers[c.id]!.model} · {answers[c.id]!.latencyMs} ms
                  </p>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="ghost" loading={check.isPending && check.variables === c.id} onClick={() => check.mutate(c.id)}>
                  Cek koneksi
                </Button>
                {(c.method === 'API_KEY' || c.method === 'OAUTH_PKCE') && (
                  <Button variant="ghost" loading={test.isPending && test.variables === c.id} onClick={() => test.mutate(c.id)}>
                    Tes jawab
                  </Button>
                )}
                <Button variant="danger" loading={remove.isPending && remove.variables === c.id} onClick={() => confirm('Hapus koneksi dan kredensial ini?') && remove.mutate(c.id)}>
                  Hapus
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid content-start gap-4">
          <Card className="p-5">
            <h2 className="font-display text-lg font-medium">Connect Claude — OAuth (9Router)</h2>
            <p className="mt-1 text-sm text-muted">
              Hubungkan akun Claude Anda langsung dengan OAuth PKCE persis pola 9Router tanpa perlu memasukkan API key manual.
            </p>
            <div className="mt-4">
              <Button
                className="w-full"
                loading={connectOAuth.isPending}
                onClick={() => connectOAuth.mutate()}
              >
                Connect Claude via OAuth
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-lg font-medium">Connect Claude — API key</h2>
            <p className="mt-1 text-sm text-muted">Key divalidasi langsung ke Anthropic, disimpan terenkripsi (AES-256-GCM), dan tidak pernah ditampilkan ulang.</p>
            <form
              className="mt-4 grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (apiKey.trim().length < 20) return setKeyError('API key tidak valid');
                connect.mutate();
              }}
            >
              <Field id="apiKey" label="Anthropic API key" error={keyError}>
                <Input id="apiKey" type="password" autoComplete="off" spellCheck={false} placeholder="sk-ant-…" value={apiKey} onChange={(e) => setApiKey(e.target.value)} invalid={!!keyError} />
              </Field>
              <Button type="submit" loading={connect.isPending}>
                Simpan dan verifikasi
              </Button>
            </form>
          </Card>
          <Card className="p-5">
            <h2 className="font-display text-lg font-medium">Metode lain</h2>
            <ul className="mt-3 grid gap-3 text-sm">
              {anthropic?.methods
                .filter((m) => m.method !== 'API_KEY')
                .map((m) => (
                  <li key={m.method} className="grid gap-1">
                    <span className="flex items-center justify-between">
                      {METHOD_LABEL[m.method]}
                      <Status value={m.available ? (m.method === 'CLAUDE_CODE_LOCAL' ? 'warn' : 'ok') : 'bad'} label={m.available ? (m.method === 'CLAUDE_CODE_LOCAL' ? 'Desktop' : 'Tersedia') : 'UNSUPPORTED'} />
                    </span>
                    {m.reason && <span className="text-muted">{m.reason}</span>}
                  </li>
                )) ?? <Skeleton className="h-16" />}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
