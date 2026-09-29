/**
 * Combat tuning numbers, as data.
 *
 * These used to be literals inside `core/rules/damage.ts`. They live here so a
 * balance variant can be A/B tested without a code edit:
 *
 *   BALANCE_TUNING=variant.json npm run balance
 *
 * `damage.ts` never imports this file — the numbers reach it on the
 * `ContentIndex` it was handed, like every other piece of content.
 *
 * These values are gameplay. `core/rules/damage.test.ts` pins the hit-chance
 * examples that today's numbers produce, so moving one is a deliberate act.
 */

import * as z from '../core/schema';
import type { CombatTuning } from '../core/types';

const combatTuningShape = {
  /** Accuracy before elevation, cover and statuses. */
  baseHitChance: z.number().int().min(0).max(100),
  /** Accuracy gained per elevation tier of advantage; a tier down loses it. */
  elevationStep: z.number().int().min(0),
  /** Accuracy removed when the defender has cover and is not adjacent. */
  coverPenalty: z.number().int().min(0),
  /**
   * Extra move points a one-tier climb costs, unless either end is a ramp
   * (`S`). A drop is always free and a two-tier step is never legal.
   */
  climbCost: z.number().int().min(0),
  /** Hit chance is clamped into this band, lowest bound first. */
  hitChanceMin: z.number().int().min(0).max(100),
  hitChanceMax: z.number().int().min(0).max(100),
};

/**
 * The authored block. Strict so a mistyped field is an error rather than a
 * silently ignored no-op.
 */
export const combatTuningSchema = z
  .object(combatTuningShape)
  .strict()
  .refine((tuning) => tuning.hitChanceMin <= tuning.hitChanceMax, {
    message: 'hitChanceMin must not exceed hitChanceMax',
    path: ['hitChanceMin'],
  });

/** A partial overlay for `BALANCE_TUNING`: name only the numbers that move. */
export const combatTuningOverrideSchema = z.object(combatTuningShape).partial().strict();

/** Today's numbers, spelled exactly as `damage.ts` had them. */
export const COMBAT_TUNING: CombatTuning = combatTuningSchema.parse({
  baseHitChance: 90,
  elevationStep: 10,
  coverPenalty: 20,
  climbCost: 1,
  hitChanceMin: 5,
  hitChanceMax: 99,
});
