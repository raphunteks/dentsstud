import { app, BrowserWindow, Notification } from 'electron';
import { loadConfig, readTokens } from '../local-storage/store.js';

export interface IncomingNotification {
  id: string;
  type?: string;
  title?: string;
  body?: string;
  payload?: Record<string, unknown>;
  readAt?: string | null;
  createdAt?: string;
  actionTab?: string | null;
  targetId?: string | null;
}

const seenIds = new Set<string>();
let abortCtrl: AbortController | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let backoffMs = 3000;

function formatFallback(n: IncomingNotification): { title: string; body: string } {
  if (n.title && n.body) return { title: n.title, body: n.body };
  const p = (n.payload ?? {}) as Record<string, unknown>;
  const topic = typeof p.topic === 'string' ? p.topic : typeof p.title === 'string' ? p.title : '';
  switch (n.type) {
    case 'production.completed':
      return { title: n.title || 'Video selesai diproduksi', body: n.body || (topic ? `"${topic}" siap diunggah.` : 'Video baru Anda siap diunggah.') };
    case 'production.failed':
      return { title: n.title || 'Produksi video gagal', body: n.body || (typeof p.error === 'string' ? p.error : topic || 'Terjadi kendala saat memproduksi video.') };
    case 'support.reply':
      return { title: n.title || 'Balasan tiket support', body: n.body || (typeof p.subject === 'string' ? p.subject : 'Admin membalas tiket bantuan Anda.') };
    case 'license.granted':
      return { title: n.title || 'Lisensi diaktifkan', body: n.body || 'Lisensi DENTSWEB STUDIO Anda telah aktif.' };
    case 'license.revoked':
      return { title: n.title || 'Lisensi dicabut', body: n.body || 'Lisensi perangkat Anda telah dicabut oleh admin.' };
    default:
      return { title: n.title || 'Notifikasi Studio', body: n.body || topic || n.type || 'Pembaruan baru tersedia.' };
  }
}

function focusMainWindow() {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return;
  if (process.platform === 'darwin') {
    app.dock?.show();
    app.focus({ steal: true });
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function dispatchNotification(n: IncomingNotification) {
  if (!n.id || seenIds.has(n.id)) return;
  seenIds.add(n.id);
  if (seenIds.size > 500) {
    const first = seenIds.values().next().value;
    if (first) seenIds.delete(first);
  }

  const { title, body } = formatFallback(n);
  const enriched = { ...n, title, body };

  BrowserWindow.getAllWindows().forEach((w) => {
    if (!w.isDestroyed()) {
      w.webContents.send('dentsweb:event', { channel: 'notification:new', data: enriched });
    }
  });

  if (Notification.isSupported()) {
    try {
      const osNotif = new Notification({ title, body });
      osNotif.on('click', () => {
        focusMainWindow();
        BrowserWindow.getAllWindows().forEach((w) => {
          if (!w.isDestroyed()) {
            w.webContents.send('dentsweb:event', { channel: 'notification:click', data: enriched });
          }
        });
      });
      osNotif.show();
    } catch {}
  }
}

async function connectLoop() {
  if (!running) return;
  const tokens = readTokens();
  if (!tokens?.accessToken) {
    running = false;
    return;
  }

  const { apiBase } = loadConfig();
  abortCtrl = new AbortController();

  try {
    const res = await fetch(`${apiBase}/api/v1/notifications/stream`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        Accept: 'text/event-stream',
        'user-agent': 'DENTSWEB-Desktop',
      },
      signal: abortCtrl.signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status}`);
    }

    backoffMs = 3000;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let eventName = 'message';

    while (running) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line) {
          eventName = 'message';
          continue;
        }
        if (line.startsWith(':')) continue;
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim();
          continue;
        }
        if (line.startsWith('data:')) {
          const raw = line.slice(5).trim();
          if (!raw) continue;
          if (eventName === 'notification' || eventName === 'message') {
            try {
              const parsed = JSON.parse(raw) as IncomingNotification;
              if (parsed && typeof parsed === 'object' && parsed.id) {
                dispatchNotification(parsed);
              }
            } catch {}
          }
        }
      }
    }
  } catch {
    // Silent reconnect on network drop / abort
  } finally {
    abortCtrl = null;
  }

  if (running && readTokens()?.accessToken) {
    const delay = backoffMs;
    backoffMs = Math.min(30_000, backoffMs * 2);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connectLoop();
    }, delay);
  }
}

export function startNotificationStream() {
  if (running) return;
  if (!readTokens()?.accessToken) return;
  running = true;
  backoffMs = 3000;
  void connectLoop();
}

export function stopNotificationStream() {
  running = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (abortCtrl) {
    try {
      abortCtrl.abort();
    } catch {}
    abortCtrl = null;
  }
}
