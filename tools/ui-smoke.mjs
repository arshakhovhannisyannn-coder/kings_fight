// Automated UI smoke test (developer tool):
//   npx electron tools/ui-smoke.mjs                 everything (screens, input, tutorial, settings, full battles vs all levels)
//   npx electron tools/ui-smoke.mjs easy,hard       full battles only against these levels
//   npx electron tools/ui-smoke.mjs --quick         screens and input checks only (no full battles)
//   npx electron tools/ui-smoke.mjs --battles=10    extra: 10 consecutive fast battles + leak check
// Opens the real app in a hidden Electron window, drives it like a user (clicks, drag & drop, hotkeys),
// saves screenshots to docs/screenshots and fails on any console error or warning.
import { app, BrowserWindow, protocol, net, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'docs', 'screenshots');
const argv = process.argv.slice(2);
const quick = argv.includes('--quick');
const leakBattles = Number((argv.find(a => a.startsWith('--battles=')) || '').split('=')[1] || 0);
const size = (argv.find(a => a.startsWith('--size=')) || '--size=1366x768').split('=')[1].split('x').map(Number);
const levels = (argv.find(a => /^(easy|medium|hard)(,|$)/.test(a)) || 'easy,medium,hard').split(',');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'arq-smoke-')));
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
// Default: offscreen rendering (works without a visible desktop, e.g. a locked screen; a plain hidden window
// would drop mouse input). --visible shows a real window instead.
const VISIBLE = argv.includes('--visible');
const errors = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DECK = "['spearman','archer','slinger','cavalry','cataphract','shieldbearer','vahagn','ararat']";

app.whenReady().then(async () => {
  protocol.handle('app', (req) => net.fetch(pathToFileURL(path.join(ROOT, decodeURIComponent(new URL(req.url).pathname))).toString()));
  const saveFile = path.join(app.getPath('userData'), 'save.json');
  ipcMain.handle('save:load', () => { try { return fs.readFileSync(saveFile, 'utf8'); } catch { return null; } });
  ipcMain.handle('save:write', (_e, json) => { fs.writeFileSync(saveFile, String(json)); return true; });
  ipcMain.handle('app:quit', () => true);
  ipcMain.handle('app:fullscreen', () => true);
  const win = new BrowserWindow({ width: size[0], height: size[1], useContentSize: true, show: VISIBLE, webPreferences: { preload: path.join(ROOT, 'src', 'electron', 'preload.cjs'), backgroundThrottling: false, offscreen: !VISIBLE } });
  // synthetic mouse input is dropped when the window is hidden or covered by another window
  if (VISIBLE) { win.setAlwaysOnTop(true); win.show(); win.focus(); win.moveTop(); } else win.webContents.setFrameRate(60);
  win.webContents.on('console-message', (_e, level, message) => { if (level >= 2) errors.push(message); if (level >= 2 || process.env.VERBOSE) console.log('[console]', message); });
  win.webContents.on('render-process-gone', (_e, d) => errors.push('renderer gone: ' + d.reason));
  const js = (code) => win.webContents.executeJavaScript(code, true);
  const shot = async (name) => { fs.mkdirSync(SHOTS, { recursive: true }); fs.writeFileSync(path.join(SHOTS, name + '.png'), (await win.webContents.capturePage()).toPNG()); };
  const check = (ok, msg) => { if (!ok) { errors.push(msg); console.log('  FAIL:', msg); } return ok; };
  const screen = () => js('document.getElementById("app").dataset.screen');
  const waitFor = async (cond, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await js(cond)) return true; await sleep(60); } return false; };
  const key = async (keyCode) => { for (const type of ['keyDown', 'char', 'keyUp']) { if (type === 'char' && keyCode.length > 1) continue; win.webContents.sendInputEvent({ type, keyCode }); } await sleep(60); };
  const mouse = (type, x, y, extra = {}) => win.webContents.sendInputEvent({ type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1, ...extra });
  const rect = (sel) => js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; })()`);
  const B = 'document.querySelector(".screen.battle").__battle';

  await win.loadURL('app://game/src/ui/index.html');
  await sleep(700);
  console.log('title:', await js('document.title'), '| first screen:', await screen(), '| window:', size.join('x'));

  // ---- first launch: animated intro, skippable by any key; no sound before the first gesture ----
  check(await screen() === 'splash', 'first launch did not show the intro');
  check(await js('import("./audio.js").then(m => m.audio.ready)') === false, 'audio context exists before the first user gesture');
  await shot('00_intro');
  await key('Space');
  await sleep(300);
  check(await screen() === 'menu', 'the intro was not skipped by a key');
  check(await js('import("./audio.js").then(m => m.audio.ready)') === true, 'audio did not start after the first key press');
  check(/v\d+\.\d+/.test(await js('document.querySelector(".version").textContent')), 'version label missing in the menu');
  await sleep(700);
  await shot('01_menu');

  // ---- static screens ----
  for (const [name, file, sel] of [['campaign', '02_campaign_map', '.map-node'], ['howto', '13_howto', '.slide'], ['history', '04_collection', '.codex-entry.locked'],
    ['stats', '14_statistics', '.stat-tile'], ['settings', '05_settings', '.slider-row'], ['free', '06_free_battle', '.choice']]) {
    await js(`window.__app.go('${name}')`); await sleep(300);
    check(await js(`!!document.querySelector('${sel}')`), `screen ${name}: ${sel} not found`);
    await shot(file);
  }
  await js(`window.__app.go('intro', { battleId: '1-1' })`); await sleep(300); await shot('03_battle_intro');
  await js(`window.__app.go('deck', { demo: true })`); await sleep(300); await shot('07_deck_editor');
  await js(`document.querySelector('.card .info-btn').click()`); await sleep(250); await shot('08_card_info');
  await key('Escape');
  check(!(await js('!!document.querySelector(".modal")')), 'Esc did not close the card info');
  // no emoji on the main screens
  for (const name of ['menu', 'campaign', 'howto', 'history', 'stats', 'settings', 'free']) {
    await js(`window.__app.go('${name}')`); await sleep(120);
    const bad = await js(`(document.getElementById('app').innerText.match(/[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{FE0F}]/gu) || []).join('')`);
    check(!bad, `emoji left on screen ${name}: ${bad}`);
  }

  // ---- settings: toggles, sliders, mute hotkey, save/load round trip ----
  await js(`window.__app.go('settings')`); await sleep(200);
  await js(`document.querySelector('input[data-key="reduceMotion"]').click()`); await sleep(150);
  check(await js('document.body.classList.contains("reduce-motion") && window.__app.profile.settings.reduceMotion'), 'reduce-motion toggle did not apply');
  await js(`document.querySelector('input[data-key="reduceMotion"]').click()`); await sleep(150);
  await js(`document.querySelector('input[data-key="showAiPanel"]').click()`); await sleep(120);
  check(await js('window.__app.profile.settings.showAiPanel === false'), 'AI panel toggle did not apply');
  await js(`document.querySelector('input[data-key="showAiPanel"]').click()`); await sleep(120);
  await js(`(() => { const r = document.querySelector('input[data-key="volMusic"]'); r.value = 30; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  check(Math.abs(await js('window.__app.profile.settings.volMusic') - 0.3) < 1e-6, 'music volume slider did not apply');
  await key('M'); await sleep(120);
  check(await js('window.__app.profile.settings.muted === true && document.querySelector(\'input[data-key="muted"]\').checked'), 'M hotkey did not mute');
  await key('M'); await sleep(120);
  check(await js('window.__app.profile.settings.muted === false'), 'M hotkey did not unmute');
  await js(`document.querySelector('.choice[data-key="animSpeed"][data-value="fast"]').click()`); await sleep(150);
  await js(`document.querySelector('.choice[data-key="hardMs"][data-value="1000"]').click()`); await sleep(150);
  const saved = JSON.parse(await js('window.saveAPI.load()'));
  console.log('settings saved:', JSON.stringify({ v: saved.version, anim: saved.settings.animSpeed, music: saved.settings.volMusic, intro: saved.introSeen }));
  check(saved.version === 3 && saved.settings.animSpeed === 'fast' && saved.settings.hardMs === 1000 && saved.introSeen === true, 'save/load failed');

  // ---- tutorial 1-1: every step must be performed ----
  await js(`window.__app.profile.settings.animSpeed = 'normal'`);
  await js(`window.__app.go('intro', { battleId: '1-1' })`); await sleep(200);
  await js(`document.querySelector('.btn.primary.big').click()`); await sleep(900);
  const tut = await js(`({ scr: document.getElementById('app').dataset.screen, step: ${B}.tutorialStep, timer: document.querySelector('.timer-num').textContent, ready: document.querySelector('.end-turn').disabled, text: document.querySelector('.callout p')?.textContent })`);
  console.log('tutorial 1-1:', JSON.stringify(tut));
  check(tut.scr === 'battle' && tut.step === 'hand' && tut.timer === '∞' && tut.ready === true && !!tut.text, 'tutorial did not start on the "hand" step with the round locked');
  await shot('12_tutorial');
  await key('Space'); await sleep(150);
  check(await js(`${B}.phase === 'plan' && !${B}.ending`), 'tutorial: Space ended the round before the "ready" step');
  await key('1'); await sleep(200);
  check(await js(`${B}.tutorialStep`) === 'cell', 'tutorial: selecting a card (hotkey 1) did not advance to the "cell" step');
  await key('Escape'); await sleep(200);
  check(await js(`${B}.tutorialStep`) === 'hand', 'tutorial: cancelling the selection did not return to the "hand" step');
  await js(`document.querySelector('.hand .card.glow').click()`); await sleep(200);
  await js(`document.querySelector('.cell.target').click()`);
  check(await waitFor(`${B}.tutorialStep === 'gold' && !${B}.busy`), 'tutorial: placing a card did not advance to the "gold" step');
  await js(`document.querySelector('.callout-next').click()`); await sleep(200);
  check(await js(`${B}.tutorialStep`) === 'ready' && !(await js(`document.querySelector('.end-turn').disabled`)), 'tutorial: "ready" step not reached / button still locked');
  await key('Space');
  check(await waitFor(`${B}.game.round === 2 && ${B}.phase === 'plan' && ${B}.tutorialStep === 'goal'`, 15000), 'tutorial: the first round did not finish with the "goal" step');
  await js(`document.querySelector('.callout-next').click()`); await sleep(150);
  check(await js(`${B}.tutorialStep`) === 'ai', 'tutorial: "ai" step not reached');
  await js(`document.querySelector('.callout-next').click()`); await sleep(150);
  await js(`document.querySelector('.callout-next').click()`); await sleep(150);
  check(await js(`${B}.tutorialStep === null && window.__app.profile.tutorialDone === true`), 'tutorial did not finish');

  // ---- battle input: hotkeys, cancel, affordability, preview, drag & drop, invalid drop ----
  await js(`window.__app.go('battle', { mode: 'free', playerDeck: ${DECK}, aiDeck: ${DECK}, aiLevel: 'hard', timer: 0, seed: 11 })`);
  await sleep(900);
  check(await js(`document.querySelectorAll('.hand .card .hotkey').length === 4 && document.querySelectorAll('.pips i').length === 3 && /\\+\\d/.test(document.querySelector('.income').textContent)`), 'hand hotkey badges / pips / income label missing');
  check(await js(`document.querySelectorAll('.hand .card.glow').length > 0 && document.querySelectorAll('.hand .card .missing').length === ${B}.game.hands[0].filter(id => document.querySelector('.hand .card[data-card="' + id + '"] .cost').textContent > ${B}.game.gold[0]).length`), 'affordability glow / missing-gold label not shown');
  check(await js(`document.querySelectorAll('.ent svg.sprite').length === 6 && !document.querySelector('.ai-marker') && document.querySelector('.reveal-row').hidden`), 'towers have no sprites or AI info is visible before the reveal');
  const glowIdx = await js(`[...document.querySelectorAll('.hand .card')].findIndex(c => c.classList.contains('glow') && !['vahagn','ararat'].includes(c.dataset.card))`);
  await key(String(glowIdx + 1)); await sleep(150);
  check(await js(`${B}.selected`) === glowIdx, `hotkey ${glowIdx + 1} did not select the card`);
  check(await js(`document.querySelectorAll('.cell.target').length`) === 21, 'placement zone is not highlighted while a card is selected');
  const cell53 = await rect('.cell[data-r="7"][data-c="3"]');
  mouse('mouseMove', cell53.x, cell53.y); await sleep(200);
  const pv = await js(`({ ghost: !document.querySelector('.ent.ghost').hidden, path: !!document.querySelector('.path-layer polyline'), range: document.querySelectorAll('.cell.range').length })`);
  console.log('placement preview:', JSON.stringify(pv));
  check(pv.ghost && pv.path && pv.range > 0, 'placement preview (ghost / path arrow / range) missing');
  await shot('15_planning_preview');
  win.webContents.sendInputEvent({ type: 'mouseDown', x: Math.round(cell53.x), y: Math.round(cell53.y), button: 'right', clickCount: 1 });
  win.webContents.sendInputEvent({ type: 'mouseUp', x: Math.round(cell53.x), y: Math.round(cell53.y), button: 'right', clickCount: 1 });
  await sleep(150);
  check(await js(`${B}.selected`) === -1, 'right-click did not cancel the selection');
  await key(String(glowIdx + 1)); await key('Escape'); await sleep(100);
  check(await js(`${B}.selected`) === -1, 'Esc did not cancel the selection');
  // drag & drop onto an illegal cell (enemy half) -> rejected, card returns
  const card = await rect(`.hand .card:nth-child(${glowIdx + 1})`);
  const bad = await rect('.cell[data-r="2"][data-c="3"]');
  mouse('mouseDown', card.x, card.y); await sleep(40);
  for (let i = 1; i <= 6; i++) { mouse('mouseMove', card.x + (bad.x - card.x) * i / 6, card.y + (bad.y - card.y) * i / 6); await sleep(30); }
  check(await js(`!!document.querySelector('.drag-card') && document.querySelector('.cell[data-r="2"][data-c="3"]').classList.contains('bad')`), 'drag ghost / invalid-cell outline missing while dragging');
  mouse('mouseUp', bad.x, bad.y); await sleep(450);
  check(await js(`${B}.game.cardsPlayed[0] === 0 && !document.querySelector('.drag-card')`), 'drop on an illegal cell was not rejected cleanly');
  // drag & drop onto a legal cell
  const good = await rect('.cell[data-r="7"][data-c="4"]');
  await key('Escape');
  mouse('mouseDown', card.x, card.y); await sleep(40);
  for (let i = 1; i <= 6; i++) { mouse('mouseMove', card.x + (good.x - card.x) * i / 6, card.y + (good.y - card.y) * i / 6); await sleep(30); }
  check(await js(`!document.querySelector('.ent.ghost').hidden`), 'no placement ghost while dragging over a legal cell');
  mouse('mouseUp', good.x, good.y);
  check(await waitFor(`${B}.game.cardsPlayed[0] === 1 && !${B}.busy`), 'drag & drop did not play the card');
  check(await js(`document.querySelectorAll('.pips i.on').length === 1 && !!${B}.game.entities.find(e => e.side === 0 && e.row === 7 && e.col === 4)`), 'dropped unit is not on the board / pip not filled');
  // info of a hovered unit with the I key
  mouse('mouseMove', good.x, good.y); await sleep(150); await key('I'); await sleep(200);
  check(await js('!!document.querySelector(".modal .card-info")'), 'I hotkey did not open the info of the hovered unit');
  await key('Escape');
  // Space ends planning; the AI reveal flips cards and shows the top-3 markers; the panel has the chart
  await key('Space');
  check(await waitFor(`!!document.querySelector('.reveal-row .flip.open') || ${B}.phase === 'battle'`, 12000), 'Space did not end the planning phase');
  // (when the AI saves its gold and plays no card there is nothing to mark; the log says so)
  check(await waitFor(`!!document.querySelector('.ai-marker.chosen') || [...document.querySelectorAll('.log-line.foe')].some(l => l.textContent.includes('քարտ չխաղաց'))`, 12000), 'top-3 AI markers were not drawn after the reveal');
  await shot('16_battle_effects');
  check(await waitFor(`${B}.game.round === 2 && ${B}.phase === 'plan'`, 15000), 'round 1 did not finish');
  check(await js(`!!document.querySelector('.win-chart svg') && !!document.querySelector('.ai-explain') && document.querySelectorAll('.ai-top li').length >= 1`), 'AI panel: chart / explanation / candidates missing');
  await js(`document.querySelector('.how-btn').click()`); await sleep(250);
  check(await js(`document.querySelectorAll('.explainer .diagram svg').length === 3`), 'AI explainer dialog has no diagrams');
  await shot('17_ai_explainer');
  await key('Escape');

  // ---- full battles: click cards/cells like a user ----
  await js(`window.__app.profile.settings.animSpeed = 'fast'`);
  for (const level of quick ? [] : levels) {
    const t0 = Date.now();
    await js(`window.__app.go('battle', { mode: 'free', playerDeck: ${DECK}, aiDeck: ${DECK}, aiLevel: '${level}', timer: ${level === 'easy' ? 5 : 0}, seed: 5 })`);
    let shots = 0, lastRound = 0, froze = 0;
    for (;;) {
      await sleep(120);
      const st = await js(`(() => {
        const scr = document.getElementById('app').dataset.screen;
        if (scr !== 'battle') return { scr };
        const b = ${B};
        if (b.phase === 'plan' && !b.ending && !b.busy) {
          const cards = [...document.querySelectorAll('.hand .card.glow')];
          const sel = document.querySelector('.hand .card.selected');
          if (sel) {
            const targets = [...document.querySelectorAll('.cell.target')];
            if (targets.length) targets[Math.floor(Math.random() * targets.length)].click();
            else document.querySelectorAll('.cell')[7].click();
          } else if (cards.length && b.game.cardsPlayed[0] < 3) cards[Math.floor(Math.random() * cards.length)].click();
          else document.querySelector('.end-turn').click();
        }
        return { scr, phase: b.phase, round: b.game.round, panel: document.querySelector('.ai-explain')?.textContent || '', top: document.querySelectorAll('.ai-top li').length, chart: !!document.querySelector('.win-chart polyline') };
      })()`);
      if (st.scr !== 'battle') break;
      if (st.round !== lastRound) { lastRound = st.round; froze = 0; } else if (++froze > 600) { errors.push(`battle stuck at round ${st.round} phase ${st.phase}`); break; }
      if (st.round === 6 && shots === 0 && st.phase === 'plan' && st.panel) {
        shots++; await shot(`09_battle_${level}`);
        console.log(`  [${level}] AI panel: top=${st.top} chart=${st.chart} | ${st.panel}`);
        check(st.top >= 1 && /[Ա-և]/.test(st.panel) && st.chart, `AI panel is incomplete (${level})`);
      }
    }
    await sleep(900);
    const res = await js(`({ scr: document.getElementById('app').dataset.screen, title: document.querySelector('.result-card h1')?.textContent, meta: document.querySelector('.result-meta')?.textContent, stats: document.querySelectorAll('.rstat').length })`);
    console.log(`battle vs ${level}: ${res.title} | ${res.meta} | ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    check(res.scr === 'result' && res.stats === 6, `battle vs ${level} did not reach the result screen`);
    if (level === levels[levels.length - 1]) { await sleep(1500); await shot('10_result'); }
  }
  if (!quick) {
    const st = await js('window.__app.profile.stats');
    console.log('statistics after the battles:', JSON.stringify(st.byLevel), 'battles:', st.battles);
    check(st.battles >= levels.length, 'battle statistics were not recorded');
  }

  // ---- planning timer: with a 1-second timer and no input the round must end by itself (gold is kept) ----
  await js(`window.__app.go('battle', { mode: 'free', playerDeck: ${DECK}, aiDeck: ${DECK}, aiLevel: 'easy', timer: 1, seed: 9 })`);
  await waitFor(`${B}.game.round >= 2 && ${B}.phase === 'plan'`, 12000);
  const tm = await js(`(() => { const b = ${B}; return { round: b.game.round, gold: b.game.gold[0], log: document.querySelector('.log').textContent.includes('Պլանավորման ժամանակն ավարտվեց') }; })()`);
  console.log('timer expiry:', JSON.stringify(tm));
  check(tm.round >= 2 && tm.gold >= 7 && tm.log, 'planning timer did not end the planning / gold not kept');

  // ---- no leaks: consecutive battles must not leave timers, listeners, DOM nodes or workers behind ----
  if (leakBattles > 0) {
    const count = () => js(`({ nodes: document.querySelectorAll('*').length, body: document.body.children.length })`);
    await js(`window.__app.go('menu')`); await sleep(300);
    const before = await count();
    for (let i = 0; i < leakBattles; i++) {
      await js(`window.__app.go('battle', { mode: 'free', playerDeck: ${DECK}, aiDeck: ${DECK}, aiLevel: 'medium', timer: 0, seed: ${20 + i} })`);
      for (let r = 0; r < 3; r++) {
        await js(`(() => { const b = ${B}; b.select(0); const c = document.querySelector('.cell.target'); if (c) c.click(); })()`);
        await waitFor(`!${B}.busy`); await js(`${B}.endPlanning(false)`);
        await waitFor(`document.getElementById('app').dataset.screen !== 'battle' || (${B}.phase === 'plan' && !${B}.ending)`, 15000);
        if (await screen() !== 'battle') break;
      }
      await js(`window.__app.go('menu')`); await sleep(150);
    }
    await sleep(1200);
    const after = await count();
    console.log(`leak check after ${leakBattles} battles: DOM nodes ${before.nodes} -> ${after.nodes}, body children ${before.body} -> ${after.body}`);
    check(after.nodes <= before.nodes + 5 && after.body === before.body, 'DOM nodes leaked across battles');
  }

  // ---- campaign flow: win 1-1 artificially through the result screen -> unlock + stars are saved ----
  await js(`window.__app.profile.settings.animSpeed = 'normal'`);
  await js(`window.__app.go('result', { mode: 'campaign', battleId: '1-1', winner: 0, reason: 'king', starsWon: 3, level: 'easy', towers: [3, 0], rounds: 12, stats: { unitsPlaced: 14, damage: 96, goldSpent: 41 }, replay: {} })`);
  check(await waitFor(`document.querySelectorAll('.result-stars .star.on').length === 3 && !!document.querySelector('.unlock-flip.open')`, 6000), 'result screen: stars / unlock reveal did not animate');
  await sleep(600); await shot('11_campaign_win');
  const prof = JSON.parse(await js('window.saveAPI.load()'));
  console.log('campaign save:', JSON.stringify(prof.stars), 'unlocked:', prof.unlocked.join(','));
  check(prof.stars['1-1'] === 3 && prof.unlocked.includes('horn'), 'campaign unlock/save failed');
  await js(`window.__app.go('campaign')`); await sleep(300); await shot('02_campaign_map');
  check(await js(`document.querySelectorAll('.map-node').length === 7 && document.querySelectorAll('.battle-node').length === 3`), 'campaign map nodes missing');

  console.log(errors.length ? `FAILED with ${errors.length} error(s):\n` + errors.join('\n') : 'UI SMOKE TEST PASSED (no console errors)');
  app.exit(errors.length ? 1 : 0);
});
