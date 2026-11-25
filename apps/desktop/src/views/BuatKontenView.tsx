import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { get, mutate, pickAndUploadMedia, toMediaUrl } from '../bridge';
import { Button, Card, Pill, Select, Textarea, errMsg } from '../components/UI';
import { Icon } from '../components/Icons';
import type { CreatePrefill, HookItem, NavTab } from '../types';

interface BuatKontenViewProps {
  onSuccess: () => void;
  onNavigate: (tab: NavTab) => void;
  prefill?: CreatePrefill;
}

export function BuatKontenView({ onSuccess, onNavigate, prefill }: BuatKontenViewProps) {
  const qc = useQueryClient();

  const [quantity, setQuantity] = useState(1);
  const [workers, setWorkers] = useState(1);
  const [format, setFormat] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [topicMode, setTopicMode] = useState<'BEBAS' | 'UMUM' | 'PERSIS'>('PERSIS');
  const [topic, setTopic] = useState('Teknologi AI masa depan dan dampaknya');
  const [voiceMode, setVoiceMode] = useState<'TTS' | 'UPLOAD' | 'NONE'>('TTS');
  const [voiceId, setVoiceId] = useState<string>(prefill?.voiceId ?? 'auto');
  const [uploadAudio, setUploadAudio] = useState<{ id: string; filename: string } | null>(null);
  const [refVideos, setRefVideos] = useState<{ id: string; filename: string }[]>([]);
  const [presetCategory, setPresetCategory] = useState<string>('all');
  const [presetId, setPresetId] = useState<string>(prefill?.presetId ?? '');
  const [hookMode, setHookMode] = useState<'AUTO' | 'PRESET' | 'NONE'>('AUTO');
  const [hookId, setHookId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState<'audio' | 'video' | null>(null);

  const catsQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => get<{ categories: Array<{ id: string; slug: string; name: string }>; total: number }>('/styles/categories').catch(() => ({ categories: [], total: 0 })),
  });
  const presetsQuery = useQuery({
    queryKey: ['presets-all'],
    queryFn: () =>
      get<{ items: Array<{ id: string; name: string; thumbnailUrl?: string | null; category?: { slug?: string; name?: string } }> }>('/styles/presets?limit=100').catch(() => ({ items: [] })),
  });
  const voicesQuery = useQuery({
    queryKey: ['voices-all'],
    queryFn: () => get<Array<{ id: string; name: string; provider: string; language: string; voiceAttributes?: { gender?: string } }>>('/voices').catch(() => []),
  });
  const voicePrefQuery = useQuery({
    queryKey: ['voice-pref'],
    queryFn: () => get<{ voiceId: string | null }>('/voices/preferences/me').catch(() => null),
  });
  const hooksQuery = useQuery({
    queryKey: ['hooks-all'],
    queryFn: () => get<HookItem[]>('/hooks').catch(() => []),
  });
  const readyQuery = useQuery({
    queryKey: ['production-readiness'],
    queryFn: () =>
      get<{ license: string; claudeApiKey: boolean; entitlements: { maxWorkers: number; maxVideosPerDay: number; cloudRender: boolean } }>('/production/readiness').catch(() => null),
  });

  const presetsList = presetsQuery.data?.items ?? [];
  const voicesList = voicesQuery.data ?? [];
  const hooksList = hooksQuery.data ?? [];
  const maxWorkers = Math.max(1, readyQuery.data?.entitlements?.maxWorkers ?? 4);
  const maxVideos = Math.max(1, Math.min(20, readyQuery.data?.entitlements?.maxVideosPerDay ?? 20));

  useEffect(() => {
    if (prefill?.presetId) setPresetId(prefill.presetId);
    if (prefill?.voiceId) {
      setVoiceMode('TTS');
      setVoiceId(prefill.voiceId);
    }
  }, [prefill]);

  // Pre-fill default voice from /voices/preferences/me
  useEffect(() => {
    if (!prefill?.voiceId && voiceId === 'auto' && voicePrefQuery.data?.voiceId && voicesList.some((v) => v.id === voicePrefQuery.data?.voiceId)) {
      setVoiceId(voicePrefQuery.data.voiceId);
    }
  }, [voicePrefQuery.data, voicesList, prefill?.voiceId, voiceId]);

  useEffect(() => {
    if (presetsList.length > 0 && (!presetId || !presetsList.some((p) => p.id === presetId))) {
      setPresetId(presetsList[0]!.id);
    }
  }, [presetsList, presetId]);

  useEffect(() => {
    if (workers > maxWorkers) setWorkers(maxWorkers);
    if (quantity > maxVideos) setQuantity(maxVideos);
  }, [maxWorkers, maxVideos, workers, quantity]);

  const lines = useMemo(
    () => topic.split('\n').map((l) => l.trim()).filter((l) => l.length >= 2),
    [topic],
  );
  const effQty = topicMode === 'PERSIS' ? Math.max(1, lines.length) : quantity;

  const submit = useMutation({
    mutationFn: () => {
      let voicePayload: Record<string, unknown> = { mode: 'NONE' };
      if (voiceMode === 'UPLOAD' && uploadAudio) {
        voicePayload = { mode: 'UPLOAD', uploadAssetId: uploadAudio.id };
      } else if (voiceMode === 'TTS') {
        const resolvedVoice =
          voiceId === 'auto'
            ? (voicesList.find((v) => v.id === voicePrefQuery.data?.voiceId) ?? voicesList[0])
            : voicesList.find((v) => v.id === voiceId);
        if (resolvedVoice) {
          voicePayload = { mode: 'TTS', voiceId: resolvedVoice.id };
        }
      }

      const isCustomPreset = presetId && presetId !== 'auto' && presetsList.some((p) => p.id === presetId);
      const targetPresetId = isCustomPreset ? presetId : (presetsList[0]?.id ?? null);

      return mutate('POST', '/production/orders', {
        quantity: effQty,
        workers: Math.min(workers, effQty, maxWorkers),
        format,
        topicMode,
        topic: topicMode === 'UMUM' ? (lines[0] ?? topic) : topicMode === 'PERSIS' ? '' : topic,
        topics: topicMode === 'PERSIS' ? lines : [],
        voice: voicePayload,
        presetId: targetPresetId,
        referenceAssetIds: refVideos.map((r) => r.id),
        hook: { mode: hookMode, hookId: hookMode === 'PRESET' && hookId ? hookId : null },
        notes: notes.trim(),
        start: true,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dash'] });
      qc.invalidateQueries({ queryKey: ['runs'] });
      qc.invalidateQueries({ queryKey: ['production-readiness'] });
      onSuccess();
      onNavigate('progress');
    },
  });

  const CATEGORIES = [
    { id: 'all', name: 'Semua' },
    ...(catsQuery.data?.categories?.map((c) => ({ id: c.slug, name: c.name })) ?? []),
  ];

  const selectedPreset = presetsList.find((p) => p.id === presetId);
  const presetDisplayName = selectedPreset?.name ?? (presetsList.length > 0 ? presetsList[0]!.name : 'Standar Otomatis AI');
  const resolvedVoice =
    voiceId === 'auto'
      ? (voicesList.find((v) => v.id === voicePrefQuery.data?.voiceId) ?? voicesList[0])
      : voicesList.find((v) => v.id === voiceId);
  const voiceDisplayName =
    voiceMode === 'NONE'
      ? 'Tanpa Narasi (Hening)'
      : voiceMode === 'UPLOAD'
        ? uploadAudio?.filename ?? 'Belum pilih audio'
        : resolvedVoice
          ? resolvedVoice.name
          : 'Otomatis AI';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <h1 className="font-display text-2xl font-medium tracking-tight text-text">Buat Konten Baru</h1>
        <p className="mt-1 text-sm text-muted">
          Pilih spesifikasi video, biarkan tim AI meriset fakta, menulis naskah, dan merender grafis secara otomatis.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-6">
          {/* Step 1: Jumlah & Format */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-accent text-accent-contrast text-xs font-bold">1</span>
              <h2 className="font-display text-base font-semibold text-text">Jumlah video, Worker & Format</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted mb-2 font-medium">Jumlah video (maks {maxVideos}/hari)</p>
                <div className="inline-flex items-center rounded-xl border border-line bg-surface-2/40 p-1">
                  <button type="button" disabled={quantity <= 1} onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="flex size-9 items-center justify-center rounded-lg bg-surface text-base font-bold shadow-xs hover:bg-surface-2 disabled:opacity-30 cursor-pointer">−</button>
                  <span className="num w-12 text-center font-mono text-base font-medium">{quantity}</span>
                  <button type="button" disabled={quantity >= maxVideos} onClick={() => setQuantity((q) => Math.min(maxVideos, q + 1))} className="flex size-9 items-center justify-center rounded-lg bg-surface text-base font-bold shadow-xs hover:bg-surface-2 disabled:opacity-30 cursor-pointer">＋</button>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted mb-2 font-medium">Dikerjakan bersamaan (maks {maxWorkers} worker)</p>
                <div className="inline-flex items-center rounded-xl border border-line bg-surface-2/40 p-1">
                  <button type="button" disabled={workers <= 1} onClick={() => setWorkers((w) => Math.max(1, w - 1))} className="flex size-9 items-center justify-center rounded-lg bg-surface text-base font-bold shadow-xs hover:bg-surface-2 disabled:opacity-30 cursor-pointer">−</button>
                  <span className="num w-12 text-center font-mono text-base font-medium">{workers}</span>
                  <button type="button" disabled={workers >= maxWorkers} onClick={() => setWorkers((w) => Math.min(maxWorkers, w + 1))} className="flex size-9 items-center justify-center rounded-lg bg-surface text-base font-bold shadow-xs hover:bg-surface-2 disabled:opacity-30 cursor-pointer">＋</button>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-xs text-muted font-medium">Format rasio video</p>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: '9:16', title: '9:16 Reels', sub: 'TikTok / Shorts' },
                  { id: '16:9', title: '16:9 YouTube', sub: 'Horizontal' },
                  { id: '1:1', title: '1:1 Square', sub: 'Instagram Feed' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormat(f.id as typeof format)}
                    className={clsx(
                      'rounded-xl border p-3 text-left transition cursor-pointer',
                      format === f.id ? 'border-accent bg-accent/10 shadow-xs' : 'border-line bg-surface hover:border-text/30'
                    )}
                  >
                    <p className="text-sm font-semibold text-text">{f.title}</p>
                    <p className="text-[11px] text-muted">{f.sub}</p>
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Step 2: Tema / Topik */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-accent text-accent-contrast text-xs font-bold">2</span>
              <h2 className="font-display text-base font-semibold text-text">Tema atau Topik</h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { id: 'PERSIS', label: 'Topik persis' },
                { id: 'UMUM', label: 'Tema umum' },
                { id: 'BEBAS', label: 'Bebas (AI tentukan)' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setTopicMode(m.id as typeof topicMode)}
                  className={clsx(
                    'rounded-full border px-3.5 py-1 text-xs font-medium transition cursor-pointer',
                    topicMode === m.id ? 'border-accent bg-accent text-accent-contrast' : 'border-line bg-surface-2 text-muted hover:text-text'
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {topicMode !== 'BEBAS' && (
              <div className="space-y-1.5">
                <Textarea
                  rows={3}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Contoh: Mengapa karang gigi bisa menyebabkan gusi berdarah..."
                />
                <p className="text-[11px] text-muted">Satu topik per baris jika memproduksi beberapa video sekaligus.</p>
              </div>
            )}
          </Card>

          {/* Step 3: Suara Narator & Upload Audio */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-accent text-accent-contrast text-xs font-bold">3</span>
              <h2 className="font-display text-base font-semibold text-text">Suara Narator</h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { id: 'TTS', label: 'Suara AI (TTS)' },
                { id: 'UPLOAD', label: 'Unggah Rekaman Sendiri' },
                { id: 'NONE', label: 'Tanpa Narasi (Hening)' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setVoiceMode(m.id as typeof voiceMode)}
                  className={clsx(
                    'rounded-full border px-3.5 py-1 text-xs font-medium transition cursor-pointer',
                    voiceMode === m.id ? 'border-accent bg-accent text-accent-contrast' : 'border-line bg-surface-2 text-muted hover:text-text'
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {voiceMode === 'TTS' && (
              <Select value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className="w-full">
                <option value="auto">Mode Otomatis AI ({resolvedVoice?.name ?? 'Default'})</option>
                {voicesList.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} — {v.provider} ({v.voiceAttributes?.gender === 'female' ? 'Wanita' : 'Pria'})
                  </option>
                ))}
              </Select>
            )}

            {voiceMode === 'UPLOAD' && (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploading === 'audio'}
                  onClick={async () => {
                    setUploading('audio');
                    try {
                      const up = await pickAndUploadMedia('audio');
                      if (!up.canceled) setUploadAudio({ id: up.id, filename: up.filename });
                    } catch (e) {
                      alert(errMsg(e));
                    } finally {
                      setUploading(null);
                    }
                  }}
                >
                  {uploading === 'audio' ? 'Mengunggah…' : <><Icon name="upload" className="w-3.5 h-3.5" /> Pilih File Audio (.mp3 / .wav / .ogg)</>}
                </Button>
                {uploadAudio && (
                  <div className="flex items-center gap-2 text-xs text-ok">
                    <span>✓ {uploadAudio.filename}</span>
                    <button type="button" onClick={() => setUploadAudio(null)} className="text-bad hover:underline cursor-pointer">Hapus</button>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Step 4: Gaya Visual */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-accent text-accent-contrast text-xs font-bold">4</span>
                <h2 className="font-display text-base font-semibold text-text">Gaya Visual</h2>
              </div>
              <span className="text-xs text-muted font-mono">{presetsList.length} resep gaya aktif</span>
            </div>

            <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setPresetCategory(c.id)}
                  className={clsx(
                    'rounded-full border px-3 py-1 text-xs transition cursor-pointer',
                    presetCategory === c.id ? 'border-text bg-text text-bg font-medium' : 'border-line bg-surface text-muted hover:text-text'
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              {presetsList
                .filter((p) => presetCategory === 'all' || p.category?.slug === presetCategory)
                .map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setPresetId(p.id)}
                    className={clsx(
                      'group relative aspect-[3/4] cursor-pointer overflow-hidden rounded-xl border p-3 flex flex-col justify-end transition hover:scale-101 bg-neutral-900',
                      presetId === p.id ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-text/30'
                    )}
                  >
                    {p.thumbnailUrl && (
                      <img
                        src={toMediaUrl(p.thumbnailUrl)}
                        alt={p.name}
                        className="absolute inset-0 size-full object-cover opacity-75 group-hover:opacity-95 transition"
                      />
                    )}
                    <div className="relative z-10 bg-gradient-to-t from-black/85 via-black/45 to-transparent -m-3 p-3 pt-8">
                      <span className="block text-xs font-semibold text-white group-hover:text-accent">{p.name}</span>
                      <span className="block text-[10px] text-white/70 capitalize mt-0.5">{p.category?.name || 'Gaya'}</span>
                    </div>
                    {presetId === p.id && (
                      <span className="absolute top-2 right-2 z-10 flex size-5 items-center justify-center rounded-full bg-accent text-accent-contrast text-[10px]">
                        ✓
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </Card>

          {/* Step 5: Opening Hook, Video Referensi & Catatan Tambahan */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-accent text-accent-contrast text-xs font-bold">5</span>
              <h2 className="font-display text-base font-semibold text-text">Hook Pembuka, Referensi & Catatan</h2>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-text">Opening Hook</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'AUTO', label: 'Otomatis AI' },
                  { id: 'PRESET', label: 'Pilih Preset Hook' },
                  { id: 'NONE', label: 'Tanpa Hook' },
                ].map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setHookMode(h.id as typeof hookMode)}
                    className={clsx(
                      'rounded-full border px-3.5 py-1 text-xs font-medium transition cursor-pointer',
                      hookMode === h.id ? 'border-accent bg-accent text-accent-contrast' : 'border-line bg-surface-2 text-muted hover:text-text'
                    )}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
              {hookMode === 'PRESET' && (
                <Select value={hookId} onChange={(e) => setHookId(e.target.value)} className="w-full mt-2">
                  <option value="">-- Pilih Preset Hook --</option>
                  {hooksList.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </Select>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-line/60">
              <p className="text-xs font-medium text-text">Video Referensi (Opsional)</p>
              <Button
                variant="outline"
                size="sm"
                disabled={uploading === 'video'}
                onClick={async () => {
                  setUploading('video');
                  try {
                    const up = await pickAndUploadMedia('video');
                    if (!up.canceled) setRefVideos((prev) => [...prev, { id: up.id, filename: up.filename }]);
                  } catch (e) {
                    alert(errMsg(e));
                  } finally {
                    setUploading(null);
                  }
                }}
              >
                {uploading === 'video' ? 'Mengunggah…' : <><Icon name="video" className="w-3.5 h-3.5" /> Unggah Video Referensi (.mp4)</>}
              </Button>
              {refVideos.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {refVideos.map((rv) => (
                    <Pill key={rv.id} variant="accent">
                      {rv.filename}{' '}
                      <button
                        type="button"
                        onClick={() => setRefVideos((prev) => prev.filter((x) => x.id !== rv.id))}
                        className="ml-1 text-bad cursor-pointer"
                      >
                        ×
                      </button>
                    </Pill>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5 pt-2 border-t border-line/60">
              <label className="text-xs font-medium text-text">Catatan Tambahan untuk AI (Opsional)</label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Misal: Gunakan bahasa santai untuk pasien muda, tekankan pencegahan tanpa rasa takut..."
                className="text-xs"
              />
            </div>
          </Card>
        </div>

        {/* Right Sticky Order Summary */}
        <aside className="lg:sticky lg:top-4 space-y-4">
          <Card className="p-5 space-y-4 shadow-sm border-line">
            <h3 className="font-display text-base font-semibold text-text border-b border-line pb-3">
              Ringkasan Pesanan
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted">Jumlah</span>
                <span className="font-semibold text-text">{effQty} video</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Format</span>
                <span className="font-semibold text-text">{format}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Worker</span>
                <span className="font-semibold text-text">{Math.min(workers, effQty, maxWorkers)} bersamaan</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Suara</span>
                <span className="font-semibold text-text truncate max-w-[170px] text-right" title={voiceDisplayName}>
                  {voiceDisplayName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Gaya</span>
                <span className="font-semibold text-text truncate max-w-[170px] text-right" title={presetDisplayName}>
                  {presetDisplayName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Hook</span>
                <span className="font-semibold text-text">{hookMode}</span>
              </div>
              {refVideos.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">Referensi</span>
                  <span className="font-semibold text-text">{refVideos.length} video</span>
                </div>
              )}
            </div>

            <div className="border-t border-line pt-3">
              <Button
                size="lg"
                className="w-full text-sm font-semibold"
                disabled={
                  submit.isPending ||
                  (topicMode !== 'BEBAS' && lines.length === 0) ||
                  (voiceMode === 'UPLOAD' && !uploadAudio)
                }
                onClick={() => submit.mutate()}
              >
                {submit.isPending ? 'Mengirim tugas…' : '▶ Mulai produksi'}
              </Button>
              {readyQuery.data && !readyQuery.data.claudeApiKey && (
                <p className="mt-2 text-[11px] text-amber-500 text-center">
                  Claude belum terhubung di server. Buka Pengaturan → Claude AI.
                </p>
              )}
              {submit.isError && <p className="mt-2 text-xs text-bad text-center">{errMsg(submit.error)}</p>}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
