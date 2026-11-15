// Renders the original app emblem (assets/scenes.js -> emblemSvg) to build/icon.ico (256/128/64/48/32/16),
// build/icon.png and assets/icon.png. No extra dependencies: Electron itself rasterises the SVG.
//   npx electron tools/make-icon.js        (npm run icon)
import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { emblemSvg } from '../assets/scenes.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIZES = [256, 128, 64, 48, 32, 16];

/** ICO container with PNG-compressed images (supported since Windows Vista). */
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;
  pngs.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o); dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2); dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8); dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...pngs.map(p => p.data)]);
}

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 256, height: 256, show: false, frame: false, transparent: true, useContentSize: true, webPreferences: { offscreen: true } });
  const html = `<html><body style="margin:0;background:transparent;overflow:hidden">${emblemSvg(256)}</body></html>`;
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise(r => setTimeout(r, 400));
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: 256, height: 256 });
  const base = img.resize({ width: 256, height: 256, quality: 'best' });
  const pngs = SIZES.map(size => ({ size, data: (size === 256 ? base : base.resize({ width: size, height: size, quality: 'best' })).toPNG() }));
  fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'build', 'icon.ico'), buildIco(pngs));
  fs.writeFileSync(path.join(ROOT, 'build', 'icon.png'), pngs[0].data);
  fs.writeFileSync(path.join(ROOT, 'assets', 'icon.png'), pngs[0].data);
  fs.writeFileSync(path.join(ROOT, 'assets', 'icon.svg'), emblemSvg(256));
  console.log(`icon written: build/icon.ico (${SIZES.join(', ')} px), build/icon.png, assets/icon.png, assets/icon.svg`);
  app.exit(0);
});
