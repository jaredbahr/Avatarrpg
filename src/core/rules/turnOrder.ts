/**
 * Initiative.
 *
 * Fixed round-robin: the order is rolled once when the battle starts and shown
 * as a portrait strip for the whole fight. Re-rolling every round is more
 * "realistic" and much worse at a shared table, where six players need to know
 * whose turn is coming so they can plan while somebody else is thinking.
 *
 * Sort keys, in order:
 *   1. effective Speed, descending
 *   2. the party wins ties (allies too — the players' side acts first)
 *   3. a seeded jitter, so two identical bandits are not always in the same
 *      order across replays of the same seed... but *are* within one seed
 *   4. unit id, so the sort is total and therefore reproducible
 */

import type { RngCursor } from '../rng';
import type { BattleState, ContentIndex, Unit } from '../types';
import { effectiveStats, isAlive } from './stats';

function factionRank(unit: Unit): number {
  return unit.faction === 'enemy' ? 1 : 0;
}

export function rollInitiative(
  content: ContentIndex,
  units: readonly Unit[],
  rng: RngCursor,
): string[] {
  const jitter = new Map<string, number>();
  for (const unit of units) jitter.set(unit.id, rng.int(0, 999));

  return [...units]
    .sort((a, b) => {
      const speedDelta = effectiveStats(content, b).speed - effectiveStats(content, a).speed;
      if (speedDelta !== 0) return speedDelta;

      const factionDelta = factionRank(a) - factionRank(b);
      if (factionDelta !== 0) return factionDelta;

      const jitterDelta = (jitter.get(a.id) ?? 0) - (jitter.get(b.id) ?? 0);
      if (jitterDelta !== 0) return jitterDelta;

      return a.id.localeCompare(b.id);
    })
    .map((u) => u.id);
}

/** The unit whose turn it currently is, or undefined if it is dead/missing. */
export function activeUnit(battle: BattleState): Unit | undefined {
  const id = battle.order[battle.turnIndex];
  if (!id) return undefined;
  return battle.units.find((u) => u.id === id);
}

export interface TurnAdvance {
  readonly turnIndex: number;
  readonly round: number;
  /** True when the pointer wrapped and a new round began. */
  readonly roundAdvanced: boolean;
  /** Undefined when nobody on either side is left standing. */
  readonly unitId: string | undefined;
}

/**
 * Advances the turn pointer to the next *living* unit, wrapping into the next
 * round. Dead units keep their slot in `order` (so the portrait strip does not
 * jump around) and are simply skipped.
 */
export function advanceTurn(battle: BattleState): TurnAdvance {
  const living = new Set(battle.units.filter(isAlive).map((u) => u.id));
  if (living.size === 0) {
    return {
      turnIndex: battle.turnIndex,
      round: battle.round,
      roundAdvanced: false,
      unitId: undefined,
    };
  }

  let index = battle.turnIndex;
  let round = battle.round;
  let roundAdvanced = false;

  // At most one full lap plus one, since at least one unit is alive.
  for (let step = 0; step <= battle.order.length; step++) {
    index += 1;
    if (index >= battle.order.length) {
      index = 0;
      round += 1;
      roundAdvanced = true;
    }
    const id = battle.order[index];
    if (id && living.has(id)) {
      return { turnIndex: index, round, roundAdvanced, unitId: id };
    }
  }

  return { turnIndex: index, round, roundAdvanced, unitId: undefined };
}

/** Upcoming turn order from the current position, for the portrait strip. */
export function upcomingOrder(battle: BattleState, count = 8): Unit[] {
  const out: Unit[] = [];
  const total = battle.order.length;
  if (total === 0) return out;

  for (let step = 0; step < total * 2 && out.length < count; step++) {
    const index = (battle.turnIndex + step) % total;
    const id = battle.order[index];
    if (!id) continue;
    const unit = battle.units.find((u) => u.id === id);
    if (unit && isAlive(unit)) out.push(unit);
  }
  return out;
}

export function livingByFaction(battle: BattleState) {
  const party = battle.units.filter((u) => isAlive(u) && u.faction === 'party');
  const allies = battle.units.filter((u) => isAlive(u) && u.faction === 'ally');
  const enemies = battle.units.filter((u) => isAlive(u) && u.faction === 'enemy');
  return { party, allies, enemies };
}

/**
 * Hard ceiling on a fight.
 *
 * Nothing in the rules guarantees two sides will ever finish each other off —
 * a party that only kites and an enemy that only reshapes terrain can circle
 * forever, which the simulator caught doing exactly that. At a shared table a
 * fight that never ends is the worst possible failure, so it is capped: the
 * party is driven off and the story routes to the retry node.
 *
 * Observed fights finish in single-digit rounds, so this should never fire in
 * real play. It exists so that if it ever does, the tablet keeps working.
 */
export const MAX_BATTLE_ROUNDS = 50;

/** Victory when no enemies stand; defeat when no party members do, or time runs out. */
export function battleOutcome(battle: BattleState): 'active' | 'victory' | 'defeat' {
  const { party, enemies } = livingByFaction(battle);
  if (party.length === 0) return 'defeat';
  if (enemies.length === 0) return 'victory';
  if (battle.round > MAX_BATTLE_ROUNDS) return 'defeat';
  return 'active';
}

/** True when the battle ended on the clock rather than on a knockout. */
export function endedOnTimeLimit(battle: BattleState): boolean {
  const { party, enemies } = livingByFaction(battle);
  return battle.round > MAX_BATTLE_ROUNDS && party.length > 0 && enemies.length > 0;
}
