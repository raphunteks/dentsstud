import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { get, mutate } from '../bridge';
import { Button, Card, Input, Pill, Select, Textarea, errMsg } from '../components/UI';
import type { HookItem, NavTab, StylePreset, VoiceItem } from '../types';

interface BuatKontenViewProps {
  onSuccess: () => void;
  onNavigate: (tab: NavTab) => void;
}

export function BuatKontenView({ onSuccess, onNavigate }: BuatKontenViewProps) {
  const qc = useQueryClient();

  const [quantity, setQuantity] = useState(1);
  const [workers, setWorkers] = useState(1);
  const [format, setFormat] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [topicMode, setTopicMode] = useState<'BEBAS' | 'UMUM' | 'PERSIS'>('PERSIS');
  const [topic, setTopic] = useState('Teknologi AI masa depan dan dampaknya');
  const [voiceId, setVoiceId] = useState<string>('none');
  const [presetCategory, setPresetCategory] = useState<string>('all');
  const [presetId, setPresetId] = useState<string>('');
  const [hookMode, setHookMode] = useState<'AUTO' | 'PRESET' | 'NONE'>('AUTO');
  const [notes, setNotes] = useState('');

  const catsQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => get<{ categories: Array<{ id: string; slug: string; name: string }>; total: number }>('/styles/categories').catch(() => ({ categories: [], total: 0 })),
  });
  const presetsQuery = useQuery({
    queryKey: ['presets-all'],
    queryFn: () => get<{ items: Array<{ id: string; name: string; category?: { slug?: string; name?: string } }> }>('/styles/presets?limit=100').catch(() => ({ items: [] })),
  });
  const voicesQuery = useQuery({
    queryKey: ['voices-all'],
    queryFn: () => get<Array<{ id: string; name: string; provider: string; language: string; voiceAttributes?: { gender?: string } }>>('/voices').catch(() => []),
  });
  const hooksQuery = useQuery({
    queryKey: ['hooks-all'],
    queryFn: () => get<HookItem[]>('/hooks').catch(() => []),
  });
  const readyQuery = useQuery({
    queryKey: ['production-readiness'],
    queryFn: () => get<{ license: string; claudeApiKey: boolean; entitlements: { maxWorkers: number; maxVideosPerDay: number; cloudRender: boolean } }>('/production/readiness').catch(() => null),
  });

  const presetsList = presetsQuery.data?.items ?? [];
  const voicesList = voicesQuery.data ?? [];

  // Auto-select first preset once available if none selected
  useEffect(() => {
    if (presetsList.length > 0 && (!presetId || !presetsList.some((p) => p.id === presetId))) {
      setPresetId(presetsList[0]!.id);
    }
  }, [presetsList, presetId]);

  const lines = useMemo(
    () => topic.split('\n').map((l) => l.trim()).filter((l) => l.length >= 2),
    [topic],
  );
  const effQty = topicMode === 'PERSIS' ? Math.max(1, lines.length) : quantity;

  const submit = useMutation({
    mutationFn: () => {
      const isTts = voiceId !== 'none' && voiceId !== 'auto' && Boolean(voiceId);
      const selectedVoice = isTts ? voicesList.find((v) => v.id === voiceId) : null;
      const isCustomPreset = presetId && presetId !== 'auto' && presetsList.some((p) => p.id === presetId);
      const targetPresetId = isCustomPreset ? presetId : (presetsList[0]?.id ?? null);

      return mutate('POST', '/production/orders', {
        quantity: effQty,
        workers: Math.min(workers, effQty),
        format,
        topicMode,
        topic: topicMode === 'UMUM' ? (lines[0] ?? topic) : topicMode === 'PERSIS' ? '' : topic,
        topics: topicMode === 'PERSIS' ? lines : [],
        voice: selectedVoice
          ? { mode: 'TTS', voiceId: selectedVoice.id }
          : { mode: 'NONE' },
        presetId: targetPresetId,
        referenceAssetIds: [],
        hook: { mode: hookMode, hookId: null },
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
  const selectedVoice = voicesList.find((v) => v.id === voiceId);
  const voiceDisplayName = voiceId === 'none' ? 'Tanpa Narasi (Hening)' : selectedVoice ? selectedVoice.name : 'Otomatis';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <h1 className="font-display text-2xl font-medium tracking-tight text-text">
          Buat Konten Baru
        </h1>
        <p className="mt-1 text-sm text-muted">
          Pilih spesifikasi video, biarkan tim AI meriset fakta, menulis naskah, dan merender grafis secara otomatis.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Form Body */}
        <div className="space-y-6">
          {/* Step 1: Jumlah & Format */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-accent text-accent-contrast text-xs font-bold">
                1
              </span>
              <h2 className="font-display text-base font-semibold text-text">
                Jumlah video, Worker & Format
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted mb-2 font-medium">Jumlah video</p>
                <div className="inline-flex items-center rounded-xl border border-line bg-surface-2/40 p-1">
                  <button
                    type="button"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="flex size-9 items-center justify-center rounded-lg bg-surface text-base font-bold shadow-xs hover:bg-surface-2 disabled:opacity-30 cursor-pointer"
                  >
                    −
                  </button>
                  <span className="num w-12 text-center font-mono text-base font-medium">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    disabled={quantity >= 20}
                    onClick={() => setQuantity((q) => q + 1)}
                    className="flex size-9 items-center justify-center rounded-lg bg-surface text-base font-bold shadow-xs hover:bg-surface-2 disabled:opacity-30 cursor-pointer"
                  >
                    ＋
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted mb-2 font-medium">Dikerjakan bersamaan (Worker)</p>
                <div className="inline-flex items-center rounded-xl border border-line bg-surface-2/40 p-1">
                  <button
                    type="button"
                    disabled={workers <= 1}
                    onClick={() => setWorkers((w) => Math.max(1, w - 1))}
                    className="flex size-9 items-center justify-center rounded-lg bg-surface text-base font-bold shadow-xs hover:bg-surface-2 disabled:opacity-30 cursor-pointer"
                  >
                    −
                  </button>
                  <span className="num w-12 text-center font-mono text-base font-medium">
                    {workers}
                  </span>
                  <button
                    type="button"
                    disabled={workers >= 4}
                    onClick={() => setWorkers((w) => w + 1)}
                    className="flex size-9 items-center justify-center rounded-lg bg-surface text-base font-bold shadow-xs hover:bg-surface-2 disabled:opacity-30 cursor-pointer"
                  >
                    ＋
                  </button>
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
                      format === f.id
                        ? 'border-accent bg-accent/10 shadow-xs'
                        : 'border-line bg-surface hover:border-text/30'
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
              <span className="flex size-6 items-center justify-center rounded-full bg-accent text-accent-contrast text-xs font-bold">
                2
              </span>
              <h2 className="font-display text-base font-semibold text-text">
                Tema atau Topik
              </h2>
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
                    topicMode === m.id
                      ? 'border-accent bg-accent text-accent-contrast'
                      : 'border-line bg-surface-2 text-muted hover:text-text'
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
                  placeholder="Contoh: Mengapa AC mobil bocor dan cara mencegahnya..."
                />
                <p className="text-[11px] text-muted">
                  Satu topik per baris jika memproduksi beberapa video sekaligus.
                </p>
              </div>
            )}
          </Card>

          {/* Step 3: Suara Narator */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-accent text-accent-contrast text-xs font-bold">
                3
              </span>
              <h2 className="font-display text-base font-semibold text-text">
                Suara Narator
              </h2>
            </div>

            <div className="space-y-2">
              <Select
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                className="w-full"
              >
                <option value="none">Tanpa Narasi (Video Hening / Musik Saja)</option>
                {voicesList.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} — {v.provider} ({v.voiceAttributes?.gender === 'female' ? 'Wanita' : 'Pria'})
                  </option>
                ))}
                {voicesList.length === 0 && (
                  <option value="auto">Mode Otomatis AI (Gemini TTS default)</option>
                )}
              </Select>
            </div>
          </Card>

          {/* Step 4: Gaya Visual */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-accent text-accent-contrast text-xs font-bold">
                  4
                </span>
                <h2 className="font-display text-base font-semibold text-text">
                  Gaya Visual
                </h2>
              </div>
              <span className="text-xs text-muted font-mono">{presetsList.length} resep gaya aktif</span>
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setPresetCategory(c.id)}
                  className={clsx(
                    'rounded-full border px-3 py-1 text-xs transition cursor-pointer',
                    presetCategory === c.id
                      ? 'border-text bg-text text-bg font-medium'
                      : 'border-line bg-surface text-muted hover:text-text'
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              {presetsList
                .filter((p) => presetCategory === 'all' || p.category?.slug === presetCategory)
                .map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setPresetId(p.id)}
                    className={clsx(
                      'group relative aspect-[3/4] cursor-pointer overflow-hidden rounded-xl border p-3 flex flex-col justify-end transition hover:scale-101',
                      presetId === p.id
                        ? 'border-accent ring-2 ring-accent/30 bg-accent/5'
                        : 'border-line bg-surface-2/40 hover:border-text/30'
                    )}
                  >
                    <span className="text-xs font-semibold text-text group-hover:text-accent">
                      {p.name}
                    </span>
                    <span className="text-[10px] text-muted capitalize mt-0.5">
                      {p.category?.name || 'Gaya'}
                    </span>
                    {presetId === p.id && (
                      <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-accent text-accent-contrast text-[10px]">
                        ✓
                      </span>
                    )}
                  </div>
                ))}

              {presetsList.length === 0 && (
                <div
                  onClick={() => setPresetId('auto')}
                  className={clsx(
                    'group relative aspect-[3/4] cursor-pointer overflow-hidden rounded-xl border p-3 flex flex-col justify-end transition hover:scale-101 col-span-2 sm:col-span-3 border-accent ring-2 ring-accent/30 bg-accent/5'
                  )}
                >
                  <span className="text-xs font-semibold text-text">
                    Gaya Standar Otomatis AI (Studio Editorial)
                  </span>
                  <span className="text-[10px] text-muted mt-0.5">
                    Katalog gaya masih kosong — AI akan memformat komposisi tipografi & scene standar otomatis.
                  </span>
                  <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-accent text-accent-contrast text-[10px]">
                    ✓
                  </span>
                </div>
              )}
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
                <span className="font-semibold text-text">{Math.min(workers, effQty)} bersamaan</span>
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
                <span className="text-muted">Estimasi</span>
                <span className="font-mono text-accent font-semibold">
                  {effQty === 1 ? '± 1 - 2 menit' : `± ${Math.max(1, Math.ceil((effQty / Math.min(workers, effQty)) * 2))} menit`}
                </span>
              </div>
            </div>

            <div className="border-t border-line pt-3">
              <Button
                size="lg"
                className="w-full text-sm font-semibold"
                disabled={submit.isPending || (topicMode !== 'BEBAS' && lines.length === 0)}
                onClick={() => submit.mutate()}
              >
                {submit.isPending ? 'Mengirim tugas…' : '▶ Mulai produksi'}
              </Button>
              {readyQuery.data && !readyQuery.data.claudeApiKey && (
                <p className="mt-2 text-[11px] text-amber-500 text-center">
                  ⚠️ Claude belum terhubung di server. Buka tab AI Provider & OAuth untuk menyambungkan.
                </p>
              )}
              {topicMode !== 'BEBAS' && lines.length === 0 && (
                <p className="mt-2 text-[11px] text-amber-500 text-center">
                  Masukkan topik sebelum memulai produksi.
                </p>
              )}
              {submit.isError && (
                <p className="mt-2 text-xs text-bad text-center">
                  {errMsg(submit.error)}
                </p>
              )}
            </div>

            <p className="text-[11px] text-muted text-center leading-relaxed">
              Tim agen AI (Riset, Naskah, Cek Fakta, Motion Director, QC) akan otomatis memproses naskah secara paralel.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
