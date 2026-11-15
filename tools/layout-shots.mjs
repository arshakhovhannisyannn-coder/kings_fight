// Developer tool: screenshots of the battle screen at several window sizes (layout check).
//   npx electron tools/layout-shots.mjs <outDir> [1280x720,1920x1080,2560x1440]
import { app, BrowserWindow, protocol, net, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const out = path.resolve(args[0] || 'docs/screenshots');
const sizes = (args[1] || '1280x720,1920x1080,2560x1440').split(',').map(s => s.split('x').map(Number));
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'arq-layout-')));
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
const sleep = ms => new Promise(r => setTimeout(r, ms));
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  protocol.handle('app', (req) => net.fetch(pathToFileURL(path.join(ROOT, decodeURIComponent(new URL(req.url).pathname))).toString()));
  ipcMain.handle('save:load', () => null); ipcMain.handle('save:write', () => true); ipcMain.handle('app:quit', () => true); ipcMain.handle('app:fullscreen', () => true);
  fs.mkdirSync(out, { recursive: true });
  for (const [w, h] of sizes) {
    const win = new BrowserWindow({ width: 1280, height: 720, useContentSize: true, show: true, webPreferences: { preload: path.join(ROOT, 'src', 'electron', 'preload.cjs'), backgroundThrottling: false } });
    const js = (code) => win.webContents.executeJavaScript(code, true);
    await win.loadURL('app://game/src/ui/index.html');
    await sleep(500);
    // the real window cannot be larger than the display, so the viewport size is emulated and scaled to fit
    win.webContents.enableDeviceEmulation({ screenPosition: 'desktop', screenSize: { width: w, height: h }, viewPosition: { x: 0, y: 0 }, viewSize: { width: w, height: h }, deviceScaleFactor: 1, scale: Math.min(1, 1280 / w, 720 / h) });
    await sleep(300);
    await js(`window.__app.profile.introSeen = true; window.__app.profile.settings.muted = true; window.__app.go('battle', { mode: 'free', playerDeck: window.__app.profile.deck, aiDeck: window.__app.profile.deck, aiLevel: 'medium', timer: 0, seed: 5 }); 0`);
    await sleep(1200);
    await js(`(() => { const b = document.querySelector('.screen.battle').__battle; b.select([...document.querySelectorAll('.hand .card')].findIndex(c => c.classList.contains('glow'))); const c = document.querySelector('.cell.target'); if (c) c.click(); })()`);
    await sleep(900);
    await js(`document.querySelector('.screen.battle').__battle.endPlanning(false); 0`);
    await sleep(6500);
    const m = await js(`({ scroll: document.documentElement.scrollHeight > window.innerHeight + 1 || document.documentElement.scrollWidth > window.innerWidth + 1, board: Math.round(document.querySelector('.board').getBoundingClientRect().height), cell: Math.round(document.querySelector('.cell').getBoundingClientRect().width), card: Math.round(document.querySelector('.hand .card').getBoundingClientRect().height), font: getComputedStyle(document.documentElement).fontSize, view: innerWidth + 'x' + innerHeight })`);
    console.log(`${w}x${h}:`, JSON.stringify(m));
    fs.writeFileSync(path.join(out, `layout_${w}x${h}.png`), (await win.webContents.capturePage()).toPNG());
    win.destroy();
  }
  app.exit(0);
});
