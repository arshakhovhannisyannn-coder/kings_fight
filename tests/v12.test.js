// v1.2: pure logic added for the polished UI — placement/spell previews, profile migration, statistics,
// the human-like self-play agent, the extra AI output used by the AI panel, and the sprite table.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, ALL_CARD_IDS, STARTER_DECK } from '../src/data/cards.js';
import { createGame, playCard, endRound, previewPlacement, previewSpell, serializeState, legalActions } from '../src/engine/index.js';
import { chooseMove, EASY_RULE_HY } from '../src/ai/index.js';
import { migrateProfile, defaultProfile, recordBattle, favouriteCard, PROFILE_VERSION } from '../src/ui/store.js';
import { humanLikeMove, playGame, playSeries } from '../tools/selfplay.js';
import { hasSprite, spriteSvg, spriteFile } from '../assets/sprites.js';
import { ICONS } from '../assets/art.js';
import { newGame, put, give } from './helpers.js';

test('previewPlacement: the path is exactly what the engine does with the placed unit', () => {
  const g = newGame();
  give(g, 0, ['spearman', 'cavalry', 'archer', 'wall']);
  const pv = previewPlacement(g, 0, 'spearman', 6, 2, 4);
  assert.deepEqual(pv.path[0], { row: 6, col: 2 });
  assert.ok(pv.path.length >= 3, 'a spearman walks at least two cells toward a bridge');
  assert.equal(pv.range, 1);
  // really play it and compare the first step of the battle with the previewed step
  assert.ok(playCard(g, 'spearman', 6, 2, -1, 0));
  const u = g.entities.find(e => e.cardId === 'spearman' && e.side === 0);
  endRound(g);
  const stepsMade = 3; // battleTicks, speed 1, nothing in range
  assert.deepEqual({ row: u.row, col: u.col }, pv.path[Math.min(stepsMade, pv.path.length - 1)]);
});

test('previewPlacement: does not change the state and rejects illegal cells', () => {
  const g = newGame();
  give(g, 0, ['spearman', 'archer', 'wall', 'vahagn']);
  const before = JSON.stringify(serializeState(g));
  assert.equal(previewPlacement(g, 0, 'spearman', 2, 2), null, 'enemy zone');
  assert.equal(previewPlacement(g, 0, 'spearman', 7, 1), null, 'occupied by a tower');
  assert.equal(previewPlacement(g, 0, 'vahagn', 5, 2), null, 'spells have no placement preview');
  const wall = previewPlacement(g, 0, 'wall', 5, 3);
  assert.equal(wall.path.length, 1, 'buildings do not move');
  assert.ok(previewPlacement(g, 0, 'archer', 5, 1).range === 3);
  assert.equal(JSON.stringify(serializeState(g)), before);
});

test('previewPlacement: a unit stops where an enemy comes into range', () => {
  const g = newGame();
  give(g, 0, ['archer']);
  put(g, 1, 'giant', 3, 3);
  const pv = previewPlacement(g, 0, 'archer', 6, 3, 4);
  assert.deepEqual(pv.path, [{ row: 6, col: 3 }], 'the giant at distance 3 is already in the range of the archer');
});

test('previewSpell: Vahagn shows the HP after the hit, kills and untouched towers', () => {
  const g = newGame();
  give(g, 0, ['vahagn']);
  const a = put(g, 1, 'archer', 2, 2), s = put(g, 1, 'cataphract', 3, 3), far = put(g, 1, 'spearman', 3, 5);
  const before = JSON.stringify(serializeState(g));
  const hits = previewSpell(g, 0, 'vahagn', 2, 2);
  const byId = Object.fromEntries(hits.map(h => [h.id, h]));
  assert.equal(byId[a.id].dead, true);
  assert.equal(byId[s.id].hpAfter, CARDS.cataphract.hp - 3);
  assert.equal(byId[far.id], undefined);
  assert.equal(hits.length, 2);
  assert.equal(JSON.stringify(serializeState(g)), before, 'preview must not change the game');
  assert.equal(previewSpell(g, 0, 'vahagn', 7, 5), null, 'illegal target');
});

test('profile migration: v1 and v2 saves become v3 and keep the progress', () => {
  const v2 = { version: 2, stars: { '1-1': 3, '1-2': 1 }, unlocked: [...STARTER_DECK, 'horn'], deck: [...STARTER_DECK], settings: { timer: 12, animSpeed: 'fast', hardMs: 2000, allCards: true } };
  const p = migrateProfile(JSON.parse(JSON.stringify(v2)));
  assert.equal(p.version, PROFILE_VERSION);
  assert.deepEqual(p.stars, v2.stars);
  assert.deepEqual(p.unlocked, v2.unlocked);
  assert.equal(p.settings.timer, 12);
  assert.equal(p.settings.animSpeed, 'fast');
  assert.equal(p.settings.volMusic, defaultProfile().settings.volMusic);
  assert.equal(p.settings.reduceMotion, false);
  assert.equal(p.settings.showAiPanel, true);
  assert.equal(p.introSeen, true, 'an existing player does not get the first-launch intro');
  assert.equal(p.tutorialDone, true);
  assert.deepEqual(p.stats.byLevel.hard, { wins: 0, losses: 0, draws: 0 });
  const v1 = migrateProfile({ stars: {}, settings: { timer: 30, hardMs: 5000 } });
  assert.equal(v1.settings.timer, 8, 'old long turn timers are reset');
  assert.equal(v1.settings.hardMs, 3000);
  assert.equal(v1.introSeen, false);
  assert.equal(migrateProfile(null).version, PROFILE_VERSION);
  assert.equal(migrateProfile(migrateProfile(v2)).settings.timer, 12, 'migration is idempotent');
});

test('statistics: battles are recorded per level and the favourite card is found', () => {
  const p = defaultProfile();
  recordBattle(p, { level: 'hard', winner: 0, ms: 60000, cards: ['archer', 'archer', 'spearman'], castle: true });
  recordBattle(p, { level: 'hard', winner: 1, ms: 30000, cards: ['archer'] });
  recordBattle(p, { level: 'easy', winner: 'draw', ms: 1000, cards: [] });
  assert.deepEqual(p.stats.byLevel.hard, { wins: 1, losses: 1, draws: 0 });
  assert.equal(p.stats.byLevel.easy.draws, 1);
  assert.equal(p.stats.battles, 3);
  assert.equal(p.stats.playMs, 91000);
  assert.equal(p.stats.castles, 1);
  assert.equal(favouriteCard(p), 'archer');
  assert.equal(favouriteCard(defaultProfile()), null);
});

test('human-like agent: legal moves, at most 2 cards, deterministic for a seed', () => {
  const g = createGame({ deckP: STARTER_DECK, deckA: STARTER_DECK, seed: 4 });
  g.gold = [20, 20];
  for (let seed = 1; seed <= 30; seed++) {
    const m = humanLikeMove(g, 0, seed);
    assert.ok(m.actions.length <= 2);
    const again = humanLikeMove(g, 0, seed);
    assert.deepEqual(again.actions, m.actions);
    const copy = createGame({ deckP: STARTER_DECK, deckA: STARTER_DECK, seed: 4 });
    copy.gold = [20, 20];
    for (const a of m.actions) assert.ok(playCard(copy, a.cardId, a.row, a.col, -1, 0), 'every chosen placement is legal');
  }
  const r = playGame({ agents: [{ level: 'human' }, { level: 'easy' }], decks: [STARTER_DECK, STARTER_DECK], seed: 2 });
  assert.ok(r.winner === 0 || r.winner === 1 || r.winner === 'draw');
  const s = playSeries({ a: { level: 'medium', maxDepth: 2 }, b: { level: 'human' }, games: 6, seed: 5 });
  assert.ok(s.winsA >= 5, 'Medium beats the human proxy');
});

test('AI output for the panel: win probability, candidate placements, Easy rule texts', () => {
  const g = createGame({ deckP: STARTER_DECK, deckA: STARTER_DECK, seed: 7, first: 1 });
  g.gold = [8, 8];
  for (const level of ['easy', 'medium', 'hard']) {
    const r = chooseMove(g, 1, level, { seed: 3, iterations: 150, maxDepth: 2 });
    assert.ok(r.stats.winProb >= 0 && r.stats.winProb <= 1, `${level}: winProb in [0, 1]`);
    assert.ok(r.top.length >= 1 && r.top[0].chosen);
    assert.deepEqual(r.top[0].actions, r.actions, `${level}: the first candidate is the chosen move`);
    for (const t of r.top) for (const a of t.actions) assert.ok(CARDS[a.cardId] && Number.isInteger(a.row) && Number.isInteger(a.col));
    if (level === 'easy') {
      assert.equal(r.stats.rules.length, r.actions.length);
      for (const text of r.stats.rules) assert.ok(Object.values(EASY_RULE_HY).includes(text));
    }
  }
  assert.ok(legalActions(g).length > 0);
});

test('art: every card, token and tower has an original SVG sprite', () => {
  for (const id of [...ALL_CARD_IDS, 'militia', 'tower_small', 'tower_king', 'gold', ...Object.keys(ICONS)]) {
    assert.ok(hasSprite(id), `sprite for ${id}`);
    const svg = spriteSvg(id);
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>') && svg.length > 300, `${id} is real SVG`);
    assert.ok(!/[\u{1F000}-\u{1FAFF}]/u.test(svg), 'no emoji inside sprites');
  }
  assert.ok(spriteSvg('tower_king').includes('class="crack"') && spriteSvg('tower_king').includes('class="fire"'), 'towers have damage layers');
  assert.ok(!spriteFile('spearman', 1).includes('var(--'), 'file export has fixed colours');
  assert.equal(spriteSvg('nope'), '');
});
