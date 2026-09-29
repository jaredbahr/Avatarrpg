import type { MapScene, SceneImage, SceneScenery, Vec2 } from '../../core/types';
import { FOREST_GRASS_REGIONS } from './forestRoadGround';

const root = 'art/maps/forest-scene/';
/**
 * Water stays on the pond's nine cells (M3 grew the plus sign by (7,5)); the
 * patch widens east to keep the same 16-pixel dry shoreline matte round them.
 */
export const FOREST_POND_PATCH = { x: 560, y: 304, width: 416, height: 192 } as const;
/**
 * The painted shelf covers every tier-1 cell of M3's NE bank and the road-side
 * shoulder south of the exit, with the road exit left open. The tier-2 boulder
 * perch at (19,2) is `FOREST_PERCH_CELLS`; the plate stands it on the bank.
 */
export const FOREST_RAISED_SHELF_CELLS: readonly Vec2[] = [
  { x: 16, y: 1 },
  { x: 17, y: 1 },
  { x: 15, y: 2 },
  { x: 16, y: 2 },
  { x: 17, y: 2 },
  { x: 18, y: 2 },
  { x: 16, y: 3 },
  { x: 17, y: 3 },
  { x: 18, y: 3 },
  { x: 19, y: 3 },
  { x: 18, y: 5 },
  { x: 19, y: 5 },
  { x: 19, y: 6 },
];
/** The tier-2 boulder perch, reached from the bank (`A` in the rows). */
export const FOREST_PERCH_CELLS: readonly Vec2[] = [{ x: 19, y: 2 }];
/** Projected bounds include a small trim margin; the (19,4) exit stays alpha-clear. */
export const FOREST_RAISED_SHELF = { x: 1528, y: 536, width: 400, height: 336 } as const;
/** Asset footprints are checked against the authoritative map rows in forestRoad.test.ts. */
export const FOREST_WATER_CELLS: readonly Vec2[] = [
  { x: 5, y: 5 },
  { x: 6, y: 5 },
  { x: 7, y: 5 },
  { x: 4, y: 6 },
  { x: 5, y: 6 },
  { x: 6, y: 6 },
  { x: 7, y: 6 },
  { x: 5, y: 7 },
  { x: 6, y: 7 },
];
/**
 * M3's southern creek (`W`, deep water: it stops feet, not eyes), in its two
 * pools either side of the alder stand. Nothing draws over a `W` cell at
 * runtime but the flat procedural fill, so each pool carries its own bed, wet
 * line and damp margin, packed by the pond's own shoreline packer
 * (`scripts/art/forest-creek.ts`) so the creek and the pond are one water.
 */
export const FOREST_CREEK_POOLS = [
  {
    name: 'west',
    patch: { x: 112, y: 400, width: 416, height: 224 },
    cells: [
      { x: 4, y: 10 },
      { x: 5, y: 10 },
      { x: 2, y: 11 },
      { x: 3, y: 11 },
      { x: 4, y: 11 },
      { x: 5, y: 11 },
      { x: 6, y: 11 },
    ],
  },
  {
    name: 'east',
    patch: { x: 752, y: 720, width: 416, height: 224 },
    cells: [
      { x: 12, y: 11 },
      { x: 13, y: 11 },
      { x: 14, y: 11 },
      { x: 15, y: 11 },
      { x: 16, y: 11 },
    ],
  },
] as const;
export const FOREST_RUBBLE_CELLS: readonly Vec2[] = [
  { x: 7, y: 3 },
  { x: 8, y: 9 },
];
/**
 * Dema's road-keeper lodge: the village's own dwelling, at half its Ba Dan
 * size, standing on the four blocked pine cells of the north-west corner, two
 * tiles from where she keeps the road at (3,1). It is the one building on the
 * route, and it is on cells the rules already close.
 */
export const FOREST_LODGE_CELLS: readonly Vec2[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];
/**
 * The alders between the creek's pools and at the south corners: the village
 * tree, drawn low so the front edge never hides a unit (plan 1.3).
 */
export const FOREST_ALDER_CELLS: readonly Vec2[] = [
  { x: 0, y: 10 },
  { x: 15, y: 10 },
  { x: 19, y: 10 },
  { x: 0, y: 11 },
  { x: 1, y: 11 },
  { x: 7, y: 11 },
  { x: 8, y: 11 },
  { x: 9, y: 11 },
  { x: 10, y: 11 },
  { x: 11, y: 11 },
  { x: 17, y: 11 },
  { x: 18, y: 11 },
  { x: 19, y: 11 },
];
/** The north pine wall; with the lodge and the alders, every `T` cell. */
export const FOREST_PINE_CELLS: readonly Vec2[] = [
  { x: 2, y: 0 },
  { x: 3, y: 0 },
  { x: 6, y: 0 },
  { x: 7, y: 0 },
  { x: 8, y: 0 },
  { x: 9, y: 0 },
  { x: 10, y: 0 },
  { x: 11, y: 0 },
  { x: 12, y: 0 },
  { x: 13, y: 0 },
  { x: 15, y: 0 },
  { x: 16, y: 0 },
  { x: 17, y: 0 },
  { x: 18, y: 0 },
  { x: 19, y: 0 },
  { x: 7, y: 1 },
  { x: 8, y: 1 },
  { x: 9, y: 1 },
  { x: 18, y: 1 },
  { x: 19, y: 1 },
  { x: 0, y: 2 },
];
/**
 * Pines outside the rim. The north clearings at (4,0), (5,0) and (14,0) are
 * deer paths that end in thicket rather than at the page, a staggered second
 * rank makes the wall read as forest instead of a single file, and the
 * walkable rim cells the edge contract calls a band at west rows 3 and 9 and
 * east row 9 have trees standing just past them. East row 3 has none: a pine there
 * stands in front of the boulder perch and hides it. Exterior pieces carry no
 * rule; the rows and `edges` in `combat.ts` do.
 */
export const FOREST_THICKET_CELLS: readonly Vec2[] = [
  { x: 1, y: -1 },
  { x: 4, y: -1 },
  { x: 5, y: -1 },
  { x: 8, y: -1 },
  { x: 11, y: -1 },
  { x: 14, y: -1 },
  { x: 17, y: -1 },
  { x: -1, y: 3 },
  { x: -1, y: 9 },
  { x: 20, y: 9 },
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
    wind: true,
  };
}

/** A pine past the rim: the same tree, carrying no footprint the rules read. */
function thicketPine(cell: Vec2): SceneScenery {
  return { ...pine(cell), exterior: true };
}

/**
 * Art borrowed from the other scenes, by URL, so it costs no bytes: the village
 * tree, the village dwelling and the Quarry Gate's cut timber. Each keeps its
 * own aspect and its own painted foot anchor.
 */
const BORROWED = {
  alder: { url: 'art/maps/ba-dan-scene/village-tree.webp', width: 750, height: 732 },
  lodge: { url: 'art/maps/ba-dan-scene/dwelling.webp', width: 602, height: 388 },
  deadfall: { url: 'art/maps/quarry-gate-scene/cover-timber.webp', width: 224, height: 96 },
} as const;
const aspect = (art: keyof typeof BORROWED, width: number): number =>
  (width * BORROWED[art].height) / BORROWED[art].width;

/** Low alder: Ba Dan's tree anchor (trunk foot at 51% across, 96% down). */
export const ALDER_WIDTH = 150;
function alder({ x, y }: Vec2): SceneScenery {
  const width = ALDER_WIDTH,
    height = aspect('alder', width);
  return {
    id: `forest-alder-${x}-${y}`,
    url: BORROWED.alder.url,
    x: 768 + (x - y) * 64 - width * 0.51,
    y: (x + y + 1) * 32 - height * 0.96,
    width,
    height,
    // Mirrored on alternate cells, so the stand is not one tree stamped.
    ...((x + y) % 2 === 1 ? { flip: true } : {}),
    footprint: [{ x, y }],
    depth: { x: x + 0.5, y: y + 0.5 },
    fadeWhenOccluding: true,
  };
}

/** Ba Dan's house anchor: the plinth's foremost corner at 43.2% across, 99.5% down. */
export const FOREST_LODGE: SceneScenery = (() => {
  const front = { x: 2, y: 2 };
  const width = 4 * 64,
    height = aspect('lodge', width);
  return {
    id: 'forest-keeper-lodge',
    url: BORROWED.lodge.url,
    x: 768 + (front.x - front.y) * 64 - width * 0.432,
    y: (front.x + front.y) * 32 - height * 0.995,
    width,
    height,
    footprint: FOREST_LODGE_CELLS,
    depth: { x: front.x - 0.5, y: front.y - 0.5 },
    fadeWhenOccluding: true,
  };
})();

/**
 * Deadfall across the west pool: split timber lying in the water at (5,10),
 * where the creek turns north toward the verge. The cell is deep water, so the
 * logs change no rule; they are what the creek has caught.
 */
export const FOREST_DEADFALL: SceneScenery = (() => {
  const width = 120,
    height = aspect('deadfall', width);
  return {
    id: 'forest-creek-deadfall',
    url: BORROWED.deadfall.url,
    x: 768 + (5 - 10) * 64 - width * 0.5,
    y: (5 + 10 + 1) * 32 - height * 0.9,
    width,
    height,
    footprint: [{ x: 5, y: 10 }],
    depth: { x: 5.5, y: 10.5 },
  };
})();


/** Songbirds that burst out of the pines as the ambush opens (docs/art/forest-birds.md). */
export const FOREST_FLOCK = {
  url: `${root}bird-flap.webp`,
  frames: 6,
  frameSize: 32,
  size: 20,
  count: 6,
} as const;

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

/**
 * The route's painted rubble heaps (`scripts/art/forest-rubble.ts`), drawn
 * into the middle of a cover cell's diamond. Every `r` cell on the route stands
 * one of them on its own spill, so real cover reads the same in the forest, the
 * Cutting and on the quarry floor; the scene lists the cell in `paintedRubble`
 * so the live wash stands down under it.
 *
 * There are three piles, and a hash of the cell picks one — never the RNG, so
 * a board draws the same heaps every time — so a floor of six heaps is not six
 * copies of one stamp.
 */
export const RUBBLE_HEAP_URLS = [
  `${root}rubble.webp`,
  `${root}rubble-1.webp`,
  `${root}rubble-2.webp`,
] as const;
export const rubbleHeapUrl = ({ x, y }: Vec2): string =>
  RUBBLE_HEAP_URLS[
    ((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0) % RUBBLE_HEAP_URLS.length
  ] ?? RUBBLE_HEAP_URLS[0];
export const rubbleHeap = ({ x, y }: Vec2): SceneImage => ({
  url: rubbleHeapUrl({ x, y }),
  x: 768 + (x - y) * 64 - 64,
  y: (x + y + 1) * 32 - 64 / 3,
  width: 128,
  height: 128 / 3,
});

/** Already projected ground; gameplay opts the map into the matching projection. */
export const FOREST_ROAD_SCENE: MapScene = {
  groundMode: 'partial',
  paintedRubble: FOREST_RUBBLE_CELLS,
  ground: [
    { url: `${root}grass-north.webp`, ...FOREST_GRASS_REGIONS.north, wind: true },
    { url: `${root}grass-south.webp`, ...FOREST_GRASS_REGIONS.south, wind: true },
    { url: `${root}route-ground.webp`, x: 128, y: 32, width: 1984, height: 960 },
    { url: `${root}pond-bank.webp`, ...FOREST_POND_PATCH },
    ...FOREST_CREEK_POOLS.map((pool) => ({ url: `${root}creek-${pool.name}.webp`, ...pool.patch })),
    { url: `${root}raised-shelf.webp`, ...FOREST_RAISED_SHELF },
    ...FOREST_RUBBLE_CELLS.map(rubbleHeap),
    // Painted last: transparent everywhere the board can be walked.
    ...FOREST_APRON_PIECES,
  ],
  scenery: [
    ...FOREST_THICKET_CELLS.map(thicketPine),
    ...FOREST_PINE_CELLS.map(pine),
    FOREST_LODGE,
    ...FOREST_ALDER_CELLS.map(alder),
    FOREST_DEADFALL,
    FOREST_BANK_NEST_REEDS,
    ...FOREST_POND_REEDS,
  ],
  flock: FOREST_FLOCK,
};
