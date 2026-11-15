// Entry point of the AI: chooseMove(state, side, level, opts). Works in Node, in the browser and in a Web Worker.
import { cloneState, asFirstPlanner } from '../engine/state.js';
import { endTurn, playCard } from '../engine/rules.js';
import { makeRng } from '../engine/rng.js';
import { makeView } from './view.js';
import { settle } from './movegen.js';
import { easyPlayTurn } from './easy.js';
import { chooseMinimax } from './minimax.js';
import { chooseMcts } from './mcts.js';
import { explain, describeActions } from './explain.js';
import { evalScore, sigmoid } from './evaluate.js';

export const LEVELS = ['easy', 'medium', 'hard'];
export const LEVEL_HY = { easy: 'Հեշտ', medium: 'Միջին', hard: 'Դժվար' };
/** Easy level: the priority rule that produced a card (shown in the AI panel). */
export const EASY_RULE_HY = {
  defend: 'Կանոն 1. թշնամին մոտ է իմ աշտարակին → ամենաուժեղ հասանելի զորքը նրա կողքին',
  legend: 'Կանոն 2. ոսկին բավարարում է լեգենդար քարտին → դնել կամրջի դիմաց',
  cheapest: 'Կանոն 3. հակառակ դեպքում ամենաէժան զորքը՝ կամրջի դիմաց',
  spell: 'Կանոն 4. զորք չկա → օգտակար հմայք',
  building: 'Կանոն 4. զորք չկա → կառույց կամրջի դիմաց',
  random: 'Պատահական օրինական քայլ (30% հավանականությամբ)',
};
const plain = (actions) => actions.map(a => ({ cardId: a.cardId, row: a.row, col: a.col }));
export const ALGO_HY = {
  easy: 'Կանոնների վրա հիմնված (առանց առաջ նայելու)',
  medium: 'Minimax + Alpha-Beta հատում',
  hard: 'Monte Carlo Tree Search (UCB1)',
};

function passCandidate(view) {
  const after = cloneState(view);
  endTurn(after);
  return { actions: [], after: settle(after) };
}

/**
 * Choose the AI's whole turn.
 * @param state  real game state (the AI only looks at it through makeView)
 * @param side   side the AI plays. Must be called at the start of a round's planning (before the opponent's
 *               cards of this round are on the board): the AI always searches as the first planner.
 * @param level  'easy' | 'medium' | 'hard'
 * @param opts   { seed, timeMs, iterations, maxDepth }
 * @returns { actions, stats, top, explanation, deltas }
 */
export function chooseMove(state, side, level, opts = {}) {
  const t0 = performance.now();
  const view = makeView(state.turn === side ? state : asFirstPlanner(state, side), side);
  const ai = view.cfg.ai;
  const pass = passCandidate(view);
  let chosen, top = [], stats, options = 2, winProb = null;
  if (level === 'easy') {
    const st = cloneState(view);
    const actions = easyPlayTurn(st, makeRng(opts.seed ?? 1), ai.easyMaxCards, ai.easyRandomness);
    endTurn(st);
    chosen = { actions, after: st };
    stats = { nodes: actions.length + 1, depth: 0, rules: actions.map(a => EASY_RULE_HY[a.rule] || '') };
    top = [{ text: describeActions(actions), chosen: true, actions: plain(actions) }];
  } else if (level === 'medium') {
    const r = chooseMinimax(view, side, { timeMs: opts.timeMs, maxDepth: opts.maxDepth });
    chosen = r.cand;
    stats = r.stats;
    options = r.ranked.length;
    top = r.ranked.slice(0, 3).map((x, i) => ({ text: describeActions(x.cand.actions), score: x.score, bound: x.bound, chosen: i === 0, actions: plain(x.cand.actions) }));
    if (r.ranked.length) winProb = sigmoid(r.ranked[0].score, ai.sigmoidScale);
  } else {
    const r = chooseMcts(view, side, { timeMs: opts.timeMs, iterations: opts.iterations, seed: opts.seed });
    chosen = r.cand;
    stats = r.stats;
    options = r.ranked.length;
    top = r.ranked.slice(0, 3).map((x, i) => ({ text: describeActions(x.cand.actions), winRate: x.winRate, visits: x.visits, chosen: i === 0, actions: plain(x.cand.actions) }));
    if (r.ranked.length) winProb = r.ranked[0].winRate;
  }
  const settled = settle(chosen.after);
  const ex = explain(view, side, { actions: chosen.actions, after: settled }, pass, options <= 1);
  // the AI's own estimate of its winning chances (drawn as a chart in the AI panel)
  if (winProb === null || winProb === undefined || Number.isNaN(winProb)) winProb = sigmoid(evalScore(settled, side), ai.sigmoidScale);
  stats.winProb = winProb;
  stats.timeMs = performance.now() - t0;
  stats.level = level;
  stats.levelHy = LEVEL_HY[level];
  stats.algorithmHy = ALGO_HY[level];
  return {
    actions: plain(chosen.actions),
    stats, top, explanation: ex.text, deltas: ex.deltas,
  };
}

/**
 * Apply a chosen turn to the real state (placements only; the caller ends the turn).
 * The AI decides at the start of the round, and the opponent's simultaneous cards may change the position
 * (e.g. a bounty that paid for the last card did not happen). Such no-longer-legal placements are skipped.
 * @returns number of placements actually made
 */
export function applyTurn(state, actions, side = state.turn) {
  let n = 0;
  for (const a of actions) if (playCard(state, a.cardId, a.row, a.col, -1, side)) n++;
  return n;
}
