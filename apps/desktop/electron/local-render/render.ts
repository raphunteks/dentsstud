import { app } from 'electron';
import { existsSync, openAsBlob } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request, requestForm } from '../ipc/api-client.js';

const here = dirname(fileURLToPath(import.meta.url));
const running = new Map<string, AbortController>();

/** System Chrome/Chromium/Edge for Remotion (Electron's Chromium is not a standalone browser). */
export function findChrome(): string | null {
  const c =
    process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']
      : process.platform === 'win32'
        ? [`${process.env['PROGRAMFILES']}\\Google\\Chrome\\Application\\chrome.exe`, `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`, `${process.env['LOCALAPPDATA']}\\Google\\Chrome\\Application\\chrome.exe`, `${process.env['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`]
        : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return process.env.REMOTION_BROWSER_EXECUTABLE ?? c.find((p) => p && existsSync(p)) ?? null;
}

export async function renderLocal(jobId: string, onProgress: (p: number) => void) {
  const browser = findChrome();
  if (!browser) throw new Error('Render lokal membutuhkan Google Chrome, Chromium, atau Microsoft Edge. Gunakan render cloud bila tidak tersedia.');
  const bundle = join(here, '..', 'remotion-bundle');
  if (!existsSync(bundle)) throw new Error('Bundle Remotion tidak ditemukan di aplikasi');
  const start = await request<{ proceed: boolean; inputUrl?: string; format?: 'mp4' | 'webm' | 'gif'; status?: string }>('POST', `/render/jobs/${jobId}/local/start`);
  if (!start.proceed) throw new Error(`Job berstatus ${start.status}`);
  const ac = new AbortController();
  running.set(jobId, ac);
  const dir = join(app.getPath('temp'), 'dentweb-render', jobId);
  await mkdir(dir, { recursive: true });
  const out = join(dir, `out.${start.format}`);
  let last = 0;
  try {
    const doc = await (await fetch(start.inputUrl!)).json();
    const { renderDocument } = await import('@dentweb/remotion-compositions');
    await renderDocument({
      doc, outPath: out, format: start.format, serveUrl: bundle, browserExecutable: browser, signal: ac.signal,
      onProgress: (p: number) => {
        onProgress(p);
        if (Date.now() - last < 1500) return;
        last = Date.now();
        void request<{ cancel: boolean }>('POST', `/render/jobs/${jobId}/local/progress`, { progress: p }).then((r) => r.cancel && ac.abort()).catch(() => undefined);
      },
    });
    const fd = new FormData();
    fd.append('file', await openAsBlob(out), `out.${start.format}`);
    return await requestForm(`/render/jobs/${jobId}/local/output`, fd);
  } catch (e) {
    const msg = ac.signal.aborted ? 'Dibatalkan' : (e as Error).message;
    await request('POST', `/render/jobs/${jobId}/local/fail`, { error: msg }).catch(() => undefined);
    throw new Error(msg);
  } finally {
    running.delete(jobId);
    await rm(dir, { recursive: true, force: true });
  }
}

export const cancelLocal = (jobId: string) => running.get(jobId)?.abort();
