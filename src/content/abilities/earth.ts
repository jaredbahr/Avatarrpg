/**
 * Earthbending: the wall the rest of the party hides behind. Highest HP and
 * defence, lowest speed, and the only element that can rewrite the map's
 * geometry mid-fight.
 */

import type { Ability } from '../../core/types';
import { ability, blast, enemyTarget, line, selfTarget, tileTarget } from './helpers';

export const EARTH_ABILITIES: readonly Ability[] = [
  ability({
    id: 'rock_throw',
    name: 'Rock Throw',
    element: 'earth',
    apCost: 1,
    range: 5,
    targeting: enemyTarget,
    effects: [{ kind: 'damage', base: 5, scale: 0.6, damageType: 'earth' }],
    description:
      'Tear a stone from the ground and hurl it at one enemy up to 5 tiles away. Where it lands, it smothers fire and churns water into mud.',
    flavor: 'Simple. Heavy. Effective.',
    fx: 'fx.earth.rock',
  }),
  ability({
    id: 'earth_wall',
    name: 'Earth Wall',
    element: 'earth',
    apCost: 2,
    range: 5,
    targeting: line(3),
    cooldown: 3,
    effects: [{ kind: 'wall', duration: 3 }],
    description:
      'Raises a stone wall along three tiles out from you for 3 rounds, blocking movement and sight. It will not rise under anyone standing there.',
    flavor: 'Wait, listen, then make the ground do the work.',
    fx: 'fx.earth.wall',
    tags: ['control', 'surface'],
  }),
  ability({
    id: 'shockwave',
    name: 'Shockwave',
    element: 'earth',
    apCost: 2,
    range: 2,
    targeting: blast(2),
    cooldown: 2,
    effects: [
      { kind: 'damage', base: 5, scale: 0.5, damageType: 'earth' },
      { kind: 'push', distance: 1 },
      { kind: 'status', status: 'slowed', duration: 2, chance: 0.5, to: 'hit' },
    ],
    description:
      'Stamp a tremor through a 5×5 area centred within 2 tiles. Everyone caught, friend or foe, is pushed a tile outward and has an even chance of being Slowed.',
    flavor: 'Does not care whose side you are on. Check your footing.',
    fx: 'fx.earth.shockwave',
    tags: ['attack', 'control'],
  }),
  ability({
    id: 'mudslide',
    name: 'Mudslide',
    element: 'earth',
    apCost: 3,
    range: 6,
    targeting: blast(2),
    cooldown: 3,
    effects: [
      { kind: 'damage', base: 4, scale: 0.4, damageType: 'earth' },
      { kind: 'surface', surface: 'mud', duration: 4, area: 'area' },
      { kind: 'status', status: 'rooted', duration: 2, chance: 0.4, to: 'hit' },
    ],
    description:
      'Churns a 5×5 area into mud for 4 rounds. Everyone caught takes light damage with a 40% chance of being Rooted. Mud costs extra Move and can grab feet.',
    flavor: 'Half of winning a fight is choosing where it happens.',
    fx: 'fx.earth.mudslide',
    tags: ['control', 'surface'],
  }),
  ability({
    id: 'seismic_sense',
    name: 'Seismic Sense',
    element: 'earth',
    apCost: 1,
    range: 0,
    targeting: selfTarget,
    cooldown: 3,
    effects: [
      { kind: 'revealSurfaces' },
      { kind: 'status', status: 'inspired', duration: 2, chance: 1, to: 'self' },
      { kind: 'cleanse', statuses: ['blinded'] },
    ],
    description:
      'Read the whole field through your feet: you are Inspired for 2 rounds and shake off Blinded.',
    flavor: 'Stone carries every footstep. Listen for them.',
    fx: 'fx.earth.sense',
    tags: ['buff'],
  }),
  ability({
    id: 'boulder',
    name: 'Boulder',
    element: 'earth',
    apCost: 3,
    range: 7,
    targeting: blast(1),
    cooldown: 3,
    effects: [
      { kind: 'damage', base: 9, scale: 0.9, damageType: 'earth' },
      { kind: 'surface', surface: 'rubble', duration: -1, area: 'area' },
    ],
    description:
      'Drops a huge boulder on a 3×3 area, hitting everyone there, friend or foe. The rubble stays for the rest of the fight: slow to cross, good cover.',
    flavor: 'Aim for the middle of the group.',
    fx: 'fx.earth.boulder',
    tags: ['attack', 'surface'],
  }),
  ability({
    id: 'metalbending',
    name: 'Metalbending',
    element: 'earth',
    apCost: 3,
    range: 6,
    targeting: enemyTarget,
    cooldown: 4,
    effects: [
      { kind: 'damage', base: 11, scale: 1, damageType: 'earth', ignoreDefense: true },
      { kind: 'status', status: 'rooted', duration: 2, chance: 1, to: 'hit' },
      { kind: 'status', status: 'stunned', duration: 1, chance: 0.35, to: 'hit' },
    ],
    description:
      'Seize the metal on one enemy and crush it inward. Ignores Defence, Roots them for 2 rounds and has a 35% chance to Stun.',
    flavor: 'There is earth inside the metal. Find it.',
    fx: 'fx.earth.metal',
    tags: ['attack', 'control', 'signature'],
  }),
  ability({
    id: 'stone_stance',
    name: 'Stone Stance',
    element: 'earth',
    apCost: 1,
    range: 0,
    targeting: selfTarget,
    cooldown: 2,
    effects: [{ kind: 'status', status: 'guarded', duration: 2, chance: 1, to: 'self' }],
    description: 'Set your feet and harden your stance: Guarded for 2 rounds.',
    flavor: 'Immovable is a kind of attack.',
    fx: 'fx.earth.stance',
    tags: ['buff'],
  }),
  // The bandit earthbender and the driller both scatter cover around.
  ability({
    id: 'raise_rubble',
    name: 'Raise Rubble',
    element: 'earth',
    apCost: 2,
    range: 5,
    targeting: tileTarget,
    cooldown: 2,
    effects: [{ kind: 'surface', surface: 'rubble', duration: -1, area: 'center' }],
    description:
      'Heave broken stone up onto one tile. The rubble stays for the rest of the fight: slow to cross, good cover.',
    flavor: 'Quarry work, weaponised.',
    fx: 'fx.earth.rubble',
    tags: ['surface'],
  }),

  /* ------------------------------------------------------------------ */
  /* Earth Shaping discipline                                            */
  /* ------------------------------------------------------------------ */

  ability({
    id: 'fissure',
    name: 'Fissure',
    element: 'earth',
    apCost: 3,
    range: 6,
    targeting: line(4),
    cooldown: 4,
    effects: [
      { kind: 'damage', base: 12, scale: 1, damageType: 'earth' },
      { kind: 'status', status: 'rooted', duration: 2, chance: 0.9, to: 'hit' },
      { kind: 'surface', surface: 'rubble', duration: -1, area: 'area' },
    ],
    description:
      'Splits the ground along four tiles out from you. Everyone on the line, friend or foe, is hit with a 90% chance of being Rooted for 2 rounds, and rubble stays along the crack.',
    flavor: 'The quarry taught her where stone wants to break.',
    fx: 'fx.earth.fissure',
    tags: ['attack', 'control', 'surface', 'signature'],
  }),

  /* ------------------------------------------------------------------ */
  /* Metalbending discipline                                             */
  /* ------------------------------------------------------------------ */

  ability({
    id: 'metal_cable',
    name: 'Metal Cable',
    element: 'earth',
    apCost: 2,
    range: 7,
    targeting: enemyTarget,
    cooldown: 2,
    effects: [
      { kind: 'damage', base: 6, scale: 0.6, damageType: 'physical' },
      { kind: 'pull', distance: 3 },
    ],
    description:
      'A steel cable, thrown and reeled in. It hits one enemy up to 7 tiles away and drags them up to 3 tiles towards you, often out of their cover.',
    flavor: 'Reach, then decide what to do with them.',
    fx: 'fx.earth.cable',
    tags: ['attack', 'control'],
  }),
  ability({
    id: 'metal_armor',
    name: 'Metal Armor',
    element: 'earth',
    apCost: 2,
    range: 0,
    targeting: selfTarget,
    cooldown: 3,
    effects: [
      { kind: 'status', status: 'guarded', duration: 3, chance: 1, to: 'self' },
      { kind: 'cleanse', statuses: ['rooted', 'slowed'] },
    ],
    description:
      'Pull the metal on you into plates: Guarded for 3 rounds, and it frees you from Rooted and Slowed.',
    flavor: 'It was a belt buckle a moment ago.',
    fx: 'fx.earth.armor',
    tags: ['buff'],
  }),
];
