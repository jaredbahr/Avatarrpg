import type { MapScene, SceneImage, SceneScenery, Vec2 } from '../../core/types';
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
 * The pond's own bank planting: three low reed fringes cut from the same
 * authored flood-bank reeds, standing on the cells that touch the water so the
 * wet line carries growth instead of meeting the road as a bare edge. They are
 * passable scenery like the nest: no wall, no collision, no ground disk.
 */
/** The packed fringe's own pixel size; every placement keeps this aspect. */
export const REED_PLATE = { width: 512, height: 313 } as const;
export const FOREST_POND_REEDS: readonly SceneScenery[] = (
  [
    { x: 4, y: 5, width: 96 },
    { x: 7, y: 7, width: 104 },
    { x: 5, y: 8, width: 120 },
  ] as const
).map(({ x, y, width }) => {
  // The packed plate's own aspect, so the artist's fringe is never stretched.
  const height = Math.round((width * REED_PLATE.height) / REED_PLATE.width);
  return {
    id: `forest-pond-reeds-${x}-${y}`,
    url: `${root}pond-reeds.webp`,
    x: 768 + (x - y) * 64 - width / 2,
    y: (x + y + 1) * 32 - height,
    width,
    height,
    footprint: [{ x, y }],
    depth: { x: x + 0.1, y: y + 0.08 },
  };
});

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
/**
 * How far inside the rim the apron reaches to close the feather the grass packs
 * leave: they fade to alpha 0 across their outermost ~0.2 tiles, which the page
 * showed through beside the authored ground.
 */
export const FOREST_APRON_SEAM = 0.35;
export const FOREST_EXTERIOR_APRON = {
  x: 768 - (FOREST_APRON_MAP.height + 2 * FOREST_APRON_DEPTH) * 64,
  y: -2 * FOREST_APRON_DEPTH * 32,
  width: (FOREST_APRON_MAP.width + FOREST_APRON_MAP.height + 4 * FOREST_APRON_DEPTH) * 64,
  height: (FOREST_APRON_MAP.width + FOREST_APRON_MAP.height + 4 * FOREST_APRON_DEPTH) * 32,
} as const;
/**
 * The ring ships as bands, not as one plate: its bounding box is 2688 pixels
 * wide against the 2048-pixel texture the device matrix promises, and 83.3% of
 * it is clear. These are the ring's pixels, in plate coordinates, from
 * `scripts/art/lib/apron-bands.ts`; the packer cuts the same rectangles, and
 * `scripts/art/apron-plates.test.ts` pins the table, the cut and the shipped
 * files together.
 */
export const FOREST_APRON_BANDS = [
  { x: 723, y: 0, width: 730, height: 182 },
  { x: 362, y: 182, width: 726, height: 181 },
  { x: 1088, y: 182, width: 726, height: 181 },
  { x: 0, y: 363, width: 726, height: 181 },
  { x: 1450, y: 363, width: 726, height: 181 },
  { x: 0, y: 544, width: 877, height: 256 },
  { x: 1811, y: 544, width: 877, height: 256 },
  { x: 512, y: 800, width: 726, height: 181 },
  { x: 1962, y: 800, width: 726, height: 181 },
  { x: 874, y: 981, width: 726, height: 181 },
  { x: 1600, y: 981, width: 726, height: 181 },
  { x: 1235, y: 1162, width: 730, height: 182 },
] as const;
export const FOREST_APRON_PIECES: readonly SceneImage[] = FOREST_APRON_BANDS.map((band, index) => ({
  url: `${root}exterior-apron-${index}.webp`,
  x: FOREST_EXTERIOR_APRON.x + band.x,
  y: FOREST_EXTERIOR_APRON.y + band.y,
  width: band.width,
  height: band.height,
}));

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
    ...FOREST_APRON_PIECES,
  ],
  scenery: [...FOREST_PINE_CELLS.map(pine), FOREST_BANK_NEST_REEDS, ...FOREST_POND_REEDS],
};
