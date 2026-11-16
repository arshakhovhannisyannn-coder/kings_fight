import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/data/config.js';
import { STARTER_DECK, validateDeck } from '../src/data/cards.js';
import { createGame, playCard, endTurn, endRound, legalActions, applyAction, entityAt, starsFor, isWater, cloneState } from '../src/engine/index.js';
import { newGame, put, give, tower, step } from './helpers.js';

test('gold: both sides get start gold plus income every round, unspent gold carries over', () => {
  const s = newGame({ battleTicks: 0 });
  assert.deepEqual(s.gold, [3 + 2, 3 + 2]);      // round 1: start 3 + income 2 for both sides
  const expected = [2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5];
  let total = 3 + 2;
  for (let round = 2; round <= 20; round++) {
    endRound(s);
    total += expected[round - 1];
    assert.equal(s.round, round);
    assert.deepEqual(s.gold, [total, total], `round ${round}`);
  }
});

test('gold cap is applied only when configured', () => {
  const s = newGame({ goldCap: 6, battleTicks: 0 });
  endRound(s); endRound(s);
  assert.equal(s.gold[0], 6);
});

test('bounties: soldier +1, hero +3, building +3', () => {
  const s = newGame();
  put(s, 0, 'cataphract', 5, 2);
  put(s, 1, 'slinger', 4, 3, { hp: 1 });
  let g = s.gold[0];
  step(s);
  assert.equal(s.gold[0], g + 1);

  const h = newGame();
  put(h, 0, 'cataphract', 5, 2);
  put(h, 1, 'tigran', 4, 3, { hp: 1 });
  g = h.gold[0];
  step(h);
  assert.equal(h.gold[0], g + 3);

  const b = newGame();
  put(b, 0, 'cataphract', 4, 3);
  put(b, 1, 'wall', 3, 3, { hp: 1 });
  g = b.gold[0];
  step(b);
  assert.equal(b.gold[0], g + 3);
});

test('at most 3 cards per round', () => {
  const s = newGame();
  give(s, 0, ['spearman', 'spearman', 'spearman', 'spearman']);
  s.queues[0] = ['spearman', 'spearman', 'spearman', 'spearman'];
  assert.ok(playCard(s, 'spearman', 5, 1));
  assert.ok(playCard(s, 'spearman', 5, 2));
  assert.ok(playCard(s, 'spearman', 5, 3));
  assert.equal(playCard(s, 'spearman', 5, 4), false);
  assert.deepEqual(legalActions(s), [{ type: 'end' }]);
  endRound(s);
  assert.ok(playCard(s, 'spearman', 6, 4));   // the limit resets in the next round
});

test('a card that costs more than the available gold cannot be played', () => {
  const s = newGame();
  give(s, 0, ['cataphract', 'spearman', 'archer', 'slinger'], 5);
  assert.equal(playCard(s, 'cataphract', 5, 1), false);
  assert.equal(s.gold[0], 5);
  assert.ok(playCard(s, 'archer', 5, 1));
  assert.equal(s.gold[0], 2);
});

test('hand cycling: played card is replaced immediately and goes to the bottom of the queue', () => {
  const s = newGame();
  s.hands[0] = ['spearman', 'archer', 'slinger', 'cavalry'];
  s.queues[0] = ['cataphract', 'shieldbearer', 'vahagn', 'ararat'];
  s.gold[0] = 50;
  playCard(s, 'archer', 5, 1);
  assert.deepEqual(s.hands[0], ['spearman', 'cataphract', 'slinger', 'cavalry']);
  assert.deepEqual(s.queues[0], ['shieldbearer', 'vahagn', 'ararat', 'archer']);
  playCard(s, 'cataphract', 5, 2);            // the freshly drawn card can be played in the same turn
  assert.deepEqual(s.hands[0], ['spearman', 'shieldbearer', 'slinger', 'cavalry']);
  assert.deepEqual(s.queues[0], ['vahagn', 'ararat', 'archer', 'cataphract']);
  assert.equal(s.hands[0].length, 4);
});

test('placement zones: only empty cells of the own zone', () => {
  const s = newGame();
  give(s, 0, ['spearman', 'archer', 'slinger', 'cavalry']);
  assert.equal(playCard(s, 'spearman', 4, 1), false);  // bridge, not in the zone
  assert.equal(playCard(s, 'spearman', 3, 1), false);  // enemy zone
  assert.equal(playCard(s, 'spearman', 7, 2), false);  // tower row
  assert.ok(playCard(s, 'spearman', 6, 2));
  assert.equal(playCard(s, 'archer', 6, 2), false);    // occupied
  endTurn(s);
  give(s, 1, ['spearman', 'archer', 'slinger', 'cavalry']);
  assert.equal(playCard(s, 'spearman', 5, 1), false);
  assert.ok(playCard(s, 'spearman', 2, 5));
  assert.throws(() => applyAction(s, { type: 'play', cardId: 'archer', row: 6, col: 1 }));
  const cells = legalActions(s).filter(a => a.cardId === 'archer').map(a => a.row);
  assert.ok(cells.every(r => r === 2 || r === 3));
});

test('movement: units funnel to the bridges; water is impassable', () => {
  const s = newGame();
  assert.ok(isWater(s, 4, 2) && isWater(s, 4, 4) && !isWater(s, 4, 3));
  const a = put(s, 0, 'spearman', 6, 2);   // column 2 = left half: lane bridge in column 1, diagonal step
  const b = put(s, 0, 'spearman', 6, 5);   // already in a bridge column: straight ahead
  step(s);
  assert.deepEqual([a.row, a.col], [5, 1]);
  assert.deepEqual([b.row, b.col], [5, 5]);
  step(s); step(s);
  assert.deepEqual([a.row, a.col], [4, 1]);
  assert.deepEqual([b.row, b.col], [4, 5]);
  for (let i = 0; i < 6; i++) { step(s); assert.ok(!entityAt(s, 4, 2) && !entityAt(s, 4, 4)); }
});

test('movement: after crossing, a unit walks to the nearest enemy building and attacks it', () => {
  const s = newGame();
  const u = put(s, 0, 'spearman', 4, 1);
  step(s); step(s);   // (3,1)
  step(s); step(s);   // (2,1) adjacent to the tower at (1,1)
  assert.deepEqual([u.row, u.col], [2, 1]);
  const hp = tower(s, 1, 1).hp;
  step(s);
  assert.equal(tower(s, 1, 1).hp, hp - 2);
});

test('movement: speed 2 moves two cells, a blocked unit side-steps or waits', () => {
  const s = newGame();
  const c = put(s, 0, 'cavalry', 6, 1);
  step(s);
  assert.deepEqual([c.row, c.col], [4, 1]);
  const t = newGame();
  const front = put(t, 0, 'wall', 5, 3);
  const u = put(t, 0, 'spearman', 6, 3);
  step(t);
  assert.ok(front.hp > 0);
  assert.notDeepEqual([u.row, u.col], [5, 3]);       // cannot enter the wall's cell
  assert.equal(u.row, 5);                             // goes around it
});

test('targeting: units attack enemy units first (lowest HP), otherwise buildings', () => {
  const s = newGame();
  const archer = put(s, 0, 'archer', 4, 1);            // range 3: tower (1,1) and both enemies in range
  const strong = put(s, 1, 'cataphract', 3, 1);
  const weak = put(s, 1, 'spearman', 2, 2, { hp: 4 });
  const thp = tower(s, 1, 1).hp;
  step(s);
  assert.equal(weak.hp, 2);
  assert.equal(strong.hp, 12);
  assert.equal(tower(s, 1, 1).hp, thp);
  assert.ok(archer.hp > 0);
});

test('targeting: towers shoot the closest enemy unit in range (range from config)', () => {
  const s = newGame({ towers: { small: { hp: 15, atk: 2, range: 2 }, king: { hp: 25, atk: 3, range: 2 } } });
  step(s);                                          // AI's turn: its towers will fire
  const near = put(s, 0, 'cataphract', 2, 1);
  const far = put(s, 0, 'cataphract', 3, 1);
  step(s);
  assert.equal(near.hp, 12 - 2 - 3);                   // small tower (2) and King's castle (3) both reach it
  assert.equal(far.hp, 12 - 0);
  // default config: range 1 -> a unit two cells away is not hit
  const d = newGame();
  step(d);
  const u = put(d, 0, 'cataphract', 3, 1);
  step(d);
  assert.equal(u.hp, 12);
});

test('a unit placed this turn may move but not attack (newUnitCanAttack=false)', () => {
  const s = newGame();
  give(s, 0, ['spearman', 'archer', 'slinger', 'cavalry']);
  const foe = put(s, 1, 'cataphract', 4, 3);
  playCard(s, 'spearman', 5, 3);
  step(s);
  assert.equal(foe.hp, 12);                            // no attack on the placement turn
  const mover = newGame();
  give(mover, 0, ['spearman', 'archer', 'slinger', 'cavalry']);
  playCard(mover, 'spearman', 6, 1);
  step(mover);
  assert.ok(entityAt(mover, 5, 1));                    // but it does move

  const s2 = newGame({ newUnitCanAttack: true });
  give(s2, 0, ['spearman', 'archer', 'slinger', 'cavalry']);
  const foe2 = put(s2, 1, 'cataphract', 4, 3);
  playCard(s2, 'spearman', 5, 3);
  step(s2);
  assert.equal(foe2.hp, 10);
});

test('victory: destroying the King\'s castle wins immediately with 3 stars', () => {
  const s = newGame();
  put(s, 0, 'cataphract', 2, 3);
  tower(s, 1, 3).hp = 3;
  step(s);
  assert.equal(s.winner, 0);
  assert.equal(s.winReason, 'king');
  assert.equal(starsFor(s, 0), 3);
  assert.deepEqual(legalActions(s), []);
});

test('victory after 20 rounds: more destroyed towers, then more tower HP, then draw', () => {
  const run = (prep) => {
    const s = newGame();
    prep(s);
    for (let i = 0; i < 20; i++) endRound(s);
    return s;
  };
  const draw = run(() => {});
  assert.equal(draw.winner, 'draw');
  assert.equal(draw.round, 20);

  const hp = run(s => { tower(s, 1, 1).hp = 10; });
  assert.equal(hp.winner, 0);
  assert.equal(hp.winReason, 'hp');
  assert.equal(starsFor(hp, 0), 2);

  const tw = run(s => {
    put(s, 0, 'cataphract', 2, 1); tower(s, 1, 1).hp = 1;   // player destroys one tower...
    tower(s, 0, 5).hp = 1; tower(s, 0, 3).hp = 5;           // ...although the AI has more tower HP left
  });
  assert.equal(tw.winner, 0);
  assert.equal(tw.winReason, 'towers');
});

test('stars: 1 star when the winner has lost a tower', () => {
  const s = newGame();
  s.towersDestroyed = [2, 1];
  s.winner = 0; s.winReason = 'towers';
  assert.equal(starsFor(s, 0), 1);
  assert.equal(starsFor(s, 1), 0);
});

test('deck validation', () => {
  assert.ok(validateDeck(STARTER_DECK, CONFIG).ok);
  assert.equal(validateDeck(STARTER_DECK.slice(0, 7), CONFIG).ok, false);
  assert.equal(validateDeck(['spearman', 'spearman', 'spearman', 'spearman', 'archer', 'slinger', 'cavalry', 'vahagn'], CONFIG).ok, false);
  assert.equal(validateDeck(['vahagn', 'vahagn', 'vahagn', 'spearman', 'archer', 'slinger', 'cavalry', 'ararat'], CONFIG).ok, false);
  assert.equal(validateDeck(['hayk', 'hayk', 'spearman', 'spearman', 'archer', 'slinger', 'cavalry', 'ararat'], CONFIG).ok, false);
  assert.equal(validateDeck(['hayk', 'tigran', 'vardan', 'spearman', 'archer', 'slinger', 'cavalry', 'ararat'], CONFIG).ok, false);
  assert.ok(validateDeck(['hayk', 'sardarapat', 'spearman', 'slinger', 'cavalry', 'archer', 'wall', 'vahagn'], CONFIG).ok);
  assert.equal(validateDeck(['spearman', 'spearman', 'archer', 'slinger', 'cavalry', 'shieldbearer', 'vahagn', 'ararat'], CONFIG).ok, false);  // v1.4.1: no copies
  assert.equal(validateDeck(['wall', 'wall', 'archer', 'slinger', 'cavalry', 'shieldbearer', 'vahagn', 'ararat'], CONFIG).ok, false);
  assert.equal(validateDeck(STARTER_DECK.slice(0, 7).concat('hayk'), CONFIG, STARTER_DECK).ok, false);  // not unlocked
});

test('determinism: same seed gives the same shuffle, different seeds differ; clone is independent', () => {
  const a = createGame({ deckP: STARTER_DECK, deckA: STARTER_DECK, seed: 42 });
  const b = createGame({ deckP: STARTER_DECK, deckA: STARTER_DECK, seed: 42 });
  assert.deepEqual(a.hands, b.hands);
  assert.deepEqual(a.queues, b.queues);
  const hands = new Set();
  for (let seed = 1; seed <= 20; seed++) hands.add(createGame({ deckP: STARTER_DECK, deckA: STARTER_DECK, seed }).hands[0].join());
  assert.ok(hands.size > 5);
  const c = cloneState(a);
  give(c, 0, ['spearman', 'archer', 'slinger', 'cavalry']);
  playCard(c, 'spearman', 5, 1);
  assert.equal(entityAt(a, 5, 1), null);
  assert.notEqual(a.gold[0], c.gold[0]);
});

test('planning order: either side can be the first planner; the battle runs after the second one', () => {
  const s = createGame({ deckP: STARTER_DECK, deckA: STARTER_DECK, seed: 1, first: 1 });
  assert.equal(s.turn, 1);
  assert.deepEqual(s.gold, [5, 5]);
  endTurn(s);
  assert.equal(s.round, 1);
  assert.equal(s.turn, 0);
  endTurn(s);
  assert.equal(s.round, 2);
  assert.equal(s.turn, 1);
});

test('simultaneous planning: a side may place cards while the engine turn belongs to the other side', () => {
  const s = createGame({ deckP: STARTER_DECK, deckA: STARTER_DECK, seed: 1, first: 1 });
  give(s, 0, ['spearman', 'archer', 'slinger', 'cavalry']);
  assert.ok(playCard(s, 'spearman', s.cfg.zones[0][0], 1, -1, 0));
  assert.deepEqual(s.cardsPlayed, [1, 0]);
  assert.equal(s.turn, 1);
  assert.equal(playCard(s, 'archer', 2, 1, -1, 0), false);   // still only in the own zone
});

test('battle phase: the units of both sides act in every tick', () => {
  const s = newGame();
  const a = put(s, 0, 'spearman', 6, 1);
  const b = put(s, 1, 'spearman', 2, 5);
  endRound(s);                                  // 3 ticks: each unit walks 3 cells
  assert.deepEqual([a.row, a.col], [3, 1]);
  assert.deepEqual([b.row, b.col], [5, 5]);
  const one = newGame({ battleTicks: 1 });
  const c = put(one, 0, 'spearman', 6, 1);
  endRound(one);
  assert.deepEqual([c.row, c.col], [5, 1]);
});

test('a unit placed this round attacks from the second battle tick', () => {
  const s = newGame();
  give(s, 0, ['spearman', 'archer', 'slinger', 'cavalry']);
  const foe = put(s, 1, 'wall', 4, 3);          // static target right in front of the new unit
  playCard(s, 'spearman', 5, 3);
  endRound(s);
  assert.equal(foe.hp, 12 - 2 * 2);             // ticks 2 and 3 only
});
