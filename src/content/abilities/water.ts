/**
 * Waterbending: the party's only real healing, plus setup tools that make
 * lightning and cold more effective — soaking targets and freezing puddles.
 */

import type { Ability } from '../../core/types';
import { ability, allyTarget, blast, cone, enemyTarget, line } from './helpers';

export const WATER_ABILITIES: readonly Ability[] = [
  ability({
    id: 'water_whip',
    name: 'Water Whip',
    element: 'water',
    apCost: 1,
    range: 5,
    targeting: enemyTarget,
    effects: [
      { kind: 'damage', base: 4, scale: 0.6, damageType: 'water' },
      { kind: 'status', status: 'wet', duration: 2, chance: 0.75, to: 'hit' },
    ],
    description:
      'A lash of water at one enemy, with a 75% chance to leave them Wet for 2 rounds, ready for lightning or cold.',
    flavor: 'Wet things conduct lightning. Cold can lock water solid. Remember that.',
    fx: 'fx.water.whip',
    tags: ['attack', 'control'],
  }),
  ability({
    id: 'healing_stream',
    name: 'Healing Stream',
    element: 'water',
    apCost: 2,
    range: 4,
    targeting: allyTarget,
    cooldown: 1,
    requiresLineOfSight: true,
    effects: [
      { kind: 'heal', base: 8, scale: 0.8 },
      { kind: 'cleanse', statuses: ['burning', 'blinded'] },
    ],
    description:
      'Glowing water heals one ally within 4 tiles, or yourself, and washes away Burning and Blinded.',
    flavor: 'The rarest gift in the North, and it is not a weapon.',
    fx: 'fx.water.heal',
    tags: ['heal'],
  }),
  ability({
    id: 'water_pull',
    name: 'Water Pull',
    element: 'water',
    apCost: 2,
    range: 6,
    targeting: enemyTarget,
    effects: [
      { kind: 'damage', base: 4, scale: 0.4, damageType: 'water' },
      { kind: 'pull', distance: 3 },
      { kind: 'status', status: 'wet', duration: 2, chance: 1, to: 'hit' },
    ],
    description:
      'A rope of water hooks one enemy, drags them up to 3 tiles towards you and leaves them Wet for 2 rounds.',
    flavor: 'Come here.',
    fx: 'fx.water.pull',
    tags: ['control'],
  }),
  ability({
    id: 'ice_spikes',
    name: 'Ice Spikes',
    element: 'water',
    apCost: 2,
    range: 6,
    targeting: blast(1),
    cooldown: 2,
    effects: [
      { kind: 'damage', base: 6, scale: 0.7, damageType: 'cold' },
      { kind: 'status', status: 'chilled', duration: 2, chance: 0.7, to: 'hit' },
      { kind: 'surface', surface: 'ice', duration: 2, area: 'area' },
    ],
    description:
      'Spears of ice burst from a 3×3 area, hitting everyone there, friend or foe. Each has a 70% chance to be Chilled, and the ground turns to ice for 2 rounds.',
    flavor: 'Chill something twice and it stops moving altogether.',
    fx: 'fx.water.spikes',
    tags: ['attack', 'control', 'surface'],
  }),
  ability({
    id: 'tidal_wave',
    name: 'Tidal Wave',
    element: 'water',
    apCost: 3,
    range: 5,
    targeting: cone(4),
    cooldown: 4,
    effects: [
      { kind: 'damage', base: 7, scale: 0.7, damageType: 'water' },
      { kind: 'push', distance: 2 },
      { kind: 'status', status: 'wet', duration: 3, chance: 1, to: 'hit' },
      { kind: 'surface', surface: 'water', duration: 3, area: 'area' },
    ],
    description:
      'A wave four tiles deep. Everyone in it, friend or foe, is pushed 2 tiles away from you and left Wet for 3 rounds, and the ground floods for 3.',
    flavor: 'Use lightning while the water is there.',
    fx: 'fx.water.wave',
    tags: ['attack', 'control', 'surface', 'signature'],
  }),
  ability({
    id: 'ice_shield',
    name: 'Ice Shield',
    element: 'water',
    apCost: 2,
    range: 4,
    targeting: allyTarget,
    cooldown: 3,
    effects: [
      { kind: 'status', status: 'guarded', duration: 2, chance: 1, to: 'hit' },
      { kind: 'heal', base: 3, scale: 0.2 },
    ],
    description:
      'A curved plate of ice guards one ally within 4 tiles, or yourself: Guarded for 2 rounds and a small heal.',
    flavor: 'Thicker than it looks.',
    fx: 'fx.water.shield',
    tags: ['buff', 'heal'],
  }),
  ability({
    id: 'octopus_form',
    name: 'Octopus Form',
    element: 'water',
    apCost: 3,
    range: 2,
    targeting: blast(2),
    cooldown: 4,
    effects: [
      { kind: 'damage', base: 8, scale: 0.8, damageType: 'water' },
      { kind: 'status', status: 'wet', duration: 3, chance: 1, to: 'hit' },
      { kind: 'status', status: 'guarded', duration: 2, chance: 1, to: 'self' },
      { kind: 'push', distance: 1 },
    ],
    description:
      'Arms of water lash a 5×5 area centred within 2 tiles of you, friend or foe. Everyone struck is Wet for 3 rounds and pushed a tile outward; you are Guarded for 2.',
    flavor: 'Attack and defence are the same motion.',
    fx: 'fx.water.octopus',
    tags: ['attack', 'buff', 'signature'],
  }),
  // Sura's level-2 field control; Nilak can choose it at level 3.
  ability({
    id: 'ice_path',
    name: 'Ice Path',
    element: 'water',
    apCost: 2,
    range: 5,
    targeting: line(4),
    cooldown: 2,
    effects: [{ kind: 'surface', surface: 'ice', duration: 3, area: 'area' }],
    description:
      'Freezes a line of four tiles out from you for 3 rounds. The ice costs no extra Move but may Chill whoever steps on it; anyone standing in water there may be Frozen.',
    flavor: 'A road, or a trap, depending who walks it.',
    fx: 'fx.water.path',
    tags: ['surface', 'control'],
  }),

  /* ------------------------------------------------------------------ */
  /* Healing discipline                                                  */
  /* ------------------------------------------------------------------ */

  ability({
    id: 'healing_hands',
    name: 'Healing Hands',
    element: 'water',
    apCost: 2,
    range: 1,
    targeting: allyTarget,
    cooldown: 1,
    effects: [
      { kind: 'heal', base: 14, scale: 1 },
      { kind: 'cleanse', statuses: ['burning', 'chilled', 'blinded'] },
    ],
    description:
      'Hands-on healing for an adjacent ally, or yourself. A much larger heal than Healing Stream, and it clears Burning, Chilled and Blinded.',
    flavor: 'Close enough to hear them breathing. That is the point.',
    fx: 'fx.water.hands',
    tags: ['heal'],
  }),
  ability({
    id: 'purifying_mist',
    name: 'Purifying Mist',
    element: 'water',
    apCost: 3,
    range: 5,
    targeting: blast(1),
    cooldown: 3,
    effects: [
      { kind: 'heal', base: 8, scale: 0.6 },
      { kind: 'cleanse', statuses: ['burning', 'blinded', 'shocked', 'chiBlocked'] },
      { kind: 'surface', surface: 'steam', duration: 2, area: 'area' },
    ],
    description:
      'Warm mist fills a 3×3 area, healing every ally inside except you and clearing Burning, Blinded, Shocked and Chi-Blocked. The steam blocks sight for 2 rounds.',
    flavor: 'Breathe in. You are all right.',
    fx: 'fx.water.mist',
    tags: ['heal', 'surface'],
  }),
  ability({
    id: 'life_tide',
    name: 'Life Tide',
    element: 'water',
    apCost: 3,
    range: 6,
    targeting: blast(2),
    cooldown: 5,
    effects: [
      { kind: 'heal', base: 18, scale: 1.2 },
      {
        kind: 'cleanse',
        statuses: [
          'burning',
          'wet',
          'chilled',
          'frozen',
          'shocked',
          'stunned',
          'slowed',
          'blinded',
          'rooted',
          'chiBlocked',
        ],
      },
      { kind: 'status', status: 'inspired', duration: 2, chance: 1, to: 'allies' },
    ],
    description:
      'Every ally in a 5×5 area except you gets a large heal, loses every harmful status and is Inspired for 2 rounds.',
    flavor: 'Not a technique. A decision.',
    fx: 'fx.water.tide',
    tags: ['heal', 'buff', 'signature'],
  }),
];
