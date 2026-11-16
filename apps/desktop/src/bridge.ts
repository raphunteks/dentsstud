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
