import { app, BrowserWindow, session, shell } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerIpc } from '../ipc/handlers.js';
import { checkForUpdates, initUpdater } from '../updater/updater.js';
import { reportDesktopError } from '../updater/telemetry.js';
import { APP_ORIGIN, registerSchemePrivileges, serveRenderer } from '../security/protocol.js';

const here = dirname(fileURLToPath(import.meta.url));
registerSchemePrivileges();

if (!app.requestSingleInstanceLock()) app.quit();
app.setAsDefaultProtocolClient('dentweb');
// CI containers run as root, where Chromium refuses its sandbox. Honoured only for unpackaged test runs.
if (!app.isPackaged && process.env.DENTWEB_TEST_NO_SANDBOX === '1') app.commandLine.appendSwitch('no-sandbox');
else app.enableSandbox();

const EXTERNAL_ALLOW = [/^https:\/\/(www\.)?dentweb\.studio\//, /^https:\/\/console\.anthropic\.com\//, /^https:\/\/docs\.claude\.com\//, /^https:\/\/claude\.com\//];

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1024,
    minHeight: 680,
    title: 'DENTWEB STUDIO',
    backgroundColor: '#141210',
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
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
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

process.on('uncaughtException', (e) => reportDesktopError(e));
process.on('unhandledRejection', (e) => reportDesktopError(e));

app.on('second-instance', () => {
  const [w] = BrowserWindow.getAllWindows();
  if (w) {
    if (w.isMinimized()) w.restore();
    w.focus();
  }
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
