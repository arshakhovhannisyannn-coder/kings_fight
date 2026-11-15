// Pure helpers for the UI's placement preview. They run the REAL rules on a copy of the state, so the
// preview can never disagree with what the engine will do (no duplicated movement or damage logic).
import { CARDS } from '../data/cards.js';
import { cloneState, addEntity } from './state.js';
import { isLegalTarget, applyCardEffect } from './cards-effects.js';
import { anyEnemyInRange } from './combat.js';
import { moveUnit } from './movement.js';

/**
 * Where would a unit/building placed on (row, col) go? Returns null if the placement is illegal, otherwise
 * { path: [{row, col}, ...] (first cell = the placement cell), range, atk, speed }.
 * The path follows the movement rules for up to `maxSteps` cells against the current board (other units do
 * not move in the preview) and stops where the unit would stop: an enemy in range or a blocked way.
 */
export function previewPlacement(state, side, cardId, row, col, maxSteps = 4) {
  const def = CARDS[cardId];
  if (!def || def.type === 'spell' || !isLegalTarget(state, side, cardId, row, col)) return null;
  const s = cloneState(state);
  const unitDef = def.type === 'special' ? CARDS[def.spawn] : def;
  const u = addEntity(s, side, def.type === 'building' ? 'building' : 'unit', unitDef.id, unitDef, row, col);
  const path = [{ row, col }];
  if (u.kind === 'unit' && u.speed > 0) {
    for (let i = 0; i < maxSteps; i++) {
      if (anyEnemyInRange(s, u) || !moveUnit(s, u, 1)) break;
      path.push({ row: u.row, col: u.col });
    }
  }
  return { path, range: u.range, atk: u.atk, speed: u.speed };
}

/**
 * What would a spell do? Returns null if illegal, otherwise the list of affected entities:
 * [{ id, side, row, col, hp, hpAfter, dead }] (only entities whose HP or protection would change).
 */
export function previewSpell(state, side, cardId, row, col) {
  const def = CARDS[cardId];
  if (!def || def.type !== 'spell' || !isLegalTarget(state, side, cardId, row, col)) return null;
  const s = cloneState(state);
  const before = new Map(s.entities.map(e => [e.id, { hp: e.hp, invuln: e.invuln, shield: e.shield, side: e.side, row: e.row, col: e.col }]));
  applyCardEffect(s, side, cardId, row, col);
  const after = new Map(s.entities.map(e => [e.id, e]));
  const out = [];
  for (const [id, b] of before) {
    const a = after.get(id);
    if (!a) out.push({ id, side: b.side, row: b.row, col: b.col, hp: b.hp, hpAfter: 0, dead: true });
    else if (a.hp !== b.hp || a.invuln !== b.invuln || a.shield !== b.shield) out.push({ id, side: b.side, row: b.row, col: b.col, hp: b.hp, hpAfter: a.hp, dead: false });
  }
  return out;
}
