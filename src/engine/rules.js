// Rules: legal actions, playing cards, the planning/battle round structure, victory.
//
// A round = PLANNING (both sides place cards at the same time) + BATTLE (cfg.battleTicks ticks in which
// the units of BOTH sides act). For search the engine models the simultaneous planning sequentially:
// state.firstSide plans, endTurn() passes planning to the other side, and the second endTurn() runs the battle.
import { CARDS } from '../data/cards.js';
import { ev, startRound, PLAYER } from './state.js';
import { cardTargets, isLegalTarget, applyCardEffect } from './cards-effects.js';
import { pickTargetForUnit, pickTargetForTower, attack } from './combat.js';
import { moveUnit } from './movement.js';

/** Can `side` (default: the side to move) play this card right now (gold and per-round card limit)? */
export function canPlayCard(state, cardId, side = state.turn) {
  return state.winner === null && state.cardsPlayed[side] < state.cfg.maxCardsPerTurn && CARDS[cardId].cost <= state.gold[side];
}

/** All legal actions for the side to move: { type:'play', handIndex, cardId, row, col } and { type:'end' }. */
export function legalActions(state) {
  const out = [];
  if (state.winner !== null) return out;
  const side = state.turn;
  const hand = state.hands[side];
  const seen = new Set();
  for (let i = 0; i < hand.length; i++) {
    const cardId = hand[i];
    if (seen.has(cardId)) continue;
    seen.add(cardId);
    if (!canPlayCard(state, cardId)) continue;
    for (const t of cardTargets(state, side, cardId)) out.push({ type: 'play', handIndex: i, cardId, row: t.row, col: t.col });
  }
  out.push({ type: 'end' });
  return out;
}

/**
 * Play a card from the hand of `side` (default: the side to move). Returns false (and changes nothing) if illegal.
 * The played card is immediately replaced by the next card of the deck queue and goes to the queue's end.
 * During the real game the player may place cards while the engine's planning turn belongs to the AI:
 * both sides plan at the same time, so any side may play during planning.
 */
export function playCard(state, cardId, row, col, handIndex = -1, side = state.turn) {
  const hand = state.hands[side];
  let i = handIndex >= 0 && hand[handIndex] === cardId ? handIndex : hand.indexOf(cardId);
  if (i < 0 || !canPlayCard(state, cardId, side) || !isLegalTarget(state, side, cardId, row, col)) return false;
  state.gold[side] -= CARDS[cardId].cost;
  state.cardsPlayed[side]++;
  const queue = state.queues[side];
  if (state.virtualHand === side || queue.length === 0) hand.splice(i, 1);
  else hand[i] = queue.shift();
  queue.push(cardId);
  const lp = state.lastPlayed[side];
  lp.push(cardId);
  if (lp.length > state.cfg.deckSize - state.cfg.handSize) lp.shift();
  ev(state, { t: 'play', side, cardId, row, col });
  applyCardEffect(state, side, cardId, row, col);
  return true;
}

/** Apply an action object. Throws on an illegal action. */
export function applyAction(state, action) {
  if (action.type === 'end') { endTurn(state); return state; }
  if (!playCard(state, action.cardId, action.row, action.col, action.handIndex ?? -1)) {
    throw new Error(`Illegal action: ${JSON.stringify(action)}`);
  }
  return state;
}

/** Units of one side act front to back: attack an enemy in range, otherwise move. */
function unitsAct(state, side) {
  const cfg = state.cfg;
  const canNewAttack = cfg.newUnitCanAttack, canNewMove = cfg.newUnitCanMove;
  const acting = [];
  const ents = state.entities;
  for (let i = 0; i < ents.length; i++) if (ents[i].side === side && ents[i].kind === 'unit') acting.push(ents[i]);
  // most advanced first; ties left to right
  if (side === PLAYER) acting.sort((a, b) => a.row - b.row || a.col - b.col);
  else acting.sort((a, b) => b.row - a.row || a.col - b.col);
  const bonus = state.horn[side] ? 1 : 0;
  for (let i = 0; i < acting.length && state.winner === null; i++) {
    const u = acting[i];
    if (u.dead) continue;
    const target = pickTargetForUnit(state, u);
    if (target) {
      // an enemy is in range: attack if allowed, otherwise hold position
      if (u.atk > 0 && (!u.isNew || canNewAttack)) attack(state, u, target);
    } else if (u.speed > 0 && (!u.isNew || canNewMove)) {
      moveUnit(state, u, u.speed + bonus);
    }
  }
}

/** Towers and shooting buildings of one side fire. */
function shootersFire(state, side) {
  const canNewAttack = state.cfg.newUnitCanAttack;
  const shooters = [];
  const ents = state.entities;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.side === side && e.kind !== 'unit' && e.atk > 0) shooters.push(e);
  }
  for (let i = 0; i < shooters.length && state.winner === null; i++) {
    const t = shooters[i];
    if (t.dead || (t.isNew && !canNewAttack)) continue;
    const target = pickTargetForTower(state, t);
    if (target) attack(state, t, target);
  }
}

/**
 * Battle phase: cfg.battleTicks ticks. In every tick the units of both sides act (the side that acts first
 * alternates from tick to tick and from round to round, so neither side has a fixed advantage), then the towers
 * and buildings of both sides fire. A unit placed this round may move in the first tick but attacks from the second.
 */
function battle(state) {
  const ticks = state.cfg.battleTicks;
  for (let k = 0; k < ticks && state.winner === null; k++) {
    const first = (state.round + k) % 2, second = 1 - first;
    ev(state, { t: 'tick', n: k, of: ticks });
    unitsAct(state, first);
    if (state.winner === null) unitsAct(state, second);
    if (state.winner === null) shootersFire(state, first);
    if (state.winner === null) shootersFire(state, second);
    const ents = state.entities;
    for (let i = 0; i < ents.length; i++) ents[i].isNew = false;
  }
  state.horn = [false, false];
}

/**
 * One side's half of a battle tick: its units act, then its towers/buildings fire; its new units stop being new.
 * The battle phase is made of these steps; exported for unit tests of single interactions.
 */
export function sideStep(state, side) {
  unitsAct(state, side);
  if (state.winner === null) shootersFire(state, side);
  for (const e of state.entities) if (e.side === side) e.isNew = false;
  state.horn[side] = false;
  return state;
}

function towerHpSum(state, side) {
  let s = 0;
  for (const e of state.entities) if (e.side === side && e.kind === 'tower') s += e.hp;
  return s;
}

/** After the last round: more destroyed towers wins, then more total tower HP, otherwise a draw. */
function decideByTowers(state) {
  const [d0, d1] = state.towersDestroyed;
  if (d0 !== d1) { state.winner = d0 > d1 ? 0 : 1; state.winReason = 'towers'; }
  else {
    const h0 = towerHpSum(state, 0), h1 = towerHpSum(state, 1);
    if (h0 !== h1) { state.winner = h0 > h1 ? 0 : 1; state.winReason = 'hp'; }
    else { state.winner = 'draw'; state.winReason = 'draw'; }
  }
  ev(state, { t: 'win', winner: state.winner, reason: state.winReason });
}

/** Has the side to move the second (last) planning turn of the round, i.e. will endTurn run the battle? */
export function isSecondPlanner(state) { return state.turn !== state.firstSide; }

/**
 * End the planning of the side to move. The first planner just passes planning to the other side;
 * the second one triggers the battle phase, the victory check and the next round.
 */
export function endTurn(state) {
  if (state.winner !== null) return state;
  if (state.turn === state.firstSide) {
    state.turn = 1 - state.turn;
    state.turnCount++;
    return state;
  }
  ev(state, { t: 'resolve', round: state.round });
  battle(state);
  if (state.winner !== null) return state;
  if (state.round >= state.cfg.rounds) { decideByTowers(state); return state; }
  state.round++;
  startRound(state);
  return state;
}

/** Finish the whole round from any planning point: both remaining planners pass, then the battle runs. */
export function endRound(state) {
  if (state.winner !== null) return state;
  if (state.turn === state.firstSide) endTurn(state);
  return endTurn(state);
}

export function checkWinner(state) { return state.winner; }

/** Stars for the campaign: 1 = win, 2 = win without losing a tower, 3 = enemy King's castle destroyed. */
export function starsFor(state, side = PLAYER) {
  if (state.winner !== side) return 0;
  if (state.winReason === 'king') return 3;
  return state.towersDestroyed[1 - side] === 0 ? 2 : 1;
}
