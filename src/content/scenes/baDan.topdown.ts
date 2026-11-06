/**
 * Ba Dan's top-down objects (ADR 0104 §3, phase T3): the prototype's approved PixelLab pieces
 * (`prototypes/topdown/src/v13/objects.js`, its `put()` calls) re-placed on the game's 24 x 16 grid.
 * `village.ts` stays the rules authority; here every blocked cell of its rows that the terrain does
 * not block (the canal, the ford) is the footprint of a solid piece, and no solid piece stands on an
 * open cell. `validateTopDownLayout` (`schemas.ts`) holds both.
 *
 * Positions are top-down world px (40 a cell, cell (0, 0) at the origin): `x` is the object's centre
 * and `base` the row it stands on, as the prototype's `put(k, cx, by)` takes them, less its
 * (128, 192) offset. Depth is the base in fractional cells, so the board sorts every piece by its base.
 *
 * - **Houses.** Gao's and Mira's (columns 6-9 and 12-15, rows 1-3) are where the prototype had them.
 *   The south houses move up from the prototype's rows 13-15.5 to the game's footprints (rows 10-13,
 *   columns 6-9 and 13-16): Pella's, and the south-east house. The prototype's extra north-east house
 *   stands past the north edge at columns 18-23 (the merchant's house, the only front wide enough for
 *   the six tree cells of row 0 it covers); its south-east one is left out (see `LEFT_OUT`).
 * - **Doors** stay where `residents/baDan.ts` has them for now: PixelLab's houses are front views
 *   with the door in the middle of the south face, and the scene change moves the door cells.
 * - **Dressing**: each piece of the oblique scene's dressing (`BA_DAN_DRESSING`, the courtyard props)
 *   is played by the prototype piece that does the same job, on the same cells.
 * - **Slots**: the route sign at (18, 12) and the school notice at (12, 11) are drawn by another change.
 */
import type { Vec2 } from '../../core/types';
import type { TopDownObject, TopDownObjectKind, TopDownSlot } from '../topdownLayout';

/** The top-down cell in world px (ADR 0104). This file stays free of the terrain classifier, so a
 * scene may import it without pulling the classifier into the bundle. */
const CELL = 40;

interface PutOptions {
  readonly solid?: boolean;
  readonly exterior?: boolean;
  readonly deck?: boolean;
}

const cells = (...xy: readonly (readonly [number, number])[]): Vec2[] =>
  xy.map(([x, y]) => ({ x, y }));
const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => {
  const out: Vec2[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push({ x, y });
  return out;
};

const FADE: ReadonlySet<TopDownObjectKind> = new Set(['house', 'tree']);

function put(
  id: string,
  sprite: string,
  kind: TopDownObjectKind,
  x: number,
  base: number,
  footprint: readonly Vec2[],
  o: PutOptions = {},
): TopDownObject {
  const flatLike = kind === 'flat' || kind === 'bridge' || kind === 'walkway' || kind === 'steps';
  return {
    id,
    sprite,
    kind,
    x,
    base,
    footprint,
    solid: o.solid ?? !flatLike,
    ...(o.deck && { deck: true }),
    ...(o.exterior && { exterior: true }),
    depth: { x: x / CELL, y: base / CELL },
    ...(FADE.has(kind) && { fadeWhenOccluding: true }),
  };
}

/** The north and south house rows stand on their lanes: 16 px above the cell line under the footprint. */
const NORTH = 4 * CELL - 16;
const SOUTH = 14 * CELL - 16;

const HOUSES: readonly TopDownObject[] = [
  put('gao-house', 'house_gao', 'house', 320, NORTH, rect(6, 1, 9, 3)),
  put('mira-house', 'house_mira', 'house', 560, NORTH, rect(12, 1, 15, 3)),
  put('pella-house', 'house_pella', 'house', 320, SOUTH, rect(6, 10, 9, 13)),
  put('southeast-house', 'house_se', 'house', 590, SOUTH, rect(13, 10, 16, 13)),
  // Past the north edge, its front on row 0's tree cells.
  put('northeast-house', 'house_merchant', 'house', 836, 30, rect(18, -2, 23, 0), {
    exterior: true,
  }),
];

/** The rim's trees and bushes on the border tree cells, and the court trees at (5, 5) and (21, 2). */
const TREES: readonly TopDownObject[] = [
  put('nw-oak', 'tree', 'tree', 34, 70, rect(0, 0, 1, 1)),
  put('nw-blossom', 'tree_blossom', 'tree', 112, 34, cells([2, 0], [3, 0])),
  put('w-bush-2', 'bush', 'tree', 14, 114, cells([0, 2])),
  put('w-blossom-3', 'tree_blossom', 'tree', 18, 156, cells([0, 3])),
  put('w-target', 'target', 'prop', 22, 192, cells([0, 4])),
  put('w-bush-5', 'bush', 'tree', 16, 236, cells([0, 5])),
  put('w-bush-9', 'bush', 'tree', 14, 394, cells([0, 9])),
  put('w-blossom-10', 'tree_blossom', 'tree', 16, 470, cells([0, 10], [0, 11])),
  put('w-beehive', 'beehive', 'prop', 22, 508, cells([0, 12])),
  put('sw-oak', 'tree', 'tree', 26, 588, cells([0, 13], [0, 14], [1, 14])),
  put('sw-oak-2', 'tree', 'tree', 48, 636, cells([0, 15], [1, 15])),
  put('sw-bush', 'bush', 'tree', 98, 634, cells([2, 15])),
  put('sw-blossom', 'tree_blossom', 'tree', 138, 636, cells([3, 15])),
  put('court-blossom-west', 'tree_blossom', 'tree', 220, 236, cells([5, 5])),
  put('court-blossom-east', 'tree_blossom', 'tree', 878, 116, cells([21, 2])),
  put('ne-bush', 'bush', 'tree', 896, 74, cells([22, 1])),
  put('ne-oak', 'tree', 'tree', 944, 116, cells([23, 1], [23, 2])),
  put('e-bush-3', 'bush', 'tree', 946, 152, cells([23, 3])),
  put('e-blossom-4', 'tree_blossom', 'tree', 944, 228, cells([23, 4], [23, 5])),
  put('e-bush-9', 'bush', 'tree', 946, 394, cells([23, 9])),
  put('e-oak-10', 'tree', 'tree', 942, 470, cells([23, 10], [23, 11])),
  put('e-bush-12', 'bush', 'tree', 948, 512, cells([23, 12])),
  put('e-blossom-13', 'tree_blossom', 'tree', 944, 552, cells([23, 13])),
  put('se-oak', 'tree', 'tree', 930, 596, cells([22, 14], [23, 14])),
  put('se-bush', 'bush', 'tree', 860, 636, cells([21, 15])),
  put('se-blossom', 'tree_blossom', 'tree', 904, 636, cells([22, 15])),
  put('se-bush-2', 'bush', 'tree', 946, 636, cells([23, 15])),
  // Past the north and south bands, rooted inside the lip (the prototype's own, where they still fit).
  put('n-blossom', 'tree_blossom', 'tree', 142, -52, cells([3, -2]), { exterior: true }),
  put('n-oak-gao', 'tree', 'tree', 272, -42, cells([6, -2]), { exterior: true }),
  put('n-bush', 'bush', 'tree', 432, -52, cells([10, -2]), { exterior: true }),
  put('n-oak-mira', 'tree', 'tree', 572, -60, cells([14, -2]), { exterior: true }),
  put('s-oak-1', 'tree', 'tree', 52, 668, cells([1, 16]), { exterior: true }),
  put('s-oak-2', 'tree', 'tree', 172, 658, cells([4, 16]), { exterior: true }),
  put('s-bush-1', 'bush', 'tree', 352, 660, cells([8, 16]), { exterior: true }),
  put('s-blossom', 'tree_blossom', 'tree', 428, 676, cells([10, 16]), { exterior: true }),
  put('s-bush-2', 'bush', 'tree', 572, 680, cells([14, 17]), { exterior: true }),
  put('s-bush-3', 'bush', 'tree', 840, 662, cells([21, 16]), { exterior: true }),
];

/** The dressing, each on the cells the oblique scene's piece of the same job blocks. */
const DRESSING: readonly TopDownObject[] = [
  // Against the north houses (inside their footprints), as the prototype has them.
  put('gao-herbs', 'herb_shelf', 'prop', 260, 154, cells([6, 3])),
  put('gao-barrel', 'barrel', 'prop', 377, 152, cells([9, 3])),
  put('mira-broom', 'bucket_broom', 'prop', 616, 152, cells([15, 3])),
  // Row 2: the shop stack and banner pole between the houses, the laundry line.
  put('shop-crates', 'crates', 'prop', 420, 114, cells([10, 2])),
  put('banner-north', 'banner_pole', 'prop', 452, 116, cells([11, 2])),
  put('laundry', 'laundry_line', 'prop', 720, 116, cells([17, 2], [18, 2])),
  // Row 4: the north garden and the handcart's yard.
  put('north-planter', 'planter', 'prop', 704, 196, cells([17, 4])),
  put('north-pots', 'flower_pots', 'prop', 742, 196, cells([18, 4])),
  put('handcart', 'handcart', 'prop', 778, 196, cells([19, 4])),
  put('haystack', 'haystack', 'prop', 820, 196, cells([20, 4])),
  put('firewood', 'firewood', 'prop', 860, 194, cells([21, 4])),
  // Row 5: Dorin's fence and bench on the west bank, Gao's display, the north market.
  put('west-fence', 'fence', 'prop', 80, 236, cells([1, 5], [2, 5])),
  put('west-bench', 'bench', 'prop', 160, 234, cells([3, 5], [4, 5])),
  put('gao-display', 'market_jars', 'prop', 280, 234, cells([6, 5], [7, 5])),
  put('north-market', 'market_veg', 'prop', 600, 234, cells([14, 5], [15, 5])),
  // Mira's table at the rest spot (10, 5): a table the party sits at, so it never stops feet.
  put('mira-table', 'mira_table', 'prop', 420, 226, cells([10, 5]), { solid: false }),
  // Row 6: the shrine at the dry crossing, the watch post's notice board and lamp.
  put('shrine', 'shrine', 'prop', 588, 274, cells([14, 6])),
  put('notice-board', 'notice_board', 'prop', 740, 274, cells([18, 6])),
  put('lamp-post', 'lamp', 'prop', 820, 274, cells([20, 6])),
  put('exit-sign', 'signpost', 'prop', 940, 272, cells([23, 6])),
  // Row 9: the south market, the road's lamps.
  put('south-produce', 'produce', 'prop', 96, 392, cells([2, 9])),
  put('south-stall', 'stall', 'prop', 160, 394, cells([3, 9], [4, 9])),
  // Under the south-east house's roof: a lamp there stood on the roof line.
  put('square-crate', 'crate', 'prop', 660, 394, cells([16, 9])),
  put('lamp-east', 'lamp', 'prop', 820, 394, cells([20, 9])),
  // Rows 10-11: the garden plot, the planter between the south houses, the pole and the trough.
  put('garden', 'garden', 'prop', 124, 474, rect(2, 10, 3, 11)),
  put('garden-pots', 'pots', 'prop', 180, 432, cells([4, 10])),
  put('garden-sack', 'sack', 'prop', 178, 474, cells([4, 11])),
  put('stone-lantern', 'stone_lantern', 'prop', 220, 474, cells([5, 11])),
  put('west-planter', 'planter', 'prop', 456, 434, cells([11, 10], [12, 10])),
  put('banner-south', 'banner_pole', 'prop', 740, 434, cells([18, 10])),
  put('trough', 'trough', 'prop', 800, 434, cells([19, 10], [20, 10])),
  put('southeast-barrels', 'barrels', 'prop', 700, 474, cells([17, 10], [17, 11])),
  // The well at (12, 13).
  put('well', 'well', 'prop', 496, 556, cells([12, 13])),
];

/** Structures the ground carries a way over, and what lies flat on it. */
const FLATS: readonly TopDownObject[] = [
  put('bridge', 'bridge', 'bridge', 380, 284, cells([9, 6]), { deck: true }),
  put('walkway', 'walkway', 'walkway', 1066, 348, cells([26, 7], [26, 8]), {
    deck: true,
    exterior: true,
  }),
  put('river-steps', 'steps', 'steps', 784, 773, cells([19, 19]), { exterior: true }),
  put('flowers-west', 'flowers', 'flat', 52, 528, cells([1, 13])),
  put('flowers-east', 'flowers', 'flat', 832, 508, cells([20, 12])),
  put('tuft-1', 'tuft', 'flat', 432, 638, cells([10, 15])),
  put('tuft-2', 'tuft', 'flat', 342, 668, cells([8, 16]), { exterior: true }),
  put('tuft-3', 'tuft', 'flat', 572, -72, cells([14, -2]), { exterior: true }),
  put('tuft-4', 'tuft', 'flat', 192, -62, cells([4, -2]), { exterior: true }),
  put('tuft-5', 'tuft', 'flat', 632, 658, cells([15, 16]), { exterior: true }),
  put('tuft-6', 'tuft', 'flat', 752, 58, cells([18, 1])),
];

/**
 * Prototype pieces with no place on the game's grid, and why: the scene review can bring any back.
 * Every one of them stood on a cell the rows keep open, or would hide one.
 */
export const LEFT_OUT: Readonly<Record<string, string>> = {
  house_ne:
    "the prototype's south-east house: past the south edge at columns 20-23 its body hides the open cells of rows 12-14",
  'oven, sacks, yard fences': "Gao's yard stood on columns 4-5, rows 1-3, all open",
  'dummy, woodshed, cookpot, rain barrel, crates, wheelbarrow, drains':
    'each stood on an open cell (or off the east lip) once the grid was laid over it',
};

export const BA_DAN_TOPDOWN_OBJECTS: readonly TopDownObject[] = [
  ...HOUSES,
  ...TREES,
  ...DRESSING,
  ...FLATS,
];

/** The route sign and the school notice: their art comes from another change. */
export const BA_DAN_TOPDOWN_SLOTS: readonly TopDownSlot[] = [
  { id: 'route-sign', npc: 'riverside_sign', cell: { x: 18, y: 12 } },
  { id: 'school-notice', npc: 'school_notice', cell: { x: 12, y: 11 } },
];
