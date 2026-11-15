// Copies the Noto Armenian fonts from node_modules into assets/fonts so the game works offline.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'assets', 'fonts');
fs.mkdirSync(out, { recursive: true });
const want = [['noto-sans-armenian', [400, 500, 700]], ['noto-serif-armenian', [500, 700, 900]]];
for (const [family, weights] of want) {
  for (const w of weights) for (const subset of ['armenian', 'latin']) {
    const f = `${family}-${subset}-${w}-normal.woff2`;
    fs.copyFileSync(path.join(root, 'node_modules', '@fontsource', family, 'files', f), path.join(out, f));
  }
}
fs.copyFileSync(path.join(root, 'node_modules', '@fontsource', 'noto-sans-armenian', 'LICENSE'), path.join(out, 'LICENSE-OFL.txt'));
console.log('Fonts copied to assets/fonts');
