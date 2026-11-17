import { app, BrowserWindow, session, shell } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerIpc } from '../ipc/handlers.js';
import { checkForUpdates, initUpdater } from '../updater/updater.js';
import { reportDesktopError } from '../updater/telemetry.js';
import { APP_ORIGIN, registerSchemePrivileges, serveRenderer } from '../security/protocol.js';

const here = dirname(fileURLToPath(import.meta.url));
registerSchemePrivileges();

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.exit(0);
}

app.setAsDefaultProtocolClient('dentsweb');
app.setAsDefaultProtocolClient('dentweb');

// Performance & GPU rasterization optimizations
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-accelerated-video-decode');

// CI containers run as root, where Chromium refuses its sandbox. Honoured only for unpackaged test runs.
if (!app.isPackaged && (process.env.DENTSWEB_TEST_NO_SANDBOX === '1' || process.env.DENTWEB_TEST_NO_SANDBOX === '1')) app.commandLine.appendSwitch('no-sandbox');
else app.enableSandbox();

const EXTERNAL_ALLOW = [
  /^https:\/\/(www\.)?dentsweb\.(my\.id|studio)\//,
  /^https:\/\/(www\.)?dentweb\.studio\//,
  /^https:\/\/([a-z0-9-]+\.)?anthropic\.com\//,
  /^https:\/\/([a-z0-9-]+\.)?claude\.(ai|com)\//,
];

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1024,
    minHeight: 680,
    title: 'DENTSWEB STUDIO',
    backgroundColor: '#141210',
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 16, y: 14 } : undefined,
    webPreferences: {
      preload: join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (EXTERNAL_ALLOW.some((r) => r.test(url))) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(`${APP_ORIGIN}/`)) e.preventDefault();
  });
  win.webContents.on('will-attach-webview', (e) => e.preventDefault());
  void win.loadURL(`${APP_ORIGIN}/index.html`);
  return win;
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  serveRenderer(join(here, '..', 'renderer'));
  registerIpc();
  initUpdater();
  const win = createWindow();
  win.webContents.once('did-finish-load', () => void checkForUpdates());
  app.on('activate', () => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length === 0) {
      createWindow();
    } else {
      const [w] = windows;
      if (w) {
        if (w.isMinimized()) w.restore();
        w.show();
        w.focus();
      }
    }
  });
});

process.on('uncaughtException', (e) => reportDesktopError(e));
process.on('unhandledRejection', (e) => reportDesktopError(e));

app.on('second-instance', () => {
  const [w] = BrowserWindow.getAllWindows();
  if (w) {
    if (w.isMinimized()) w.restore();
    w.show();
    w.focus();
  }
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
