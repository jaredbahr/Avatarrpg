/**
 * Elemental reactions.
 *
 * Read as: "when <applied> lands on a tile currently holding <existing>, the
 * tile becomes <result>". `applied` is either a DamageType (a hit landed here)
 * or a SurfaceId (an ability painted a surface here).
 *
 * The table is ordered and the **first match wins**, so the specific rules sit
 * above the general ones. `src/core/rules/surfaces.ts` is the only consumer.
 *
 * Note that 'fire' and 'water' are both a DamageType *and* a SurfaceId, so one
 * rule covers "a fireball landed here" and "a Fire Wall was painted here". Cold
 * and ice are deliberately separate: cold damage freezes what is already wet,
 * while an ice surface is the thing left behind.
 *
 * The whole point of this table is that the kids discover it by experiment.
 * Every rule therefore has a `label` that the combat log prints in plain words.
 */

import type { ComboRule } from '../core/types';

function rule(
  partial: Partial<ComboRule> & Pick<ComboRule, 'id' | 'existing' | 'applied' | 'label'>,
): ComboRule {
  return {
    result: null,
    duration: 2,
    spread: 0,
    status: null,
    statusChance: 0,
    chainThroughExisting: false,
    chainDamage: 0,
    ...partial,
  };
}

export const COMBOS: readonly ComboRule[] = [
  /* --- Lightning is the showstopper, so it is checked first. ---------- */
  rule({
    id: 'lightning-into-water',
    existing: 'water',
    applied: 'lightning',
    result: 'water',
    duration: 4,
    status: 'shocked',
    statusChance: 1,
    chainThroughExisting: true,
    chainDamage: 6,
    label: 'The lightning races through the water!',
  }),
  rule({
    id: 'lightning-into-ice',
    existing: 'ice',
    applied: 'lightning',
    result: 'water',
    duration: 3,
    status: 'shocked',
    statusChance: 1,
    chainThroughExisting: true,
    chainDamage: 4,
    label: 'The ice cracks and carries the charge.',
  }),

  /* --- Fire --------------------------------------------------------- */
  rule({
    id: 'fire-into-oil',
    existing: 'oil',
    applied: 'fire',
    result: 'fire',
    duration: 3,
    spread: 2,
    status: 'burning',
    statusChance: 1,
    label: 'The oil catches — the fire is spreading!',
  }),
  rule({
    id: 'fire-into-water',
    existing: 'water',
    applied: 'fire',
    result: 'steam',
    duration: 2,
    label: 'The water flashes into steam.',
  }),
  rule({
    id: 'fire-into-ice',
    existing: 'ice',
    applied: 'fire',
    result: 'water',
    duration: 3,
    label: 'The ice melts away.',
  }),
  rule({
    id: 'fire-into-mud',
    existing: 'mud',
    applied: 'fire',
    result: 'mud',
    duration: 2,
    label: 'The mud hisses but holds.',
  }),
  rule({
    id: 'fire-into-steam',
    existing: 'steam',
    applied: 'fire',
    result: 'steam',
    duration: 2,
    label: 'The steam boils hotter.',
  }),

  /* --- Water -------------------------------------------------------- */
  rule({
    id: 'water-onto-fire',
    existing: 'fire',
    applied: 'water',
    result: null,
    label: 'The flames are doused.',
  }),
  rule({
    id: 'water-onto-rubble',
    existing: 'rubble',
    applied: 'water',
    result: 'mud',
    duration: 3,
    label: 'The broken stone turns to mud.',
  }),

  /* --- Cold --------------------------------------------------------- */
  rule({
    id: 'cold-into-water',
    existing: 'water',
    applied: 'cold',
    result: 'ice',
    duration: 3,
    status: 'frozen',
    statusChance: 0.75,
    label: 'The water locks solid.',
  }),
  rule({
    id: 'ice-onto-water',
    existing: 'water',
    applied: 'ice' as const,
    result: 'ice',
    duration: 3,
    status: 'frozen',
    statusChance: 0.6,
    label: 'The water locks solid.',
  }),
  rule({
    id: 'cold-into-mud',
    existing: 'mud',
    applied: 'cold',
    result: 'ice',
    duration: 3,
    label: 'The mud freezes over.',
  }),
  rule({
    id: 'cold-into-fire',
    existing: 'fire',
    applied: 'cold',
    result: null,
    label: 'The cold snuffs the flames.',
  }),

  /* --- Earth -------------------------------------------------------- */
  rule({
    id: 'earth-into-water',
    existing: 'water',
    applied: 'earth',
    result: 'mud',
    duration: 3,
    label: 'Earth churns the water into mud.',
  }),
  rule({
    id: 'earth-into-ice',
    existing: 'ice',
    applied: 'earth',
    result: 'rubble',
    duration: -1,
    label: 'The ice shatters into rubble.',
  }),
  rule({
    id: 'earth-into-fire',
    existing: 'fire',
    applied: 'earth',
    result: null,
    label: 'Earth smothers the fire.',
  }),

  /* --- Air ---------------------------------------------------------- */
  rule({
    id: 'air-into-fire',
    existing: 'fire',
    applied: 'air',
    result: 'fire',
    duration: 3,
    spread: 1,
    label: 'The wind fans the flames outward!',
  }),
  rule({
    id: 'air-into-steam',
    existing: 'steam',
    applied: 'air',
    result: null,
    label: 'The wind scatters the steam.',
  }),

  /* --- Mud and oil under pressure ----------------------------------- */
  rule({
    id: 'water-into-mud',
    existing: 'mud',
    applied: 'water',
    result: 'mud',
    duration: 4,
    label: 'The mud deepens.',
  }),
  rule({
    id: 'water-into-oil',
    existing: 'oil',
    applied: 'water',
    result: 'oil',
    duration: -1,
    label: 'The oil floats on the water, untouched.',
  }),
];

export const COMBO_BY_ID: ReadonlyMap<string, ComboRule> = new Map(COMBOS.map((c) => [c.id, c]));
