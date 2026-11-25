import { app, BrowserWindow, shell } from 'electron';
import electronUpdater from 'electron-updater';
import { loadConfig } from '../local-storage/store.js';

const { autoUpdater } = electronUpdater;
export type UpdateState =
  | { state: 'idle' | 'checking' | 'none' }
  | { state: 'available'; version: string; notes: string | null; mode: 'install' | 'download'; downloadUrl?: string }
  | { state: 'downloading'; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string };

let current: UpdateState = { state: 'idle' };
const emit = (s: UpdateState) => {
  current = s;
  BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('dentsweb:event', { channel: 'update:state', data: s }));
};

const newer = (a: string, b: string) => {
  const pa = a.split(/[.-]/).map(Number);
  const pb = b.split(/[.-]/).map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  return false;
};

/**
 * Windows: electron-updater against the API's generic feed (/releases/feed/...), user-confirmed download + install.
 * macOS: Squirrel.Mac only accepts signed apps, so until a Developer ID build ships we only notify and open the DMG link.
 */
export function initUpdater() {
  const { apiBase } = loadConfig();
  const channel = 'stable';
  if (process.platform === 'win32') {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.setFeedURL({ provider: 'generic', url: `${apiBase}/api/v1/releases/feed/${channel}/win32/${process.arch}` });
    autoUpdater.on('checking-for-update', () => emit({ state: 'checking' }));
    autoUpdater.on('update-not-available', () => emit({ state: 'none' }));
    autoUpdater.on('update-available', (i) => emit({ state: 'available', version: i.version, notes: typeof i.releaseNotes === 'string' ? i.releaseNotes : null, mode: 'install' }));
    autoUpdater.on('download-progress', (p) => emit({ state: 'downloading', percent: Math.round(p.percent) }));
    autoUpdater.on('update-downloaded', (i) => emit({ state: 'ready', version: i.version }));
    autoUpdater.on('error', (e) => emit({ state: 'error', message: e.message.slice(0, 300) }));
  }
}

export async function checkForUpdates(): Promise<UpdateState> {
  if (!app.isPackaged) return (emit({ state: 'none' }), current);
  const { apiBase } = loadConfig();
  try {
    if (process.platform === 'win32') {
      await autoUpdater.checkForUpdates();
      return current;
    }
    emit({ state: 'checking' });
    const res = await fetch(`${apiBase}/api/v1/releases/latest?platform=${process.platform}&arch=${process.arch}`, { signal: AbortSignal.timeout(15_000) });
    const r = res.ok ? ((await res.json()) as { version: string; releaseNotes: string | null; downloadUrl: string } | null) : null;
    if (r && newer(r.version, app.getVersion())) {
      const dl = r.downloadUrl.startsWith('http') ? r.downloadUrl : `${apiBase}${r.downloadUrl}`;
      emit({ state: 'available', version: r.version, notes: r.releaseNotes, mode: 'download', downloadUrl: dl });
    } else emit({ state: 'none' });
  } catch (e) {
    emit({ state: 'error', message: (e as Error).message.slice(0, 300) });
  }
  return current;
}

export async function applyUpdate(): Promise<UpdateState> {
  if (current.state === 'available' && current.mode === 'download' && current.downloadUrl) {
    await shell.openExternal(current.downloadUrl);
    return current;
  }
  if (current.state === 'available' && current.mode === 'install') {
    void autoUpdater.downloadUpdate().catch((e: Error) => emit({ state: 'error', message: e.message.slice(0, 300) }));
    return current;
  }
  if (current.state === 'ready') setImmediate(() => autoUpdater.quitAndInstall(false, true));
  return current;
}

export const updateState = () => current;
