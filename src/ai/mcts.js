// Hard level: Monte Carlo Tree Search with UCB1, determinization of hidden information
// and rollouts driven by the Easy policy. One tree edge = one full side turn.
import { cloneState } from '../engine/state.js';
import { endTurn } from '../engine/rules.js';
import { makeRng } from '../engine/rng.js';
import { generateTurns } from './movegen.js';
import { evalScore, sigmoid } from './evaluate.js';
import { easyPlayTurn } from './easy.js';
import { sampleOpponent, playCardsOnHand } from './view.js';
import { chooseMinimax } from './minimax.js';

const now = () => performance.now();

function makeNode(parent, cand, state, depth) {
  return { parent, cand, state, depth, cands: null, children: null, visits: 0, value: 0 };
}

/** Rollout: both sides follow the deterministic Easy policy for `rounds` rounds, then the position is evaluated. */
function rollout(state, side, ai) {
  const turns = ai.rolloutRounds * 2;
  for (let t = 0; t < turns && state.winner === null; t++) {
    easyPlayTurn(state, null, ai.rolloutMaxCards, 0);
    endTurn(state);
  }
  if (state.winner !== null) return state.winner === side ? 1 : state.winner === 'draw' ? 0.5 : 0;
  return sigmoid(evalScore(state, side), ai.sigmoidScale);
}

/**
 * @param view  state as seen by `side` (opponent's hand = pessimistic virtual hand)
 * @param opts  { timeMs, iterations, seed }  (iterations gives a deterministic budget)
 * @returns { cand, ranked: [{ cand, visits, winRate }], stats }
 */
export function chooseMcts(view, side, opts = {}) {
  const ai = view.cfg.ai;
  const t0 = now();
  const opp = 1 - side;
  const rnd = makeRng(opts.seed ?? 1);
  const maxIter = opts.iterations ?? Infinity;
  const deadline = opts.iterations ? Infinity : t0 + (opts.timeMs ?? ai.mctsTimeMs);
  const c = ai.mctsC;
  let nodes = 1, maxDepth = 0, iterations = 0, prior = 0;

  const root = makeNode(null, null, view, 0);
  const expand = (node) => {
    const isRoot = node === root;
    const list = generateTurns(node.state, isRoot ? ai.beamRoot : ai.beamInner, side);
    node.cands = list.slice(0, isRoot ? ai.mctsRootK : ai.mctsInnerK);
    node.children = new Array(node.cands.length).fill(null);
  };
  expand(root);
  // Priors: a shallow Minimax search ranks the root moves; each root child starts with a few "virtual visits"
  // whose value is the Minimax score squashed to [0,1]. Rollouts then confirm or overturn this first opinion.
  if (ai.mctsPriorVisits > 0 && root.cands.length > 1) {
    const budget = opts.iterations ? 0 : (opts.timeMs ?? ai.mctsTimeMs) * 0.3;
    const mm = chooseMinimax(view, side, { maxDepth: ai.mctsPriorDepth, timeMs: budget || undefined });
    root.cands = mm.ranked.slice(0, ai.mctsRootK).map(r => r.cand);
    root.children = root.cands.map((cand, i) => {
      const ch = makeNode(root, cand, cand.after, 1);
      ch.visits = ai.mctsPriorVisits;
      ch.value = ai.mctsPriorVisits * sigmoid(mm.ranked[i].score, ai.sigmoidScale);
      root.visits += ch.visits; root.value += ch.value;
      return ch;
    });
    nodes += root.children.length;
    prior = root.visits;
  }

  while (iterations < maxIter && (iterations & 7 || now() < deadline)) {
    iterations++;
    // 0. determinization: sample the opponent's hidden hand and deck order
    const det = sampleOpponent(view, opp, rnd);
    let oh = det.hand, oq = det.queue;
    // 1. selection (+ 2. expansion of one new child)
    let node = root;
    for (;;) {
      if (node.state.winner !== null) break;
      if (!node.cands) {
        if (node.visits < ai.mctsExpandVisits) break;
        expand(node);
      }
      const oppMoves = node.state.turn === opp;
      // progressive widening: the number of children grows with the number of visits
      const allowed = Math.max(1, Math.ceil(ai.mctsWidenC * Math.pow(node.visits + 1, ai.mctsWidenAlpha)));
      let seenOk = 0, pick = -1, pickNew = false, bestU = -Infinity, pickHand = null, pickQueue = null;
      const logN = Math.log(node.visits + 1);
      for (let i = 0; i < node.cands.length && seenOk < allowed; i++) {
        let h = null, q = null;
        if (oppMoves && node.cands[i].actions.length) {
          // the opponent's move must be playable from the sampled hand
          h = oh.slice(); q = oq.slice();
          if (!playCardsOnHand(node.cands[i].actions, h, q)) continue;
        }
        seenOk++;
        const ch = node.children[i];
        if (!ch) { pick = i; pickNew = true; pickHand = h; pickQueue = q; break; }
        const mean = ch.value / ch.visits;
        const u = (oppMoves ? 1 - mean : mean) + c * Math.sqrt(logN / ch.visits);
        if (u > bestU) { bestU = u; pick = i; pickHand = h; pickQueue = q; }
      }
      if (pick < 0) break;
      if (pickHand) { oh = pickHand; oq = pickQueue; }
      if (pickNew) {
        const cand = node.cands[pick];
        node = node.children[pick] = makeNode(node, cand, cand.after, node.depth + 1);
        nodes++;
        break;
      }
      node = node.children[pick];
    }
    if (node.depth > maxDepth) maxDepth = node.depth;
    // 3. simulation from the determinized state
    let v;
    if (node.state.winner !== null) v = node.state.winner === side ? 1 : node.state.winner === 'draw' ? 0.5 : 0;
    else {
      const s = cloneState(node.state);
      s.virtualHand = -1;
      s.hands[opp] = oh.slice();
      s.queues[opp] = oq.slice();
      v = rollout(s, side, ai);
    }
    // 4. backpropagation
    for (let n = node; n; n = n.parent) { n.visits++; n.value += v; }
  }

  const ranked = [];
  for (let i = 0; i < root.cands.length; i++) {
    const ch = root.children[i];
    if (ch) ranked.push({ cand: root.cands[i], visits: ch.visits, winRate: ch.value / ch.visits });
  }
  ranked.sort((a, b) => b.visits - a.visits || b.winRate - a.winRate);
  if (!ranked.length) ranked.push({ cand: root.cands[0], visits: 0, winRate: 0.5 });
  return {
    cand: ranked[0].cand,
    ranked,
    stats: { iterations, nodes, depth: maxDepth, timeMs: now() - t0, priorVisits: prior, winRate: root.visits ? root.value / root.visits : 0.5 },
  };
}
