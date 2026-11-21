/**
 * The river road (`docs/places/river_road.md`): the cart's day up the river to Causeway. GREY BLOCKOUT: the road's
 * explore node, and the sign at Emberwatch that leads onto it. Scene 3.9 shows the sign (it sets `mq03.invited`)
 * once MQ-03's later scenes are built; until then nothing in the story reaches it, and the board is walked by warp.
 */
import type { StoryNode } from '../../../core/types';
import { staged } from './stage';

const NODES: readonly StoryNode[] = [
  {
    id: 'river_road_sign',
    kind: 'dialogue',
    speaker: 'River road',
    portrait: 'portrait.narrator',
    // The cart setting off up the river road, after Scene 3.9 (the writing pass, 2026-11-21; a draft for the owner).
    // It names no driver, so it is the same line after an Act I win and after a loss.
    lines: [
      'The cart turns its back on the bay. Ahead, the road finds the river and keeps beside it. Causeway is a day upstream.',
      'Parcel walks like an ostrich horse who has already picked the place where he is going to stop.',
    ],
    next: 'river_road_explore',
  },
  {
    id: 'river_road_explore',
    kind: 'explore',
    mapId: 'river_road',
    // The road's objective line: kept as built (the writing pass, 2026-11-21).
    objective: 'Follow the river road toward Causeway.',
    next: 'river_road_explore',
  },
];

export const RIVER_ROAD_STORY: readonly StoryNode[] = staged(NODES, 'emberwatch_parade', {
  river_road_sign: 'river_road_sign',
});
