import { app } from 'electron';
import { loadConfig } from '../local-storage/store.js';

const sent = new Set<string>();
/** Reports desktop crashes to /telemetry/errors. Only message, stack and versions; no tokens, paths are trimmed. */
export function reportDesktopError(err: unknown) {
  const e = err instanceof Error ? err : new Error(String(err));
  const key = `${e.message}|${e.stack?.split('\n')[1] ?? ''}`;
  if (sent.has(key) || sent.size > 20) return;
  sent.add(key);
  const home = app.getPath('home');
  const strip = (s?: string) => s?.split(home).join('~').slice(0, 8000);
  const { apiBase } = loadConfig();
  void fetch(`${apiBase}/api/v1/telemetry/errors`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ source: 'desktop', message: strip(e.message)!.slice(0, 2000), stack: strip(e.stack), release: `${app.getVersion()} ${process.platform}-${process.arch}` }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined);
}
