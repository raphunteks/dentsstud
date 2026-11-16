import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** ffprobe/ffmpeg are optional on the host; callers degrade honestly when missing. */
export async function ffprobe(file: string): Promise<{ durationSec: number; width?: number; height?: number; hasAudio: boolean; codec?: string } | null> {
  try {
    const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height', '-of', 'json', file], { timeout: 30_000 });
    const j = JSON.parse(stdout) as { format?: { duration?: string }; streams?: { codec_type: string; codec_name?: string; width?: number; height?: number }[] };
    const v = j.streams?.find((s) => s.codec_type === 'video');
    return { durationSec: Number(j.format?.duration ?? 0), width: v?.width, height: v?.height, codec: v?.codec_name, hasAudio: !!j.streams?.some((s) => s.codec_type === 'audio') };
  } catch {
    return null;
  }
}

export async function extractFrame(video: string, out: string, atSec: number) {
  await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(Math.max(0, atSec)), '-i', video, '-frames:v', '1', out], { timeout: 60_000 });
  return out;
}

/** Duration of a WAV from its header, else ffprobe, else an estimate from words (~2.6 words/s). */
export async function audioDuration(file: string, buf: Buffer | null, text: string) {
  if (buf && buf.subarray(0, 4).toString('ascii') === 'RIFF') {
    const byteRate = buf.readUInt32LE(28);
    const dataIdx = buf.indexOf('data', 12, 'ascii');
    if (byteRate > 0 && dataIdx > 0) return buf.readUInt32LE(dataIdx + 4) / byteRate;
  }
  const p = await ffprobe(file);
  if (p?.durationSec) return p.durationSec;
  return Math.max(2, text.split(/\s+/).length / 2.6);
}
