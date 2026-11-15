// Battle screen. Every round: PLANNING (timer; the player places cards while the AI thinks in a Web Worker at the
// same time) -> the AI's cards are revealed -> BATTLE (a few ticks in which the units of both sides act, animated).
// All animation, sound and input lives here; the rules are in src/engine and are never changed by the UI.
import { h, cardView, cardBack, showCardInfo, infoForTower, iconEl, ui, btn, attachHover, confirmDialog, isModalOpen, hideTooltip } from '../dom.js';
import { makeConfig, CONFIG, incomeForRound } from '../../data/config.js';
import { CARDS } from '../../data/cards.js';
import { getBattle } from '../../data/campaign.js';
import {
  createGame, playCard, endRound, canPlayCard, cardTargets, isLegalTarget, entityAt, serializeState, starsFor, mixSeed, isWater, areaCells,
  chebyshev, previewPlacement, previewSpell,
} from '../../engine/index.js';
import { LEVEL_HY } from '../../ai/index.js';
import { audio } from '../audio.js';
import { createFx } from '../fx.js';
import { renderAiPanel, showExplainer, aiPanelHeader } from '../aipanel.js';
import { recordBattle } from '../store.js';
import { boardSvg } from '../../../assets/scenes.js';

const SPEED = { slow: 1.7, normal: 1, fast: 0.45 };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const SIDE_HY = ['Դու', 'Հակառակորդը'];

/** Ask the AI for a move in a Web Worker; falls back to the main thread if workers are unavailable. */
function createAiClient() {
  let worker = null, seq = 0;
  const pending = new Map();
  try {
    worker = new Worker(new URL('../../ai/worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.error) p.reject(new Error(e.data.error)); else p.resolve(e.data.result);
    };
    worker.onerror = (e) => { console.warn('AI worker failed, using the main thread', e.message); worker = null; for (const p of pending.values()) p.fallback(); pending.clear(); };
  } catch (e) { worker = null; }
  const direct = async (state, side, level, opts) => {
    const ai = await import('../../ai/index.js');
    const eng = await import('../../engine/index.js');
    return ai.chooseMove(eng.hydrateState(state), side, level, opts);
  };
  return {
    choose(game, side, level, opts) {
      const state = serializeState(game);
      if (!worker) return direct(state, side, level, opts);
      return new Promise((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject, fallback: () => direct(state, side, level, opts).then(resolve, reject) });
        worker.postMessage({ id, state, side, level, opts });
      });
    },
    dispose() { if (worker) worker.terminate(); worker = null; pending.clear(); },
  };
}

export function battleScreen(app, params) {
  const settings = app.profile.settings;
  const speed = SPEED[settings.animSpeed] || 1;
  const reduce = !!settings.reduceMotion;
  const cfg = makeConfig({ turnTimerSeconds: params.timer ?? CONFIG.turnTimerSeconds });
  // the AI is the engine's first planner: it decides from the round-start position, without seeing the player's cards
  const game = createGame({ deckP: params.playerDeck, deckA: params.aiDeck, seed: params.seed || 1, cfg, first: 1, events: true });
  const battle = params.battleId ? getBattle(params.battleId) : null;
  const ai = createAiClient();
  const { cols, rows } = cfg.board;
  const startedAt = performance.now();

  let phase = 'plan';         // 'plan' | 'battle' | 'over'
  let selected = -1;          // selected hand index
  let disposed = false;
  let busy = false;           // a placement animation is running
  let ending = false;         // the planning phase is being ended (button or timeout)
  let aiJob = null;           // promise of the AI's decision for the current round
  let aiReady = false, thinkT0 = 0;
  let timerId = null, timeLeft = 0, lastTickSec = -1;
  let lastReplaced = -1;      // hand slot that just received the "next" card (slide-in animation)
  let pendingHit = null;      // { delay, from } of the attack whose damage events follow
  let lastDeath = null;       // position of the last death (bounty coin starts there)
  let stepSoundTick = -1, tickNo = 0;
  const els = new Map();      // entity id -> DOM element
  const model = new Map();    // entity id -> displayed snapshot
  const timers = new Set();
  const seen = new Map();     // enemy cards seen so far: cardId -> count
  const winHistory = [];      // [{ round, p }] the AI's win-probability estimates
  const stats = { unitsPlaced: 0, damage: 0, goldSpent: 0, cards: [] };

  /** Run fn after ms (immediately when ms <= 0); cancelled when the screen is left. */
  function later(ms, fn) {
    if (ms <= 0) { fn(); return; }
    const id = setTimeout(() => { timers.delete(id); if (!disposed) fn(); }, ms);
    timers.add(id);
  }

  // ---------- static layout ----------
  const cellsEl = h('div.cells');
  const cellEls = [];
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const zone = r >= cfg.zones[0][0] && r <= cfg.zones[0][1] ? '.zone-p' : r >= cfg.zones[1][0] && r <= cfg.zones[1][1] ? '.zone-a' : '';
      const river = r === cfg.board.riverRow ? (isWater(game, r, c) ? '.water' : '.bridge') : '';
      const cell = h(`div.cell${zone}${river}`, { dataset: { r, c } });
      cellEls.push(cell);
      cellsEl.append(cell);
    }
  }
  const layer = h('div.layer');
  const pathLayer = h('div.layer.path-layer');
  const fxLayer = h('div.layer.fx');
  const ghostEl = h('div.ent.ghost', { hidden: true }, h('div.ent-body', {}, h('span.ent-sprite')));
  layer.append(ghostEl);
  const boardEl = h('div.board', {}, h('div.board-art', { html: boardSvg(cfg) }), cellsEl, pathLayer, layer, fxLayer);
  const revealEl = h('div.reveal-row', { hidden: true });
  const tickEl = h('div.tick-label');
  const boardFrame = h('div.board-frame', { style: `--cols: ${cols}; --rows: ${rows};` }, boardEl, revealEl, tickEl);
  const cellAt = (r, c) => cellEls[(r - 1) * cols + (c - 1)];
  const fx = createFx(fxLayer, { cols, rows, speed, reduce });

  const goldEl = h('b.gold-num'), aiGoldEl = h('b.gold-num');
  const goldBox = h('div.gold', {}, iconEl('gold', 'coin'), goldEl), aiGoldBox = h('div.gold', {}, iconEl('gold', 'coin'), aiGoldEl);
  const incomeEl = h('div.income');
  const pipsEl = h('div.pips', { title: 'Այս ռաունդում խաղացված քարտեր (առավելագույնը 3)' });
  const roundEl = h('span.round'), turnEl = h('span.turn-label');
  const timerNum = h('span.timer-num');
  const timerRing = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  timerRing.setAttribute('viewBox', '0 0 44 44'); timerRing.setAttribute('class', 'timer-ring');
  timerRing.innerHTML = '<circle class="bg" cx="22" cy="22" r="19"/><circle class="fg" cx="22" cy="22" r="19" stroke-dasharray="119.4" stroke-dashoffset="0"/>';
  const timerEl = h('div.timer', {}, timerRing, timerNum);
  const endBtn = h('button.btn.primary.end-turn', { onclick: () => endPlanning(false), title: 'Space / Enter' }, ui('swords'), ' Պատրաստ է');
  const handEl = h('div.hand');
  const nextEl = h('div.next-card');
  const hintEl = h('div.hint-bar', { hidden: true });
  const logEl = h('div.log');
  const seenEl = h('div.seen-row');
  const aiBody = h('div.ai-body', {}, h('p.muted', {}, 'Առաջին ռաունդի բացումից հետո այստեղ կերևա AI-ի վերլուծությունը։'));
  const aiPanel = h('details.ai-panel', { open: window.innerWidth >= 1100 },
    h('summary', {}, aiPanelHeader()),
    h('button.btn.small.how-btn', { onclick: () => { audio.sfx('click'); showExplainer(); } }, 'Ինչպե՞ս է աշխատում'),
    aiBody);
  const thinkingEl = h('div.thinking');
  const muteBtn = h('button.btn.ghost.small.mute-btn', { title: 'Ձայն (M)', onclick: () => { app.toggleMute(); drawMute(); } });
  const drawMute = () => muteBtn.replaceChildren(ui(audio.muted ? 'mute' : 'sound'));
  drawMute();
  const meBox = h('div.me-box', {}, h('div.who.me', {}, 'Դու'), goldBox, incomeEl, pipsEl);
  const calloutEl = h('div.callout', { hidden: true });

  const leave = () => app.go(battle ? 'campaign' : 'free', params.freeParams || {});
  const root = h(`div.screen.battle${settings.showAiPanel === false ? '.no-ai' : ''}${reduce ? '.reduce' : ''}`, {},
    h('div.battle-top', {},
      h('button.btn.ghost.small', { onclick: () => { if (phase === 'over') leave(); else confirmDialog('Լքե՞լ մարտը։ Առաջընթացը չի պահպանվի։', 'Լքել', leave); } }, '← Լքել'),
      h('div.battle-title', {}, battle ? `${battle.id} · ${battle.titleHy}` : 'Ազատ մարտ', h('small', {}, ` · AI՝ ${LEVEL_HY[params.aiLevel]}`)),
      h('div.round-box', {}, roundEl, turnEl, muteBtn)),
    h('div.battle-main', {},
      h('aside.side-left', {},
        h('div.enemy-box', {}, h('div.who.foe', {}, 'Հակառակորդ'), aiGoldBox, thinkingEl),
        h('div.log-box', {}, h('h4', {}, 'Մարտի մատյան'), logEl)),
      h('div.board-col', {}, seenEl, h('div.board-wrap', {}, boardFrame), hintEl),
      h('aside.side-right', {}, aiPanel)),
    h('div.battle-bottom', {},
      meBox,
      h('div.hand-wrap', {}, handEl, nextEl),
      h('div.turn-box', {}, timerEl, endBtn)),
    calloutEl);

  // ---------- helpers ----------
  const drain = () => { const evs = game.events; game.events = []; return evs; };
  function log(text, cls = '') {
    logEl.append(h(`div.log-line${cls ? '.' + cls : ''}`, {}, text));
    while (logEl.children.length > 80) logEl.firstChild.remove();
    logEl.scrollTop = logEl.scrollHeight;
  }
  function nameOf(e) { return e.kind === 'tower' ? (e.cardId === 'tower_king' ? 'Արքայի ամրոց' : 'Աշտարակ') : CARDS[e.cardId].nameHy; }
  function showEntityInfo(e) { if (e.kind === 'tower') infoForTower(e); else showCardInfo(e.cardId, e); }
  function pulse(el, cls, ms) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); later(ms, () => el.classList.remove(cls)); }

  function place(el, r, c) { el.style.transform = `translate(${(c - 1) * 100}%, ${(r - 1) * 100}%)`; }
  function paintHp(el, hp, maxHp, kind) {
    const w = `${Math.max(0, Math.min(100, 100 * hp / maxHp))}%`;
    el.querySelector('.hpfill').style.width = w;
    el.querySelector('.hpghost').style.width = w;
    el.querySelector('.e-hp').textContent = hp;
    if (kind === 'tower') {
      const ratio = hp / maxHp;
      el.classList.toggle('dmg1', ratio < 0.66 && ratio >= 0.33);
      el.classList.toggle('dmg2', ratio < 0.33);
    }
  }
  function makeEntityEl(e) {
    const def = CARDS[e.cardId];
    const el = h(`div.ent.side-${e.side}.kind-${e.kind}${def?.type === 'hero' ? (def.enemyOnly ? '.boss' : '.hero') : ''}`, { dataset: { id: e.id } },
      h('div.ent-body', {},
        h('div.ent-ring'),
        iconEl(e.cardId, 'ent-sprite'),
        h('div.dome'),
        h('div.shield-pips'),
        h('div.hpbar', {}, h('div.hpghost'), h('div.hpfill')),
        h('span.e-hp')));
    place(el, e.row, e.col);
    layer.append(el);
    els.set(e.id, el);
    attachHover(el, null, () => { const live = game.entities.find(x => x.id === e.id); if (live) showEntityInfo(live); });
    return el;
  }
  function refreshEntity(id) {
    const m = model.get(id), el = els.get(id);
    if (!m || !el) return;
    place(el, m.row, m.col);
    paintHp(el, m.hp, m.maxHp, m.kind);
    el.classList.toggle('invuln', !!m.invuln);
    el.classList.toggle('fresh', !!m.isNew && m.kind === 'unit');
    const pips = el.querySelector('.shield-pips');
    if (pips.childElementCount !== (m.shield || 0)) pips.replaceChildren(...Array.from({ length: m.shield || 0 }, () => h('i')));
  }
  /** Rebuild the displayed entities from the real state (no animation). */
  function syncAll() {
    const alive = new Set();
    for (const e of game.entities) {
      alive.add(e.id);
      model.set(e.id, { ...e });
      if (!els.has(e.id)) makeEntityEl(e);
      refreshEntity(e.id);
    }
    for (const [id, el] of els) if (!alive.has(id)) { el.remove(); els.delete(id); model.delete(id); }
  }
  function sideColors(side) { return side === 0 ? ['#e08a2e', '#f8cf94', '#fff'] : ['#b02a36', '#ee9aa1', '#fff']; }

  /**
   * Play engine events with animations. During planning (placements) they are quick; in the battle phase the
   * events of one tick overlap (moves are CSS transitions) and each tick lasts about TICK ms, so the units of
   * both sides look like they fight at the same time. Hits of ranged attacks are delayed until the projectile lands.
   */
  async function playEvents(events) {
    const T = 230 * speed;
    const TICK = 1150 * speed;
    let tickStart = 0;
    for (const e of events) {
      if (disposed) return;
      switch (e.t) {
        case 'play': {
          const def = CARDS[e.cardId];
          log(`${SIDE_HY[e.side]}՝ «${def.nameHy}»${e.row ? ` (${e.row},${e.col})` : ''}`, e.side ? 'foe' : 'me');
          pendingHit = null;
          break;
        }
        case 'spawn': {
          model.set(e.e.id, { ...e.e });
          const el = makeEntityEl(e.e);
          refreshEntity(e.e.id);
          pulse(el, 'land', 320 * speed);
          audio.sfx('place');
          later(140 * speed, () => fx.dust(e.e.row, e.e.col));
          await sleep(T * 0.3);
          break;
        }
        case 'tick': {
          if (tickStart) { const left = TICK - (performance.now() - tickStart); if (left > 0) await sleep(left); }
          tickStart = performance.now();
          tickNo++;
          pendingHit = null;
          tickEl.replaceChildren(ui('swords'), ` Մարտ ${e.n + 1}/${e.of}`);
          pulse(tickEl, 'pop', 250);
          break;
        }
        case 'move': {
          const m = model.get(e.id); if (!m) break;
          m.row = e.row; m.col = e.col;
          const el = els.get(e.id);
          if (el) { place(el, m.row, m.col); pulse(el, 'walk', 330 * speed); }
          if (stepSoundTick !== tickNo) { stepSoundTick = tickNo; audio.sfx('step'); }
          pendingHit = null;
          await sleep(T * 0.08);
          break;
        }
        case 'attack': {
          const a = model.get(e.id), t = model.get(e.target);
          if (!a || !t) break;
          const el = els.get(e.id);
          let delay;
          if (e.ranged) {
            const kind = a.kind === 'tower' ? 'bolt' : a.cardId === 'cannon' ? 'ball' : a.cardId === 'slinger' ? 'stone' : 'arrow';
            delay = fx.projectile(a, t, kind, kind === 'ball' ? 260 : 190);
            audio.sfx(kind === 'ball' ? 'cannon' : kind);
            pulse(el, 'shoot', 240 * speed);
          } else {
            if (el) { el.style.setProperty('--dx', `${(t.col - a.col) * 30}%`); el.style.setProperty('--dy', `${(t.row - a.row) * 30}%`); }
            pulse(el, 'lunge', 260 * speed);
            delay = 90 * speed;
            const ang = Math.atan2(t.row - a.row, t.col - a.col) * 180 / Math.PI;
            later(delay, () => { fx.slash(t.row, t.col, ang); audio.sfx('sword'); });
          }
          pendingHit = { delay, from: { row: a.row, col: a.col } };
          await sleep(T * 0.22);
          break;
        }
        case 'dmg': {
          const m = model.get(e.id); if (!m) break;
          const el = els.get(e.id);
          const { delay = 0, from = null } = pendingHit || {};
          m.hp = e.hp;
          if (e.blocked === 'shield') m.shield = Math.max(0, (m.shield || 0) - 1);
          if (m.side === 1 && !e.blocked) stats.damage += e.amount;
          const snap = { ...m };
          later(delay, () => {
            if (!el) return;
            if (els.get(e.id) === el) refreshEntity(e.id); else paintHp(el, snap.hp, snap.maxHp, snap.kind);
            if (e.blocked) {
              fx.floatText(snap.row, snap.col, e.blocked === 'invuln' ? 'անխոցելի' : 'վահան', 'block');
              fx.ring(snap.row, snap.col, '#ffe58a', 1.2);
              audio.sfx('shield');
              return;
            }
            if (from && !reduce) {
              const dx = Math.sign(snap.col - from.col) * 9, dy = Math.sign(snap.row - from.row) * 9;
              el.style.setProperty('--kx', `${snap.kind === 'unit' ? dx : 0}%`); el.style.setProperty('--ky', `${snap.kind === 'unit' ? dy : 0}%`);
            }
            pulse(el, 'hit', 300);
            fx.floatText(snap.row, snap.col, `−${e.amount}`, e.hp === 0 ? 'dmg.kill' : e.amount >= 4 ? 'dmg.big' : 'dmg');
            fx.sparks(snap.row, snap.col);
            if (snap.kind === 'tower') fx.shake(el.querySelector('.ent-sprite'), 4, 260);
          });
          await sleep(T * 0.1);
          break;
        }
        case 'heal': {
          const m = model.get(e.id); if (!m) break;
          m.hp = e.hp; refreshEntity(e.id);
          fx.floatText(m.row, m.col, `+${e.amount}`, 'heal');
          fx.sparkleUp(m.row, m.col);
          audio.sfx('heal');
          await sleep(T * 0.1);
          break;
        }
        case 'revive': {
          const m = model.get(e.id); if (!m) break;
          m.hp = e.hp;
          const delay = pendingHit?.delay || 0;
          later(delay + 60, () => { refreshEntity(e.id); fx.floatText(m.row, m.col, 'վերակենդանացավ', 'heal'); fx.ring(m.row, m.col, '#9be08f'); audio.sfx('heal'); });
          log(`«${nameOf(m)}»-ը վերակենդանացավ`, 'foe');
          await sleep(T * 0.5);
          break;
        }
        case 'buff': {
          const m = model.get(e.id); if (!m) break;
          m.invuln = true; refreshEntity(e.id);
          break;
        }
        case 'death': {
          const m = model.get(e.id), el = els.get(e.id);
          const delay = pendingHit?.delay || 0;
          els.delete(e.id); model.delete(e.id);
          if (!m) break;
          lastDeath = { row: m.row, col: m.col };
          const king = m.cardId === 'tower_king';
          log(`${m.side === 0 ? 'Քո' : 'Թշնամու'} «${nameOf(m)}»-ը ${m.kind === 'unit' ? 'զոհվեց' : 'ավերվեց'}`, m.kind === 'tower' ? 'big' : '');
          later(delay + 40, () => {
            if (m.kind === 'unit') {
              fx.burst(m.row, m.col, { count: 9, colors: sideColors(m.side), spread: 0.7, life: 520 });
              audio.sfx('death');
            } else {
              fx.debris(m.row, m.col, king ? 26 : 14);
              fx.burst(m.row, m.col, { count: 8, colors: ['#6b5b57', '#9a8d88'], spread: 0.9, life: 1100, up: 0.8, size: 0.3 });
              fx.shake(boardFrame, king ? 12 : 7, king ? 700 : 420);
              audio.sfx('rumble');
              if (king) fx.slowMo(520, 0.25);
            }
            if (el) { el.classList.add(m.kind === 'unit' ? 'dying' : 'collapse'); later(m.kind === 'unit' ? 380 : 900, () => el.remove()); }
          });
          await sleep(T * (m.kind === 'tower' ? (king ? 2.4 : 1.2) : 0.2));
          break;
        }
        case 'gold': {
          if (e.reason === 'bounty' && lastDeath) {
            const box = e.side === 0 ? goldBox : aiGoldBox;
            const { row, col } = lastDeath;
            later((pendingHit?.delay || 0) + 80, () => { fx.coinTo(row, col, box, `+${e.amount}`); audio.sfx('coin'); });
            later((pendingHit?.delay || 0) + 80 + 650 * speed, () => {
              const num = e.side === 0 ? goldEl : aiGoldEl;
              num.textContent = String((+num.textContent || 0) + e.amount);
              pulse(box, 'gain', 500);
            });
          }
          break;
        }
        case 'spell': {
          pendingHit = null;
          const own = [...model.values()].filter(m => m.side === e.side && m.kind === 'unit');
          if (e.cardId === 'vahagn') {
            audio.sfx('fire');
            for (const [r, c] of e.cells) { pulse(cellAt(r, c), 'burn', 600); fx.flames(r, c); }
            fx.shake(boardFrame, 4, 300);
          } else if (e.cardId === 'anahit') {
            audio.sfx('shield');
            for (const [r, c] of e.cells) { pulse(cellAt(r, c), 'bless', 600); fx.ring(r, c, '#ffe58a', 1.8); fx.sparkleUp(r, c, ['#ffe58a', '#fff']); }
          } else if (e.cardId === 'ararat') {
            audio.sfx('heal');
            pulse(boardEl, e.side === 0 ? 'cast-p' : 'cast-a', 600);
            for (const m of own) fx.ring(m.row, m.col, '#9be08f', 1.3);
          } else if (e.cardId === 'horn') {
            audio.sfx('horn');
            pulse(boardEl, e.side === 0 ? 'cast-p' : 'cast-a', 600);
            for (const m of own) fx.wind(m.row, m.col, e.side === 0);
          } else if (e.cardId === 'hayk') {
            audio.sfx('arrow');
            for (const [r, c] of e.cells) { fx.ring(r, c, '#f0c044', 1.5); fx.sparks(r, c, ['#f0c044', '#fff']); }
          } else { // boss barrage and other board-wide effects
            audio.sfx('cannon');
            fx.shake(boardFrame, 6, 400);
            for (const m of model.values()) if (m.side !== e.side && m.kind === 'unit') fx.flames(m.row, m.col);
          }
          await sleep(T * 0.6);
          break;
        }
        case 'resolve':
          boardEl.classList.add('fighting');
          fx.banner(boardFrame, 'Մա՜րտ', 'fight', 560);
          audio.sfx('drum');
          await sleep(420 * speed);
          break;
        case 'round':
          for (const [id, m] of model) { m.invuln = false; m.isNew = false; refreshEntity(id); }
          break;
        case 'win': break;
      }
    }
    if (tickStart) { const left = TICK - (performance.now() - tickStart); if (left > 0) await sleep(left); }
    boardEl.classList.remove('fighting');
    tickEl.replaceChildren();
    pendingHit = null;
    if (disposed) return;
    syncAll();
    renderHud();
  }

  // ---------- HUD ----------
  function renderHud() {
    goldEl.textContent = game.gold[0];
    aiGoldEl.textContent = game.gold[1];
    roundEl.textContent = `Ռաունդ ${game.round} / ${cfg.rounds}`;
    const planning = phase === 'plan';
    turnEl.textContent = phase === 'over' ? 'Մարտն ավարտվեց' : planning ? (ending ? 'Սպասում ենք AI-ին…' : 'Պլանավորում') : 'Մարտ';
    turnEl.className = 'turn-label ' + (planning ? 'mine' : 'theirs');
    incomeEl.textContent = game.round < cfg.rounds && phase !== 'over' ? `+${incomeForRound(cfg, game.round + 1)} հաջորդ ռաունդում` : '';
    pipsEl.replaceChildren(...Array.from({ length: cfg.maxCardsPerTurn }, (_, i) => h(`i${i < game.cardsPlayed[0] ? '.on' : ''}`)));
    const canAct = planning && !ending;
    endBtn.disabled = !canAct || tutLocksReady();
    handEl.replaceChildren(...game.hands[0].map((id, i) => {
      const affordable = canPlayCard(game, id, 0);
      const missing = CARDS[id].cost - game.gold[0];
      const el = cardView(id, {
        disabled: !canAct || !affordable, glow: canAct && affordable, selected: i === selected, hotkey: i + 1,
        missing: canAct && missing > 0 ? missing : 0,
        onclick: () => { if (!dragJustEnded) onCardClick(i); },
      });
      if (i === lastReplaced) el.classList.add('slide-in');
      el.addEventListener('pointerdown', (ev) => startDrag(ev, i));
      return el;
    }));
    lastReplaced = -1;
    const next = game.queues[0][0];
    nextEl.replaceChildren(...(next ? [h('div.next-label', {}, 'Հաջորդը'), cardView(next, { small: true, disabled: true })] : []));
    seenEl.replaceChildren(h('span.seen-label', {}, 'Թշնամու տեսած քարտերը՝'),
      ...(seen.size ? [...seen].map(([id, n]) => {
        const chip = h('span.seen-chip', { onclick: () => showCardInfo(id) }, iconEl(id, 'seen-spr'), n > 1 ? h('b', {}, `×${n}`) : null);
        chip.classList.add('foe');
        attachHover(chip, () => h('div.tooltip', {}, h('b', {}, CARDS[id].nameHy)), () => showCardInfo(id));
        return chip;
      }) : [h('span.seen-none', {}, 'դեռ չկան')]));
    renderTargets();
    renderHint();
    tutUpdate();
  }

  // ---------- targets and placement preview ----------
  function clearPreview() {
    for (const c of cellEls) c.classList.remove('preview', 'range', 'bad');
    ghostEl.hidden = true;
    pathLayer.replaceChildren();
    for (const el of layer.querySelectorAll('.pv-hp')) el.remove();
  }
  function renderTargets() {
    for (const c of cellEls) c.classList.remove('target');
    clearPreview();
    boardEl.classList.remove('targeting-all', 'placing');
    if (phase !== 'plan' || ending || selected < 0) return;
    const cardId = game.hands[0][selected];
    const def = CARDS[cardId];
    const targets = cardTargets(game, 0, cardId);
    boardEl.classList.add('placing');
    if ((targets.length === 1 && targets[0].row === 0) || def.ability === 'vahagn') { boardEl.classList.add('targeting-all'); return; }
    for (const t of targets) cellAt(t.row, t.col).classList.add('target');
  }
  /** Preview of the selected card on the hovered cell: ghost, range, first steps; spell area and results. */
  function showPreview(r, c) {
    clearPreview();
    if (phase !== 'plan' || ending || selected < 0) return;
    const cardId = game.hands[0][selected];
    const def = CARDS[cardId];
    if (def.type === 'spell') {
      if (def.ability === 'vahagn') {
        const rr = Math.min(r, rows - 1), cc = Math.min(c, cols - 1);
        for (const [ar, ac] of areaCells(rr, cc)) cellAt(ar, ac).classList.add('preview');
        for (const hit of previewSpell(game, 0, cardId, rr, cc) || []) {
          const el = els.get(hit.id);
          if (el) el.append(h(`div.pv-hp${hit.dead ? '.dead' : ''}`, {}, hit.dead ? `${hit.hp} → 0` : `${hit.hp} → ${hit.hpAfter}`));
        }
      } else if (def.ability === 'anahit') {
        if (isLegalTarget(game, 0, cardId, r, c)) cellAt(r, c).classList.add('range');
      }
      return;
    }
    const pv = previewPlacement(game, 0, cardId, r, c, 4);
    if (!pv) { if (!entityAt(game, r, c) || true) cellAt(r, c).classList.add('bad'); return; }
    ghostEl.hidden = false;
    ghostEl.className = 'ent ghost side-0';
    ghostEl.querySelector('.ent-sprite').replaceWith(iconEl(def.type === 'special' ? def.spawn : cardId, 'ent-sprite'));
    place(ghostEl, r, c);
    if (pv.atk > 0) {
      for (let rr = 1; rr <= rows; rr++) for (let cc = 1; cc <= cols; cc++) {
        if ((rr !== r || cc !== c) && chebyshev(r, c, rr, cc) <= pv.range) cellAt(rr, cc).classList.add('range');
      }
    }
    if (pv.path.length > 1) {
      const pts = pv.path.map(p => `${p.col - 0.5},${p.row - 0.5}`).join(' ');
      pathLayer.innerHTML = `<svg viewBox="0 0 ${cols} ${rows}" preserveAspectRatio="none"><defs><marker id="pa" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto"><path d="M0 0L5 2.5L0 5z" fill="#2a1a17"/></marker></defs>` +
        `<polyline points="${pts}" fill="none" stroke="#fff" stroke-width=".12" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>` +
        `<polyline points="${pts}" fill="none" stroke="#2a1a17" stroke-width=".06" stroke-dasharray=".12 .12" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#pa)"/></svg>`;
    }
  }
  /** Board cell under a pointer event (works over cells, units and effects). */
  function cellFromEvent(ev) {
    const t = ev.target instanceof Element ? ev.target : null;
    const cell = t && t.closest('.cell');
    if (cell) return { r: +cell.dataset.r, c: +cell.dataset.c };
    const ent = t && t.closest('.ent');
    if (ent && ent.dataset.id) { const m = model.get(+ent.dataset.id); if (m) return { r: m.row, c: m.col }; }
    return cellFromPoint(ev.clientX, ev.clientY);
  }
  function cellFromPoint(x, y) {
    const b = boardEl.getBoundingClientRect();
    if (!b.width || x < b.left || x >= b.right || y < b.top || y >= b.bottom) return null;
    return { r: Math.min(rows, Math.floor((y - b.top) / b.height * rows) + 1), c: Math.min(cols, Math.floor((x - b.left) / b.width * cols) + 1) };
  }
  let hoverCell = null;
  boardEl.addEventListener('pointermove', (ev) => {
    if (drag) return;
    const cell = cellFromPoint(ev.clientX, ev.clientY);
    const key = cell ? `${cell.r},${cell.c}` : null;
    if (key === hoverCell) return;
    hoverCell = key;
    if (cell) showPreview(cell.r, cell.c); else clearPreview();
  });
  boardEl.addEventListener('pointerleave', () => { if (!drag) { hoverCell = null; clearPreview(); } });
  boardEl.addEventListener('click', (ev) => { const cell = cellFromEvent(ev); if (cell) onCellClick(cell.r, cell.c); });
  boardEl.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    if (selected >= 0) { cancelSelection(); return; }
    const cell = cellFromEvent(ev);
    const ent = cell && entityAt(game, cell.r, cell.c);
    if (ent) showEntityInfo(ent);
  });

  // ---------- drag & drop from the hand ----------
  let drag = null, dragJustEnded = false;
  function startDrag(ev, i) {
    if (ev.button !== 0 || phase !== 'plan' || ending || busy || ev.target.closest('.info-btn')) return;
    if (!canPlayCard(game, game.hands[0][i], 0)) return;
    drag = { i, x: ev.clientX, y: ev.clientY, ghost: null, origin: ev.currentTarget.getBoundingClientRect() };
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
    window.addEventListener('pointercancel', onDragEnd);
  }
  function onDragMove(ev) {
    if (!drag) return;
    if (!drag.ghost) {
      if (Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) < 8) return;
      hideTooltip();
      selected = drag.i; renderHud();
      audio.sfx('pick');
      handEl.children[drag.i]?.classList.add('dragging');
      drag.ghost = cardView(game.hands[0][drag.i], { small: true, noTip: true });
      drag.ghost.classList.add('drag-card');
      document.body.append(drag.ghost);
    }
    drag.ghost.style.left = `${ev.clientX}px`;
    drag.ghost.style.top = `${ev.clientY}px`;
    const cell = cellFromPoint(ev.clientX, ev.clientY);
    const key = cell ? `${cell.r},${cell.c}` : null;
    drag.ghost.classList.toggle('over-board', !!cell);
    if (key !== hoverCell) { hoverCell = key; if (cell) showPreview(cell.r, cell.c); else clearPreview(); }
  }
  function endDragListeners() {
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
    window.removeEventListener('pointercancel', onDragEnd);
  }
  function returnGhost(d) {
    const g = d.ghost, r = g.getBoundingClientRect();
    const dx = d.origin.left + d.origin.width / 2 - (r.left + r.width / 2), dy = d.origin.top + d.origin.height / 2 - (r.top + r.height / 2);
    const a = g.animate([{ translate: '0 0', opacity: 1 }, { translate: `${dx}px ${dy}px`, opacity: 0.3 }], { duration: reduce ? 1 : 200 * speed, easing: 'ease-in' });
    a.onfinish = a.oncancel = () => g.remove();
  }
  function onDragEnd(ev) {
    endDragListeners();
    const d = drag; drag = null;
    if (!d || !d.ghost) return;      // it was a click
    dragJustEnded = true; setTimeout(() => { dragJustEnded = false; }, 0);
    hoverCell = null;
    const cell = ev.type === 'pointercancel' ? null : cellFromPoint(ev.clientX, ev.clientY);
    if (cell && selected === d.i) {
      tryPlay(cell.r, cell.c, true).then((ok) => { if (ok) d.ghost.remove(); else returnGhost(d); });
    } else { returnGhost(d); cancelSelection(); }
  }
  function cancelDrag() {
    if (!drag) return;
    endDragListeners();
    if (drag.ghost) drag.ghost.remove();
    drag = null;
  }

  // ---------- hints ----------
  function renderHint() {
    let text = '';
    if (selected >= 0 && phase === 'plan' && !tut) {
      const def = CARDS[game.hands[0][selected]];
      if (def.type !== 'spell') text = 'Սեղմիր ընդգծված վանդակին քո գոտում կամ քաշիր քարտը այնտեղ։ Esc՝ չեղարկել։';
      else if (def.ability === 'vahagn') text = 'Ընտրիր 2×2 տարածքը. թվերը ցույց են տալիս թշնամիների կյանքը հարվածից հետո։';
      else if (def.ability === 'anahit') text = 'Սեղմիր քո զորքերից մեկին։';
      else text = 'Սեղմիր դաշտի ցանկացած կետին՝ հմայքը կիրառելու համար։';
    }
    hintEl.textContent = text;
    hintEl.hidden = !text;
  }

  // ---------- interactive tutorial (battle 1-1) ----------
  const enemyKing = () => els.get(game.entities.find(e => e.side === 1 && e.cardId === 'tower_king')?.id);
  const TUT_STEPS = [
    { id: 'hand', target: () => handEl, text: 'Սա քո ձեռքն է՝ 4 քարտ։ Անկյունի թիվը քարտի գինն է ոսկով։ Ընտրիր որևէ փայլող քարտ՝ սեղմելով նրան (կամ 1–4 ստեղներով)։',
      done: () => selected >= 0 || game.cardsPlayed[0] > 0 },
    { id: 'cell', target: () => cellAt(cfg.zones[0][0], 3), text: 'Հիմա սեղմիր քո գոտու ընդգծված վանդակներից մեկին (քարտը կարելի է նաև քաշել դաշտ)։ Ուշադիր. դրված քարտը հետ չի վերցվում։',
      done: () => game.cardsPlayed[0] > 0, back: () => selected < 0 && !busy },
    { id: 'gold', target: () => meBox, text: 'Սա քո ոսկին է։ Ամեն ռաունդ ստանում ես եկամուտ, իսկ չծախսածը մնում է։ Մեկ ռաունդում կարելի է դնել մինչև 3 քարտ (երեք կետերը)։', next: true },
    { id: 'ready', target: () => endBtn, text: 'Դու և հակառակորդը քարտերը դնում եք միաժամանակ, և նա քո քարտերը չի տեսնում։ Երբ պատրաստ ես, սեղմիր «Պատրաստ է» (կամ Space)։',
      done: () => phase !== 'plan' || ending },
    { id: 'goal', wait: () => phase === 'plan' && !ending, target: enemyKing, text: 'Մարտում երկու կողմի զորքերը գործում են միասին։ Նոր դրված զորքը կարող է հարձակվել անմիջապես, իսկ աշտարակները կրակում են մինչև 2 վանդակ, և որքան մոտ է թշնամին, այնքան ուժեղ։ Քո նպատակը թշնամու Արքայի ամրոցն է. եթե 20 ռաունդում այն չավերվի, հաղթում է ավելի շատ աշտարակ ավերածը։', next: true },
    { id: 'ai', wait: () => phase === 'plan' && !ending, target: () => (settings.showAiPanel === false ? null : aiPanel), text: 'Այս վահանակում երևում է, թե ինչ էր մտածում AI-ը. ալգորիթմը, դիտարկած քայլերը և ընտրության բացատրությունը։', next: true },
    { id: 'tips', wait: () => phase === 'plan' && !ending, target: () => handEl, text: 'Հուշումներ. հեռահար զորքերը պահիր ամուր զորքերի հետևում։ Զորքի վրա աջ կոճակով սեղմելիս բացվում է նրա պատմությունը։ Հաջողություն։', next: true },
  ];
  let tut = params.tutorial ? { i: 0 } : null;
  const tutStep = () => (tut ? TUT_STEPS[tut.i] : null);
  /** Until the tutorial reaches the "ready" step the round cannot be ended. */
  function tutLocksReady() { const s = tutStep(); return !!s && ['hand', 'cell', 'gold'].includes(s.id); }
  function tutAdvance() {
    if (!tut) return;
    tut.i++;
    if (tut.i >= TUT_STEPS.length) tutFinish(); else { audio.sfx('pick'); renderHud(); }
  }
  function tutFinish() {
    tut = null;
    calloutEl.hidden = true;
    for (const el of root.querySelectorAll('.tut-focus')) el.classList.remove('tut-focus');
    if (!app.profile.tutorialDone) { app.profile.tutorialDone = true; app.save(); }
    renderHud();
  }
  function tutUpdate() {
    for (const el of root.querySelectorAll('.tut-focus')) el.classList.remove('tut-focus');
    if (!tut || phase === 'over') { calloutEl.hidden = true; return; }
    let s = tutStep();
    if (s.back && s.back()) { tut.i--; s = tutStep(); }
    while (s && s.done && s.done()) { tut.i++; s = tutStep(); if (!s) { tutFinish(); return; } }
    if (s.wait && !s.wait()) { calloutEl.hidden = true; return; }
    const target = s.target();
    calloutEl.hidden = false;
    calloutEl.dataset.step = s.id;
    calloutEl.replaceChildren(
      h('div.callout-step', {}, `Ուսուցում · ${tut.i + 1} / ${TUT_STEPS.length}`),
      h('p', {}, s.text),
      h('div.callout-actions', {},
        h('button.callout-skip', { onclick: tutFinish }, 'Բաց թողնել'),
        s.next ? btn('.primary.small.callout-next', tut.i === TUT_STEPS.length - 1 ? 'Սկսել' : 'Շարունակել', tutAdvance) : null));
    positionCallout(target);
  }
  function positionCallout(target) {
    const rr = root.getBoundingClientRect();
    calloutEl.classList.remove('above', 'below', 'center');
    if (!target || !target.isConnected) { calloutEl.classList.add('center'); calloutEl.style.left = '50%'; calloutEl.style.top = '40%'; return; }
    target.classList.add('tut-focus');
    const t = target.getBoundingClientRect(), cw = calloutEl.offsetWidth, ch = calloutEl.offsetHeight;
    const above = t.top - rr.top > ch + 24;
    const cx = t.left + t.width / 2 - rr.left;
    const left = Math.max(8, Math.min(rr.width - cw - 8, cx - cw / 2));
    calloutEl.style.left = `${left}px`;
    calloutEl.style.top = `${above ? t.top - rr.top - ch - 14 : t.bottom - rr.top + 14}px`;
    calloutEl.style.setProperty('--ax', `${Math.max(16, Math.min(cw - 16, cx - left))}px`);
    calloutEl.classList.add(above ? 'above' : 'below');
  }
  const onResize = () => { if (tut) tutUpdate(); };
  window.addEventListener('resize', onResize);

  // ---------- timer ----------
  function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }
  function drawTimer() {
    const total = cfg.turnTimerSeconds;
    timerNum.textContent = total ? Math.ceil(timeLeft) : '∞';
    timerRing.querySelector('.fg').setAttribute('stroke-dashoffset', total ? String(119.4 * (1 - timeLeft / total)) : '0');
    const low = !!total && timeLeft <= 3 && phase === 'plan' && !ending;
    timerEl.classList.toggle('low', low);
    if (low) { const sec = Math.ceil(timeLeft); if (sec !== lastTickSec && sec > 0) { lastTickSec = sec; audio.sfx('tick'); } }
  }
  function drawThinking() {
    if (phase !== 'plan') { thinkingEl.replaceChildren(); return; }
    if (aiReady) thinkingEl.replaceChildren(ui('check'), ' AI-ը պատրաստ է');
    else thinkingEl.replaceChildren(h('span.spinner'), ` AI-ը մտածում է… ${((performance.now() - thinkT0) / 1000).toFixed(1)} վ`);
    thinkingEl.classList.toggle('ready', aiReady);
  }
  function startTimer() {
    stopTimer();
    timeLeft = cfg.turnTimerSeconds;
    lastTickSec = -1;
    drawTimer();
    const t0 = performance.now();
    timerId = setInterval(() => {
      drawThinking();
      if (!cfg.turnTimerSeconds) return;
      timeLeft = cfg.turnTimerSeconds - (performance.now() - t0) / 1000;
      if (timeLeft <= 0) { timeLeft = 0; drawTimer(); stopTimer(); pulse(endBtn, 'timeup', 500); endPlanning(true); }
      else drawTimer();
    }, 100);
  }

  // ---------- player input ----------
  function cancelSelection() {
    if (selected < 0) return;
    selected = -1;
    renderHud();
  }
  function onCardClick(i) {
    if (phase !== 'plan' || ending || i >= game.hands[0].length) return;
    if (!canPlayCard(game, game.hands[0][i], 0)) { audio.sfx('invalid'); pulse(handEl.children[i], 'nope', 300); return; }
    selected = selected === i ? -1 : i;
    audio.sfx('pick');
    renderHud();
  }
  function invalidFeedback(r, c) {
    audio.sfx('invalid');
    const cell = cellAt(r, c);
    cell.classList.add('bad');
    pulse(cell, 'nope', 320);
    later(400, () => cell.classList.remove('bad'));
  }
  /** Card flying from the hand to its cell. */
  function flyCard(cardId, src, r, c) {
    if (reduce || !src || !src.width) return Promise.resolve();
    const b = boardEl.getBoundingClientRect();
    const tx = r > 0 ? b.left + (c - 0.5) * b.width / cols : b.left + b.width / 2;
    const ty = r > 0 ? b.top + (r - 0.5) * b.height / rows : b.top + b.height / 2;
    const el = cardView(cardId, { noTip: true });
    el.classList.add('fly-card');
    el.style.left = `${src.left}px`; el.style.top = `${src.top}px`; el.style.width = `${src.width}px`; el.style.height = `${src.height}px`;
    document.body.append(el);
    const a = el.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${tx - src.left - src.width / 2}px, ${ty - src.top - src.height / 2}px) scale(.25)`, opacity: 0.4 }],
    { duration: 210 * speed, easing: 'cubic-bezier(.4,0,.7,1)' });
    return a.finished.catch(() => {}).then(() => el.remove());
  }
  /** Play the selected card on a cell. Returns true if the card was played. */
  async function tryPlay(r, c, fromDrag = false) {
    if (phase !== 'plan' || selected < 0 || ending || busy) return false;
    const idx = selected;
    const cardId = game.hands[0][idx];
    const def = CARDS[cardId];
    let row = r, col = c;
    if (def.type === 'spell') {
      if (def.ability === 'vahagn') { row = Math.min(r, rows - 1); col = Math.min(c, cols - 1); }
      else if (def.ability !== 'anahit') { row = 0; col = 0; }
    }
    const src = handEl.children[idx]?.getBoundingClientRect();
    if (!playCard(game, cardId, row, col, idx, 0)) { invalidFeedback(r, c); return false; }
    stats.cards.push(cardId);
    stats.goldSpent += def.cost;
    if (def.type !== 'spell') stats.unitsPlaced += def.type === 'special' ? def.spawnCount : 1;
    selected = -1;
    lastReplaced = idx;
    busy = true;
    hoverCell = null;
    renderHud();
    if (!fromDrag) await flyCard(cardId, src, row, col);
    await playEvents(drain());
    busy = false;
    if (disposed) return true;
    if (game.winner !== null) { finish(); return true; }
    renderHud();
    return true;
  }
  function onCellClick(r, c) {
    if (phase !== 'plan' || selected < 0 || ending || busy) {
      if (selected < 0) { const ent = entityAt(game, r, c); if (ent) showEntityInfo(ent); }
      return;
    }
    tryPlay(r, c, false);
  }
  function onKey(ev) {
    if (disposed || isModalOpen() || ev.ctrlKey || ev.altKey || ev.metaKey) return;
    if (phase !== 'plan' || ending) return;
    if (ev.key >= '1' && ev.key <= '9') { onCardClick(+ev.key - 1); }
    else if (ev.key === ' ' || ev.key === 'Enter') {
      ev.preventDefault();
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
      if (!endBtn.disabled) endPlanning(false);
    } else if (ev.key === 'Escape') { cancelDrag(); cancelSelection(); }
  }
  window.addEventListener('keydown', onKey);

  // ---------- round flow ----------
  /** Start the planning phase: the AI starts thinking right away (in parallel with the player). */
  function startPlanning() {
    phase = 'plan';
    ending = false;
    selected = -1;
    revealEl.hidden = true;
    const plan = cfg.turnTimerSeconds ? cfg.turnTimerSeconds * 1000 : Infinity;
    const opts = { seed: mixSeed(params.seed || 1, game.turnCount, 1) };
    // the AI must be ready by the end of planning; it keeps a small margin
    if (params.aiLevel === 'hard') opts.timeMs = Math.max(500, Math.min(settings.hardMs, plan - 1500));
    if (params.aiLevel === 'medium') opts.timeMs = Math.max(400, Math.min(cfg.ai.minimaxTimeMs, plan - 1500));
    // campaign difficulty ramp: early chapters give the search a smaller budget
    if (params.aiTimeMs && opts.timeMs) opts.timeMs = Math.min(opts.timeMs, params.aiTimeMs);
    if (params.aiMaxDepth) opts.maxDepth = params.aiMaxDepth;
    aiReady = false;
    thinkT0 = performance.now();
    const t0 = thinkT0;
    aiJob = ai.choose(game, 1, params.aiLevel, opts).catch((e) => {
      console.error(e);
      return { actions: [], stats: { timeMs: performance.now() - t0, levelHy: LEVEL_HY[params.aiLevel], algorithmHy: 'սխալ', winProb: 0.5 }, top: [], explanation: 'AI-ի սխալ. քայլը բաց է թողնվում։', deltas: [] };
    }).then((r) => { aiReady = true; if (!disposed) drawThinking(); return r; });
    renderHud();
    drawThinking();
    startTimer();
    fx.banner(boardFrame, game.round >= cfg.rounds ? 'Վերջին ռաունդ' : `Ռաունդ ${game.round}`, game.round >= cfg.rounds ? 'last' : 'round', 620);
    if (game.round > 1) audio.sfx('pick');
  }

  /** Reveal of the AI's cards: they flip face-up one by one above the enemy side and fly to their cells. */
  async function reveal(result) {
    const acts = result.actions;
    if (!acts.length) { log('Հակառակորդը քարտ չխաղաց', 'foe'); return; }
    const slots = acts.map((a) => h('div.flip', {}, h('div.flip-inner', {},
      h('div.flip-back', {}, cardBack(true)), h('div.flip-front', {}, cardView(a.cardId, { small: true, foe: true, noTip: true })))));
    revealEl.replaceChildren(...slots);
    revealEl.hidden = false;
    await sleep(260 * speed);
    let played = 0;
    for (let i = 0; i < acts.length; i++) {
      if (disposed) return;
      const a = acts[i], slot = slots[i];
      slot.classList.add('open');
      audio.sfx('flip');
      await sleep(330 * speed);
      // a card that became unaffordable because of the player's simultaneous cards is skipped
      if (!playCard(game, a.cardId, a.row, a.col, -1, 1)) { slot.classList.add('skipped'); continue; }
      played++;
      seen.set(a.cardId, (seen.get(a.cardId) || 0) + 1);
      if (!reduce) {
        const s = slot.getBoundingClientRect(), b = boardEl.getBoundingClientRect();
        const tx = a.row > 0 ? b.left + (a.col - 0.5) * b.width / cols : b.left + b.width / 2;
        const ty = a.row > 0 ? b.top + (a.row - 0.5) * b.height / rows : b.top + b.height / 2;
        const an = slot.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 },
          { transform: `translate(${tx - s.left - s.width / 2}px, ${ty - s.top - s.height / 2}px) scale(.3)`, opacity: 0.3 }], { duration: 220 * speed, easing: 'ease-in', fill: 'forwards' });
        await an.finished.catch(() => {});
      }
      slot.style.visibility = 'hidden';
      await playEvents(drain());
      if (disposed || game.winner !== null) return;
    }
    if (!played) log('Հակառակորդի քարտերն այլևս հնարավոր չէր խաղալ', 'foe');
    revealEl.hidden = true;
    showMarkers(result.top);
  }
  /** Numbered translucent markers of the AI's top-3 candidate placements (the chosen one is highlighted). */
  function showMarkers(top) {
    const marks = [];
    (top || []).slice(0, 3).forEach((t, i) => {
      for (const a of t.actions || []) {
        if (!a.row) continue;
        const m = h(`div.ai-marker${t.chosen ? '.chosen' : ''}.n${i}`, { title: t.text }, String(i + 1));
        m.style.left = `${(a.col - 0.5) * 100 / cols}%`; m.style.top = `${(a.row - 0.5) * 100 / rows}%`;
        fxLayer.append(m);
        marks.push(m);
      }
    });
    later(2600 * Math.max(speed, 0.6), () => marks.forEach(m => m.remove()));
  }

  /** End of planning (button or timeout): reveal the AI's cards, then the battle phase. */
  async function endPlanning(timeout) {
    if (phase !== 'plan' || ending) return;
    if (tutLocksReady()) return;
    ending = true;
    stopTimer();
    cancelDrag();
    if (timeout) log('Պլանավորման ժամանակն ավարտվեց', 'big'); else audio.sfx('ready');
    selected = -1;
    renderHud();
    // a placement animation may still be running
    while (busy && !disposed) await sleep(30);
    const result = await aiJob;
    if (disposed || game.winner !== null) return;
    phase = 'battle';
    drawThinking();
    renderHud();
    winHistory.push({ round: game.round, p: Math.max(0, Math.min(1, result.stats.winProb ?? 0.5)) });
    renderAiPanel(aiBody, result, winHistory, cfg.rounds);
    await reveal(result);
    if (disposed) return;
    if (game.winner !== null) return finish();
    // battle phase
    endRound(game);
    await playEvents(drain());
    if (disposed) return;
    if (game.winner !== null) return finish();
    startPlanning();
  }

  function finish() {
    if (phase === 'over') return;
    phase = 'over';
    stopTimer();
    cancelDrag();
    renderHud();
    const w = game.winner;
    log(w === 'draw' ? 'Մարտն ավարտվեց ոչ-ոքի' : w === 0 ? 'Դու հաղթեցիր' : 'Դու պարտվեցիր', 'big');
    recordBattle(app.profile, { level: params.aiLevel, winner: w, ms: performance.now() - startedAt, cards: stats.cards, castle: w === 0 && game.winReason === 'king' });
    app.save();
    const result = {
      mode: params.mode, battleId: params.battleId, winner: w, reason: game.winReason, starsWon: starsFor(game, 0), level: params.aiLevel,
      towers: [game.towersDestroyed[0], game.towersDestroyed[1]], rounds: game.round,
      stats: { unitsPlaced: stats.unitsPlaced, damage: stats.damage, goldSpent: stats.goldSpent },
      replay: { ...params, seed: (params.seed || 1) + 7919 },
    };
    later((game.winReason === 'king' ? 2100 : 1300) * Math.max(speed, 0.6), () => app.go('result', result));
  }

  // ---------- start ----------
  app.cleanup = () => {
    disposed = true;
    stopTimer();
    cancelDrag();
    for (const id of timers) clearTimeout(id);
    timers.clear();
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    ai.dispose();
    fx.dispose();
    document.querySelectorAll('.fly-card, .drag-card').forEach(el => el.remove());
    hideTooltip();
  };
  audio.music('battle');
  drain();
  syncAll();
  log(`Մարտը սկսվեց. ${cfg.rounds} ռաունդ, հակառակորդ՝ ${LEVEL_HY[params.aiLevel]}`, 'big');
  startPlanning();
  // the first callout can only be placed once the screen is in the document
  if (tut) { later(60, tutUpdate); later(400, tutUpdate); }
  // test/debug hook
  root.__battle = {
    game, stats, get phase() { return phase; }, get ending() { return ending; }, get busy() { return busy; }, get selected() { return selected; },
    get tutorialStep() { return tutStep()?.id || null; }, get aiReady() { return aiReady; },
    endPlanning, endPlayerTurn: endPlanning, select: onCardClick, cellClick: onCellClick,
  };
  return root;
}
