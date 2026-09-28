import type { StoryNode } from '../../core/types';

/** Explore nodes keep legacy story saves and the exact XP audit compatible. Routes live on maps. */
export const WORLD_STORY: readonly StoryNode[] = [
  {
    id: 'gate_escort_explore',
    kind: 'explore',
    mapId: 'quarry_gate',
    objective:
      'Ruon walks with you. Explore the east path through the cutting to the quarry floor.',
    next: 'cutting_explore',
  },
  {
    id: 'gate_trade_explore',
    kind: 'explore',
    mapId: 'quarry_gate',
    objective: 'The gate is open. Explore the cutting east to the quarry floor.',
    next: 'cutting_after_explore',
  },
  {
    id: 'forest_explore',
    kind: 'explore',
    mapId: 'forest_road',
    objective: 'Explore the pine road east to the quarry gate, or go back west to Ba Dan.',
    next: 'battle_forest_road',
  },
  {
    id: 'forest_after_explore',
    kind: 'explore',
    mapId: 'forest_road',
    objective: 'The road is open. Continue east to the quarry gate, or go back to Ba Dan.',
    next: 'gate_parley',
  },
  {
    id: 'cutting_explore',
    kind: 'explore',
    mapId: 'ambush_road',
    objective: 'Explore the cutting with Ruon. Jin’s people may be waiting on the road.',
    next: 'battle_ambush',
  },
  {
    id: 'cutting_after_explore',
    kind: 'explore',
    mapId: 'ambush_road',
    objective: 'Follow the east path down to the quarry floor, or go back west to Ba Dan.',
    next: 'quarry_descent',
  },
  {
    id: 'forest_dema',
    kind: 'dialogue',
    speaker: 'Dema',
    portrait: 'portrait.mira',
    lines: [
      'Mind your feet. There are ducklings under that fern. Yes, the one you are about to step on.',
      "They used to nest down by the stream. Now it's full of quarry silt, and I've got a turtle-duck sitting in my clean washing.",
      'If you are going up there, ask them about the runoff. The duck can keep whichever sock it took. I want my stream back.',
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
      'She has brought the ducklings over. I suppose the washing can wait.',
      'Any word about the runoff? It is still coming down white.',
    ],
    next: 'forest_explore',
  },
  {
    id: 'cutting_tea',
    kind: 'dialogue',
    speaker: 'Sen',
    portrait: 'portrait.gao',
    lines: [
      'Cup? Mind the handle on the blue one. It comes off.',
      'The crews built this bench from offcuts. One shift started it and the next finished it. They never did agree on the height.',
      "I keep the kettle going in case they come down. Tea's getting a bit strong. Sit, please. Help me finish it.",
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
      "Back already? I've put fresh water on.",
      'Pass me those cups, would you? The cloth is under the bench.',
    ],
    next: 'cutting_after_explore',
  },
];
