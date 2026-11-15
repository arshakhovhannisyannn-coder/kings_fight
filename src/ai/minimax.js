// Medium level: Minimax with Alpha-Beta pruning and iterative deepening.
// One ply = one full side turn (placements + resolution).
import { generateTurns } from './movegen.js';
import { evalScore } from './evaluate.js';

const TIMEOUT = { timeout: true };
const now = () => performance.now();

function search(state, depth, alpha, beta, ctx) {
  if (state.winner !== null) return evalScore(state, ctx.side);
  if (now() > ctx.deadline) throw TIMEOUT;
  const ai = state.cfg.ai;
  // candidates arrive already simulated and scored, best-first for the side to move
  const cands = generateTurns(state, ai.beamInner, ctx.side);
  ctx.nodes += cands.length;
  if (depth <= 1) return cands[0].score; // leaf ply: static evaluations of the children
  const k = Math.min(cands.length, ai.opponentTopK);
  if (state.turn === ctx.side) {
    let v = -Infinity;
    for (let i = 0; i < k; i++) {
      const s = search(cands[i].after, depth - 1, alpha, beta, ctx);
      if (s > v) v = s;
      if (v > alpha) alpha = v;
      if (alpha >= beta) { ctx.cutoffs++; break; }
    }
    return v;
  }
  let v = Infinity;
  for (let i = 0; i < k; i++) {
    const s = search(cands[i].after, depth - 1, alpha, beta, ctx);
    if (s < v) v = s;
    if (v < beta) beta = v;
    if (alpha >= beta) { ctx.cutoffs++; break; }
  }
  return v;
}

/**
 * @param view  state as seen by `side` (opponent's hand is the pessimistic virtual hand)
 * @param opts  { timeMs, maxDepth }  timeMs = 0/undefined -> no time limit (deterministic fixed depth)
 * @returns { cand, ranked: [{ cand, score, bound }], stats }
 */
export function chooseMinimax(view, side, opts = {}) {
  const ai = view.cfg.ai;
  const t0 = now();
  // depth ai.minimaxDepth is always completed; deeper iterations (up to maxDepth) respect the time budget
  const maxDepth = opts.maxDepth ?? ai.minimaxMaxDepth;
  const realDeadline = opts.timeMs ? t0 + opts.timeMs : Infinity;
  const ctx = { side, nodes: 0, cutoffs: 0, deadline: Infinity };
  const root = generateTurns(view, ai.beamRoot, side);
  ctx.nodes += root.length;
  let ranked = root.map(c => ({ cand: c, score: c.score, bound: false }));
  let depthDone = 1, partial = false;
  for (let d = 2; d <= maxDepth; d++) {
    if (d > ai.minimaxDepth) { ctx.deadline = realDeadline; if (now() > realDeadline) break; }
    const list = ranked.slice(0, ai.minimaxRootK);
    const cur = [];
    let alpha = -Infinity;
    try {
      for (const r of list) {
        const v = search(r.cand.after, d - 1, alpha, Infinity, ctx);
        cur.push({ cand: r.cand, score: v, bound: d > 2 && v <= alpha && cur.length > 0 });
        if (v > alpha) alpha = v;
      }
    } catch (e) {
      if (e !== TIMEOUT) throw e;
    }
    if (cur.length === 0) break;
    // stable sort keeps the previous order among equal scores
    cur.sort((a, b) => (a.score < b.score ? 1 : a.score > b.score ? -1 : 0));
    if (cur.length < list.length) { partial = true; ranked = cur.concat(list.slice(cur.length)); depthDone = d; break; }
    ranked = cur; depthDone = d;
    if (now() > ctx.deadline) break;
  }
  return {
    cand: ranked[0].cand,
    ranked,
    stats: { nodes: ctx.nodes, depth: depthDone, partial, cutoffs: ctx.cutoffs, timeMs: now() - t0 },
  };
}
