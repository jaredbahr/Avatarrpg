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
      'A big open barrel of quarry water. Break it and the water goes everywhere — which is exactly what a waterbender or an icebender wants.',
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
      'A clay jar of lamp oil. Harmless until somebody brings a flame, and then it is the most dangerous thing on the field.',
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
      'A standing iron basket of hot coals. Tip it over and the coals go with it. Water will not break it, but it will put it out.',
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
      'Feed for the quarry ox-mules. Good cover, right up until the moment somebody sets it alight.',
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
      'A heap of broken quarry stone. It will not burn and it will not move, but an earthbender can bring it down on somebody.',
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
      "A produce hauler's cart, stacked far too high. Nobody has ever been hurt by a cabbage. Plenty of people have been embarrassed by one.",
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
