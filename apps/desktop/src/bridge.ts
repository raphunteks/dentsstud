type Res<T> = { ok: true; data: T } | { ok: false; error: { status: number; code: string; message: string } };
interface BridgeApi {
  invoke: (channel: string, payload?: unknown) => Promise<Res<unknown>>;
  onEvent: (cb: (e: { channel: string; data: any }) => void) => () => void; // eslint-disable-line @typescript-eslint/no-explicit-any
}
declare global {
  interface Window {
    dentsweb?: BridgeApi;
    dentweb?: BridgeApi;
  }
}
export class BridgeError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
const getBridge = () => window.dentsweb ?? window.dentweb;
export async function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  const b = getBridge();
  if (!b) throw new BridgeError(500, 'BRIDGE_UNAVAILABLE', 'IPC bridge tidak tersedia');
  const r = await b.invoke(channel, payload);
  if (!r.ok) throw new BridgeError(r.error.status, r.error.code, r.error.message);
  return r.data as T;
}
export const get = <T,>(path: string) => invoke<T>('api:get', { path });
export const mutate = <T,>(method: string, path: string, body?: Record<string, unknown>) => invoke<T>('api:mutate', { method, path, body });
export const pickAndUploadMedia = (kind: 'audio' | 'video' | 'image') =>
  invoke<{ canceled: true } | { canceled: false; id: string; filename: string; mimeType: string; sizeBytes: number; url: string }>('media:pick-upload', { kind });
export const uploadSkillZip = (filename: string, base64: string) =>
  invoke<{ imported: unknown[]; count: number }>('admin:upload-skill-zip', { filename, base64 });

export const DEFAULT_MEDIA_BASE = 'https://motion.dentsweb.my.id';
let currentMediaBase = DEFAULT_MEDIA_BASE;

export function setMediaBase(apiBase: string | null | undefined) {
  if (apiBase && (apiBase.startsWith('http://') || apiBase.startsWith('https://'))) {
    currentMediaBase = apiBase.replace(/\/$/, '');
  }
}

export function getMediaBase() {
  return currentMediaBase;
}

export function toMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  return `${currentMediaBase}${url.startsWith('/') ? '' : '/'}${url}`;
}
