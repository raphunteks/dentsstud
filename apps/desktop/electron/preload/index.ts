import { contextBridge, ipcRenderer } from 'electron';

// Kept in sync with electron/ipc/channels.ts (validated again in main).
const ALLOWED = [
  'app:info', 'config:set-api-base', 'auth:login', 'auth:verify', 'auth:resend', 'auth:session', 'auth:logout',
  'api:get', 'api:mutate', 'license:activate', 'license:offline-status', 'claude:detect', 'claude:test', 'shell:open-external', 'render:local', 'render:cancel', 'render:capability', 'import:folder', 'projects:cache', 'projects:local-list', 'projects:local-op', 'projects:sync',
  'update:check', 'update:apply', 'update:state', 'telemetry:error',
] as const;

contextBridge.exposeInMainWorld('dentweb', {
  onEvent: (cb: (e: { channel: string; data: unknown }) => void) => {
    const h = (_: unknown, e: { channel: string; data: unknown }) => cb(e);
    ipcRenderer.on('dentweb:event', h);
    return () => ipcRenderer.removeListener('dentweb:event', h);
  },
  invoke: (channel: string, payload?: unknown) => {
    if (!(ALLOWED as readonly string[]).includes(channel)) return Promise.reject(new Error(`Channel ${channel} not allowed`));
    return ipcRenderer.invoke(channel, payload);
  },
});
