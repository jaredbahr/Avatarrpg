import type { MapScene, SceneScenery, Vec2 } from '../../core/types';

const root = 'art/maps/ba-dan-scene/';
export const BA_DAN_POND = { x: 10, y: 6, width: 3, height: 1 } as const;
/** Flat grass fringe across the northern lawn bay; both door approaches stay clear. */
export const BA_DAN_NORTH_FRINGE = { x: 10.05, y: 3.9, width: 1.9, depth: 0.2 } as const;

/** Gameplay applies these same footprints as low, solid courtyard boundaries. */
export const BA_DAN_COURTYARD_PROPS = [
  { id: 'west-planter', image: 'low-planter', x: 6, y: 5 },
  { id: 'east-planter', image: 'low-planter', x: 14, y: 9 },
  { id: 'gao-display', image: 'merchant-display', x: 7, y: 4 },
  { id: 'north-garden', image: 'low-planter', x: 16, y: 4 },
  { id: 'north-market-display', image: 'merchant-display', x: 13, y: 4 },
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
  paintedWater: true,
  ground: [
    { url: `${root}ground-west.webp`, x: -128, y: -192, width: 1408, height: 1536 },
    { url: `${root}ground-east.webp`, x: 1280, y: -192, width: 1408, height: 1536 },
    {
      url: `${root}north-grass-fringe.webp`,
      x: 1024 + (BA_DAN_NORTH_FRINGE.x - BA_DAN_NORTH_FRINGE.y - BA_DAN_NORTH_FRINGE.depth) * 64,
      y: (BA_DAN_NORTH_FRINGE.x + BA_DAN_NORTH_FRINGE.y) * 32,
      width: (BA_DAN_NORTH_FRINGE.width + BA_DAN_NORTH_FRINGE.depth) * 64,
      height: ((BA_DAN_NORTH_FRINGE.width + BA_DAN_NORTH_FRINGE.depth) * 64 * 267) / 512,
    },
    {
      url: `${root}pond.webp`,
      x: 1024 + (BA_DAN_POND.x - BA_DAN_POND.y - BA_DAN_POND.height) * 64,
      y: (BA_DAN_POND.x + BA_DAN_POND.y) * 32,
      width: (BA_DAN_POND.width + BA_DAN_POND.height) * 64,
      height: 132,
    },
  ],
  scenery: [
    house('gao-house', 6, 1, 4, 3),
    house('north-house', 12, 1, 4, 3, 'dwelling'),
    house('southwest-house', 6, 10, 4, 4, 'dwelling'),
    house('southeast-house', 13, 10, 4, 4),
    // Equal-depth frontage must paint after the building behind it.
    ...BA_DAN_COURTYARD_PROPS.map(courtyardProp),
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
