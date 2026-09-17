/**
 * Enemy-only abilities.
 *
 * Kept deliberately simpler than the party kits: an enemy should be readable in
 * one glance so a nine-year-old can plan around it. The interesting decisions
 * come from the terrain the enemies create, not from their stat blocks.
 */

import type { Ability } from '../../core/types';
import { ability, blast, cone, enemyTarget, line, tileTarget } from './helpers';

export const ENEMY_ABILITIES: readonly Ability[] = [
  ability({
    id: 'club_swing',
    name: 'Club Swing',
    element: 'nonbender',
    /*
     * Two AP, like every other enemy attack in the game.
     *
     * At one AP this was the only uncapped attack the party ever meets, and it
     * belonged to the first two enemies in the first fight. Movement is a
     * separate pool, so a four-AP bandit walked its full distance *and* swung
     * four times: 28 expected damage onto a 22 HP airbender, and 28 onto a 26
     * HP waterbender from the bruiser. A level-1 character could go from full
     * health to the floor between two of their own turns, in the tutorial,
     * with nothing on the board to read as a warning.
     *
     * The simulator never flagged it because the win rate was 100% — the party
     * still wins, it just wins a player short. Deaths are the signal here, not
     * wins: the forest road averaged 0.8 of a three-player party on the floor.
     *
     * Two AP is not a nerf invented for this; it is the number every other
     * enemy attack already pays (merc_blade, merc_crossbow, ruon_sabre,
     * driller_slam). The bandits were simply never brought into line. It also
     * makes the turn readable, which is the point of the file header: close
     * and hit twice, or rush and hit once. Round counts are unchanged, because
     * a fight's length is how fast the *party* kills, not how fast it dies.
     */
    apCost: 2,
    range: 1,
    targeting: enemyTarget,
    effects: [{ kind: 'damage', base: 5, scale: 0.6, damageType: 'physical' }],
    description: 'A heavy, obvious swing.',
    flavor: 'Bandit basics.',
    fx: 'fx.enemy.club',
  }),
  ability({
    id: 'sling_stone',
    name: 'Sling Stone',
    element: 'nonbender',
    /*
     * Two AP for the same reason as the club, and it mattered most in the
     * all-slinger variant of the tutorial: three of them at four stones each
     * is twelve ranged attacks a round at a party that has not closed yet.
     * That variant measured 2.5 of a six-player party dead against 1.3 for the
     * thugs — identical XP, a very different Tuesday evening.
     */
    apCost: 2,
    range: 6,
    targeting: enemyTarget,
    effects: [{ kind: 'damage', base: 4, scale: 0.5, damageType: 'physical' }],
    description: 'A stone whipped from a leather sling.',
    flavor: 'Cheap and surprisingly accurate.',
    fx: 'fx.enemy.sling',
  }),
  ability({
    id: 'bandit_rush',
    name: 'Rush',
    element: 'nonbender',
    apCost: 2,
    range: 4,
    targeting: tileTarget,
    cooldown: 2,
    effects: [{ kind: 'dash' }],
    description: 'Closes the distance fast.',
    flavor: 'Straight at you.',
    fx: 'fx.enemy.rush',
    tags: ['mobility'],
  }),
  ability({
    id: 'oil_flask',
    name: 'Oil Flask',
    element: 'nonbender',
    apCost: 2,
    range: 5,
    targeting: blast(1),
    cooldown: 2,
    effects: [{ kind: 'surface', surface: 'oil', duration: -1, area: 'area' }],
    description: 'Spills lamp oil across the ground. Harmless — until it is not.',
    flavor: 'The deserter always throws this first.',
    fx: 'fx.enemy.oil',
    tags: ['surface'],
  }),
  ability({
    id: 'torch_toss',
    name: 'Torch Toss',
    element: 'fire',
    apCost: 1,
    range: 5,
    targeting: tileTarget,
    cooldown: 1,
    effects: [{ kind: 'surface', surface: 'fire', duration: 2, area: 'center' }],
    description: 'Lobs a lit torch. Whatever it lands in, it lights.',
    flavor: 'Aimed at the oil, obviously.',
    fx: 'fx.enemy.torch',
    tags: ['surface'],
  }),
  ability({
    id: 'merc_blade',
    name: 'Mercenary Blade',
    element: 'nonbender',
    apCost: 2,
    range: 1,
    targeting: enemyTarget,
    effects: [
      { kind: 'damage', base: 7, scale: 0.7, damageType: 'physical' },
      { kind: 'status', status: 'slowed', duration: 1, chance: 0.3, to: 'hit' },
    ],
    description: 'A professional cut, low and fast.',
    flavor: 'Paid by the day.',
    fx: 'fx.enemy.blade',
  }),
  ability({
    id: 'merc_crossbow',
    name: 'Crossbow',
    element: 'nonbender',
    apCost: 2,
    range: 8,
    targeting: enemyTarget,
    cooldown: 1,
    effects: [{ kind: 'damage', base: 6, scale: 0.6, damageType: 'physical' }],
    description: 'Long range and it does not care about cover much.',
    flavor: 'Reload, aim, repeat.',
    fx: 'fx.enemy.crossbow',
  }),
  ability({
    id: 'driller_slam',
    name: 'Driller Slam',
    element: 'earth',
    apCost: 2,
    range: 2,
    /*
     * Once a turn, and that cooldown is the whole reason the quarry floor is a
     * fight rather than a wall.
     *
     * Grumbler has 5 AP and this costs 2, so uncapped it slammed *twice* a turn
     * and still had AP to move. A cone that lands 14 or so at level 3 against a
     * party with 40-odd HP means two rounds in front of the drill arm is a dead
     * character, and the simulator agreed: 2.2 of a 3-player party died in an
     * average run, and the wins came in at 13% health. The boss was killing the
     * table before any of the terrain it exists to teach ever came up.
     *
     * With one slam a turn the remaining AP goes into oil, mud and debris —
     * which is the fight the encounter is actually written around.
     */
    cooldown: 1,
    targeting: cone(2),
    effects: [
      { kind: 'damage', base: 8, scale: 0.7, damageType: 'earth' },
      { kind: 'push', distance: 1 },
    ],
    description: 'The drill arm comes down like a falling wall.',
    flavor: 'Get out from in front of it. It cannot swing twice in a turn.',
    fx: 'fx.enemy.slam',
  }),
  ability({
    id: 'driller_spray',
    name: 'Oil Spray',
    element: 'nonbender',
    apCost: 2,
    range: 5,
    targeting: line(4),
    cooldown: 2,
    effects: [{ kind: 'surface', surface: 'oil', duration: -1, area: 'area' }],
    description: 'A ruptured line sprays oil in a long stripe.',
    flavor: 'Somebody is going to light that.',
    fx: 'fx.enemy.spray',
    tags: ['surface'],
  }),
  ability({
    id: 'driller_debris',
    name: 'Debris Throw',
    element: 'earth',
    apCost: 2,
    range: 7,
    targeting: blast(1),
    cooldown: 2,
    effects: [
      { kind: 'damage', base: 6, scale: 0.6, damageType: 'earth' },
      { kind: 'surface', surface: 'rubble', duration: -1, area: 'center' },
    ],
    description: 'Hurls a chunk of the quarry wall.',
    flavor: 'It leaves cover behind. Use it.',
    fx: 'fx.enemy.debris',
  }),
  ability({
    id: 'driller_churn',
    name: 'Churn the Ground',
    element: 'earth',
    apCost: 3,
    range: 4,
    targeting: blast(2),
    cooldown: 3,
    effects: [
      { kind: 'surface', surface: 'mud', duration: 4, area: 'area' },
      { kind: 'status', status: 'rooted', duration: 2, chance: 0.5, to: 'hit' },
    ],
    description: 'The treads tear the quarry floor into deep mud.',
    flavor: 'Freeze it and the whole machine stops.',
    fx: 'fx.enemy.churn',
    tags: ['control', 'surface'],
  }),
  /* Ruon fights beside the party in the ambush if he was spared. */
  ability({
    id: 'ruon_sabre',
    name: 'Captain’s Sabre',
    element: 'nonbender',
    apCost: 2,
    range: 1,
    targeting: enemyTarget,
    effects: [{ kind: 'damage', base: 7, scale: 0.8, damageType: 'physical' }],
    description: 'An old soldier who still knows the forms.',
    flavor: '"I said I would help. I did not say I would enjoy it."',
    fx: 'fx.enemy.sabre',
  }),
  ability({
    id: 'ruon_order',
    name: 'Bark an Order',
    element: 'nonbender',
    apCost: 1,
    range: 6,
    targeting: { shape: 'unit', allow: 'ally' },
    cooldown: 2,
    effects: [{ kind: 'status', status: 'inspired', duration: 2, chance: 1, to: 'hit' }],
    description: 'Twenty years of command, aimed at somebody useful.',
    flavor: '"Left flank! Now!"',
    fx: 'fx.enemy.order',
    tags: ['buff'],
  }),
];
