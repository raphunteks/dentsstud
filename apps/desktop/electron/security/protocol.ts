import { net, protocol } from 'electron';
import { normalize, join, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

export const APP_SCHEME = 'app';
export const APP_HOST = 'dentsweb';
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

export function registerSchemePrivileges() {
  protocol.registerSchemesAsPrivileged([{ scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
}

const ALLOWED_REMOTE = [
  'https://motion.dentsweb.my.id',
  'https://*.dentsweb.my.id',
  'https://*.dentsweb.studio',
  'https://*.dentweb.studio',
  'http://localhost:*',
  'http://127.0.0.1:*',
].join(' ');

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${ALLOWED_REMOTE}`,
  "font-src 'self' data:",
  `connect-src 'self' ${ALLOWED_REMOTE}`,
  `media-src 'self' blob: data: ${ALLOWED_REMOTE}`,
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ');

/** Serves the built renderer from disk with traversal protection and a strict CSP. */
export function serveRenderer(rootDir: string) {
  protocol.handle(APP_SCHEME, async (req) => {
    const url = new URL(req.url);
    if (url.host !== APP_HOST) return new Response('Not found', { status: 404 });
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '') || 'index.html';
    const file = join(rootDir, rel);
    const r = relative(rootDir, file);
    if (r.startsWith('..') || isAbsolute(r)) return new Response('Forbidden', { status: 403 });
    const res = await net.fetch(pathToFileURL(file).toString()).catch(() => null);
    if (!res || !res.ok) return new Response('Not found', { status: 404 });
    const headers = new Headers(res.headers);
    headers.set('Content-Security-Policy', CSP);
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(res.body, { status: 200, headers });
  });
}
