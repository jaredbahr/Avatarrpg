/**
 * The Forest Road's top-down terrain (ADR 0104 §3, phase T4): the prototype's forest ground
 * (`prototypes/topdown/src/b3/world_forest.js` `bakeForest`, owner-approved in `forest-combat.html`)
 * as a pure classifier over the map's authored ground rows (`FOREST_GROUND_ROWS`). The ground packer
 * (`scripts/art/topdown/boards/forestRoad.ts`) bakes its plate from the same functions and the
 * content validation reads it through `classify`; the shipped runtime never imports it.
 *
 * The plate is the prototype's: 960 x 680 px, the 20 x 12 grid at (80, 128) in it, so two cells of
 * pine margin either side, three above and two below. Terrain is decided per pixel from 32 px tile
 * vertices that sample the 40 px cells (so no edge follows the cell grid) and two octaves of value
 * noise: the forest floor, the road (`=` and `~`), the creek (`W`, and everything below the grid),
 * and on the road the puddle (the `~` cells, smoothed between cell centres). Outside the grid the
 * rows run on: the road to the plate's sides, the floor above, the creek below.
 */
import type { MapEdgeSide, Vec2 } from '../../core/types';
import { FOREST_GROUND_ROWS } from '../maps/combat';
import { hash2, vnoise, type PointClass, type RimMouth } from './baDan.topdown.terrain';

export { hash2, vnoise };

/** Terrain tile px, the cell in world px, the grid, the plate and where the grid sits in it. */
export const TILE = 32;
export const CELL = 40;
export const GW = 20;
export const GH = 12;
export const PLATE_W = 960;
export const PLATE_H = 680;
/** The grid's top-left in plate px (the prototype's `GX`, `GY`). */
export const GRID = { x: 80, y: 128 } as const;
/** The plate's top-left in game world px. */
export const ORIGIN: Vec2 = { x: -GRID.x, y: -GRID.y };

export const ROWS: readonly string[] = FOREST_GROUND_ROWS;

/** The rows' character at plate px (x, y): the floor above the grid, the creek below, the rows clamped sideways. */
export function charAt(px: number, py: number): string {
  const cx = Math.floor((px - GRID.x) / CELL),
    cy = Math.floor((py - GRID.y) / CELL);
  if (cy < 0) return 'T';
  if (cy >= GH) return 'W';
  return ROWS[cy]?.[Math.max(0, Math.min(GW - 1, cx))] ?? 'T';
}

/** The rows' character at cell (x, y), `#` off the grid (the prototype's `at`). */
export function cellAt(x: number, y: number): string {
  return x < 0 || y < 0 || x >= GW || y >= GH ? '#' : (ROWS[y]?.[x] ?? '#');
}

const isRoad = (c: string): boolean => c === '=' || c === '~';
const isWater = (c: string): boolean => c === 'W';

/** The terrain classes the bake lays: the floor, the road, the creek, the puddle on the road. */
export const FOREST = { floor: 0, road: 1, water: 2, puddle: 3 } as const;
export type ForestClass = (typeof FOREST)[keyof typeof FOREST];

const VW = Math.ceil(PLATE_W / TILE) + 1,
  VH = Math.ceil(PLATE_H / TILE) + 1;
const VR = new Float32Array(VW * VH),
  VWT = new Float32Array(VW * VH);
for (let vy = 0; vy < VH; vy++)
  for (let vx = 0; vx < VW; vx++) {
    const c = charAt(vx * TILE, vy * TILE);
    VR[vy * VW + vx] = isRoad(c) ? 1 : 0;
    VWT[vy * VW + vx] = isWater(c) ? 1 : 0;
  }

/** The `~` cells, smoothed between cell centres and wobbled: over 0.5 is the puddle. */
export function puddleAt(px: number, py: number): number {
  const fx = (px - GRID.x) / CELL - 0.5,
    fy = (py - GRID.y) / CELL - 0.5,
    ix = Math.floor(fx),
    iy = Math.floor(fy),
    sx = fx - ix,
    sy = fy - iy;
  const v = (x: number, y: number): number => (cellAt(x, y) === '~' ? 1 : 0);
  return (
    v(ix, iy) * (1 - sx) * (1 - sy) +
    v(ix + 1, iy) * sx * (1 - sy) +
    v(ix, iy + 1) * (1 - sx) * sy +
    v(ix + 1, iy + 1) * sx * sy +
    vnoise(px, py, 61, 9) * 0.18
  );
}

/**
 * How much harder the creek finds it to reach a pixel near the middle of a dry cell: the 32 px
 * vertices sample the 40 px cells, so the prototype's water could lap into where a figure stands on
 * a bank cell the rules walk, or round an alder's roots. A smooth bump round each dry cell's centre
 * (no edge of its own) keeps the bank dry there; elsewhere the creek's edge is the prototype's.
 */
function bankGuard(px: number, py: number): number {
  const cx = Math.floor((px - GRID.x) / CELL),
    cy = Math.floor((py - GRID.y) / CELL);
  const c = cellAt(cx, cy);
  if (c === '#' || c === 'W') return 0;
  const dx = px - (GRID.x + cx * CELL + CELL / 2),
    dy = py - (GRID.y + cy * CELL + CELL / 2);
  return 0.6 * Math.max(0, 1 - Math.hypot(dx, dy * 1.2) / 30);
}

/** The class the bake lays at plate px (x, y), inside the plate. */
export function forestClass(px: number, py: number): ForestClass {
  const tx = Math.floor(px / TILE),
    ty = Math.floor(py / TILE),
    u = (px - tx * TILE + 0.5) / TILE,
    v = (py - ty * TILE + 0.5) / TILE;
  const i0 = ty * VW + tx,
    i2 = (ty + 1) * VW + tx;
  const bl = (q: Float32Array): number =>
    (q[i0] ?? 0) * (1 - u) * (1 - v) +
    (q[i0 + 1] ?? 0) * u * (1 - v) +
    (q[i2] ?? 0) * (1 - u) * v +
    (q[i2 + 1] ?? 0) * u * v;
  const n = vnoise(px, py, 21, 11) * 0.22 + vnoise(px, py, 23, 4) * 0.1;
  const c: ForestClass =
    bl(VWT) + n > 0.5 + bankGuard(px, py)
      ? FOREST.water
      : bl(VR) + n > 0.5
        ? FOREST.road
        : FOREST.floor;
  return c === FOREST.road && puddleAt(px, py) > 0.5 ? FOREST.puddle : c;
}

/**
 * The ground at game world px (x, y), as the bake lays it: off the plate is the void; the creek is
 * water; the floor is grass-like ground (`G`), the road and the puddle on it worn dirt (`D`). The
 * puddle is shallow rainwater on the road, which the rules walk through (`~`, a water surface).
 */
export function classifyPoint(x: number, y: number): PointClass {
  const px = Math.floor(x - ORIGIN.x),
    py = Math.floor(y - ORIGIN.y);
  if (px < 0 || py < 0 || px >= PLATE_W || py >= PLATE_H) return { ground: 'void', terrain: 'V' };
  const c = forestClass(px, py);
  if (c === FOREST.water) return { ground: 'water', terrain: 'W' };
  return { ground: 'ground', terrain: c === FOREST.floor ? 'G' : 'D' };
}

/** The road's two five-cell mouths, west to Ba Dan and east to the quarry, run off the plate's sides. */
const mouth = (id: string, side: MapEdgeSide, x: number): RimMouth => ({
  id,
  side,
  cells: [4, 5, 6, 7, 8].map((y) => ({ x, y })),
});
export const MOUTHS: readonly RimMouth[] = [
  mouth('west-road', 'west', 0),
  mouth('east-road', 'east', GW - 1),
];
/** From an edge cell's centre to the plate's side: two and a half cells. */
export const MOUTH_REACH = 3;
