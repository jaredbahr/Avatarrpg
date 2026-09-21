import type { MapScene, SceneScenery, Vec2 } from '../../core/types';
import { FOREST_GRASS_REGIONS } from './forestRoadGround';

const root = 'art/maps/forest-scene/';
/** Water stays on its eight cells; padding carries only a narrow dry shoreline matte. */
export const FOREST_POND_PATCH = { x: 560, y: 304, width: 352, height: 192 } as const;
/** The eastern shelf is two shallow elevated groups with the road exit left open. */
export const FOREST_RAISED_SHELF_CELLS: readonly Vec2[] = [
  { x: 19, y: 2 },
  { x: 18, y: 3 },
  { x: 19, y: 3 },
  { x: 18, y: 5 },
  { x: 19, y: 5 },
  { x: 19, y: 6 },
];
/** Projected bounds include a small trim margin; the (19,4) exit stays alpha-clear. */
export const FOREST_RAISED_SHELF = { x: 1528, y: 664, width: 400, height: 208 } as const;
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

/** A low, passable flood-bank remnant beside the southern woodland path. */
export const FOREST_BANK_NEST_REEDS: SceneScenery = {
  id: 'forest-bank-nest-reeds',
  url: `${root}old-nest-reeds.webp`,
  x: 516,
  y: 454,
  width: 120,
  height: 58,
  footprint: [{ x: 6, y: 9 }],
  depth: { x: 6.1, y: 9.08 },
};

/**
 * The forest road does not end where the rules stop. This apron carries the
 * route's own authored ground — the pixels `grass-north`, `grass-south` and
 * `route-ground` paint along the rim — back out into the page, then fades to
 * nothing before the camera can follow it. `combat.ts` owns the authoritative
 * map size, and `forestRoad.test.ts` pins the two together.
 */
export const FOREST_APRON_MAP = { width: 20, height: 12 } as const;
/** Logical tiles of authored terrain outside the rim, on all four sides. */
export const FOREST_APRON_DEPTH = 2.5;
export const FOREST_EXTERIOR_APRON = {
  x: 768 - (FOREST_APRON_MAP.height + 2 * FOREST_APRON_DEPTH) * 64,
  y: -2 * FOREST_APRON_DEPTH * 32,
  width: (FOREST_APRON_MAP.width + FOREST_APRON_MAP.height + 4 * FOREST_APRON_DEPTH) * 64,
  height: (FOREST_APRON_MAP.width + FOREST_APRON_MAP.height + 4 * FOREST_APRON_DEPTH) * 32,
} as const;

/** Already projected ground; gameplay opts the map into the matching projection. */
export const FOREST_ROAD_SCENE: MapScene = {
  groundMode: 'partial',
  paintedRubble: FOREST_RUBBLE_CELLS,
  ground: [
    { url: `${root}grass-north.webp`, ...FOREST_GRASS_REGIONS.north },
    { url: `${root}grass-south.webp`, ...FOREST_GRASS_REGIONS.south },
    { url: `${root}route-ground.webp`, x: 128, y: 32, width: 1984, height: 960 },
    { url: `${root}pond-bank.webp`, ...FOREST_POND_PATCH },
    { url: `${root}raised-shelf.webp`, ...FOREST_RAISED_SHELF },
    ...FOREST_RUBBLE_CELLS.map(({ x, y }) => ({
      url: `${root}rubble.webp`,
      x: 768 + (x - y) * 64 - 64,
      y: (x + y + 1) * 32 - 64 / 3,
      width: 128,
      height: 128 / 3,
    })),
    // Painted last: transparent everywhere the board can be walked.
    { url: `${root}exterior-apron.webp`, ...FOREST_EXTERIOR_APRON },
  ],
  scenery: [...FOREST_PINE_CELLS.map(pine), FOREST_BANK_NEST_REEDS],
};
