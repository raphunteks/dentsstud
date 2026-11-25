import { createServer, type Server } from 'node:http';
import { app, BrowserWindow } from 'electron';
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
      const url = new URL(req.url ?? '/', 'http://127.0.0.1:3000');
      if (url.pathname === '/callback') {
        let code = url.searchParams.get('code') ?? '';
        let state = url.searchParams.get('state') ?? undefined;

        if (code.includes('#')) {
          const parts = code.split('#');
          code = parts[0]!;
          if (!state && parts[1]) state = parts[1];
        }

        let exchangeOk = false;
        let exchangeError = '';

        if (code) {
          try {
            await request(
              'GET',
              `/ai/connections/callback?code=${encodeURIComponent(code)}${state ? `&state=${encodeURIComponent(state)}` : ''}`
            );
            exchangeOk = true;
          } catch (err: any) {
            exchangeError = err?.message ?? 'Gagal menukar kode otorisasi';
            console.error('[oauth-listener] exchange error:', exchangeError);
          }
        } else {
          exchangeError = 'Kode otorisasi tidak ditemukan';
        }

        res.writeHead(exchangeOk ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' });
        if (exchangeOk) {
          res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>DENTSWEB STUDIO - Terhubung</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #141210; color: #f4efe5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #1c1917; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 40px; text-align: center; max-width: 440px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
    h2 { color: #22c55e; margin-top: 0; font-size: 22px; }
    p { color: #a8a29e; font-size: 14px; line-height: 1.6; }
    .btn { display: inline-block; margin-top: 20px; background: #e09322; color: #141210; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 10px; text-decoration: none; }
  </style>
  <script>
    setTimeout(() => { try { window.close(); } catch (e) {} }, 1800);
  </script>
</head>
<body>
  <div class="card">
    <h2>✓ Berhasil Terhubung!</h2>
    <p>Otorisasi Claude AI selesai. Anda dapat kembali ke aplikasi DENTSWEB STUDIO.</p>
    <a href="dentsweb://oauth-success" class="btn">Buka DENTSWEB STUDIO</a>
  </div>
</body>
</html>`);
          const win = BrowserWindow.getAllWindows()[0];
          if (win) {
            if (process.platform === 'darwin') {
              app.dock?.show();
              app.focus({ steal: true });
            }
            if (win.isMinimized()) win.restore();
            win.show();
            win.focus();
            win.webContents.send('dentsweb:event', { channel: 'claude:connected', data: { status: 'CONNECTED' } });
          }
          if (onSuccess) onSuccess();
        } else {
          res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>DENTSWEB STUDIO - Gagal Terhubung</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #141210; color: #f4efe5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #1c1917; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 40px; text-align: center; max-width: 440px; }
    h2 { color: #ef4444; margin-top: 0; font-size: 22px; }
    p { color: #a8a29e; font-size: 14px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Gagal Menghubungkan</h2>
    <p>${exchangeError.replace(/[<>&"]/g, '')}</p>
  </div>
</body>
</html>`);
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
    console.log('[oauth-listener] Could not bind 127.0.0.1:3000:', err?.message);
  }

  // Auto-close after 3 minutes to conserve resources
  setTimeout(() => {
    try {
      server.close();
    } catch {}
    if (activeServer === server) activeServer = null;
  }, 180_000);
}
