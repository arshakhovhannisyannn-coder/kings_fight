import test from 'node:test';
import assert from 'node:assert/strict';
import { STARTER_DECK } from '../src/data/cards.js';
import { BATTLES } from '../src/data/campaign.js';
import { createGame, endTurn, playCard, cloneState, isLegalTarget, serializeState, hydrateState } from '../src/engine/index.js';
import { chooseMove, applyTurn } from '../src/ai/index.js';
import { evaluate, evalScore } from '../src/ai/evaluate.js';
import { makeView, sampleOpponent, unknownCards } from '../src/ai/view.js';
import { generateTurns } from '../src/ai/movegen.js';
import { easyPlayTurn } from '../src/ai/easy.js';
import { makeRng } from '../src/engine/rng.js';
import { playGame } from '../tools/selfplay.js';
import { newGame, put, tower } from './helpers.js';

function midGame(seed = 5, turns = 9) {
  const s = createGame({ deckP: STARTER_DECK, deckA: STARTER_DECK, seed });
  for (let i = 0; i < turns; i++) { easyPlayTurn(s, null, 3, 0); endTurn(s); }
  return s;
}

test('evaluation: formula, feature breakdown and perspective', () => {
  const s = newGame();
  const base = evaluate(s, 1);
  assert.equal(base.score, 0.5 * (s.gold[1] - s.gold[0]));
  tower(s, 0, 3).hp -= 2;      // player's king castle
  tower(s, 0, 1).hp -= 1;
  put(s, 1, 'cataphract', 5, 3, { hp: 6 });   // AI unit across the river, half HP
  put(s, 0, 'spearman', 2, 1);                // player unit next to an AI tower
  const e = evaluate(s, 1);
  assert.equal(e.features.king.value, 5 * 2);
  assert.equal(e.features.towers.value, 3 * 1);
  assert.equal(e.features.army.value, 2 * (6 * 0.5 - 2));
  assert.equal(e.features.crossed.value, 0);
  assert.equal(e.features.threat.value, -2);
  assert.equal(e.score, evalScore(s, 1));
  assert.ok(Object.values(e.features).every(f => typeof f.labelHy === 'string'));
  s.winner = 1; s.winReason = 'king';
  assert.equal(evalScore(s, 1), Infinity);
  assert.equal(evalScore(s, 0), -Infinity);
});

test('fairness: the AI view hides the opponent hand and deck order', () => {
  const s = midGame();
  const view = makeView(s, 1);
  assert.equal(view.virtualHand, 0);
  // the virtual hand contains every card that could be in hand; cards known to be in the queue are excluded
  const unknown = unknownCards(s, 0);
  assert.deepEqual(view.hands[0].slice().sort(), unknown.slice().sort());
  for (const id of s.hands[0]) assert.ok(view.hands[0].includes(id));
  assert.deepEqual(view.hands[1], s.hands[1]);         // own hand is known exactly
  const det = sampleOpponent(view, 0, makeRng(3));
  assert.equal(det.hand.length, 4);
  assert.deepEqual(det.hand.concat(det.queue).sort(), STARTER_DECK.slice().sort());
  // changing the opponent's real (hidden) hand order must not change the AI's decision
  const t = cloneState(s);
  const pool = t.hands[0].concat(t.queues[0].slice(0, t.queues[0].length - t.lastPlayed[0].length));
  const known = t.queues[0].slice(t.queues[0].length - t.lastPlayed[0].length);
  pool.reverse();
  t.hands[0] = pool.slice(0, 4); t.queues[0] = pool.slice(4).concat(known);
  const side = s.turn;
  if (side === 1) {
    const a = chooseMove(s, 1, 'medium', { maxDepth: 2 }), b = chooseMove(t, 1, 'medium', { maxDepth: 2 });
    assert.deepEqual(a.actions, b.actions);
  }
});

test('move generation: candidates are legal, de-duplicated and include the pass move', () => {
  const s = midGame(8, 12);
  const cands = generateTurns(makeView(s, s.turn), s.cfg.ai.beamRoot, s.turn);
  assert.ok(cands.length >= 2);
  assert.ok(cands.some(c => c.actions.length === 0));
  const keys = new Set(cands.map(c => c.actions.map(a => `${a.cardId}:${a.row}:${a.col}`).sort().join('|')));
  assert.equal(keys.size, cands.length);
  for (const c of cands) {
    assert.ok(c.actions.length <= s.cfg.maxCardsPerTurn);
    const t = cloneState(s);
    assert.doesNotThrow(() => applyTurn(t, c.actions));
  }
  for (let i = 1; i < cands.length; i++) assert.ok(cands[i - 1].score >= cands[i].score);
});

test('every AI level returns a legal move within its time budget', () => {
  for (const seed of [1, 2, 3]) {
    for (const turns of [0, 7, 16, 31]) {
      const s = midGame(seed, turns);
      if (s.winner !== null) continue;
      for (const [level, opts, limit] of [['easy', {}, 100], ['medium', { timeMs: 300 }, 600], ['hard', { timeMs: 150 }, 400]]) {
        const t0 = performance.now();
        const m = chooseMove(s, s.turn, level, { seed, ...opts });
        const dt = performance.now() - t0;
        assert.ok(dt < limit, `${level} took ${dt.toFixed(0)} ms`);
        assert.ok(m.actions.length <= s.cfg.maxCardsPerTurn);
        const t = cloneState(s);
        for (const a of m.actions) assert.ok(isLegalTarget(t, t.turn, a.cardId, a.row, a.col) && playCard(t, a.cardId, a.row, a.col), `${level}: illegal ${JSON.stringify(a)}`);
        assert.ok(t.gold[s.turn] >= 0);
        assert.ok(m.explanation.length > 10 && /[Ա-և]/.test(m.explanation));
        assert.ok(m.top.length >= 1 && m.top.filter(x => x.chosen).length === 1);
        assert.ok(m.stats.algorithmHy && m.stats.timeMs >= 0);
      }
    }
  }
});

test('AI takes an immediate win when one exists', () => {
  for (const level of ['medium', 'hard']) {
    const s = newGame();
    endTurn(s);
    tower(s, 0, 3).hp = 2;
    put(s, 1, 'spearman', 6, 3);
    const m = chooseMove(s, 1, level, { iterations: 300, seed: 1 });
    applyTurn(s, m.actions);
    endTurn(s);
    assert.equal(s.winner, 1);
  }
});

test('AI state survives the worker serialization round trip', () => {
  const s = midGame(4, 10);
  const copy = hydrateState(JSON.parse(JSON.stringify(serializeState(s))));
  const a = chooseMove(s, s.turn, 'hard', { iterations: 200, seed: 9 });
  const b = chooseMove(copy, copy.turn, 'hard', { iterations: 200, seed: 9 });
  assert.deepEqual(a.actions, b.actions);
});

test('same seed => same game (engine + all AI levels with fixed budgets)', () => {
  const agents = [{ level: 'hard', iterations: 120 }, { level: 'medium', maxDepth: 2 }];
  const a = playGame({ agents, decks: [STARTER_DECK, STARTER_DECK], seed: 77 });
  const b = playGame({ agents, decks: [STARTER_DECK, STARTER_DECK], seed: 77 });
  delete a.avgThinkMs; delete b.avgThinkMs;
  assert.deepEqual(a, b);
  const e1 = playGame({ agents: [{ level: 'easy' }, { level: 'easy' }], decks: [STARTER_DECK, STARTER_DECK], seed: 5 });
  const e2 = playGame({ agents: [{ level: 'easy' }, { level: 'easy' }], decks: [STARTER_DECK, STARTER_DECK], seed: 5 });
  delete e1.avgThinkMs; delete e2.avgThinkMs;
  assert.deepEqual(e1, e2);
});

test('all campaign battles can be played to the end by the AI', () => {
  for (const b of BATTLES) {
    const r = playGame({
      agents: [{ level: 'medium', maxDepth: 2 }, { level: b.aiLevel === 'hard' ? 'hard' : b.aiLevel, iterations: 60, maxDepth: 2 }],
      decks: [STARTER_DECK, b.aiDeck], seed: b.seed,
    });
    assert.ok([0, 1, 'draw'].includes(r.winner), b.id);
    assert.ok(r.rounds <= 20);
  }
});
