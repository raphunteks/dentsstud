import { contextBridge, ipcRenderer } from 'electron';

// Kept in sync with electron/ipc/channels.ts (validated again in main).
const ALLOWED = [
  'app:info', 'config:set-api-base', 'auth:register', 'auth:login', 'auth:verify', 'auth:resend', 'auth:session', 'auth:logout',
  'api:get', 'api:mutate', 'media:pick-upload', 'license:activate', 'license:offline-status', 'claude:detect', 'claude:oauth-listen', 'claude:test', 'shell:open-external', 'render:local', 'render:cancel', 'render:capability', 'import:folder', 'projects:cache', 'projects:local-list', 'projects:local-op', 'projects:sync',
  'update:check', 'update:apply', 'update:state', 'telemetry:error',
] as const;

const api = {
  onEvent: (cb: (e: { channel: string; data: unknown }) => void) => {
    const h = (_: unknown, e: { channel: string; data: unknown }) => cb(e);
    ipcRenderer.on('dentsweb:event', h);
    return () => {
      ipcRenderer.removeListener('dentsweb:event', h);
    };
  },
  invoke: (channel: string, payload?: unknown) => {
    if (!(ALLOWED as readonly string[]).includes(channel)) return Promise.reject(new Error(`Channel ${channel} not allowed`));
    return ipcRenderer.invoke(channel, payload);
  },
};

contextBridge.exposeInMainWorld('dentsweb', api);
contextBridge.exposeInMainWorld('dentweb', api);
