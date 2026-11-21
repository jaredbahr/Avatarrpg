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
    // PLACEHOLDER (story): the cart setting off up the river road, after Scene 3.9.
    lines: ['PLACEHOLDER (story): the cart sets off up the river road toward Causeway.'],
    next: 'river_road_explore',
  },
  {
    id: 'river_road_explore',
    kind: 'explore',
    mapId: 'river_road',
    // PLACEHOLDER (story): the road's objective line.
    objective: 'Follow the river road toward Causeway.',
    next: 'river_road_explore',
  },
];

export const RIVER_ROAD_STORY: readonly StoryNode[] = staged(NODES, 'emberwatch_parade', {
  river_road_sign: 'river_road_sign',
});
