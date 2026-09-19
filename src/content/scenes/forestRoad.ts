import type { MapScene, SceneScenery, Vec2 } from '../../core/types';

const root = 'art/maps/forest-scene/';
/** Water stays on its eight cells; padding carries only a narrow dry shoreline matte. */
export const FOREST_POND_PATCH = { x: 560, y: 304, width: 352, height: 192 } as const;
/** Asset footprints are checked against the authoritative map rows in forestRoad.test.ts. */
export const FOREST_WATER_CELLS: readonly Vec2[] = [
  { x: 5, y: 5 },
  { x: 6, y: 5 },
  { x: 4, y: 6 },
  { x: 5, y: 6 },
  { x: 6, y: 6 },
  { x: 7, y: 6 },
  { x: 5, y: 7 },
  { x: 6, y: 7 },
];
export const FOREST_RUBBLE_CELLS: readonly Vec2[] = [
  { x: 7, y: 3 },
  { x: 8, y: 9 },
];
export const FOREST_PINE_CELLS: readonly Vec2[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 8, y: 0 },
  { x: 18, y: 0 },
  { x: 19, y: 0 },
  { x: 0, y: 1 },
  { x: 14, y: 1 },
  { x: 19, y: 1 },
  { x: 0, y: 10 },
  { x: 14, y: 10 },
  { x: 19, y: 10 },
  { x: 0, y: 11 },
  { x: 1, y: 11 },
  { x: 18, y: 11 },
  { x: 19, y: 11 },
];

function pine({ x, y }: Vec2): SceneScenery {
  const height = 224,
    width = (height * 512) / 1149;
  return {
    id: `forest-pine-${x}-${y}`,
    url: `${root}pine.webp`,
    x: 768 + (x - y) * 64 - width * 0.51,
    y: (x + y + 1) * 32 - height * 0.99,
    width,
    height,
    footprint: [{ x, y }],
    depth: { x: x + 0.5, y: y + 0.5 },
    fadeWhenOccluding: true,
  };
}

/** Already projected ground; gameplay opts the map into the matching projection. */
export const FOREST_ROAD_SCENE: MapScene = {
  groundMode: 'partial',
  paintedRubble: FOREST_RUBBLE_CELLS,
  ground: [
    { url: `${root}route-ground.webp`, x: 128, y: 32, width: 1984, height: 960 },
    { url: `${root}pond-bank.webp`, ...FOREST_POND_PATCH },
    ...FOREST_RUBBLE_CELLS.map(({ x, y }) => ({
      url: `${root}rubble.webp`,
      x: 768 + (x - y) * 64 - 64,
      y: (x + y + 1) * 32 - 64 / 3,
      width: 128,
      height: 128 / 3,
    })),
  ],
  scenery: FOREST_PINE_CELLS.map(pine),
};
