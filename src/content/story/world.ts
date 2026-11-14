import type { StoryNode } from '../../core/types';

/** Explore nodes keep legacy story saves and the exact XP audit compatible. Routes live on maps. */
export const WORLD_STORY: readonly StoryNode[] = [
  /*
   * The culvert (saga outline, decision 23; story bible C-29). One stone, two
   * ripples, and nobody explains it. The trigger (`maps/world.ts`) watches the
   * only crossing east of the pool, so every party on either branch sees it
   * once on the way to the quarry floor. Sura, if present, hears it first
   * (the outline's reason for her to keep going; PQ-04). No line names what
   * lives in the water: the reveal ladder holds that until Act III.
   */
  {
    id: 'cutting_culvert',
    kind: 'dialogue',
    speaker: 'The Cutting',
    portrait: 'portrait.narrator',
    lines: [
      'The pool drains under the road through a culvert, a square mouth of cut stone furred with green.',
      'A pebble rolls off the verge and drops into the water at the culvert mouth.',
    ],
    variants: [
      {
        when: { kind: 'partyHas', characterId: 'sura' },
        speaker: 'Sura',
        portrait: 'portrait.sura',
        lines: [
          'Hang on. Quiet a second. There is a culvert under the road; the pool drains through it.',
          'Something just went in. I heard it hit the water.',
          'Then I heard it go in again.',
        ],
      },
    ],
    next: 'cutting_culvert_ripple',
  },
  {
    id: 'cutting_culvert_ripple',
    kind: 'dialogue',
    speaker: 'The Cutting',
    portrait: 'portrait.narrator',
    lines: [
      'The water ripples once. A breath later, it ripples again.',
      'Then the pool is still, and the road runs on east.',
    ],
    next: 'cutting_after_explore',
  },
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
    objective: 'Follow the road east to the quarry gate, past the roadblock. Ba Dan is west.',
    objectiveTargetId: 'quarry_gate',
    next: 'battle_forest_road',
  },
  {
    id: 'forest_after_explore',
    kind: 'explore',
    mapId: 'forest_road',
    objective: 'The road is open. Continue east to the quarry gate, or go back to Ba Dan.',
    objectiveTargetId: 'quarry_gate',
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
    speaker: 'Lanfen',
    portrait: 'portrait.dema',
    lines: [
      'Mind your feet. There are ducklings under that fern. Yes, the one you are about to step on.',
      "They used to nest down by the stream. Now it's full of quarry silt, and I've got a turtle duck sitting in my clean washing.",
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
    speaker: 'Lanfen',
    portrait: 'portrait.dema',
    lines: [
      'She has brought the ducklings over. I suppose the washing can wait.',
      'Any word about the runoff? It is still coming down white.',
    ],
    next: 'forest_explore',
  },
  {
    id: 'cutting_tea',
    kind: 'dialogue',
    speaker: 'Kuan',
    portrait: 'portrait.sen',
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
    speaker: 'Kuan',
    portrait: 'portrait.sen',
    lines: [
      "Back already? I've put fresh water on.",
      'Pass me those cups, would you? The cloth is under the bench.',
    ],
    next: 'cutting_after_explore',
  },
];
