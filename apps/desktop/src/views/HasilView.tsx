import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { get, invoke, mutate } from '../bridge';
import { Button, Card, Input, Textarea, Pill } from '../components/UI';
import type { NavTab, ResultDetail, ResultItem } from '../types';

interface HasilViewProps {
  onNavigate: (tab: NavTab) => void;
}

function fmtBytes(bytes: number) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = 1;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
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

/**
 * Detailed view of a single video production result matching the Web results view (Gambar 4).
 */
function HasilDetailView({
  id,
  onBack,
}: {
  id: string;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [comment, setComment] = useState('');
  const [title, setTitle] = useState('');
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['result-detail', id],
    queryFn: () => get<ResultDetail>(`/results/${id}`),
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
    mutationFn: (body: { title?: string; status?: string }) =>
      mutate('PATCH', `/results/${id}`, body),
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

  const downloadFile = (url: string) => {
    void invoke('shell:open-external', { url });
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
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header Bar matching Gambar 4 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-mono text-muted uppercase hover:text-text cursor-pointer flex items-center gap-1.5 transition-colors mb-1"
          >
            ← HASIL
          </button>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text">
            {d.title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {d.videoUrl && (
            <Button
              size="md"
              className="bg-accent text-accent-contrast font-semibold shadow-xs"
              onClick={() => downloadFile(d.videoUrl)}
            >
              ⬇ Unduh MP4 · {fmtBytes(d.file?.sizeBytes ?? 0)}
            </Button>
          )}
          {d.coverUrl && (
            <Button
              variant="outline"
              size="md"
              onClick={() => downloadFile(d.coverUrl!)}
            >
              Unduh Cover
            </Button>
          )}
        </div>
      </div>

      {/* Main 2-Column Content: Left = Video & Actions; Right = Social & Fact Check */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,440px)_1fr] items-start">
        {/* Left Column: Video Player & Metadata Card */}
        <div className="space-y-4">
          <Card className="overflow-hidden p-0 border border-line bg-black shadow-md rounded-2xl">
            <video
              src={d.videoUrl}
              poster={d.coverUrl ?? undefined}
              controls
              playsInline
              className="max-h-[68vh] w-full bg-black object-contain aspect-[9/16]"
            />
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
                  disabled={title === d.title || !title.trim()}
                  onClick={() => patchResult.mutate({ title })}
                >
                  {copiedLabel === 'saved-title' ? '✓ Tersimpan' : 'Simpan'}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-line">
              {d.status === 'READY' ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs flex-1"
                  onClick={() => patchResult.mutate({ status: 'UPLOADED' })}
                >
                  ✓ Tandai sudah diunggah
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs flex-1"
                  onClick={() => patchResult.mutate({ status: 'READY' })}
                >
                  ↺ Kembalikan ke siap upload
                </Button>
              )}
              <Button
                variant="danger"
                size="sm"
                className="text-xs"
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
        </div>

        {/* Right Column: Social Media Package & Fact Check (Matching Gambar 4) */}
        <div className="space-y-4">
          <Card className="p-5 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
              <div>
                <h2 className="font-display text-base font-semibold text-text">
                  Paket sosial media
                </h2>
                <p className="text-xs text-muted">Siap langsung disalin dan ditempel ke TikTok/Reels/Shorts.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-medium cursor-pointer"
                onClick={() => copyText(allText, 'all')}
              >
                {copiedLabel === 'all' ? '✓ Caption + Hashtag Disalin!' : '📋 Salin caption + hashtag'}
              </Button>
            </div>

            {/* Caption Area */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="caption-input" className="text-xs font-semibold text-text">
                  Caption
                </label>
                <button
                  type="button"
                  onClick={() => copyText(caption, 'caption')}
                  className="text-[11px] text-accent hover:underline cursor-pointer"
                >
                  {copiedLabel === 'caption' ? '✓ Disalin' : 'Salin teks'}
                </button>
              </div>
              <Textarea
                id="caption-input"
                rows={7}
                maxLength={2200}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="text-xs font-sans leading-relaxed"
              />
              <p className="text-right font-mono text-[11px] text-muted">
                {caption.length}/2200 karakter
              </p>
            </div>

            {/* Hashtag Area */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="tags-input" className="text-xs font-semibold text-text">
                  Hashtag
                </label>
                <button
                  type="button"
                  onClick={() => copyText(tags, 'tags')}
                  className="text-[11px] text-accent hover:underline cursor-pointer"
                >
                  {copiedLabel === 'tags' ? '✓ Disalin' : 'Salin tags'}
                </button>
              </div>
              <Input
                id="tags-input"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            {/* Komentar Pertama */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="comment-input" className="text-xs font-semibold text-text">
                  Komentar pertama (Referensi & Sumber)
                </label>
                <button
                  type="button"
                  onClick={() => copyText(comment, 'comment')}
                  className="text-[11px] text-accent hover:underline cursor-pointer"
                >
                  {copiedLabel === 'comment' ? '✓ Disalin' : 'Salin komentar'}
                </button>
              </div>
              <Textarea
                id="comment-input"
                rows={4}
                maxLength={500}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="text-xs leading-relaxed"
              />
            </div>

            {/* Teks Cover */}
            {d.social?.coverText && (
              <div className="rounded-xl border border-line bg-surface-2/60 p-3 text-xs">
                <span className="text-muted">Teks cover: </span>
                <span className="font-semibold text-text">{d.social.coverText}</span>
              </div>
            )}

            {/* Save Button */}
            <div className="pt-2 flex items-center justify-between">
              <Button
                size="md"
                className="bg-accent text-accent-contrast font-medium"
                onClick={() => saveSocial.mutate()}
              >
                {copiedLabel === 'saved-social' ? '✓ Paket Sosial Tersimpan!' : 'Simpan Perubahan Sosial'}
              </Button>
              {saveSocial.isPending && (
                <span className="text-xs text-muted animate-pulse">Menyimpan…</span>
              )}
            </div>
          </Card>

          {/* Sumber & Cek Fakta Card */}
          {d.factCheck && (
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-text">Sumber & Cek Fakta</h3>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  {d.factCheck.verdict.verified} Terverifikasi
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                {d.factCheck.verdict.verified} klaim klinis terverifikasi ·{' '}
                {d.factCheck.verdict.unverified} belum diverifikasi ·{' '}
                {d.factCheck.verdict.contradicted} bertentangan.
              </p>
              <div className="space-y-2 pt-1 max-h-48 overflow-y-auto pr-1">
                {d.factCheck.claims.slice(0, 5).map((c, i) => (
                  <div key={i} className="text-xs rounded-lg border border-line/60 bg-surface-2/40 p-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-[11px]">
                        ✓ Klaim #{i + 1}
                      </span>
                      <span className="text-[10px] text-muted">{c.status}</span>
                    </div>
                    <p className="text-text">{c.claim}</p>
                    {c.note && <p className="text-[11px] text-muted italic">{c.note}</p>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Quality Control (QC) Card */}
          {d.qc && (
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-text">Pemeriksaan Kualitas (QC)</h3>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  {d.qc.passed ? 'Lulus Semua Uji' : 'Perlu Perhatian'}
                </span>
              </div>
              <p className="text-xs text-muted">
                {d.qc.checks.filter((c) => c.passed).length} dari {d.qc.checks.length} uji lolos standar penyiaran.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export function HasilView({ onNavigate }: HasilViewProps) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'READY' | 'UPLOADED' | 'FAILED' | 'ALL' | 'TRASH'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const results = useQuery({
    queryKey: ['results', activeSubTab],
    queryFn: () => get<ResultItem[]>(`/results?tab=${activeSubTab}`).catch(() => []),
  });

  const markUploaded = useMutation({
    mutationFn: (id: string) => mutate('POST', `/results/${id}/mark-uploaded`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['results'] }),
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

  // If a video is selected, show the detailed result view matching web Gambar 4
  if (selectedId) {
    return <HasilDetailView id={selectedId} onBack={() => setSelectedId(null)} />;
  }

  // Real items fetched from backend API (PostgreSQL/Upstash)
  const displayItems = results.data ?? [];

  const filteredItems = displayItems.filter((it) => {
    if (activeSubTab === 'ALL') return true;
    if (activeSubTab === 'READY') return it.status === 'READY';
    if (activeSubTab === 'UPLOADED') return it.status === 'UPLOADED';
    if (activeSubTab === 'FAILED') return it.status === 'FAILED';
    if (activeSubTab === 'TRASH') return it.deletedAt !== null;
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-widest text-muted font-mono">PERPUSTAKAAN</p>
        <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
          Hasil Produksi Video
        </h1>
        <p className="mt-1 text-sm text-muted">
          Klik video untuk memutar, menyalin caption media sosial, atau menandai video sudah diunggah.
        </p>
      </div>

      {/* Sub Tabs Pill Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-line bg-surface p-1 shadow-xs">
          {SUB_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveSubTab(t.id as typeof activeSubTab)}
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

      {results.isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-[9/16] rounded-xl bg-surface-2 animate-pulse border border-line" />
          ))}
        </div>
      )}

      {!results.isLoading && filteredItems.length === 0 && (
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

      {/* 9:16 Video Card Grid: Clickable cards to open detail view (Gambar 4) */}
      {!results.isLoading && filteredItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <Card
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              className="group relative flex flex-col overflow-hidden p-0 hover:border-accent hover:shadow-md transition-all duration-200 cursor-pointer shadow-xs"
            >
              {/* 9:16 Thumbnail Container with Hover Play Overlay */}
              <div className="relative aspect-[9/16] w-full bg-gradient-to-br from-neutral-800 to-neutral-900 overflow-hidden">
                {item.coverUrl ? (
                  <img
                    src={item.coverUrl}
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
                        • {item.status === 'UPLOADED' ? 'Diunggah' : item.status === 'READY' ? 'Siap upload' : 'Gagal'}
                      </span>
                      <span className="text-xs opacity-75 font-mono">9:16</span>
                    </div>

                    <div className="space-y-2">
                      <span className="inline-block rounded bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
                        KITA BONGKAR
                      </span>
                      <h4 className="font-display text-sm font-bold leading-tight line-clamp-3">
                        {item.title}
                      </h4>
                    </div>

                    <div className="text-[10px] opacity-75 font-mono">
                      {new Date(item.createdAt).toLocaleDateString('id-ID', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                )}

                {/* Subtle Hover Play Button Overlay */}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                  <div className="size-12 rounded-full bg-accent/90 text-accent-contrast flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <span className="text-xl pl-0.5">▶</span>
                  </div>
                </div>
              </div>

              {/* Video Meta & Actions */}
              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between bg-surface">
                <div>
                  <p className="text-xs font-semibold text-text line-clamp-2 group-hover:text-accent transition-colors">
                    {item.title}
                  </p>
                  <p className="text-[11px] text-muted line-clamp-2 mt-1">
                    {item.captionPreview}
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-line">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyCaption(item.id, item.captionPreview);
                    }}
                  >
                    {copiedId === item.id ? '✓ Caption Tersalin!' : '📋 Salin Caption'}
                  </Button>

                  {item.status === 'READY' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        markUploaded.mutate(item.id);
                      }}
                    >
                      ✓ Tandai Diunggah
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
