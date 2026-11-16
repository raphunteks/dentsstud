import { loadConfig, readTokens, writeTokens, type Tokens } from '../local-storage/store.js';

export class ApiFailure extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function raw(method: string, path: string, body: unknown, token?: string) {
  const { apiBase } = loadConfig();
  let res: Response;
  try {
    res = await fetch(`${apiBase}/api/v1${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), 'user-agent': 'DENTWEB-Desktop' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    throw new ApiFailure(0, 'OFFLINE', `Server tidak dapat dihubungi (${(e as Error).message})`);
  }
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiFailure(res.status, err?.code ?? 'ERROR', err?.message ?? `HTTP ${res.status}`);
  }
  return data;
}

let refreshing: Promise<Tokens | null> | null = null;
async function refresh(): Promise<Tokens | null> {
  const t = readTokens();
  if (!t) return null;
  refreshing ??= (async () => {
    try {
      const r = (await raw('POST', '/auth/refresh', { refreshToken: t.refreshToken })) as { session: Tokens };
      writeTokens(r.session);
      return r.session;
    } catch (e) {
      if (e instanceof ApiFailure && e.status === 401) writeTokens(null);
      return null;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

/** Authenticated request. Tokens never leave the main process. */
export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const t = readTokens();
  try {
    return (await raw(method, path, body, t?.accessToken)) as T;
  } catch (e) {
    if (e instanceof ApiFailure && e.status === 401 && t) {
      const n = await refresh();
      if (n) return (await raw(method, path, body, n.accessToken)) as T;
    }
    throw e;
  }
}

export const publicRequest = <T>(method: string, path: string, body?: unknown) => raw(method, path, body) as Promise<T>;

/** Authenticated multipart request (uploads from main process: local import, local render output). */
export async function requestForm<T>(path: string, form: FormData): Promise<T> {
  const { apiBase } = loadConfig();
  const go = async (token?: string) => fetch(`${apiBase}/api/v1${path}`, { method: 'POST', body: form, headers: token ? { authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(600_000) });
  let res = await go(readTokens()?.accessToken);
  if (res.status === 401) {
    const n = await refresh();
    if (n) res = await go(n.accessToken);
  }
  const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
  if (!res.ok) throw new ApiFailure(res.status, body.error?.code ?? 'ERROR', body.error?.message ?? `HTTP ${res.status}`);
  return body as T;
}
