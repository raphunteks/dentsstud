'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button, Card, Empty, ErrorNote, Field, Input, PageHead, Skeleton, Status } from '@/components/ui';
import { Audio as AudioPlayer, Select, Tabs, Textarea } from '@/components/ui/extra';

interface Prov {
  provider: string;
  displayName: string;
  isEnabled: boolean;
  voiceCount: number;
  capabilities: { emotion: boolean; speed: boolean; pitch: boolean; instructions: boolean };
  accountStatus: string;
}

interface Voice {
  id: string;
  name: string;
  provider: string;
  language: string;
  description: string;
  voiceAttributes: { gender?: string; tone?: string };
  sampleUrl: string | null;
}

interface Pref {
  voiceId: string | null;
  emotion: string | null;
  speed: number;
  pitch: number | null;
  instructions: string | null;
  voiceActive: boolean;
}

const DEFAULT_TEST_TEXT = 'Coba lihat benda ini. Kelihatannya biasa, tapi ada rahasia kecil di dalamnya.';
const EMOTIONS = ['', 'hangat', 'antusias', 'tenang', 'serius', 'ceria', 'dramatis'];
const DICT_KEY = 'dentsweb-pronunciation-dict';

type DictEntry = { term: string; spoken: string };

function loadDict(): DictEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DICT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((x): x is DictEntry => typeof x?.term === 'string' && typeof x?.spoken === 'string');
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed as Record<string, string>).map(([term, spoken]) => ({ term, spoken }));
    }
  } catch {}
  return [];
}

function toDictMap(entries: DictEntry[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of entries) {
    const k = e.term.trim();
    const v = e.spoken.trim();
    if (k && v) out[k] = v;
  }
  return out;
}

const AVATAR_COLORS = [
  'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'bg-pink-500/20 text-pink-400 border-pink-500/30',
  'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'bg-blue-500/20 text-blue-400 border-blue-500/30',
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((n) => n[0]).join('').toUpperCase() || 'V';
}

export default function VoiceStudio() {
  const qc = useQueryClient();
  const provs = useQuery({ queryKey: ['voice-provs'], queryFn: () => api<Prov[]>('/voices/providers') });
  const [prov, setProv] = useState('cadangan');
  const [gender, setGender] = useState('');
  const voices = useQuery({
    queryKey: ['voices', prov, gender],
    queryFn: () => api<Voice[]>(`/voices?provider=${prov}${gender ? `&gender=${gender}` : ''}`),
  });
  const pref = useQuery({ queryKey: ['voice-pref'], queryFn: () => api<Pref>('/voices/preferences/me') });

  const [sel, setSel] = useState<string | null>(null);
  const [testText, setTestText] = useState(DEFAULT_TEST_TEXT);
  const [cfg, setCfg] = useState({ emotion: '', speed: 1, pitch: 0, instructions: '' });
  const [dict, setDict] = useState<DictEntry[]>([]);
  const [newTerm, setNewTerm] = useState('');
  const [newSpoken, setNewSpoken] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [samplePlayingId, setSamplePlayingId] = useState<string | null>(null);

  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const cfgInitialized = useRef(false);

  useEffect(() => {
    setDict(loadDict());
  }, []);

  const persistDict = (next: DictEntry[]) => {
    setDict(next);
    try {
      localStorage.setItem(DICT_KEY, JSON.stringify(next));
    } catch {}
  };

  useEffect(() => {
    return () => {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (provs.data?.length && !provs.data.find((x) => x.provider === prov && x.isEnabled)) {
      const active = provs.data.find((x) => x.isEnabled) || provs.data[0];
      if (active) setProv(active.provider);
    }
  }, [provs.data, prov]);

  useEffect(() => {
    if (pref.data && !cfgInitialized.current) {
      cfgInitialized.current = true;
      setCfg({
        emotion: pref.data.emotion ?? '',
        speed: Number(pref.data.speed || 1),
        pitch: Number(pref.data.pitch ?? 0),
        instructions: pref.data.instructions ?? '',
      });
    }
  }, [pref.data]);

  useEffect(() => {
    const list = voices.data;
    if (!list) return;
    if (list.length === 0) {
      if (sel !== null) setSel(null);
      return;
    }
    if (sel && list.some((v) => v.id === sel)) return;
    if (pref.data?.voiceId && list.some((v) => v.id === pref.data!.voiceId)) {
      setSel(pref.data.voiceId);
    } else {
      setSel(list[0]!.id);
    }
  }, [pref.data?.voiceId, voices.data, sel]);

  const p = provs.data?.find((x) => x.provider === prov);
  const caps = p?.capabilities ?? { emotion: false, speed: false, pitch: false, instructions: false };
  const selectedVoice = voices.data?.find((v) => v.id === sel) || voices.data?.[0];

  const stopActiveAudio = () => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
      activeAudioRef.current = null;
    }
    setIsPlayingPreview(false);
    setSamplePlayingId(null);
  };

  const playAudioUrl = (url: string, onEnd?: () => void) => {
    stopActiveAudio();
    const audio = new Audio(url);
    activeAudioRef.current = audio;
    audio.onended = () => {
      activeAudioRef.current = null;
      onEnd?.();
    };
    audio.onerror = () => {
      activeAudioRef.current = null;
      onEnd?.();
      toast.error('Gagal memutar audio.');
    };
    audio.play().catch(() => {
      activeAudioRef.current = null;
      onEnd?.();
    });
  };

  const handlePlaySample = (v: Voice, e: React.MouseEvent) => {
    e.stopPropagation();
    if (samplePlayingId === v.id) {
      stopActiveAudio();
      return;
    }
    if (!v.sampleUrl) {
      toast.error('Sampel audio belum tersedia untuk karakter ini.');
      return;
    }
    setSamplePlayingId(v.id);
    playAudioUrl(v.sampleUrl, () => setSamplePlayingId(null));
  };

  const tryIt = useMutation({
    mutationFn: () => {
      if (!sel) throw new Error('Pilih karakter suara terlebih dahulu');
      const dictionary = toDictMap(dict);
      return api<{ audioUrl: string; mime: string }>(`/voices/${sel}/preview`, {
        method: 'POST',
        json: {
          text: testText.trim() || DEFAULT_TEST_TEXT,
          emotion: caps.emotion ? cfg.emotion || null : null,
          speed: caps.speed ? cfg.speed : 1,
          pitch: caps.pitch ? cfg.pitch : null,
          instructions: caps.instructions ? cfg.instructions || null : null,
          ...(Object.keys(dictionary).length ? { dictionary } : {}),
        },
      });
    },
    onSuccess: (r) => {
      setPreviewUrl(r.audioUrl);
      setIsPlayingPreview(true);
      playAudioUrl(r.audioUrl, () => setIsPlayingPreview(false));
      toast.success('Audio uji berhasil disintesis!');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const save = useMutation({
    mutationFn: () => {
      if (!sel) throw new Error('Pilih suara terlebih dahulu');
      const dictionary = toDictMap(dict);
      return api('/voices/preferences/me', {
        method: 'PUT',
        json: {
          voiceId: sel,
          emotion: caps.emotion ? cfg.emotion || null : null,
          speed: caps.speed ? cfg.speed : 1,
          pitch: caps.pitch ? cfg.pitch : null,
          instructions: caps.instructions ? cfg.instructions || null : null,
          ...(Object.keys(dictionary).length ? { dictionary } : {}),
        },
      });
    },
    onSuccess: () => {
      toast.success('Suara default berhasil disimpan!');
      qc.invalidateQueries({ queryKey: ['voice-pref'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <>
      <PageHead eyebrow="Studio" title="Suara Narator (AI Voice)" />

      {/* Tabs Filter */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            label="Provider suara"
            value={prov}
            onChange={(v) => {
              setProv(v);
              setSel(null);
              stopActiveAudio();
            }}
            items={(provs.data ?? []).map((x) => ({
              value: x.provider,
              label: (
                <>
                  {x.displayName} <span className="num text-xs opacity-70 font-mono ml-1">{x.voiceCount}</span>
                </>
              ),
            }))}
          />
          <Tabs
            label="Filter karakter"
            value={gender}
            onChange={(g) => {
              setGender(g);
              stopActiveAudio();
            }}
            items={[
              { value: '', label: 'Semua Karakter' },
              { value: 'male', label: 'Pria' },
              { value: 'female', label: 'Wanita' },
            ]}
          />
        </div>

        <Link
          href={sel ? `/create-content?voice=${encodeURIComponent(sel)}` : '/create-content'}
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-4 py-1.5 text-xs font-medium text-text border border-line hover:border-accent transition"
        >
          <span>＋ Buat Konten</span>
        </Link>
      </div>

      {provs.isError && <ErrorNote error={provs.error} onRetry={() => provs.refetch()} />}
      {voices.isError && <ErrorNote error={voices.error} onRetry={() => voices.refetch()} />}

      {p && !p.isEnabled && (
        <p className="mb-4 text-sm text-warn">
          Provider {p.displayName} belum diaktifkan Superadmin di konfigurasi sistem.
        </p>
      )}

      {p && p.accountStatus !== 'CONNECTED' && (
        <p className="mb-4 text-sm text-muted">
          Suara provider ini memerlukan akun tersambung.{' '}
          <Link className="text-accent underline-offset-4 hover:underline" href="/settings/voice-accounts">
            Atur akun {p.displayName}
          </Link>{' '}
          · status <Status value={p.accountStatus} />
        </p>
      )}

      {/* 2-Column Interaktif Layout */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] items-start">
        {/* Sisi Kiri: Grid Kartu Suara */}
        <div className="space-y-4">
          {voices.isLoading && (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-2xl" />
              ))}
            </div>
          )}

          {!voices.isLoading && voices.data?.length === 0 && (
            <Empty
              title="Belum ada suara di katalog"
              body="Katalog suara provider ini masih kosong. Anda tetap bisa memesan video tanpa narasi atau mengunggah rekaman sendiri."
            />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {voices.data?.map((v) => {
              const isSelected = sel === v.id;
              const isDefault = pref.data?.voiceId === v.id;
              const isPlaying = samplePlayingId === v.id;
              const genderText =
                v.voiceAttributes?.gender === 'male'
                  ? 'Pria'
                  : v.voiceAttributes?.gender === 'female'
                    ? 'Wanita'
                    : '';
              const toneText = v.description || v.voiceAttributes?.tone || 'Karakter suara narator AI.';

              return (
                <div
                  key={v.id}
                  onClick={() => {
                    setSel(v.id);
                    stopActiveAudio();
                  }}
                  className={`relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-accent bg-surface-2 shadow-sm ring-2 ring-accent/30'
                      : 'border-line bg-surface hover:bg-surface-2/60 hover:border-text/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Circle Avatar dengan Inisial */}
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border font-display text-sm font-bold shadow-xs ${getAvatarColor(
                        v.name
                      )}`}
                    >
                      {getInitials(v.name)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h3 className="font-display text-sm font-semibold text-text truncate">{v.name}</h3>
                        {isDefault && (
                          <span className="shrink-0 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-mono font-medium text-accent">
                            DEFAULT
                          </span>
                        )}
                      </div>

                      {/* Tag & Tone */}
                      <p className="mt-1 text-xs text-muted line-clamp-2 leading-relaxed">{toneText}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {genderText && (
                          <span className="rounded bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted border border-line">
                            {genderText}
                          </span>
                        )}
                        <span className="text-[10px] text-accent font-mono">{v.language}</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Card: Tombol Sampel */}
                  <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2.5">
                    <button
                      type="button"
                      onClick={(e) => handlePlaySample(v, e)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition cursor-pointer ${
                        isPlaying
                          ? 'bg-accent text-accent-contrast'
                          : 'bg-surface-2 text-text hover:bg-surface-2/80'
                      }`}
                    >
                      <span>{isPlaying ? '■ Berhenti' : '▶ Putar Sampel'}</span>
                    </button>

                    <span className="text-[10px] font-mono text-muted uppercase">{v.provider}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sisi Kanan: Panel 'Gaya bicara' */}
        <Card className="sticky top-6 grid content-start gap-4 p-5 rounded-2xl border-line bg-surface shadow-sm">
          <div>
            <h2 className="font-display text-lg font-semibold text-text">Gaya bicara</h2>
            <p className="mt-1 text-xs text-muted leading-relaxed">
              Stabilitas, kemiripan, dan gaya mengikuti pengaturan brand. Pilih suara di kiri lalu coba.
            </p>
          </div>

          {/* Selected Voice Info Card */}
          {selectedVoice ? (
            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/70 p-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-display text-xs font-bold ${getAvatarColor(
                  selectedVoice.name
                )}`}
              >
                {getInitials(selectedVoice.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-display text-sm font-semibold text-text truncate">{selectedVoice.name}</p>
                  <span className="text-[10px] font-mono text-accent uppercase">
                    {selectedVoice.voiceAttributes?.gender === 'male' ? 'Pria' : 'Wanita'}
                  </span>
                </div>
                <p className="text-xs text-muted truncate">{selectedVoice.language} · {selectedVoice.provider}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line p-3 text-center text-xs text-muted">
              Pilih karakter suara di sebelah kiri
            </div>
          )}

          {/* Teks Uji */}
          <div className="space-y-1.5">
            <label htmlFor="test-text" className="block text-xs font-medium text-text">
              Teks uji
            </label>
            <textarea
              id="test-text"
              rows={3}
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Masukkan kalimat yang ingin Anda dengar..."
              className="w-full rounded-xl border border-line bg-surface-2 p-3 text-xs text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="text-[11px] text-muted">
              Teks ini disintesis secara langsung menggunakan engine suara pilihan Anda.
            </p>
          </div>

          {/* Parameter Suara Opsional jika didukung */}
          {caps.speed && (
            <Field id="spd" label={`Kecepatan (${cfg.speed.toFixed(2)}×)`}>
              <input
                id="spd"
                type="range"
                min={0.75}
                max={1.35}
                step={0.05}
                value={cfg.speed}
                onChange={(e) => setCfg({ ...cfg, speed: Number(e.target.value) })}
                className="w-full accent-accent"
              />
            </Field>
          )}

          {caps.pitch && (
            <Field id="pitch" label={`Nada / Pitch (${cfg.pitch > 0 ? `+${cfg.pitch}` : cfg.pitch} semitone)`}>
              <input
                id="pitch"
                type="range"
                min={-12}
                max={12}
                step={1}
                value={cfg.pitch}
                onChange={(e) => setCfg({ ...cfg, pitch: Number(e.target.value) })}
                className="w-full accent-accent"
              />
            </Field>
          )}

          {caps.emotion && (
            <Field id="emo" label="Emosi">
              <Select
                id="emo"
                value={cfg.emotion}
                onChange={(e) => setCfg({ ...cfg, emotion: e.target.value })}
              >
                {EMOTIONS.map((x) => (
                  <option key={x} value={x}>
                    {x ? x.charAt(0).toUpperCase() + x.slice(1) : 'Netral'}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {caps.instructions && (
            <Field id="ins" label="Arahan Tambahan" hint='Mis. "lembut dan persuasif"'>
              <Textarea
                id="ins"
                value={cfg.instructions}
                onChange={(e) => setCfg({ ...cfg, instructions: e.target.value })}
                className="min-h-14 text-xs"
              />
            </Field>
          )}

          {/* Tombol Aksi */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-line">
            <Button
              variant="ghost"
              disabled={!sel || tryIt.isPending}
              loading={tryIt.isPending}
              onClick={() => {
                if (isPlayingPreview) {
                  stopActiveAudio();
                } else {
                  tryIt.mutate();
                }
              }}
              className="flex-1"
            >
              {tryIt.isPending ? 'Mensintesis…' : isPlayingPreview ? '■ Berhenti' : '▶ Coba suara'}
            </Button>

            <Button
              disabled={!sel || save.isPending}
              loading={save.isPending}
              onClick={() => save.mutate()}
              className="flex-1"
            >
              Simpan default
            </Button>
          </div>

          {/* Status Audio Preview */}
          {previewUrl && (
            <div className="rounded-xl border border-line bg-surface-2 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-text">Hasil Sintesis Terakhir</span>
                <span className="text-[10px] font-mono text-accent">
                  {isPlayingPreview ? 'MEMUTAR...' : 'SIAP'}
                </span>
              </div>
              <AudioPlayer src={previewUrl} />
            </div>
          )}

          {pref.data?.voiceId && !pref.data.voiceActive && (
            <p className="text-xs text-warn">
              Suara default Anda sebelumnya tidak lagi aktif. Silakan pilih suara lain dan klik Simpan.
            </p>
          )}
        </Card>
      </div>

      {/* Kamus Pelafalan (Pronunciation Dictionary) */}
      <Card className="mt-6 p-5 rounded-2xl border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-text">Kamus Pelafalan (Pronunciation Dictionary)</h2>
            <p className="mt-0.5 text-xs text-muted">
              Atur pelafalan istilah medis, kedokteran gigi, atau nama brand agar dibaca tepat saat sintesis suara (mis. <code>pulpitis</code> → <code>pul-pi-tis</code>).
            </p>
          </div>
          <span className="font-mono text-xs text-muted">{dict.length} entri</span>
        </div>

        <form
          className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            const t = newTerm.trim();
            const s = newSpoken.trim();
            if (!t || !s) return;
            const next = [...dict.filter((d) => d.term.toLowerCase() !== t.toLowerCase()), { term: t, spoken: s }];
            persistDict(next);
            setNewTerm('');
            setNewSpoken('');
            toast.success(`Istilah "${t}" ditambahkan ke kamus pelafalan`);
          }}
        >
          <Input
            aria-label="Istilah asli"
            placeholder="Istilah asli (mis. pulpitis, DENTSWEB)"
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            className="h-10 text-sm"
          />
          <Input
            aria-label="Cara baca"
            placeholder="Cara baca (mis. pul-pi-tis, dents-web)"
            value={newSpoken}
            onChange={(e) => setNewSpoken(e.target.value)}
            className="h-10 text-sm"
          />
          <Button type="submit" variant="ghost" className="h-10">
            + Tambah
          </Button>
        </form>

        {dict.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {dict.map((entry) => (
              <li
                key={entry.term}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1 text-xs"
              >
                <span className="font-medium text-text">{entry.term}</span>
                <span className="text-muted">→</span>
                <span className="font-mono text-accent">{entry.spoken}</span>
                <button
                  type="button"
                  aria-label={`Hapus ${entry.term}`}
                  onClick={() => persistDict(dict.filter((d) => d.term !== entry.term))}
                  className="ml-1 text-muted hover:text-bad cursor-pointer"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
