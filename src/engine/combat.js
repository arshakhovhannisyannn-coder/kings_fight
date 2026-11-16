// Combat: targeting, damage modifiers, deaths, bounties.
import { ev, chebyshev, removeEntity, addGold } from './state.js';

/** Is any enemy entity (unit, building or tower) within the unit's range? */
export function anyEnemyInRange(state, u) {
  const ents = state.entities, r = u.range;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.side !== u.side && chebyshev(u.row, u.col, e.row, e.col) <= r) return true;
  }
  return false;
}

/**
 * Target for a unit: the target it is already fighting (v1.4 lock, while alive and in range); otherwise
 * enemy units first (lowest HP, tie -> closest, then lower id), then buildings/towers (closest, tie -> lowest HP, then lower id).
 */
export function pickTargetForUnit(state, u) {
  const ents = state.entities, r = u.range;
  // v1.4 target lock: keep fighting the current target while it is alive and in range
  if (u.lock && state.cfg.targetLock) {
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (e.id !== u.lock) continue;
      if (!e.dead && e.side !== u.side && chebyshev(u.row, u.col, e.row, e.col) <= r) return e;
      break;
    }
    u.lock = 0;
  }
  let bu = null, buD = 0, bb = null, bbD = 0;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.side === u.side) continue;
    const d = chebyshev(u.row, u.col, e.row, e.col);
    if (d > r) continue;
    if (e.kind === 'unit') {
      if (!bu || e.hp < bu.hp || (e.hp === bu.hp && (d < buD || (d === buD && e.id < bu.id)))) { bu = e; buD = d; }
    } else if (!bb || d < bbD || (d === bbD && (e.hp < bb.hp || (e.hp === bb.hp && e.id < bb.id)))) { bb = e; bbD = d; }
  }
  return bu || bb;
}

/** Target for a tower / shooting building: closest enemy unit in range (tie -> lowest HP, then lower id). */
export function pickTargetForTower(state, t) {
  const ents = state.entities, r = t.range;
  let best = null, bd = 0;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.side === t.side || e.kind !== 'unit') continue;
    const d = chebyshev(t.row, t.col, e.row, e.col);
    if (d > r) continue;
    if (!best || d < bd || (d === bd && (e.hp < best.hp || (e.hp === best.hp && e.id < best.id)))) { best = e; bd = d; }
  }
  return best;
}

/** Effective attack of an entity: Tigran's aura (+1 within distance 2), Davit Bek's double damage near own towers. */
export function effectiveAtk(state, u) {
  let a = u.atk;
  if (u.kind !== 'unit') return a;
  const ents = state.entities;
  let nearTower = false;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.side !== u.side || e === u) continue;
    if (e.ab === 'tigran' && a === u.atk && chebyshev(u.row, u.col, e.row, e.col) <= 2) a += 1;
    else if (e.kind === 'tower' && u.ab === 'davitbek' && chebyshev(u.row, u.col, e.row, e.col) <= 2) nearTower = true;
  }
  if (nearTower) a *= 2;
  return a;
}

/**
 * Apply damage to a target. Handles Anahit's protection, Ashot's shield, halving effects and deaths.
 * @param {object} src  attacking entity or null (spell)
 * @param {boolean} ranged  true for attacks made from range >= 2 (units, towers, buildings)
 * @returns actual damage dealt
 */
export function dealDamage(state, target, amount, srcSide, src, ranged) {
  if (target.dead || amount <= 0) return 0;
  if (target.invuln) { ev(state, { t: 'dmg', id: target.id, amount: 0, hp: target.hp, blocked: 'invuln' }); return 0; }
  if (target.shield > 0) {
    target.shield--;
    ev(state, { t: 'dmg', id: target.id, amount: 0, hp: target.hp, blocked: 'shield' });
    return 0;
  }
  let d = amount;
  if (ranged && target.ab === 'antiRanged') d = Math.max(1, d >> 1);
  if (target.ab === 'titan') d = Math.max(1, d - 1);
  if (target.kind === 'unit') {
    // adjacent friendly support: shield-bearer (ranged units only) and the Seleucid phalanx aura
    const ents = state.entities;
    let guard = false, phalanx = false;
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (e.side !== target.side || e === target || (e.ab !== 'guard' && e.ab !== 'phalanx')) continue;
      if (chebyshev(target.row, target.col, e.row, e.col) > 1) continue;
      if (e.ab === 'guard') guard = true; else phalanx = true;
    }
    if (guard && target.range >= 2) d = Math.max(1, d >> 1);
    if (phalanx) d = Math.max(1, d - 1);
  }
  target.hp -= d;
  ev(state, { t: 'dmg', id: target.id, amount: d, hp: Math.max(0, target.hp) });
  if (target.hp <= 0) killEntity(state, target, srcSide, src);
  return d;
}

function killEntity(state, target, srcSide, src) {
  if (target.revive) {
    target.revive = false;
    target.hp = Math.ceil(target.maxHp / 2);
    ev(state, { t: 'revive', id: target.id, hp: target.hp });
    return;
  }
  removeEntity(state, target);
  ev(state, { t: 'death', id: target.id });
  const cfg = state.cfg;
  let bounty = 0;
  if (target.kind === 'unit') bounty = target.ctype === 'hero' ? cfg.bounty.hero : cfg.bounty.soldier;
  else if (target.kind === 'building') bounty = cfg.bounty.building;
  else if (target.kind === 'tower') {
    state.towersDestroyed[1 - target.side]++;
    if (target.cardId === 'tower_king') {
      state.winner = 1 - target.side;
      state.winReason = 'king';
      ev(state, { t: 'win', winner: state.winner, reason: 'king' });
    } else if (cfg.towerBounty) bounty = cfg.bounty.building;
  }
  if (src && src.ab === 'raid' && target.kind === 'unit') bounty += 2;
  if (bounty > 0 && srcSide === 1 - target.side) {
    addGold(state, srcSide, bounty);
    ev(state, { t: 'gold', side: srcSide, amount: bounty, reason: 'bounty' });
  }
  if (target.ab === 'vardan') {
    const ents = state.entities;
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (e.side === target.side && e.kind === 'unit') {
        e.hp += 3;
        ev(state, { t: 'heal', id: e.id, amount: 3, hp: e.hp });
      }
    }
  }
}

/** Is the unit currently fighting a target that is still alive? */
function hasLiveLock(state, u) {
  if (!u.lock) return false;
  const ents = state.entities;
  for (let i = 0; i < ents.length; i++) if (ents[i].id === u.lock) return !ents[i].dead;
  return false;
}

/** Damage of a tower shot at Chebyshev distance d (cfg.towers.*.atkByDist; falls back to the flat atk). */
export function towerAtkAt(state, t, d) {
  const def = state.cfg.towers[t.cardId === 'tower_king' ? 'king' : 'small'];
  const table = def && def.atkByDist;
  if (!table || !table.length) return t.atk;
  return table[Math.min(Math.max(d, 1), table.length) - 1];
}

/** One attack of a unit, tower or building against a target (with the elephant's splash). */
export function attack(state, u, target) {
  let a = effectiveAtk(state, u);
  if (u.ab === 'siege' && target.kind !== 'unit') a *= 2;
  let ranged = u.range >= 2;
  if (u.kind === 'tower') {
    // towers hit harder the closer the target is; a shot at an adjacent cell counts as melee
    const d = chebyshev(u.row, u.col, target.row, target.col);
    a = towerAtkAt(state, u, d);
    ranged = d >= 2;
  }
  ev(state, { t: 'attack', id: u.id, target: target.id, ranged });
  if (u.kind === 'unit' && state.cfg.targetLock) {
    u.lock = target.id;
    // the attacked unit answers its attacker if it is not fighting anyone yet (and can reach it)
    if (target.kind === 'unit' && !hasLiveLock(state, target) && target.atk > 0 && chebyshev(target.row, target.col, u.row, u.col) <= target.range) target.lock = u.id;
  }
  const tr = target.row, tc = target.col;
  dealDamage(state, target, a, u.side, u, ranged);
  if (u.ab === 'splash') {
    const near = state.entities.filter(e => e.side !== u.side && e !== target && chebyshev(tr, tc, e.row, e.col) <= 1);
    for (const e of near) dealDamage(state, e, 1, u.side, u, false);
  }
}
