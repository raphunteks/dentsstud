type Res<T> = { ok: true; data: T } | { ok: false; error: { status: number; code: string; message: string } };
declare global {
  interface Window {
    dentweb: { invoke: (channel: string, payload?: unknown) => Promise<Res<unknown>>; onEvent: (cb: (e: { channel: string; data: any }) => void) => () => void }; // eslint-disable-line @typescript-eslint/no-explicit-any
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
export async function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  const r = await window.dentweb.invoke(channel, payload);
  if (!r.ok) throw new BridgeError(r.error.status, r.error.code, r.error.message);
  return r.data as T;
}
export const get = <T,>(path: string) => invoke<T>('api:get', { path });
