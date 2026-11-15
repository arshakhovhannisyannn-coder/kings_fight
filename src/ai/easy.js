// Easy level: priority rules without look-ahead. The same policy (without randomness) drives MCTS rollouts.
import { CARDS } from '../data/cards.js';
import { entityAt, chebyshev } from '../engine/state.js';
import { playCard, legalActions } from '../engine/rules.js';
import { zoneRows, spellTargets } from './movegen.js';

function isUnitCard(def) { return def.type === 'soldier' || def.type === 'hero' || def.type === 'special'; }

/** A free cell in front of a bridge (random bridge with rnd, rotating bridge without). */
function bridgeCell(state, side, rnd) {
  const { front, back } = zoneRows(state, side);
  const cols = state.cfg.board.bridgeCols;
  const start = rnd ? Math.floor(rnd() * cols.length) : (state.turnCount + state.cardsPlayed[side]) % cols.length;
  for (const row of [front, back]) {
    for (let k = 0; k < cols.length; k++) {
      const col = cols[(start + k) % cols.length];
      if (!entityAt(state, row, col)) return { row, col };
    }
  }
  for (const row of [front, back]) for (let col = 1; col <= state.cols; col++) if (!entityAt(state, row, col)) return { row, col };
  return null;
}

/** Free zone cell closest to an enemy (tie -> closer to the threatened tower). */
function defendCell(state, side, foe, tower) {
  const z = state.cfg.zones[side];
  let best = null, bk = 1e9;
  for (let r = z[0]; r <= z[1]; r++) {
    for (let c = 1; c <= state.cols; c++) {
      if (entityAt(state, r, c)) continue;
      const k = chebyshev(r, c, foe.row, foe.col) * 10 + chebyshev(r, c, tower.row, tower.col);
      if (k < bk) { bk = k; best = { row: r, col: c }; }
    }
  }
  return best;
}

/** One card decision by the priority rules. Returns { cardId, row, col } or null. */
export function easyRule(state, rnd = null) {
  const side = state.turn;
  if (state.cardsPlayed[side] >= state.cfg.maxCardsPerTurn) return null;
  const gold = state.gold[side];
  const hand = state.hands[side];
  let best = null, cheapest = null, legend = null;
  for (let i = 0; i < hand.length; i++) {
    const def = CARDS[hand[i]];
    if (def.cost > gold || !isUnitCard(def)) continue;
    if (!best || def.cost > best.cost) best = def;
    if (!cheapest || def.cost < cheapest.cost) cheapest = def;
    if (def.type !== 'soldier' && (!legend || def.cost > legend.cost)) legend = def;
  }
  if (best) {
    // (1) an enemy unit is near one of our towers -> best affordable defender next to it
    const ents = state.entities;
    let foe = null, tower = null, fd = 4;
    for (let i = 0; i < ents.length; i++) {
      const t = ents[i];
      if (t.side !== side || t.kind !== 'tower') continue;
      for (let j = 0; j < ents.length; j++) {
        const e = ents[j];
        if (e.side === side || e.kind !== 'unit') continue;
        const d = chebyshev(e.row, e.col, t.row, t.col);
        if (d < fd) { fd = d; foe = e; tower = t; }
      }
    }
    if (foe) {
      const cell = defendCell(state, side, foe, tower);
      if (cell) return { cardId: best.id, row: cell.row, col: cell.col, rule: 'defend' };
    }
    // (2) a legendary card is affordable -> in front of a bridge; (3) otherwise the cheapest unit
    const cell = bridgeCell(state, side, rnd);
    if (cell) return { cardId: (legend || cheapest).id, row: cell.row, col: cell.col, rule: legend ? 'legend' : 'cheapest' };
    return null;
  }
  // (4) no unit card is affordable: use a spell that does something, or a building
  for (let i = 0; i < hand.length; i++) {
    const def = CARDS[hand[i]];
    if (def.cost > gold) continue;
    if (def.type === 'spell') {
      const t = spellTargets(state, side, def)[0];
      if (t) return { cardId: def.id, row: t.row, col: t.col, rule: 'spell' };
    } else if (def.type === 'building') {
      const cell = bridgeCell(state, side, rnd);
      if (cell) return { cardId: def.id, row: cell.row, col: cell.col, rule: 'building' };
    }
  }
  return null;
}

/** Play a whole planning phase on `state` (mutates it, does not end the turn). Returns the placements. */
export function easyPlayTurn(state, rnd = null, maxCards = 3, randomness = 0) {
  const actions = [];
  for (let n = 0; n < maxCards; n++) {
    let a = null;
    if (rnd && randomness > 0 && rnd() < randomness) {
      const legal = legalActions(state).filter(x => x.type === 'play');
      if (legal.length) { const x = legal[Math.floor(rnd() * legal.length)]; a = { cardId: x.cardId, row: x.row, col: x.col, rule: 'random' }; }
    } else a = easyRule(state, rnd);
    if (!a || !playCard(state, a.cardId, a.row, a.col)) break;
    actions.push(a);
  }
  return actions;
}
