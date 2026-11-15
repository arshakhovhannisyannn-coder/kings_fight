// Test helpers: build small custom positions on top of a fresh game.
import { CONFIG, makeConfig } from '../src/data/config.js';
import { CARDS, STARTER_DECK } from '../src/data/cards.js';
import { createGame, addEntity, entityAt, sideStep } from '../src/engine/index.js';

/**
 * The v1.2 geometry and rules (5×7 board, flat range-1 towers, new units attack from the 2nd tick).
 * Most interaction tests were written with hand-placed coordinates on this board, so they keep using it;
 * the v1.3 defaults (9×11, distance-scaled towers, new units attack at once) are covered in v13.test.js.
 */
export const LEGACY = {
  board: { cols: 5, rows: 7, riverRow: 4, bridgeCols: [1, 3, 5] },
  zones: [[5, 6], [2, 3]],
  newUnitCanAttack: false,
  towers: { small: { hp: 15, atk: 1, range: 1, atkByDist: [] }, king: { hp: 25, atk: 2, range: 1, atkByDist: [] } },
};

/** Fresh game (legacy 5×7 rules unless overridden) in which the player (side 0) is the first planner. */
export function newGame(overrides = null, extra = {}) {
  const cfg = makeConfig(overrides || {}, makeConfig(LEGACY, CONFIG));
  return createGame({ deckP: STARTER_DECK, deckA: STARTER_DECK, seed: 1, cfg, events: true, first: 0, ...extra });
}

/**
 * Unit-test step: the side in state.turn acts once (units, then towers/buildings) and state.turn flips.
 * Used to test single interactions (abilities, targeting, movement) independently of the round structure.
 */
export function step(state) {
  sideStep(state, state.turn);
  state.turn = 1 - state.turn;
  return state;
}

/** Put a veteran (not "new") unit or building on the board. */
export function put(state, side, cardId, row, col, props = {}) {
  const def = CARDS[cardId];
  const e = addEntity(state, side, def.type === 'building' ? 'building' : 'unit', cardId, def, row, col);
  e.isNew = false;
  Object.assign(e, props);
  return e;
}

/** Give the side a specific hand and plenty of gold. */
export function give(state, side, cards, gold = 99) {
  state.hands[side] = cards.slice();
  state.gold[side] = gold;
}

export function tower(state, side, col) {
  return entityAt(state, side === 0 ? state.rows : 1, col);
}
export function byId(state, id) { return state.entities.find(e => e.id === id); }
