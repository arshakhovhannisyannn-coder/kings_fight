// CLI: AI vs AI without Electron.
// node tools/selfplay.js --a=medium --b=hard --games=100 --seed=1 --mctsMs=200 --deckA=starter --deckB=starter --swapSides
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG, makeConfig } from '../src/data/config.js';
import { STARTER_DECK } from '../src/data/cards.js';
import { DECK_PRESETS } from '../src/data/campaign.js';
import { createGame, endTurn, mixSeed } from '../src/engine/index.js';
import { chooseMove, applyTurn } from '../src/ai/index.js';
import { makeView } from '../src/ai/view.js';
import { easyPlayTurn } from '../src/ai/easy.js';
import { asFirstPlanner, cloneState, makeRng } from '../src/engine/index.js';

/**
 * Human proxy for balance tests (level 'human'): the Easy policy, but 40% of its cards are random legal
 * moves and it plays only 1-2 cards per round, like a casual player who does not use all the gold.
 */
export function humanLikeMove(state, side, seed = 1) {
  const rnd = makeRng(seed);
  const st = cloneState(makeView(state.turn === side ? state : asFirstPlanner(state, side), side));
  const maxCards = 1 + Math.floor(rnd() * 2);
  const actions = easyPlayTurn(st, rnd, maxCards, 0.4);
  return { actions: actions.map(a => ({ cardId: a.cardId, row: a.row, col: a.col })), stats: { timeMs: 0, level: 'human' } };
}

export function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (m) out[m[1]] = m[2] === undefined ? true : m[2];
  }
  return out;
}

export function resolveDeck(name) {
  if (Array.isArray(name)) return name;
  if (!name || name === 'starter') return STARTER_DECK;
  if (DECK_PRESETS[name]) return DECK_PRESETS[name].cards;
  return String(name).split(',');
}

/**
 * Play one game. Agents: { level, timeMs, iterations, maxDepth, cfg } for side 0 (bottom) and side 1 (top).
 * Returns { winner, reason, rounds, first, towersDestroyed, thinkMs: [a, b] }.
 */
export function playGame({ agents, decks, seed = 1, first = 0, cfg = CONFIG }) {
  const state = createGame({ deckP: decks[0], deckA: decks[1], seed, cfg, first });
  const thinkMs = [0, 0], turns = [0, 0];
  while (state.winner === null) {
    // both sides decide from the same round-start position (simultaneous planning), then the cards are
    // applied in the engine's planning order and the battle runs
    const moves = [0, 1].map(side => {
      const ag = agents[side];
      // an agent may use its own config (e.g. different evaluation weights) for thinking
      const saved = state.cfg;
      if (ag.cfg) state.cfg = ag.cfg;
      const move = ag.level === 'human' ? humanLikeMove(state, side, mixSeed(seed, state.turnCount, side)) : chooseMove(state, side, ag.level, {
        seed: mixSeed(seed, state.turnCount, side), timeMs: ag.timeMs, iterations: ag.iterations, maxDepth: ag.maxDepth,
      });
      state.cfg = saved;
      thinkMs[side] += move.stats.timeMs; turns[side]++;
      return move;
    });
    for (let k = 0; k < 2 && state.winner === null; k++) {
      applyTurn(state, moves[state.turn].actions);
      endTurn(state);
    }
  }
  return {
    winner: state.winner, reason: state.winReason, rounds: state.round, first,
    towersDestroyed: state.towersDestroyed.slice(),
    avgThinkMs: [thinkMs[0] / Math.max(1, turns[0]), thinkMs[1] / Math.max(1, turns[1])],
  };
}

/**
 * Play a series between agent A and agent B.
 * With swapSides, odd games put A on the top side; the first mover alternates every game.
 */
export function playSeries({ a, b, games = 10, seed = 1, deckA = STARTER_DECK, deckB = STARTER_DECK, swapSides = true, cfg = CONFIG, onGame = null }) {
  const res = { games, winsA: 0, winsB: 0, draws: 0, rounds: 0, firstMoverWins: 0, secondMoverWins: 0,
    byReason: { king: 0, towers: 0, hp: 0, draw: 0 }, thinkA: 0, thinkB: 0, winsAasFirst: 0, gamesAasFirst: 0, towersA: 0, towersB: 0 };
  for (let g = 0; g < games; g++) {
    const aSide = swapSides && g % 2 === 1 ? 1 : 0;
    const first = swapSides ? (g >> 1) % 2 : 0;
    const agents = aSide === 0 ? [a, b] : [b, a];
    const decks = aSide === 0 ? [deckA, deckB] : [deckB, deckA];
    const r = playGame({ agents, decks, seed: mixSeed(seed, g), first, cfg });
    if (r.winner === 'draw') res.draws++;
    else if (r.winner === aSide) res.winsA++; else res.winsB++;
    if (r.winner !== 'draw') { if (r.winner === r.first) res.firstMoverWins++; else res.secondMoverWins++; }
    if (first === aSide) { res.gamesAasFirst++; if (r.winner === aSide) res.winsAasFirst++; }
    res.byReason[r.reason]++;
    res.rounds += r.rounds;
    res.towersA += r.towersDestroyed[aSide]; res.towersB += r.towersDestroyed[1 - aSide];
    res.thinkA += r.avgThinkMs[aSide]; res.thinkB += r.avgThinkMs[1 - aSide];
    if (onGame) onGame(g, r, res);
  }
  res.avgRounds = res.rounds / games;
  res.winRateA = (res.winsA + res.draws / 2) / games;
  res.winRateB = (res.winsB + res.draws / 2) / games;
  res.firstMoverWinRate = (res.firstMoverWins + res.draws / 2) / games;
  res.avgThinkMsA = res.thinkA / games; res.avgThinkMsB = res.thinkB / games;
  return res;
}

export function agentFromArgs(level, args) {
  const ag = { level };
  if (level === 'hard') {
    if (args.mctsIters) ag.iterations = Number(args.mctsIters); else ag.timeMs = Number(args.mctsMs ?? 200);
  } else if (level === 'medium') {
    if (args.medMs) ag.timeMs = Number(args.medMs);
    if (args.medDepth) ag.maxDepth = Number(args.medDepth);
  }
  return ag;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const games = Number(args.games ?? 10), seed = Number(args.seed ?? 1);
  const a = agentFromArgs(args.a ?? 'medium', args), b = agentFromArgs(args.b ?? 'easy', args);
  const cfg = args.rounds ? makeConfig({ rounds: Number(args.rounds) }) : CONFIG;
  const t0 = Date.now();
  const res = playSeries({
    a, b, games, seed, deckA: resolveDeck(args.deckA), deckB: resolveDeck(args.deckB), swapSides: !!args.swapSides, cfg,
    onGame: (g, r) => { if (!args.quiet) process.stderr.write(`խաղ ${g + 1}/${games}: հաղթող=${r.winner} (${r.reason}), ռաունդ ${r.rounds}\n`); },
  });
  const out = { a, b, seed, ...res, seconds: (Date.now() - t0) / 1000 };
  const pct = x => (100 * x).toFixed(1) + '%';
  const summary = [
    `Ինքնախաղ. A=${a.level} ընդդեմ B=${b.level}, ${games} խաղ, seed=${seed}`,
    `  A հաղթանակներ՝ ${res.winsA}, B հաղթանակներ՝ ${res.winsB}, ոչ-ոքի՝ ${res.draws}`,
    `  A հաղթելու տոկոս՝ ${pct(res.winRateA)}, B հաղթելու տոկոս՝ ${pct(res.winRateB)}`,
    `  Խաղի միջին տևողություն՝ ${res.avgRounds.toFixed(1)} ռաունդ`,
    `  Առաջին քայլ կատարողի հաղթելու տոկոս՝ ${pct(res.firstMoverWinRate)}`,
    `  Ավարտի տեսակներ՝ ամրոց=${res.byReason.king}, աշտարակներ=${res.byReason.towers}, կյանք=${res.byReason.hp}, ոչ-ոքի=${res.byReason.draw}`,
    `  Մտածելու միջին ժամանակ (մվ/քայլ)՝ A=${res.avgThinkMsA.toFixed(0)}, B=${res.avgThinkMsB.toFixed(0)}`,
    `  Ընդհանուր ժամանակ՝ ${out.seconds.toFixed(1)} վ`,
  ].join('\n');
  console.log(summary);
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'experiments');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `selfplay_${a.level}_vs_${b.level}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  fs.writeFileSync(file.replace(/\.json$/, '.txt'), summary + '\n');
  console.log(`\nJSON՝ ${path.relative(process.cwd(), file)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
