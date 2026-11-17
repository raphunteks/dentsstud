import { createServer, type Server } from 'node:http';
import { BrowserWindow } from 'electron';
import { request } from '../ipc/api-client.js';

let activeServer: Server | null = null;

export function startLocalCallbackListener(onSuccess?: () => void) {
  if (activeServer) {
    try {
      activeServer.close();
    } catch {}
    activeServer = null;
  }

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost:3000');
      if (url.pathname === '/callback') {
        let code = url.searchParams.get('code') ?? '';
        let state = url.searchParams.get('state') ?? undefined;

        if (code.includes('#')) {
          const parts = code.split('#');
          code = parts[0]!;
          if (!state && parts[1]) state = parts[1];
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>DENTSWEB STUDIO - Terhubung</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #141210; color: #f4efe5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #1c1917; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 40px; text-align: center; max-width: 420px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
    h2 { color: #22c55e; margin-top: 0; font-size: 22px; }
    p { color: #a8a29e; font-size: 14px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h2>✓ Berhasil Terhubung!</h2>
    <p>Otorisasi Claude AI selesai. Anda dapat menutup tab ini dan kembali ke aplikasi DENTSWEB STUDIO.</p>
  </div>
  <script>setTimeout(() => window.close(), 2000);</script>
</body>
</html>`);

        if (code) {
          try {
            await request('GET', `/ai/connections/callback?code=${encodeURIComponent(code)}${state ? `&state=${encodeURIComponent(state)}` : ''}`);
            const win = BrowserWindow.getAllWindows()[0];
            if (win) {
              if (win.isMinimized()) win.restore();
              win.focus();
              win.webContents.send('claude:connected');
            }
            if (onSuccess) onSuccess();
          } catch (err: any) {
            console.error('[oauth-listener] exchange error:', err?.message);
          }
        }

        setTimeout(() => {
          try {
            server.close();
          } catch {}
          if (activeServer === server) activeServer = null;
        }, 1500);
      } else {
        res.writeHead(404).end();
      }
    } catch {
      res.writeHead(500).end();
    }
  });

  server.on('error', (err: any) => {
    console.log('[oauth-listener] local server notice (handled):', err?.message);
  });

  try {
    server.listen(3000, '127.0.0.1', () => {
      console.log('[oauth-listener] Listening on http://127.0.0.1:3000/callback');
    });
    activeServer = server;
  } catch (err: any) {
    console.log('[oauth-listener] Could not bind port 3000:', err?.message);
  }

  // Auto-close after 3 minutes to conserve resources
  setTimeout(() => {
    try {
      server.close();
    } catch {}
    if (activeServer === server) activeServer = null;
  }, 180_000);
}
