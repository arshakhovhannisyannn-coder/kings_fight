// Evaluation function (section 5.3). Score is from the perspective of `side`.
import { CARDS } from '../data/cards.js';
import { chebyshev } from '../engine/state.js';

export const FEATURE_KEYS = ['king', 'towers', 'army', 'crossed', 'gold', 'threat'];
export const FEATURE_LABELS_HY = {
  king: 'Արքայի ամրոցի կյանք',
  towers: 'Փոքր աշտարակների կյանք',
  army: 'Դաշտում զորքի արժեք',
  crossed: 'Գետն անցած զորքեր',
  gold: 'Ոսկու պաշար',
  threat: 'Սպառնալիք իմ աշտարակներին',
};
export const DECIDED = 1e5; // win/loss decided on towers after the last round

const raw = new Float64Array(6);
const towerR = new Int8Array(4), towerC = new Int8Array(4);

/** Fill `raw` with the unweighted feature values. */
function computeRaw(state, side) {
  const ents = state.entities, river = state.cfg.board.riverRow;
  let king = 0, towers = 0, army = 0, crossed = 0, threat = 0, nt = 0;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    const sgn = e.side === side ? 1 : -1;
    if (e.kind === 'tower') {
      if (e.cardId === 'tower_king') king += sgn * e.hp; else towers += sgn * e.hp;
      if (sgn === 1) { towerR[nt] = e.row; towerC[nt] = e.col; nt++; }
    } else {
      const ratio = e.hp >= e.maxHp ? (e.hp > 1.5 * e.maxHp ? 1.5 : e.hp / e.maxHp) : e.hp / e.maxHp;
      army += sgn * CARDS[e.cardId].cost * ratio;
      if (e.kind === 'unit' && (e.side === 0 ? e.row < river : e.row > river)) crossed += sgn;
    }
  }
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.side === side || e.kind !== 'unit') continue;
    for (let t = 0; t < nt; t++) {
      if (chebyshev(e.row, e.col, towerR[t], towerC[t]) <= 2) { threat++; break; }
    }
  }
  raw[0] = king; raw[1] = towers; raw[2] = army; raw[3] = crossed;
  raw[4] = state.gold[side] - state.gold[1 - side]; raw[5] = -threat;
}

function terminalScore(state, side) {
  if (state.winner === 'draw') return 0;
  const big = state.winReason === 'king' ? Infinity : DECIDED;
  return state.winner === side ? big : -big;
}

/** Fast numeric evaluation (used inside the search). */
export function evalScore(state, side) {
  if (state.winner !== null) return terminalScore(state, side);
  computeRaw(state, side);
  const w = state.cfg.evalWeights;
  return w.king * raw[0] + w.towers * raw[1] + w.army * raw[2] + w.crossed * raw[3] + w.gold * raw[4] + w.threat * raw[5];
}

/** Full evaluation with a per-feature breakdown: { score, features: { key: { raw, weight, value, labelHy } } }. */
export function evaluate(state, side) {
  computeRaw(state, side);
  const w = state.cfg.evalWeights;
  const features = {};
  let score = 0;
  FEATURE_KEYS.forEach((key, i) => {
    const value = w[key] * raw[i];
    features[key] = { raw: raw[i], weight: w[key], value, labelHy: FEATURE_LABELS_HY[key] };
    score += value;
  });
  if (state.winner !== null) score = terminalScore(state, side);
  return { score, features };
}

export function sigmoid(score, scale) {
  if (score === Infinity) return 1;
  if (score === -Infinity) return 0;
  return 1 / (1 + Math.exp(-score / scale));
}
