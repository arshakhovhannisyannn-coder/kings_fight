// Candidate generation. A "turn move" is a list of 0-3 placements { cardId, row, col }.
// Only affordable cards and "useful" cells/targets are considered; permutations are de-duplicated.
import { CARDS } from '../data/cards.js';
import { cloneState, entityAt, chebyshev, PLAYER } from '../engine/state.js';
import { playCard, endTurn } from '../engine/rules.js';
import { freeZoneCells, areaCells } from '../engine/cards-effects.js';
import { evalScore } from './evaluate.js';

/**
 * State used to SCORE a candidate. After the first planner ends planning the battle has not happened yet,
 * so the position is scored after the opponent passes and the battle runs ("null move" estimate).
 * After the second planner the battle already ran and the state is returned as is.
 */
export function settle(after) {
  if (after.winner !== null || after.turn === after.firstSide) return after;
  const s = cloneState(after);
  endTurn(s);
  return s;
}

export function actionKey(a) { return a.cardId + ':' + a.row + ':' + a.col; }

/** Front (river-side) and back rows of a side's placement zone. */
export function zoneRows(state, side) {
  const z = state.cfg.zones[side];
  return side === PLAYER ? { front: z[0], back: z[1] } : { front: z[1], back: z[0] };
}

/** Enemy units that are on our half of the board or on the river. */
function intruders(state, side) {
  const river = state.cfg.board.riverRow;
  return state.entities.filter(e => e.side !== side && e.kind === 'unit' && (side === PLAYER ? e.row >= river : e.row <= river));
}

/** Useful placement cells for a unit/building card. */
export function smartCells(state, side, def) {
  const free = freeZoneCells(state, side);
  if (state.cfg.ai.candidateCells === 'all' || free.length <= 3) return free;
  const { front, back } = zoneRows(state, side);
  const bridges = state.cfg.board.bridgeCols;
  const foes = intruders(state, side);
  const towers = state.entities.filter(e => e.side === side && e.kind === 'tower');
  const reach = Math.max(1, Math.min(def.range || 1, 2));
  const out = [];
  for (const cell of free) {
    let useful = false;
    if (bridges.includes(cell.col) && (cell.row === front || def.range >= 2 || def.type === 'building')) useful = true;
    if (!useful) {
      for (const f of foes) {
        if (chebyshev(cell.row, cell.col, f.row, f.col) <= reach) { useful = true; break; }
        // cells next to a tower that this enemy threatens
        for (const t of towers) {
          if (chebyshev(f.row, f.col, t.row, t.col) <= 3 && chebyshev(cell.row, cell.col, t.row, t.col) <= 1) { useful = true; break; }
        }
        if (useful) break;
      }
    }
    if (useful) out.push(cell);
  }
  return out.length ? out : free;
}

/** Best targets for "Vahagn's fire": areas that hit at least one enemy, best first. */
export function vahagnTargets(state, side, limit = 3) {
  const seen = new Set();
  const out = [];
  for (let r = 1; r < state.rows; r++) {
    for (let c = 1; c < state.cols; c++) {
      let value = 0, key = '', hits = 0;
      for (const [rr, cc] of areaCells(r, c)) {
        const e = entityAt(state, rr, cc);
        if (!e || e.side === side || e.kind === 'tower') continue;
        hits++;
        key += e.id + ',';
        const cost = CARDS[e.cardId].cost;
        value += e.hp <= 3 && !e.revive && !e.invuln && e.shield === 0 ? cost + 1 : cost * 3 / e.maxHp;
      }
      if (!hits || seen.has(key)) continue;
      seen.add(key);
      out.push({ row: r, col: c, value, hits });
    }
  }
  out.sort((a, b) => b.value - a.value);
  return out.slice(0, limit);
}

/** Useful targets for a spell (may be empty when the spell would do nothing). */
export function spellTargets(state, side, def) {
  const own = state.entities.filter(e => e.side === side && e.kind === 'unit');
  switch (def.ability) {
    case 'vahagn': return vahagnTargets(state, side);
    case 'ararat': {
      let heal = 0;
      for (const e of own) heal += Math.max(0, Math.min(2, e.maxHp - e.hp));
      return heal >= 2 ? [{ row: 0, col: 0 }] : [];
    }
    case 'horn': return own.filter(e => e.speed > 0).length >= 2 ? [{ row: 0, col: 0 }] : [];
    case 'anahit': {
      const foes = state.entities.filter(e => e.side !== side && e.atk > 0);
      return own
        .filter(u => !u.invuln && foes.some(f => chebyshev(u.row, u.col, f.row, f.col) <= Math.max(f.range, 1) + 1))
        .sort((a, b) => CARDS[b.cardId].cost - CARDS[a.cardId].cost || a.id - b.id)
        .slice(0, 2).map(u => ({ row: u.row, col: u.col }));
    }
    default: return [];
  }
}

/** Single-placement candidates for the side to move. */
export function singleCandidates(state) {
  const side = state.turn;
  const out = [];
  if (state.winner !== null || state.cardsPlayed[side] >= state.cfg.maxCardsPerTurn) return out;
  const gold = state.gold[side];
  const hand = state.hands[side];
  for (let i = 0; i < hand.length; i++) {
    const cardId = hand[i];
    if (hand.indexOf(cardId) !== i) continue;
    const def = CARDS[cardId];
    if (def.cost > gold) continue;
    const targets = def.type === 'spell' ? spellTargets(state, side, def) : smartCells(state, side, def);
    for (const t of targets) out.push({ cardId, row: t.row, col: t.col });
  }
  return out;
}

function cmpDesc(a, b) { return a.m < b.m ? 1 : a.m > b.m ? -1 : 0; }

/**
 * Generate candidate turn moves for the side to move.
 * Every candidate is simulated (placements + resolution) and scored with the evaluation function,
 * so each one carries the resulting state `after` (other side to move) and `score` (from evalSide's view).
 * Returned best-first for the mover (descending score if mover === evalSide, ascending otherwise).
 * @param beam  beam widths per placement level, e.g. [12, 6, 3]
 */
export function generateTurns(state, beam, evalSide) {
  const sign = state.turn === evalSide ? 1 : -1;
  const out = [];
  const seen = new Set(['']);
  const record = (st, actions) => {
    const after = cloneState(st);
    endTurn(after);
    const score = evalScore(settle(after), evalSide);
    const c = { actions, after, score, m: sign * score };
    out.push(c);
    return c;
  };
  record(state, []);
  // level 0: every single placement is simulated on its own; its value also ranks it at deeper levels
  const rank = new Map();
  let level = [];
  for (const s of singleCandidates(state)) {
    const st = cloneState(state);
    if (!playCard(st, s.cardId, s.row, s.col)) continue;
    const key = actionKey(s);
    seen.add(key);
    const c = record(st, [s]);
    rank.set(key, c.m);
    level.push({ st, actions: c.actions, keys: [key], m: c.m });
  }
  level.sort(cmpDesc);
  level = level.slice(0, beam[0]);
  const maxCards = Math.min(state.cfg.maxCardsPerTurn - state.cardsPlayed[state.turn], beam.length);
  for (let depth = 1; depth < maxCards && level.length; depth++) {
    const next = [];
    for (const node of level) {
      const known = [], fresh = [];
      for (const s of singleCandidates(node.st)) {
        const key = actionKey(s);
        const m = rank.get(key);
        if (m === undefined) { if (!fresh.some(f => f.s.cardId === s.cardId)) fresh.push({ s, key, m: 0 }); }
        else known.push({ s, key, m });
      }
      known.sort(cmpDesc);
      const picks = known.slice(0, beam[depth]).concat(fresh.slice(0, 1));
      for (const p of picks) {
        const keys = node.keys.concat(p.key).sort();
        const full = keys.join('|');
        if (seen.has(full)) continue;
        seen.add(full);
        const st = cloneState(node.st);
        if (!playCard(st, p.s.cardId, p.s.row, p.s.col)) continue;
        const c = record(st, node.actions.concat(p.s));
        next.push({ st, actions: c.actions, keys, m: c.m });
      }
    }
    level = next;
  }
  out.sort(cmpDesc);
  return out;
}
