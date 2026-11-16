// ALL tunable numbers and rule flags live here. Engine, AI and UI read from this object.
export const CONFIG = {
  // v1.4: 7×9 board (v1.2: 5×7, v1.3: 9×11 — too big in play). Cards unchanged. Bridges stay in front of the towers.
  board: { cols: 7, rows: 9, riverRow: 5, bridgeCols: [1, 4, 7] },
  // placement zones (rows) per side: 0 = player (bottom), 1 = AI (top) — the whole own half without the tower row
  zones: [[6, 8], [2, 4]],
  // v1.4: a unit that has started attacking a target (unit, tower or building) keeps attacking it while the target
  // is alive and in range; a unit hit by an enemy unit while not fighting anyone answers that attacker.
  targetLock: true,
  rounds: 20,                     // a round = simultaneous planning of both sides + a battle phase
  battleTicks: 3,                 // battle phase: units of BOTH sides act this many times per round
  // Engine-internal order of the (simultaneous) planning, used by the search: the first planner decides
  // without seeing the other's cards. In the app the AI is always the first planner.
  firstSide: 1,
  startGold: 3,
  incomeByRound: [
    { from: 1, to: 5, gold: 2 }, { from: 6, to: 10, gold: 3 },
    { from: 11, to: 15, gold: 4 }, { from: 16, to: 20, gold: 5 },
  ],
  goldCap: null,                  // null = no cap
  bounty: { soldier: 1, hero: 3, building: 3 },
  towerBounty: true,              // destroyed small tower pays the "building" bounty
  maxCardsPerTurn: 3,             // per side per round
  newUnitCanMove: true,
  // v1.3: true. With simultaneous planning, "no attack in the first tick" only punished the defender: a unit
  // placed against an enemy already in range took a free hit (found in the first human playtest). A unit acts
  // once per tick (attack OR move), so a new unit either strikes from its cell or walks — never both.
  newUnitCanAttack: true,
  turnTimerSeconds: 8,            // planning phase length; options in settings: 5, 8, 12, off (0)
  deckSize: 8, handSize: 4,
  deckLimits: { maxLegendary: 2, maxCopies: { soldier: 3, spell: 2, building: 2, hero: 1, special: 1 } },
  // NOTE: the original design used range 2 for both towers. Self-play showed that range 2 makes the game an
  // almost certain draw (see docs/DECISIONS.md and docs/experiments/6_rule_variants.md), so the default is 1.
  // v1.2 balance pass: tower attack lowered from 2 / 3 to 1 / 2 (shorter games, the King's castle falls more often;
  // numbers in docs/DECISIONS.md, section E, and docs/experiments/6_rule_variants.md).
  // v1.3: towers hit harder the closer the enemy is: atkByDist[d - 1] at Chebyshev distance d (range = its length).
  // `atk` is the maximum (shown in tooltips). Chosen by self-play from 3/2/1, 2/1/1, 2/1 (+ ticks / rounds variants):
  // range 3 gave Hard only 28–79% against Medium and up to 42% draws; 2/1 gave 83% and no draws (docs/DECISIONS.md, «Զ»).
  towers: {
    small: { hp: 15, atk: 2, range: 2, atkByDist: [2, 1] },
    king: { hp: 25, atk: 3, range: 2, atkByDist: [3, 2] },
  },
  // evaluation function weights (section 5.3); experiments can override them
  evalWeights: { king: 5, towers: 3, army: 2, crossed: 1.5, gold: 0.5, threat: 2 },
  ai: {
    easyRandomness: 0.3,
    easyMaxCards: 2,              // Easy plays at most this many cards per turn
    minimaxDepth: 2, minimaxMaxDepth: 3,
    minimaxTimeMs: 3000,          // time budget of Medium in the app
    minimaxRootK: 60,             // root candidates searched deeper than 1 ply
    mctsTimeMs: 5000, mctsC: 1.41,
    mctsRootK: 40, mctsInnerK: 10, // max children per node (root / inner)
    mctsWidenC: 2, mctsWidenAlpha: 0.5, // progressive widening: children <= C * visits^alpha
    mctsPriorDepth: 3, mctsPriorVisits: 30, // root priors from a shallow Minimax search (0 visits = off)
    mctsExpandVisits: 2,          // a node generates its children after this many visits
    sigmoidScale: 10,             // win probability = 1 / (1 + exp(-score / scale))
    rolloutRounds: 3, rolloutMaxCards: 3, // 6 in the first design; 3 proved clearly stronger in self-play
    candidateCells: 'smart',      // 'smart' | 'all'
    opponentTopK: 30,
    beamRoot: [12, 6, 3],         // movegen beam widths per placement (root)
    beamInner: [6, 3, 2],         // movegen beam widths (inner nodes)
  },
};

function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }

/** Deep-merge overrides into a copy of the base config (used by tests/experiments/settings). */
export function makeConfig(overrides = {}, base = CONFIG) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const k of Object.keys(overrides)) {
    out[k] = isObj(overrides[k]) && isObj(base[k]) ? makeConfig(overrides[k], base[k]) : overrides[k];
  }
  return out;
}

export function incomeForRound(cfg, round) {
  for (const b of cfg.incomeByRound) if (round >= b.from && round <= b.to) return b.gold;
  return cfg.incomeByRound[cfg.incomeByRound.length - 1].gold;
}
