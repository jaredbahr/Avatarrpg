import type { MapScene, SceneImage, SceneScenery, Vec2 } from '../../core/types';

const root = 'art/maps/ba-dan-scene/';
/** The registered projected envelope for the central short canal. */
export const BA_DAN_CANAL = { x: 6, y: 6, width: 7, height: 1 } as const;
/** Permanent water cells; the paved bridge at x9 breaks the visual envelope. */
export const BA_DAN_WATER_CELLS = [
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
/** Outer metric radius of the transparent coping around runtime water. */
export const BA_DAN_CANAL_BANK_RADIUS = 1.42;
/** Transparent coping envelope around all six runtime water diamonds. */
export const BA_DAN_CANAL_BANKS = { x: 928, y: 368, width: 576, height: 288 } as const;

/** Two canopy wings frame the market court; only their trunks block walking. */
export const BA_DAN_COURT_TREES = [
  { x: 5, y: 5 },
  { x: 17, y: 5 },
] as const;

/** Gameplay applies these same footprints as low, solid courtyard boundaries. */
export const BA_DAN_COURTYARD_PROPS = [
  { id: 'west-planter', image: 'low-planter', x: 6, y: 5 },
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

function courtyardProp({ id, image, x, y }: (typeof BA_DAN_COURTYARD_PROPS)[number]): SceneScenery {
  const width = 192;
  const height = (width * (image === 'low-planter' ? 295 : 329)) / 512;
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

/** Low crossing over the canal's dry centre, split at the near rail so actors
 * can stand on the deck instead of disappearing behind one opaque sprite. */
function canalBridge(): SceneScenery[] {
  const width = 192;
  const height = (width * 323) / 512;
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

function canalBanks(): SceneImage {
  return {
    url: `${root}canal-banks.webp`,
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
  image = 'merchant-house',
): SceneScenery {
  const width = (w + h) * 64;
  const height = (width * (image === 'dwelling' ? 495 : 494)) / 768;
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

function tree(x: number, y: number, size = 360): SceneScenery {
  const height = (size * 765) / 768;
  return {
    id: `tree-${x}-${y}`,
    url: `${root}village-tree.webp`,
    x: 1024 + (x - y) * 64 - size * 0.51,
    y: (x + y + 1) * 32 - height * 0.96,
    width: size,
    height,
    footprint: [{ x, y }],
    depth: { x, y },
    fadeWhenOccluding: true,
  };
}

/** Calibrated projected pixels; textures are already painted in the target camera. */
export const BA_DAN_SCENE: MapScene = {
  groundMode: 'partial',
  ground: [
    courtyardGround(),
    {
      url: `${root}north-grass-fringe.webp`,
      x: 1024 + (BA_DAN_NORTH_FRINGE.x - BA_DAN_NORTH_FRINGE.y - BA_DAN_NORTH_FRINGE.depth) * 64,
      y: (BA_DAN_NORTH_FRINGE.x + BA_DAN_NORTH_FRINGE.y) * 32,
      width: (BA_DAN_NORTH_FRINGE.width + BA_DAN_NORTH_FRINGE.depth) * 64,
      height: ((BA_DAN_NORTH_FRINGE.width + BA_DAN_NORTH_FRINGE.depth) * 64 * 267) / 512,
    },
    canalBanks(),
  ],
  scenery: [
    house('gao-house', 6, 1, 4, 3),
    house('north-house', 12, 1, 4, 3, 'dwelling'),
    house('southwest-house', 6, 10, 4, 4, 'dwelling'),
    house('southeast-house', 13, 10, 4, 4),
    ...canalBridge(),
    // Equal-depth frontage must paint after the building behind it.
    ...BA_DAN_COURTYARD_PROPS.map(courtyardProp),
    ...BA_DAN_COURT_TREES.map(({ x, y }) => tree(x, y, 320)),
    tree(0, 3),
    tree(0, 6, 400),
    tree(0, 10, 420),
    tree(0, 13, 380),
    tree(3, 15, 400),
    tree(18, 15, 390),
    tree(21, 15, 420),
    tree(23, 12, 390),
    tree(23, 9, 420),
    tree(23, 5, 400),
    tree(22, 1, 360),
    tree(19, 0, 380),
  ],
};
