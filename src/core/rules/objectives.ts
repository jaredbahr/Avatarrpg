/**
 * Objective win conditions and round limits (ADR 0116's 2026-11-15 amendment).
 *
 * An encounter may win without every enemy down (`EncounterDef.objective`) and
 * may lose on the clock (`EncounterDef.loseAfterRound`). Nothing here is stored:
 * the hold is read off the board at the moment a round ends, and the clock off
 * `battle.round`, so neither needs a save field. No randomness is drawn.
 */

import type { EncounterDef, EncounterObjective, Unit, Vec2 } from '../types';
import { SQUARE_FOOTPRINTS } from './footprint';
import { distance, occupiedCells } from './grid';
import { isAlive } from './stats';

type ObjectiveRules = Pick<EncounterDef, 'objective' | 'loseAfterRound'>;

/** Whether `pos` is one of the objective's cells. */
export function isObjectiveCell(objective: EncounterObjective | undefined, pos: Vec2): boolean {
  return objective?.cells.some((cell) => cell.x === pos.x && cell.y === pos.y) ?? false;
}

/** Whether a unit standing at `pos` covers an objective cell with any part of its footprint. */
export function standsOnObjective(
  objective: EncounterObjective | undefined,
  unit: Pick<Unit, 'size'>,
  pos: Vec2,
  square: boolean = SQUARE_FOOTPRINTS,
): boolean {
  if (!objective) return false;
  return occupiedCells({ pos, size: unit.size }, square).some((cell) =>
    isObjectiveCell(objective, cell),
  );
}

/** Chebyshev steps from a unit at `pos` to the nearest objective cell; 0 when on one. */
export function objectiveDistance(
  objective: EncounterObjective,
  unit: Pick<Unit, 'size'>,
  pos: Vec2,
  square: boolean = SQUARE_FOOTPRINTS,
): number {
  let best = Infinity;
  for (const cell of occupiedCells({ pos, size: unit.size }, square)) {
    for (const target of objective.cells) best = Math.min(best, distance(cell, target));
  }
  return best;
}

/**
 * The living party member or guest holding a `holdAtRoundEnd` objective, if any.
 * The first in roster order, so the message that names them is deterministic.
 */
export function objectiveHolder(
  units: readonly Unit[],
  objective: EncounterObjective | undefined,
  square: boolean = SQUARE_FOOTPRINTS,
): Unit | undefined {
  if (objective?.kind !== 'holdAtRoundEnd') return undefined;
  return units.find(
    (unit) =>
      unit.faction !== 'enemy' &&
      isAlive(unit) &&
      standsOnObjective(objective, unit, unit.pos, square),
  );
}

/** True once the round count has passed the encounter's limit without a win. */
export function outOfRounds(round: number, encounter: ObjectiveRules | undefined): boolean {
  const limit = encounter?.loseAfterRound;
  return limit !== undefined && round > limit;
}

/**
 * Rounds left including the current one (1 on the last round), or null when the
 * encounter has no limit. Never below 0.
 */
export function roundsLeft(round: number, encounter: ObjectiveRules | undefined): number | null {
  const limit = encounter?.loseAfterRound;
  return limit === undefined ? null : Math.max(0, limit - round + 1);
}

export type RoundEndOutcome =
  { readonly outcome: 'victory'; readonly holder: Unit } | { readonly outcome: 'defeat' } | null;

/**
 * What the end of `endedRound` decides, read before the next round's upkeep:
 * a held objective wins; otherwise the last allowed round ending loses.
 * The hold is checked first, so holding on the final round still wins.
 */
export function roundEndOutcome(
  units: readonly Unit[],
  endedRound: number,
  encounter: ObjectiveRules | undefined,
  square: boolean = SQUARE_FOOTPRINTS,
): RoundEndOutcome {
  const holder = objectiveHolder(units, encounter?.objective, square);
  if (holder) return { outcome: 'victory', holder };
  if (outOfRounds(endedRound + 1, encounter)) return { outcome: 'defeat' };
  return null;
}
