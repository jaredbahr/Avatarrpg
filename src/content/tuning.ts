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

import type { CombatTuning } from '../core/types';

/** Today's numbers, spelled exactly as `damage.ts` had them. */
export const COMBAT_TUNING: CombatTuning = {
  baseHitChance: 90,
  elevationStep: 10,
  coverPenalty: 20,
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
  plungingCoverDivisor: 2,
  climbCost: 1,
  heightReachBonus: 1,
  ledgeDropDamage: 3,
  hitChanceMin: 5,
  hitChanceMax: 99,
};
