/**
 * How an older save answers a flag added after it was written (#773).
 *
 * A save holds the flags set on the way to where it stands. When a writer adds
 * a flag to a scene that saves have already passed, and a later region reads
 * it, those saves can never come to hold it: the scene that sets it is behind
 * them. The flag registry (`src/content/story/flags.ts`) declares, for such a
 * flag, how an old save answers: a constant, or a `Condition` over what the
 * save does hold (an older flag, a visited node). `flagContinuity.test.ts`
 * fails when content ahead of a frozen save reads a flag the save can neither
 * hold nor still set and that declares no backfill.
 *
 * This applies the declarations on load, next to `applyIdAliases`: only to a
 * flag the save does not hold, and only once the save has passed one of the
 * flag's setters (a save that has not got there yet sets it the normal way).
 * The rules are passed in, so core stays free of content values. Idempotent:
 * a backfilled flag is held, so a second load changes nothing.
 */

import type { Condition, FlagValue, GameState } from '../types';
import { evaluate } from '../story/conditions';

/** A constant, or `value` (default `true`) when `when` holds over the save; unset otherwise. */
export type FlagBackfill =
  { readonly value: FlagValue } | { readonly when: Condition; readonly value?: FlagValue };

export interface FlagBackfillRule {
  readonly key: string;
  /** The story nodes that set the flag; the save must have visited one. */
  readonly setters: readonly string[];
  readonly backfill: FlagBackfill;
}

/** The value a backfill gives this save, or undefined to leave the flag unset. */
export function backfillValue(state: GameState, backfill: FlagBackfill): FlagValue | undefined {
  if (!('when' in backfill)) return backfill.value;
  return evaluate(state, backfill.when) ? (backfill.value ?? true) : undefined;
}

/** The loaded save with every applicable backfill written into its flags. */
export function applyFlagBackfills(
  state: GameState,
  rules: readonly FlagBackfillRule[],
): GameState {
  let current = state;
  for (const rule of rules) {
    if (Object.hasOwn(current.flags, rule.key)) continue;
    if (!rule.setters.some((node) => current.story.visited.includes(node))) continue;
    const value = backfillValue(current, rule.backfill);
    if (value === undefined) continue;
    current = { ...current, flags: { ...current.flags, [rule.key]: value } };
  }
  return current;
}
