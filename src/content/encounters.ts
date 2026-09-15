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
    intro: 'Three of them step out of the trees. They were waiting for somebody.',
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
    intro: 'Barrels are stacked against the gatehouse, and the ground around them is slick.',
    tip: 'That dark stripe down the middle is spilled oil. Fire turns it into a spreading blaze — so either stay off it, or wash it away with water first.',
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
    allies: [{ enemyId: 'ruon_ally', pos: { x: 3, y: 6 }, nameSuffix: '' }],
    conditionalEnemies: [],
    intro: "Jin's people are already in the cutting. They knew which road you would take.",
    tip: 'The walls are high here, so there is only one way through. Push someone back into the gap and nobody gets past them.',
  },
  {
    id: 'enc_grumbler',
    name: 'Grumbler',
    mapId: 'quarry_floor',
    expectedLevel: 4,
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
    intro:
      'The driller comes up out of the pit on two treads, dragging a plume of oil smoke behind it.',
    tip: 'It leaks oil and churns the floor to mud. Firebenders: light the oil. Waterbenders: freeze the mud and the treads stop dead.',
  },
];

export const ENCOUNTER_BY_ID: ReadonlyMap<string, EncounterDef> = new Map(
  ENCOUNTERS.map((e) => [e.id, e]),
);
