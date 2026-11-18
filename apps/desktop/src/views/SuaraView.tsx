import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { get, mutate, toMediaUrl } from '../bridge';
import { Card, Button, Pill } from '../components/UI';
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
}

interface SuaraViewProps {
  onNavigate: (tab: NavTab) => void;
}

export function SuaraView({ onNavigate }: SuaraViewProps) {
  const qc = useQueryClient();
  const [provider, setProvider] = useState<string>('all');
  const [gender, setGender] = useState<string>('all');
  const [playingId, setPlayingId] = useState<string | null>(null);

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

  const savePref = useMutation({
    mutationFn: (voiceId: string) => mutate('PUT', '/voices/preferences/me', { voiceId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['voice-pref'] });
      alert('Suara default berhasil disimpan!');
    },
  });

  const voices = voicesQuery.data ?? [];

  const handlePlay = (v: Voice) => {
    if (playingId === v.id) {
      setPlayingId(null);
    } else {
      setPlayingId(v.id);
      if (v.sampleUrl) {
        const audio = new Audio(toMediaUrl(v.sampleUrl));
        audio.play().catch(() => null);
        audio.onended = () => setPlayingId(null);
      } else {
        setTimeout(() => setPlayingId(null), 3000);
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-line pb-4">
        <p className="text-xs uppercase tracking-widest text-muted font-mono">STUDIO AUDIO</p>
        <h1 className="font-display text-2xl font-medium tracking-tight text-text mt-0.5">
          Suara Narator (AI Voice)
        </h1>
        <p className="mt-1 text-sm text-muted">
          Pilih karakter suara AI dari VoiceStudio, ElevenLabs, dan Gemini TTS untuk video Anda.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-full border border-line bg-surface p-1 shadow-xs">
            <button
              onClick={() => setProvider('all')}
              className={clsx(
                'rounded-full px-3.5 py-1 text-xs transition cursor-pointer',
                provider === 'all'
                  ? 'bg-accent text-accent-contrast font-semibold shadow-xs'
                  : 'text-muted hover:text-text'
              )}
            >
              Semua Provider
            </button>
            {provs.data?.map((p) => (
              <button
                key={p.provider}
                onClick={() => setProvider(p.provider)}
                className={clsx(
                  'rounded-full px-3.5 py-1 text-xs transition cursor-pointer',
                  provider === p.provider
                    ? 'bg-accent text-accent-contrast font-semibold shadow-xs'
                    : 'text-muted hover:text-text'
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
                onClick={() => setGender(g.id)}
                className={clsx(
                  'rounded-full px-3.5 py-1 text-xs transition cursor-pointer',
                  gender === g.id
                    ? 'bg-surface-2 text-text font-semibold shadow-xs'
                    : 'text-muted hover:text-text'
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <Button size="sm" onClick={() => onNavigate('buat-konten')}>
          ＋ Buat Konten dengan Suara
        </Button>
      </div>

      {/* Loading Skeleton */}
      {voicesQuery.isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-surface-2 border border-line" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!voicesQuery.isLoading && voices.length === 0 && (
        <div className="rounded-2xl border border-line bg-surface p-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-muted">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
            </svg>
          </div>
          <h3 className="font-display text-lg font-medium text-text">
            Belum ada suara di katalog
          </h3>
          <p className="mt-2 text-xs text-muted max-w-md mx-auto">
            Katalog suara provider ini masih kosong. Anda tetap bisa memesan video tanpa narasi atau mengunggah rekaman suara sendiri di wizard Buat Konten.
          </p>
        </div>
      )}

      {/* Voice Grid */}
      {!voicesQuery.isLoading && voices.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {voices.map((v) => {
            const isPlaying = playingId === v.id;
            const genderLabel = v.voiceAttributes?.gender === 'male' ? 'Pria' : v.voiceAttributes?.gender === 'female' ? 'Wanita' : '';

            return (
              <Card
                key={v.id}
                className="p-5 flex flex-col justify-between space-y-4 hover:border-accent transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-base font-semibold text-text">
                        {v.name}
                      </h3>
                      {genderLabel && (
                        <span className="rounded bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted">
                          {genderLabel}
                        </span>
                      )}
                    </div>
                    <Pill>{v.provider}</Pill>
                  </div>
                  <p className="mt-1 text-xs text-accent font-medium">
                    {v.language || 'Bahasa Indonesia'}
                  </p>
                  <p className="mt-2 text-xs text-muted line-clamp-2">
                    {v.description || v.voiceAttributes?.tone || 'Karakter suara narator otomatis.'}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
                  <button
                    onClick={() => handlePlay(v)}
                    className={clsx(
                      'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer',
                      isPlaying
                        ? 'bg-accent text-accent-contrast'
                        : 'bg-surface-2 text-text hover:bg-surface-2/80'
                    )}
                  >
                    <span>{isPlaying ? '■ Berhenti' : '▶ Putar Sampel'}</span>
                  </button>

                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={savePref.isPending}
                    onClick={() => savePref.mutate(v.id)}
                  >
                    {savePref.isPending && savePref.variables === v.id ? 'Menyimpan…' : 'Jadikan Default'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}