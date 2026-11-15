// Electron main process. Serves the app through a custom "app://" protocol so ES modules and
// module Web Workers load without restrictions, and stores the save file in userData.
import { app, BrowserWindow, protocol, net, ipcMain, Menu } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SAVE_FILE = () => path.join(app.getPath('userData'), 'save.json');
const ICON = path.join(ROOT, 'assets', 'icon.png');
const SELFTEST = !!process.env.ARQ_SELFTEST;

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

let mainWin = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1366, height: 800, minWidth: 1024, minHeight: 640, show: false,
    title: 'Արքաների Մարտ', backgroundColor: '#f3e6dc', autoHideMenuBar: true,
    icon: fs.existsSync(ICON) ? ICON : undefined,
    webPreferences: { preload: path.join(ROOT, 'src', 'electron', 'preload.cjs'), contextIsolation: true, nodeIntegration: false },
  });
  mainWin = win;
  Menu.setApplicationMenu(null);
  win.setMenuBarVisibility(false);
  // the page title must not replace the window title
  win.on('page-title-updated', (e) => e.preventDefault());
  win.once('ready-to-show', () => { if (!SELFTEST) { win.maximize(); win.show(); } });
  // F11 toggles fullscreen (there is no application menu to provide the accelerator)
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); event.preventDefault(); }
  });
  const notify = () => { if (!win.isDestroyed()) win.webContents.send('app:fullscreen-changed', win.isFullScreen()); };
  win.on('enter-full-screen', notify);
  win.on('leave-full-screen', notify);
  win.on('closed', () => { if (mainWin === win) mainWin = null; });
  win.loadURL('app://game/src/ui/index.html');
  if (process.env.ARQ_DEVTOOLS) win.webContents.openDevTools({ mode: 'detach' });
  if (SELFTEST) selfTest(win);
}

/** Packaging self-test (ARQ_SELFTEST=1): checks that the UI, the fonts, the art and the AI Web Worker load, then quits. */
function selfTest(win) {
  const errors = [];
  win.webContents.on('console-message', (_e, level, message) => { if (level >= 2) errors.push(message); });
  win.webContents.once('did-finish-load', async () => {
    const out = path.join(app.getPath('temp'), 'arqaneri-selftest.json');
    try {
      const result = await win.webContents.executeJavaScript(`(async () => {
        await new Promise(r => setTimeout(r, 500));
        const app = window.__app;
        app.go('battle', { mode: 'free', playerDeck: app.profile.deck, aiDeck: app.profile.deck, aiLevel: 'hard', timer: 0, seed: 3 });
        const b = document.querySelector('.screen.battle').__battle;
        b.select(0);
        const cell = document.querySelector('.cell.target');
        if (cell) cell.click();
        for (let i = 0; i < 100 && b.busy; i++) await new Promise(r => setTimeout(r, 50));
        b.endPlayerTurn(false);
        for (let i = 0; i < 300 && !(document.querySelector('.ai-explain') && b.game.round >= 2 && b.phase === 'plan'); i++) await new Promise(r => setTimeout(r, 100));
        await document.fonts.ready;
        return { screen: document.getElementById('app').dataset.screen, round: b.game.round, version: app.version,
          aiPanel: !!document.querySelector('.ai-explain'), sprites: document.querySelectorAll('.ent svg.sprite').length,
          font: document.fonts.check('16px "Noto Sans Armenian"', 'Ա') };
      })()`, true);
      const ok = result.screen === 'battle' && result.round >= 2 && result.aiPanel && result.font && result.sprites >= 6 && errors.length === 0;
      fs.writeFileSync(out, JSON.stringify({ ok, result, errors, icon: fs.existsSync(ICON) }));
      app.exit(ok ? 0 : 1);
    } catch (e) {
      fs.writeFileSync(out, JSON.stringify({ ok: false, error: String(e), errors }));
      app.exit(1);
    }
  });
}

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const rel = decodeURIComponent(new URL(request.url).pathname);
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  ipcMain.handle('save:load', () => {
    try { return fs.readFileSync(SAVE_FILE(), 'utf8'); } catch { return null; }
  });
  ipcMain.handle('save:write', (_e, json) => {
    fs.mkdirSync(path.dirname(SAVE_FILE()), { recursive: true });
    fs.writeFileSync(SAVE_FILE(), String(json));
    return true;
  });
  ipcMain.handle('app:quit', () => { app.quit(); });
  ipcMain.handle('app:fullscreen', (_e, on) => {
    if (mainWin && !SELFTEST && mainWin.isFullScreen() !== !!on) mainWin.setFullScreen(!!on);
    return true;
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => app.quit());
