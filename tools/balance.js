// Balance sweep (developer tool): compares config variants on the §6 targets of the v1.2 task.
//   node tools/balance.js [--games=40] [--only=name1,name2] [--hard] [--mctsMs=1000]
// For every variant: Medium-Medium (draws, length, castle rate, first-planner rate), Medium-Easy,
// Easy-human-like and (with --hard) Hard-Medium.
import { CONFIG, makeConfig } from '../src/data/config.js';
import { playSeries, parseArgs } from './selfplay.js';

// v1.3 variants: distance-scaled towers on the 9×11 board (atkByDist = damage at distance 1, 2, 3)
const T = (small, king, range = 3) => ({ towers: { small: { atk: small[0], range, atkByDist: small }, king: { atk: king[0], range, atkByDist: king } } });
const V12 = { board: { cols: 5, rows: 7, riverRow: 4, bridgeCols: [1, 3, 5] }, zones: [[5, 6], [2, 3]], newUnitCanAttack: false,
  towers: { small: { atk: 1, range: 1, atkByDist: [] }, king: { atk: 2, range: 1, atkByDist: [] } } };
export const VARIANTS = {
  base: {},                                  // v1.3 defaults: small 3/2/1, king 4/3/2
  v12: V12,                                  // the previous version, for comparison
  newUnitOff: { newUnitCanAttack: false },
  t211_321: T([2, 1, 1], [3, 2, 1]),
  t21_32: T([2, 1], [3, 2], 2),
  t321_432_ticks4: { ...T([3, 2, 1], [4, 3, 2]), battleTicks: 4 },
  t211_321_ticks4: { ...T([2, 1, 1], [3, 2, 1]), battleTicks: 4 },
};
const pct = x => (100 * x).toFixed(0) + '%';

const args = parseArgs(process.argv.slice(2));
const games = Number(args.games ?? 40);
const names = args.only ? String(args.only).split(',') : Object.keys(VARIANTS);
for (const name of names) {
  const cfg = makeConfig(VARIANTS[name]);
  const mm = playSeries({ a: { level: 'medium' }, b: { level: 'medium' }, games, seed: 11, cfg });
  const me = playSeries({ a: { level: 'medium' }, b: { level: 'easy' }, games, seed: 12, cfg });
  const eh = playSeries({ a: { level: 'easy' }, b: { level: 'human' }, games: games * 3, seed: 13, cfg });
  let line = `${name.padEnd(16)} MM: draws ${pct(mm.draws / games)} len ${mm.avgRounds.toFixed(1)} castle ${pct(mm.byReason.king / games)} first ${pct(mm.firstMoverWinRate)}` +
    ` | ME: ${pct(me.winRateA)} len ${me.avgRounds.toFixed(1)} | E-human: ${pct(eh.winRateA)} len ${eh.avgRounds.toFixed(1)}`;
  if (args.hard) {
    const hm = playSeries({ a: { level: 'hard', timeMs: Number(args.mctsMs ?? 1000) }, b: { level: 'medium' }, games, seed: 14, cfg });
    line += ` | HM: ${pct(hm.winRateA)} draws ${pct(hm.draws / games)} len ${hm.avgRounds.toFixed(1)} castle ${pct(hm.byReason.king / games)} first ${pct(hm.firstMoverWinRate)}`;
  }
  console.log(line);
}
void CONFIG;
