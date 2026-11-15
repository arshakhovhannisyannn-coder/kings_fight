// Information the AI is allowed to see. The AI never reads the opponent's real hand or deck order.
// Public knowledge: the opponent's 8-card deck list and the cards the opponent has played.
// Because a played card goes to the bottom of a 4-card queue, the last 4 played cards are known NOT to be in hand.
import { cloneState } from '../engine/state.js';
import { shuffle } from '../engine/rng.js';

/** Cards of `opp` whose position is unknown to the other side (deck list minus the known queue tail). */
export function unknownCards(state, opp) {
  const pool = state.decks[opp].slice();
  for (const id of state.lastPlayed[opp]) {
    const i = pool.indexOf(id);
    if (i >= 0) pool.splice(i, 1);
  }
  return pool;
}

/**
 * Pessimistic view for `side`: the opponent's hand is replaced by ALL cards that could be in it
 * ("virtual hand"); the opponent's queue holds only the cards known to be there.
 */
export function makeView(state, side) {
  const v = cloneState(state);
  const opp = 1 - side;
  v.hands[opp] = unknownCards(state, opp);
  v.queues[opp] = state.lastPlayed[opp].slice();
  v.virtualHand = opp;
  return v;
}

/** Determinization: sample a plausible hand and deck order for the opponent. Returns { hand, queue }. */
export function sampleOpponent(view, opp, rnd) {
  const pool = shuffle(unknownCards(view, opp), rnd);
  const n = view.cfg.handSize;
  return { hand: pool.slice(0, n), queue: pool.slice(n).concat(view.lastPlayed[opp]) };
}

/**
 * Check that a sequence of placements can be played from (hand, queue) with the cycling rule.
 * On success the arrays are updated in place and true is returned; on failure they may be partially changed.
 */
export function playCardsOnHand(actions, hand, queue) {
  for (let k = 0; k < actions.length; k++) {
    const id = actions[k].cardId;
    const i = hand.indexOf(id);
    if (i < 0) return false;
    if (queue.length) hand[i] = queue.shift(); else hand.splice(i, 1);
    queue.push(id);
  }
  return true;
}
