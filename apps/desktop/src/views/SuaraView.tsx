import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { get, mutate, toMediaUrl } from '../bridge';
import { Card, Button, Input, Pill } from '../components/UI';
import type { NavTab } from '../types';

interface Voice {
  id: string;
  name: string;
  provider: string;
  language: string;
  description: string;
  voiceAttributes: { gender?: string; tone?: string };
  sampleUrl: string | null;
}

interface Prov {
  provider: string;
  displayName: string;
  isEnabled: boolean;
  voiceCount: number;
  capabilities: { emotion: boolean; speed: boolean; pitch: boolean; instructions: boolean };
}

interface Pref {
  voiceId: string | null;
  emotion: string | null;
  speed: number;
  pitch: number | null;
  instructions: string | null;
  voiceActive: boolean;
}

interface DictEntry {
  term: string;
  pronunciation: string;
}

interface SuaraViewProps {
  onNavigate: (tab: NavTab, opts?: { voiceId?: string }) => void;
}

const DEFAULT_TEST_TEXT = 'Coba lihat benda ini. Kelihatannya biasa, tapi ada rahasia kecil di dalamnya.';
const EMOTIONS = ['', 'hangat', 'antusias', 'tenang', 'serius', 'ceria', 'dramatis'];
const DICT_KEY = 'dentsweb-pronunciation-dict';

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

function applyPronunciationDict(text: string, entries: DictEntry[]): string {
  let out = text;
  for (const e of entries) {
    if (!e.term.trim() || !e.pronunciation.trim()) continue;
    const escaped = e.term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), e.pronunciation.trim());
  }
  return out;
}

export function SuaraView({ onNavigate }: SuaraViewProps) {
  const qc = useQueryClient();
  const [provider, setProvider] = useState<string>('all');
  const [gender, setGender] = useState<string>('all');
  const [sel, setSel] = useState<string | null>(null);
  const [testText, setTestText] = useState(DEFAULT_TEST_TEXT);
  const [speed, setSpeed] = useState(1);
  const [pitch, setPitch] = useState(0);
  const [emotion, setEmotion] = useState('');
  const [instructions, setInstructions] = useState('');
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [samplePlayingId, setSamplePlayingId] = useState<string | null>(null);

  // Kamus Pelafalan (Pronunciation Dictionary)
  const [dict, setDict] = useState<DictEntry[]>(() => {
    try {
      const raw = localStorage.getItem(DICT_KEY);
      return raw ? (JSON.parse(raw) as DictEntry[]) : [
        { term: 'pulpitis', pronunciation: 'pul-pi-tis' },
        { term: 'kalkulus', pronunciation: 'kal-ku-lus' },
      ];
    } catch {
      return [];
    }
  });
  const [newTerm, setNewTerm] = useState('');
  const [newPron, setNewPron] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(DICT_KEY, JSON.stringify(dict));
    } catch {}
  }, [dict]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlayingPreview(false);
    setSamplePlayingId(null);
  };

  useEffect(() => () => stopAudio(), []);

  const provs = useQuery({
    queryKey: ['voice-provs'],
    queryFn: () => get<Prov[]>('/voices/providers').catch(() => []),
  });

  const voicesQuery = useQuery({
    queryKey: ['voices', provider, gender],
    queryFn: () =>
      get<Voice[]>(
        `/voices${provider !== 'all' ? `?provider=${provider}` : ''}${gender !== 'all' ? `${provider !== 'all' ? '&' : '?'}gender=${gender}` : ''}`
      ).catch(() => []),
  });

  const prefQuery = useQuery({
    queryKey: ['voice-pref'],
    queryFn: () => get<Pref>('/voices/preferences/me').catch(() => null),
  });

  const voices = voicesQuery.data ?? [];

  // Fix stale `sel` bug when switching provider/gender filters
  useEffect(() => {
    if (voices.length === 0) {
      setSel(null);
      return;
    }
    if (sel && voices.some((v) => v.id === sel)) return;
    if (prefQuery.data?.voiceId && voices.some((v) => v.id === prefQuery.data?.voiceId)) {
      setSel(prefQuery.data.voiceId);
      if (prefQuery.data.speed) setSpeed(Number(prefQuery.data.speed));
      if (prefQuery.data.pitch !== null && prefQuery.data.pitch !== undefined) setPitch(Number(prefQuery.data.pitch));
      if (prefQuery.data.emotion) setEmotion(prefQuery.data.emotion);
      if (prefQuery.data.instructions) setInstructions(prefQuery.data.instructions);
    } else {
      setSel(voices[0]!.id);
    }
  }, [voices, prefQuery.data, sel]);

  const selectedVoice = voices.find((v) => v.id === sel) ?? null;
  const activeProv = provs.data?.find((p) => p.provider === selectedVoice?.provider);
  const caps = activeProv?.capabilities ?? { emotion: false, speed: false, pitch: false, instructions: false };

  const playAudio = (url: string, onEnd?: () => void) => {
    stopAudio();
    const finalUrl = toMediaUrl(url);
    const audio = new Audio(finalUrl);
    audioRef.current = audio;

    audio.onended = () => {
      audioRef.current = null;
      onEnd?.();
    };
    audio.onerror = () => {
      audioRef.current = null;
      onEnd?.();
      alert('Gagal memutar audio sampel. Pastikan format audio valid dan server terhubung.');
    };
    audio.play().catch(() => {
      audioRef.current = null;
      onEnd?.();
    });
  };

  const handlePlaySample = (v: Voice, e: React.MouseEvent) => {
    e.stopPropagation();
    if (samplePlayingId === v.id) {
      stopAudio();
      return;
    }
    if (!v.sampleUrl) {
      alert('Sampel audio belum tersedia untuk karakter ini.');
      return;
    }
    setSamplePlayingId(v.id);
    playAudio(v.sampleUrl, () => setSamplePlayingId(null));
  };

  const tryItMutation = useMutation({
    mutationFn: () => {
      if (!sel) throw new Error('Pilih karakter suara terlebih dahulu');
      const processedText = applyPronunciationDict(testText.trim() || DEFAULT_TEST_TEXT, dict);
      return mutate<{ audioUrl: string; mime: string }>('POST', `/voices/${sel}/preview`, {
        text: processedText,
        speed: caps.speed ? speed : 1,
        pitch: caps.pitch ? pitch : null,
        emotion: caps.emotion ? emotion || null : null,
        instructions: caps.instructions ? instructions.trim() || null : null,
      });
    },
    onSuccess: (res) => {
      setPreviewAudioUrl(res.audioUrl);
      setIsPlayingPreview(true);
      playAudio(res.audioUrl, () => setIsPlayingPreview(false));
    },
    onError: (err: any) => {
      alert(`Gagal mensintesis coba suara: ${err?.message ?? 'Server error'}`);
    },
  });

  const savePref = useMutation({
    mutationFn: () => {
      if (!sel) throw new Error('Pilih suara terlebih dahulu');
      return mutate('PUT', '/voices/preferences/me', {
        voiceId: sel,
        speed: caps.speed ? speed : 1,
        pitch: caps.pitch ? pitch : null,
        emotion: caps.emotion ? emotion || null : null,
        instructions: caps.instructions ? instructions.trim() || null : null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['voice-pref'] });
      alert('Suara default berhasil disimpan!');
    },
    onError: (err: any) => {
      alert(`Gagal menyimpan suara default: ${err?.message ?? 'Error'}`);
    },
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-widest text-muted font-mono">STUDIO AUDIO</p>
        <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
          Suara Narator (AI Voice)
        </h1>
        <p className="mt-1 text-sm text-muted">
          Pilih karakter suara AI dari VoiceStudio (Kokoro ONNX + Edge-TTS), ElevenLabs, dan Gemini TTS.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-full border border-line bg-surface p-1 shadow-xs">
            <button
              onClick={() => { setProvider('all'); stopAudio(); }}
              className={clsx(
                'rounded-full px-3.5 py-1 text-xs transition cursor-pointer',
                provider === 'all' ? 'bg-accent text-accent-contrast font-semibold shadow-xs' : 'text-muted hover:text-text'
              )}
            >
              Semua Provider
            </button>
            {provs.data?.map((p) => (
              <button
                key={p.provider}
                onClick={() => { setProvider(p.provider); stopAudio(); }}
                className={clsx(
                  'rounded-full px-3.5 py-1 text-xs transition cursor-pointer',
                  provider === p.provider ? 'bg-accent text-accent-contrast font-semibold shadow-xs' : 'text-muted hover:text-text'
                )}
              >
                {p.displayName} <span className="opacity-70 ml-1 font-mono">{p.voiceCount}</span>
              </button>
            ))}
          </div>

          <div className="inline-flex rounded-full border border-line bg-surface p-1 shadow-xs">
            {[
              { id: 'all', label: 'Semua Karakter' },
              { id: 'male', label: 'Pria' },
              { id: 'female', label: 'Wanita' },
            ].map((g) => (
              <button
                key={g.id}
                onClick={() => { setGender(g.id); stopAudio(); }}
                className={clsx(
                  'rounded-full px-3.5 py-1 text-xs transition cursor-pointer',
                  gender === g.id ? 'bg-surface-2 text-text font-semibold shadow-xs' : 'text-muted hover:text-text'
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <Button size="sm" onClick={() => onNavigate('buat-konten', sel ? { voiceId: sel } : undefined)}>
          ＋ Buat Konten dengan Suara
        </Button>
      </div>

      {/* 2-Column Layout */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] items-start">
        {/* Left: Voice Cards */}
        <div className="space-y-4">
          {voicesQuery.isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface-2 border border-line" />
              ))}
            </div>
          )}

          {!voicesQuery.isLoading && voices.length === 0 && (
            <Card className="p-12 text-center space-y-2">
              <h3 className="font-display text-lg font-medium text-text">Belum ada suara di katalog</h3>
              <p className="text-xs text-muted max-w-md mx-auto">
                Katalog suara untuk filter ini masih kosong. Coba pilih provider atau karakter lain.
              </p>
            </Card>
          )}

          {!voicesQuery.isLoading && voices.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {voices.map((v) => {
                const isSelected = sel === v.id;
                const isDefault = prefQuery.data?.voiceId === v.id;
                const isPlaying = samplePlayingId === v.id;
                const genderLabel =
                  v.voiceAttributes?.gender === 'male' ? 'Pria' : v.voiceAttributes?.gender === 'female' ? 'Wanita' : '';
                const toneLabel = v.description || v.voiceAttributes?.tone || 'Karakter suara narator AI.';

                return (
                  <div
                    key={v.id}
                    onClick={() => { setSel(v.id); stopAudio(); }}
                    className={clsx(
                      'relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all cursor-pointer',
                      isSelected
                        ? 'border-accent bg-surface-2 shadow-sm ring-2 ring-accent/30'
                        : 'border-line bg-surface hover:bg-surface-2/60 hover:border-text/20'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={clsx(
                          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border font-display text-sm font-bold shadow-xs',
                          getAvatarColor(v.name)
                        )}
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
                        <p className="mt-1 text-xs text-muted line-clamp-2 leading-relaxed">{toneLabel}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {genderLabel && (
                            <span className="rounded bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted border border-line">
                              {genderLabel}
                            </span>
                          )}
                          <span className="text-[10px] text-accent font-mono">{v.language || 'id-ID'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2.5">
                      <button
                        type="button"
                        onClick={(e) => handlePlaySample(v, e)}
                        className={clsx(
                          'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition cursor-pointer',
                          isPlaying ? 'bg-accent text-accent-contrast' : 'bg-surface-2 text-text hover:bg-surface-2/80'
                        )}
                      >
                        <span>{isPlaying ? '■ Berhenti' : '▶ Putar Sampel'}</span>
                      </button>
                      <Pill className="text-[10px] uppercase font-mono">{v.provider}</Pill>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Kamus Pelafalan (Pronunciation Dictionary) */}
          <Card className="p-5 space-y-3">
            <div>
              <h2 className="font-display text-base font-semibold text-text">Kamus Pelafalan</h2>
              <p className="text-xs text-muted mt-0.5">
                Atur cara baca istilah medis/kedokteran gigi agar narator AI melafalkannya dengan tepat.
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newTerm.trim() || !newPron.trim()) return;
                setDict((prev) => [...prev, { term: newTerm.trim(), pronunciation: newPron.trim() }]);
                setNewTerm('');
                setNewPron('');
              }}
              className="flex flex-wrap gap-2"
            >
              <Input
                placeholder="Kata asli (mis. pulpitis)"
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
                className="flex-1 min-w-[130px] h-9 text-xs"
              />
              <Input
                placeholder="Pelafalan (mis. pul-pi-tis)"
                value={newPron}
                onChange={(e) => setNewPron(e.target.value)}
                className="flex-1 min-w-[130px] h-9 text-xs"
              />
              <Button type="submit" size="sm" variant="outline" disabled={!newTerm.trim() || !newPron.trim()}>
                + Tambah
              </Button>
            </form>
            {dict.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {dict.map((d, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-xs"
                  >
                    <strong className="text-text">{d.term}</strong>
                    <span className="text-muted">→</span>
                    <span className="font-mono text-accent">{d.pronunciation}</span>
                    <button
                      type="button"
                      onClick={() => setDict((prev) => prev.filter((_, idx) => idx !== i))}
                      className="ml-1 text-muted hover:text-bad cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Panel Gaya bicara */}
        <Card className="sticky top-6 grid content-start gap-4 p-5 rounded-2xl border-line bg-surface shadow-sm">
          <div>
            <h2 className="font-display text-lg font-semibold text-text">Gaya bicara</h2>
            <p className="mt-1 text-xs text-muted leading-relaxed">
              Stabilitas, kemiripan, dan gaya mengikuti pengaturan brand. Pilih suara di kiri lalu coba.
            </p>
          </div>

          {selectedVoice ? (
            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/70 p-3">
              <div
                className={clsx(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-display text-xs font-bold',
                  getAvatarColor(selectedVoice.name)
                )}
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

          <div className="space-y-1.5">
            <label htmlFor="test-text" className="block text-xs font-medium text-text">Teks uji</label>
            <textarea
              id="test-text"
              rows={3}
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Masukkan kalimat yang ingin Anda dengar..."
              className="w-full rounded-xl border border-line bg-surface-2 p-3 text-xs text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Parameter Gaya Bicara */}
          <div className="space-y-3 pt-1 border-t border-line/60">
            <div>
              <div className="flex justify-between text-xs">
                <span className="font-medium text-text">Kecepatan Bicara</span>
                <span className="font-mono text-accent">{caps.speed ? `${speed.toFixed(2)}×` : 'Default (1.00×)'}</span>
              </div>
              <input
                type="range"
                min={0.75}
                max={1.35}
                step={0.05}
                disabled={!caps.speed}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full mt-1.5 accent-accent cursor-pointer disabled:opacity-40"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs">
                <span className="font-medium text-text">Nada (Pitch)</span>
                <span className="font-mono text-accent">{caps.pitch ? `${pitch > 0 ? `+${pitch}` : pitch} st` : 'Default (0)'}</span>
              </div>
              <input
                type="range"
                min={-12}
                max={12}
                step={1}
                disabled={!caps.pitch}
                value={pitch}
                onChange={(e) => setPitch(Number(e.target.value))}
                className="w-full mt-1.5 accent-accent cursor-pointer disabled:opacity-40"
              />
            </div>

            {caps.emotion && (
              <div>
                <span className="block text-xs font-medium text-text mb-1">Emosi Suara</span>
                <select
                  value={emotion}
                  onChange={(e) => setEmotion(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface-2 p-2 text-xs text-text focus:border-accent focus:outline-none"
                >
                  {EMOTIONS.map((x) => (
                    <option key={x} value={x}>{x ? x.charAt(0).toUpperCase() + x.slice(1) : 'Netral'}</option>
                  ))}
                </select>
              </div>
            )}

            {caps.instructions && (
              <div>
                <span className="block text-xs font-medium text-text mb-1">Arahan Tambahan</span>
                <Input
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder='Mis. "seperti dokter gigi yang ramah"'
                  className="h-9 text-xs"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-line">
            <Button
              variant="ghost"
              disabled={!sel || tryItMutation.isPending}
              onClick={() => (isPlayingPreview ? stopAudio() : tryItMutation.mutate())}
              className="flex-1"
            >
              {tryItMutation.isPending ? 'Mensintesis…' : isPlayingPreview ? '■ Berhenti' : '▶ Coba suara'}
            </Button>

            <Button disabled={!sel || savePref.isPending} onClick={() => savePref.mutate()} className="flex-1">
              {savePref.isPending ? 'Menyimpan…' : 'Simpan default'}
            </Button>
          </div>

          {previewAudioUrl && (
            <div className="rounded-xl border border-line bg-surface-2 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-text">Hasil Sintesis Terakhir</span>
                <span className="text-[10px] font-mono text-accent">
                  {isPlayingPreview ? 'MEMUTAR...' : 'TERSEDIA'}
                </span>
              </div>
              <audio controls src={toMediaUrl(previewAudioUrl)} className="w-full h-8" />
            </div>
          )}

          {prefQuery.data?.voiceId && !prefQuery.data.voiceActive && (
            <p className="text-xs text-bad">
              Suara default Anda sebelumnya tidak lagi aktif. Silakan pilih karakter suara baru lalu klik Simpan.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
