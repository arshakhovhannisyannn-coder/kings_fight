import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, ALL_CARD_IDS } from '../src/data/cards.js';
import { BATTLES, CHAPTERS } from '../src/data/campaign.js';
import { CONFIG } from '../src/data/config.js';
import { validateDeck } from '../src/data/cards.js';
import { playCard, endRound, startRound, entityAt, effectiveAtk } from '../src/engine/index.js';
import { newGame, put, give, tower, step } from './helpers.js';

test('every card has the required fields and an Armenian history text', () => {
  for (const id of ALL_CARD_IDS) {
    const c = CARDS[id];
    for (const k of ['id', 'nameHy', 'type', 'cost', 'hp', 'atk', 'speed', 'range', 'historyHy']) assert.ok(k in c, `${id}.${k}`);
    assert.ok(/[Ա-և]/.test(c.nameHy) && c.historyHy.length > 20, id);
    assert.ok([null, 'ավանդություն', 'պատմություն'].includes(c.tag), id);
  }
});

test('stats table matches the specification', () => {
  const t = (id) => { const c = CARDS[id]; return [c.cost, c.hp, c.atk, c.speed, c.range]; };
  assert.deepEqual(t('spearman'), [2, 6, 2, 1, 1]);
  assert.deepEqual(t('archer'), [3, 3, 2, 1, 3]);
  assert.deepEqual(t('slinger'), [2, 3, 1, 1, 2]);
  assert.deepEqual(t('cavalry'), [4, 7, 3, 2, 1]);
  assert.deepEqual(t('cataphract'), [6, 12, 4, 1, 1]);
  assert.deepEqual(t('shieldbearer'), [3, 10, 1, 1, 1]);
  assert.deepEqual(t('hayk'), [7, 8, 3, 1, 3]);   // v1.2 balance pass: was [6, 10, ...]
  assert.deepEqual(t('tigran'), [8, 12, 3, 1, 1]);
  assert.deepEqual(t('camelrider'), [4, 6, 2, 3, 1]);
  assert.deepEqual(t('cannon'), [5, 6, 4, 0, 4]);
});

test('shield-bearer: adjacent friendly ranged units take half damage (min 1)', () => {
  const s = newGame();
  const archer = put(s, 0, 'archer', 5, 1);
  put(s, 0, 'shieldbearer', 5, 2);
  const spear = put(s, 0, 'spearman', 6, 2);
  step(s);                                 // player units hold/move; now the AI acts
  const s2 = newGame();
  const a2 = put(s2, 0, 'archer', 5, 3);
  put(s2, 0, 'shieldbearer', 6, 3);
  put(s2, 1, 'cataphract', 4, 3);             // atk 4
  put(s2, 0, 'wall', 6, 2);
  s2.turn = 1;
  step(s2);
  assert.equal(a2.hp, 3 - 2);                 // 4 -> 2
  const s3 = newGame();
  const melee = put(s3, 0, 'spearman', 5, 3);
  put(s3, 0, 'shieldbearer', 6, 3, { hp: 99 });
  put(s3, 1, 'cataphract', 4, 3);
  s3.turn = 1;
  step(s3);
  assert.equal(melee.hp, 6 - 4);              // melee units are not protected
  assert.ok(archer && spear);
});

test('Hayk: 5 damage to the enemy unit with the highest HP on placement', () => {
  const s = newGame();
  give(s, 0, ['hayk', 'archer', 'slinger', 'cavalry']);
  const big = put(s, 1, 'cataphract', 2, 2);
  const small = put(s, 1, 'spearman', 3, 4);
  playCard(s, 'hayk', 6, 3);
  assert.equal(big.hp, 7);
  assert.equal(small.hp, 6);
});

test('Artashes: +1 gold at the start of the next 3 rounds while alive', () => {
  const s = newGame();
  give(s, 0, ['artashes', 'archer', 'slinger', 'cavalry'], 5);
  playCard(s, 'artashes', 6, 3);
  entityAt(s, 6, 3).speed = 0;                 // keep him at home, out of the towers' reach
  assert.equal(s.gold[0], 0);
  const gains = [];
  for (let i = 0; i < 4; i++) { endRound(s); gains.push(s.gold[0]); s.gold[0] = 0; }
  assert.deepEqual(gains, [3, 3, 3, 2]);      // income 2 (+1 three times)
  const d = newGame();
  give(d, 0, ['artashes', 'archer', 'slinger', 'cavalry'], 5);
  playCard(d, 'artashes', 6, 3);
  entityAt(d, 6, 3).hp = 1;
  put(d, 1, 'cataphract', 5, 3);
  endRound(d);                                 // Artashes dies in the battle phase
  assert.equal(d.gold[0], 2);
});

test('Tigran: friendly units within distance 2 get +1 ATK', () => {
  const s = newGame();
  const tig = put(s, 0, 'tigran', 5, 3);
  const near = put(s, 0, 'spearman', 5, 5);
  const far = put(s, 0, 'spearman', 2, 1);
  const foe = put(s, 1, 'spearman', 5, 4);
  assert.equal(effectiveAtk(s, near), 3);
  assert.equal(effectiveAtk(s, far), 2);
  assert.equal(effectiveAtk(s, tig), 3);       // no bonus to himself
  assert.equal(effectiveAtk(s, foe), 2);       // enemies are not affected
});

test('Vardan: on death all friendly units gain +3 HP (may exceed max)', () => {
  const s = newGame();
  put(s, 0, 'vardan', 5, 3, { hp: 1 });
  const friend = put(s, 0, 'spearman', 6, 1);
  put(s, 1, 'cataphract', 4, 3);
  s.turn = 1;
  step(s);
  assert.equal(friend.hp, 9);
  assert.equal(friend.maxHp, 6);
});

test('Ashot Yerkat ignores the first 2 hits', () => {
  const s = newGame();
  const ashot = put(s, 0, 'ashot', 5, 3, { shield: 2 });
  put(s, 1, 'cataphract', 4, 3);
  for (let i = 0; i < 2; i++) { s.turn = 1; step(s); assert.equal(ashot.hp, 10); }
  s.turn = 1; step(s);
  assert.equal(ashot.hp, 6);
  const fresh = newGame();
  give(fresh, 0, ['ashot', 'archer', 'slinger', 'cavalry']);
  playCard(fresh, 'ashot', 5, 1);
  assert.equal(entityAt(fresh, 5, 1).shield, 2);
});

test('Davit Bek deals double damage within distance 2 of an own tower', () => {
  const s = newGame();
  const near = put(s, 0, 'davitbek', 5, 1);
  assert.equal(effectiveAtk(s, near), 6);
  const far = put(s, 0, 'davitbek', 3, 3);
  assert.equal(effectiveAtk(s, far), 3);
});

test('Sardarapat squad: 3 militia on the target cell and nearest free zone cells', () => {
  const s = newGame();
  give(s, 0, ['sardarapat', 'archer', 'slinger', 'cavalry']);
  playCard(s, 'sardarapat', 5, 3);
  const militia = s.entities.filter(e => e.cardId === 'militia');
  assert.equal(militia.length, 3);
  assert.ok(entityAt(s, 5, 3));
  for (const m of militia) {
    assert.deepEqual([m.hp, m.atk, m.speed, m.range], [6, 2, 1, 1]);
    assert.ok(m.row >= 5 && m.row <= 6 && Math.abs(m.col - 3) <= 1);
  }
  assert.equal(s.gold[0], 90);
});

test('spells: Vahagn (2x2, not towers), Ararat (+2 up to max), Horn (+1 speed), Anahit (invulnerable)', () => {
  const s = newGame();
  give(s, 0, ['vahagn', 'ararat', 'horn', 'anahit']);
  s.queues[0] = ['spearman', 'spearman', 'spearman', 'spearman'];
  const a = put(s, 1, 'cataphract', 2, 1);
  const b = put(s, 1, 'archer', 2, 2);
  const wall = put(s, 1, 'wall', 3, 2);
  const out = put(s, 1, 'spearman', 3, 3);
  const thp = tower(s, 1, 1).hp;
  const g = s.gold[0];
  playCard(s, 'vahagn', 1, 1);                 // cells (1,1) (1,2) (2,1) (2,2)
  assert.equal(a.hp, 9);
  assert.ok(b.dead);
  assert.equal(tower(s, 1, 1).hp, thp);
  assert.equal(out.hp, 6);
  assert.equal(wall.hp, 12);
  assert.equal(s.gold[0], g - 4 + 1);          // bounty for the archer

  const hurt = put(s, 0, 'cataphract', 6, 1, { hp: 5 });
  const almost = put(s, 0, 'spearman', 6, 2, { hp: 5 });
  playCard(s, 'ararat', 0, 0);
  assert.equal(hurt.hp, 7);
  assert.equal(almost.hp, 6);

  playCard(s, 'horn', 0, 0);
  step(s);
  assert.equal(hurt.row, 4);                   // speed 1 + 1
  assert.equal(s.horn[0], false);

  step(s);
  s.cardsPlayed[0] = 0;                         // a new round: the per-round card limit resets
  give(s, 0, ['anahit', 'spearman', 'spearman', 'spearman']);
  playCard(s, 'anahit', hurt.row, hurt.col);
  assert.ok(hurt.invuln);
  const before = hurt.hp;
  step(s);
  put(s, 1, 'cataphract', hurt.row - 1, hurt.col);
  step(s);
  assert.equal(hurt.hp, before);               // protected during the enemy's action
  startRound(s);
  assert.equal(hurt.invuln, false);            // expires at the start of the next round
  assert.equal(playCard(newGame(), 'anahit', 1, 1), false);
});

test('buildings: archer tower shoots (ATK 2, range 3) and never moves; wall blocks and is attacked', () => {
  const s = newGame();
  const twr = put(s, 0, 'archertower', 5, 3);
  const wall = put(s, 0, 'wall', 5, 1);
  const foe = put(s, 1, 'cataphract', 2, 3);
  const walker = put(s, 1, 'spearman', 4, 1);
  step(s);
  assert.equal(walker.hp, 4);                  // the closest enemy unit in range is shot
  assert.equal(foe.hp, 12);
  assert.deepEqual([twr.row, twr.col, wall.row, wall.col], [5, 3, 5, 1]);
  step(s);
  assert.equal(wall.hp, 10);                   // the spearman attacks the wall in its way
  assert.deepEqual([walker.row, walker.col], [4, 1]);
});

test('enemy units: elephant splash, legionary vs ranged, immortal revive, camel speed, static cannon', () => {
  const s = newGame();
  const target = put(s, 0, 'cataphract', 5, 3);
  const side = put(s, 0, 'spearman', 6, 3);
  put(s, 1, 'elephant', 4, 3);
  s.turn = 1; step(s);
  assert.equal(target.hp, 9);
  assert.equal(side.hp, 5);                    // the unit next to the target takes 1 splash damage
  const s1 = newGame();
  const t1 = put(s1, 0, 'spearman', 5, 3);
  const n1 = put(s1, 0, 'cataphract', 6, 3);
  put(s1, 1, 'elephant', 4, 3);
  s1.turn = 1; step(s1);
  assert.equal(t1.hp, 3);
  assert.equal(n1.hp, 11);

  const l = newGame();
  const leg = put(l, 1, 'legionary', 3, 1);
  put(l, 0, 'archer', 5, 1);                   // ranged, atk 2 -> 1
  step(l);
  assert.equal(leg.hp, 8);
  const l2 = newGame();
  const leg2 = put(l2, 1, 'legionary', 4, 1);
  put(l2, 0, 'spearman', 5, 1);                // melee: full damage
  step(l2);
  assert.equal(leg2.hp, 7);

  const im = newGame();
  const imm = put(im, 1, 'immortal', 4, 1, { hp: 1, revive: true });
  put(im, 0, 'cataphract', 5, 1);
  const g = im.gold[0];
  step(im);
  assert.equal(imm.hp, 3);
  assert.equal(imm.dead, false);
  assert.equal(im.gold[0], g);                 // no bounty for the first "death"
  im.turn = 0; step(im);
  assert.ok(imm.dead);

  const c = newGame();
  const camel = put(c, 1, 'camelrider', 1, 2);
  s.turn = 1; c.turn = 1; step(c);
  assert.equal(camel.row, 4);
  const k = newGame();
  const cannon = put(k, 1, 'cannon', 2, 3);
  const victim = put(k, 0, 'cataphract', 6, 3);
  k.turn = 1; step(k);
  assert.deepEqual([cannon.row, cannon.col], [2, 3]);
  assert.equal(victim.hp, 8);
});

test('boss abilities', () => {
  const s = newGame();
  const bel = put(s, 1, 'boss_bel', 4, 1);
  put(s, 0, 'spearman', 5, 1);
  step(s);
  assert.equal(bel.hp, 17);                    // titan: 2 - 1

  const p = newGame();
  put(p, 1, 'boss_seleucid', 3, 2);
  const guarded = put(p, 1, 'spearman', 4, 1);
  put(p, 0, 'cataphract', 5, 1);
  step(p);
  assert.equal(guarded.hp, 3);                 // phalanx: 4 - 1

  const l = newGame();
  l.turn = 1;
  give(l, 1, ['boss_lucullus', 'archer', 'slinger', 'cavalry']);
  playCard(l, 'boss_lucullus', 3, 3);
  assert.equal(l.entities.filter(e => e.cardId === 'legionary').length, 2);

  const r = newGame();
  r.turn = 1;
  give(r, 1, ['boss_persian', 'archer', 'slinger', 'cavalry']);
  const ally = put(r, 1, 'spearman', 2, 1);
  playCard(r, 'boss_persian', 3, 3);
  assert.equal(ally.hp, 8);

  const o = newGame();
  put(o, 1, 'boss_ostikan', 4, 1);
  put(o, 0, 'slinger', 5, 1, { hp: 1 });
  o.turn = 1;
  const g = o.gold[1];
  step(o);
  assert.equal(o.gold[1], g + 1 + 2);

  const w = newGame();
  put(w, 1, 'boss_warlord6', 6, 1);
  w.turn = 1;
  const hp = tower(w, 0, 1).hp;
  step(w);
  assert.equal(tower(w, 0, 1).hp, hp - 6);

  const b = newGame();
  b.turn = 1;
  give(b, 1, ['boss_warlord7', 'archer', 'slinger', 'cavalry']);
  const x = put(b, 0, 'cataphract', 6, 1), y = put(b, 0, 'spearman', 5, 5);
  playCard(b, 'boss_warlord7', 2, 3);
  assert.deepEqual([x.hp, y.hp], [10, 4]);
});

test('campaign: 7 chapters x 3 battles with legal enemy decks and the right levels', () => {
  assert.equal(CHAPTERS.length, 7);
  assert.equal(BATTLES.length, 21);
  for (const b of BATTLES) {
    const v = validateDeck(b.aiDeck, CONFIG);
    assert.ok(v.ok, `${b.id}: ${v.errors.join(' ')}`);
    assert.equal(b.aiLevel, ['easy', 'medium', 'hard'][b.index - 1]);
    assert.equal(!!b.bossId, b.index === 3);
    assert.ok(b.titleHy && b.introHy);
  }
  assert.ok(CHAPTERS[0].legend && CHAPTERS[0].introHy.includes('ավանդ'));
});
