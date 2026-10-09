import type { MapScene, SceneImage, SceneScenery, Vec2 } from '../../core/types';

const root = 'art/maps/ba-dan-scene/';
/** The registered projected envelope for the canal from the west pond to the courtyard. */
export const BA_DAN_CANAL = { x: 0, y: 6, width: 13, height: 1 } as const;
/** Permanent water cells; the bridge deck at x9 carries the paved crossing over the flow. */
export const BA_DAN_WATER_CELLS: readonly Vec2[] = Array.from({ length: 13 }, (_, x) => x)
  .filter((x) => x !== 9)
  .map((x) => ({ x, y: 6 }));
export const BA_DAN_CANAL_BRIDGE = { x: 9, y: 6 } as const;
/** Flat grass fringe across the northern lawn bay; both door approaches stay clear. */
export const BA_DAN_NORTH_FRINGE = { x: 10.05, y: 3.9, width: 1.9, depth: 0.2 } as const;
/** Local authored ground proof slice; the grid remains procedural outside it. */
export const BA_DAN_COURTYARD_GROUND = {
  x: 640,
  y: 256,
  width: 1152,
  height: 576,
} as const;
/** Spawn road plus immediate grass shoulders; overlaps the courtyard at x5..6. */
export const BA_DAN_WESTERN_APPROACH_GROUND = {
  x: 384,
  y: 192,
  width: 704,
  height: 352,
} as const;
/** Connected local courts; outer tree rim and map perimeter remain procedural. */
export const BA_DAN_NEIGHBORHOOD_GROUNDS = [
  { id: 'northwest-lawn', x: 576, y: 96, width: 704, height: 352 },
  { id: 'north-house-court', x: 960, y: 160, width: 1152, height: 576 },
  { id: 'east-gate-approach', x: 1280, y: 640, width: 896, height: 448 },
  { id: 'south-house-court', x: 384, y: 480, width: 1152, height: 576 },
  { id: 'northeast-lawn', x: 1472, y: 512, width: 1024, height: 512 },
  { id: 'southwest-lawn', x: 64, y: 288, width: 832, height: 416 },
] as const;
/**
 * The outer garden's base: two opaque halves of one pixel-grain meadow under
 * the whole board, listed first so every painted court feathers into it
 * rather than into the procedural grass (`scripts/art/ba-dan-garden.ts`).
 */
export const BA_DAN_GARDEN_PLATES = [
  { x: 0, y: 0, width: 1280, height: 1280 },
  { x: 1280, y: 0, width: 1280, height: 1280 },
] as const;
/** Transparent coping envelope around the west-fed runtime watercourse. */
export const BA_DAN_CANAL_BANKS = { x: 544, y: 176, width: 960, height: 480 } as const;

/**
 * The village does not end where the rules stop: this apron carries the rim's ground
 * back out into the page and fades before the camera can follow it. `village.ts` owns
 * the authoritative size; `baDan.test.ts` pins them together.
 */
export const BA_DAN_APRON_MAP = { width: 24, height: 16 } as const;
/** Logical tiles of authored terrain outside the rim, on all four sides. */
export const BA_DAN_APRON_DEPTH = 2.5;
export const BA_DAN_EXTERIOR_APRON = {
  x: 1024 - (BA_DAN_APRON_MAP.height + 2 * BA_DAN_APRON_DEPTH) * 64,
  y: -2 * BA_DAN_APRON_DEPTH * 32,
  width: (BA_DAN_APRON_MAP.width + BA_DAN_APRON_MAP.height + 4 * BA_DAN_APRON_DEPTH) * 64,
  height: (BA_DAN_APRON_MAP.width + BA_DAN_APRON_MAP.height + 4 * BA_DAN_APRON_DEPTH) * 32,
} as const;
/**
 * The ring ships as bands, not as one plate: its bounding box is 3200 pixels
 * wide against the 2048-pixel texture the device matrix promises, and 84.8% of
 * it is clear. These are the ring's pixels, in plate coordinates, from
 * `scripts/art/lib/apron-bands.ts`; the packer cuts the same rectangles, and
 * `scripts/art/apron-plates.test.ts` pins the table, the cut and the shipped
 * files together.
 */
export const BA_DAN_APRON_BANDS = [
  { x: 1024, y: 0, width: 640, height: 160 },
  { x: 512, y: 160, width: 832, height: 256 },
  { x: 1344, y: 160, width: 832, height: 256 },
  { x: 0, y: 416, width: 832, height: 256 },
  { x: 1856, y: 416, width: 832, height: 256 },
  { x: 0, y: 672, width: 832, height: 256 },
  { x: 2368, y: 672, width: 832, height: 256 },
  { x: 512, y: 928, width: 832, height: 256 },
  { x: 2368, y: 928, width: 832, height: 256 },
  { x: 1024, y: 1184, width: 832, height: 256 },
  { x: 1856, y: 1184, width: 832, height: 256 },
  { x: 1536, y: 1440, width: 640, height: 160 },
] as const;
export const BA_DAN_APRON_PIECES: readonly SceneImage[] = BA_DAN_APRON_BANDS.map((band, index) => ({
  url: `${root}exterior-apron-${index}.webp`,
  x: BA_DAN_EXTERIOR_APRON.x + band.x,
  y: BA_DAN_EXTERIOR_APRON.y + band.y,
  width: band.width,
  height: band.height,
}));

/**
 * The south and east frame: ground past the apron on the two near edges, ending in an irregular
 * tree line some five tiles out where the margin colour takes over. This is the world rectangle
 * its plate is drawn in (`scripts/art/ba-dan-exterior-apron.ts`, `packFrame`).
 */
export const BA_DAN_FRAME = { x: -384, y: 416, width: 3520, height: 1312 } as const;

/**
 * The frame ships as bands of one page, `exterior-frame.webp`: each is a rectangle of the plate
 * (plate pixels, from `scripts/art/ba-dan-exterior-apron.ts --plan`) and where it sits on the page.
 * The ring's twelve bands each cost an image; these cost one.
 */
export const BA_DAN_FRAME_BANDS: readonly {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly atlas: { readonly x: number; readonly y: number };
}[] = [
  { x: 42, y: 96, width: 610, height: 256, atlas: { x: 971, y: 374 } },
  { x: 2644, y: 352, width: 639, height: 272, atlas: { x: 2, y: 650 } },
  { x: 231, y: 352, width: 965, height: 272, atlas: { x: 2, y: 374 } },
  { x: 2228, y: 624, width: 817, height: 208, atlas: { x: 645, y: 862 } },
  { x: 732, y: 624, width: 880, height: 208, atlas: { x: 645, y: 650 } },
  { x: 1172, y: 832, width: 1509, height: 368, atlas: { x: 2, y: 2 } },
];
export const BA_DAN_FRAME_PIECES: readonly SceneImage[] = BA_DAN_FRAME_BANDS.map((band) => ({
  url: `${root}exterior-frame.webp`,
  sourceRect: { x: band.atlas.x, y: band.atlas.y, width: band.width, height: band.height },
  x: BA_DAN_FRAME.x + band.x,
  y: BA_DAN_FRAME.y + band.y,
  width: band.width,
  height: band.height,
}));

/**
 * The edge pond (`scripts/art/ba-dan-edges.ts`) uses the same fieldstone and
 * water vocabulary as the courtyard canal.
 *
 * - **The west ford.** The road's last two cells, (0,7) and (0,8), are `W`:
 *   the road runs down into standing water that carries on west past the rim
 *   into the apron's fade, over a line of drowned stepping stones.
 * The pond is painted fieldstone water (`scripts/art/ba-dan-water.ts`) with
 * nothing baked over it. It is painted after the apron and fades with it past
 * the rim. The connected canal reuses the page's continuous channel artwork;
 * `paintedWaterCells` keeps the runtime film off its permanent `~` cells.
 */
export const BA_DAN_FORD_CELLS: readonly Vec2[] = [-2, -1, 0].flatMap((x) => [
  { x, y: 7 },
  { x, y: 8 },
]);
/**
 * Each edge piece's world rectangle, its cells' kerb envelope on the texel
 * lattice, and where it sits on the one page both ship on (`source`): the
 * village already asks for all but two of `SCENE_IMAGE_CAP`'s images.
 */
export const BA_DAN_EDGE_WATER = [
  {
    id: 'west-ford',
    cells: BA_DAN_FORD_CELLS,
    x: 288,
    y: 144,
    width: 384,
    height: 192,
    source: { x: 0, y: 508 },
  },
] as const;

const SURROUND_ATLAS = `${root}village-surround.webp`;
/** The two far tree masses behind the wall (the wall itself is the dressing atlas's strips). */
export const BA_DAN_SURROUND_MODULES = {
  'north-backdrop-run': { x: 0, y: 0, width: 912, height: 640 },
  'west-backdrop-run': { x: 912, y: 0, width: 912, height: 640 },
} as const;

/**
 * Long decorative runs beyond the two far edges: [id, run, tile x, y it starts on, x offset].
 * The north and west backdrops meet above (0,0); the west one stops north of canal row 6 and
 * resumes at row 9, leaving the canal and flooded ford (rows 6..8) open while its deep foliage
 * continues behind them. East and south are near edges and receive none.
 */
export const BA_DAN_SURROUND = [
  ['north-backdrop-west', 'north', -2, -2, 0],
  ['north-backdrop-east', 'north', 12, -2, 0],
  ['west-backdrop-north', 'west', -2, -2, -660],
  ['west-backdrop-south', 'west', -2, 9, -660],
] as const;

function surroundPiece([id, run, x, y, dx]: (typeof BA_DAN_SURROUND)[number]): SceneScenery {
  const source = BA_DAN_SURROUND_MODULES[`${run}-backdrop-run`];
  return {
    id,
    url: SURROUND_ATLAS,
    sourceRect: source,
    x: 1024 + (x - y) * 64 - 128 + dx,
    y: (x + y + 1) * 32 - 230,
    width: source.width,
    height: source.height,
    footprint: [{ x, y }],
    // Both backends sort upright scenery by projected x + y. Backdrops must
    // be strictly earlier than the wall strips (-100) so no foliage can ever paint
    // over the wall face or coping; both sentinels remain behind map scenery.
    depth: { x: -101, y: -101 },
    exterior: true,
    contactShadow: false,
  };
}

/**
 * The true-geometry painted pieces (`art/source/ba-dan-true/`, packed by
 * `scripts/art/ba-dan-true-pieces.ts`): each canvas was drawn in the map's exact projection
 * at 1.5 image pixels per world pixel, so it is drawn at 2/3 of its pixel size, placed with
 * its anchor, the canvas pixel of its footprint's front (x + w, y + d) corner, on that
 * corner's ground point. They opt out of the runtime's footprint contact ring (a whole-tile
 * box: a grey mat under a table's open legs, a hard rim round a planter); their contact is
 * baked into the ground from the guide's exact foot rectangles (`ba-dan-village-light.ts`).
 * Each entry is [source width, height, footprint depth] (every piece is 96 px a footprint tile
 * and a 30 px margin wide, its front corner 15 px up from the foot, so the anchor and the
 * footprint width follow); the set dressing and the terrace planter add the rectangle they occupy
 * in `true-dressing.webp`; the wall strips have an atlas of their own, `true-walls.webp` (the
 * scene may ask for only 40 distinct images, and it asks for 39).
 */
const S = 2 / 3;
const BAKED_CONTACT = { contactShadow: false } as const;
const SPECS = {
  'dwelling-4x3': [702, 576, 3],
  'merchant-house-4x3': [702, 576, 3],
  'dwelling-4x4': [798, 624, 4],
  'merchant-house-4x4': [798, 624, 4],
  'merchant-display': [318, 222, 1],
  'merchant-display-b': [318, 242, 1],
  'merchant-display-c': [318, 244, 1],
  'low-planter': [318, 212, 1],
  'low-planter-1x2': [318, 212, 2],
  'canal-bridge': [414, 236, 3],
  'village-well': [222, 269, 1, 1058, 2],
  'banner-pole': [222, 291, 1, 322, 2],
  'lantern-post': [222, 250, 1, 1506, 2],
  'shop-stack': [222, 162, 1, 2, 548],
  baskets: [222, 141, 1, 226, 548],
  'laundry-line': [318, 296, 1, 2, 2],
  'notice-board': [222, 263, 1, 1282, 2],
  handcart: [414, 224, 1, 642, 300],
  'bench-2x1': [318, 243, 1, 322, 300],
  'garden-plot-3x2': [510, 272, 2, 546, 2],
  'stone-lantern': [222, 205, 1, 1378, 300],
  'trough-hay': [318, 246, 1, 2, 300],
  'fence-2x1': [318, 200, 1, 1602, 300],
  'terrace-planter-2x1': [318, 212, 1, 1058, 300],
} as const;
type TruePiece = keyof typeof SPECS;
type Pair = readonly [number, number];
export const BA_DAN_TRUE_PIECES = Object.fromEntries(
  Object.entries(SPECS).map(([k, [w, h, d, sx, sy]]) => [
    k,
    {
      width: w * S,
      height: h * S,
      anchor: [(w - 15 - 96 * d) * S, (h - 15) * S],
      footprint: [(w - 30) / 96 - d, d],
      ...(sx === undefined ? {} : { source: { x: sx, y: sy, width: w, height: h } }),
    },
  ]),
) as unknown as Record<
  TruePiece,
  {
    width: number;
    height: number;
    anchor: Pair;
    footprint: Pair;
    source?: { x: number; y: number; width: number; height: number };
  }
>;

/** A true piece on its footprint's origin tile (x, y), unscaled. */
function place(image: TruePiece, x: number, y: number) {
  const { width, height, anchor, footprint } = BA_DAN_TRUE_PIECES[image];
  const gx = x + footprint[0];
  const gy = y + footprint[1];
  return {
    x: 1024 + (gx - gy) * 64 - anchor[0],
    y: (gx + gy) * 32 - anchor[1],
    width,
    height,
  };
}

/** Two canopy wings frame the market court; only their trunks block walking. */
export const BA_DAN_COURT_TREES = [
  { x: 5, y: 5 },
  { x: 21, y: 2 },
] as const;

/**
 * Gameplay applies these same footprints as low, solid courtyard boundaries. The tables
 * stand clear of the plinths they used to hug; the north garden planter's rim stays off
 * the plinth's front corner beside the steps.
 */
export const BA_DAN_COURTYARD_PROPS = [
  { id: 'west-planter', image: 'low-planter', x: 10, y: 10 },
  { id: 'gao-display', image: 'merchant-display', x: 6, y: 5 },
  { id: 'north-garden', image: 'low-planter', x: 17, y: 4 },
  { id: 'north-market-display', image: 'merchant-display-b', x: 14, y: 5 },
  { id: 'south-market-display', image: 'merchant-display-c', x: 3, y: 9 },
] as const;

export const BA_DAN_COURTYARD_FOOTPRINTS: readonly Vec2[] = BA_DAN_COURTYARD_PROPS.flatMap(
  ({ x, y }) => [
    { x, y },
    { x: x + 1, y },
  ],
);

interface CourtyardProp {
  readonly id: string;
  readonly image: TruePiece;
  readonly x: number;
  readonly y: number;
}

const DRESSING_ATLAS = `${root}true-dressing.webp`;
/** Where a true piece's pixels are: its own file, or its rectangle of the dressing atlas. */
function source(image: TruePiece) {
  const rect = BA_DAN_TRUE_PIECES[image].source;
  return rect ? { url: DRESSING_ATLAS, sourceRect: rect } : { url: `${root}true-${image}.webp` };
}

function courtyardProp({ id, image, x, y }: CourtyardProp): SceneScenery {
  return {
    id,
    ...source(image),
    ...place(image, x, y),
    footprint: [
      { x, y },
      { x: x + 1, y },
    ],
    depth: { x: x + 1.5, y: y + 0.5 },
    ...BAKED_CONTACT,
  };
}

/**
 * The north edge band: a dry-stone tea terrace one cell outside the rim, so the
 * planter-backed rim x4..15 meets a wall. (16,-1) and (17,-1) show bare lawn.
 * It is the back edge: everyone stands in front of it.
 */
export const BA_DAN_NORTH_TERRACE: readonly CourtyardProp[] = Array.from(
  { length: 6 },
  (_, index) => ({
    id: `north-terrace-${index}`,
    image: 'terrace-planter-2x1',
    x: 4 + 2 * index,
    y: -1,
  }),
);

function terracePiece(piece: CourtyardProp): SceneScenery {
  return { ...courtyardProp(piece), exterior: true };
}

/**
 * Set dressing: [piece, x, y] (the scenery id is `d` and its index) at the footprint's origin tile. Each piece blocks the
 * cells of its footprint (`village.ts` makes them `l`), all of them lawn margins, corners and
 * bank edges; the main road rows, the paved square and the bridge approach stay open, which
 * `baDan.test.ts` holds. Depth is the footprint's front cell, as the courtyard props have it.
 */
export const BA_DAN_DRESSING = [
  ['village-well', 12, 13],
  ['baskets', 2, 9],
  ['baskets', 14, 6],
  ['banner-pole', 11, 2],
  ['banner-pole', 18, 10],
  ['lantern-post', 16, 9],
  ['lantern-post', 20, 6],
  ['lantern-post', 20, 9],
  ['shop-stack', 10, 2],
  ['laundry-line', 17, 2],
  ['notice-board', 18, 6],
  ['handcart', 19, 4],
  ['bench-2x1', 3, 5],
  ['fence-2x1', 1, 5],
  ['garden-plot-3x2', 2, 10],
  ['stone-lantern', 5, 11],
  ['trough-hay', 19, 10],
] as const;

/** The cells of an `x`-by-`y` footprint at (`x`, `y`). */
function cells(image: TruePiece, x: number, y: number): Vec2[] {
  const [w, d] = BA_DAN_TRUE_PIECES[image].footprint;
  return Array.from({ length: w * d }, (_, i) => ({ x: x + (i % w), y: y + Math.floor(i / w) }));
}

export const BA_DAN_DRESSING_FOOTPRINTS: readonly Vec2[] = BA_DAN_DRESSING.flatMap(
  ([image, x, y]) => cells(image, x, y),
);

function dressingPiece([image, x, y]: (typeof BA_DAN_DRESSING)[number], i: number): SceneScenery {
  const [w, d] = BA_DAN_TRUE_PIECES[image].footprint;
  return {
    id: `d${i}`,
    ...source(image),
    ...place(image, x, y),
    footprint: cells(image, x, y),
    depth: { x: x + w - 0.5, y: y + d - 0.5 },
    ...BAKED_CONTACT,
  };
}

/**
 * The boundary wall, laid from painted modules (`ba-dan-guides/walls.py`) and drawn as strips of
 * two composed runs, at 1.5 source px per world px and drawn at 2/3 like every true piece:
 * [atlas x, y, source width, height, world x, y]. Behind everything (depth -100, in front of
 * the backdrops at -101); each stands on the corner tile outside the map.
 */
const WALL_STRIPS = [
  [1551, 592, 396, 327, 536, -56],
  [1608, 2, 390, 354, 800, -190],
  [2, 2, 801, 588, 1060, -172],
  [805, 2, 801, 552, 1594, 118],
  [2, 592, 804, 531, 2128, 384],
  [808, 592, 741, 501, -104, 148],
] as const;

function wallStrip([sx, sy, width, height, x, y]: (typeof WALL_STRIPS)[number], i: number) {
  return {
    id: `wall-${i}`,
    url: `${root}true-walls.webp`,
    sourceRect: { x: sx, y: sy, width, height },
    x,
    y,
    width: width * S,
    height: height * S,
    footprint: [{ x: -2, y: -2 }],
    depth: { x: -100, y: -100 },
    exterior: true,
    contactShadow: false as const,
  };
}

/**
 * The south-east house's blocked strip (17,10)..(17,11) is the courtyard planter,
 * mirrored and split in two depth slices so a unit at (18,10) stands in front of
 * the far end; the cut sits at the house image's east edge, where nothing of
 * the house is over it.
 */
export const BA_DAN_SOUTHEAST_PLANTER = [
  { x: 17, y: 10 },
  { x: 17, y: 11 },
] as const;

/** The turned planter is the 1x2 true piece: a single slice, depth at its far cell. */
function turnedPlanter(): SceneScenery[] {
  const { x, y } = BA_DAN_SOUTHEAST_PLANTER[0];
  return [
    {
      id: 'southeast-planter',
      url: `${root}true-low-planter-1x2.webp`,
      ...place('low-planter-1x2', x, y),
      footprint: [...BA_DAN_SOUTHEAST_PLANTER],
      depth: { x: x + 0.5, y: y + 1.5 },
      ...BAKED_CONTACT,
    },
  ];
}

/** Low crossing over the canal's dry centre, split at the near rail so actors
 * can stand on the deck instead of disappearing behind one opaque sprite. */
function canalBridge(): SceneScenery[] {
  const { x, y } = BA_DAN_CANAL_BRIDGE;
  // One tile wide over the canal's column; the abutments reach the banks.
  const image = place('canal-bridge', x, y - 1);
  return [
    {
      id: 'canal-bridge',
      url: `${root}true-canal-bridge.webp`,
      ...image,
      footprint: [BA_DAN_CANAL_BRIDGE],
      depth: { x: x + 0.5, y: y + 0.25 },
      ...BAKED_CONTACT,
    },
    {
      id: 'canal-bridge-front',
      url: `${root}true-canal-bridge-front.webp`,
      ...image,
      // Keep the schema's scenery footprint contract on both depth slices;
      // the map tile remains the sole collision authority.
      footprint: [BA_DAN_CANAL_BRIDGE],
      depth: { x: x + 0.5, y: y + 0.75 },
      ...BAKED_CONTACT,
    },
  ];
}

function courtyardGround(): SceneImage {
  return {
    url: `${root}courtyard-ground.webp`,
    ...BA_DAN_COURTYARD_GROUND,
  };
}

function westernApproachGround(): SceneImage {
  return {
    url: `${root}western-approach-ground.webp`,
    ...BA_DAN_WESTERN_APPROACH_GROUND,
  };
}
function neighborhoodGround({
  id,
  ...frame
}: (typeof BA_DAN_NEIGHBORHOOD_GROUNDS)[number]): SceneImage {
  return { url: `${root}${id}-ground.webp`, ...frame };
}

function canalBanks(): SceneImage {
  return {
    // Reuse the continuous fieldstone channel already packed on the edge-water
    // page. The bridge paints over its centre; unlike the old two-pool plate,
    // the water itself continues beneath the deck.
    url: `${root}edge-water.webp`,
    // Use the whole authored channel so both stone-coped ends remain intact;
    // the modest fit from 1016x508 to this 13-cell envelope preserves its 2:1
    // ground projection.
    sourceRect: {
      x: 0,
      y: 0,
      width: 1016,
      height: 508,
    },
    ...BA_DAN_CANAL_BANKS,
  };
}

/** Complete upright house, its plinth set on the blocked footprint. */
function house(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  kind: 'merchant-house' | 'dwelling' = 'merchant-house',
): SceneScenery {
  const image = `${kind}-${w}x${h}` as TruePiece;
  const footprint: Vec2[] = [];
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) footprint.push({ x: col, y: row });
  }
  return {
    id,
    url: `${root}true-${image}.webp`,
    ...place(image, x, y),
    footprint,
    depth: { x: x + w - 0.5, y: y + h - 0.5 },
    fadeWhenOccluding: true,
    ...BAKED_CONTACT,
  };
}

const TREES_ATLAS = `${root}village-trees.webp`;
/** The native tree masters in `village-trees.webp`, drawn unscaled: [x, y, width, height, trunk column] of each. */
const MASTERS = [
  [904, 2, 420, 410, 214],
  [1506, 792, 320, 312, 172],
  [1358, 1471, 260, 254, 132],
  [1622, 1510, 150, 165, 78],
] as const;

/**
 * The rim's trees as a figure can walk behind them, nearest the back first: [cell x, y, master,
 * mirrored]. A tree stands on its cell, its trunk column on the cell's centre line and its roots a
 * crown's width over 28 below the cell's foot (`scripts/art/ba-dan-trees.ts` owns them all).
 * The court trees (5,5) and (21,2) and the two exterior canopies (26,16) and (27,5) are among them.
 */
const TREES = [
  [0, 6, 0, 0],
  [0, 9, 1, 1],
  [5, 5, 1, 0],
  [0, 10, 0, 0],
  [1, 14, 1, 1],
  [2, 15, 2, 1],
  [3, 15, 0, 0],
  [18, 0, 1, 0],
  [19, 0, 0, 0],
  [21, 2, 1, 0],
  [23, 3, 2, 0],
  [27, 5, 0, 0],
  [23, 11, 3, 0],
  [22, 14, 2, 0],
  [21, 15, 3, 0],
  [22, 15, 3, 1],
  [26, 16, 1, 0],
] as const;

/**
 * The trees nobody can walk behind, composited at pack time into one sprite each: [atlas x, y,
 * width, height, x, y, depth key, ...cells x, y]. A clump is the pixels its trees drew, drawn at
 * one depth (`ba-dan-trees.ts` proves no figure or piece of scenery changes order); its
 * footprint is the cells of its trees.
 */
const CLUMPS = [
  [1328, 2, 520, 406, 828, -268, 2, 0, 0, 1, 0, 0, 1, 2, 0, 1, 1, 3, 0],
  [1328, 412, 472, 376, 556, -172, 4, 0, 2, 0, 3, 0, 4, 0, 5],
  [2, 506, 516, 496, -64, 54, 13, 0, 11, 0, 12, 0, 13, 0, 14, 0, 15, 1, 15],
  [522, 502, 456, 410, 2172, 428, 23, 20, 0, 21, 0, 22, 0, 22, 1, 23, 0, 23, 1, 23, 2],
  [1622, 1108, 220, 197, 2098, 737, 28, 23, 4, 23, 5],
  [2, 1006, 594, 425, 1596, 801, 36, 23, 6, 23, 9, 23, 10],
  [1622, 1309, 220, 197, 1586, 993, 36, 23, 12, 23, 13],
  [1080, 1471, 274, 282, 1458, 972, 37, 23, 14, 23, 15],
  [480, 2, 420, 496, -366, 230, 22, -1, 17, 0, 18, 1, 20],
  [600, 916, 372, 354, -244, 452, 25, 2, 20, 3, 19, 4, 20],
  [1080, 1170, 456, 297, 92, 689, 30, 6, 19, 8, 20, 10, 19],
  [600, 1274, 476, 338, 434, 852, 37, 12, 20, 14, 20, 16, 19],
  [982, 416, 332, 336, 2516, 636, 29, 25, -1, 26, 0, 27, 1],
  [2, 2, 474, 500, 2332, 614, 33, 26, 4, 27, 3, 28, 5],
  [982, 792, 520, 374, 1632, 1060, 44, 27, 11, 27, 12, 27, 14, 28, 13, 27, 16],
  [2, 1435, 556, 312, 1268, 1220, 47, 28, 17, 26, 20, 27, 19],
] as const;

const treeBase = {
  url: TREES_ATLAS,
  fadeWhenOccluding: true,
  // Not the runtime's whole-tile footprint ring: the bake seats each trunk with a soft
  // round shade at its drawn root (`treeOcclusion` in `scripts/art/ba-dan-village-light.ts`).
  contactShadow: false as const,
};

function tree([x, y, m, flip]: (typeof TREES)[number]): SceneScenery {
  const [sx, sy, width, height, trunk] = MASTERS[m];
  return {
    ...treeBase,
    id: `tree-${x}-${y}`,
    sourceRect: { x: sx, y: sy, width, height },
    x: 1024 + (x - y) * 64 - (flip ? width - trunk : trunk),
    y: (x + y + 1) * 32 + Math.round(width / 28) - height + 1,
    width,
    height,
    footprint: [{ x, y }],
    depth: { x, y },
    ...(x > 23 || y > 15 ? { exterior: true } : {}),
    ...(flip ? { flip: true } : {}),
  };
}

function clump(
  [sx, sy, width, height, x, y, key, ...at]: (typeof CLUMPS)[number],
  i: number,
): SceneScenery {
  const footprint = Array.from({ length: at.length / 2 }, (_, k) => ({
    x: at[2 * k]!,
    y: at[2 * k + 1]!,
  }));
  return {
    ...treeBase,
    id: `tree-c${i}`,
    sourceRect: { x: sx, y: sy, width, height },
    x,
    y,
    width,
    height,
    footprint,
    depth: { x: key, y: 0 },
    // The frame's clumps stand wholly outside the board, like the two exterior canopies.
    ...(footprint.every((c) => c.x < 0 || c.y < 0 || c.x > 23 || c.y > 15)
      ? { exterior: true }
      : {}),
  };
}

const NORTH_HOUSE = house('north-house', 12, 1, 4, 3, 'dwelling');
const SOUTHWEST_HOUSE = house('southwest-house', 6, 10, 4, 4, 'dwelling');

/**
 * The dwellings have no painted chimney: a cooking fire's smoke leaves by a vent in the ridge
 * tiles, halfway along the main ridge, so the wisp starts on the roof and not at the ridge end
 * over the paving behind. Mira's house and Pella's household's. Each is the ground point the
 * oblique camera draws under the ridge (z 178, a little under the v3 ridge line at 186), at
 * x = w - 1.3 of the footprint (a body 1.7 tiles deep ending 0.45 short of the +x edge) and
 * halfway along y: `(rx + ry) * 32 - 178` as `y / 64 +- (screen x) / 128`.
 */
export const BA_DAN_CHIMNEYS: readonly Vec2[] = [
  { x: 11.91875, y: -0.28125 },
  { x: 5.91875, y: 9.21875 },
];

/** Calibrated projected pixels; textures are already painted in the target camera. */
export const BA_DAN_SCENE: MapScene = {
  marginTone: 'verdant',
  chimneys: BA_DAN_CHIMNEYS,
  groundMode: 'partial',
  // The plates carry the pools, so the film stays off them; ice or charge still draw.
  paintedWaterCells: BA_DAN_WATER_CELLS,
  ground: [
    ...BA_DAN_GARDEN_PLATES.map((plate, index) => ({
      url: `${root}garden-${index}.webp`,
      ...plate,
    })),
    westernApproachGround(),
    courtyardGround(),
    ...BA_DAN_NEIGHBORHOOD_GROUNDS.map(neighborhoodGround),
    {
      url: `${root}north-grass-fringe.webp`,
      x: 1024 + (BA_DAN_NORTH_FRINGE.x - BA_DAN_NORTH_FRINGE.y - BA_DAN_NORTH_FRINGE.depth) * 64,
      y: (BA_DAN_NORTH_FRINGE.x + BA_DAN_NORTH_FRINGE.y) * 32,
      width: (BA_DAN_NORTH_FRINGE.width + BA_DAN_NORTH_FRINGE.depth) * 64,
      height: ((BA_DAN_NORTH_FRINGE.width + BA_DAN_NORTH_FRINGE.depth) * 64 * 267) / 512,
    },
    canalBanks(),
    // Painted last: transparent everywhere the board can be walked.
    ...BA_DAN_APRON_PIECES,
    ...BA_DAN_FRAME_PIECES,
    // Over the apron, since the pond runs on past the rim into its fade.
    ...BA_DAN_EDGE_WATER.map(({ x, y, width, height, source }) => ({
      url: `${root}edge-water.webp`,
      sourceRect: { ...source, width, height },
      x,
      y,
      width,
      height,
    })),
  ],
  scenery: [
    ...BA_DAN_SURROUND.map(surroundPiece),
    ...WALL_STRIPS.map(wallStrip),
    house('gao-house', 6, 1, 4, 3),
    NORTH_HOUSE,
    SOUTHWEST_HOUSE,
    house('southeast-house', 13, 10, 4, 4),
    ...canalBridge(),
    // Equal-depth frontage must paint after the building behind it.
    ...BA_DAN_COURTYARD_PROPS.map(courtyardProp),
    ...turnedPlanter(),
    ...BA_DAN_NORTH_TERRACE.map(terracePiece),
    ...BA_DAN_DRESSING.map(dressingPiece),
    ...TREES.map(tree),
    ...CLUMPS.map(clump),
  ].map((piece) => ({ ...piece, castShadow: false })),
};
