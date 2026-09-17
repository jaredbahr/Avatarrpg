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
      'Quiet feet. The turtle-ducks have right of way. I have explained this to the carts; the carts are taking it personally.',
      'They nest in the reeds below the road. When the quarry runoff comes down, they move uphill. This week they moved into my washing.',
      'Take the road east if you want answers. Take the little paths if you want to understand the question.',
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
      'Still here. Still outnumbered by ducks.',
      'If you can get the quarry to mind what it sends downstream, I might get my socks back.',
    ],
    next: 'forest_explore',
  },
  {
    id: 'cutting_tea',
    kind: 'dialogue',
    speaker: 'Sen',
    portrait: 'portrait.gao',
    lines: [
      'One cup for a traveller. Two for someone who says they are too busy for tea.',
      'The crews built this rest with their own offcuts. No foreman ordered it. Tired people noticed other tired people.',
      'That is how a village starts, I think. Somebody puts the kettle on before asking which side you are on.',
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
      'Your cups are where you left them. That makes you regulars. There are responsibilities.',
      'Mostly washing the cups.',
    ],
    next: 'cutting_after_explore',
  },
];
