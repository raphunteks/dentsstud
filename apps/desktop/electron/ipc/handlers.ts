import { applyUpdate, checkForUpdates, updateState } from '../updater/updater.js';
import { reportDesktopError } from '../updater/telemetry.js';
import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron';
import { cancelLocal, findChrome, renderLocal } from '../local-render/render.js';
import { importFolder } from '../local-import/scan.js';
import { cacheProject, localOp, localProjects, syncAll } from '../local-storage/projects.js';
import { arch, hostname, platform } from 'node:os';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { CHANNELS, type Channel } from './channels.js';
import { ApiFailure, publicRequest, request, requestForm } from './api-client.js';
import { kvDel, kvGet, kvSet, loadConfig, readTokens, saveConfig, secureStorageAvailable, writeTokens, type Tokens } from '../local-storage/store.js';
import { verifyProof } from '../security/license-proof.js';
import { askClaudeCode, detectClaudeCode } from '../security/claude-code.js';
import { APP_ORIGIN } from '../security/protocol.js';
import { startLocalCallbackListener } from '../security/oauth-listener.js';
import { startNotificationStream, stopNotificationStream } from '../notifications/stream.js';

type Result<T> = { ok: true; data: T } | { ok: false; error: { status: number; code: string; message: string } };

function trusted(e: IpcMainInvokeEvent) {
  const url = e.senderFrame?.url ?? '';
  return url.startsWith(`${APP_ORIGIN}/`);
}

function handle<C extends Channel>(channel: C, fn: (input: never) => Promise<unknown>) {
  ipcMain.handle(channel, async (e, raw): Promise<Result<unknown>> => {
    if (!trusted(e)) return { ok: false, error: { status: 403, code: 'UNTRUSTED_SENDER', message: 'Pengirim IPC tidak dipercaya' } };
    const parsed = CHANNELS[channel].safeParse(raw ?? undefined);
    if (!parsed.success) return { ok: false, error: { status: 422, code: 'IPC_VALIDATION', message: parsed.error.issues[0]?.message ?? 'Input tidak valid' } };
    try {
      return { ok: true, data: await fn(parsed.data as never) };
    } catch (err) {
      if (err instanceof ApiFailure) return { ok: false, error: { status: err.status, code: err.code, message: err.message } };
      return { ok: false, error: { status: 500, code: 'INTERNAL', message: (err as Error).message } };
    }
  });
}

async function ensurePublicKey() {
  try {
    const r = await publicRequest<{ pem: string }>('GET', '/licenses/public-key');
    kvSet('license.publicKey', r.pem);
    return r.pem;
  } catch {
    return kvGet('license.publicKey');
  }
}

export function registerIpc() {
  handle('app:info', async () => ({
    version: app.getVersion(),
    platform: platform(),
    arch: arch(),
    apiBase: loadConfig().apiBase,
    secureStorage: secureStorageAvailable(),
  }));

  handle('config:set-api-base', async (i: { apiBase: string }) => {
    stopNotificationStream();
    writeTokens(null);
    return saveConfig({ apiBase: i.apiBase.replace(/\/$/, '') });
  });

  handle('auth:register', (i: { email: string; password: string; displayName: string }) => publicRequest('POST', '/auth/register', i));
  handle('auth:login', (i: { email: string; password: string }) => publicRequest('POST', '/auth/login', i));
  handle('auth:resend', (i: { challengeId: string }) => publicRequest('POST', '/auth/otp/resend', i));
  handle('auth:verify', async (i: { challengeId: string; code: string }) => {
    const r = await publicRequest<{ user: unknown; session: Tokens }>('POST', '/auth/otp/verify', { ...i, client: 'desktop' });
    writeTokens(r.session);
    startNotificationStream();
    return { user: r.user, persisted: secureStorageAvailable() };
  });
  handle('auth:session', async () => {
    if (!readTokens()) return null;
    try {
      const sess = await request('GET', '/auth/session');
      startNotificationStream();
      if (kvGet('license.proof')) {
        void request<{ proof: string; expiresAt: string }>('POST', '/licenses/offline-proof')
          .then(async (p) => {
            kvSet('license.proof', p.proof);
            await ensurePublicKey();
          })
          .catch(() => undefined);
      }
      return sess;
    } catch (e) {
      if (e instanceof ApiFailure && (e.status === 401 || e.status === 403)) {
        stopNotificationStream();
        writeTokens(null);
        return null;
      }
      throw e;
    }
  });
  handle('auth:logout', async () => {
    stopNotificationStream();
    await request('POST', '/auth/logout').catch(() => undefined);
    writeTokens(null);
    kvDel('license.proof');
    return { ok: true };
  });

  handle('api:get', (i: { path: string }) => request('GET', i.path));
  handle('api:mutate', (i: { method: string; path: string; body?: Record<string, unknown> }) => {
    if (i.path === '/auth/password/forgot' || i.path === '/auth/password/reset') {
      return publicRequest(i.method, i.path, i.body);
    }
    if (i.path.startsWith('/auth/') && i.path !== '/auth/password/change') {
      throw new ApiFailure(403, 'FORBIDDEN_PATH', 'Gunakan kanal auth khusus');
    }
    return request(i.method, i.path, i.body);
  });
  handle('media:pick-upload', async (i: { kind: 'audio' | 'video' | 'image' }) => {
    const filters =
      i.kind === 'audio'
        ? [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg'] }]
        : i.kind === 'video'
          ? [{ name: 'Video', extensions: ['mp4', 'webm'] }]
          : [{ name: 'Gambar', extensions: ['png', 'jpg', 'jpeg', 'webp'] }];
    const r = await dialog.showOpenDialog({ title: `Pilih file ${i.kind}`, properties: ['openFile'], filters });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    const filePath = r.filePaths[0];
    const buf = await readFile(filePath);
    const filename = basename(filePath);
    const form = new FormData();
    form.append('file', new Blob([buf]), filename);
    const uploaded = await requestForm<{ id: string; filename: string; mimeType: string; sizeBytes: number; url: string }>('/media', form);
    return { canceled: false, ...uploaded };
  });

  handle('admin:upload-skill-zip', async (i: { filename: string; base64: string }) => {
    const buf = Buffer.from(i.base64, 'base64');
    const form = new FormData();
    form.append('file', new Blob([buf], { type: 'application/zip' }), i.filename);
    return requestForm<{ imported: unknown[]; count: number }>('/admin/skills/upload-zip', form);
  });

  handle('license:activate', async () => {
    const { installationId } = loadConfig();
    const p = platform();
    const r = await request<{ deviceId: string }>('POST', '/devices/activate', {
      installationId,
      platform: p === 'darwin' || p === 'win32' ? p : 'linux',
      architecture: arch(),
      label: hostname().slice(0, 120) || 'Komputer',
    });
    const proof = await request<{ proof: string; expiresAt: string }>('POST', '/licenses/offline-proof');
    kvSet('license.proof', proof.proof);
    await ensurePublicKey();
    return { deviceId: r.deviceId, offlineUntil: proof.expiresAt };
  });

  handle('license:offline-status', async () => {
    const proof = kvGet('license.proof');
    const pem = kvGet('license.publicKey');
    if (!proof || !pem) return { valid: false, reason: 'Belum ada bukti aktivasi offline' };
    const payload = verifyProof(proof, pem);
    return payload ? { valid: true, until: new Date(payload.exp * 1000).toISOString(), entitlements: payload.ent } : { valid: false, reason: 'Bukti aktivasi kedaluwarsa atau tidak valid' };
  });

  handle('claude:detect', async () => detectClaudeCode());
  handle('claude:oauth-listen', async () => {
    startLocalCallbackListener();
    return { listening: true };
  });

  handle('claude:test', async (i: { prompt: string }) => {
    const det = await detectClaudeCode();
    if (!det.installed) return { ok: false, error: 'Claude Code tidak ditemukan di komputer ini.' };
    const r = await askClaudeCode(det.path, i.prompt);
    // Report the honest outcome to the API (connection bound to this activated device).
    if (r.authenticated !== null) {
      await request('POST', '/ai/connections/start', { provider: 'anthropic', method: 'CLAUDE_CODE_LOCAL', version: det.version, authenticated: r.authenticated }).catch(() => undefined);
    }
    return { ...r, version: det.version };
  });

  const emit = (channel: string, data: unknown) => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('dentsweb:event', { channel, data }));
  handle('render:capability', async () => ({ chrome: findChrome() }));
  handle('render:local', (i: { jobId: string }) => renderLocal(i.jobId, (p) => emit('render:progress', { jobId: i.jobId, progress: p })));
  handle('render:cancel', async (i: { jobId: string }) => (cancelLocal(i.jobId), { ok: true }));
  handle('import:folder', async (i: { kind: 'preset' | 'voice' | 'hook' }) => {
    const r = await dialog.showOpenDialog({ title: 'Pilih folder konten DENTSWEB', properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    return importFolder(r.filePaths[0], i.kind, (p) => emit('import:progress', { progress: p }));
  });
  handle('projects:cache', (i: { projectId: string }) => cacheProject(i.projectId));
  handle('projects:local-list', async () => localProjects());
  handle('projects:local-op', async (i: { projectId: string; ops: unknown[] }) => localOp(i.projectId, i.ops));
  handle('projects:sync', () => syncAll());

  handle('update:check', () => checkForUpdates());
  handle('update:apply', () => applyUpdate());
  handle('update:state', async () => updateState());
  handle('telemetry:error', async (i: { message: string; stack?: string }) => {
    const e = new Error(i.message);
    e.stack = i.stack;
    reportDesktopError(e);
    return { ok: true };
  });
  handle('shell:open-external', async (i: { url: string }) => {
    await shell.openExternal(i.url);
    return { ok: true };
  });
}
