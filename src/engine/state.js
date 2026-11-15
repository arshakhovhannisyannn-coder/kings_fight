// Game state: creation, cloning and low-level board helpers. Pure logic (no DOM, no timers).
import { CONFIG, incomeForRound } from '../data/config.js';
import { CARDS } from '../data/cards.js';
import { rngNext, shuffle } from './rng.js';

export const PLAYER = 0; // bottom side (row 7)
export const AI = 1;     // top side (row 1)

export function cellIndex(state, row, col) { return (row - 1) * state.cols + (col - 1); }

/**
 * Zobrist keys of a cell for the static-obstacle hash (two independent 32-bit values).
 * v1.3: replaces the old bitmask (sum of 2^cell), which lost precision on boards with more than 53 cells.
 */
function mix32(x) {
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}
export function cellKeyA(ci) { return mix32(ci * 2 + 0x1234567); }
export function cellKeyB(ci) { return mix32(ci * 2 + 0x89abcde); }
export function inBounds(state, row, col) { return row >= 1 && row <= state.rows && col >= 1 && col <= state.cols; }
export function isWater(state, row, col) {
  return row === state.cfg.board.riverRow && !state.cfg.board.bridgeCols.includes(col);
}
export function entityAt(state, row, col) { return state.grid[(row - 1) * state.cols + (col - 1)]; }
export function chebyshev(r1, c1, r2, c2) {
  const dr = r1 > r2 ? r1 - r2 : r2 - r1, dc = c1 > c2 ? c1 - c2 : c2 - c1;
  return dr > dc ? dr : dc;
}
export function inZone(state, side, row) {
  const z = state.cfg.zones[side];
  return row >= z[0] && row <= z[1];
}
/** Has the unit reached the river row or gone beyond it (toward the enemy)? */
export function hasCrossed(state, e) {
  return e.side === PLAYER ? e.row < state.cfg.board.riverRow : e.row > state.cfg.board.riverRow;
}

/** Push an event for the UI. In AI simulations state.events is null, so this is a no-op. */
export function ev(state, obj) { if (state.events) state.events.push(obj); }

export function snapshotEntity(e) { return { ...e }; }

/** Create an entity from a card definition and put it on the board. */
export function addEntity(state, side, kind, cardId, def, row, col) {
  const e = {
    id: state.nextId++, side, kind, cardId, ctype: def.type, ab: def.ability || null,
    row, col, hp: def.hp, maxHp: def.hp, atk: def.atk || 0, speed: def.speed || 0, range: def.range || 0,
    isNew: true, invuln: false, dead: false,
    shield: def.ability === 'ashot' ? 2 : 0,
    revive: def.ability === 'revive',
    artashes: def.ability === 'artashes' ? 3 : 0,
  };
  state.entities.push(e);
  state.grid[cellIndex(state, row, col)] = e;
  if (kind !== 'unit') toggleStatic(state, cellIndex(state, row, col));
  ev(state, { t: 'spawn', e: snapshotEntity(e) });
  return e;
}

export function removeEntity(state, e) {
  e.dead = true;
  const i = state.entities.indexOf(e);
  if (i >= 0) state.entities.splice(i, 1);
  const ci = cellIndex(state, e.row, e.col);
  if (state.grid[ci] === e) state.grid[ci] = null;
  if (e.kind !== 'unit') toggleStatic(state, ci);
}

/** Add/remove a tower or building at cell ci to/from the static-obstacle hash (XOR is its own inverse). */
function toggleStatic(state, ci) {
  state.staticMask = (state.staticMask ^ cellKeyA(ci)) >>> 0;
  state.staticMask2 = (state.staticMask2 ^ cellKeyB(ci)) >>> 0;
}

const TOWER_DEFS = {
  tower_small: { type: 'tower', nameHy: 'Աշտարակ' },
  tower_king: { type: 'tower', nameHy: 'Արքայի ամրոց' },
};
export function towerName(cardId) { return TOWER_DEFS[cardId]?.nameHy; }

/**
 * Create a new game.
 * @param {object} o  { deckP, deckA, seed, cfg, first, events }
 */
export function createGame({ deckP, deckA, seed = 1, cfg = CONFIG, first = null, events = false }) {
  const { cols, rows } = cfg.board;
  const state = {
    cfg, cols, rows,
    rng: seed | 0,
    round: 1,
    firstSide: first === null || first === undefined ? cfg.firstSide : first,
    turn: 0,
    winner: null,          // null | 0 | 1 | 'draw'
    winReason: null,       // 'king' | 'towers' | 'hp' | 'draw'
    gold: [cfg.startGold, cfg.startGold],
    decks: [deckP.slice(), deckA.slice()],   // public deck lists
    hands: [[], []],
    queues: [[], []],
    lastPlayed: [[], []],  // public: last (deckSize - handSize) cards played by each side (they are in the queue)
    virtualHand: -1,       // AI views only: side whose hand is a pessimistic "all possible cards" hand
    cardsPlayed: [0, 0],   // cards played this round by each side
    horn: [false, false],
    towersDestroyed: [0, 0], // towersDestroyed[s] = enemy towers destroyed BY side s
    entities: [],
    grid: new Array(cols * rows).fill(null),
    staticMask: 0,         // Zobrist hash (2 × 32 bit) of the cells holding towers/buildings (for path caching)
    staticMask2: 0,
    nextId: 1,
    turnCount: 0,
    events: events ? [] : null,
  };
  const rnd = () => rngNext(state);
  // towers: row 1 = AI side, last row = player side; small towers in the outer columns, king in the middle
  const mid = Math.ceil(cols / 2);
  for (const [side, row] of [[AI, 1], [PLAYER, rows]]) {
    for (const col of [1, cols]) {
      const t = addEntity(state, side, 'tower', 'tower_small', { type: 'tower', ...cfg.towers.small }, row, col);
      t.isNew = false;
    }
    const k = addEntity(state, side, 'tower', 'tower_king', { type: 'tower', ...cfg.towers.king }, row, mid);
    k.isNew = false;
  }
  for (const side of [PLAYER, AI]) {
    const d = shuffle(state.decks[side].slice(), rnd);
    state.hands[side] = d.slice(0, cfg.handSize);
    state.queues[side] = d.slice(cfg.handSize);
  }
  if (state.events) state.events.length = 0;
  startRound(state);
  return state;
}

/**
 * Start of a round. Both sides plan at the same time; in the engine's sequential model the planners are
 * state.firstSide and then the other side, and the battle phase runs after the second one ends planning.
 * Bookkeeping: income for both sides, Artashes gold, expiry of Anahit's protection.
 */
export function startRound(state) {
  state.turn = state.firstSide;
  state.turnCount++;
  state.cardsPlayed = [0, 0];
  state.horn = [false, false];
  const inc = incomeForRound(state.cfg, state.round);
  const income = [inc, inc];
  const ents = state.entities;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    e.invuln = false;
    if (e.artashes > 0) { e.artashes--; income[e.side] += 1; ev(state, { t: 'gold', side: e.side, amount: 1, reason: 'artashes', id: e.id }); }
  }
  addGold(state, 0, income[0]);
  addGold(state, 1, income[1]);
  ev(state, { t: 'round', round: state.round, income });
}

/**
 * Copy of the state in which `side` plans first in the current round. Both sides plan simultaneously,
 * so before any card is played this round the order is free; the AI always searches as the first planner
 * (it decides without seeing the opponent's cards of this round).
 */
export function asFirstPlanner(state, side) {
  const s = cloneState(state);
  s.firstSide = side;
  s.turn = side;
  return s;
}

export function addGold(state, side, amount) {
  let g = state.gold[side] + amount;
  const cap = state.cfg.goldCap;
  if (cap !== null && cap !== undefined && g > cap) g = cap;
  state.gold[side] = g;
}

/** Deep copy of the game state (events disabled in the copy). */
export function cloneState(s) {
  const n = {
    cfg: s.cfg, cols: s.cols, rows: s.rows, rng: s.rng, round: s.round, firstSide: s.firstSide, turn: s.turn,
    winner: s.winner, winReason: s.winReason,
    gold: [s.gold[0], s.gold[1]],
    decks: s.decks,
    hands: [s.hands[0].slice(), s.hands[1].slice()],
    queues: [s.queues[0].slice(), s.queues[1].slice()],
    lastPlayed: [s.lastPlayed[0].slice(), s.lastPlayed[1].slice()],
    virtualHand: s.virtualHand,
    cardsPlayed: [s.cardsPlayed[0], s.cardsPlayed[1]],
    horn: [s.horn[0], s.horn[1]],
    towersDestroyed: [s.towersDestroyed[0], s.towersDestroyed[1]],
    entities: new Array(s.entities.length),
    grid: new Array(s.grid.length).fill(null),
    staticMask: s.staticMask, staticMask2: s.staticMask2, nextId: s.nextId, turnCount: s.turnCount,
    events: null,
  };
  const src = s.entities, cols = s.cols;
  for (let i = 0; i < src.length; i++) {
    const e = src[i];
    const c = {
      id: e.id, side: e.side, kind: e.kind, cardId: e.cardId, ctype: e.ctype, ab: e.ab,
      row: e.row, col: e.col, hp: e.hp, maxHp: e.maxHp, atk: e.atk, speed: e.speed, range: e.range,
      isNew: e.isNew, invuln: e.invuln, dead: false, shield: e.shield, revive: e.revive, artashes: e.artashes,
    };
    n.entities[i] = c;
    n.grid[(c.row - 1) * cols + (c.col - 1)] = c;
  }
  return n;
}

/** Plain-JSON form (for sending to a Web Worker) and back. */
export function serializeState(s) {
  const c = cloneState(s);
  c.grid = null;
  return c;
}
export function hydrateState(obj, cfg = null) {
  const s = obj;
  if (cfg) s.cfg = cfg;
  s.grid = new Array(s.cols * s.rows).fill(null);
  for (const e of s.entities) s.grid[(e.row - 1) * s.cols + (e.col - 1)] = e;
  s.events = null;
  return s;
}

export function cardDef(id) { return CARDS[id]; }
