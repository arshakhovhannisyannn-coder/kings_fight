// v1.3–v1.4 rules: configurable board (7×9 by default), towers that hit harder at close range,
// new units may attack in the first tick, units keep fighting their target (target lock).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, makeConfig } from '../src/data/config.js';
import { STARTER_DECK } from '../src/data/cards.js';
import { createGame, endRound, entityAt, playCard, legalActions } from '../src/engine/index.js';
import { towerAtkAt } from '../src/engine/combat.js';
import { put, give, tower } from './helpers.js';

const fresh = (extra = {}) => createGame({ deckP: STARTER_DECK, deckA: STARTER_DECK, seed: 1, events: true, first: 0, ...extra });
const B = CONFIG.board;
const mid = Math.ceil(B.cols / 2);
const oneTick = () => fresh({ cfg: makeConfig({ battleTicks: 1 }) });

test('board from the config: size, towers in the outer columns and the middle, zones = own half', () => {
  const s = fresh();
  assert.equal(s.cols, B.cols);
  assert.equal(s.rows, B.rows);
  for (const row of [B.rows, 1]) {
    assert.equal(entityAt(s, row, 1).cardId, 'tower_small');
    assert.equal(entityAt(s, row, B.cols).cardId, 'tower_small');
    assert.equal(entityAt(s, row, mid).cardId, 'tower_king');
  }
  assert.deepEqual(CONFIG.zones[0], [B.riverRow + 1, B.rows - 1]);
  assert.deepEqual(CONFIG.zones[1], [2, B.riverRow - 1]);
  give(s, 0, ['spearman', 'archer', 'slinger', 'cavalry']);
  const rows = new Set(legalActions(s).filter(a => a.type === 'play' && a.cardId === 'spearman').map(a => a.row));
  const expected = [];
  for (let r = CONFIG.zones[0][0]; r <= CONFIG.zones[0][1]; r++) expected.push(r);
  assert.deepEqual([...rows].sort((a, b) => a - b), expected);
});

test('tower damage grows as the enemy comes closer', () => {
  const s = fresh();
  const small = tower(s, 0, 1), king = tower(s, 0, mid);
  const n = CONFIG.towers.small.atkByDist.length;
  const ds = Array.from({ length: n }, (_, i) => i + 1);
  assert.deepEqual(ds.map(d => towerAtkAt(s, small, d)), CONFIG.towers.small.atkByDist);
  assert.deepEqual(ds.map(d => towerAtkAt(s, king, d)), CONFIG.towers.king.atkByDist);
  for (let i = 1; i < n; i++) assert.ok(CONFIG.towers.small.atkByDist[i] <= CONFIG.towers.small.atkByDist[i - 1], 'closer = stronger');
  // an enemy at the far edge of the small tower's range (out of the king's range) takes the far-range damage
  const far = put(s, 1, 'spearman', B.rows - n, 1, { speed: 0 });
  s.cfg = makeConfig({ battleTicks: 1 }, s.cfg);
  endRound(s);
  const shot = s.events.filter(e => e.t === 'dmg' && e.id === far.id);
  assert.ok(shot.length >= 1);
  assert.equal(shot[0].amount, CONFIG.towers.small.atkByDist[n - 1]);
});

test('a newly placed defender strikes in the first tick', () => {
  const s = oneTick();
  const z = CONFIG.zones[0][0];
  const foe = put(s, 1, 'spearman', z, 3, { speed: 0 });
  give(s, 0, ['spearman', 'archer', 'slinger', 'cavalry']);
  assert.ok(playCard(s, 'spearman', z + 1, 3));
  const mine = entityAt(s, z + 1, 3);
  endRound(s);
  assert.ok(s.events.some(e => e.t === 'attack' && e.id === mine.id && e.target === foe.id), 'the new unit attacked at once');
});

test('path cache: units walk to their own bridge and to the castle (regression for boards > 53 cells)', () => {
  // v1.2 keyed the path cache by sum(2^cell), which loses precision beyond 53 cells: on 9×11 different goals
  // shared one cache entry and units walked to wrong targets (100% draws). The test also runs on a 9×11 board.
  for (const board of [B, { cols: 9, rows: 11, riverRow: 6, bridgeCols: [1, 5, 9] }]) {
    const cfg = makeConfig({ board, zones: [[board.riverRow + 1, board.rows - 1], [2, board.riverRow - 1]], battleTicks: 1 });
    const s = fresh({ cfg });
    const m = Math.ceil(board.cols / 2);
    const back = board.rows - 2;
    const right = put(s, 0, 'spearman', back, board.cols);
    const left = put(s, 0, 'spearman', back, 1);
    const deep = put(s, 0, 'spearman', 3, m, { hp: 50, maxHp: 50 }); // straight below the castle (nearest building)
    for (let i = 0; i < 3; i++) endRound(s);
    assert.equal(right.col, board.cols, 'right unit keeps to the right bridge');
    assert.equal(left.col, 1, 'left unit keeps to the left bridge');
    assert.ok(right.row < back && left.row < back, 'both units advanced');
    assert.ok(Math.max(Math.abs(deep.row - 1), Math.abs(deep.col - m)) <= 1, 'the deep unit reached the castle');
  }
});

test('target lock: a unit does not switch to a weaker unit that comes into range', () => {
  const s = oneTick();
  const r = CONFIG.zones[0][0] + 1;
  const a = put(s, 0, 'spearman', r, 3, { speed: 0, hp: 50, maxHp: 50 });
  const b = put(s, 1, 'spearman', r - 1, 3, { speed: 0, hp: 50, maxHp: 50 });
  endRound(s);
  assert.equal(a.lock, b.id);
  assert.equal(b.lock, a.id, 'the attacked unit answers its attacker');
  // a 1-HP enemy appears next to the fighter: without the lock it would be the preferred target
  const weak = put(s, 1, 'slinger', r - 1, 2, { speed: 0, hp: 1, maxHp: 1, atk: 0 });
  s.events.length = 0;
  endRound(s);
  const hits = s.events.filter(e => e.t === 'attack' && e.id === a.id).map(e => e.target);
  assert.deepEqual(hits, [b.id], 'still fighting the first enemy');
  assert.ok(!weak.dead);
});

test('target lock: a unit attacking a tower is not distracted by a newly placed unit', () => {
  const s = oneTick();
  const towerRow = B.rows, z = CONFIG.zones[0];
  const raider = put(s, 1, 'spearman', towerRow - 1, 1, { speed: 0, hp: 50, maxHp: 50 });
  const t = tower(s, 0, 1);
  endRound(s);
  assert.equal(raider.lock, t.id);
  give(s, 0, ['spearman', 'archer', 'slinger', 'cavalry']);
  assert.ok(playCard(s, 'spearman', z[1], 2));
  const defender = entityAt(s, z[1], 2);
  s.events.length = 0;
  endRound(s);
  assert.ok(s.events.some(e => e.t === 'attack' && e.id === raider.id && e.target === t.id), 'keeps hitting the tower');
  assert.ok(!s.events.some(e => e.t === 'attack' && e.id === raider.id && e.target === defender.id));
  assert.ok(s.events.some(e => e.t === 'attack' && e.id === defender.id && e.target === raider.id), 'the defender hits the raider');
});

test('target lock: after the target dies the unit picks a new one; the lock can be switched off', () => {
  const s = oneTick();
  const r = CONFIG.zones[0][0] + 1;
  const a = put(s, 0, 'spearman', r, 3, { speed: 0, hp: 50, maxHp: 50, atk: 10 });
  const b = put(s, 1, 'spearman', r - 1, 3, { speed: 0 });
  const c = put(s, 1, 'spearman', r - 1, 4, { speed: 0 });
  endRound(s);
  assert.ok(b.dead || c.dead);
  endRound(s);
  assert.ok(b.dead && c.dead, 'a new target was chosen after the first one died');
  const off = fresh({ cfg: makeConfig({ battleTicks: 1, targetLock: false }) });
  const x = put(off, 0, 'spearman', r, 3, { speed: 0, hp: 50, maxHp: 50 });
  put(off, 1, 'spearman', r - 1, 3, { speed: 0, hp: 50, maxHp: 50 });
  endRound(off);
  const weak = put(off, 1, 'slinger', r - 1, 2, { speed: 0, hp: 1, maxHp: 1, atk: 0 });
  endRound(off);
  assert.ok(weak.dead, 'without the lock the unit switches to the weakest enemy');
  assert.ok(x.hp > 0);
});

test('lanes: left half -> left bridge and tower, right half -> right, middle column -> castle (both sides)', () => {
  const zones = CONFIG.zones;
  for (const side of [0, 1]) {
    for (let col = 1; col <= B.cols; col++) {
      const s = oneTick();
      for (const e of s.entities) if (e.kind === 'tower') { e.hp = 999; e.atk = 0; }
      const row = side === 0 ? zones[0][1] : zones[1][0];
      const u = put(s, side, 'spearman', row, col, { hp: 999, maxHp: 999 });
      let bridge = null;
      for (let i = 0; i < 25 && !u.lock; i++) { endRound(s); if (u.row === B.riverRow && bridge === null) bridge = u.col; }
      const t = s.entities.find(e => e.id === u.lock);
      const lane = Math.sign(col - mid);
      const wantBridge = lane < 0 ? Math.min(...B.bridgeCols) : lane > 0 ? Math.max(...B.bridgeCols) : mid;
      assert.equal(bridge, wantBridge, `side ${side}, column ${col}: bridge`);
      assert.ok(t, `side ${side}, column ${col}: reached a tower`);
      if (lane === 0) assert.equal(t.cardId, 'tower_king');
      else assert.equal(t.col, lane < 0 ? 1 : B.cols, `side ${side}, column ${col}: lane tower`);
    }
  }
});

test('lanes: when the lane tower is destroyed the unit goes for the nearest remaining target', () => {
  const s = oneTick();
  const left = tower(s, 1, 1);
  left.hp = 1;
  tower(s, 1, mid).hp = 999; // the castle survives, so the unit's new lock can be checked
  const u = put(s, 0, 'spearman', B.riverRow - 1, 1, { hp: 999, maxHp: 999, atk: 50 });
  for (let i = 0; i < 25 && !s.entities.some(e => e.id === u.lock && e.cardId === 'tower_king'); i++) endRound(s);
  assert.ok(left.dead);
  assert.equal(s.entities.find(e => e.id === u.lock)?.cardId, 'tower_king');
});

test('a full Medium-vs-Easy game finishes on the default board', async () => {
  const { playGame } = await import('../tools/selfplay.js');
  const r = playGame({ agents: [{ level: 'medium', maxDepth: 2, timeMs: 150 }, { level: 'easy' }], decks: [STARTER_DECK, STARTER_DECK], seed: 3 });
  assert.ok(r.winner === 0 || r.winner === 1 || r.winner === 'draw');
});
