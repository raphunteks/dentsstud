'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, fmtDate } from '@/lib/api';
import { Button, Card, Empty, ErrorNote, Field, Input, PageHead, Skeleton, Status } from '@/components/ui';
import { Audio, Modal, Select, Table } from '@/components/ui/extra';

interface Provider { provider: string; displayName: string; isEnabled: boolean; hasCredential: boolean; config: { baseUrl?: string; model?: string }; lastStatus: string | null; lastCheckedAt: string | null; capabilities: Record<string, boolean> }
interface Voice { id: string; provider: string; providerVoiceId: string; slug: string; name: string; language: string; status: string; voiceAttributes: { gender?: string }; sampleUrl: string | null; synthesisConfig: { verified?: { ok: boolean; at: string; error?: string } } }
const err = (e: unknown) => toast.error((e as Error).message);

export default function VoiceCenter() {
  const qc = useQueryClient();
  const providers = useQuery({ queryKey: ['adm-tts'], queryFn: () => api<Provider[]>('/admin/voice-providers') });
  const voices = useQuery({ queryKey: ['adm-voices'], queryFn: () => api<Voice[]>('/admin/voices') });
  const [creating, setCreating] = useState(false);
  const [audio, setAudio] = useState<Record<string, string>>({});
  const inv = () => (qc.invalidateQueries({ queryKey: ['adm-voices'] }), qc.invalidateQueries({ queryKey: ['adm-tts'] }));
  const act = useMutation({ mutationFn: ({ id, a }: { id: string; a: string }) => (a === 'delete' ? api(`/admin/voices/${id}`, { method: 'DELETE' }) : api(`/admin/voices/${id}/${a}`, { method: 'POST' })), onSuccess: inv, onError: err });
  const test = useMutation({ mutationFn: (id: string) => api<{ audioUrl: string }>(`/admin/voices/${id}/test`, { method: 'POST', json: {} }), onSuccess: (r, id) => (setAudio((a) => ({ ...a, [id]: r.audioUrl })), inv()), onError: (e) => (err(e), inv()) });

  return (
    <>
      <PageHead eyebrow="05 · Voice & TTS center" title="Suara" actions={<Button onClick={() => setCreating(true)}>Tambah suara</Button>} />
      <h2 className="pb-3 font-display text-lg font-medium">Provider</h2>
      {providers.isError && <ErrorNote error={providers.error} />}
      <div className="grid gap-3 md:grid-cols-3">
        {providers.data?.map((p) => <ProviderCard key={p.provider} p={p} onSaved={inv} />) ?? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-56 rounded-card" />)}
      </div>

      <h2 className="mt-10 pb-3 font-display text-lg font-medium">Katalog suara</h2>
      {voices.data?.length === 0 && <Empty title="Katalog suara kosong" body="Tambahkan suara manual atau impor package suara. Suara wajib lolos Test Synthesis sebelum dipublikasikan." />}
      {!!voices.data?.length && (
        <Table head={['Suara', 'Provider', 'Verifikasi', 'Status', 'Sampel', '']} minWidth={900}>
          {voices.data.map((v) => (
            <tr key={v.id}>
              <td><span className="font-medium">{v.name}</span><br /><span className="font-mono text-xs text-muted">{v.providerVoiceId} · {v.language} · {v.voiceAttributes.gender ?? '—'}</span></td>
              <td>{v.provider}</td>
              <td>{v.synthesisConfig.verified ? <Status value={v.synthesisConfig.verified.ok ? 'ok' : 'bad'} label={v.synthesisConfig.verified.ok ? `Lulus ${fmtDate(v.synthesisConfig.verified.at)}` : 'Gagal'} /> : <span className="text-muted">Belum diuji</span>}</td>
              <td><Status value={v.status} /></td>
              <td className="min-w-48"><Audio src={audio[v.id] ?? v.sampleUrl} /></td>
              <td className="whitespace-nowrap text-right">
                <Button variant="ghost" className="h-8" loading={test.isPending && test.variables === v.id} onClick={() => test.mutate(v.id)}>Test synthesis</Button>
                {v.status === 'PUBLISHED' ? <Button variant="ghost" className="ml-2 h-8" onClick={() => act.mutate({ id: v.id, a: 'disable' })}>Nonaktifkan</Button> : <Button className="ml-2 h-8" onClick={() => act.mutate({ id: v.id, a: 'publish' })}>Publish</Button>}
                {v.status !== 'PUBLISHED' && <Button variant="danger" className="ml-2 h-8" onClick={() => confirm('Hapus suara?') && act.mutate({ id: v.id, a: 'delete' })}>Hapus</Button>}
              </td>
            </tr>
          ))}
        </Table>
      )}
      <CreateVoice open={creating} onClose={() => setCreating(false)} onDone={inv} />
    </>
  );
}

function ProviderCard({ p, onSaved }: { p: Provider; onSaved: () => void }) {
  const [key, setKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(p.config.baseUrl ?? '');
  const [model, setModel] = useState(p.config.model ?? '');
  const save = useMutation({
    mutationFn: (body: object) => api(`/admin/voice-providers/${p.provider}`, { method: 'PATCH', json: body }),
    onSuccess: () => (setKey(''), onSaved(), toast.success('Provider diperbarui')),
    onError: err,
  });
  return (
    <Card className="grid content-start gap-3 p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{p.displayName}</h3>
        <Status value={p.isEnabled ? 'ok' : 'neutral'} label={p.isEnabled ? 'Aktif' : 'Nonaktif'} />
      </div>
      <p className="text-xs text-muted">Cek terakhir: {p.lastStatus ?? '—'} {p.lastCheckedAt ? `· ${fmtDate(p.lastCheckedAt)}` : ''} · kredensial {p.hasCredential ? 'tersimpan (terenkripsi)' : 'belum ada'}</p>
      <p className="text-xs text-muted">Kemampuan: {Object.entries(p.capabilities ?? {}).filter(([, v]) => v).map(([k]) => k).join(', ') || '—'}</p>
      {p.provider === 'cadangan' ? (
        <Field id={`url-${p.provider}`} label="URL engine (OpenAI-compatible)"><Input id={`url-${p.provider}`} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://tts.internal" /></Field>
      ) : (
        <Field id={`key-${p.provider}`} label="API key (untuk Test Synthesis Superadmin)"><Input id={`key-${p.provider}`} type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} /></Field>
      )}
      <Field id={`model-${p.provider}`} label="Model default (opsional)"><Input id={`model-${p.provider}`} value={model} onChange={(e) => setModel(e.target.value)} /></Field>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" loading={save.isPending} onClick={() => save.mutate({ ...(key ? { apiKey: key } : {}), ...(p.provider === 'cadangan' ? { baseUrl: baseUrl || null } : {}), model: model || null })}>Simpan & cek</Button>
        <Button variant={p.isEnabled ? 'danger' : 'primary'} onClick={() => save.mutate({ isEnabled: !p.isEnabled })}>{p.isEnabled ? 'Nonaktifkan' : 'Aktifkan'}</Button>
      </div>
    </Card>
  );
}

function CreateVoice({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ provider: 'gemini', providerVoiceId: '', name: '', slug: '', language: 'id-ID', gender: '' });
  const create = useMutation({
    mutationFn: () => api('/admin/voices', { method: 'POST', json: { provider: f.provider, providerVoiceId: f.providerVoiceId, name: f.name, slug: f.slug, language: f.language, voiceAttributes: f.gender ? { gender: f.gender } : {}, capabilities: { emotion: f.provider === 'gemini', speed: true, pitch: false, instructions: f.provider === 'gemini' } } }),
    onSuccess: () => (onDone(), onClose(), toast.success('Suara dibuat sebagai Draft. Jalankan Test synthesis lalu Publish.')),
    onError: err,
  });
  return (
    <Modal open={open} onClose={onClose} title="Tambah suara">
      <form className="grid gap-3" onSubmit={(e) => (e.preventDefault(), create.mutate())}>
        <Field id="v-prov" label="Provider"><Select id="v-prov" value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })}><option value="gemini">Gemini API</option><option value="elevenlabs">ElevenLabs</option><option value="cadangan">Cadangan</option></Select></Field>
        <Field id="v-pid" label="Voice ID / nama voice di provider" hint="Gemini: nama voice (mis. Kore). ElevenLabs: voice_id."><Input id="v-pid" value={f.providerVoiceId} onChange={(e) => setF({ ...f, providerVoiceId: e.target.value })} /></Field>
        <Field id="v-name" label="Nama tampilan"><Input id="v-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })} /></Field>
        <Field id="v-lang" label="Bahasa"><Input id="v-lang" value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })} /></Field>
        <Field id="v-gender" label="Karakter"><Select id="v-gender" value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}><option value="">Tidak ditentukan</option><option value="female">Wanita</option><option value="male">Pria</option><option value="neutral">Netral</option></Select></Field>
        <Button type="submit" loading={create.isPending} disabled={!f.providerVoiceId || f.name.length < 2}>Simpan draft</Button>
      </form>
    </Modal>
  );
}
