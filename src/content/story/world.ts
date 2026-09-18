import type { StoryNode } from '../../core/types';

/** Explore nodes keep legacy story saves and the exact XP audit compatible. Routes live on maps. */
export const WORLD_STORY: readonly StoryNode[] = [
  {
    id: 'gate_escort_explore',
    kind: 'explore',
    mapId: 'quarry_gate',
    objective: 'Ruon is with you. Explore the east path into the cutting.',
    next: 'cutting_explore',
  },
  {
    id: 'gate_trade_explore',
    kind: 'explore',
    mapId: 'quarry_gate',
    objective: 'The gate is open. Explore the cutting to the east.',
    next: 'cutting_after_explore',
  },
  {
    id: 'forest_explore',
    kind: 'explore',
    mapId: 'forest_road',
    objective: 'Explore the pine road. Watch for the people ahead.',
    next: 'battle_forest_road',
  },
  {
    id: 'forest_after_explore',
    kind: 'explore',
    mapId: 'forest_road',
    objective: 'The road is open. Visit Ba Dan or continue east to the quarry gate.',
    next: 'gate_parley',
  },
  {
    id: 'cutting_explore',
    kind: 'explore',
    mapId: 'ambush_road',
    objective: 'Explore the cutting. Jin’s people may be waiting.',
    next: 'battle_ambush',
  },
  {
    id: 'cutting_after_explore',
    kind: 'explore',
    mapId: 'ambush_road',
    objective: 'The way is clear. Follow the east path to the quarry floor, or return to Ba Dan.',
    next: 'quarry_descent',
  },
  {
    id: 'forest_dema',
    kind: 'dialogue',
    speaker: 'Dema',
    portrait: 'portrait.mira',
    lines: [
      'Wait a moment. Let the turtle-ducks get across.',
      'They used to nest below the road. The reeds are coated in quarry silt now, so they have moved up here. One has taken a sock from my washing.',
      'I found it. There are eggs in it. I suppose I will have to wait.',
    ],
    next: 'forest_ducks_seen',
  },
  {
    id: 'forest_ducks_seen',
    kind: 'flags',
    set: { 'world.ducks_seen': true },
    next: 'forest_explore',
  },
  {
    id: 'forest_dema_again',
    kind: 'dialogue',
    speaker: 'Dema',
    portrait: 'portrait.mira',
    lines: [
      'The nest is still there. Mind the grass beside the path.',
      'If you reach the quarry, ask what they are washing into the stream. It used to run clear between rains.',
    ],
    next: 'forest_explore',
  },
  {
    id: 'cutting_tea',
    kind: 'dialogue',
    speaker: 'Sen',
    portrait: 'portrait.gao',
    lines: [
      'Tea? The kettle has just boiled.',
      'The crews built this bench from offcuts. One shift started it and the next finished it. They never did agree on the height.',
      'Try the left end. Your feet might reach the ground.',
    ],
    next: 'cutting_tea_shared',
  },
  {
    id: 'cutting_tea_shared',
    kind: 'flags',
    set: { 'world.tea_shared': true },
    next: 'cutting_after_explore',
  },
  {
    id: 'cutting_tea_again',
    kind: 'dialogue',
    speaker: 'Sen',
    portrait: 'portrait.gao',
    lines: [
      'Back again? There is still some in the pot.',
      'Leave your cup upside down when you have rinsed it. I keep losing track of which ones are clean.',
    ],
    next: 'cutting_after_explore',
  },
];
