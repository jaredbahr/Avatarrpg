import type { BattleState, ContentIndex, Unit, Vec2 } from '../../core/types';
import {
  directAttackThreats,
  type DirectAttackWitness,
  type ThreatBudget,
} from '../../core/rules/directAttackThreats';
import { effectiveStats, isAlive, isSkippingTurn, startingAp } from '../../core/rules/stats';
import { tickStatuses } from '../../core/rules/status';

/**
 * Deterministic resource portion of beginTurn, on the current battlefield.
 * Skip is checked before statuses expire. Contact rolls, upkeep damage/death,
 * terrain expiration and intervening actions are deliberately not simulated.
 */
export function nextActivationThreatBudget(content: ContentIndex, unit: Unit): ThreatBudget {
  const skipping = isSkippingTurn(content, unit);
  const refreshed = tickStatuses(content, unit).unit;
  const cooldowns = Object.fromEntries(
    Object.entries(unit.cooldowns)
      .filter(([, turns]) => turns > 1)
      .map(([id, turns]) => [id, turns - 1]),
  );
  return {
    ap: skipping ? 0 : startingAp(content, refreshed),
    move: skipping ? 0 : effectiveStats(content, refreshed).maxMove,
    cooldowns,
    statuses: refreshed.statuses,
  };
}

export const MOVEMENT_THREAT_QUALIFICATION =
  'Based on the current battlefield. Other actions and hazards can change this.';

export interface MovementThreatEnemy {
  readonly unitId: string;
  readonly name: string;
  readonly abilities: readonly {
    readonly id: string;
    readonly name: string;
    readonly witness: DirectAttackWitness;
  }[];
}

export interface MovementThreatView {
  /** Null means no warning, never an assertion that the destination is safe. */
  readonly warning: string | null;
  readonly qualification: string;
  readonly names: readonly string[];
  readonly remainingCount: number;
  readonly enemies: readonly MovementThreatEnemy[];
  readonly invalidReason: string | null;
}

/**
 * One cache per mounted consumer/content index. A new immutable battle object
 * retires all old entries. Pan/redraw may reuse the same result; changed unit,
 * terrain, prop, turn or status state must supply the new battle identity.
 * Call on selected destination, never from the animation loop.
 */
export function createMovementThreatQuery(content: ContentIndex) {
  let previous: BattleState | undefined;
  const cache = new Map<string, MovementThreatView>();
  return (battle: BattleState, defenderId: string, destination: Vec2): MovementThreatView => {
    if (previous !== battle) {
      previous = battle;
      cache.clear();
    }
    const key = JSON.stringify([defenderId, destination.x, destination.y]);
    const cached = cache.get(key);
    if (cached) return cached;
    const enemies: MovementThreatEnemy[] = [];
    let invalidReason: string | null = null;
    const defender = battle.units.find((u) => u.id === defenderId && isAlive(u));
    if (!defender || defender.faction === 'enemy')
      invalidReason = 'Select a living party member or ally.';
    else
      for (const enemy of battle.units) {
        if (enemy.faction !== 'enemy' || !isAlive(enemy)) continue;
        const result = directAttackThreats(
          content,
          battle,
          enemy.id,
          defenderId,
          nextActivationThreatBudget(content, enemy),
          destination,
        );
        if (!result.valid) {
          invalidReason = result.reason;
          break;
        }
        if (result.threats.length === 0) continue;
        enemies.push({
          unitId: enemy.id,
          name: enemy.name,
          abilities: result.threats.map((witness) => ({
            id: witness.abilityId,
            name: content.abilities.get(witness.abilityId)?.name ?? witness.abilityId,
            witness,
          })),
        });
      }
    const shown = invalidReason ? [] : enemies;
    const names = shown.slice(0, 2).map((enemy) => enemy.name);
    const remainingCount = Math.max(0, shown.length - names.length);
    const subject =
      names.join(remainingCount ? ', ' : ' and ') +
      (remainingCount ? ` and ${remainingCount} ${remainingCount === 1 ? 'other' : 'others'}` : '');
    const warning = names.length ? `${subject} could hit here.` : null;
    const view = {
      warning,
      qualification: MOVEMENT_THREAT_QUALIFICATION,
      names,
      remainingCount,
      enemies: shown,
      invalidReason,
    };
    cache.set(key, view);
    return view;
  };
}
