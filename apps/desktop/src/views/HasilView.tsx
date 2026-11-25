import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { get, invoke, mutate, pickAndUploadMedia, toMediaUrl } from '../bridge';
import { Button, Card, Input, Modal, Pill, Select, Textarea, errMsg } from '../components/UI';
import { Icon } from '../components/Icons';
import type { HookItem, NavTab, ResultDetail, ResultItem, StylePreset, VoiceItem } from '../types';

interface HasilViewProps {
  onNavigate: (tab: NavTab) => void;
  initialSubTab?: 'READY' | 'UPLOADED' | 'FAILED' | 'ALL' | 'TRASH';
}

function fmtBytes(bytes: number) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function HasilDetailView({
  id,
  onBack,
  onSelectId,
  onNavigate,
}: {
  id: string;
  onBack: () => void;
  onSelectId: (nextId: string) => void;
  onNavigate: (tab: NavTab) => void;
}) {
  const qc = useQueryClient();
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [comment, setComment] = useState('');
  const [title, setTitle] = useState('');
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
  const [revoiceOpen, setRevoiceOpen] = useState(false);
  const [rerenderOpen, setRerenderOpen] = useState(false);

  // Revoice state
  const [rvMode, setRvMode] = useState<'TTS' | 'NONE' | 'UPLOAD'>('TTS');
  const [rvVoiceId, setRvVoiceId] = useState('');
  const [rvUploadAsset, setRvUploadAsset] = useState<{ id: string; filename: string } | null>(null);

  // Rerender state
  const [rrFormat, setRrFormat] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [rrPresetId, setRrPresetId] = useState('');
  const [rrHookMode, setRrHookMode] = useState<'AUTO' | 'PRESET' | 'NONE'>('AUTO');
  const [rrHookId, setRrHookId] = useState('');

  const q = useQuery({
    queryKey: ['result-detail', id],
    queryFn: () => get<ResultDetail>(`/results/${id}`),
  });

  const voicesQ = useQuery({
    queryKey: ['voices-all'],
    queryFn: () => get<VoiceItem[]>('/voices').catch(() => []),
    enabled: revoiceOpen,
  });
  const presetsQ = useQuery({
    queryKey: ['presets-all'],
    queryFn: () => get<{ items: StylePreset[] }>('/styles/presets?limit=100').catch(() => ({ items: [] })),
    enabled: rerenderOpen,
  });
  const hooksQ = useQuery({
    queryKey: ['hooks-all'],
    queryFn: () => get<HookItem[]>('/hooks').catch(() => []),
    enabled: rerenderOpen,
  });

  useEffect(() => {
    if (!q.data) return;
    setTitle(q.data.title);
    setCaption(q.data.social?.caption ?? '');
    setTags(q.data.social?.hashtags?.join(' ') ?? '');
    setComment(q.data.social?.firstComment ?? '');
  }, [q.data]);

  const copyText = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedLabel(label);
    setTimeout(() => setCopiedLabel(null), 2500);
  };

  const inval = () => {
    qc.invalidateQueries({ queryKey: ['result-detail', id] });
    qc.invalidateQueries({ queryKey: ['results'] });
    qc.invalidateQueries({ queryKey: ['dash'] });
  };

  const saveSocial = useMutation({
    mutationFn: () =>
      mutate('PATCH', `/results/${id}/social`, {
        caption,
        firstComment: comment,
        hashtags: tags
          .split(/\s+/)
          .filter(Boolean)
          .map((t) => (t.startsWith('#') ? t : `#${t}`)),
      }),
    onSuccess: () => {
      inval();
      setCopiedLabel('saved-social');
      setTimeout(() => setCopiedLabel(null), 2000);
    },
  });

  const patchResult = useMutation({
    mutationFn: (body: { title?: string; status?: string }) => mutate('PATCH', `/results/${id}`, body),
    onSuccess: () => {
      inval();
      setCopiedLabel('saved-title');
      setTimeout(() => setCopiedLabel(null), 2000);
    },
  });

  const trashResult = useMutation({
    mutationFn: () => mutate('DELETE', `/results/${id}`),
    onSuccess: () => {
      inval();
      onBack();
    },
  });

  const revoiceMut = useMutation({
    mutationFn: () =>
      mutate('POST', `/results/${id}/revoice`, {
        voice: {
          mode: rvMode,
          voiceId: rvMode === 'TTS' ? rvVoiceId || null : null,
          uploadAssetId: rvMode === 'UPLOAD' ? rvUploadAsset?.id || null : null,
        },
      }),
    onSuccess: () => {
      setRevoiceOpen(false);
      qc.invalidateQueries({ queryKey: ['runs'] });
      onNavigate('progress');
    },
  });

  const rerenderMut = useMutation({
    mutationFn: () =>
      mutate('POST', `/results/${id}/rerender`, {
        format: rrFormat,
        presetId: rrPresetId || null,
        hook: { mode: rrHookMode, hookId: rrHookMode === 'PRESET' ? rrHookId || null : null },
      }),
    onSuccess: () => {
      setRerenderOpen(false);
      qc.invalidateQueries({ queryKey: ['runs'] });
      onNavigate('progress');
    },
  });

  const downloadFile = (url: string) => {
    void invoke('shell:open-external', { url: toMediaUrl(url) });
  };

  if (q.isLoading) {
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Kembali ke Hasil
        </Button>
        <div className="h-[60vh] rounded-2xl bg-surface-2 animate-pulse border border-line" />
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Kembali ke Hasil
        </Button>
        <Card className="p-8 text-center space-y-3">
          <p className="font-display text-lg font-medium text-text">Gagal memuat video</p>
          <p className="text-xs text-muted">Detail video tidak ditemukan atau telah dihapus.</p>
          <Button size="sm" onClick={() => q.refetch()}>
            Coba lagi
          </Button>
        </Card>
      </div>
    );
  }

  const d = q.data;
  const allText = `${caption}\n\n${tags}`;

  return (
    <div className="w-full overflow-x-hidden space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-mono text-muted uppercase hover:text-text cursor-pointer flex items-center gap-1.5 transition-colors mb-1"
          >
            ← HASIL
          </button>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text break-words">
            {d.title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setRevoiceOpen(true)}>
            <Icon name="mic" className="w-3.5 h-3.5" /> Ganti Suara
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRerenderOpen(true)}>
            <Icon name="film" className="w-3.5 h-3.5" /> Render Ulang
          </Button>
          {d.videoUrl && (
            <Button
              size="md"
              className="bg-accent text-accent-contrast font-semibold shadow-xs"
              onClick={() => downloadFile(d.videoUrl)}
            >
              <Icon name="download" className="w-4 h-4" /> Unduh MP4 · {fmtBytes(d.file?.sizeBytes ?? 0)}
            </Button>
          )}
          {d.coverUrl && (
            <Button variant="outline" size="md" onClick={() => downloadFile(d.coverUrl!)}>
              Unduh Cover
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] gap-6 items-start w-full">
        {/* Left Column */}
        <div className="min-w-0 w-full space-y-4">
          <Card className="min-w-0 w-full overflow-hidden p-0 border border-line bg-black shadow-md rounded-2xl">
            {d.videoUrl ? (
              <div className="relative w-full min-h-[320px] aspect-[9/16] max-h-[540px] mx-auto bg-black flex items-center justify-center">
                <video
                  key={d.videoUrl}
                  src={toMediaUrl(d.videoUrl)}
                  poster={d.coverUrl ? toMediaUrl(d.coverUrl) : undefined}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full h-full max-h-[540px] rounded-xl bg-black object-contain"
                />
              </div>
            ) : (
              <div className="min-h-[320px] grid place-items-center text-xs text-muted p-6">
                Video belum tersedia.
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Pill
                ok={d.status === 'READY' || d.status === 'UPLOADED'}
                variant={d.status === 'UPLOADED' ? 'blue' : 'accent'}
              >
                {d.status === 'READY' ? 'Siap upload' : d.status === 'UPLOADED' ? 'Diunggah' : d.status}
              </Pill>
              <span className="font-mono text-xs text-muted">
                Revisi {d.revision} · {fmtDate(d.createdAt)}
              </span>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="title-edit" className="text-xs font-semibold text-text">
                Judul Video
              </label>
              <div className="flex gap-2">
                <Input
                  id="title-edit"
                  value={title}
                  maxLength={255}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-xs"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={title === d.title || !title.trim() || patchResult.isPending}
                  onClick={() => patchResult.mutate({ title })}
                >
                  {copiedLabel === 'saved-title' ? '✓ Tersimpan' : 'Simpan'}
                </Button>
              </div>
            </div>

            {patchResult.isError && <p className="text-xs text-bad">{errMsg(patchResult.error)}</p>}

            <div className="flex flex-wrap gap-2 pt-2 border-t border-line">
              {d.status === 'READY' ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs flex-1"
                  disabled={patchResult.isPending}
                  onClick={() => patchResult.mutate({ status: 'UPLOADED' })}
                >
                  ✓ Tandai sudah diunggah
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs flex-1"
                  disabled={patchResult.isPending}
                  onClick={() => patchResult.mutate({ status: 'READY' })}
                >
                  ↺ Kembalikan ke siap upload
                </Button>
              )}
              <Button
                variant="danger"
                size="sm"
                className="text-xs"
                disabled={trashResult.isPending}
                onClick={() => {
                  if (confirm('Yakin ingin memindahkan video ini ke sampah?')) {
                    trashResult.mutate();
                  }
                }}
              >
                Hapus
              </Button>
            </div>
          </Card>

          {/* Riwayat Revisi */}
          {d.revisions && d.revisions.length > 0 && (
            <Card className="p-5 space-y-3">
              <h3 className="font-display text-sm font-semibold text-text">Riwayat Revisi ({d.revisions.length})</h3>
              <div className="space-y-1.5">
                {d.revisions.map((rev) => (
                  <button
                    key={rev.id}
                    type="button"
                    onClick={() => onSelectId(rev.id)}
                    className={clsx(
                      'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs transition cursor-pointer',
                      rev.id === d.id
                        ? 'border-accent bg-accent/10 font-semibold text-text'
                        : 'border-line bg-surface-2/40 text-muted hover:text-text'
                    )}
                  >
                    <span className="font-mono">Revisi #{rev.revision}</span>
                    <span className="text-[11px]">{fmtDate(rev.createdAt)}</span>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right Column */}
        <div className="min-w-0 w-full space-y-4">
          <Card className="min-w-0 w-full p-5 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
              <div className="min-w-0">
                <h2 className="font-display text-base font-semibold text-text">Paket sosial media</h2>
                <p className="text-xs text-muted">Siap langsung disalin dan ditempel ke TikTok/Reels/Shorts.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-medium shrink-0"
                onClick={() => copyText(allText, 'all')}
              >
                <Icon name="copy" className="w-3.5 h-3.5" />{' '}
                {copiedLabel === 'all' ? 'Caption + Hashtag Disalin!' : 'Salin caption + hashtag'}
              </Button>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="caption-input" className="text-xs font-semibold text-text">Caption</label>
                <button type="button" onClick={() => copyText(caption, 'caption')} className="text-[11px] text-accent hover:underline cursor-pointer">
                  {copiedLabel === 'caption' ? '✓ Disalin' : 'Salin teks'}
                </button>
              </div>
              <Textarea id="caption-input" rows={6} maxLength={2200} value={caption} onChange={(e) => setCaption(e.target.value)} className="text-xs font-sans leading-relaxed" />
              <p className="text-right font-mono text-[11px] text-muted">{caption.length}/2200 karakter</p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="tags-input" className="text-xs font-semibold text-text">Hashtag</label>
                <button type="button" onClick={() => copyText(tags, 'tags')} className="text-[11px] text-accent hover:underline cursor-pointer">
                  {copiedLabel === 'tags' ? '✓ Disalin' : 'Salin tags'}
                </button>
              </div>
              <Input id="tags-input" value={tags} onChange={(e) => setTags(e.target.value)} className="text-xs font-mono" />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="comment-input" className="text-xs font-semibold text-text">Komentar pertama (Referensi & Sumber)</label>
                <button type="button" onClick={() => copyText(comment, 'comment')} className="text-[11px] text-accent hover:underline cursor-pointer">
                  {copiedLabel === 'comment' ? '✓ Disalin' : 'Salin komentar'}
                </button>
              </div>
              <Textarea id="comment-input" rows={3} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} className="text-xs leading-relaxed" />
            </div>

            {d.social?.coverText && (
              <div className="rounded-xl border border-line bg-surface-2/60 p-3 text-xs">
                <span className="text-muted">Teks cover: </span>
                <span className="font-semibold text-text">{d.social.coverText}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between">
              <Button size="md" disabled={saveSocial.isPending} onClick={() => saveSocial.mutate()}>
                {copiedLabel === 'saved-social' ? '✓ Paket Sosial Tersimpan!' : 'Simpan Perubahan Sosial'}
              </Button>
              {saveSocial.isError && <span className="text-xs text-bad">{errMsg(saveSocial.error)}</span>}
            </div>
          </Card>

          {/* Sumber & Cek Fakta */}
          {d.factCheck && (
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-text">Sumber & Cek Fakta</h3>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  {d.factCheck.verdict.verified} Terverifikasi
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                {d.factCheck.verdict.verified} terverifikasi · {d.factCheck.verdict.unverified} belum diverifikasi · {d.factCheck.verdict.contradicted} bertentangan.
              </p>
              <div className="space-y-2 pt-1 max-h-56 overflow-y-auto pr-1">
                {d.factCheck.claims.map((c, i) => {
                  const st = (c.status || '').toUpperCase();
                  const isVerified = st === 'VERIFIED';
                  const isContra = st === 'CONTRADICTED';
                  return (
                    <div key={i} className="text-xs rounded-lg border border-line/60 bg-surface-2/40 p-2.5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={clsx(
                            'font-semibold text-[11px]',
                            isVerified ? 'text-emerald-600 dark:text-emerald-400' : isContra ? 'text-bad' : 'text-amber-500'
                          )}
                        >
                          {isVerified ? '✓' : isContra ? '✕' : '!'} Klaim #{i + 1}
                        </span>
                        <Pill ok={isVerified ? true : isContra ? false : null}>{st || 'UNVERIFIED'}</Pill>
                      </div>
                      <p className="text-text">{c.claim}</p>
                      {c.note && <p className="text-[11px] text-muted italic">{c.note}</p>}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Daftar Sumber Referensi */}
          {d.sources && d.sources.length > 0 && (
            <Card className="p-5 space-y-2.5">
              <h3 className="font-display text-sm font-semibold text-text">Referensi Riset ({d.sources.length})</h3>
              <ul className="space-y-1.5 text-xs">
                {d.sources.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-line/50 bg-surface-2/30 px-3 py-2">
                    <span className="truncate text-text">{s.title || s.url}</span>
                    {s.url && (
                      <button
                        type="button"
                        onClick={() => void invoke('shell:open-external', { url: s.url }).catch(() => undefined)}
                        className="shrink-0 text-[11px] text-accent hover:underline cursor-pointer"
                      >
                        Buka ↗
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Quality Control (QC) */}
          {d.qc && (
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-text">Pemeriksaan Kualitas (QC)</h3>
                <Pill ok={d.qc.passed}>{d.qc.passed ? 'Lulus Semua Uji' : 'Perlu Perhatian'}</Pill>
              </div>
              <p className="text-xs text-muted">
                {d.qc.checks.filter((c) => c.passed).length} dari {d.qc.checks.length} uji lolos standar penyiaran.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Modal Ganti Suara (Revoice) */}
      <Modal open={revoiceOpen} onClose={() => setRevoiceOpen(false)} title="Ganti Suara Narator (Revoice)">
        <div className="space-y-4">
          <p className="text-xs text-muted">
            Buat revisi baru dari video ini dengan karakter suara atau rekaman audio berbeda tanpa mengulang riset & naskah.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text">Mode Suara</label>
            <Select value={rvMode} onChange={(e) => setRvMode(e.target.value as typeof rvMode)}>
              <option value="TTS">Suara AI (TTS)</option>
              <option value="UPLOAD">Unggah Rekaman Sendiri</option>
              <option value="NONE">Tanpa Narasi (Hening)</option>
            </Select>
          </div>

          {rvMode === 'TTS' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text">Pilih Karakter Suara</label>
              <Select value={rvVoiceId} onChange={(e) => setRvVoiceId(e.target.value)}>
                <option value="">-- Pilih Suara --</option>
                {(voicesQ.data ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.provider} · {v.language})
                  </option>
                ))}
              </Select>
            </div>
          )}

          {rvMode === 'UPLOAD' && (
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const up = await pickAndUploadMedia('audio');
                    if (!up.canceled) setRvUploadAsset({ id: up.id, filename: up.filename });
                  } catch (e) {
                    alert(errMsg(e));
                  }
                }}
              >
                <Icon name="upload" className="w-3.5 h-3.5" /> Pilih File Audio (.mp3 / .wav)
              </Button>
              {rvUploadAsset && <p className="text-xs text-ok">✓ Terunggah: {rvUploadAsset.filename}</p>}
            </div>
          )}

          {revoiceMut.isError && <p className="text-xs text-bad">{errMsg(revoiceMut.error)}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setRevoiceOpen(false)}>Batal</Button>
            <Button
              size="sm"
              disabled={revoiceMut.isPending || (rvMode === 'TTS' && !rvVoiceId) || (rvMode === 'UPLOAD' && !rvUploadAsset)}
              onClick={() => revoiceMut.mutate()}
            >
              {revoiceMut.isPending ? 'Memproses…' : 'Mulai Revoice'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Render Ulang (Rerender) */}
      <Modal open={rerenderOpen} onClose={() => setRerenderOpen(false)} title="Render Ulang Video (Rerender)">
        <div className="space-y-4">
          <p className="text-xs text-muted">
            Render revisi baru dengan format rasio, gaya visual, atau hook pembuka berbeda.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text">Format Rasio</label>
            <Select value={rrFormat} onChange={(e) => setRrFormat(e.target.value as typeof rrFormat)}>
              <option value="9:16">9:16 Reels / TikTok / Shorts</option>
              <option value="16:9">16:9 YouTube Horizontal</option>
              <option value="1:1">1:1 Square Feed</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text">Gaya Visual (Opsional)</label>
            <Select value={rrPresetId} onChange={(e) => setRrPresetId(e.target.value)}>
              <option value="">Pertahankan gaya saat ini</option>
              {(presetsQ.data?.items ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text">Hook Pembuka</label>
            <Select value={rrHookMode} onChange={(e) => setRrHookMode(e.target.value as typeof rrHookMode)}>
              <option value="AUTO">Otomatis AI</option>
              <option value="PRESET">Pilih Preset Hook</option>
              <option value="NONE">Tanpa Hook</option>
            </Select>
            {rrHookMode === 'PRESET' && (
              <Select value={rrHookId} onChange={(e) => setRrHookId(e.target.value)} className="mt-2">
                <option value="">-- Pilih Hook --</option>
                {(hooksQ.data ?? []).map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </Select>
            )}
          </div>

          {rerenderMut.isError && <p className="text-xs text-bad">{errMsg(rerenderMut.error)}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setRerenderOpen(false)}>Batal</Button>
            <Button size="sm" disabled={rerenderMut.isPending} onClick={() => rerenderMut.mutate()}>
              {rerenderMut.isPending ? 'Memproses…' : 'Mulai Render Ulang'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function HasilView({ onNavigate, initialSubTab = 'ALL' }: HasilViewProps) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'READY' | 'UPLOADED' | 'FAILED' | 'ALL' | 'TRASH'>(initialSubTab);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  useEffect(() => {
    setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  const results = useQuery({
    queryKey: ['results', activeSubTab],
    queryFn: () => get<ResultItem[]>(`/results?tab=${activeSubTab}`).catch(() => []),
  });

  const markUploaded = useMutation({
    mutationFn: (id: string) => mutate('PATCH', `/results/${id}`, { status: 'UPLOADED' }),
    onSuccess: () => {
      setActionErr(null);
      qc.invalidateQueries({ queryKey: ['results'] });
      qc.invalidateQueries({ queryKey: ['dash'] });
    },
    onError: (e) => setActionErr(errMsg(e)),
  });

  const retryRun = useMutation({
    mutationFn: (runId: string) => mutate('POST', `/production/runs/${runId}/retry`),
    onSuccess: () => {
      setActionErr(null);
      qc.invalidateQueries({ queryKey: ['results'] });
      qc.invalidateQueries({ queryKey: ['runs'] });
      onNavigate('progress');
    },
    onError: (e) => setActionErr(errMsg(e)),
  });

  const restoreResult = useMutation({
    mutationFn: (id: string) => mutate('POST', `/results/${id}/restore`),
    onSuccess: () => {
      setActionErr(null);
      qc.invalidateQueries({ queryKey: ['results'] });
      qc.invalidateQueries({ queryKey: ['dash'] });
    },
    onError: (e) => setActionErr(errMsg(e)),
  });

  const copyCaption = (id: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const SUB_TABS = [
    { id: 'READY', label: 'Siap upload' },
    { id: 'UPLOADED', label: 'Diunggah' },
    { id: 'FAILED', label: 'Gagal' },
    { id: 'ALL', label: 'Semua' },
    { id: 'TRASH', label: 'Sampah' },
  ];

  if (selectedId) {
    return (
      <HasilDetailView
        id={selectedId}
        onBack={() => setSelectedId(null)}
        onSelectId={(next) => setSelectedId(next)}
        onNavigate={onNavigate}
      />
    );
  }

  const displayItems = results.data ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-widest text-muted font-mono">PERPUSTAKAAN</p>
        <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
          Hasil Produksi Video
        </h1>
        <p className="mt-1 text-sm text-muted">
          Klik video untuk memutar, menyalin caption media sosial, revoice, rerender, atau menandai sudah diunggah.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-line bg-surface p-1 shadow-xs">
          {SUB_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setActionErr(null);
                setActiveSubTab(t.id as typeof activeSubTab);
              }}
              className={clsx(
                'rounded-full px-4 py-1.5 text-xs font-medium transition cursor-pointer',
                activeSubTab === t.id
                  ? 'bg-accent text-accent-contrast shadow-xs font-semibold'
                  : 'text-muted hover:text-text'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Button size="sm" onClick={() => onNavigate('buat-konten')}>
          ＋ Buat Konten Baru
        </Button>
      </div>

      {actionErr && (
        <div role="alert" className="rounded-xl border border-bad/40 bg-bad/10 px-4 py-2.5 text-xs text-bad">
          {actionErr}
        </div>
      )}

      {results.isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-[9/16] rounded-xl bg-surface-2 animate-pulse border border-line" />
          ))}
        </div>
      )}

      {!results.isLoading && displayItems.length === 0 && (
        <Card className="p-12 text-center space-y-3">
          <p className="font-display text-base font-medium text-text">
            {activeSubTab === 'TRASH'
              ? 'Sampah kosong'
              : activeSubTab === 'FAILED'
                ? 'Tidak ada produksi gagal'
                : 'Belum ada video di sini'}
          </p>
          <p className="text-xs text-muted max-w-sm mx-auto">
            {activeSubTab === 'READY'
              ? 'Video yang lolos QC muncul di sini lengkap dengan caption, hashtag, dan cover.'
              : 'Video berpindah tab sesuai statusnya.'}
          </p>
          {activeSubTab === 'READY' && (
            <div className="pt-2">
              <Button size="sm" onClick={() => onNavigate('buat-konten')}>
                ＋ Buat Konten Sekarang
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* FAILED Run Cards */}
      {!results.isLoading && displayItems.length > 0 && activeSubTab === 'FAILED' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayItems.map((item) => {
            const errText =
              typeof item.error === 'string'
                ? item.error
                : item.error?.message || item.captionPreview || 'Produksi gagal diproses.';
            const stage = typeof item.error === 'object' && item.error?.stage ? item.error.stage : item.currentStage;
            return (
              <Card key={item.id} className="p-5 space-y-3 border-bad/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Pill ok={false}>GAGAL {stage ? `· ${stage}` : ''}</Pill>
                    <h3 className="font-display text-sm font-semibold text-text mt-2 line-clamp-2">
                      {item.title || 'Produksi Video'}
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-muted shrink-0">{fmtDate(item.createdAt)}</span>
                </div>
                <p className="rounded-lg bg-bad/5 border border-bad/20 p-3 text-xs text-bad leading-relaxed">
                  {errText}
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    size="sm"
                    disabled={retryRun.isPending}
                    onClick={() => retryRun.mutate(item.id)}
                  >
                    ↻ Coba Lagi (Retry)
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Standard Result Cards (READY / UPLOADED / ALL / TRASH) */}
      {!results.isLoading && displayItems.length > 0 && activeSubTab !== 'FAILED' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayItems.map((item) => {
            const isFailedRun = item.kind === 'run';
            return (
              <Card
                key={item.id}
                onClick={() => {
                  if (!isFailedRun) setSelectedId(item.id);
                }}
                className={clsx(
                  'group relative flex flex-col overflow-hidden p-0 transition-all duration-200 shadow-xs',
                  !isFailedRun && 'hover:border-accent hover:shadow-md cursor-pointer'
                )}
              >
                <div className="relative aspect-[9/16] w-full bg-gradient-to-br from-neutral-800 to-neutral-900 overflow-hidden">
                  {item.coverUrl ? (
                    <img
                      src={toMediaUrl(item.coverUrl)}
                      alt={item.title}
                      className="size-full object-cover group-hover:scale-102 transition duration-300"
                    />
                  ) : (
                    <div className="flex size-full flex-col justify-between p-4 text-white">
                      <div className="flex items-center justify-between">
                        <span
                          className={clsx(
                            'rounded-full px-2.5 py-0.5 text-[10px] font-semibold',
                            item.status === 'UPLOADED'
                              ? 'bg-emerald-500/80 text-white'
                              : item.status === 'READY'
                                ? 'bg-blue-500/80 text-white'
                                : 'bg-red-500/80 text-white'
                          )}
                        >
                          • {item.status === 'UPLOADED' ? 'Diunggah' : item.status === 'READY' ? 'Siap upload' : item.status}
                        </span>
                        <span className="text-xs opacity-75 font-mono">9:16</span>
                      </div>
                      <h4 className="font-display text-sm font-bold leading-tight line-clamp-3">{item.title}</h4>
                      <div className="text-[10px] opacity-75 font-mono">{fmtDate(item.createdAt)}</div>
                    </div>
                  )}

                  {!isFailedRun && (
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                      <div className="size-12 rounded-full bg-accent/90 text-accent-contrast flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <span className="text-xl pl-0.5">▶</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between bg-surface">
                  <div>
                    <p className="text-xs font-semibold text-text line-clamp-2 group-hover:text-accent transition-colors">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-muted line-clamp-2 mt-1">{item.captionPreview}</p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-line">
                    {activeSubTab === 'TRASH' || item.deletedAt ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                        disabled={restoreResult.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          restoreResult.mutate(item.id);
                        }}
                      >
                        ↺ Pulihkan
                      </Button>
                    ) : isFailedRun ? (
                      <Button
                        size="sm"
                        className="w-full text-xs"
                        disabled={retryRun.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          retryRun.mutate(item.id);
                        }}
                      >
                        ↻ Coba Lagi
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyCaption(item.id, item.captionPreview ?? '');
                          }}
                        >
                          <Icon name="copy" className="w-3.5 h-3.5" />{' '}
                          {copiedId === item.id ? 'Caption Tersalin!' : 'Salin Caption'}
                        </Button>

                        {item.status === 'READY' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs"
                            disabled={markUploaded.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              markUploaded.mutate(item.id);
                            }}
                          >
                            ✓ Tandai Diunggah
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
