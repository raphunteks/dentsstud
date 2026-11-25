'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button, Card, ErrorNote, Field, Input, PageHead, Skeleton, Status } from '@/components/ui';
import { MultiProviderPanel, type AiProviderInfo } from '@/components/ai/multi-provider-panel';

interface OAuthClientCfg {
  clientId: string;
  hasSecret: boolean;
  redirectUri: string;
  configured: boolean;
}
interface OAuthClientsRes {
  gemini: OAuthClientCfg;
  openai: OAuthClientCfg;
}

function OAuthClientsCard() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['admin-oauth-clients'], queryFn: () => api<OAuthClientsRes>('/admin/ai/oauth-clients') });
  const [gId, setGId] = useState('');
  const [gSec, setGSec] = useState('');
  const [gRedir, setGRedir] = useState('');
  const [oId, setOId] = useState('');
  const [oSec, setOSec] = useState('');
  const [oRedir, setORedir] = useState('');

  useEffect(() => {
    if (!q.data) return;
    setGId(q.data.gemini.clientId);
    setGRedir(q.data.gemini.redirectUri);
    setOId(q.data.openai.clientId);
    setORedir(q.data.openai.redirectUri);
  }, [q.data]);

  const save = useMutation({
    mutationFn: () =>
      api<OAuthClientsRes>('/admin/ai/oauth-clients', {
        method: 'PATCH',
        json: {
          gemini: { clientId: gId, ...(gSec.trim() ? { clientSecret: gSec } : {}), redirectUri: gRedir },
          openai: { clientId: oId, ...(oSec.trim() ? { clientSecret: oSec } : {}), redirectUri: oRedir },
        },
      }),
    onSuccess: () => {
      toast.success('Konfigurasi OAuth Client disimpan (aktif instan tanpa restart)');
      setGSec('');
      setOSec('');
      qc.invalidateQueries({ queryKey: ['admin-oauth-clients'] });
      qc.invalidateQueries({ queryKey: ['ai-providers'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-medium">Konfigurasi OAuth Client (Google / OpenAI)</h2>
          <p className="mt-0.5 text-xs text-muted">
            Simpan Client ID &amp; Secret resmi Anda agar tombol OAuth PKCE aktif secara dinamis untuk seluruh member.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {q.data && (
            <>
              <Status value={q.data.gemini.configured ? 'ok' : 'warn'} label={q.data.gemini.configured ? 'Google OK' : 'Google Off'} />
              <Status value={q.data.openai.configured ? 'ok' : 'warn'} label={q.data.openai.configured ? 'OpenAI OK' : 'OpenAI Off'} />
            </>
          )}
          <Button variant="ghost" className="h-9 text-xs" onClick={() => setOpen((v) => !v)}>
            {open ? 'Tutup' : 'Atur OAuth Client'}
          </Button>
        </div>
      </div>

      {open && (
        <form
          className="mt-4 grid gap-4 border-t border-line pt-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Google Cloud OAuth (Gemini)</p>
            <Field id="g-cid" label="Google Client ID">
              <Input id="g-cid" value={gId} onChange={(e) => setGId(e.target.value)} placeholder="xxxx.apps.googleusercontent.com" />
            </Field>
            <Field id="g-sec" label={q.data?.gemini.hasSecret ? 'Google Client Secret (tersimpan — isi untuk ganti)' : 'Google Client Secret'}>
              <Input id="g-sec" type="password" value={gSec} onChange={(e) => setGSec(e.target.value)} placeholder="GOCSPX-…" />
            </Field>
            <Field id="g-redir" label="Redirect URI (opsional)">
              <Input id="g-redir" value={gRedir} onChange={(e) => setGRedir(e.target.value)} placeholder="https://motion.dentsweb.my.id/callback" />
            </Field>
          </div>
          <div className="grid gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">OpenAI OAuth Client</p>
            <Field id="o-cid" label="OpenAI Client ID">
              <Input id="o-cid" value={oId} onChange={(e) => setOId(e.target.value)} placeholder="app_…" />
            </Field>
            <Field id="o-sec" label={q.data?.openai.hasSecret ? 'OpenAI Client Secret (tersimpan — isi untuk ganti)' : 'OpenAI Client Secret'}>
              <Input id="o-sec" type="password" value={oSec} onChange={(e) => setOSec(e.target.value)} placeholder="Kosongkan jika PKCE public client" />
            </Field>
            <Field id="o-redir" label="Redirect URI (opsional)">
              <Input id="o-redir" value={oRedir} onChange={(e) => setORedir(e.target.value)} placeholder="https://motion.dentsweb.my.id/callback" />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Button type="submit" loading={save.isPending}>
              Simpan Konfigurasi OAuth
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

export default function AiProvidersPage() {
  const q = useQuery({ queryKey: ['ai-providers'], queryFn: () => api<AiProviderInfo[]>('/ai/providers') });
  const d = useQuery({ queryKey: ['admin-dash'], queryFn: () => api<{ aiProviderHealth: Record<string, number> }>('/admin/dashboard') });

  return (
    <div className="grid gap-6">
      <PageHead eyebrow="06 · AI provider center" title="Multi-Provider AI & Auto-Fallback" />
      <MultiProviderPanel isAdmin />
      <OAuthClientsCard />

      <div className="grid gap-4">
        <h2 className="font-display text-xl font-medium">Provider Registry &amp; Status Global</h2>
        {q.isError && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
        {q.isLoading && <Skeleton className="h-40 rounded-card" />}
        <div className="grid gap-3 md:grid-cols-2">
          {q.data?.map((p) => (
            <Card key={p.code} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-base font-medium">{p.name}</h3>
                <span className="font-mono text-xs text-muted">
                  {p.code} · {p.kind}
                </span>
              </div>
              {p.notes && <p className="mt-1.5 text-xs text-muted">{p.notes}</p>}
              <ul className="mt-3 grid gap-2 text-xs">
                {p.methods.map((m) => (
                  <li key={m.method} className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
                    <span className="font-mono">{m.method}</span>
                    <Status value={m.available ? 'ok' : 'warn'} label={m.available ? 'Tersedia' : 'Perlu Config'} />
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        {d.data && (
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted">Ringkasan koneksi member:</span>
              {Object.entries(d.data.aiProviderHealth).map(([s, n]) => (
                <Status key={s} value={s} label={`${s} ${n}`} />
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
