// Card effects: where a card may be played and what happens when it is.
import { CARDS } from '../data/cards.js';
import { addEntity, entityAt, ev, chebyshev, inZone } from './state.js';
import { dealDamage } from './combat.js';

/** Free cells of a side's placement zone. */
export function freeZoneCells(state, side) {
  const out = [];
  const z = state.cfg.zones[side];
  for (let r = z[0]; r <= z[1]; r++)
    for (let c = 1; c <= state.cols; c++)
      if (!entityAt(state, r, c)) out.push({ row: r, col: c });
  return out;
}

/** Cells of the 2x2 area whose top-left cell is (row, col). */
export function areaCells(row, col) {
  return [[row, col], [row, col + 1], [row + 1, col], [row + 1, col + 1]];
}

/** Legal targets for a card: array of { row, col }. Untargeted spells use { row: 0, col: 0 }. */
export function cardTargets(state, side, cardId) {
  const def = CARDS[cardId];
  if (def.type !== 'spell') return freeZoneCells(state, side);
  switch (def.ability) {
    case 'vahagn': {
      const out = [];
      for (let r = 1; r < state.rows; r++) for (let c = 1; c < state.cols; c++) out.push({ row: r, col: c });
      return out;
    }
    case 'anahit':
      return state.entities.filter(e => e.side === side && e.kind === 'unit').map(e => ({ row: e.row, col: e.col }));
    default:
      return [{ row: 0, col: 0 }];
  }
}

export function isLegalTarget(state, side, cardId, row, col) {
  const def = CARDS[cardId];
  if (def.type !== 'spell') {
    return row >= 1 && col >= 1 && col <= state.cols && inZone(state, side, row) && !entityAt(state, row, col);
  }
  switch (def.ability) {
    case 'vahagn': return row >= 1 && row < state.rows && col >= 1 && col < state.cols;
    case 'anahit': {
      if (row < 1 || row > state.rows || col < 1 || col > state.cols) return false;
      const e = entityAt(state, row, col);
      return !!e && e.side === side && e.kind === 'unit';
    }
    default: return true;
  }
}

function nearestFreeZoneCells(state, side, row, col, count) {
  return freeZoneCells(state, side)
    .sort((a, b) => chebyshev(row, col, a.row, a.col) - chebyshev(row, col, b.row, b.col) || a.row - b.row || a.col - b.col)
    .slice(0, count);
}

/** Apply the effect of a card that has already been paid for. */
export function applyCardEffect(state, side, cardId, row, col) {
  const def = CARDS[cardId];
  const enemy = 1 - side;
  if (def.type === 'spell') {
    switch (def.ability) {
      case 'vahagn': {
        const cells = areaCells(row, col);
        ev(state, { t: 'spell', cardId, side, cells });
        for (const [r, c] of cells) {
          const e = entityAt(state, r, c);
          if (e && e.side === enemy && e.kind !== 'tower') dealDamage(state, e, 3, side, null, false);
        }
        break;
      }
      case 'ararat':
        ev(state, { t: 'spell', cardId, side, cells: [] });
        for (const e of state.entities) {
          if (e.side !== side || e.kind !== 'unit' || e.hp >= e.maxHp) continue;
          const heal = Math.min(2, e.maxHp - e.hp);
          e.hp += heal;
          ev(state, { t: 'heal', id: e.id, amount: heal, hp: e.hp });
        }
        break;
      case 'horn':
        state.horn[side] = true;
        ev(state, { t: 'spell', cardId, side, cells: [] });
        break;
      case 'anahit': {
        const e = entityAt(state, row, col);
        e.invuln = true;
        ev(state, { t: 'spell', cardId, side, cells: [[row, col]] });
        ev(state, { t: 'buff', id: e.id, kind: 'invuln' });
        break;
      }
    }
    return;
  }
  if (def.type === 'building') { addEntity(state, side, 'building', cardId, def, row, col); return; }
  if (def.type === 'special') {
    // squad: several token units on the target cell and the nearest free cells of the own zone
    const tokenDef = CARDS[def.spawn];
    for (const cell of nearestFreeZoneCells(state, side, row, col, def.spawnCount)) {
      addEntity(state, side, 'unit', def.spawn, tokenDef, cell.row, cell.col);
    }
    return;
  }
  addEntity(state, side, 'unit', cardId, def, row, col);
  // on-placement abilities
  switch (def.ability) {
    case 'hayk': {
      let best = null;
      for (const e of state.entities) {
        if (e.side !== enemy || e.kind !== 'unit') continue;
        if (!best || e.hp > best.hp || (e.hp === best.hp && e.id < best.id)) best = e;
      }
      if (best) { ev(state, { t: 'spell', cardId, side, cells: [[best.row, best.col]] }); dealDamage(state, best, 5, side, null, false); }
      break;
    }
    case 'summonLegion':
      for (const cell of nearestFreeZoneCells(state, side, row, col, 2)) {
        addEntity(state, side, 'unit', 'legionary', CARDS.legionary, cell.row, cell.col);
      }
      break;
    case 'rally':
      for (const e of state.entities) {
        if (e.side === side && e.kind === 'unit') { e.hp += 2; ev(state, { t: 'heal', id: e.id, amount: 2, hp: e.hp }); }
      }
      break;
    case 'barrage':
      ev(state, { t: 'spell', cardId, side, cells: [] });
      for (const e of state.entities.filter(x => x.side === enemy && x.kind === 'unit')) dealDamage(state, e, 2, side, null, false);
      break;
  }
}
