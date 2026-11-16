// Movement: bridge funnelling before the river, BFS distance fields after it.
import { cellIndex, ev, chebyshev, PLAYER } from './state.js';
import { anyEnemyInRange } from './combat.js';

const INF = 99;
// Cache of BFS distance fields. Key = hash of the static obstacle layout (53 bits, exact in a double),
// then the goal cell, so it is valid across cloned states and for boards of any size.
// One cache per board layout object (a different board size / river / bridges never shares fields).
const cachesByBoard = new WeakMap();
let cachedFields = 0;

/**
 * BFS distance (8-neighbour steps) from the goal cell to every cell.
 * Static obstacles (water, towers, buildings) block; units are ignored.
 */
function distanceField(state, goalRow, goalCol) {
  const goal = cellIndex(state, goalRow, goalCol);
  const key = state.staticMask * 2097152 + (state.staticMask2 & 0x1fffff);
  let fieldCache = cachesByBoard.get(state.cfg.board);
  if (!fieldCache) { fieldCache = new Map(); cachesByBoard.set(state.cfg.board, fieldCache); }
  let byGoal = fieldCache.get(key);
  let f = byGoal && byGoal[goal];
  if (f) return f;
  const { cols, rows } = state;
  const n = cols * rows;
  f = new Int8Array(n).fill(INF);
  const riverRow = state.cfg.board.riverRow, bridges = state.cfg.board.bridgeCols;
  const queue = new Int16Array(n);
  let head = 0, tail = 0;
  f[goal] = 0; queue[tail++] = goal;
  while (head < tail) {
    const cur = queue[head++];
    const r = Math.floor(cur / cols) + 1, c = (cur % cols) + 1, d = f[cur] + 1;
    for (let dr = -1; dr <= 1; dr++) {
      const nr = r + dr;
      if (nr < 1 || nr > rows) continue;
      for (let dc = -1; dc <= 1; dc++) {
        const nc = c + dc;
        if ((dr === 0 && dc === 0) || nc < 1 || nc > cols) continue;
        const ni = (nr - 1) * cols + (nc - 1);
        if (f[ni] !== INF) continue;
        if (nr === riverRow && !bridges.includes(nc)) continue; // water
        const occ = state.grid[ni];
        if (occ && occ.kind !== 'unit') continue;               // tower / building
        f[ni] = d; queue[tail++] = ni;
      }
    }
  }
  if (cachedFields > 20000) { fieldCache.clear(); cachedFields = 0; byGoal = null; }
  if (!byGoal) { byGoal = []; fieldCache.set(key, byGoal); }
  byGoal[goal] = f;
  cachedFields++;
  return f;
}

/**
 * v1.4 lanes: a unit placed in the left half of the board uses the leftmost bridge and attacks the left tower,
 * a unit placed in the right half uses the rightmost bridge and the right tower, a unit placed in the middle column
 * uses the middle bridge and goes for the King's castle. (v1.3 used the nearest bridge and the nearest tower with
 * ties broken to the left, so every unit that crossed the middle bridge turned left.)
 * Bridge columns ordered by preference: the lane's bridge first, then the others by distance.
 */
function laneBridge(state, lane) {
  const b = state.cfg.board.bridgeCols, mid = Math.ceil(state.cols / 2);
  if (lane < 0) return Math.min(...b);
  if (lane > 0) return Math.max(...b);
  return b.slice().sort((x, y) => Math.abs(x - mid) - Math.abs(y - mid))[0];
}
function bridgeOrder(state, u) {
  const first = laneBridge(state, u.lane || 0), col = u.col;
  return state.cfg.board.bridgeCols.slice().sort((a, b) =>
    (a === first ? -1 : 0) - (b === first ? -1 : 0) || Math.abs(a - col) - Math.abs(b - col));
}

/** The enemy tower of the unit's lane if it still stands (left / right small tower, or the castle), else null. */
export function laneTarget(state, u) {
  const lane = u.lane || 0;
  let best = null;
  for (const e of state.entities) {
    if (e.side === u.side || e.kind !== 'tower') continue;
    if (lane === 0) { if (e.cardId === 'tower_king') return e; continue; }
    if (e.cardId === 'tower_king') continue;
    if (!best || (lane < 0 ? e.col < best.col : e.col > best.col)) best = e;
  }
  // a small tower on the other side of the board is not "our" tower
  const mid = Math.ceil(state.cols / 2);
  if (best && Math.sign(best.col - mid) !== lane) return null;
  return best;
}

/** Nearest enemy tower/building (Chebyshev; tie -> lower HP, then lower id). */
export function nearestEnemyBuilding(state, u) {
  let best = null, bd = INF;
  const ents = state.entities;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.side === u.side || e.kind === 'unit') continue;
    const d = chebyshev(u.row, u.col, e.row, e.col);
    if (d < bd || (d === bd && (e.hp < best.hp || (e.hp === best.hp && e.id < best.id)))) { best = e; bd = d; }
  }
  return best;
}

/** Decide the goal cell for the unit's next step. Returns { row, col, field } or null. */
function goalFor(state, u) {
  const riverRow = state.cfg.board.riverRow;
  const before = u.side === PLAYER ? u.row > riverRow : u.row < riverRow;
  if (before) {
    const ui = cellIndex(state, u.row, u.col);
    for (const bc of bridgeOrder(state, u)) {
      const f = distanceField(state, riverRow, bc);
      if (f[ui] !== INF) return { row: riverRow, col: bc, field: f };
    }
    return null;
  }
  const b = laneTarget(state, u) || nearestEnemyBuilding(state, u);
  if (!b) return null;
  return { row: b.row, col: b.col, field: distanceField(state, b.row, b.col) };
}

/** Move one step toward the goal. Returns true if the unit moved. */
function stepUnit(state, u) {
  const g = goalFor(state, u);
  if (!g) return false;
  const { cols, rows } = state;
  const f = g.field;
  const cur = f[cellIndex(state, u.row, u.col)];
  let bestR = 0, bestC = 0, bestD = cur, bestTie = 1e9;
  for (let dr = -1; dr <= 1; dr++) {
    const nr = u.row + dr;
    if (nr < 1 || nr > rows) continue;
    for (let dc = -1; dc <= 1; dc++) {
      const nc = u.col + dc;
      if ((dr === 0 && dc === 0) || nc < 1 || nc > cols) continue;
      const ni = (nr - 1) * cols + (nc - 1);
      const d = f[ni];
      if (d >= cur || state.grid[ni]) continue;   // must reduce the distance and be free
      // tie-break: column closer to the goal column (diagonal step toward the bridge), then row closer, then left
      const tie = Math.abs(nc - g.col) * 100 + Math.abs(nr - g.row) * 10 + nc;
      if (d < bestD || (d === bestD && tie < bestTie)) { bestD = d; bestTie = tie; bestR = nr; bestC = nc; }
    }
  }
  if (!bestR) return false; // blocked: wait
  state.grid[cellIndex(state, u.row, u.col)] = null;
  u.row = bestR; u.col = bestC;
  state.grid[cellIndex(state, bestR, bestC)] = u;
  ev(state, { t: 'move', id: u.id, row: bestR, col: bestC });
  return true;
}

/** Move a unit up to `steps` cells; it stops as soon as an enemy is within its range. */
export function moveUnit(state, u, steps) {
  let moved = 0;
  for (let s = 0; s < steps; s++) {
    if (!stepUnit(state, u)) break;
    moved++;
    if (anyEnemyInRange(state, u)) break;
  }
  return moved;
}
