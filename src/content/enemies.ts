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
    description:
      'Quarry labour that stopped getting paid and started taking. Walks straight in with a club; Rush closes four tiles, though not every turn.',
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
    description:
      'Throws stones from up to six tiles and backs away from a fight. Frail once caught, and cover makes its stones miss more often.',
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
    description: 'Big, slow and hard to put down. Rush still lets it lunge four tiles at you.',
  },
  {
    id: 'bandit_earthbender',
    name: 'Quarry Bender',
    shortName: 'Bender',
    element: 'earth',
    size: 1,
    stats: { maxHp: 36, maxAp: 4, maxMove: 3, power: 6, defense: 3, speed: 4, focus: 5 },
    abilities: ['rock_throw', 'raise_rubble'],
    ai: 'cautious',
    xp: 150,
    sprite: 'unit.enemy.quarrybender',
    description:
      'Knows this quarry better than anyone. Throws rock and raises rubble for cover, but melee attacks ignore that cover.',
  },
  {
    id: 'fire_deserter',
    name: 'Fire Nation Deserter',
    shortName: 'Deserter',
    element: 'fire',
    size: 1,
    stats: { maxHp: 34, maxAp: 4, maxMove: 4, power: 6, defense: 2, speed: 6, focus: 10 },
    abilities: ['fire_blast', 'oil_flask', 'torch_toss'],
    ai: 'cautious',
    xp: 200,
    sprite: 'unit.enemy.deserter',
    description:
      'Spills oil, then lights it with a thrown torch. Keep clear of the spill; water douses flames but leaves unburned oil in place.',
  },
  {
    id: 'merc_blade',
    name: 'Mercenary',
    element: 'nonbender',
    size: 1,
    /*
     * Jin's crew take 40% more punishment than they first did (36, 28 and 44 HP
     * for the blade, the crossbow and the sergeant). The Cutting was the third
     * fight and the gentlest: the party kept 80-96% of its HP. With the extra HP
     * it still wins every simulated trial, in about four rounds, keeping
     * 80 / 58 / 70% at one, three and six players
     * (docs/proposals/early-fight-difficulty.md; Jared, 2026-10-03).
     */
    stats: { maxHp: 50, maxAp: 4, maxMove: 4, power: 6, defense: 2, speed: 6, focus: 10 },
    abilities: ['merc_blade'],
    ai: 'aggressive',
    xp: 150,
    sprite: 'unit.enemy.merc',
    description: "One of Jin's crew. A low, fast blade that can leave you Slowed for a turn.",
  },
  {
    id: 'merc_crossbow',
    name: 'Mercenary Crossbow',
    shortName: 'Crossbow',
    element: 'nonbender',
    size: 1,
    stats: { maxHp: 39, maxAp: 4, maxMove: 4, power: 5, defense: 1, speed: 7, focus: 15 },
    abilities: ['merc_crossbow'],
    ai: 'cautious',
    xp: 150,
    sprite: 'unit.enemy.crossbow',
    description:
      "One of Jin's crew. Shoots up to eight tiles, farther than almost any attack you have. Cover makes it miss more often.",
  },
  {
    id: 'merc_sergeant',
    name: 'Mercenary Sergeant',
    shortName: 'Sergeant',
    element: 'nonbender',
    size: 1,
    stats: { maxHp: 62, maxAp: 5, maxMove: 4, power: 6, defense: 3, speed: 6, focus: 10 },
    abilities: ['merc_blade', 'rally'],
    ai: 'support',
    xp: 210,
    sprite: 'unit.enemy.sergeant',
    description:
      'Rally gives another mercenary an extra AP and makes them hit harder. Deal with the sergeant first.',
  },
  {
    id: 'grumbler',
    name: 'Grumbler',
    element: 'earth',
    size: 2,
    /* Option A restores square-footprint pressure through mobility and
     * endurance without increasing any individual hit (ADR 0070). */
    stats: { maxHp: 130, maxAp: 5, maxMove: 4, power: 7, defense: 5, speed: 4, focus: 5 },
    abilities: ['driller_slam', 'driller_debris', 'driller_spray', 'driller_churn', 'raise_rubble'],
    ai: 'boss',
    xp: 360,
    sprite: 'unit.enemy.driller',
    description:
      'A quartermaster at the controls of a four-tile mecha-driller. Slams a cone once a turn, sprays oil, hurls debris and churns the floor to mud.',
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
    description:
      'Fights beside you on the road to his trial. His sabre hits hard, and his barked orders make a hero hit harder and truer.',
  },
];

export const ENEMY_BY_ID: ReadonlyMap<string, EnemyDef> = new Map(ENEMIES.map((e) => [e.id, e]));
