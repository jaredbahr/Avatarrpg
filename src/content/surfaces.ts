/**
 * Terrain surfaces.
 *
 * One surface per tile. What happens when a second one lands is decided by the
 * combo table in `combos.ts`, never here — this file only says what it is like
 * to stand on a thing.
 *
 * `moveCost` is *extra* move points on top of the base 1 per step.
 */

import type { SurfaceDef, SurfaceId } from '../core/types';

export const SURFACES: readonly SurfaceDef[] = [
  {
    id: 'water',
    name: 'Water',
    description: 'Shallow water. Wades slowly, soaks whatever stands in it.',
    moveCost: 1,
    enterDamage: 0,
    enterDamageType: 'water',
    enterStatus: 'wet',
    enterStatusChance: 1,
    blocksSight: false,
    grantsCover: false,
    defaultDuration: 4,
  },
  {
    id: 'ice',
    name: 'Ice',
    description: 'Slick and freezing. Easy to cross, hard to stay upright on.',
    moveCost: 0,
    enterDamage: 0,
    enterDamageType: 'cold',
    enterStatus: 'chilled',
    enterStatusChance: 0.4,
    blocksSight: false,
    grantsCover: false,
    defaultDuration: 3,
  },
  {
    id: 'fire',
    name: 'Fire',
    description: 'Open flame. 4 damage on entry and at the start of a turn spent in it.',
    moveCost: 0,
    enterDamage: 4,
    enterDamageType: 'fire',
    enterStatus: 'burning',
    enterStatusChance: 1,
    blocksSight: false,
    grantsCover: false,
    defaultDuration: 2,
  },
  {
    id: 'mud',
    name: 'Mud',
    description: 'Churned earth. Slow going, and it grabs at your feet.',
    moveCost: 1,
    enterDamage: 0,
    enterDamageType: 'earth',
    enterStatus: 'rooted',
    enterStatusChance: 0.25,
    blocksSight: false,
    grantsCover: false,
    defaultDuration: 3,
  },
  {
    id: 'steam',
    name: 'Steam',
    description: 'A scalding cloud. Nothing can see through it.',
    moveCost: 0,
    enterDamage: 0,
    enterDamageType: 'fire',
    enterStatus: null,
    enterStatusChance: 0,
    blocksSight: true,
    grantsCover: true,
    defaultDuration: 1,
  },
  {
    id: 'oil',
    name: 'Oil',
    description: 'Spilled lamp oil. Harmless until someone brings a flame.',
    moveCost: 1,
    enterDamage: 0,
    enterDamageType: 'physical',
    enterStatus: null,
    enterStatusChance: 0,
    blocksSight: false,
    grantsCover: false,
    defaultDuration: -1,
  },
  {
    id: 'rubble',
    name: 'Rubble',
    description: 'Broken stone. Awkward to cross, but good cover to fight behind.',
    moveCost: 1,
    enterDamage: 0,
    enterDamageType: 'earth',
    enterStatus: null,
    enterStatusChance: 0,
    blocksSight: false,
    grantsCover: true,
    defaultDuration: -1,
  },
];

export const SURFACE_BY_ID: ReadonlyMap<SurfaceId, SurfaceDef> = new Map(
  SURFACES.map((s) => [s.id, s]),
);
