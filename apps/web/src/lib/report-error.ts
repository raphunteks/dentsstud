/** Sends unexpected client errors to /telemetry/errors (deduplicated per page load, capped). Never sends request bodies or storage. */
const sent = new Set<string>();
export function reportError(err: unknown) {
  if (typeof window === 'undefined' || sent.size >= 10) return;
  const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'Unknown error');
  const key = `${e.message}|${e.stack?.split('\n')[1] ?? ''}`;
  if (sent.has(key)) return;
  sent.add(key);
  const body = JSON.stringify({ source: 'web', message: e.message.slice(0, 2000), stack: e.stack?.slice(0, 8000), url: location.pathname, release: process.env.NEXT_PUBLIC_APP_VERSION });
  void fetch('/api/v1/telemetry/errors', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
}
