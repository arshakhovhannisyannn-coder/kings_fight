// v1.3 rules: 9×11 board, towers that hit harder at close range, new units may attack in the first tick.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, makeConfig } from '../src/data/config.js';
import { STARTER_DECK } from '../src/data/cards.js';
import { createGame, endRound, entityAt, playCard, legalActions } from '../src/engine/index.js';
import { towerAtkAt } from '../src/engine/combat.js';
import { put, give, tower } from './helpers.js';

const fresh = (extra = {}) => createGame({ deckP: STARTER_DECK, deckA: STARTER_DECK, seed: 1, events: true, first: 0, ...extra });

test('v1.3 board: 9×11, towers in the outer columns and the middle, zones = own half', () => {
  const s = fresh();
  assert.equal(s.cols, 9);
  assert.equal(s.rows, 11);
  for (const [side, row] of [[0, 11], [1, 1]]) {
    assert.equal(entityAt(s, row, 1).cardId, 'tower_small');
    assert.equal(entityAt(s, row, 9).cardId, 'tower_small');
    assert.equal(entityAt(s, row, 5).cardId, 'tower_king');
  }
  give(s, 0, ['spearman', 'archer', 'slinger', 'cavalry']);
  const rows = new Set(legalActions(s).filter(a => a.type === 'play' && a.cardId === 'spearman').map(a => a.row));
  assert.deepEqual([...rows].sort((a, b) => a - b), [7, 8, 9, 10]);
});

test('tower damage grows as the enemy comes closer', () => {
  const s = fresh();
  const small = tower(s, 0, 1), king = tower(s, 0, 5);
  const n = CONFIG.towers.small.atkByDist.length;
  const ds = Array.from({ length: n }, (_, i) => i + 1);
  assert.deepEqual(ds.map(d => towerAtkAt(s, small, d)), CONFIG.towers.small.atkByDist);
  assert.deepEqual(ds.map(d => towerAtkAt(s, king, d)), CONFIG.towers.king.atkByDist);
  for (let i = 1; i < n; i++) assert.ok(CONFIG.towers.small.atkByDist[i] <= CONFIG.towers.small.atkByDist[i - 1], 'closer = stronger');
  // an enemy spearman at the far edge of the small tower's range (out of the king's range) takes the far-range damage
  const far = put(s, 1, 'spearman', 11 - n, 1, { speed: 0 }); // stays n cells away
  const hp0 = far.hp;
  s.cfg = makeConfig({ battleTicks: 1 }, s.cfg);
  endRound(s);
  const shot = s.events.filter(e => e.t === 'dmg' && e.id === far.id);
  assert.ok(shot.length >= 1);
  assert.equal(shot[0].amount, CONFIG.towers.small.atkByDist[n - 1]);
  assert.ok(far.hp < hp0 || far.dead);
});

test('a newly placed defender strikes in the first tick', () => {
  const s = fresh({ cfg: makeConfig({ battleTicks: 1 }) });
  const foe = put(s, 1, 'spearman', 7, 3);
  give(s, 0, ['spearman', 'archer', 'slinger', 'cavalry']);
  assert.ok(playCard(s, 'spearman', 8, 3));
  const mine = entityAt(s, 8, 3);
  endRound(s);
  assert.ok(s.events.some(e => e.t === 'attack' && e.id === mine.id && e.target === foe.id), 'the new unit attacked at once');
});

test('path cache on a large board: units walk to the right bridge and the right tower (regression)', () => {
  // v1.2 keyed the path cache by sum(2^cell), which loses precision beyond 53 cells: on 9×11 different goals
  // shared one cache entry and units walked to wrong targets, so towers were never reached (100% draws).
  const s = fresh();
  const right = put(s, 0, 'spearman', 9, 9, { speed: 1 });   // before the river, right edge -> bridge in column 9
  const left = put(s, 0, 'spearman', 9, 1, { speed: 1 });    // left edge -> bridge in column 1
  const deep = put(s, 0, 'spearman', 3, 6, { speed: 1 });    // already across -> the King's castle at (1, 5)
  s.cfg = makeConfig({ battleTicks: 1 }, s.cfg);
  for (let i = 0; i < 3; i++) endRound(s);
  assert.equal(right.col, 9, 'right unit keeps to the right bridge');
  assert.equal(left.col, 1, 'left unit keeps to the left bridge');
  assert.ok(right.row < 9 && left.row < 9, 'both units advanced');
  assert.ok(Math.max(Math.abs(deep.row - 1), Math.abs(deep.col - 5)) <= 1, 'the deep unit reached the castle');
});

test('a full Medium-vs-Easy game finishes on the 9×11 board', async () => {
  const { playGame } = await import('../tools/selfplay.js');
  const r = playGame({ agents: [{ level: 'medium', maxDepth: 2, timeMs: 150 }, { level: 'easy' }], decks: [STARTER_DECK, STARTER_DECK], seed: 3 });
  assert.ok(r.winner === 0 || r.winner === 1 || r.winner === 'draw');
});
