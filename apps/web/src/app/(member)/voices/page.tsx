'use client';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button, Card, Empty, Field, PageHead, Skeleton, Status } from '@/components/ui';
import { Audio, Select, Tabs, Textarea } from '@/components/ui/extra';

interface Prov { provider: string; displayName: string; isEnabled: boolean; voiceCount: number; capabilities: { emotion: boolean; speed: boolean; pitch: boolean; instructions: boolean }; accountStatus: string }
interface Voice { id: string; name: string; provider: string; language: string; description: string; voiceAttributes: { gender?: string; tone?: string }; sampleUrl: string | null }
interface Pref { voiceId: string | null; emotion: string | null; speed: number; pitch: number | null; instructions: string | null; voiceActive: boolean }
const EMOTIONS = ['', 'hangat', 'antusias', 'tenang', 'serius', 'ceria', 'dramatis'];

export default function VoiceStudio() {
  const qc = useQueryClient();
  const provs = useQuery({ queryKey: ['voice-provs'], queryFn: () => api<Prov[]>('/voices/providers') });
  const [prov, setProv] = useState('cadangan');
  const [gender, setGender] = useState('');
  const voices = useQuery({ queryKey: ['voices', prov, gender], queryFn: () => api<Voice[]>(`/voices?provider=${prov}${gender ? `&gender=${gender}` : ''}`) });
  const pref = useQuery({ queryKey: ['voice-pref'], queryFn: () => api<Pref>('/voices/preferences/me') });
  const [sel, setSel] = useState<string | null>(null);
  const [cfg, setCfg] = useState({ emotion: '', speed: 1, pitch: 0, instructions: '' });
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (provs.data?.length && !provs.data.find((x) => x.provider === prov && x.isEnabled)) {
      const active = provs.data.find((x) => x.isEnabled) || provs.data[0];
      if (active) setProv(active.provider);
    }
  }, [provs.data, prov]);

  useEffect(() => {
    if (pref.data) {
      setSel(pref.data.voiceId);
      setCfg({ emotion: pref.data.emotion ?? '', speed: Number(pref.data.speed), pitch: Number(pref.data.pitch ?? 0), instructions: pref.data.instructions ?? '' });
    }
  }, [pref.data]);
  const p = provs.data?.find((x) => x.provider === prov);
  const caps = p?.capabilities ?? { emotion: false, speed: false, pitch: false, instructions: false };
  const body = () => ({ emotion: caps.emotion ? cfg.emotion || null : null, speed: caps.speed ? cfg.speed : 1, pitch: caps.pitch ? cfg.pitch : null, instructions: caps.instructions ? cfg.instructions || null : null });
  const tryIt = useMutation({ mutationFn: () => api<{ audioUrl: string }>(`/voices/${sel}/preview`, { method: 'POST', json: body() }), onSuccess: (r) => setPreview(r.audioUrl), onError: (e) => toast.error((e as Error).message) });
  const save = useMutation({ mutationFn: () => api('/voices/preferences/me', { method: 'PUT', json: { voiceId: sel, ...body() } }), onSuccess: () => (toast.success('Suara default disimpan'), qc.invalidateQueries({ queryKey: ['voice-pref'] })), onError: (e) => toast.error((e as Error).message) });

  return (
    <>
      <PageHead eyebrow="Studio" title="Suara narator" />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs label="Provider suara" value={prov} onChange={(v) => (setProv(v), setSel(null))} items={(provs.data ?? []).map((x) => ({ value: x.provider, label: <>{x.displayName} <span className="num text-xs opacity-70">{x.voiceCount}</span></> }))} />
        <Tabs label="Filter karakter" value={gender} onChange={setGender} items={[{ value: '', label: 'Semua' }, { value: 'male', label: 'Pria' }, { value: 'female', label: 'Wanita' }]} />
      </div>
      {p && !p.isEnabled && <p className="mb-4 text-sm text-muted">{p.displayName} belum diaktifkan Superadmin.</p>}
      {p && p.accountStatus !== 'CONNECTED' && <p className="mb-4 text-sm">Coba suara memakai akun Anda sendiri. <Link className="text-accent underline-offset-4 hover:underline" href="/settings/voice-accounts">Atur akun {p.displayName}</Link> · status <Status value={p.accountStatus} /></p>}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div>
          {voices.isLoading && <Skeleton className="h-48 rounded-card" />}
          {voices.data?.length === 0 && <Empty title="Belum ada suara" body="Katalog suara provider ini masih kosong. Anda tetap bisa memesan video tanpa narasi atau mengunggah rekaman sendiri." />}
          <div className="grid gap-2 sm:grid-cols-2">
            {voices.data?.map((v) => (
              <button key={v.id} onClick={() => setSel(v.id)} aria-pressed={sel === v.id} className={`grid gap-2 rounded-card border p-4 text-left transition-colors ${sel === v.id ? 'border-accent bg-surface-2' : 'border-line bg-surface hover:bg-surface-2'}`}>
                <span className="flex items-center justify-between font-medium">{v.name}<span className="text-xs text-muted">{v.voiceAttributes.gender === 'male' ? 'Pria' : v.voiceAttributes.gender === 'female' ? 'Wanita' : ''}</span></span>
                <span className="text-xs text-muted">{v.language}{v.voiceAttributes.tone ? ` · ${v.voiceAttributes.tone}` : ''}</span>
                {v.sampleUrl && <span onClick={(e) => e.stopPropagation()}><Audio src={v.sampleUrl} /></span>}
              </button>
            ))}
          </div>
        </div>
        <Card className="grid content-start gap-4 p-5">
          <h2 className="font-display text-lg font-medium">Cara bicara</h2>
          <Field id="emo" label="Emosi" hint={caps.emotion ? undefined : 'Tidak didukung provider ini'}>
            <Select id="emo" disabled={!caps.emotion} value={cfg.emotion} onChange={(e) => setCfg({ ...cfg, emotion: e.target.value })}>{EMOTIONS.map((x) => <option key={x} value={x}>{x || 'Netral'}</option>)}</Select>
          </Field>
          <Field id="spd" label={`Kecepatan ${cfg.speed.toFixed(2)}×`} hint={caps.speed ? undefined : 'Tidak didukung'}>
            <input id="spd" type="range" min={0.7} max={1.3} step={0.05} disabled={!caps.speed} value={cfg.speed} onChange={(e) => setCfg({ ...cfg, speed: Number(e.target.value) })} className="accent-[var(--accent)]" />
          </Field>
          <Field id="pitch" label={`Nada ${cfg.pitch}`} hint={caps.pitch ? undefined : 'Tidak didukung provider ini'}>
            <input id="pitch" type="range" min={-6} max={6} step={1} disabled={!caps.pitch} value={cfg.pitch} onChange={(e) => setCfg({ ...cfg, pitch: Number(e.target.value) })} />
          </Field>
          <Field id="ins" label="Arahan tambahan" hint={caps.instructions ? 'Mis. "seperti guru yang sabar"' : 'Tidak didukung provider ini'}>
            <Textarea id="ins" disabled={!caps.instructions} value={cfg.instructions} onChange={(e) => setCfg({ ...cfg, instructions: e.target.value })} className="min-h-16" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" disabled={!sel} loading={tryIt.isPending} onClick={() => tryIt.mutate()}>Coba suara</Button>
            <Button disabled={!sel} loading={save.isPending} onClick={() => save.mutate()}>Simpan default</Button>
          </div>
          <Audio src={preview} />
          {pref.data?.voiceId && !pref.data.voiceActive && <p className="text-sm text-warn">Suara default Anda tidak lagi aktif. Pilih suara lain.</p>}
        </Card>
      </div>
    </>
  );
}
