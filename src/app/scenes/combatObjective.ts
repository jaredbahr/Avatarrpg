/**
 * What the combat header says about an encounter's objective and round limit
 * (ADR 0116's 2026-11-15 amendment). Pure, so the words are tested without a
 * DOM; the board cells are drawn from the same encounter by the scene.
 */

import { roundsLeft } from '../../core/rules/objectives';
import type { EncounterDef } from '../../core/types';
import type { OverlayLayer } from '../../render/renderer';

export interface ObjectiveLine {
  /** The objective's label, or the plain goal when only the clock is set. */
  readonly label: string;
  /** "3 rounds left", "Last round!", or null with no round limit. */
  readonly rounds: string | null;
  /** True on the last round, so the chip can stand out. */
  readonly urgent: boolean;
  /** The whole line for a screen reader. */
  readonly spoken: string;
}

/** The goal shown when an encounter has a round limit and no objective. */
export const DEFEAT_ALL_GOAL = 'Defeat every enemy';

export function roundsText(left: number | null): string | null {
  if (left === null) return null;
  if (left <= 1) return 'Last round!';
  return `${left} rounds left`;
}

/** Null when the encounter has neither an objective nor a round limit. */
export function objectiveLine(
  encounter: Pick<EncounterDef, 'objective' | 'loseAfterRound'> | undefined,
  round: number,
): ObjectiveLine | null {
  if (!encounter?.objective && encounter?.loseAfterRound === undefined) return null;
  const label = encounter.objective?.label ?? DEFEAT_ALL_GOAL;
  const left = roundsLeft(round, encounter);
  const rounds = roundsText(left);
  const spoken = rounds ? `Goal: ${label}. ${rounds}` : `Goal: ${label}.`;
  return { label, rounds, urgent: left !== null && left <= 1, spoken };
}

const layers = new WeakMap<object, OverlayLayer>();

/**
 * The board layer for the objective's cells, or null. The same object for the
 * same objective, every frame: both backends cache an overlay's traced outline
 * by the layer object.
 */
export function objectiveOverlay(
  encounter: Pick<EncounterDef, 'objective'> | undefined,
): OverlayLayer | null {
  const objective = encounter?.objective;
  if (!objective || objective.cells.length === 0) return null;
  let layer = layers.get(objective);
  if (!layer) {
    layer = { kind: 'objective', tiles: objective.cells };
    layers.set(objective, layer);
  }
  return layer;
}
