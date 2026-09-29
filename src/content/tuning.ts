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

/** One weather intensity's obscurement curve, checked band by band. */
export const weatherLevelSchema = z
  .object({
    /** Accuracy removed per tile of distance past `minDistance - 1`. */
    perTile: z.number().int().min(0),
    /** Attacks closer than this are unaffected. */
    minDistance: z.number().int().min(1),
    /** This intensity's own ceiling, before the shared obscurement cap. */
    cap: z.number().int().min(0),
  })
  .strict();

const combatTuningShape = {
  /** Accuracy before elevation, cover and statuses. */
  baseHitChance: z.number().int().min(0).max(100),
  /** Accuracy gained per elevation tier of advantage; a tier down loses it. */
  elevationStep: z.number().int().min(0),
  /** Accuracy removed when the defender has cover and is not adjacent. */
  coverPenalty: z.number().int().min(0),
  /** Clouds and weather add up to at most this many points of miss chance. */
  obscurementCap: z.number().int().min(0),
  /** Flat penalty on adjacent (range-1) attacks when either side is in a cloud. */
  adjacentObscurementPenalty: z.number().int().min(0),
  /** The `inside` value a full cloud is worth to AI positioning (steam's 25). */
  obscurementReference: z.number().int().min(1),
  /** Indexed by intensity; index 0 is clear. A second weather type would key this by id. */
  weather: z.array(weatherLevelSchema).min(3).max(3),
  /**
   * Divisor used to reduce ranged cover from a higher-tier attacker against a
   * lower defender.
   */
  plungingCoverDivisor: z.number().int().min(1),
  /**
   * Extra move points a one-tier climb costs, unless either end is a ramp
   * (`S`). A drop is always free and a two-tier step is never legal.
   */
  climbCost: z.number().int().min(0),
  /** Extra range for long-range line-of-sight abilities from higher ground. */
  heightReachBonus: z.number().int().min(0),
  /** Defense-ignoring damage dealt per tier when forced movement drops a unit. */
  ledgeDropDamage: z.number().int().min(0),
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
  plungingCoverDivisor: 2,
  // Steam: -25 to hit anyone inside, -15 to shoot through, -15 from inside.
  // Level 1 sandstorm: -5 x (distance - 2), capped at -20.
  // Level 2 sandstorm: -10 x (distance - 1), capped at -40.
  obscurementCap: 40,
  adjacentObscurementPenalty: 10,
  obscurementReference: 25,
  weather: [
    { perTile: 0, minDistance: 1, cap: 0 },
    { perTile: 5, minDistance: 3, cap: 20 },
    { perTile: 10, minDistance: 2, cap: 40 },
  ],
  climbCost: 1,
  heightReachBonus: 1,
  ledgeDropDamage: 3,
  hitChanceMin: 5,
  hitChanceMax: 99,
});
