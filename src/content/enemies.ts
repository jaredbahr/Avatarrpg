/**
 * Act 1 enemies.
 *
 * Stat blocks are deliberately legible: a bandit is a bandit, a slinger stands
 * at the back, and the deserter exists to teach one lesson (oil plus flame).
 * XP values are chosen so the slice takes a party from level 1 to about 4.
 */

import type { EnemyDef } from '../core/types';

export const ENEMIES: readonly EnemyDef[] = [
  {
    id: 'bandit_thug',
    name: 'Bandit',
    element: 'nonbender',
    size: 1,
    stats: { maxHp: 20, maxAp: 4, maxMove: 4, power: 5, defense: 1, speed: 5, focus: 5 },
    abilities: ['club_swing', 'bandit_rush'],
    ai: 'aggressive',
    xp: 30,
    sprite: 'unit.enemy.thug',
    description: 'Quarry labour that stopped getting paid and started taking instead.',
  },
  {
    id: 'bandit_slinger',
    name: 'Slinger',
    element: 'nonbender',
    size: 1,
    stats: { maxHp: 16, maxAp: 4, maxMove: 4, power: 4, defense: 0, speed: 7, focus: 10 },
    abilities: ['sling_stone'],
    ai: 'cautious',
    xp: 30,
    sprite: 'unit.enemy.slinger',
    description: 'Hangs back on the high ground and never comes down willingly.',
  },
  {
    id: 'bandit_bruiser',
    name: 'Bruiser',
    element: 'nonbender',
    size: 1,
    stats: { maxHp: 30, maxAp: 4, maxMove: 3, power: 6, defense: 3, speed: 4, focus: 5 },
    abilities: ['club_swing', 'bandit_rush'],
    ai: 'aggressive',
    xp: 45,
    sprite: 'unit.enemy.bruiser',
    description: 'Twice the size of the others and half as fast.',
  },
  {
    id: 'bandit_earthbender',
    name: 'Quarry Bender',
    element: 'earth',
    size: 1,
    stats: { maxHp: 26, maxAp: 4, maxMove: 3, power: 6, defense: 3, speed: 4, focus: 5 },
    abilities: ['rock_throw', 'raise_rubble'],
    ai: 'cautious',
    xp: 50,
    sprite: 'unit.enemy.quarrybender',
    description: 'Knows this quarry better than anyone, and keeps raising cover to prove it.',
  },
  {
    id: 'fire_deserter',
    name: 'Fire Nation Deserter',
    element: 'fire',
    size: 1,
    stats: { maxHp: 24, maxAp: 4, maxMove: 4, power: 6, defense: 2, speed: 6, focus: 10 },
    abilities: ['fire_blast', 'oil_flask', 'torch_toss'],
    ai: 'cautious',
    xp: 55,
    sprite: 'unit.enemy.deserter',
    description:
      'Spills oil, then lights it. Kill the oil with water or the fight gets away from you.',
  },
  {
    id: 'merc_blade',
    name: 'Mercenary',
    element: 'nonbender',
    size: 1,
    stats: { maxHp: 26, maxAp: 4, maxMove: 4, power: 6, defense: 2, speed: 6, focus: 10 },
    abilities: ['merc_blade'],
    ai: 'aggressive',
    xp: 50,
    sprite: 'unit.enemy.merc',
    description: "One of Jin's. Professional, unbothered, and in the way.",
  },
  {
    id: 'merc_crossbow',
    name: 'Mercenary Crossbow',
    element: 'nonbender',
    size: 1,
    stats: { maxHp: 20, maxAp: 4, maxMove: 4, power: 5, defense: 1, speed: 7, focus: 15 },
    abilities: ['merc_crossbow'],
    ai: 'cautious',
    xp: 50,
    sprite: 'unit.enemy.crossbow',
    description: 'Outranges everyone in the party except the airbender.',
  },
  {
    id: 'merc_sergeant',
    name: 'Mercenary Sergeant',
    element: 'nonbender',
    size: 1,
    stats: { maxHp: 32, maxAp: 5, maxMove: 4, power: 6, defense: 3, speed: 6, focus: 10 },
    abilities: ['merc_blade', 'rally'],
    ai: 'support',
    xp: 70,
    sprite: 'unit.enemy.sergeant',
    description: 'Makes the others hit harder. Deal with the sergeant first.',
  },
  {
    id: 'grumbler',
    name: 'Grumbler',
    element: 'earth',
    size: 2,
    stats: { maxHp: 90, maxAp: 5, maxMove: 3, power: 8, defense: 5, speed: 4, focus: 5 },
    abilities: ['driller_slam', 'driller_debris', 'driller_spray', 'driller_churn', 'raise_rubble'],
    ai: 'boss',
    xp: 120,
    sprite: 'unit.enemy.grumbler',
    description:
      'A bandit earthbender in a stolen mecha-driller. Two tiles wide, leaks oil, and churns the floor into mud.',
  },

  /* --------------------------------------------------------------------- */
  /* Story ally. Uses the enemy stat-block shape because an ally is just a   */
  /* unit with a different faction.                                          */
  /* --------------------------------------------------------------------- */
  {
    id: 'ruon_ally',
    name: 'Captain Ruon',
    element: 'nonbender',
    size: 1,
    stats: { maxHp: 30, maxAp: 4, maxMove: 4, power: 7, defense: 3, speed: 6, focus: 10 },
    abilities: ['ruon_sabre', 'ruon_order'],
    ai: 'aggressive',
    xp: 0,
    sprite: 'unit.ally.ruon',
    description: 'Fights beside you if you spared him. Not happy about it.',
  },
];

export const ENEMY_BY_ID: ReadonlyMap<string, EnemyDef> = new Map(ENEMIES.map((e) => [e.id, e]));
