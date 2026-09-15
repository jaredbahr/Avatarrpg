import type { Ability } from '../../core/types';
import { AIR_ABILITIES } from './air';
import { EARTH_ABILITIES } from './earth';
import { ENEMY_ABILITIES } from './enemy';
import { FIRE_ABILITIES } from './fire';
import { NONBENDER_ABILITIES } from './nonbender';
import { WATER_ABILITIES } from './water';

export const ALL_ABILITIES: readonly Ability[] = [
  ...FIRE_ABILITIES,
  ...WATER_ABILITIES,
  ...EARTH_ABILITIES,
  ...AIR_ABILITIES,
  ...NONBENDER_ABILITIES,
  ...ENEMY_ABILITIES,
];

export const ABILITY_BY_ID: ReadonlyMap<string, Ability> = new Map(
  ALL_ABILITIES.map((a) => [a.id, a]),
);

export {
  AIR_ABILITIES,
  EARTH_ABILITIES,
  ENEMY_ABILITIES,
  FIRE_ABILITIES,
  NONBENDER_ABILITIES,
  WATER_ABILITIES,
};
