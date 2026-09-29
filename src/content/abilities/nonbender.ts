/**
 * Non-benders: 5 AP instead of 4, the highest Focus (so the most crits), and
 * the only tools that shut a bender off entirely. Chi-blocking a boss for two
 * rounds is worth more than any single damage ability in the game, and that is
 * deliberate — nobody should feel like the "normal person" slot is the weak one.
 */

import type { Ability } from '../../core/types';
import { ability, allyTarget, blast, enemyTarget, selfTarget } from './helpers';

export const NONBENDER_ABILITIES: readonly Ability[] = [
  ability({
    id: 'strike',
    name: 'Strike',
    element: 'nonbender',
    apCost: 1,
    range: 1,
    targeting: enemyTarget,
    effects: [{ kind: 'damage', base: 5, scale: 0.8, damageType: 'physical' }],
    description:
      'A fast, precise hit on an adjacent enemy. Non-benders train the highest Focus, so it lands critical hits more often than most attacks.',
    flavor: 'No flourish. No warning.',
    fx: 'fx.non.strike',
  }),
  ability({
    id: 'gauntlet_spark',
    name: 'Gauntlet Spark',
    element: 'nonbender',
    apCost: 1,
    range: 1,
    targeting: enemyTarget,
    cooldown: 1,
    effects: [
      { kind: 'damage', base: 4, scale: 0.5, damageType: 'lightning' },
      { kind: 'status', status: 'shocked', duration: 1, chance: 0.35, to: 'hit' },
    ],
    description:
      'A quick pulse from Wen’s gauntlet into an adjacent enemy: lightning damage, doubled if they are Wet, with a 35% chance to Shock them for 1 round.',
    flavor: 'She built a field test into the glove. Every fight is now a field test.',
    fx: 'fx.non.glove',
    tags: ['attack', 'control'],
  }),
  ability({
    id: 'chi_block',
    name: 'Chi Block',
    element: 'nonbender',
    apCost: 2,
    range: 1,
    targeting: enemyTarget,
    cooldown: 2,
    effects: [
      { kind: 'damage', base: 3, scale: 0.4, damageType: 'physical', ignoreDefense: true },
      { kind: 'status', status: 'chiBlocked', duration: 2, chance: 0.8, to: 'hit' },
    ],
    description:
      'Jab an adjacent enemy’s pressure points. Ignores Defence, with an 80% chance to Chi-Block them for 2 rounds: no abilities at all, though they can still walk.',
    flavor: 'The great equaliser.',
    fx: 'fx.non.chi',
    tags: ['control', 'signature'],
  }),
  ability({
    id: 'bolas',
    name: 'Bolas',
    element: 'nonbender',
    apCost: 2,
    range: 6,
    targeting: enemyTarget,
    cooldown: 2,
    effects: [
      { kind: 'damage', base: 3, scale: 0.3, damageType: 'physical' },
      { kind: 'status', status: 'rooted', duration: 2, chance: 0.85, to: 'hit' },
    ],
    description:
      'Weighted cords thrown at one enemy up to 6 tiles away, with an 85% chance to Root them for 2 rounds.',
    flavor: 'Cheap, reusable, humiliating.',
    fx: 'fx.non.bolas',
    tags: ['control'],
  }),
  ability({
    id: 'smoke_bomb',
    name: 'Smoke Bomb',
    element: 'nonbender',
    apCost: 2,
    range: 5,
    targeting: blast(1),
    cooldown: 3,
    effects: [
      { kind: 'status', status: 'blinded', duration: 2, chance: 0.9, to: 'hit' },
      { kind: 'surface', surface: 'steam', duration: 2, area: 'area' },
    ],
    description:
      'Smoke fills a 3×3 area. Everyone inside, friend or foe, has a 90% chance to be Blinded, and the cloud is hard to see through for 2 rounds.',
    flavor: 'Half of any escape is the second half.',
    fx: 'fx.non.smoke',
    tags: ['control', 'surface'],
  }),
  ability({
    id: 'electrified_glove',
    name: 'Electrified Glove',
    element: 'nonbender',
    apCost: 2,
    range: 1,
    targeting: enemyTarget,
    cooldown: 2,
    effects: [
      { kind: 'damage', base: 7, scale: 0.8, damageType: 'lightning' },
      { kind: 'status', status: 'shocked', duration: 2, chance: 0.7, to: 'hit' },
    ],
    description:
      'A charged glove driven into an adjacent enemy: lightning damage, doubled if they are Wet, with a 70% chance to Shock them for 2 rounds.',
    flavor: 'Republic City engineering. Charge, contact, done.',
    fx: 'fx.non.glove',
  }),
  ability({
    id: 'shield_bash',
    name: 'Shield Bash',
    element: 'nonbender',
    apCost: 2,
    range: 1,
    targeting: enemyTarget,
    cooldown: 2,
    effects: [
      { kind: 'damage', base: 6, scale: 0.6, damageType: 'physical' },
      { kind: 'push', distance: 1 },
      { kind: 'status', status: 'stunned', duration: 1, chance: 0.35, to: 'hit' },
      { kind: 'status', status: 'guarded', duration: 1, chance: 1, to: 'self' },
    ],
    description:
      'Drive a shield into an adjacent enemy, pushing them back a tile with a 35% chance to Stun. You become Guarded for 1 round.',
    flavor: 'Somebody has to stand in front.',
    fx: 'fx.non.bash',
    tags: ['attack', 'control', 'buff'],
  }),
  ability({
    id: 'pressure_points',
    name: 'Pressure Points',
    element: 'nonbender',
    apCost: 3,
    range: 1,
    targeting: enemyTarget,
    cooldown: 4,
    effects: [
      { kind: 'damage', base: 8, scale: 0.9, damageType: 'physical', ignoreDefense: true },
      { kind: 'status', status: 'chiBlocked', duration: 3, chance: 1, to: 'hit' },
      { kind: 'status', status: 'slowed', duration: 3, chance: 1, to: 'hit' },
      { kind: 'grantAp', amount: 1, to: 'self' },
    ],
    description:
      'A full sequence of strikes on an adjacent enemy. Ignores Defence, Chi-Blocks and Slows them for 3 rounds, and gives you 1 AP back.',
    flavor: 'Eight strikes. They only feel the first.',
    fx: 'fx.non.points',
    tags: ['attack', 'control', 'signature'],
  }),
  ability({
    id: 'rally',
    name: 'Rally',
    element: 'nonbender',
    apCost: 2,
    range: 5,
    targeting: allyTarget,
    cooldown: 3,
    effects: [
      { kind: 'status', status: 'inspired', duration: 2, chance: 1, to: 'hit' },
      { kind: 'grantAp', amount: 1, to: 'hit' },
    ],
    description:
      'Call an ally within 5 tiles, or yourself, back into the fight: Inspired for 2 rounds and 1 extra AP.',
    flavor: 'Up. Now.',
    fx: 'fx.non.rally',
    tags: ['buff'],
  }),
  ability({
    id: 'take_cover',
    name: 'Take Cover',
    element: 'nonbender',
    apCost: 1,
    range: 0,
    targeting: selfTarget,
    cooldown: 2,
    effects: [{ kind: 'status', status: 'guarded', duration: 2, chance: 1, to: 'self' }],
    description: 'Duck behind whatever is closest: Guarded for 2 rounds.',
    flavor: 'Not every turn has to be heroic.',
    fx: 'fx.non.cover',
    tags: ['buff'],
  }),

  /* ------------------------------------------------------------------ */
  /* Engineering discipline                                              */
  /* ------------------------------------------------------------------ */

  ability({
    id: 'shock_mine',
    name: 'Shock Mine',
    element: 'nonbender',
    apCost: 2,
    range: 6,
    targeting: blast(1),
    cooldown: 3,
    effects: [
      { kind: 'damage', base: 7, scale: 0.5, damageType: 'lightning' },
      { kind: 'status', status: 'shocked', duration: 2, chance: 0.8, to: 'hit' },
      { kind: 'surface', surface: 'oil', duration: 3, area: 'center' },
    ],
    description:
      'A mine thrown onto a 3×3 area. Everyone there, friend or foe, takes lightning damage with an 80% chance of being Shocked, and its casing leaks oil onto the centre tile for 3 rounds.',
    flavor: 'She keeps meaning to fix the leak. She has stopped meaning to.',
    fx: 'fx.non.mine',
    tags: ['attack', 'control', 'surface'],
  }),
  ability({
    id: 'disruptor_array',
    name: 'Disruptor Array',
    element: 'nonbender',
    apCost: 3,
    range: 5,
    targeting: blast(2),
    cooldown: 5,
    effects: [
      { kind: 'damage', base: 9, scale: 0.7, damageType: 'lightning' },
      { kind: 'status', status: 'chiBlocked', duration: 2, chance: 0.7, to: 'hit' },
      { kind: 'status', status: 'shocked', duration: 2, chance: 0.6, to: 'hit' },
    ],
    description:
      'Emitters thrown across a 5×5 area fire at once. Everyone caught, friend or foe, takes lightning damage and may be Chi-Blocked (70%) and/or Shocked (60%) for 2 rounds.',
    flavor: 'No bending required. That was always the argument.',
    fx: 'fx.non.array',
    tags: ['attack', 'control', 'signature'],
  }),
];
