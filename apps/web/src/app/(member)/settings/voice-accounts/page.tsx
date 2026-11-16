'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, fmtDate } from '@/lib/api';
import { Button, Card, Field, Input, PageHead, Skeleton, Status } from '@/components/ui';

interface Acc { provider: string; displayName: string; providerEnabled: boolean; status: string; credentialHint: string | null; lastError: string | null; lastCheckedAt: string | null }

export default function VoiceAccounts() {
  const q = useQuery({ queryKey: ['voice-accounts'], queryFn: () => api<Acc[]>('/settings/voice-accounts') });
  return (
    <>
      <PageHead eyebrow="Pengaturan" title="Akun suara" />
      <p className="mb-5 max-w-2xl text-sm text-muted">Kunci API milik Anda dipakai untuk Coba Suara dan narasi produksi. Disimpan terenkripsi, tidak dibagi dengan member lain, dan tidak bisa dibaca Superadmin.</p>
      <div className="grid gap-3 md:grid-cols-3">{q.data?.map((a) => <AccCard key={a.provider} a={a} />) ?? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-56 rounded-card" />)}</div>
    </>
  );
}

function AccCard({ a }: { a: Acc }) {
  const qc = useQueryClient();
  const [v, setV] = useState('');
  const inv = () => (qc.invalidateQueries({ queryKey: ['voice-accounts'] }), qc.invalidateQueries({ queryKey: ['voice-provs'] }));
  const save = useMutation({ mutationFn: () => api(`/settings/voice-accounts/${a.provider}`, { method: 'PUT', json: a.provider === 'cadangan' ? { baseUrl: v } : { apiKey: v } }), onSuccess: () => (setV(''), inv(), toast.success('Tersimpan')), onError: (e) => toast.error((e as Error).message) });
  const test = useMutation({ mutationFn: () => api<{ status: string; error?: string }>(`/settings/voice-accounts/${a.provider}/test`, { method: 'POST' }), onSuccess: (r) => (toast(`Status: ${r.status}${r.error ? ` — ${r.error}` : ''}`), inv()) });
  const del = useMutation({ mutationFn: () => api(`/settings/voice-accounts/${a.provider}`, { method: 'DELETE' }), onSuccess: inv });
  return (
    <Card className="grid content-start gap-3 p-5">
      <div className="flex items-center justify-between"><h2 className="font-medium">{a.displayName}</h2><Status value={a.status} /></div>
      <p className="text-xs text-muted">{a.credentialHint ? `Kunci ${a.credentialHint}` : 'Belum diatur'} {a.lastCheckedAt ? `· dicek ${fmtDate(a.lastCheckedAt)}` : ''}{a.providerEnabled ? '' : ' · provider belum diaktifkan Superadmin'}</p>
      {a.lastError && <p className="text-xs text-bad">{a.lastError}</p>}
      <Field id={`acc-${a.provider}`} label={a.provider === 'cadangan' ? 'URL engine' : 'API key'}>
        <Input id={`acc-${a.provider}`} type={a.provider === 'cadangan' ? 'url' : 'password'} autoComplete="off" value={v} onChange={(e) => setV(e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button loading={save.isPending} disabled={v.length < 10} onClick={() => save.mutate()}>Simpan & verifikasi</Button>
        {a.status !== 'NOT_CONFIGURED' && <Button variant="ghost" loading={test.isPending} onClick={() => test.mutate()}>Tes provider</Button>}
        {a.status !== 'NOT_CONFIGURED' && <Button variant="danger" onClick={() => del.mutate()}>Hapus</Button>}
      </div>
    </Card>
  );
}
