'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError, fmtBytes, fmtDate } from '@/lib/api';
import { Button, Card, ErrorNote, Input, PageHead, Skeleton, Status } from '@/components/ui';
import { Modal, Select, Textarea } from '@/components/ui/extra';

interface Detail {
  id: string; title: string; status: string; revision: number; parentResultId: string | null; createdAt: string; deletedAt: string | null;
  file: { format: string; sizeBytes: number }; videoUrl: string; coverUrl: string | null;
  social: { caption: string; hashtags: string[]; firstComment: string; coverText: string | null } | null;
  run: { id: string; topic: string | null; projectId: string | null } | null;
  sources: { id: string; url: string; title: string }[];
  factCheck: { claims: { claim: string; status: string; note?: string; sources?: string[] }[]; verdict: { verified: number; unverified: number; contradicted: number } } | null;
  qc: { passed: boolean; checks: { name: string; passed: boolean; note: string }[] } | null;
  revisions: { id: string; revision: number; createdAt: string }[];
}
interface Voice { id: string; name: string; provider: string }
interface Preset { id: string; name: string }
interface Hook { id: string; name: string }

function Copy({ text, label }: { text: string; label: string }) {
  return (
    <button
      type="button"
      className="h-8 rounded-lg border border-line px-3 text-xs hover:bg-surface-2"
      onClick={() => navigator.clipboard.writeText(text).then(() => toast.success(`${label} disalin`), () => toast.error('Tidak bisa menyalin'))}
    >
      Salin {label.toLowerCase()}
    </button>
  );
}

export default function ResultDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['result', id], queryFn: () => api<Detail>(`/results/${id}`) });
  const voices = useQuery({ queryKey: ['voices-all'], queryFn: () => api<Voice[]>('/voices') });
  const presets = useQuery({ queryKey: ['presets-all'], queryFn: () => api<{ items: Preset[] }>('/styles/presets?limit=100') });
  const hooks = useQuery({ queryKey: ['hooks-all'], queryFn: () => api<Hook[]>('/hooks') });
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [comment, setComment] = useState('');
  const [title, setTitle] = useState('');
  const [modal, setModal] = useState<null | 'revoice' | 'rerender'>(null);
  const [voiceMode, setVoiceMode] = useState<'TTS' | 'UPLOAD' | 'NONE'>('TTS');
  const [voiceId, setVoiceId] = useState('');
  const [audioUpload, setAudioUpload] = useState<{ id: string; filename: string; sizeBytes: number } | null>(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [format, setFormat] = useState('');
  const [presetId, setPresetId] = useState('');
  const [hookMode, setHookMode] = useState<'' | 'AUTO' | 'PRESET' | 'NONE'>('');
  const [hookId, setHookId] = useState('');

  useEffect(() => {
    if (!q.data) return;
    setTitle(q.data.title);
    setCaption(q.data.social?.caption ?? '');
    setTags(q.data.social?.hashtags.join(' ') ?? '');
    setComment(q.data.social?.firstComment ?? '');
  }, [q.data]);

  const inval = () => qc.invalidateQueries({ queryKey: ['result', id] });
  const saveSocial = useMutation({
    mutationFn: () => api(`/results/${id}/social`, { method: 'PATCH', json: { caption, firstComment: comment, hashtags: tags.split(/\s+/).filter(Boolean).map((t) => (t.startsWith('#') ? t : `#${t}`)) } }),
    onSuccess: () => (toast.success('Paket sosial disimpan'), inval()),
    onError: (e) => toast.error((e as Error).message),
  });
  const patch = useMutation({
    mutationFn: (b: { title?: string; status?: string }) => api(`/results/${id}`, { method: 'PATCH', json: b }),
    onSuccess: () => (toast.success('Tersimpan'), inval(), qc.invalidateQueries({ queryKey: ['results'] })),
    onError: (e) => toast.error((e as Error).message),
  });
  const trash = useMutation({
    mutationFn: () => api(`/results/${id}`, { method: 'DELETE' }),
    onSuccess: () => (toast.success('Dipindahkan ke sampah'), router.push('/results')),
    onError: (e) => toast.error((e as Error).message),
  });
  const uploadAudio = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('audio/')) return toast.error('Pilih file audio yang valid');
    setUploadingAudio(true);
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);
      const res = await fetch('/api/v1/media', { method: 'POST', body: fd, credentials: 'include' });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, body?.error?.code ?? 'ERROR', body?.error?.message ?? 'Upload audio gagal');
      setAudioUpload(body as { id: string; filename: string; sizeBytes: number });
      toast.success('Audio rekaman berhasil diunggah');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingAudio(false);
    }
  };

  const revise = useMutation({
    mutationFn: () => {
      if (modal === 'revoice') {
        const voice =
          voiceMode === 'UPLOAD'
            ? { mode: 'UPLOAD', uploadAssetId: audioUpload?.id }
            : voiceMode === 'TTS' && voiceId
              ? { mode: 'TTS', voiceId }
              : { mode: 'NONE' };
        if (voiceMode === 'UPLOAD' && !audioUpload) throw new Error('Unggah file audio terlebih dahulu');
        if (voiceMode === 'TTS' && !voiceId) throw new Error('Pilih suara narator terlebih dahulu');
        return api<{ runs: { id: string }[] }>(`/results/${id}/revoice`, { method: 'POST', json: { voice } });
      }
      const payload: Record<string, unknown> = {};
      if (format) payload.format = format;
      if (presetId) payload.presetId = presetId;
      if (hookMode) payload.hook = { mode: hookMode, hookId: hookMode === 'PRESET' ? hookId || null : null };
      if (hookMode === 'PRESET' && !hookId) throw new Error('Pilih hook preset terlebih dahulu');
      return api<{ runs: { id: string }[] }>(`/results/${id}/rerender`, { method: 'POST', json: payload });
    },
    onSuccess: (o) => (toast.success('Revisi masuk antrean'), router.push(`/progress?run=${o.runs[0]!.id}`)),
    onError: (e) => toast.error((e as Error).message),
  });

  if (q.isLoading) return <Skeleton className="h-[70vh] rounded-card" />;
  if (q.isError) return <ErrorNote error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data!;
  const allText = `${caption}\n\n${tags}`;

  return (
    <>
      <PageHead
        eyebrow={<Link href="/results" className="hover:underline">← Hasil</Link>}
        title={d.title}
        actions={
          <div className="flex flex-wrap gap-2">
            <a href={`/api/v1/results/${id}/download`} className="inline-flex h-10 items-center rounded-[10px] bg-accent px-4 text-sm font-medium text-accent-contrast">Unduh MP4 · {fmtBytes(d.file.sizeBytes)}</a>
            {d.coverUrl && <a href={`/api/v1/results/${id}/cover`} className="inline-flex h-10 items-center rounded-[10px] border border-line px-4 text-sm">Unduh cover</a>}
          </div>
        }
      />
      <div className="grid grid-cols-1 items-start gap-6 overflow-x-hidden lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <div className="grid min-w-0 w-full content-start gap-4">
          <Card className="min-w-0 w-full overflow-hidden">
            <video
              key={d.videoUrl || id}
              src={d.videoUrl || `/api/v1/results/${id}/download`}
              poster={d.coverUrl ?? undefined}
              controls
              playsInline
              preload="metadata"
              className="min-h-[320px] max-h-[580px] w-full bg-black object-contain"
            />
          </Card>
          <Card className="grid min-w-0 w-full gap-3 p-5">
            <div className="flex items-center justify-between">
              <Status value={d.status} label={d.status === 'READY' ? 'Siap upload' : 'Diunggah'} />
              <span className="font-mono text-xs text-muted">Revisi {d.revision} · {fmtDate(d.createdAt)}</span>
            </div>
            <label htmlFor="title" className="text-sm font-medium">Judul</label>
            <div className="flex gap-2">
              <Input id="title" value={title} maxLength={255} onChange={(e) => setTitle(e.target.value)} />
              <Button variant="ghost" disabled={title === d.title || !title.trim()} onClick={() => patch.mutate({ title })}>Simpan</Button>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {d.status === 'READY' ? <Button onClick={() => patch.mutate({ status: 'UPLOADED' })}>Tandai sudah diunggah</Button> : <Button variant="ghost" onClick={() => patch.mutate({ status: 'READY' })}>Kembalikan ke siap upload</Button>}
              <Button variant="ghost" onClick={() => setModal('revoice')}>Ganti suara</Button>
              <Button variant="ghost" onClick={() => setModal('rerender')}>Render ulang</Button>
              {d.run?.projectId && <Link href={`/studio/editor/${d.run.projectId}`} className="inline-flex h-11 items-center rounded-[10px] border border-line px-4 text-sm">Buka di editor</Link>}
              <Button variant="ghost" onClick={() => confirm('Pindahkan video ini ke sampah?') && trash.mutate()}>Hapus</Button>
            </div>
            {d.parentResultId && <p className="text-xs text-muted">Revisi dari <Link className="underline" href={`/results/${d.parentResultId}`}>video sebelumnya</Link>.</p>}
            {d.revisions.length > 0 && <p className="text-xs text-muted">Revisi turunan: {d.revisions.map((r) => <Link key={r.id} className="mr-2 underline" href={`/results/${r.id}`}>#{r.revision}</Link>)}</p>}
          </Card>
        </div>

        <div className="grid min-w-0 w-full content-start gap-4">
          <Card className="grid min-w-0 w-full gap-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-medium">Paket sosial media</h2>
              <Copy text={allText} label="Caption + hashtag" />
            </div>
            <label htmlFor="caption" className="text-sm font-medium">Caption</label>
            <Textarea id="caption" rows={7} maxLength={2200} value={caption} onChange={(e) => setCaption(e.target.value)} />
            <p className="num -mt-2 text-right font-mono text-xs text-muted">{caption.length}/2200</p>
            <label htmlFor="tags" className="text-sm font-medium">Hashtag</label>
            <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} />
            <label htmlFor="fc" className="text-sm font-medium">Komentar pertama</label>
            <Textarea id="fc" rows={3} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
            {d.social?.coverText && <p className="text-sm text-muted">Teks cover: <span className="text-text">{d.social.coverText}</span></p>}
            <div className="flex gap-2">
              <Button loading={saveSocial.isPending} onClick={() => saveSocial.mutate()}>Simpan</Button>
              <Copy text={comment} label="Komentar" />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-lg font-medium">Sumber & cek fakta</h2>
            {d.factCheck && (
              <p className="mt-2 text-sm text-muted">
                {d.factCheck.verdict.verified} klaim terverifikasi · {d.factCheck.verdict.unverified} belum terverifikasi · {d.factCheck.verdict.contradicted} bertentangan
              </p>
            )}
            <ul className="mt-3 grid gap-2">
              {d.factCheck?.claims.map((c, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <Status value={c.status} label={c.status === 'VERIFIED' ? 'Terverifikasi' : c.status === 'UNVERIFIED' ? 'Belum terverifikasi' : 'Bertentangan'} />
                  <span>{c.claim}{c.note ? <span className="text-muted"> — {c.note}</span> : null}</span>
                </li>
              ))}
            </ul>
            <h3 className="mt-5 text-sm font-medium">Sumber riset</h3>
            {d.sources.length === 0 ? <p className="mt-1 text-sm text-muted">Tidak ada sumber web yang tercatat.</p> : (
              <ul className="mt-2 grid gap-1.5 text-sm">
                {d.sources.map((s) => <li key={s.id} className="truncate"><a href={s.url} target="_blank" rel="noopener noreferrer" className="underline decoration-line underline-offset-2 hover:decoration-text">{s.title}</a></li>)}
              </ul>
            )}
          </Card>

          {d.qc && (
            <Card className="p-5">
              <h2 className="font-display text-lg font-medium">Quality control</h2>
              <ul className="mt-3 grid gap-2 text-sm">
                {d.qc.checks.map((c, i) => (
                  <li key={i} className="flex items-start justify-between gap-3">
                    <span>{c.name}<span className="text-muted"> · {c.note}</span></span>
                    <Status value={c.passed ? 'ok' : 'bad'} label={c.passed ? 'Lulus' : 'Perlu cek'} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <Modal open={modal !== null} onClose={() => setModal(null)} title={modal === 'revoice' ? 'Ganti suara narator' : 'Render ulang'}>
        <p className="text-sm text-muted">Riset, naskah dan cek fakta dipakai ulang. Hanya motion, render, QC dan paket sosial yang dibuat ulang sebagai revisi baru.</p>
        {modal === 'revoice' ? (
          <div className="mt-4 grid gap-3">
            <Select aria-label="Mode suara" value={voiceMode} onChange={(e) => setVoiceMode(e.target.value as 'TTS' | 'UPLOAD' | 'NONE')} className="w-full">
              <option value="TTS">Suara AI (TTS)</option>
              <option value="UPLOAD">Unggah rekaman suara sendiri</option>
              <option value="NONE">Tanpa narasi</option>
            </Select>
            {voiceMode === 'TTS' && (
              <Select aria-label="Suara baru" value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className="w-full">
                <option value="">Pilih suara…</option>
                {voices.data?.map((v) => <option key={v.id} value={v.id}>{v.name} · {v.provider}</option>)}
              </Select>
            )}
            {voiceMode === 'UPLOAD' && (
              <div className="grid gap-2">
                <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-[10px] border border-dashed border-line px-4 text-sm hover:bg-surface-2">
                  {uploadingAudio ? 'Mengunggah audio…' : audioUpload ? 'Ganti file audio' : 'Pilih file audio (MP3/WAV/M4A)'}
                  <input type="file" accept="audio/*" className="sr-only" onChange={(e) => void uploadAudio(e.target.files?.[0])} />
                </label>
                {audioUpload && <p className="text-xs text-muted">{audioUpload.filename} · {fmtBytes(audioUpload.sizeBytes)}</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            <Select aria-label="Format" value={format} onChange={(e) => setFormat(e.target.value)} className="w-full">
              <option value="">Format sama</option>
              <option value="9:16">9:16</option>
              <option value="16:9">16:9</option>
              <option value="1:1">1:1</option>
            </Select>
            <Select aria-label="Gaya visual" value={presetId} onChange={(e) => setPresetId(e.target.value)} className="w-full">
              <option value="">Gaya visual sama</option>
              {presets.data?.items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Select aria-label="Hook pembuka" value={hookMode} onChange={(e) => setHookMode(e.target.value as '' | 'AUTO' | 'PRESET' | 'NONE')} className="w-full">
              <option value="">Hook sama</option>
              <option value="AUTO">Hook otomatis</option>
              <option value="PRESET">Pilih hook dari katalog</option>
              <option value="NONE">Tanpa hook</option>
            </Select>
            {hookMode === 'PRESET' && (
              <Select aria-label="Pilih hook" value={hookId} onChange={(e) => setHookId(e.target.value)} className="w-full">
                <option value="">Pilih hook…</option>
                {hooks.data?.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </Select>
            )}
          </div>
        )}
        <Button className="mt-5 w-full" loading={revise.isPending || uploadingAudio} onClick={() => revise.mutate()}>Buat revisi</Button>
      </Modal>
    </>
  );
}
