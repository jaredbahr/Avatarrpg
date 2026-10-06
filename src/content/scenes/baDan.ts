import type { MapScene, SceneImage, SceneScenery, Vec2 } from '../../core/types';

const root = 'art/maps/ba-dan-scene/';
/** The registered projected envelope for the canal from the west pond to the courtyard. */
export const BA_DAN_CANAL = { x: 0, y: 6, width: 13, height: 1 } as const;
/** Permanent water cells; the bridge deck at x9 carries the paved crossing over the flow. */
export const BA_DAN_WATER_CELLS = [
  { x: 0, y: 6 },
  { x: 1, y: 6 },
  { x: 2, y: 6 },
  { x: 3, y: 6 },
  { x: 4, y: 6 },
  { x: 5, y: 6 },
  { x: 6, y: 6 },
  { x: 7, y: 6 },
  { x: 8, y: 6 },
  { x: 10, y: 6 },
  { x: 11, y: 6 },
  { x: 12, y: 6 },
] as const;
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
/** Outer metric radius of the transparent coping around runtime water. */
export const BA_DAN_CANAL_BANK_RADIUS = 1.42;
/** Transparent coping envelope around the west-fed runtime watercourse. */
export const BA_DAN_CANAL_BANKS = { x: 544, y: 176, width: 960, height: 480 } as const;

/**
 * The village does not end where the rules stop. This apron carries the ground
 * that borders the rim back out into the page — the same grass the procedural
 * cells paint, continued a little way where the map's outer cell is road or
 * paving — and fades to nothing before the camera can follow it further.
 * `village.ts` owns the authoritative size; `baDan.test.ts` pins them together.
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
/** Ground-plane centres of the ford's drowned stepping stones, west from the road's end. */
export const BA_DAN_FORD_STONES: readonly Vec2[] = [
  { x: 0.6, y: 7.55 },
  { x: 0.05, y: 8.2 },
  { x: -0.55, y: 7.6 },
  { x: -1.15, y: 8.25 },
  { x: -1.75, y: 7.65 },
];
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
export const BA_DAN_EDGE_WATER_PAGE = { width: 1016, height: 700 } as const;

/**
 * Pixel size of each upright texture. They are pixel-art redraws at two
 * screen pixels a texel, shipped nearest-upscaled by a whole number
 * (`scripts/art/ba-dan-restyle.ts`), so the pieces keep their world widths
 * and take their heights from these aspects. `ba-dan-restyle.test.ts` pins
 * the table to the shipped files.
 */
export const BA_DAN_TEXTURES = {
  'merchant-house': { width: 610, height: 390 },
  dwelling: { width: 602, height: 388 },
  'merchant-display': { width: 452, height: 284 },
  'low-planter': { width: 448, height: 248 },
  'village-tree': { width: 750, height: 732 },
  'canal-bridge': { width: 436, height: 272 },
} as const;
type BaDanTexture = keyof typeof BA_DAN_TEXTURES;

/** World height of a texture drawn `width` wide. */
function aspectHeight(image: BaDanTexture, width: number): number {
  const natural = BA_DAN_TEXTURES[image];
  return (width * natural.height) / natural.width;
}

/**
 * Two canopy wings frame the market court; only their trunks block walking.
 * The east tree stands out on the lawn toward the wooded rim: at (17,5) its
 * broad crown covered the north-market display, the south-east house front,
 * and both gate-watch anchors at (16,6)/(17,6).
 */
export const BA_DAN_COURT_TREES = [
  { x: 5, y: 5 },
  { x: 21, y: 2 },
] as const;

/** Gameplay applies these same footprints as low, solid courtyard boundaries. */
export const BA_DAN_COURTYARD_PROPS = [
  { id: 'west-planter', image: 'low-planter', x: 10, y: 10 },
  { id: 'east-planter', image: 'low-planter', x: 14, y: 9 },
  { id: 'gao-display', image: 'merchant-display', x: 7, y: 4 },
  { id: 'north-garden', image: 'low-planter', x: 16, y: 4 },
  { id: 'north-market-display', image: 'merchant-display', x: 13, y: 4 },
  { id: 'south-market-display', image: 'merchant-display', x: 4, y: 9 },
  { id: 'southwest-garden', image: 'low-planter', x: 6, y: 9 },
] as const;

export const BA_DAN_COURTYARD_FOOTPRINTS: readonly Vec2[] = BA_DAN_COURTYARD_PROPS.flatMap(
  ({ x, y }) => [
    { x, y },
    { x: x + 1, y },
  ],
);

interface CourtyardProp {
  readonly id: string;
  readonly image: 'low-planter' | 'merchant-display';
  readonly x: number;
  readonly y: number;
}

function courtyardProp({ id, image, x, y }: CourtyardProp): SceneScenery {
  const width = 192;
  const height = aspectHeight(image, width);
  const frontAnchor = image === 'low-planter' ? 0.675 : 0.695;
  const front = { x: x + 2, y: y + 1 };
  return {
    id,
    url: `${root}${image}.webp`,
    x: 1024 + (front.x - front.y) * 64 - width * frontAnchor,
    y: (front.x + front.y) * 32 - height,
    width,
    height,
    footprint: [
      { x, y },
      { x: x + 1, y },
    ],
    depth: { x: x + 1.5, y: y + 0.5 },
  };
}

/**
 * The north edge band (`BA_DAN_VILLAGE.edges`): the lawn along row 0 ends at a
 * dry-stone tea terrace just outside the rim, the courtyard's own planter —
 * laid stone round a bed of bushes — set end to end in a row one cell out, so
 * the planter-backed rim x4..15 meets a wall rather than a stretch of lawn
 * that stops. Tiles (16,-1) and (17,-1) deliberately show bare apron lawn.
 * It is the back edge: everyone on the board stands in front of it.
 */
export const BA_DAN_NORTH_TERRACE: readonly CourtyardProp[] = Array.from(
  { length: 6 },
  (_, index) => ({ id: `north-terrace-${index}`, image: 'low-planter', x: 4 + 2 * index, y: -1 }),
);

function terracePiece(piece: CourtyardProp): SceneScenery {
  return { ...courtyardProp(piece), exterior: true };
}

/**
 * The south-east house is drawn over x 13..16, but `rows` blocks its footprint
 * out to (17,10) and (17,11), a paved strip that read as open ground. The
 * courtyard's own low planter stands on it, mirrored so its long side runs
 * along y. Its depth ties the house (x + y = 30) and it is listed after it, so
 * it paints in front of the plinth like the rest of the frontage.
 *
 * Like the canal bridge it is two depth slices. The far end, on (17,10), sorts
 * one row shallower, so someone standing east of it at (18,10) is level with
 * it and stands in front, instead of behind the whole planter. The cut is not
 * at the cells' join, (18,11): the house's awning post comes down behind the
 * planter there, and a slice shallower than the house would sort under it.
 * It is at the house image's east edge, so nothing of the house is over it.
 */
export const BA_DAN_SOUTHEAST_PLANTER = [
  { x: 17, y: 10 },
  { x: 17, y: 11 },
] as const;

/**
 * The far slice's width in texture columns of the unmirrored planter: the
 * widest cut whose slice still starts at or past the house image's east edge.
 */
export const BA_DAN_PLANTER_CUT = 71;

function turnedPlanter(): SceneScenery[] {
  const natural = BA_DAN_TEXTURES['low-planter'];
  const width = 192;
  const height = (width * natural.height) / natural.width;
  const front = { x: 18, y: 12 };
  // Mirrored, the front corner sits the other side of centre.
  const x = 1024 + (front.x - front.y) * 64 - width * (1 - 0.675);
  // Mirrored, the texture's left columns draw at the box's right.
  const far = (BA_DAN_PLANTER_CUT * width) / natural.width;
  const piece = {
    url: `${root}low-planter.webp`,
    y: (front.x + front.y) * 32 - height,
    height,
    footprint: [...BA_DAN_SOUTHEAST_PLANTER],
    flip: true,
  };
  // The near slice reaches one texel past the cut and paints over the far
  // one there, so the join never shows a hairline of the ground between.
  const overlap = width / natural.width;
  return [
    {
      ...piece,
      id: 'southeast-planter',
      x,
      width: width - far + overlap,
      sourceRect: {
        x: BA_DAN_PLANTER_CUT - 1,
        y: 0,
        width: natural.width - BA_DAN_PLANTER_CUT + 1,
        height: natural.height,
      },
      depth: { x: 17.5, y: 12.5 },
    },
    {
      ...piece,
      id: 'southeast-planter-far',
      x: x + width - far,
      width: far,
      sourceRect: { x: 0, y: 0, width: BA_DAN_PLANTER_CUT, height: natural.height },
      depth: { x: 17.5, y: 11.5 },
    },
  ];
}

/** Low crossing over the canal's dry centre, split at the near rail so actors
 * can stand on the deck instead of disappearing behind one opaque sprite. */
function canalBridge(): SceneScenery[] {
  const width = 192;
  const height = aspectHeight('canal-bridge', width);
  const { x, y } = BA_DAN_CANAL_BRIDGE;
  const image = {
    // The isolated bridge art is a crossing centred on its logical road
    // diamond. Keep the deck centre on (9,6); anchoring to its lower edge
    // leaves most of the deck floating over the upstream water.
    x: 1024 + (x - y) * 64 - width * 0.5,
    y: (x + y + 1) * 32 - height * 0.5,
    width,
    height,
  } as const;
  return [
    {
      id: 'canal-bridge',
      url: `${root}canal-bridge.webp`,
      ...image,
      footprint: [BA_DAN_CANAL_BRIDGE],
      depth: { x: x + 0.5, y: y + 0.25 },
    },
    {
      id: 'canal-bridge-front',
      url: `${root}canal-bridge-front.webp`,
      ...image,
      // Keep the schema's scenery footprint contract on both depth slices;
      // the map tile remains the sole collision authority.
      footprint: [BA_DAN_CANAL_BRIDGE],
      depth: { x: x + 0.5, y: y + 0.75 },
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

/** Complete upright house: source foundation's foremost corner is at 43.2%, 99.5%. */
function house(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  image: 'merchant-house' | 'dwelling' = 'merchant-house',
): SceneScenery {
  const width = (w + h) * 64;
  const height = aspectHeight(image, width);
  const front = { x: x + w, y: y + h };
  const footprint: Vec2[] = [];
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) footprint.push({ x: col, y: row });
  }
  return {
    id,
    url: `${root}${image}.webp`,
    x: 1024 + (front.x - front.y) * 64 - width * 0.432,
    y: (front.x + front.y) * 32 - height * 0.995,
    width,
    height,
    footprint,
    depth: { x: front.x - 0.5, y: front.y - 0.5 },
    fadeWhenOccluding: true,
  };
}

function tree(x: number, y: number, size = 360, flip = false): SceneScenery {
  const height = aspectHeight('village-tree', size);
  return {
    id: `tree-${x}-${y}`,
    url: `${root}village-tree.webp`,
    // Mirrored, the trunk's centre (51% across) lands at 49%.
    x: 1024 + (x - y) * 64 - size * (flip ? 0.49 : 0.51),
    y: (x + y + 1) * 32 - height * 0.96,
    width: size,
    height,
    footprint: [{ x, y }],
    depth: { x, y },
    fadeWhenOccluding: true,
    ...(x < 0 || y < 0 || x >= BA_DAN_APRON_MAP.width || y >= BA_DAN_APRON_MAP.height
      ? { exterior: true }
      : {}),
    ...(flip ? { flip: true } : {}),
  };
}

/**
 * The full canopies the rim had before every trunk cell was drawn, less the
 * road-mouth crowns at (18,15) and (21,15).
 */
export const BA_DAN_RIM_CANOPIES = [
  { x: 0, y: 3, size: 360 },
  { x: 0, y: 6, size: 400 },
  { x: 0, y: 10, size: 420 },
  { x: 0, y: 13, size: 380 },
  { x: 3, y: 15, size: 400 },
  // The old (21,15) crown stood directly over the river-path mouth and is
  // deliberately absent. The smaller rim trunks still frame both shoulders.
  // Push the east-corner crowns into the exterior apron: at the old x=23
  // anchors their broad left wings buried the south-east frontage and sign.
  // In this projection a crown south-east of the east road draws over it, so
  // the two that stood in front of the road's last tiles are gone from there:
  // one closes the south-east corner instead, clear of the road's column.
  { x: 26, y: 16, size: 360 },
  { x: 27, y: 5, size: 400 },
  { x: 22, y: 1, size: 360 },
  { x: 19, y: 0, size: 380 },
] as const;

/**
 * Every other `T` on the rim was a tree the rules knew about and the picture
 * did not: lawn you could not walk onto. Each now stands a younger tree of
 * the same restyled piece, so the rim reads as woodland all the way round.
 * The back edges (north, west) take the taller ones; the front edges (east
 * and south, nearest the camera) stay small, so their canopies cover less
 * of the board, and alternate trees are mirrored so no two neighbours repeat.
 */
export const BA_DAN_RIM_TRUNKS = [
  // North, row 0, and the north-west and north-east corners.
  { x: 0, y: 0, size: 300 },
  { x: 1, y: 0, size: 260 },
  { x: 2, y: 0, size: 320 },
  { x: 3, y: 0, size: 280 },
  { x: 18, y: 0, size: 300 },
  { x: 20, y: 0, size: 280 },
  { x: 21, y: 0, size: 320 },
  { x: 22, y: 0, size: 260 },
  { x: 23, y: 0, size: 280 },
  { x: 0, y: 1, size: 280 },
  { x: 1, y: 1, size: 320 },
  { x: 23, y: 1, size: 250 },
  // West, x = 0.
  { x: 0, y: 2, size: 300 },
  { x: 0, y: 4, size: 280 },
  { x: 0, y: 5, size: 320 },
  { x: 0, y: 9, size: 300 },
  { x: 0, y: 11, size: 280 },
  { x: 0, y: 12, size: 320 },
  // East, x = 23: the front edge, nearest the camera. Saplings under the old
  // canopies, so the board's near quarter is not walled off.
  { x: 23, y: 2, size: 170 },
  { x: 23, y: 3, size: 150 },
  { x: 23, y: 4, size: 170 },
  { x: 23, y: 5, size: 150 },
  { x: 23, y: 6, size: 160 },
  { x: 23, y: 9, size: 150 },
  { x: 23, y: 10, size: 160 },
  { x: 23, y: 11, size: 170 },
  { x: 23, y: 12, size: 150 },
  { x: 23, y: 13, size: 150 },
  // South, rows 14 and 15: its west corner is a side, its east end the front.
  // (18..20,15) is the river path's mouth, so no tree stands there.
  { x: 0, y: 14, size: 280 },
  { x: 1, y: 14, size: 240 },
  { x: 22, y: 14, size: 160 },
  { x: 23, y: 14, size: 150 },
  { x: 0, y: 15, size: 260 },
  { x: 1, y: 15, size: 230 },
  { x: 2, y: 15, size: 260 },
  { x: 21, y: 15, size: 150 },
  { x: 22, y: 15, size: 160 },
  { x: 23, y: 15, size: 150 },
] as const;

const NORTH_HOUSE = house('north-house', 12, 1, 4, 3, 'dwelling');
const SOUTHWEST_HOUSE = house('southwest-house', 6, 10, 4, 4, 'dwelling');

/** The ground point the oblique camera draws under (u, v) of a house image. */
function roofPoint(piece: SceneScenery, u: number, v: number): Vec2 {
  const across = (piece.x + u * piece.width - 1024) / 64;
  const down = (piece.y + v * piece.height) / 64;
  return { x: down + across / 2, y: down - across / 2 };
}

/**
 * The dwellings have no painted chimney: a cooking fire's smoke leaves by a
 * vent in the ridge tiles, halfway along the main ridge, so the wisp starts
 * on the roof and not at the ridge end over the paving behind. Mira's house
 * and Pella's household's.
 */
export const BA_DAN_CHIMNEYS: readonly Vec2[] = [
  roofPoint(NORTH_HOUSE, 0.55, 0.19),
  roofPoint(SOUTHWEST_HOUSE, 0.55, 0.19),
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
    house('gao-house', 6, 1, 4, 3),
    NORTH_HOUSE,
    SOUTHWEST_HOUSE,
    house('southeast-house', 13, 10, 4, 4),
    ...canalBridge(),
    // Equal-depth frontage must paint after the building behind it.
    ...BA_DAN_COURTYARD_PROPS.map(courtyardProp),
    ...turnedPlanter(),
    ...BA_DAN_NORTH_TERRACE.map(terracePiece),
    ...BA_DAN_COURT_TREES.map(({ x, y }) => tree(x, y, 320)),
    ...BA_DAN_RIM_CANOPIES.map(({ x, y, size }) => tree(x, y, size)),
    ...BA_DAN_RIM_TRUNKS.map(({ x, y, size }) => tree(x, y, size, (x + y) % 2 === 1)),
  ],
};
