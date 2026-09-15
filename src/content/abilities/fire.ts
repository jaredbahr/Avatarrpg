/**
 * Firebending: the highest raw damage in the game, with the worst defence and
 * a habit of setting the floor on fire — including the floor your own party is
 * standing on. Lightning is the payoff: cheap-ish, long range, and devastating
 * on anything Wet.
 */

import type { Ability } from '../../core/types';
import { ability, blast, cone, enemyTarget, line, selfTarget, tileTarget } from './helpers';

export const FIRE_ABILITIES: readonly Ability[] = [
  ability({
    id: 'fire_jab',
    name: 'Fire Jab',
    element: 'fire',
    apCost: 1,
    range: 5,
    targeting: enemyTarget,
    effects: [{ kind: 'damage', base: 4, scale: 0.7, damageType: 'fire' }],
    description: 'A quick punch of flame. Cheap enough to throw twice a turn.',
    flavor: 'The first form anyone learns, and the last one anyone respects.',
    fx: 'fx.fire.jab',
  }),
  ability({
    id: 'flame_arc',
    name: 'Flame Arc',
    element: 'fire',
    apCost: 2,
    range: 4,
    targeting: cone(3),
    effects: [
      { kind: 'damage', base: 5, scale: 0.6, damageType: 'fire' },
      { kind: 'status', status: 'burning', duration: 2, chance: 0.5, to: 'hit' },
    ],
    description: 'A sweeping fan of fire that catches everything in a wedge.',
    flavor: 'Mind where your friends are standing.',
    fx: 'fx.fire.arc',
    tags: ['attack', 'control'],
  }),
  ability({
    id: 'fire_step',
    name: 'Fire Step',
    element: 'fire',
    apCost: 1,
    range: 4,
    targeting: tileTarget,
    cooldown: 2,
    requiresLineOfSight: true,
    effects: [{ kind: 'dash' }, { kind: 'surface', surface: 'fire', duration: 2, area: 'center' }],
    description: 'Blast off your back foot to any tile in range, leaving flame behind.',
    flavor: 'Propulsion, not flight. Mostly.',
    fx: 'fx.fire.step',
    tags: ['mobility', 'surface'],
  }),
  ability({
    id: 'fire_wall',
    name: 'Fire Wall',
    element: 'fire',
    apCost: 3,
    range: 6,
    targeting: line(3),
    cooldown: 3,
    effects: [{ kind: 'surface', surface: 'fire', duration: 3, area: 'area' }],
    description: 'Raises a wall of flame three tiles long. Nothing crosses it cheaply.',
    flavor: 'The oldest trick in siege-craft: make them come the long way.',
    fx: 'fx.fire.wall',
    tags: ['surface', 'control'],
  }),
  ability({
    id: 'lightning',
    name: 'Lightning',
    element: 'fire',
    apCost: 3,
    range: 8,
    targeting: enemyTarget,
    cooldown: 3,
    effects: [
      { kind: 'damage', base: 9, scale: 1.1, damageType: 'lightning' },
      { kind: 'status', status: 'shocked', duration: 2, chance: 0.6, to: 'hit' },
    ],
    description: 'A bolt of cold fire. Doubles against anything Wet, and races through water.',
    flavor: 'Separation, then release. Never hesitate halfway.',
    fx: 'fx.fire.lightning',
    tags: ['attack', 'signature'],
  }),
  ability({
    id: 'heat_shield',
    name: 'Heat Shield',
    element: 'fire',
    apCost: 2,
    range: 0,
    targeting: selfTarget,
    cooldown: 3,
    effects: [
      { kind: 'status', status: 'guarded', duration: 2, chance: 1, to: 'self' },
      { kind: 'cleanse', statuses: ['burning', 'chilled', 'frozen'] },
    ],
    description: 'A curtain of rising heat. Blocks damage and burns off ice.',
    flavor: 'Fire is not only for burning things down.',
    fx: 'fx.fire.shield',
    tags: ['buff'],
  }),
  ability({
    id: 'dragon_breath',
    name: 'Dragon Breath',
    element: 'fire',
    apCost: 3,
    range: 5,
    targeting: cone(4),
    cooldown: 4,
    effects: [
      { kind: 'damage', base: 10, scale: 0.9, damageType: 'fire' },
      { kind: 'status', status: 'burning', duration: 3, chance: 1, to: 'hit' },
      { kind: 'surface', surface: 'fire', duration: 2, area: 'area' },
    ],
    description: 'A roaring cone of dragonfire that leaves the ground burning.',
    flavor: 'The Sun Warriors would call this showing off.',
    fx: 'fx.fire.dragon',
    tags: ['attack', 'surface', 'signature'],
  }),
  // Used by the Fire Nation deserter; kept here so all fire fx live together.
  ability({
    id: 'fire_blast',
    name: 'Fire Blast',
    element: 'fire',
    apCost: 2,
    range: 6,
    targeting: blast(1),
    effects: [
      { kind: 'damage', base: 6, scale: 0.7, damageType: 'fire' },
      { kind: 'status', status: 'burning', duration: 2, chance: 0.4, to: 'hit' },
    ],
    description: 'A bursting ball of flame.',
    flavor: 'Standard issue, standard result.',
    fx: 'fx.fire.blast',
  }),

  /* ------------------------------------------------------------------ */
  /* Lightning discipline                                                */
  /* ------------------------------------------------------------------ */

  ability({
    id: 'lightning_arc',
    name: 'Lightning Arc',
    element: 'fire',
    apCost: 2,
    range: 6,
    targeting: line(5),
    cooldown: 3,
    effects: [
      { kind: 'damage', base: 8, scale: 0.8, damageType: 'lightning' },
      { kind: 'status', status: 'shocked', duration: 2, chance: 0.6, to: 'hit' },
    ],
    description:
      'A line of lightning straight down the rank. Anything standing in water takes double, and the puddle carries it to whoever else is in there.',
    flavor: 'Separate the energies. Then let them find each other again.',
    fx: 'fx.fire.chain',
    tags: ['attack', 'control'],
  }),
  ability({
    id: 'lightning_storm',
    name: 'Lightning Storm',
    element: 'fire',
    apCost: 3,
    range: 8,
    targeting: blast(2),
    cooldown: 5,
    effects: [
      { kind: 'damage', base: 12, scale: 1, damageType: 'lightning' },
      { kind: 'status', status: 'shocked', duration: 3, chance: 0.8, to: 'hit' },
      { kind: 'status', status: 'stunned', duration: 1, chance: 0.3, to: 'hit' },
    ],
    description:
      'Every strike at once, over a wide patch of ground. The longest cooldown any firebender has, and worth it.',
    flavor: 'Cold-blooded fire, they used to call it. Nothing cold about it.',
    fx: 'fx.fire.storm',
    tags: ['attack', 'control', 'signature'],
  }),
];
