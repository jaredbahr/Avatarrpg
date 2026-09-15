/**
 * Act 1 encounters.
 *
 * Difficulty ramps by adding *kinds* of problem rather than by inflating HP:
 *
 *   forest road  three bandits and a puddle        -> learn Wet / Frozen / Shocked
 *   quarry gate  a deserter who sets the oil alight -> learn that fire spreads
 *   the cutting  professionals, in a chokepoint     -> learn positioning
 *   quarry floor a two-tile boss rewriting the map  -> use everything at once
 *
 * `conditionalEnemies` is how the Act 1 choice reaches the boss fight: trade
 * Ruon away and Jin's mercenaries are standing in the quarry when you get there.
 *
 * `reinforcements` scale the fight to the table. Every roster below is tuned
 * for a party of three; each player beyond that pulls in one more enemy. The
 * simulator put a six-player party at a 100% win rate in under three rounds
 * before this existed.
 */

import type { EncounterDef } from '../core/types';

export const ENCOUNTERS: readonly EncounterDef[] = [
  {
    id: 'enc_forest_road',
    name: 'Ambush on the Forest Road',
    mapId: 'forest_road',
    expectedLevel: 1,
    enemies: [
      { enemyId: 'bandit_thug', pos: { x: 17, y: 5 } },
      { enemyId: 'bandit_thug', pos: { x: 17, y: 7 } },
      { enemyId: 'bandit_slinger', pos: { x: 18, y: 3 } },
    ],
    allies: [],
    conditionalEnemies: [],
    baselinePartySize: 3,
    /*
     * Three rosters at an identical 300-XP budget, and this is the whole
     * argument for XP-as-budget in one encounter: the same cost buys three
     * completely different lessons.
     *
     *   thugs     100 + 100 + 100  two in your face, one throwing rocks
     *   slingers  100 + 100 + 100  nothing melee at all; you have to close
     *   bruisers  150 + 150        two heavies; you have to focus fire
     *
     * Because `xpRoster` always scores the *authored* roster whatever spawned,
     * all three pay exactly the same and progression.test.ts never notices.
     */
    variants: [
      {
        id: 'thugs',
        weight: 2,
        intro: 'They step out of the trees. They were waiting for somebody.',
      },
      {
        id: 'slingers',
        weight: 1,
        enemies: [
          { enemyId: 'bandit_slinger', pos: { x: 17, y: 5 } },
          { enemyId: 'bandit_slinger', pos: { x: 18, y: 3 } },
          { enemyId: 'bandit_slinger', pos: { x: 18, y: 7 } },
        ],
        intro: 'Stones come out of the trees before anybody does.',
        tip: 'Nobody up there wants to come close. Get among them — a slinger with somebody in its face is not much use.',
      },
      {
        id: 'bruisers',
        weight: 1,
        enemies: [
          { enemyId: 'bandit_bruiser', pos: { x: 17, y: 5 } },
          { enemyId: 'bandit_bruiser', pos: { x: 17, y: 7 } },
        ],
        intro: 'Only two of them step out. They do not look worried about it.',
        tip: 'Two big ones instead of three small ones. Everybody hit the same one — a bruiser at half health hits just as hard as a fresh one.',
      },
    ],
    // Deliberately short. This is the tutorial fight: a full table should be
    // able to make mistakes here and still walk away.
    reinforcements: [
      { enemyId: 'bandit_thug', pos: { x: 18, y: 6 } },
      { enemyId: 'bandit_slinger', pos: { x: 16, y: 2 } },
    ],
    intro: 'They step out of the trees. They were waiting for somebody.',
    tip: 'There are puddles in the road. Anything standing in water gets Wet — and Wet things freeze easily and take double lightning damage.',
  },
  {
    id: 'enc_quarry_gate',
    name: 'The Quarry Gate',
    mapId: 'quarry_gate',
    expectedLevel: 2,
    enemies: [
      { enemyId: 'fire_deserter', pos: { x: 16, y: 3 } },
      { enemyId: 'bandit_thug', pos: { x: 17, y: 6 } },
      { enemyId: 'bandit_bruiser', pos: { x: 16, y: 8 } },
    ],
    allies: [],
    conditionalEnemies: [],
    baselinePartySize: 3,
    /*
     * The firebender's bluff at the gate does not skip the fight — it changes
     * who is in it. The deserter steps back rather than raise a hand to Fire
     * Nation colours, and the quarry crew comes forward in his place, angrier
     * for having been left to it.
     *
     * Same 450-XP cost as the authored roster (150 x 3 against 200 + 100 + 150),
     * and a very different fight: no firebender on the field means the oil only
     * lights if *you* light it.
     */
    variants: [
      {
        id: 'bluffed',
        weight: 1,
        when: { kind: 'flag', key: 'gate_fire_bluff', op: 'set' },
        enemies: [
          { enemyId: 'bandit_bruiser', pos: { x: 16, y: 3 } },
          { enemyId: 'bandit_earthbender', pos: { x: 17, y: 6 } },
          { enemyId: 'bandit_bruiser', pos: { x: 16, y: 8 } },
        ],
        intro:
          'The deserter looks at your colours, looks at the ground, and steps back off the gate. The quarry crew does not.',
        tip: 'Nobody up there bends fire any more — so the oil only goes up if you light it. That makes the brazier yours to spend.',
      },
    ],
    // Also short: the oil is what makes this fight, not the head count.
    reinforcements: [
      { enemyId: 'bandit_slinger', pos: { x: 17, y: 9 } },
      { enemyId: 'bandit_thug', pos: { x: 17, y: 4 } },
    ],
    intro: 'Barrels are stacked against the gatehouse, and the ground around them is slick.',
    /*
     * This used to say "or wash it away with water first". It does not work:
     * `water-into-oil` in combos.ts keeps the oil and prints "The oil floats on
     * the water, untouched." Teaching a child a plan the rules refuse is worse
     * than teaching them nothing.
     *
     * Burning it off early *is* a real counter — fire on oil expires after a few
     * rounds and leaves bare ground — so the tip now points at that.
     */
    tip: 'That dark stripe down the middle is spilled oil. Fire turns it into a spreading blaze that chases people — so either stay off it, or light it early, while nobody is standing in it.',
  },
  {
    id: 'enc_ambush',
    name: 'The Cutting',
    mapId: 'ambush_road',
    expectedLevel: 3,
    enemies: [
      { enemyId: 'merc_blade', pos: { x: 17, y: 5 } },
      { enemyId: 'merc_blade', pos: { x: 17, y: 6 } },
      { enemyId: 'merc_crossbow', pos: { x: 16, y: 3 } },
    ],
    allies: [{ enemyId: 'ruon_ally', pos: { x: 5, y: 5 } }],
    conditionalEnemies: [],
    baselinePartySize: 3,
    variants: [],
    reinforcements: [
      { enemyId: 'merc_blade', pos: { x: 16, y: 7 } },
      { enemyId: 'merc_crossbow', pos: { x: 18, y: 8 } },
      { enemyId: 'merc_blade', pos: { x: 15, y: 8 } },
      { enemyId: 'merc_sergeant', pos: { x: 17, y: 9 } },
    ],
    intro: "Jin's people are already in the cutting. They knew which road you would take.",
    tip: 'The walls are high here, so there is only one way through. Push someone back into the gap and nobody gets past them.',
  },
  {
    id: 'enc_grumbler',
    name: 'Grumbler',
    mapId: 'quarry_floor',
    expectedLevel: 3,
    enemies: [
      { enemyId: 'grumbler', pos: { x: 15, y: 5 } },
      { enemyId: 'bandit_earthbender', pos: { x: 16, y: 2 } },
    ],
    allies: [],
    conditionalEnemies: [
      {
        flag: 'ruon_traded',
        whenSet: true,
        placements: [
          { enemyId: 'merc_blade', pos: { x: 16, y: 9 } },
          { enemyId: 'merc_crossbow', pos: { x: 17, y: 6 } },
        ],
      },
    ],
    baselinePartySize: 3,
    variants: [],
    reinforcements: [
      { enemyId: 'bandit_thug', pos: { x: 14, y: 3 } },
      { enemyId: 'bandit_thug', pos: { x: 14, y: 8 } },
      { enemyId: 'bandit_slinger', pos: { x: 13, y: 1 } },
      { enemyId: 'bandit_earthbender', pos: { x: 13, y: 10 } },
    ],
    intro:
      'The driller comes up out of the pit on two treads, dragging a plume of oil smoke behind it.',
    tip: 'It leaks oil and churns the floor to mud. Firebenders: light the oil. Waterbenders: freeze the mud and the treads stop dead.',
  },
];

export const ENCOUNTER_BY_ID: ReadonlyMap<string, EncounterDef> = new Map(
  ENCOUNTERS.map((e) => [e.id, e]),
);
