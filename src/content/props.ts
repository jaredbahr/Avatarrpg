/**
 * Things on the battlefield you can shove, break, or set on fire.
 *
 * Every prop here is a delivery mechanism for a rule that already existed in
 * `combos.ts`. A water barrel paints `water`; Wet, the freezing, and lightning
 * chaining through the puddle all follow from the reaction table without a line
 * of new logic. An oil flask paints `oil`; a firebender does the rest.
 *
 * Design rules that keep this fun rather than fiddly:
 *
 *  - **Low HP.** A prop should break when somebody decides to break it, not after
 *    three turns of chipping. Anything above about 12 stops being a plan and
 *    starts being a chore.
 *  - **The label is the teaching.** Same as a combo rule: the log says what
 *    happened in words a child reads once and remembers. "The barrel bursts!"
 *    beats "prop_barrel destroyed".
 *  - **Reactions over damage.** A barrel that deals 8 damage is a worse toy than
 *    a barrel that soaks three people, because the puddle is still there next
 *    turn and somebody can freeze it.
 *  - **Nothing here one-shots a party member.** The brazier is the only prop that
 *    deals direct damage, and it is small; the danger is always the surface it
 *    leaves behind, which you can see and walk around.
 */

import type { PropDef } from '../core/types';

export const PROPS: readonly PropDef[] = [
  {
    id: 'water_barrel',
    name: 'Water Barrel',
    description:
      'A barrel of quarry water. It blocks the way and can be shoved. Stone and blows break it fastest, flooding the tiles around it and soaking anyone standing there.',
    sprite: 'prop.barrel',
    hp: 6,
    blocksMove: true,
    blocksSight: false,
    grantsCover: true,
    pushable: true,
    vulnerableTo: ['earth', 'physical'],
    immuneTo: [],
    onBreak: [{ kind: 'surface', surface: 'water', duration: 4, radius: 1 }],
    breakLabel: 'The barrel bursts — water everywhere!',
  },
  {
    id: 'oil_flask',
    name: 'Oil Flask',
    description:
      'A clay jar of lamp oil. Flame or a blow breaks it easily, coating the tiles around it in oil that stays until lit. Lit oil spreads fire and sets people Burning.',
    sprite: 'prop.flask',
    hp: 4,
    blocksMove: false,
    blocksSight: false,
    grantsCover: false,
    pushable: true,
    // Fire does not merely break it, it breaks it the way you want it broken.
    vulnerableTo: ['fire', 'physical'],
    immuneTo: [],
    onBreak: [{ kind: 'surface', surface: 'oil', duration: -1, radius: 1 }],
    breakLabel: 'The flask shatters and oil spreads across the ground.',
  },
  {
    id: 'brazier',
    name: 'Brazier',
    description:
      'An iron stand of hot coals. Fire and water cannot break it; stone and blows can. When it topples, coals burn everyone beside it and flames fill its tile.',
    sprite: 'prop.brazier',
    hp: 8,
    blocksMove: true,
    blocksSight: false,
    grantsCover: false,
    pushable: true,
    vulnerableTo: ['earth', 'physical'],
    // Iron. Fire is what is *in* it, and dousing it is handled by the surface
    // table rather than by breaking the thing.
    immuneTo: ['fire', 'water'],
    onBreak: [
      { kind: 'surface', surface: 'fire', duration: 2, radius: 0 },
      { kind: 'damage', base: 4, damageType: 'fire', radius: 1 },
    ],
    breakLabel: 'The brazier topples and scatters burning coals.',
  },
  {
    id: 'hay_bale',
    name: 'Hay Bale',
    description:
      'Fodder for the quarry animals. It blocks the way and sight, but fire and wind tear through it, and a broken bale bursts into flame across the tiles around it.',
    sprite: 'prop.hay',
    hp: 5,
    blocksMove: true,
    blocksSight: true,
    grantsCover: true,
    pushable: true,
    vulnerableTo: ['fire', 'air'],
    immuneTo: [],
    onBreak: [{ kind: 'surface', surface: 'fire', duration: 2, radius: 1 }],
    breakLabel: 'The hay goes up in a rush of flame.',
  },
  {
    id: 'rubble_pile',
    name: 'Loose Rubble',
    description:
      'A heap of broken quarry stone. It blocks the way and sight and cannot be shoved. Earthbending brings it down fastest, onto everyone beside it, leaving rubble behind.',
    sprite: 'prop.rubble',
    hp: 12,
    blocksMove: true,
    blocksSight: true,
    grantsCover: true,
    pushable: false,
    vulnerableTo: ['earth'],
    immuneTo: ['fire', 'water', 'cold'],
    onBreak: [
      { kind: 'surface', surface: 'rubble', duration: -1, radius: 1 },
      { kind: 'damage', base: 5, damageType: 'earth', radius: 1 },
    ],
    breakLabel: 'The stone pile collapses in a cloud of grit.',
  },
  {
    /*
     * The joke prop, and it is load-bearing. It deals no damage at all: it blinds,
     * it knocks people over, and it is hilarious. A five-year-old who does nothing
     * all fight but push the cabbage cart into three bandits has had a good fight,
     * and the eight-year-old will be furious that he did not think of it first.
     */
    id: 'cabbage_cart',
    name: 'Cabbage Cart',
    description:
      'A market cart stacked far too high with cabbages. It blocks the way and sight and can be shoved. Smash it and flying cabbages push everyone beside it back a tile, and they are very likely Blinded.',
    sprite: 'prop.cart',
    hp: 7,
    blocksMove: true,
    blocksSight: true,
    grantsCover: true,
    pushable: true,
    vulnerableTo: ['physical', 'air'],
    immuneTo: [],
    onBreak: [
      { kind: 'status', status: 'blinded', duration: 2, chance: 0.9, radius: 1 },
      { kind: 'push', distance: 1, radius: 1 },
    ],
    breakLabel: 'MY CABBAGES! They go everywhere, and so does everyone near them.',
  },
];

export const PROP_BY_ID: ReadonlyMap<string, PropDef> = new Map(PROPS.map((p) => [p.id, p]));
