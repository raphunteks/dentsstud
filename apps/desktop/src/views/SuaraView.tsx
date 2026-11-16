import { useState } from 'react';
import clsx from 'clsx';
import { Card, Button, Pill, Select } from '../components/UI';
import type { NavTab } from '../types';

interface SuaraViewProps {
  onNavigate: (tab: NavTab) => void;
}

export function SuaraView({ onNavigate }: SuaraViewProps) {
  const [provider, setProvider] = useState<'all' | 'elevenlabs' | 'gemini'>('all');
  const [gender, setGender] = useState<'all' | 'male' | 'female'>('all');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState('depa');

  const VOICES = [
    { id: 'depa', name: 'Depa', provider: 'ElevenLabs', gender: 'male', tag: 'Smooth, clear, and expressive', desc: 'Pilihan default paling natural untuk video edukasi teknologi & sains.' },
    { id: 'gadis', name: 'Gadis', provider: 'ElevenLabs', gender: 'female', tag: 'Wanita ramah & jernih', desc: 'Sangat cocok untuk konten tips harian, lifestyle, dan tutorial santai.' },
    { id: 'ardi', name: 'Ardi', provider: 'Gemini TTS', gender: 'male', tag: 'Pria jelas & natural (Cadangan gratis)', desc: 'Kecepatan respon instan melalui Google Gemini API.' },
    { id: 'putra', name: 'Putra', provider: 'ElevenLabs', gender: 'male', tag: 'Berwibawa & formal', desc: 'Cocok untuk ulasan berita investigasi, finansial, dan dokumenter.' },
    { id: 'mahaputra', name: 'Mahaputra', provider: 'ElevenLabs', gender: 'male', tag: 'News Anchor Young & Calm', desc: 'Gaya pembaca berita modern dengan artikulasi sangat tajam.' },
    { id: 'lily', name: 'Lily', provider: 'Gemini TTS', gender: 'female', tag: 'Velvety Actress', desc: 'Suara lembut bertempo sedang untuk cerita sains dan kesehatan.' },
    { id: 'adam', name: 'Adam', provider: 'ElevenLabs', gender: 'male', tag: 'Dominant & Firm', desc: 'Suara bass berat bertenaga untuk narasi sinematik dramatis.' },
    { id: 'bill', name: 'Bill', provider: 'ElevenLabs', gender: 'male', tag: 'Wise & Balanced', desc: 'Karakter dewasa bijaksana untuk edukasi filosofi dan sejarah.' },
  ];

  const handlePlay = (id: string) => {
    if (playingId === id) {
      setPlayingId(null);
    } else {
      setPlayingId(id);
      // Simulate audio play duration
      setTimeout(() => setPlayingId(null), 3500);
    }
  };

  const filtered = VOICES.filter((v) => {
    const matchProv = provider === 'all' || v.provider.toLowerCase().includes(provider);
    const matchGen = gender === 'all' || v.gender === gender;
    return matchProv && matchGen;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-widest text-muted font-mono">STUDIO AUDIO</p>
        <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
          Suara Narator (AI Voice)
        </h1>
        <p className="mt-1 text-sm text-muted">
          Pilih karakter suara AI terbaik dari ElevenLabs dan Gemini TTS untuk video Anda.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-full border border-line bg-surface p-1 shadow-xs">
            {[
              { id: 'all', label: 'Semua Provider' },
              { id: 'elevenlabs', label: 'ElevenLabs' },
              { id: 'gemini', label: 'Gemini TTS' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setProvider(p.id as typeof provider)}
                className={clsx(
                  'rounded-full px-3.5 py-1 text-xs transition cursor-pointer',
                  provider === p.id
                    ? 'bg-accent text-accent-contrast font-semibold shadow-xs'
                    : 'text-muted hover:text-text'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="inline-flex rounded-full border border-line bg-surface p-1 shadow-xs">
            {[
              { id: 'all', label: 'Semua Gender' },
              { id: 'male', label: 'Pria' },
              { id: 'female', label: 'Wanita' },
            ].map((g) => (
              <button
                key={g.id}
                onClick={() => setGender(g.id as typeof gender)}
                className={clsx(
                  'rounded-full px-3.5 py-1 text-xs transition cursor-pointer',
                  gender === g.id
                    ? 'bg-accent text-accent-contrast font-semibold shadow-xs'
                    : 'text-muted hover:text-text'
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <Button size="sm" onClick={() => onNavigate('buat-konten')}>
          ＋ Pakai di Pesanan
        </Button>
      </div>

      {/* Voice Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {filtered.map((v) => (
          <Card
            key={v.id}
            onClick={() => setSelectedVoice(v.id)}
            className={clsx(
              'group cursor-pointer p-5 flex flex-col justify-between transition-all duration-150',
              selectedVoice === v.id
                ? 'border-accent ring-2 ring-accent/30 bg-accent/5'
                : 'hover:border-text/30'
            )}
          >
            <div className="space-y-2.5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-base font-semibold text-text flex items-center gap-1.5">
                    {v.name}
                    {selectedVoice === v.id && (
                      <span className="text-accent text-xs">✓ Default</span>
                    )}
                  </h3>
                  <p className="text-xs font-medium text-accent mt-0.5">{v.tag}</p>
                </div>
                <Pill variant="default">
                  {v.provider}
                </Pill>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                {v.desc}
              </p>
            </div>

            <div className="pt-4 mt-3 border-t border-line flex items-center justify-between">
              <span className="text-[11px] text-muted">
                {v.gender === 'male' ? '♂ Pria' : '♀ Wanita'} · Bahasa Indonesia
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlay(v.id);
                }}
                className={clsx(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer',
                  playingId === v.id
                    ? 'bg-ok text-white animate-pulse'
                    : 'border border-line bg-surface hover:bg-surface-2 text-text'
                )}
              >
                {playingId === v.id ? '🔊 Memutar…' : '▶ Coba Suara'}
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
