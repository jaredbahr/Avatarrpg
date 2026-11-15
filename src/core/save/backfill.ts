/**
 * How an older save answers history the story started recording after it was
 * written (#773, ADR 0112).
 *
 * A save holds the flags set on the way to where it stands. When a writer adds
 * a flag to a scene that saves have already passed, those saves can never come
 * to hold it: the scene that sets it is behind them, and because unset and `0`
 * are falsy a later reader silently takes the "never happened" road.
 *
 * A **backfill rule** is the declared answer: plain data, a `Condition` over
 * what the old save does hold (a visited node, an older flag) and what the
 * save is given when that condition is met (a flag value, a standing delta,
 * or a scene counted as visited). Rules live in content
 * (`src/content/story/flagBackfills.ts`) and are passed in, so core stays free
 * of content values.
 *
 * ## The history revision
 *
 * Every rule carries a `rev`, a whole number that only grows, and every save
 * file records the highest revision its writer knew (`SaveBlob.history`, 0
 * for a file from before revisions existed). On load a rule applies only when
 * its `rev` is above the file's. That is what makes a rule safe:
 *
 * - **once:** a save written after the rule shipped was played on content that
 *   sets the flag itself. If it does not hold the flag, the player really did
 *   not do the thing, and the rule must not say otherwise;
 * - **stable:** the answer is decided at the first load after the rule ships
 *   and saved with the game, not re-asked later when the inputs have moved;
 * - **exact for standing:** `adjust` adds a delta, which is only correct once.
 *
 * Rules apply in `rev` order, so a later rule may read what an earlier one
 * supplied.
 */

import type { Condition, ElementId, FlagValue, GameState } from '../types';
import { adjustStanding, evaluate, STANDING_PREFIX } from '../story/conditions';

interface BackfillBase {
  /** The history revision this rule introduced. Above every release it answers for. */
  readonly rev: number;
  /**
   * What in the old save shows it would hold this had it been played on
   * today's content: it is past the scene that records it now, and took the
   * road that records it.
   */
  readonly when: Condition;
}

/**
 * - `set`: the flag `key` is given this value, unless the save holds one;
 * - `adjust`: the standing key `key` moves by this delta, clamped as in play;
 * - `node`: the scene counts as visited, for a scene spliced into a road the
 *   save has already walked that a `visited` condition reads.
 */
export type BackfillRule =
  | (BackfillBase & { readonly key: string; readonly set: FlagValue })
  | (BackfillBase & { readonly key: string; readonly adjust: number })
  | (BackfillBase & { readonly node: string });

/** The highest revision among the rules: what a save written now records. */
export function historyRevOf(rules: readonly BackfillRule[]): number {
  return rules.reduce((highest, rule) => Math.max(highest, rule.rev), 0);
}

/**
 * The loaded save with every rule newer than its file applied. `savedRev` is
 * the file's `SaveBlob.history`. A `set` rule never overwrites a value the
 * save holds. Returns the same object when nothing applies.
 */
export function applyBackfills(
  state: GameState,
  savedRev: number,
  rules: readonly BackfillRule[],
): GameState {
  let current = state;
  const ordered = [...rules].sort((a, b) => a.rev - b.rev);
  for (const rule of ordered) {
    if (rule.rev <= savedRev) continue;
    if (!evaluate(current, rule.when)) continue;
    if ('node' in rule) {
      if (current.story.visited.includes(rule.node)) continue;
      current = {
        ...current,
        story: { ...current.story, visited: [...current.story.visited, rule.node] },
      };
      continue;
    }
    if ('adjust' in rule) {
      if (!rule.key.startsWith(STANDING_PREFIX) || rule.adjust === 0) continue;
      const nation = rule.key.slice(STANDING_PREFIX.length) as ElementId;
      current = { ...current, flags: adjustStanding(current.flags, { [nation]: rule.adjust }) };
      continue;
    }
    if (Object.hasOwn(current.flags, rule.key)) continue;
    current = { ...current, flags: { ...current.flags, [rule.key]: rule.set } };
  }
  return current;
}
