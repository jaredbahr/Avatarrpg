/**
 * The pure half of `BattleDraft.beginTurn`.
 *
 * A unit's activation opens with its cooldowns a round shorter and its statuses
 * ticked. Whether the turn is skipped is read *before* that tick, so a one-round
 * Freeze or Stun costs exactly one activation while a one-round Chi-Block wears
 * off before the unit acts.
 *
 * `battleDraft` runs the parts in order and adds the side effects it alone can
 * apply — events, damage over time and surface contact. The wall planner calls
 * the same two steps on a copy to ask what an enemy will look like on its *next*
 * activation instead of guessing at the rules.
 */

import type { ContentIndex, StatusId, Unit } from '../types';
import { tickStatuses, type StatusTick } from './status';
import { effectiveStats, isSkippingTurn, startingAp } from './stats';

export interface TurnStartTick {
  /** The unit after its cooldowns fall and its statuses tick. */
  readonly unit: Unit;
  /** True when Frozen/Stunned costs this unit its activation. */
  readonly skipping: boolean;
  readonly expired: readonly StatusId[];
  readonly tickDamage: StatusTick['tickDamage'];
}

/**
 * Reads the skip decision, drops each cooldown by a round, and ticks statuses.
 * Nothing is mutated; the caller decides what the results mean.
 */
export function tickTurnStart(content: ContentIndex, unit: Unit): TurnStartTick {
  const skipping = isSkippingTurn(content, unit);

  const cooldowns: Record<string, number> = {};
  for (const [abilityId, rounds] of Object.entries(unit.cooldowns)) {
    if (rounds > 1) cooldowns[abilityId] = rounds - 1;
  }

  const tick = tickStatuses(content, { ...unit, cooldowns });
  return { unit: tick.unit, skipping, expired: tick.expired, tickDamage: tick.tickDamage };
}

/**
 * The AP and movement a unit begins its turn with, from whatever state it is in
 * when the caller reaches this step. A skipped activation gets neither, and
 * banked and pending AP never survive into the turn.
 */
export function refreshTurnResources(content: ContentIndex, unit: Unit, skipping: boolean): Unit {
  const stats = effectiveStats(content, unit);
  return {
    ...unit,
    ap: skipping ? 0 : startingAp(content, unit),
    move: skipping ? 0 : stats.maxMove,
    bankedAp: 0,
    pendingAp: 0,
  };
}
