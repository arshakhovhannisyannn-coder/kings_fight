// Thesis experiment suite. Writes Armenian Markdown tables + CSV to docs/experiments/.
//   node tools/experiments.js                run everything with small N (a few minutes, experiments run in parallel)
//   node tools/experiments.js --scale=5      5x more games
//   node tools/experiments.js --only=2       run a single experiment (1..7)
// Next to every table a simple SVG chart is generated (no chart library), ready to paste into the thesis.
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG, makeConfig } from '../src/data/config.js';
import { CARDS, PLAYER_CARD_IDS, STARTER_DECK, validateDeck } from '../src/data/cards.js';
import { makeRng, mixSeed } from '../src/engine/index.js';
import { playSeries, playGame, parseArgs } from './selfplay.js';

const SELF = fileURLToPath(import.meta.url);
const OUT = path.join(path.dirname(SELF), '..', 'docs', 'experiments');
const pct = x => (100 * x).toFixed(1) + '%';
const LV = { easy: 'Հեշտ', medium: 'Միջին', hard: 'Դժվար' };

function write(name, title, intro, header, rows, notes = '') {
  fs.mkdirSync(OUT, { recursive: true });
  const md = [`# ${title}`, '', intro, '', `| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map(r => `| ${r.join(' | ')} |`), '', notes, '',
    `_Ստեղծվել է ավտոմատ՝ \`node tools/experiments.js\` հրամանով (${new Date().toISOString().slice(0, 10)})։_`, ''].join('\n');
  fs.writeFileSync(path.join(OUT, `${name}.md`), md);
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  fs.writeFileSync(path.join(OUT, `${name}.csv`), '﻿' + csv + '\n');
  console.log(`\n== ${title} ==`);
  console.log([header, ...rows].map(r => r.join(' | ')).join('\n'));
}

/** Simple generated SVG bar chart: docs/experiments/<name>.svg. series: [{ name, color, values }] */
function chart(name, title, labels, series, { unit = '%', max = 100 } = {}) {
  const W = 760, H = 380, L = 56, R = 16, T = 54, B = 92;
  const pw = W - L - R, ph = H - T - B, gw = pw / labels.length;
  const bw = Math.min(54, (gw - 16) / series.length);
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const y = (v) => T + ph * (1 - v / max);
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="'Noto Sans Armenian','Segoe UI',sans-serif">` +
    `<rect width="${W}" height="${H}" fill="#fff"/><text x="${W / 2}" y="24" text-anchor="middle" font-size="16" font-weight="700" fill="#2a1a17">${esc(title)}</text>`;
  for (let i = 0; i <= 4; i++) {
    const v = max * i / 4;
    out += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#e3d5cb"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#6b4f47">${+v.toFixed(1)}${unit}</text>`;
  }
  labels.forEach((lab, i) => {
    const x0 = L + gw * i + (gw - bw * series.length) / 2;
    series.forEach((se, k) => {
      const v = Math.max(0, Math.min(max, se.values[i]));
      out += `<rect x="${x0 + k * bw}" y="${y(v)}" width="${bw - 3}" height="${T + ph - y(v)}" fill="${se.color}" stroke="#2a1a17" stroke-width="1.2" rx="2"/>` +
        `<text x="${x0 + k * bw + (bw - 3) / 2}" y="${y(v) - 4}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#2a1a17">${+se.values[i].toFixed(1)}</text>`;
    });
    const words = String(lab).split(' '), lines = [''];
    for (const w of words) { if ((lines[lines.length - 1] + ' ' + w).length > Math.max(10, gw / 6.5)) lines.push(w); else lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + w).trim(); }
    lines.slice(0, 4).forEach((ln, j) => { out += `<text x="${L + gw * i + gw / 2}" y="${T + ph + 16 + j * 13}" text-anchor="middle" font-size="11" fill="#2a1a17">${esc(ln)}</text>`; });
  });
  series.forEach((se, k) => { out += `<rect x="${L + k * 190}" y="${H - 18}" width="12" height="12" fill="${se.color}" stroke="#2a1a17"/><text x="${L + k * 190 + 18}" y="${H - 8}" font-size="11.5" fill="#2a1a17">${esc(se.name)}</text>`; });
  out += `<line x1="${L}" x2="${W - R}" y1="${T + ph}" y2="${T + ph}" stroke="#2a1a17" stroke-width="1.5"/></svg>`;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${name}.svg`), out);
}
const num = (x) => parseFloat(x);
const RED = '#a3242f', ORANGE = '#e08a2e', GREEN = '#3f7a4a', GREY = '#9a8d88';

// 1. Level comparison
function expLevels(scale, mctsMs) {
  const pairs = [['medium', 'easy', 40], ['hard', 'medium', 30], ['hard', 'easy', 20]];
  const rows = [];
  for (const [a, b, n] of pairs) {
    const games = n * scale;
    const r = playSeries({ a: { level: a, timeMs: mctsMs }, b: { level: b, timeMs: mctsMs }, games, seed: 101 });
    rows.push([`${LV[a]} — ${LV[b]}`, games, r.winsA, r.winsB, r.draws, pct(r.winRateA), r.byReason.king, r.byReason.towers, r.byReason.hp, r.avgRounds.toFixed(1),
      r.avgThinkMsA.toFixed(0), r.avgThinkMsB.toFixed(0)]);
  }
  write('1_levels', 'Փորձ 1. AI մակարդակների համեմատություն',
    `Յուրաքանչյուր զույգ խաղում է սկզբնական կապուկով, կողմերը և առաջին քայլի իրավունքը փոխվում են։ «Դժվար» մակարդակի մտածելու ժամանակը՝ ${mctsMs} մվ/քայլ, «Միջին»-ը՝ Minimax խորություն ${CONFIG.ai.minimaxMaxDepth}։ Հաղթելու տոկոսում ոչ-ոքին հաշվվում է 0.5։`,
    ['Զույգ (A — B)', 'Խաղեր', 'A հաղթ.', 'B հաղթ.', 'Ոչ-ոքի', 'A հաղթելու %', 'Ամրոցի գրավում', 'Աշտարակներով', 'Կյանքով', 'Միջին ռաունդ', 'A մվ/քայլ', 'B մվ/քայլ'], rows);
  chart('1_levels', 'Փորձ 1. Ուժեղ մակարդակի հաղթելու տոկոսը', rows.map(r => r[0]), [{ name: 'A-ի հաղթելու %', color: RED, values: rows.map(r => num(r[5])) }, { name: 'ոչ-ոքի %', color: GREY, values: rows.map(r => 100 * r[4] / r[1]) }]);
}

// 2. MCTS strength vs thinking time
function expMctsTime(scale) {
  const rows = [];
  for (const [ms, n] of [[50, 24], [200, 24], [1000, 12]]) {
    const games = n * scale;
    const r = playSeries({ a: { level: 'hard', timeMs: ms }, b: { level: 'medium' }, games, seed: 202 });
    rows.push([ms, games, r.winsA, r.winsB, r.draws, pct(r.winRateA)]);
  }
  write('2_mcts_time', 'Փորձ 2. MCTS-ի ուժը՝ կախված մտածելու ժամանակից',
    '«Դժվար» (MCTS) մակարդակը տարբեր ժամանակային բյուջեներով խաղում է «Միջին» (Minimax, խորություն 3) մակարդակի դեմ։',
    ['MCTS ժամանակ (մվ/քայլ)', 'Խաղեր', 'MCTS հաղթ.', 'Minimax հաղթ.', 'Ոչ-ոքի', 'MCTS հաղթելու %'], rows);
  chart('2_mcts_time', 'Փորձ 2. MCTS-ի հաղթելու տոկոսը Minimax-ի դեմ', rows.map(r => `${r[0]} մվ`), [{ name: 'MCTS հաղթելու %', color: RED, values: rows.map(r => num(r[5])) }]);
}

// 3. First-mover advantage
function expFirstMover(scale) {
  const rows = [];
  for (const [level, n, opt] of [['easy', 200, {}], ['medium', 60, {}], ['hard', 20, { timeMs: 100 }]]) {
    const games = n * scale;
    const r = playSeries({ a: { level, ...opt }, b: { level, ...opt }, games, seed: 303 });
    rows.push([`${LV[level]} — ${LV[level]}`, games, r.firstMoverWins, r.secondMoverWins, r.draws, pct(r.firstMoverWinRate)]);
  }
  write('3_first_mover', 'Փորձ 3. Առաջին քայլի առավելությունը',
    'Նույն մակարդակի երկու AI խաղում են միմյանց դեմ. չափվում է, թե որքան հաճախ է հաղթում առաջինը քայլ կատարող կողմը։ 50%-ից զգալի շեղումը նշանակում է առաջին (կամ երկրորդ) քայլի առավելություն։',
    ['Զույգ', 'Խաղեր', 'Առաջինը հաղթեց', 'Երկրորդը հաղթեց', 'Ոչ-ոքի', 'Առաջինի հաղթելու %'], rows,
    'Նշում. հավելվածում AI-ը միշտ առաջին պլանավորողն է. ինքնախաղում երկրորդ պլանավորողի քարտերը դաշտ են մտնում առաջինի քարտերից հետո, ինչը չի համընկնում նրա որոնման մոդելի հետ (նա էլ է որոնում որպես առաջին պլանավորող), ուստի «Միջին»-ի դեպքում առաջինը փոքր առավելություն ունի։');
  chart('3_first_mover', 'Փորձ 3. Առաջին պլանավորողի հաղթելու տոկոսը', rows.map(r => r[0]), [{ name: 'առաջինի հաղթելու %', color: ORANGE, values: rows.map(r => num(r[5])) }]);
}

/** Random legal deck from the player's card pool (at least 4 unit cards). */
export function randomDeck(rnd, cfg = CONFIG) {
  for (;;) {
    const deck = [];
    while (deck.length < cfg.deckSize) {
      const id = PLAYER_CARD_IDS[Math.floor(rnd() * PLAYER_CARD_IDS.length)];
      const trial = deck.concat(id);
      const counts = trial.filter(x => x === id).length;
      const legend = trial.filter(x => ['hero', 'special'].includes(CARDS[x].type)).length;
      if (counts <= cfg.deckLimits.maxCopies[CARDS[id].type] && legend <= cfg.deckLimits.maxLegendary) deck.push(id);
    }
    const units = deck.filter(x => ['soldier', 'hero', 'special'].includes(CARDS[x].type)).length;
    if (units >= 4 && validateDeck(deck, cfg).ok) return deck;
  }
}

// 4. Card balance
function expCards(scale) {
  const games = 300 * scale;
  const rnd = makeRng(404);
  const stat = Object.fromEntries(PLAYER_CARD_IDS.map(id => [id, { games: 0, points: 0 }]));
  for (let g = 0; g < games; g++) {
    const decks = [randomDeck(rnd), randomDeck(rnd)];
    const r = playGame({ agents: [{ level: 'medium', maxDepth: 2 }, { level: 'medium', maxDepth: 2 }], decks, seed: mixSeed(404, g), first: g % 2 });
    for (const side of [0, 1]) {
      const pts = r.winner === 'draw' ? 0.5 : r.winner === side ? 1 : 0;
      for (const id of new Set(decks[side])) { stat[id].games++; stat[id].points += pts; }
    }
  }
  const rows = PLAYER_CARD_IDS.map(id => [CARDS[id].nameHy, CARDS[id].cost, stat[id].games, pct(stat[id].points / Math.max(1, stat[id].games))])
    .sort((a, b) => parseFloat(b[3]) - parseFloat(a[3]));
  write('4_card_balance', 'Փորձ 4. Քարտերի հավասարակշռությունը',
    `${games} խաղ պատահական (կանոններին համապատասխան) կապուկներով, երկու կողմում էլ «Միջին» AI (խորություն 2)։ Յուրաքանչյուր քարտի համար ցույց է տրված այն պարունակող կապուկների հաղթելու տոկոսը. 50%-ից շատ բարձր արժեքը նշանակում է չափազանց ուժեղ քարտ, շատ ցածրը՝ թույլ։`,
    ['Քարտ', 'Գին', 'Խաղեր', 'Հաղթելու %'], rows);
  chart('4_card_balance', 'Փորձ 4. Քարտ պարունակող կապուկների հաղթելու տոկոսը', rows.map(r => r[0]), [{ name: 'հաղթելու %', color: GREEN, values: rows.map(r => num(r[3])) }]);
}

// 5. Evaluation-weight tuning
function expWeights(scale) {
  const sets = {
    'Հիմնական': CONFIG.evalWeights,
    'Հարձակողական': { king: 8, towers: 5, army: 1.5, crossed: 3, gold: 0.3, threat: 1 },
    'Պաշտպանողական': { king: 5, towers: 3, army: 2.5, crossed: 0.5, gold: 0.5, threat: 4 },
    'Նյութական': { king: 3, towers: 2, army: 3, crossed: 1, gold: 1, threat: 2 },
  };
  const names = Object.keys(sets);
  const points = Object.fromEntries(names.map(n => [n, 0])), played = Object.fromEntries(names.map(n => [n, 0]));
  const rows = [];
  const games = 30 * scale;
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = { level: 'medium', cfg: makeConfig({ evalWeights: sets[names[i]] }) };
      const b = { level: 'medium', cfg: makeConfig({ evalWeights: sets[names[j]] }) };
      const r = playSeries({ a, b, games, seed: 505 + i * 10 + j });
      rows.push([`${names[i]} — ${names[j]}`, games, r.winsA, r.winsB, r.draws, pct(r.winRateA)]);
      points[names[i]] += r.winsA + r.draws / 2; points[names[j]] += r.winsB + r.draws / 2;
      played[names[i]] += games; played[names[j]] += games;
    }
  }
  const w = s => `king=${s.king}, towers=${s.towers}, army=${s.army}, crossed=${s.crossed}, gold=${s.gold}, threat=${s.threat}`;
  const notes = ['**Կշիռների հավաքածուները և ընդհանուր արդյունքը**', '', '| Հավաքածու | Կշիռներ | Ընդհանուր հաղթելու % |', '| --- | --- | --- |',
    ...names.map(n => `| ${n} | ${w(sets[n])} | ${pct(points[n] / played[n])} |`)].join('\n');
  write('5_eval_weights', 'Փորձ 5. Գնահատման ֆունկցիայի կշիռների համեմատություն',
    'Գնահատման ֆունկցիայի կշիռների մի քանի հավաքածու խաղում են միմյանց դեմ («Միջին» AI, Minimax խորություն 3, շրջանաձև մրցաշար)։',
    ['Զույգ (A — B)', 'Խաղեր', 'A հաղթ.', 'B հաղթ.', 'Ոչ-ոքի', 'A հաղթելու %'], rows, notes);
  chart('5_eval_weights', 'Փորձ 5. Կշիռների հավաքածուների ընդհանուր հաղթելու տոկոսը', names, [{ name: 'հաղթելու %', color: RED, values: names.map(n => 100 * points[n] / played[n]) }]);
}

// 6. Rule variants (v1.4: 7×9 board, target lock; comparison with v1.2 and v1.3)
function expRules(scale, mctsMs) {
  const T = (small, king) => ({ towers: { small: { atk: small[0], range: small.length, atkByDist: small }, king: { atk: king[0], range: king.length, atkByDist: king } } });
  const flat = { towers: { small: { atk: 1, range: 1, atkByDist: [] }, king: { atk: 2, range: 1, atkByDist: [] } } };
  const V12 = { ...flat, board: { cols: 5, rows: 7, riverRow: 4, bridgeCols: [1, 3, 5] }, zones: [[5, 6], [2, 3]], newUnitCanAttack: false, targetLock: false };
  const V13 = { ...T([2, 1], [3, 2]), board: { cols: 9, rows: 11, riverRow: 6, bridgeCols: [1, 5, 9] }, zones: [[7, 10], [2, 5]], targetLock: false };
  const cur = CONFIG.towers;
  const tw = t => (t.atkByDist && t.atkByDist.length ? t.atkByDist.join('/') : String(t.atk)) + ` (հեռ. ${t.range})`;
  const variants = [
    ['v1.2. դաշտ 5×7, աշտարակ 1 / ամրոց 2 (հեռ. 1), նոր զորքը՝ 2-րդ պահից', V12],
    ['v1.3. դաշտ 9×11, աշտարակ 2/1, ամրոց 3/2, առանց «կռվից չշեղվելու»', V13],
    [`Ընթացիկ (v1.4). 7×9, աշտարակ ${tw(cur.small)}, ամրոց ${tw(cur.king)}, «կռվից չշեղվել»`, {}],
    ['v1.4 առանց «կռվից չշեղվելու»', { targetLock: false }],
    ['v1.4, բայց v1.2-ի աշտարակներ (1 / 2, հեռ. 1)', flat],
    ['v1.4, նոր զորքը խփում է 2-րդ պահից', { newUnitCanAttack: false }],
  ];
  const rows = [];
  const games = 20 * scale, hardGames = 12 * scale;
  for (const [name, ov] of variants) {
    const cfg = makeConfig(ov);
    const mm = playSeries({ a: { level: 'medium' }, b: { level: 'medium' }, games, seed: 606, cfg });
    const me = playSeries({ a: { level: 'medium' }, b: { level: 'easy' }, games, seed: 606, cfg });
    const hm = playSeries({ a: { level: 'hard', timeMs: mctsMs }, b: { level: 'medium' }, games: hardGames, seed: 607, cfg });
    rows.push([name, games, pct(mm.draws / games), mm.avgRounds.toFixed(1), pct(mm.byReason.king / games), pct(mm.firstMoverWinRate),
      `${me.winsA}–${me.winsB}–${me.draws}`, me.avgRounds.toFixed(1), `${hm.winsA}–${hm.winsB}–${hm.draws}`, pct(hm.winRateA)]);
  }
  write('6_rule_variants', 'Փորձ 6. Կանոնների տարբերակներ (v1.2 → v1.3 → v1.4)',
    'v1.3-ում նոր դրված զորքը սկսեց խփել անմիջապես, իսկ աշտարակները՝ ավելի ուժեղ, որքան մոտ է թշնամին (դաշտը՝ 9×11)։ Խաղալիս 9×11-ը չափազանց մեծ թվաց, ուստի v1.4-ում դաշտը 7×9 է, և ավելացավ «կռվից չշեղվելու» կանոնը (զորքը խփում է իր թիրախին, մինչև մեկնումեկը մեռնի)։ Լավ կանոնը պետք է տա քիչ ոչ-ոքի, իսկ ուժեղ AI-ը (Դժվար) պետք է հստակ հաղթի թույլին (Միջին)։ Դժվարի մտածելու ժամանակը՝ ' + mctsMs + ' մվ։',
    ['Կանոնների տարբերակ', 'Խաղեր', 'Ոչ-ոքի (Միջին—Միջին)', 'Միջին ռաունդ (Միջին—Միջին)', 'Ամրոցի ավերում (Միջին—Միջին)', 'Առաջինի հաղթելու % (Միջին—Միջին)',
      'Միջին—Հեշտ (հաղթ.–պարտ.–ոչ-ոքի)', 'Միջին ռաունդ (Միջին—Հեշտ)', 'Դժվար—Միջին (հաղթ.–պարտ.–ոչ-ոքի)', 'Դժվարի հաղթելու %'], rows,
    'Եզրակացություն. տե՛ս `docs/DECISIONS.md`, բաժիններ Զ (v1.3) և Է (v1.4)։ Արժեքները՝ `src/data/config.js` (`board`, `towers`, `targetLock`)։');
  chart('6_rule_variants', 'Փորձ 6. Ոչ-ոքիներ (Միջին—Միջին) և Դժվարի հաղթանակներ', rows.map(r => r[0]), [
    { name: 'ոչ-ոքի %', color: GREY, values: rows.map(r => num(r[2])) }, { name: 'Դժվարի հաղթանակ %', color: RED, values: rows.map(r => num(r[9])) }]);
}

// 7. Number of battle ticks per round
function expTicks(scale, mctsMs) {
  const rows = [];
  const games = 30 * scale, hardGames = 16 * scale;
  for (const ticks of [1, 2, 3, 4]) {
    const cfg = makeConfig({ battleTicks: ticks });
    const mm = playSeries({ a: { level: 'medium' }, b: { level: 'medium' }, games, seed: 707, cfg });
    const hm = playSeries({ a: { level: 'hard', timeMs: mctsMs }, b: { level: 'medium' }, games: hardGames, seed: 708, cfg });
    rows.push([ticks + (ticks === CONFIG.battleTicks ? ' (ընթացիկ)' : ''), games, pct(mm.draws / games), mm.avgRounds.toFixed(1), pct(mm.byReason.king / games),
      hardGames, pct(hm.winRateA), hm.avgRounds.toFixed(1)]);
  }
  write('7_battle_ticks', 'Փորձ 7. Մարտի պահերի քանակը',
    'Մեկ ռաունդի մարտի փուլը բաղկացած է մի քանի «պահից» (`battleTicks`), որոնցում երկու կողմի զորքերը գործում են։ Աղյուսակը համեմատում է 1–4 պահը. ոչ-ոքիների մասը, խաղի միջին տևողությունը և Արքայի ամրոցի ավերումը («Միջին»—«Միջին»), ինչպես նաև «Դժվար»-ի (MCTS, ' + mctsMs + ' մվ/քայլ) արդյունքը «Միջին»-ի դեմ։',
    ['Մարտի պահեր', 'Խաղեր (Մ—Մ)', 'Ոչ-ոքի', 'Միջին ռաունդ', 'Ամրոցի ավերում', 'Խաղեր (Դ—Մ)', 'Դժվարի հաղթելու %', 'Միջին ռաունդ (Դ—Մ)'], rows,
    'Եզրակացություն. 1 պահի դեպքում զորքերը չեն հասցնում հասնել թշնամուն, և խաղը գրեթե չի զարգանում. 3 պահը տալիս է վճռորոշ խաղ՝ պահելով մարտի անիմացիան 3–4.5 վայրկյանի սահմանում (4 պահը այն երկարացնում է)։');
  chart('7_battle_ticks', 'Փորձ 7. Մարտի պահերի քանակի ազդեցությունը', rows.map(r => `${r[0]} պահ`), [
    { name: 'ոչ-ոքի % (Մ—Մ)', color: GREY, values: rows.map(r => num(r[2])) }, { name: 'ամրոցի ավերում % (Մ—Մ)', color: ORANGE, values: rows.map(r => num(r[4])) },
    { name: 'Դժվարի հաղթելու %', color: RED, values: rows.map(r => num(r[6])) }]);
}

const EXPERIMENTS = { 1: expLevels, 2: expMctsTime, 3: expFirstMover, 4: expCards, 5: expWeights, 6: expRules, 7: expTicks };

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const scale = Number(args.scale ?? 1), mctsMs = Number(args.mctsMs ?? 200);
  if (args.only) { EXPERIMENTS[Number(args.only)](scale, mctsMs); return; }
  const t0 = Date.now();
  console.log(`Փորձերը սկսվեցին (scale=${scale})։ Յուրաքանչյուր փորձ աշխատում է առանձին պրոցեսում…`);
  // The time-based experiments (1-3) and the fixed-depth ones (4-6) run in two waves so MCTS gets free CPU cores.
  for (const wave of [[1, 2, 3], [6, 7], [4, 5]]) {
    await Promise.all(wave.map(k => new Promise((resolve, reject) => {
      const p = spawn(process.execPath, [SELF, `--only=${k}`, `--scale=${scale}`, `--mctsMs=${mctsMs}`], { stdio: 'inherit' });
      p.on('exit', code => (code === 0 ? resolve() : reject(new Error(`experiment ${k} failed`))));
    })));
  }
  const files = fs.readdirSync(OUT).filter(f => /^\d_.*\.md$/.test(f)).sort();
  const index = ['# Փորձերի արդյունքներ', '', 'Բոլոր աղյուսակները ստեղծվում են `npm run experiments` հրամանով (ավելի մեծ ընտրանքի համար՝ `npm run experiments -- --scale=5`)։', '',
    ...files.map(f => `- [${fs.readFileSync(path.join(OUT, f), 'utf8').split('\n')[0].replace(/^# /, '')}](${f}) (CSV՝ \`${f.replace('.md', '.csv')}\`, գծապատկեր՝ [${f.replace('.md', '.svg')}](${f.replace('.md', '.svg')}))`), ''].join('\n');
  fs.writeFileSync(path.join(OUT, 'README.md'), index);
  console.log(`\nԱվարտվեց ${((Date.now() - t0) / 1000).toFixed(0)} վայրկյանում։ Արդյունքները՝ docs/experiments/`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) main().catch(e => { console.error(e); process.exit(1); });
