import type { NpcDef } from '../../core/types';

/** Optional inspectable places use the same approach and remembered-route rules as villagers. */
export const DISCOVERIES = [
  {
    id: 'duck_nest',
    map: 'forest_road',
    name: 'Turtle-duck nest',
    pos: { x: 2, y: 9 },
    sprite: 'world.turtle_ducks',
    back: 'forest_explore',
  },
  {
    id: 'runoff_marker',
    map: 'forest_road',
    name: 'Runoff measuring stone',
    pos: { x: 16, y: 9 },
    sprite: 'world.runoff_marker',
    back: 'forest_explore',
  },
  {
    id: 'tea_station',
    map: 'ambush_road',
    name: 'Workers’ tea station',
    pos: { x: 3, y: 9 },
    sprite: 'world.tea_station',
    back: 'cutting_explore',
  },
] as const;

export function discoveryMarkers(mapId: string): NpcDef[] {
  return DISCOVERIES.filter((item) => item.map === mapId).map((item) => ({
    id: item.id,
    name: item.name,
    pos: item.pos,
    sprite: item.sprite,
    node: `discover_${item.id}`,
    routes: [
      {
        when: { kind: 'flag', key: `world.discovered.${item.id}`, op: 'set' },
        node: `revisit_${item.id}`,
      },
    ],
  }));
}
