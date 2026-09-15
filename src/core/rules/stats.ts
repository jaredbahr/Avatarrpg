/**
 * Effective stats: a unit's base numbers plus whatever its statuses are doing
 * to it right now. Nothing reads `unit.base` directly — damage, movement, turn
 * order and the AI all go through `effectiveStats`.
 */

import type { ContentIndex, DamageType, StatusDef, StatusId, Unit, UnitStats } from '../types';

/** Hard ceiling on banked AP, so nobody saves up an unanswerable alpha strike. */
export const MAX_BANKED_TOTAL_AP = 6;
/** AP carried into the next turn, at most, regardless of how much went unused. */
export const AP_BANK_PER_TURN = 1;

export function statusDefs(content: ContentIndex, unit: Unit): StatusDef[] {
  const out: StatusDef[] = [];
  for (const s of unit.statuses) {
    const def = content.statuses.get(s.id);
    if (def) out.push(def);
  }
  return out;
}

export function hasStatus(unit: Unit, id: StatusId): boolean {
  return unit.statuses.some((s) => s.id === id);
}

export function statusStacks(unit: Unit, id: StatusId): number {
  return unit.statuses.find((s) => s.id === id)?.stacks ?? 0;
}

/** Base stats with every active status modifier folded in. Never goes negative. */
export function effectiveStats(content: ContentIndex, unit: Unit): UnitStats {
  const { maxHp } = unit.base;
  let { maxAp, maxMove, power, defense, speed, focus } = unit.base;

  for (const def of statusDefs(content, unit)) {
    const m = def.modifiers;
    power += m.power;
    defense += m.defense;
    speed += m.speed;
    focus += m.focus;
    maxMove += m.move;
    maxAp += m.ap;
  }

  return {
    maxHp,
    maxAp: Math.max(1, maxAp),
    maxMove: Math.max(0, maxMove),
    power: Math.max(0, power),
    defense: Math.max(0, defense),
    speed: Math.max(1, speed),
    focus: Math.max(0, focus),
  };
}

/** Multiplier applied to incoming damage of one type, from all statuses. */
export function incomingMultiplier(
  content: ContentIndex,
  unit: Unit,
  damageType: DamageType,
): number {
  let multiplier = 1;
  for (const def of statusDefs(content, unit)) {
    const m = def.modifiers.incomingMultiplier[damageType];
    if (typeof m === 'number') multiplier *= m;
  }
  return multiplier;
}

/** Additive accuracy points contributed by the attacker's own statuses. */
export function accuracyModifier(content: ContentIndex, unit: Unit): number {
  let total = 0;
  for (const def of statusDefs(content, unit)) total += def.modifiers.accuracy;
  return total;
}

export function isSkippingTurn(content: ContentIndex, unit: Unit): boolean {
  return statusDefs(content, unit).some((d) => d.skipsTurn);
}

export function canMove(content: ContentIndex, unit: Unit): boolean {
  return !statusDefs(content, unit).some((d) => d.preventsMove || d.skipsTurn);
}

export function canUseAbilities(content: ContentIndex, unit: Unit): boolean {
  return !statusDefs(content, unit).some((d) => d.preventsAbilities || d.skipsTurn);
}

/** AP the unit starts its turn with: its max, plus anything banked, capped. */
export function startingAp(content: ContentIndex, unit: Unit): number {
  const stats = effectiveStats(content, unit);
  return Math.max(0, Math.min(MAX_BANKED_TOTAL_AP, stats.maxAp + unit.bankedAp));
}

/** How much of this turn's leftover AP carries forward. */
export function bankableAp(remainingAp: number): number {
  return Math.min(AP_BANK_PER_TURN, Math.max(0, remainingAp));
}

export function isAlive(unit: Unit): boolean {
  return unit.hp > 0;
}

export function clampHp(hp: number, maxHp: number): number {
  if (!Number.isFinite(hp)) return 0;
  return Math.max(0, Math.min(maxHp, Math.round(hp)));
}
