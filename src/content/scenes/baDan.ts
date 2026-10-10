import type { MapScene, SceneImage, SceneScenery, Vec2 } from '../../core/types';
import {
  BA_DAN_GROUND_PLATES,
  BA_DAN_PAINTING,
  BA_DAN_UPRIGHTS,
  BA_DAN_UPRIGHT_PAGES,
} from './baDan.art';

/**
 * Ba Dan is one continuous painting (`scripts/art/ba-dan-regions/`, `docs/art/ba-dan-scene.md`):
 * twelve region paintings stitched, cut on a regular grid into the ground plates, with the pieces a
 * figure can stand behind (the houses, the trees, the dressing) cut back out by their geometry as
 * uprights. The painting already holds the light, the cast shadow, the contact, the worn ground, the joins
 * between materials and the canal, so this scene asks the renderer for none of them. `baDan.art.ts` is
 * generated: where each plate and sprite is. This file is what the art does not say: what stands where,
 * what blocks, and the order figures and pieces sort in.
 */
const root = 'art/maps/ba-dan-scene/';
const { scale: PIXELS_PER_WORLD, origin, size } = BA_DAN_PAINTING;

/** The registered projected envelope for the canal from the west pond to the courtyard. */
export const BA_DAN_CANAL = { x: 0, y: 6, width: 13, height: 1 } as const;
/** Permanent water cells; the bridge deck at x9 carries the paved crossing over the flow. */
export const BA_DAN_WATER_CELLS: readonly Vec2[] = Array.from({ length: 13 }, (_, x) => x)
  .filter((x) => x !== 9)
  .map((x) => ({ x, y: 6 }));
export const BA_DAN_CANAL_BRIDGE = { x: 9, y: 6 } as const;

/** Footprint (width, depth) in tiles of each piece of dressing, the courtyard props and the houses. */
const FOOTPRINTS = {
  'dwelling-4x3': [4, 3],
  'merchant-house-4x3': [4, 3],
  'dwelling-4x4': [4, 4],
  'merchant-house-4x4': [4, 4],
  'merchant-display': [2, 1],
  'merchant-display-b': [2, 1],
  'merchant-display-c': [2, 1],
  'low-planter': [2, 1],
  'low-planter-1x2': [1, 2],
  'village-well': [1, 1],
  'banner-pole': [1, 1],
  'lantern-post': [1, 1],
  'shop-stack': [1, 1],
  baskets: [1, 1],
  'laundry-line': [2, 1],
  'notice-board': [1, 1],
  handcart: [3, 1],
  'bench-2x1': [2, 1],
  'garden-plot-3x2': [3, 2],
  'stone-lantern': [1, 1],
  'trough-hay': [2, 1],
  'fence-2x1': [2, 1],
} as const satisfies Record<string, readonly [number, number]>;
type Piece = keyof typeof FOOTPRINTS;

/** The cells of an `x`-by-`y` footprint at (`x`, `y`). */
function cells(image: Piece, x: number, y: number): Vec2[] {
  const [w, d] = FOOTPRINTS[image];
  return Array.from({ length: w * d }, (_, i) => ({ x: x + (i % w), y: y + Math.floor(i / w) }));
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
  { id: 'west-planter', image: 'low-planter', x: 11, y: 10 },
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

export const BA_DAN_DRESSING_FOOTPRINTS: readonly Vec2[] = BA_DAN_DRESSING.flatMap(
  ([image, x, y]) => cells(image, x, y),
);

/**
 * The south-east house's blocked strip (17,10)..(17,11) is the courtyard planter, turned: the
 * 1x2 piece, a single slice with its depth at its far cell.
 */
export const BA_DAN_SOUTHEAST_PLANTER = [
  { x: 17, y: 10 },
  { x: 17, y: 11 },
] as const;

/**
 * Smoke leaves each dwelling's brick chimney (Mira's house, and Pella's household's) at the middle of its
 * mouth, local (2.5, 0.7) of the footprint at z 208 and 200 (the guides' chimney tops, `houses.py`). Each is
 * the ground point the oblique camera draws under that mouth: `(rx + ry) * 32 - z` as
 * `y / 64 +- (screen x) / 128`, so x - y is the mouth's own and x + y is `rx + ry - z / 32`.
 */
export const BA_DAN_CHIMNEYS: readonly Vec2[] = [
  { x: 11.25, y: -1.55 },
  { x: 5.375, y: 7.575 },
];

/**
 * What stands in the village, in draw order, and how it sorts: the id (which names its sprite in
 * `baDan.art.ts`), the cells it occupies and its depth key (both backends sort by projected x + y;
 * a figure whose foot is level with a piece stands in front of it). Every piece the painting holds is
 * listed; a piece with no sprite is one no figure on a walkable cell can stand behind, so it is in the
 * ground plates only (`regions.py split`, `Village.needed`: the north terrace, the wall and the
 * backdrops beyond the board, and the rim's far canopies).
 */
export interface Standing {
  readonly id: string;
  readonly footprint: readonly Vec2[];
  readonly depth: Vec2;
  readonly fadeWhenOccluding?: true;
  readonly exterior?: true;
}

/**
 * Complete upright house, its plinth set on the blocked footprint, its yard in the same sprite. Both backends sort
 * the sprite as one piece by its depth key, and the yard lies on the west tiles, so the key is the lane cell below
 * the footprint's south-west corner, (x, y + h) at its centre: a figure there, anywhere east of it or anywhere south
 * of it stands in front of the whole house (the yard's gate and south fence, the door and its steps), and one on a
 * cell north or west of the footprint stays behind it. The front corner's own cell (x + w - 1, y + h) would have put
 * a figure on the south lane beside the yard behind the fence it stands in front of.
 */
function house(id: string, x: number, y: number, w: number, h: number): Standing {
  const footprint: Vec2[] = [];
  for (let row = y; row < y + h; row++)
    for (let col = x; col < x + w; col++) footprint.push({ x: col, y: row });
  return { id, footprint, depth: { x: x + 0.5, y: y + h + 0.5 }, fadeWhenOccluding: true };
}

function courtyardProp({ id, x, y }: (typeof BA_DAN_COURTYARD_PROPS)[number]): Standing {
  return {
    id,
    footprint: [
      { x, y },
      { x: x + 1, y },
    ],
    depth: { x: x + 1.5, y: y + 0.5 },
  };
}

function dressingPiece([image, x, y]: (typeof BA_DAN_DRESSING)[number], i: number): Standing {
  const [w, d] = FOOTPRINTS[image];
  return {
    id: `d${i}`,
    footprint: cells(image, x, y),
    depth: { x: x + w - 0.5, y: y + d - 0.5 },
  };
}

/** The north edge band: a dry-stone tea terrace one cell outside the rim. It is the back edge: everyone stands in front of it. */
const NORTH_TERRACE: readonly Standing[] = Array.from({ length: 6 }, (_, index) => ({
  id: `north-terrace-${index}`,
  footprint: [
    { x: 4 + 2 * index, y: -1 },
    { x: 5 + 2 * index, y: -1 },
  ],
  depth: { x: 5.5 + 2 * index, y: -0.5 },
  exterior: true as const,
}));

/**
 * The rim's trees as a figure can walk behind them: [cell x, y]. A tree stands on its cell.
 * The court trees (5,5) and (21,2) and the two exterior canopies (26,16) and (27,5) are among them.
 */
const TREES = [
  [0, 6],
  [0, 9],
  [5, 5],
  [0, 10],
  [1, 14],
  [2, 15],
  [3, 15],
  [18, 0],
  [19, 0],
  [21, 2],
  [23, 3],
  [27, 5],
  [23, 11],
  [22, 14],
  [21, 15],
  [22, 15],
  [26, 16],
] as const;

/**
 * The trees nobody can walk behind, one sprite each: [depth key, ...cells x, y]. A clump draws at
 * one depth; its footprint is the cells of its trees.
 */
const CLUMPS = [
  [2, 0, 0, 1, 0, 0, 1, 2, 0, 1, 1, 3, 0],
  [4, 0, 2, 0, 3, 0, 4, 0, 5],
  [13, 0, 11, 0, 12, 0, 13, 0, 14, 0, 15, 1, 15],
  [23, 20, 0, 21, 0, 22, 0, 22, 1, 23, 0, 23, 1, 23, 2],
  [28, 23, 4, 23, 5],
  [36, 23, 6, 23, 9, 23, 10],
  [36, 23, 12, 23, 13],
  [37, 23, 14, 23, 15],
  [22, -1, 17, 0, 18, 1, 20],
  [25, 2, 20, 3, 19, 4, 20],
  [30, 6, 19, 8, 20, 10, 19],
  [37, 12, 20, 14, 20, 16, 19],
  [29, 25, -1, 26, 0, 27, 1],
  [33, 26, 4, 27, 3, 28, 5],
  [44, 27, 11, 27, 12, 27, 14, 28, 13, 27, 16],
  [47, 28, 17, 26, 20, 27, 19],
] as const;

const outside = (c: Vec2): boolean => c.x < 0 || c.y < 0 || c.x > 23 || c.y > 15;

function tree([x, y]: (typeof TREES)[number]): Standing {
  return {
    id: `tree-${x}-${y}`,
    footprint: [{ x, y }],
    depth: { x, y },
    fadeWhenOccluding: true,
    ...(x > 23 || y > 15 ? { exterior: true as const } : {}),
  };
}

function clump([key, ...at]: (typeof CLUMPS)[number], i: number): Standing {
  const footprint = Array.from({ length: at.length / 2 }, (_, k) => ({
    x: at[2 * k]!,
    y: at[2 * k + 1]!,
  }));
  return {
    id: `tree-c${i}`,
    footprint,
    depth: { x: key, y: 0 },
    fadeWhenOccluding: true,
    // The frame's clumps stand wholly outside the board, like the two exterior canopies.
    ...(footprint.every(outside) ? { exterior: true as const } : {}),
  };
}

const { x: planterX, y: planterY } = BA_DAN_SOUTHEAST_PLANTER[0];
const { x: bridgeX, y: bridgeY } = BA_DAN_CANAL_BRIDGE;

/**
 * Everything the painting holds that stands, nearest the back first as the scene lists it (equal depths
 * sort in this order, so frontage paints after the building behind it).
 */
export const BA_DAN_STANDING: readonly Standing[] = [
  house('gao-house', 6, 1, 4, 3),
  house('north-house', 12, 1, 4, 3),
  house('southwest-house', 6, 10, 4, 4),
  house('southeast-house', 13, 10, 4, 4),
  // Low crossing over the canal's dry centre, split at the near rail so actors can stand on the deck
  // instead of disappearing behind one opaque sprite; the map tile stays the sole collision authority.
  {
    id: 'canal-bridge',
    footprint: [BA_DAN_CANAL_BRIDGE],
    depth: { x: bridgeX + 0.5, y: bridgeY + 0.25 },
  },
  {
    id: 'canal-bridge-front',
    footprint: [BA_DAN_CANAL_BRIDGE],
    depth: { x: bridgeX + 0.5, y: bridgeY + 0.75 },
  },
  ...BA_DAN_COURTYARD_PROPS.map(courtyardProp),
  {
    id: 'southeast-planter',
    footprint: [...BA_DAN_SOUTHEAST_PLANTER],
    depth: { x: planterX + 0.5, y: planterY + 1.5 },
  },
  ...NORTH_TERRACE,
  ...BA_DAN_DRESSING.map(dressingPiece),
  ...TREES.map(tree),
  ...CLUMPS.map(clump),
];

/** A sprite, drawn where the painting has it: the sprite's rectangle in painting pixels is the world rectangle times 1.5. */
function upright(piece: Standing): SceneScenery | null {
  const art = BA_DAN_UPRIGHTS[piece.id];
  if (!art) return null;
  const [page, sx, sy, vx, vy, width, height] = art;
  return {
    id: piece.id,
    url: `${root}uprights-${page}.webp`,
    sourceRect: { x: sx, y: sy, width, height },
    x: origin.x + vx / PIXELS_PER_WORLD,
    y: origin.y + vy / PIXELS_PER_WORLD,
    width: width / PIXELS_PER_WORLD,
    height: height / PIXELS_PER_WORLD,
    footprint: piece.footprint,
    depth: piece.depth,
    ...(piece.fadeWhenOccluding ? { fadeWhenOccluding: true } : {}),
    ...(piece.exterior ? { exterior: true } : {}),
    // The painting has the contact and the cast shade; the runtime would draw them a second time.
    contactShadow: false,
    castShadow: false,
  };
}

const plate = ([
  index,
  x,
  y,
  width,
  height,
]: (typeof BA_DAN_GROUND_PLATES)[number]): SceneImage => ({
  url: `${root}ground-${String(index).padStart(2, '0')}.webp`,
  x: origin.x + x / PIXELS_PER_WORLD,
  y: origin.y + y / PIXELS_PER_WORLD,
  width: width / PIXELS_PER_WORLD,
  height: height / PIXELS_PER_WORLD,
});

/** The image files the scene draws: the ground plates and the upright pages. */
export const BA_DAN_IMAGE_COUNT = BA_DAN_GROUND_PLATES.length + BA_DAN_UPRIGHT_PAGES;

/** Ink alpha of a figure's projected cast and of the sole-band contact under both feet. */
export const BA_DAN_ACTOR_GROUNDING = { cast: 0.5, contact: 0.8 } as const;

/**
 * A complete scene: the plates cover the whole pan box, so the grid's procedural terrain is not drawn under
 * them and no runtime join is drawn over them. The permanent water is the painted canal.
 */
export const BA_DAN_SCENE: MapScene = {
  marginTone: 'verdant',
  chimneys: BA_DAN_CHIMNEYS,
  paintedWater: true,
  // The painting's own casts run ~0.40 darkening with ~0.60 at the contact line; figures answer in kind.
  actorGrounding: BA_DAN_ACTOR_GROUNDING,
  // The painting's own rectangle: the exploration camera keeps the view inside it, so its edge is never seen.
  paintExtent: {
    x: origin.x,
    y: origin.y,
    width: size.width / PIXELS_PER_WORLD,
    height: size.height / PIXELS_PER_WORLD,
  },
  ground: BA_DAN_GROUND_PLATES.map(plate),
  scenery: BA_DAN_STANDING.flatMap((piece) => upright(piece) ?? []),
};
