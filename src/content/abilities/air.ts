/**
 * Airbending: the lowest damage and the lowest HP, and by far the most
 * dangerous positioning in the game. An airbender wins fights by shoving
 * people into fire, off ledges, and out of formation.
 */

import type { Ability } from '../../core/types';
import { ability, allyTarget, blast, cone, enemyTarget, selfTarget, tileTarget } from './helpers';

export const AIR_ABILITIES: readonly Ability[] = [
  ability({
    id: 'air_blast',
    name: 'Air Blast',
    element: 'air',
    apCost: 1,
    range: 6,
    targeting: enemyTarget,
    effects: [
      { kind: 'damage', base: 3, scale: 0.5, damageType: 'air' },
      { kind: 'push', distance: 2 },
    ],
    description:
      'A hard shove of wind at one enemy, pushing them 2 tiles straight away from you. Aim it so they land in fire, water or oil.',
    flavor: 'Into the fire is a legitimate answer.',
    fx: 'fx.air.blast',
    tags: ['attack', 'control'],
  }),
  ability({
    id: 'air_scooter',
    name: 'Air Scooter',
    element: 'air',
    apCost: 1,
    range: 6,
    targeting: tileTarget,
    cooldown: 2,
    requiresLineOfSight: false,
    effects: [{ kind: 'dash' }],
    description:
      'Ride a ball of spinning air to any open tile within 6. You do not need a clear view of it, and nothing in between stops you.',
    flavor: 'Every novice tries it first. Most fall off.',
    fx: 'fx.air.scooter',
    tags: ['mobility'],
  }),
  ability({
    id: 'gust',
    name: 'Gust',
    element: 'air',
    apCost: 2,
    range: 4,
    targeting: cone(3),
    effects: [
      { kind: 'damage', base: 4, scale: 0.5, damageType: 'air' },
      { kind: 'push', distance: 1 },
      { kind: 'status', status: 'blinded', duration: 2, chance: 0.4, to: 'hit' },
    ],
    description:
      'A fan of wind and dust three tiles deep. Everyone in it, friend or foe, is pushed back a tile with a 40% chance of being Blinded. It clears steam but spreads fire.',
    flavor: 'Wind also feeds a fire. Watch what you fan.',
    fx: 'fx.air.gust',
    tags: ['attack', 'control'],
  }),
  ability({
    id: 'cyclone',
    name: 'Cyclone',
    element: 'air',
    apCost: 3,
    range: 6,
    targeting: blast(2),
    cooldown: 3,
    effects: [
      { kind: 'damage', base: 6, scale: 0.7, damageType: 'air' },
      { kind: 'pull', distance: 2 },
      { kind: 'status', status: 'slowed', duration: 2, chance: 0.6, to: 'hit' },
    ],
    description:
      'A spinning column over a 5×5 area. Everyone caught, friend or foe, is hit and pulled towards the centre, with a 60% chance of being Slowed.',
    flavor: 'Gather them up, then let the earthbender drop a rock on the pile.',
    fx: 'fx.air.cyclone',
    tags: ['attack', 'control'],
  }),
  ability({
    id: 'air_cushion',
    name: 'Air Cushion',
    element: 'air',
    apCost: 2,
    range: 5,
    targeting: allyTarget,
    cooldown: 2,
    effects: [
      { kind: 'heal', base: 4, scale: 0.3 },
      { kind: 'status', status: 'guarded', duration: 1, chance: 1, to: 'hit' },
      { kind: 'grantAp', amount: 1, to: 'hit' },
    ],
    description:
      'Catch an ally within 5 tiles, or yourself, on a cushion of air: a small heal, Guarded for 1 round, and 1 extra AP.',
    flavor: 'Helping is a technique too.',
    fx: 'fx.air.cushion',
    tags: ['heal', 'buff'],
  }),
  ability({
    id: 'sonic_boom',
    name: 'Sonic Boom',
    element: 'air',
    apCost: 2,
    range: 7,
    targeting: enemyTarget,
    cooldown: 2,
    effects: [
      { kind: 'damage', base: 7, scale: 0.7, damageType: 'air' },
      { kind: 'status', status: 'stunned', duration: 1, chance: 0.3, to: 'hit' },
    ],
    description:
      'A clap of compressed air at one enemy up to 7 tiles away, with a 30% chance to Stun them.',
    flavor: 'Loud, in every sense.',
    fx: 'fx.air.boom',
  }),
  ability({
    id: 'tornado',
    name: 'Tornado',
    element: 'air',
    apCost: 3,
    range: 7,
    targeting: blast(2),
    cooldown: 4,
    effects: [
      { kind: 'damage', base: 7, scale: 0.8, damageType: 'air' },
      { kind: 'push', distance: 3 },
      { kind: 'status', status: 'blinded', duration: 2, chance: 0.75, to: 'hit' },
      { kind: 'status', status: 'slowed', duration: 2, chance: 0.5, to: 'hit' },
    ],
    description:
      'A full funnel over a 5×5 area. Everyone caught, friend or foe, is thrown 3 tiles outward, with a 75% chance of being Blinded and an even chance of being Slowed.',
    flavor: 'The air is never still. It only waits.',
    fx: 'fx.air.tornado',
    tags: ['attack', 'control', 'signature'],
  }),
  ability({
    id: 'air_shield',
    name: 'Air Shield',
    element: 'air',
    apCost: 1,
    range: 0,
    targeting: selfTarget,
    cooldown: 2,
    effects: [
      { kind: 'status', status: 'guarded', duration: 1, chance: 1, to: 'self' },
      { kind: 'cleanse', statuses: ['burning'] },
    ],
    description: 'Wrap yourself in moving air: Guarded for 1 round, and it snuffs out Burning.',
    flavor: 'Evade first. Always.',
    fx: 'fx.air.shield',
    tags: ['buff'],
  }),

  /* ------------------------------------------------------------------ */
  /* Sound discipline                                                    */
  /* ------------------------------------------------------------------ */

  ability({
    id: 'deafening_shout',
    name: 'Deafening Shout',
    element: 'air',
    apCost: 2,
    range: 3,
    targeting: cone(3),
    cooldown: 3,
    effects: [
      { kind: 'damage', base: 7, scale: 0.6, damageType: 'air' },
      { kind: 'status', status: 'slowed', duration: 2, chance: 0.8, to: 'hit' },
      { kind: 'status', status: 'stunned', duration: 1, chance: 0.35, to: 'hit' },
    ],
    description:
      'A shout of compressed air through a cone three tiles deep. Everyone in it, friend or foe, has an 80% chance to be Slowed and a 35% chance to be Stunned.',
    flavor: 'Airbending is not always quiet.',
    fx: 'fx.air.shout',
    tags: ['attack', 'control'],
  }),
  ability({
    id: 'shatterpoint',
    name: 'Shatterpoint',
    element: 'air',
    apCost: 3,
    range: 7,
    targeting: blast(1),
    cooldown: 4,
    effects: [
      { kind: 'damage', base: 13, scale: 1.1, damageType: 'air', ignoreDefense: true },
      { kind: 'status', status: 'stunned', duration: 1, chance: 0.6, to: 'hit' },
      { kind: 'push', distance: 2 },
    ],
    description:
      'Two shockfronts meet over a 3×3 area, friend or foe. Ignores Defence, pushes everyone 2 tiles outward and has a 60% chance to Stun each.',
    flavor: 'Find the note the thing is already singing. Then sing it louder.',
    fx: 'fx.air.shatter',
    tags: ['attack', 'control', 'signature'],
  }),
];
