import type { StoryNode } from '../../core/types';

/** Victory frees the route for a walk home; custody and optional visits still matter. */
export const RETURN_STORY: readonly StoryNode[] = [
  {
    id: 'quarry_after_explore',
    kind: 'explore',
    mapId: 'quarry_floor',
    objective: 'The workers are out. Take the west path through the cutting towards Ba Dan.',
    next: 'cutting_return_explore',
  },
  {
    id: 'cutting_return_explore',
    kind: 'explore',
    mapId: 'ambush_road',
    objective:
      'Ba Dan lies west, past the quarry gate. Sen is at the rest stop if you need a pause.',
    next: 'gate_return_explore',
  },
  {
    id: 'gate_return_explore',
    kind: 'explore',
    mapId: 'quarry_gate',
    objective: 'The gate is open. Follow the forest road west to Ba Dan.',
    next: 'forest_return_explore',
  },
  {
    id: 'forest_return_explore',
    kind: 'explore',
    mapId: 'forest_road',
    objective: 'The roadblock is gone. Continue west to Ba Dan.',
    next: 'village_return_explore',
  },
  {
    id: 'village_return_explore',
    kind: 'explore',
    mapId: 'ba_dan_village',
    objective: 'The workers are home. Talk with Mira, Pella and Gao, or visit the river.',
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
      'Mira is in the square. Go on. I will keep watch here.',
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
      'I have spent the afternoon finding beds. Everyone wants their relatives to stay in the same room.',
      'They are all home. I keep going back to check.',
      'Sit with me a while. The washing can wait.',
    ],
    next: 'riverside_explore',
  },
];
