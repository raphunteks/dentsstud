'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import clsx from 'clsx';
import { api, ApiError, fmtBytes } from '@/lib/api';
import { Button, Card, ErrorNote, Input, PageHead, Skeleton } from '@/components/ui';
import { Select, Textarea } from '@/components/ui/extra';

interface Ready {
  license: string;
  entitlements: { maxWorkers: number; maxVideosPerDay: number; cloudRender: boolean };
  usedToday: number;
  remainingToday: number;
  claudeApiKey: boolean;
  ttsAccounts: string[];
  published: { voices: number; presets: number; hooks: number };
}
interface Voice { id: string; name: string; provider: string; language: string; voiceAttributes: { gender?: string } }
interface Preset { id: string; name: string; thumbnailUrl: string | null; category: { name: string } }
interface Hook { id: string; name: string }
interface Pref { voiceId: string | null; emotion: string | null; speed: number; pitch: number | null; instructions: string | null }
interface Media { id: string; filename: string; mimeType: string; sizeBytes: number }

type Format = '9:16' | '16:9' | '1:1';
type TopicMode = 'BEBAS' | 'UMUM' | 'PERSIS';
type VoiceMode = 'TTS' | 'NONE' | 'UPLOAD';
type HookMode = 'AUTO' | 'PRESET' | 'NONE';

const FORMATS: { v: Format; label: string; hint: string }[] = [
  { v: '9:16', label: '9:16', hint: 'Reels, TikTok, Shorts' },
  { v: '16:9', label: '16:9', hint: 'YouTube, presentasi' },
  { v: '1:1', label: '1:1', hint: 'Feed persegi' },
];
const TOPIC_MODES: { v: TopicMode; label: string; hint: string }[] = [
  { v: 'BEBAS', label: 'Bebas', hint: 'AI memilih topik edukasi yang relevan' },
  { v: 'UMUM', label: 'Tema umum', hint: 'Satu tema, tiap video sudut berbeda' },
  { v: 'PERSIS', label: 'Topik persis', hint: 'Satu baris = satu video' },
];

async function uploadOne(file: File): Promise<Media> {
  const fd = new FormData();
  fd.append('file', file, file.name);
  const res = await fetch('/api/v1/media', { method: 'POST', body: fd, credentials: 'include' });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body?.error?.code ?? 'ERROR', body?.error?.message ?? 'Upload gagal');
  return body as Media;
}

function Section({ n, title, children, note }: { n: number; title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section aria-labelledby={`s${n}`} className="grid gap-4 border-t border-line py-7 first:border-0 first:pt-0 md:grid-cols-[180px_1fr]">
      <div>
        <p className="num font-mono text-xs text-muted">{String(n).padStart(2, '0')}</p>
        <h2 id={`s${n}`} className="font-display text-lg font-medium leading-tight">{title}</h2>
        {note && <p className="mt-1 text-xs text-muted">{note}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Choice({ active, disabled, onClick, title, hint }: { active: boolean; disabled?: boolean; onClick: () => void; title: string; hint?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'rounded-xl border px-4 py-3 text-left transition-[border-color,background-color,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45',
        active ? 'border-accent bg-accent/10' : 'border-line bg-surface hover:border-text/30',
      )}
    >
      <span className="block text-sm font-medium">{title}</span>
      {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
    </button>
  );
}

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-line bg-surface" role="group" aria-label={label}>
      <button type="button" className="grid size-11 place-items-center text-lg disabled:opacity-40" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`Kurangi ${label}`}>−</button>
      <span className="num w-10 text-center font-mono text-base" aria-live="polite">{value}</span>
      <button type="button" className="grid size-11 place-items-center text-lg disabled:opacity-40" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`Tambah ${label}`}>+</button>
    </div>
  );
}

export default function CreateContentPage() {
  const router = useRouter();
  const ready = useQuery({ queryKey: ['production-readiness'], queryFn: () => api<Ready>('/production/readiness') });
  const voices = useQuery({ queryKey: ['voices-all'], queryFn: () => api<Voice[]>('/voices') });
  const presets = useQuery({ queryKey: ['presets-all'], queryFn: () => api<{ items: Preset[] }>('/styles/presets?limit=100') });
  const hooks = useQuery({ queryKey: ['hooks-all'], queryFn: () => api<Hook[]>('/hooks') });
  const pref = useQuery({ queryKey: ['voice-pref'], queryFn: () => api<Pref>('/voices/preferences/me') });

  const [quantity, setQuantity] = useState(1);
  const [workers, setWorkers] = useState(1);
  const [format, setFormat] = useState<Format>('9:16');
  const [topicMode, setTopicMode] = useState<TopicMode>('BEBAS');
  const [topic, setTopic] = useState('');
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('NONE');
  const [voiceId, setVoiceId] = useState<string>('');
  const [upload, setUpload] = useState<Media | null>(null);
  const [presetId, setPresetId] = useState<string>('');
  const [refs, setRefs] = useState<Media[]>([]);
  const [hookMode, setHookMode] = useState<HookMode>('AUTO');
  const [hookId, setHookId] = useState('');
  const [notes, setNotes] = useState('');
  const [busyUpload, setBusyUpload] = useState(false);
  const idem = useRef(crypto.randomUUID());

  const r = ready.data;
  const usableVoices = useMemo(() => (voices.data ?? []).filter((v) => r?.ttsAccounts.includes(v.provider)), [voices.data, r]);
  const ttsAvailable = usableVoices.length > 0;
  // Default to the member's saved voice once data arrives (only if usable).
  const prefApplied = useRef(false);
  useEffect(() => {
    if (prefApplied.current || !pref.data?.voiceId || !usableVoices.some((v) => v.id === pref.data!.voiceId)) return;
    prefApplied.current = true;
    setVoiceId(pref.data.voiceId);
    setVoiceMode('TTS');
  }, [pref.data, usableVoices]);
  const lines = topic.split('\n').map((l) => l.trim()).filter((l) => l.length >= 2);
  const effQty = topicMode === 'PERSIS' ? Math.max(1, lines.length) : quantity;
  const maxWorkers = Math.max(1, r?.entitlements.maxWorkers ?? 1);
  const remaining = r?.remainingToday ?? 0;

  const blockers: string[] = [];
  if (r && r.license !== 'ACTIVE') blockers.push('Lisensi belum aktif');
  if (r && !r.claudeApiKey) blockers.push('Claude belum terhubung lewat API key');
  if (r && !r.entitlements.cloudRender) blockers.push('Lisensi tidak mencakup render cloud');
  if (r && effQty > remaining) blockers.push(`Kuota hari ini tersisa ${remaining} video`);
  if (topicMode !== 'BEBAS' && lines.length === 0) blockers.push('Isi tema atau topik');
  if (voiceMode === 'TTS' && !voiceId) blockers.push('Pilih suara narator');
  if (voiceMode === 'UPLOAD' && !upload) blockers.push('Unggah rekaman suara');
  if (hookMode === 'PRESET' && !hookId) blockers.push('Pilih hook');

  const submit = useMutation({
    mutationFn: () =>
      api<{ id: string; runs: { id: string }[]; duplicate: boolean }>('/production/orders', {
        method: 'POST',
        headers: { 'idempotency-key': idem.current },
        json: {
          quantity: effQty,
          workers: Math.min(workers, effQty),
          format,
          topicMode,
          topic: topicMode === 'UMUM' ? lines[0] ?? '' : '',
          topics: topicMode === 'PERSIS' ? lines : [],
          voice: voiceMode === 'TTS' ? { mode: 'TTS', voiceId, emotion: pref.data?.emotion ?? null, speed: pref.data?.speed ?? 1, pitch: pref.data?.pitch ?? null, instructions: pref.data?.instructions ?? null } : voiceMode === 'UPLOAD' ? { mode: 'UPLOAD', uploadAssetId: upload?.id } : { mode: 'NONE' },
          presetId: presetId || null,
          referenceAssetIds: refs.map((x) => x.id),
          hook: { mode: hookMode, hookId: hookMode === 'PRESET' ? hookId : null },
          notes,
        },
      }),
    onSuccess: (o) => {
      toast.success(`${o.runs.length} video masuk antrean produksi`);
      idem.current = crypto.randomUUID();
      router.push(o.runs.length === 1 ? `/progress?run=${o.runs[0]!.id}` : '/progress');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const pick = async (files: FileList | null, kind: 'audio' | 'video') => {
    if (!files?.length) return;
    setBusyUpload(true);
    try {
      for (const f of Array.from(files).slice(0, kind === 'video' ? 2 - refs.length : 1)) {
        if (!f.type.startsWith(`${kind}/`)) throw new Error(kind === 'audio' ? 'Pilih file audio' : 'Pilih file video');
        const m = await uploadOne(f);
        if (kind === 'audio') setUpload(m);
        else setRefs((x) => [...x, m].slice(0, 2));
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyUpload(false);
    }
  };

  const preset = presets.data?.items.find((p) => p.id === presetId);
  const voice = usableVoices.find((v) => v.id === voiceId);
  const summary: [string, string][] = [
    ['Video', `${effQty} × ${format}`],
    ['Worker', `${Math.min(workers, effQty)} paralel`],
    ['Topik', topicMode === 'BEBAS' ? 'Dipilih AI' : topicMode === 'UMUM' ? lines[0] ?? '—' : `${lines.length} topik`],
    ['Narator', voiceMode === 'TTS' ? voice?.name ?? '—' : voiceMode === 'UPLOAD' ? upload?.filename ?? '—' : 'Tanpa narasi'],
    ['Gaya', preset?.name ?? 'Gaya bawaan'],
    ['Referensi', refs.length ? `${refs.length} video` : '—'],
    ['Hook', hookMode === 'AUTO' ? 'Otomatis' : hookMode === 'NONE' ? 'Tanpa hook' : hooks.data?.find((h) => h.id === hookId)?.name ?? '—'],
    ['Estimasi', effQty === 1 ? '± 1 - 2 menit' : `± ${Math.max(1, Math.ceil(effQty / workers) * 2)} menit`],
  ];

  if (ready.isLoading) return <><PageHead eyebrow="Produksi" title="Buat Konten" /><Skeleton className="h-96 rounded-card" /></>;
  if (ready.isError) return <><PageHead eyebrow="Produksi" title="Buat Konten" /><ErrorNote error={ready.error} onRetry={() => ready.refetch()} /></>;

  return (
    <>
      <PageHead eyebrow="Produksi" title="Buat Konten" />
      {r && !r.claudeApiKey && (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 border-warn/40 px-5 py-4">
          <p className="text-sm">Produksi otomatis berjalan di server dan memakai API key Anthropic milik Anda.</p>
          <Link href="/settings/claude" className="inline-flex h-10 items-center rounded-[10px] bg-accent px-4 text-sm font-medium text-accent-contrast">Hubungkan Claude</Link>
        </Card>
      )}
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <form
          className="min-w-0"
          onSubmit={(e) => {
            e.preventDefault();
            if (!blockers.length) submit.mutate();
          }}
        >
          <Section n={1} title="Jumlah, worker, format" note={`Kuota hari ini: ${remaining} dari ${r?.entitlements.maxVideosPerDay ?? 0}`}>
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <p className="mb-2 text-xs text-muted">Jumlah video</p>
                {topicMode === 'PERSIS' ? <p className="num h-11 font-mono text-base leading-[44px]">{effQty} <span className="text-xs text-muted">(dari daftar topik)</span></p> : <Stepper value={quantity} min={1} max={Math.max(1, Math.min(50, remaining))} onChange={setQuantity} label="jumlah video" />}
              </div>
              <div>
                <p className="mb-2 text-xs text-muted">Worker paralel (maks {maxWorkers})</p>
                <Stepper value={workers} min={1} max={maxWorkers} onChange={setWorkers} label="worker" />
              </div>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {FORMATS.map((f) => <Choice key={f.v} active={format === f.v} onClick={() => setFormat(f.v)} title={f.label} hint={f.hint} />)}
            </div>
          </Section>

          <Section n={2} title="Tema atau topik">
            <div className="grid gap-2 sm:grid-cols-3">
              {TOPIC_MODES.map((m) => <Choice key={m.v} active={topicMode === m.v} onClick={() => setTopicMode(m.v)} title={m.label} hint={m.hint} />)}
            </div>
            {topicMode !== 'BEBAS' && (
              <div className="mt-4">
                <label htmlFor="topic" className="mb-1.5 block text-sm font-medium">{topicMode === 'UMUM' ? 'Tema' : 'Daftar topik (satu per baris)'}</label>
                {topicMode === 'UMUM' ? (
                  <Input id="topic" value={topic} maxLength={500} onChange={(e) => setTopic(e.target.value)} placeholder="Contoh: kesehatan gigi anak" />
                ) : (
                  <Textarea id="topic" value={topic} rows={5} onChange={(e) => setTopic(e.target.value)} placeholder={'Kenapa gigi berlubang\nCara memilih sikat gigi'} />
                )}
              </div>
            )}
          </Section>

          <Section n={3} title="Suara narator" note={!ttsAvailable ? 'TTS aktif setelah ada suara yang dipublikasikan dan akun suara Anda diatur.' : undefined}>
            <div className="grid gap-2 sm:grid-cols-3">
              <Choice active={voiceMode === 'TTS'} disabled={!ttsAvailable} onClick={() => setVoiceMode('TTS')} title="Suara AI (TTS)" hint={ttsAvailable ? `${usableVoices.length} suara tersedia` : 'Belum tersedia'} />
              <Choice active={voiceMode === 'NONE'} onClick={() => setVoiceMode('NONE')} title="Tanpa narasi" hint="Teks dan musik saja" />
              <Choice active={voiceMode === 'UPLOAD'} onClick={() => setVoiceMode('UPLOAD')} title="Rekaman sendiri" hint="Unggah file audio" />
            </div>
            {voiceMode === 'TTS' && (
              <div className="mt-4">
                <label htmlFor="voice" className="mb-1.5 block text-sm font-medium">Narator</label>
                <Select id="voice" value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className="w-full">
                  <option value="">Pilih suara…</option>
                  {usableVoices.map((v) => <option key={v.id} value={v.id}>{v.name} · {v.provider} · {v.language}</option>)}
                </Select>
                <p className="mt-1.5 text-xs text-muted">Emosi, kecepatan dan arahan mengikuti pengaturan di <Link className="underline" href="/voices">Studio Suara</Link>.</p>
              </div>
            )}
            {voiceMode === 'UPLOAD' && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="inline-flex h-10 cursor-pointer items-center rounded-[10px] border border-line px-4 text-sm hover:bg-surface-2">
                  {busyUpload ? 'Mengunggah…' : upload ? 'Ganti rekaman' : 'Pilih file audio'}
                  <input type="file" accept="audio/*" className="sr-only" onChange={(e) => pick(e.target.files, 'audio')} />
                </label>
                {upload && <span className="text-sm text-muted">{upload.filename} · {fmtBytes(upload.sizeBytes)}</span>}
              </div>
            )}
          </Section>

          <Section n={4} title="Gaya visual & referensi">
            {presets.data?.items.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Choice active={!presetId} onClick={() => setPresetId('')} title="Gaya bawaan" hint="Palet DENTSWEB" />
                {presets.data.items.map((p) => (
                  <button key={p.id} type="button" aria-pressed={presetId === p.id} onClick={() => setPresetId(p.id)} className={clsx('overflow-hidden rounded-xl border text-left transition-colors', presetId === p.id ? 'border-accent' : 'border-line hover:border-text/30')}>
                    <div className="aspect-video bg-surface-2">{p.thumbnailUrl && <img src={p.thumbnailUrl} alt="" className="size-full object-cover" />}</div>
                    <div className="px-3 py-2"><span className="block truncate text-sm font-medium">{p.name}</span><span className="block truncate text-xs text-muted">{p.category.name}</span></div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">Belum ada preset gaya yang dipublikasikan. Video memakai gaya bawaan.</p>
            )}
            <div className="mt-5">
              <p className="mb-2 text-sm font-medium">Video referensi <span className="font-normal text-muted">(opsional, maks 2, hanya untuk gaya)</span></p>
              <div className="flex flex-wrap items-center gap-2">
                {refs.map((m) => (
                  <span key={m.id} className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs">
                    {m.filename}
                    <button type="button" aria-label={`Hapus ${m.filename}`} onClick={() => setRefs((x) => x.filter((y) => y.id !== m.id))} className="text-muted hover:text-text">✕</button>
                  </span>
                ))}
                {refs.length < 2 && (
                  <label className="inline-flex h-9 cursor-pointer items-center rounded-[10px] border border-line px-3 text-sm hover:bg-surface-2">
                    {busyUpload ? 'Mengunggah…' : 'Tambah video'}
                    <input type="file" accept="video/*" className="sr-only" onChange={(e) => pick(e.target.files, 'video')} />
                  </label>
                )}
              </div>
            </div>
          </Section>

          <Section n={5} title="Hook pembuka">
            <div className="grid gap-2 sm:grid-cols-3">
              <Choice active={hookMode === 'AUTO'} onClick={() => setHookMode('AUTO')} title="Otomatis" hint={hooks.data?.length ? 'AI memilih dari katalog' : 'Kalimat hook di scene pertama'} />
              <Choice active={hookMode === 'PRESET'} disabled={!hooks.data?.length} onClick={() => setHookMode('PRESET')} title="Pilih hook" hint={hooks.data?.length ? `${hooks.data.length} tersedia` : 'Belum ada hook'} />
              <Choice active={hookMode === 'NONE'} onClick={() => setHookMode('NONE')} title="Tanpa hook" />
            </div>
            {hookMode === 'PRESET' && (
              <Select aria-label="Hook" value={hookId} onChange={(e) => setHookId(e.target.value)} className="mt-4 w-full">
                <option value="">Pilih hook…</option>
                {hooks.data?.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </Select>
            )}
          </Section>

          <Section n={6} title="Catatan untuk tim">
            <Textarea aria-label="Catatan" value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} placeholder="Gaya bahasa, hal yang wajib atau tidak boleh disebut, target penonton…" />
            <p className="num mt-1 text-right font-mono text-xs text-muted">{notes.length}/2000</p>
          </Section>
        </form>

        <aside className="lg:sticky lg:top-6 lg:self-start" aria-label="Ringkasan pesanan">
          <Card className="p-5">
            <p className="font-mono text-xs uppercase tracking-wide text-muted">Ringkasan pesanan</p>
            <dl className="mt-4 grid gap-2.5 text-sm">
              {summary.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-muted">{k}</dt>
                  <dd className="truncate text-right font-medium" title={v}>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="my-4 h-px bg-line" />
            <p className="text-xs text-muted">Tahap: riset → naskah → cek fakta → motion & render → QC → paket sosial.</p>
            {blockers.length > 0 && (
              <ul className="mt-4 grid gap-1.5 text-xs text-bad" aria-live="polite">
                {blockers.map((b) => <li key={b}>• {b}</li>)}
              </ul>
            )}
            <Button className="mt-5 w-full" loading={submit.isPending} disabled={blockers.length > 0} onClick={() => submit.mutate()}>
              Mulai produksi {effQty > 1 ? `${effQty} video` : ''}
            </Button>
          </Card>
        </aside>
      </div>
    </>
  );
}
