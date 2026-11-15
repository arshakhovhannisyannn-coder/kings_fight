// Armenian explanation text generated from the evaluation-feature breakdown.
import { CARDS } from '../data/cards.js';
import { chebyshev } from '../engine/state.js';
import { areaCells } from '../engine/cards-effects.js';
import { evaluate, FEATURE_KEYS } from './evaluate.js';

function fmt(x) {
  if (!Number.isFinite(x)) return x > 0 ? '+∞' : '−∞';
  return (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(1);
}
function unitName(e) { return CARDS[e.cardId]?.nameHy ?? 'աշտարակ'; }

/** Short text describing a candidate move, e.g. «Աղեղնավոր (3,1) + Նիզակակիր (3,3)». */
export function describeActions(actions) {
  if (!actions.length) return 'Բաց թողնել քայլը (խնայել ոսկին)';
  return actions.map(a => CARDS[a.cardId].nameHy + (a.row ? ` (${a.row},${a.col})` : '')).join(' + ');
}

/** Why was the move chosen? One tactical reason derived from the position. */
function reasonFor(view, side, actions) {
  const foes = view.entities.filter(e => e.side !== side && e.kind === 'unit');
  const towers = view.entities.filter(e => e.side === side && e.kind === 'tower');
  for (const a of actions) {
    const def = CARDS[a.cardId];
    if (def.ability === 'vahagn') {
      const cells = areaCells(a.row, a.col);
      const n = view.entities.filter(e => e.side !== side && e.kind !== 'tower' && cells.some(([r, c]) => r === e.row && c === e.col)).length;
      return `«${def.nameHy}» հմայքը հարվածում է թշնամու ${n} միավորի`;
    }
  }
  const threat = foes.find(f => towers.some(t => chebyshev(f.row, f.col, t.row, t.col) <= 3));
  const placed = actions.filter(a => CARDS[a.cardId].type !== 'spell');
  if (threat && placed.length) return `թշնամու «${unitName(threat)}» միավորը մոտեցել է իմ աշտարակին, և պետք է պաշտպանվել`;
  for (const a of placed) {
    const def = CARDS[a.cardId];
    if (def.range >= 2 && foes.length) {
      let near = foes[0];
      for (const f of foes) if (chebyshev(a.row, a.col, f.row, f.col) < chebyshev(a.row, a.col, near.row, near.col)) near = f;
      if (chebyshev(a.row, a.col, near.row, near.col) > near.range + near.speed) {
        return `թշնամու «${unitName(near)}» միավորը հաջորդ քայլին չի կարող հասնել «${def.nameHy}» միավորին`;
      }
    }
  }
  const hero = placed.find(a => CARDS[a.cardId].type !== 'soldier' && CARDS[a.cardId].type !== 'building');
  if (hero) return `«${CARDS[hero.cardId].nameHy}» քարտի ունակությունը հիմա առավել օգտակար է`;
  for (const a of actions) {
    const ab = CARDS[a.cardId].ability;
    if (ab === 'ararat') return 'վիրավոր զորքերը կվերականգնեն կյանքը';
    if (ab === 'horn') return 'զորքերն ավելի արագ կհասնեն թշնամու աշտարակներին';
    if (ab === 'anahit') return 'պետք է պահպանել արժեքավոր միավորը թշնամու հարվածից';
  }
  if (placed.length) {
    const col = placed[0].col, mid = Math.ceil(view.cols / 2);
    const lane = col < mid ? 'ձախ' : col > mid ? 'աջ' : 'կենտրոնական';
    return `այսպես ուժեղանում է ճնշումը ${lane} կամրջի ուղղությամբ`;
  }
  return 'սա լավագույն հարաբերակցությունն է տալիս';
}

/**
 * Build the explanation for the chosen candidate.
 * Feature deltas are measured against the "pass" move (doing nothing this turn).
 * @returns { text, deltas: [{ key, labelHy, delta }] }
 */
export function explain(view, side, chosen, passCand, onlyOption = false) {
  const after = evaluate(chosen.after, side);
  const base = passCand ? evaluate(passCand.after, side) : evaluate(view, side);
  const deltas = FEATURE_KEYS.map(key => ({
    key, labelHy: after.features[key].labelHy, delta: after.features[key].value - base.features[key].value,
  })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const top = deltas[0];
  if (!chosen.actions.length && onlyOption) {
    return { text: 'Այս քայլին քարտ չխաղացի. ոսկին չի բավականացնում ձեռքիս քարտերի համար (կամ դրանք հիմա կիրառելի չեն), ուստի կուտակում եմ ոսկի։', deltas };
  }
  if (!chosen.actions.length) {
    return { text: 'Այս քայլին քարտ չխաղացի. ոչ մի քարտ հիմա չէր լավացնում դիրքը, ուստի խնայում եմ ոսկին ավելի ուժեղ քայլի համար։', deltas };
  }
  const names = chosen.actions.map(a => `«${CARDS[a.cardId].nameHy}»`).join(', ');
  let text = `Ընտրեցի ${names}, քանի որ ${reasonFor(view, side, chosen.actions)}`;
  if (chosen.after.winner === side) text += ', և դա ինձ հաղթանակ է բերում։';
  else if (Math.abs(top.delta) >= 0.05) text += `, իսկ ամենամեծ ազդեցությունը՝ «${top.labelHy}» ${fmt(top.delta)}։`;
  else text += '։';
  return { text, deltas };
}
