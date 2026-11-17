/**
 * Ba Dan's rule layout (ADR 0104 T7): the canal's water and bridge, and the cells the courtyard
 * props, the dressing and the two court trees close. `village.ts` builds its rows from them and the
 * practice ground reads the water; the top-down scene draws them from its own placed objects.
 */
import type { Vec2 } from '../../core/types';

/** Permanent water cells; the bridge deck at x9 carries the paved crossing over the flow. */
export const BA_DAN_WATER_CELLS: readonly Vec2[] = Array.from({ length: 13 }, (_, x) => x)
  .filter((x) => x !== 9)
  .map((x) => ({ x, y: 6 }));
export const BA_DAN_CANAL_BRIDGE = { x: 9, y: 6 } as const;

/** Footprint (width, depth) in tiles of each piece of dressing and the courtyard props. */
const FOOTPRINTS = {
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
  handcart: [1, 1],
  haystack: [1, 1],
  'bench-2x1': [2, 1],
  'garden-plot-3x2': [3, 2],
  'stone-lantern': [1, 1],
  'trough-hay': [2, 1],
  'fence-2x1': [2, 1],
  'wayside-shrine': [1, 1],
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
  { id: 'gao-display', image: 'merchant-display', x: 6, y: 5 },
  { id: 'south-market-display', image: 'merchant-display-c', x: 3, y: 9 },
] as const;

export const BA_DAN_COURTYARD_FOOTPRINTS: readonly Vec2[] = BA_DAN_COURTYARD_PROPS.flatMap(
  ({ x, y }) => [
    { x, y },
    { x: x + 1, y },
  ],
);

/**
 * Set dressing: [piece, x, y] at the footprint's origin tile. Each piece blocks the
 * cells of its footprint (`village.ts` makes them `l`), all of them lawn margins, corners and
 * bank edges; the main road rows, the paved square and the bridge approach stay open.
 *
 * The square was designed before it was dressed (`docs/art-cohesion.md`, the cohesion pilot,
 * 2026-11-17): every piece answers what it is for. The crews' bench stands behind Mira's table
 * (a seat, like the table, so it closes no cell: the party gathers round it),
 * the wayside shrine moved from the canal's end to the east gate, where people leave on the
 * quarry road, and the pieces that answered nothing (the north and south planters, the second
 * market display, the south banner, a lone lamp and crate, the stone lantern) went.
 */
export const BA_DAN_DRESSING = [
  ['village-well', 12, 13],
  ['baskets', 2, 9],
  ['banner-pole', 11, 2],
  ['lantern-post', 20, 6],
  ['lantern-post', 20, 9],
  ['shop-stack', 10, 2],
  ['laundry-line', 17, 2],
  ['notice-board', 18, 6],
  ['handcart', 19, 5],
  ['haystack', 21, 10],
  ['fence-2x1', 1, 5],
  ['garden-plot-3x2', 2, 10],
  ['wayside-shrine', 18, 9],
  ['trough-hay', 19, 10],
] as const;

export const BA_DAN_DRESSING_FOOTPRINTS: readonly Vec2[] = BA_DAN_DRESSING.flatMap(
  ([image, x, y]) => cells(image, x, y),
);
