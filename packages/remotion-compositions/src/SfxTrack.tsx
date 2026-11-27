import React from 'react';
import { Audio, Sequence, useVideoConfig } from 'remotion';

export interface SfxCue {
  /** Audio filename (e.g. "impact.wav") or full URL */
  file?: string;
  sfx?: string;
  src?: string;
  /** Cue start time in seconds */
  atSec?: number;
  timeSec?: number;
  startSec?: number;
  at?: number;
  /** Requested gain (0..1) */
  gain?: number;
  volume?: number;
  /** Loudness-guarded ceiling computed by sfx-guard.mjs (0..1) */
  gainMax?: number;
  /** Optional duration in seconds (defaults to 2.0s) */
  durationSec?: number;
}

export interface SfxTrackProps {
  cues?: SfxCue[];
  sfxBaseUrl?: string;
}

export function resolveCueVolume(cue: SfxCue): number {
  const rawGain = typeof cue.gain === 'number' ? cue.gain : typeof cue.volume === 'number' ? cue.volume : 0.25;
  const cap = typeof cue.gainMax === 'number' ? cue.gainMax : 0.35;
  return Math.max(0, Math.min(1, Math.min(rawGain, cap)));
}

export function resolveCueStartSec(cue: SfxCue): number {
  if (typeof cue.atSec === 'number') return cue.atSec;
  if (typeof cue.timeSec === 'number') return cue.timeSec;
  if (typeof cue.startSec === 'number') return cue.startSec;
  if (typeof cue.at === 'number') return cue.at;
  return 0;
}

export function resolveCueUrl(cue: SfxCue, sfxBaseUrl?: string): string {
  const raw = cue.src || cue.file || cue.sfx || '';
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const cleanName = raw.replace(/^\/+/, '');
  const withExt = cleanName.endsWith('.wav') || cleanName.endsWith('.mp3') ? cleanName : `${cleanName}.wav`;
  if (!sfxBaseUrl) return '';
  return `${sfxBaseUrl.replace(/\/+$/, '')}/${encodeURIComponent(withExt)}`;
}

export const SfxTrack: React.FC<SfxTrackProps> = ({ cues, sfxBaseUrl }) => {
  const { fps, durationInFrames } = useVideoConfig();
  if (!Array.isArray(cues) || cues.length === 0) return null;

  return (
    <>
      {cues.map((cue, idx) => {
        const url = resolveCueUrl(cue, sfxBaseUrl);
        if (!url) return null;
        const from = Math.max(0, Math.min(durationInFrames - 1, Math.round(resolveCueStartSec(cue) * fps)));
        const durFrames = Math.max(10, Math.min(durationInFrames - from, Math.round((cue.durationSec ?? 2.0) * fps)));
        const vol = resolveCueVolume(cue);
        if (vol <= 0.001) return null;
        return (
          <Sequence key={`sfx-${idx}-${from}`} from={from} durationInFrames={durFrames}>
            <Audio src={url} volume={vol} />
          </Sequence>
        );
      })}
    </>
  );
};
