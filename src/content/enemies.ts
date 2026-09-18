/**
 * Act 1 enemies.
 *
 * Stat blocks are deliberately legible: a bandit is a bandit, a slinger stands
 * at the back, and the deserter exists to teach one lesson (oil plus flame).
 * XP is sized against the level curve in `rules/leveling.ts` rather than picked
 * by feel. Each encounter is tuned for a specific party level, so the awards
 * have to actually get the party there: the first pass left a level-2 party
 * walking into a boss scaled for level 4.
 *
 * HP is generous relative to party damage on purpose. The simulator showed
 * fights ending in two or three rounds with thinner enemies, which is not long
 * enough for terrain to matter — a puddle nobody survives to stand in teaches
 * nothing. These numbers put a fight at roughly five rounds.
 *
 * Enemies also scale with the encounter's level (see `scaleStats`), so these
 * are level-1 figures, not what the party meets at the quarry floor.
 */

import type { EnemyDef } from '../core/types';

export const ENEMIES: readonly EnemyDef[] = [
  {
    id: 'bandit_thug',
    name: 'Bandit',
    element: 'nonbender',
    size: 1,
    stats: { maxHp: 28, maxAp: 4, maxMove: 4, power: 5, defense: 1, speed: 5, focus: 5 },
    abilities: ['club_swing', 'bandit_rush'],
    ai: 'aggressive',
    xp: 100,
    sprite: 'unit.enemy.thug',
    description: 'Quarry labour that stopped getting paid and started taking instead.',
  },
  {
    id: 'bandit_slinger',
    name: 'Slinger',
    element: 'nonbender',
    size: 1,
    stats: { maxHp: 22, maxAp: 4, maxMove: 4, power: 4, defense: 0, speed: 7, focus: 10 },
    abilities: ['sling_stone'],
    ai: 'cautious',
    xp: 100,
    sprite: 'unit.enemy.slinger',
    description: 'Hangs back on the high ground and never comes down willingly.',
  },
  {
    id: 'bandit_bruiser',
    name: 'Bruiser',
    element: 'nonbender',
    size: 1,
    stats: { maxHp: 42, maxAp: 4, maxMove: 3, power: 6, defense: 3, speed: 4, focus: 5 },
    abilities: ['club_swing', 'bandit_rush'],
    ai: 'aggressive',
    xp: 150,
    sprite: 'unit.enemy.bruiser',
    description: 'Twice the size of the others and half as fast.',
  },
  {
    id: 'bandit_earthbender',
    name: 'Quarry Bender',
    element: 'earth',
    size: 1,
    stats: { maxHp: 36, maxAp: 4, maxMove: 3, power: 6, defense: 3, speed: 4, focus: 5 },
    abilities: ['rock_throw', 'raise_rubble'],
    ai: 'cautious',
    xp: 150,
    sprite: 'unit.enemy.quarrybender',
    description: 'Knows this quarry better than anyone, and keeps raising cover to prove it.',
  },
  {
    id: 'fire_deserter',
    name: 'Fire Nation Deserter',
    element: 'fire',
    size: 1,
    stats: { maxHp: 34, maxAp: 4, maxMove: 4, power: 6, defense: 2, speed: 6, focus: 10 },
    abilities: ['fire_blast', 'oil_flask', 'torch_toss'],
    ai: 'cautious',
    xp: 200,
    sprite: 'unit.enemy.deserter',
    description:
      'Spills oil, then lights it. Kill the oil with water or the fight gets away from you.',
  },
  {
    id: 'merc_blade',
    name: 'Mercenary',
    element: 'nonbender',
    size: 1,
    stats: { maxHp: 36, maxAp: 4, maxMove: 4, power: 6, defense: 2, speed: 6, focus: 10 },
    abilities: ['merc_blade'],
    ai: 'aggressive',
    xp: 150,
    sprite: 'unit.enemy.merc',
    description: "One of Jin's. Professional, unbothered, and in the way.",
  },
  {
    id: 'merc_crossbow',
    name: 'Mercenary Crossbow',
    element: 'nonbender',
    size: 1,
    stats: { maxHp: 28, maxAp: 4, maxMove: 4, power: 5, defense: 1, speed: 7, focus: 15 },
    abilities: ['merc_crossbow'],
    ai: 'cautious',
    xp: 150,
    sprite: 'unit.enemy.crossbow',
    description: 'Outranges everyone in the party except the airbender.',
  },
  {
    id: 'merc_sergeant',
    name: 'Mercenary Sergeant',
    element: 'nonbender',
    size: 1,
    stats: { maxHp: 44, maxAp: 5, maxMove: 4, power: 6, defense: 3, speed: 6, focus: 10 },
    abilities: ['merc_blade', 'rally'],
    ai: 'support',
    xp: 210,
    sprite: 'unit.enemy.sergeant',
    description: 'Makes the others hit harder. Deal with the sergeant first.',
  },
  {
    id: 'grumbler',
    name: 'Grumbler',
    element: 'earth',
    size: 2,
    /*
     * 100 HP rather than 86, and the extra bar is paid for by the cooldown on
     * `driller_slam`. Capping the slam at one a turn took roughly a third of
     * the boss's damage out of the fight, which put the win rate somewhere
     * around 86-98% — a boss nobody can lose to is not a boss. Deepening the
     * health bar spends that slack on *length* instead of on burst, which is
     * the trade the fight wants: long enough for the oil and the mud to
     * matter, without a cone that deletes a character in two rounds.
     */
    stats: { maxHp: 100, maxAp: 5, maxMove: 3, power: 7, defense: 5, speed: 4, focus: 5 },
    abilities: ['driller_slam', 'driller_debris', 'driller_spray', 'driller_churn', 'raise_rubble'],
    ai: 'boss',
    xp: 360,
    sprite: 'unit.enemy.grumbler',
    description:
      'A former quartermaster in a mecha-driller. Two tiles wide, leaks oil, and churns the floor into mud.',
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
    stats: { maxHp: 40, maxAp: 4, maxMove: 4, power: 7, defense: 3, speed: 6, focus: 10 },
    abilities: ['ruon_sabre', 'ruon_order'],
    ai: 'aggressive',
    xp: 0,
    sprite: 'unit.ally.ruon',
    description: 'Fights beside you if you spared him. Not happy about it.',
  },
];

export const ENEMY_BY_ID: ReadonlyMap<string, EnemyDef> = new Map(ENEMIES.map((e) => [e.id, e]));
