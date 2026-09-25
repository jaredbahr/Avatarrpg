import type { Condition, ResidentProfile, StoryNode } from '../../core/types';
import { RETURNEE_IDS } from '../residents/returnees';

const profilesAre = (...profiles: ResidentProfile[]): Condition => ({
  kind: 'all',
  of: RETURNEE_IDS.map((residentId) => ({
    kind: 'residentProfile',
    residentId,
    in: profiles,
  })),
});

const RESTING_PROFILES = Object.fromEntries(RETURNEE_IDS.map((id) => [id, 'resting'])) as Readonly<
  Record<(typeof RETURNEE_IDS)[number], ResidentProfile>
>;

export const RETURNEES_RETURNING: Condition = profilesAre('returning');
export const RETURNEES_HOME: Condition = profilesAre('resting', 'recovering', 'ready');

/** The four village homecomings are remembered by the existing story visit log. */
export const VILLAGE_HOMECOMINGS_COMPLETE: Condition = {
  kind: 'all',
  of: [
    { kind: 'visited', nodeId: 'mira_epilogue' },
    { kind: 'visited', nodeId: 'pella_home' },
    {
      kind: 'any',
      of: [
        { kind: 'visited', nodeId: 'gao_home' },
        { kind: 'visited', nodeId: 'gao_home_cold' },
      ],
    },
    { kind: 'visited', nodeId: 'dorin_home' },
  ],
};

/** Victory frees the route for a walk home; custody and optional visits still matter. */
export const RETURN_STORY: readonly StoryNode[] = [
  {
    id: 'quarry_after_explore',
    kind: 'explore',
    mapId: 'quarry_floor',
    objective: 'The five workers are returning with you. Take the west path towards Ba Dan.',
    next: 'cutting_return_explore',
  },
  {
    id: 'cutting_return_explore',
    kind: 'explore',
    mapId: 'ambush_road',
    objective:
      'The workers are returning to Ba Dan. Ba Dan lies west; Sen is at the rest stop if you need a pause.',
    next: 'gate_return_explore',
  },
  {
    id: 'gate_return_explore',
    kind: 'explore',
    mapId: 'quarry_gate',
    objective:
      'The workers are returning. The gate is open; follow the forest road west to Ba Dan.',
    next: 'forest_return_explore',
  },
  {
    id: 'forest_return_explore',
    kind: 'explore',
    mapId: 'forest_road',
    objective: 'The five workers are returning. Continue west to Ba Dan.',
    next: 'forest_return_arrival',
  },
  {
    id: 'forest_return_arrival',
    kind: 'dialogue',
    speaker: 'The West Road',
    portrait: 'portrait.narrator',
    lines: [
      'The west road reaches the edge of Ba Dan.',
      'The returning group crosses into the village together.',
    ],
    next: 'forest_return_arrived',
  },
  {
    id: 'forest_return_arrived',
    kind: 'flags',
    set: {},
    residentProfiles: RESTING_PROFILES,
    next: 'village_return_explore',
  },
  {
    id: 'village_return_explore',
    kind: 'explore',
    mapId: 'ba_dan_village',
    objective: 'The workers are home. Talk with Mira, Pella, Gao or Dorin, or visit the river.',
    objectiveVariants: [
      {
        when: VILLAGE_HOMECOMINGS_COMPLETE,
        text: "You've caught up with the village. Rest by the river, or explore the roads.",
      },
    ],
    next: 'village_return_explore',
  },
  {
    id: 'pella_home',
    kind: 'dialogue',
    speaker: 'Pella',
    portrait: 'portrait.pella',
    lines: [
      'My brother is home. Bo-shan. He came through the gate and I ran so fast I lost a shoe.',
      'He went back for it. I told him he was not allowed to go anywhere else.',
      'Thank you for finding him.',
    ],
    variants: [
      {
        // The return lands in the evening (D2); this hold lasts until she is heard.
        when: {
          kind: 'all',
          of: [
            { kind: 'flag', key: 'pella_asked', op: 'set' },
            { kind: 'phase', in: ['dawn', 'morning', 'midday', 'afternoon'] },
          ],
        },
        lines: [
          'You found him. He came through the gate and I ran so fast I lost a shoe.',
          'I told him about the chores. He said he would do them. All of them.',
          'He said he would start straight away. He is still asleep.',
        ],
      },
      {
        when: { kind: 'flag', key: 'pella_asked', op: 'set' },
        lines: [
          'You found him. He came through the gate and I ran so fast I lost a shoe.',
          'I told him about the chores. He said he would do them. All of them.',
          'He can start tomorrow. He is asleep now.',
        ],
      },
    ],
    next: 'village_return_explore',
  },
  {
    id: 'gao_home',
    kind: 'dialogue',
    speaker: 'Gao the Shopkeeper',
    portrait: 'portrait.gao',
    lines: [
      'Leave your packs by the door. There is rice in the pot.',
      'Bo-shan tried to pay me. Still had the vegetable money tied into his belt. I sent him home to his sister.',
      'You can return the water skins later. Eat while it is hot.',
    ],
    next: 'village_return_explore',
  },
  {
    id: 'gao_home_cold',
    kind: 'dialogue',
    speaker: 'Gao the Shopkeeper',
    portrait: 'portrait.gao',
    lines: [
      'The workers are home. I am glad of that. There is rice if you want it.',
      'I still wish you had brought Ruon here. These families should have heard him answer for the gate.',
      'If you find out where Jin took him, tell Mira.',
    ],
    next: 'village_return_explore',
  },
  {
    id: 'dorin_home',
    kind: 'dialogue',
    speaker: 'Gate Guard Dorin',
    portrait: 'portrait.dorin',
    lines: [
      'I saw them coming round the bend. Pella was through the gate before I could call her.',
      'Everyone who could walk is back. We took the handcart for the others.',
      'Go and see Mira. I will keep watch here.',
    ],
    variants: [
      {
        // Off the post in the evening and at night: Hanru has the watch (§4).
        when: { kind: 'phase', in: ['evening', 'night'] },
        lines: [
          'I saw them coming round the bend. Pella was through the gate before I could call her.',
          'Everyone who could walk is back. We took the handcart for the others.',
          'Hanru has the watch tonight. I stayed to see them in.',
        ],
      },
    ],
    next: 'village_return_explore',
  },
  {
    id: 'dema_home',
    kind: 'dialogue',
    speaker: 'Dema',
    portrait: 'portrait.mira',
    lines: [
      'The crews came past. A few stopped to ask about the stream.',
      'They will look at the settling pit when they are fit to work. There is still plenty of silt down here.',
      'The ducks can stay on the bank for now. Go home. Mira will be waiting.',
    ],
    next: 'forest_return_explore',
  },
  {
    id: 'sen_home',
    kind: 'dialogue',
    speaker: 'Sen',
    portrait: 'portrait.gao',
    lines: [
      'They came through just ahead of you. Filled this bench and most of the ground around it.',
      'I went through all the tea. Sit a moment; I have hot water left.',
      'Gao is feeding everyone in Ba Dan. Take the west road when you are ready.',
    ],
    next: 'cutting_return_explore',
  },
  {
    id: 'riverside_mira_home',
    kind: 'dialogue',
    speaker: 'Elder Mira',
    portrait: 'portrait.mira',
    lines: [
      'I spent the morning moving beds. Everyone wants their relatives to stay in the same room.',
      'They are all home. I keep going back to check.',
      'Sit with me a while. The washing can wait.',
    ],
    next: 'riverside_explore',
  },
];
