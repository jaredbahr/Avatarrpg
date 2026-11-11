/**
 * The prototype's organic cell masks (`prototypes/topdown/src/b3/surfvis.js`), ported for the top-down
 * board (ADR 0104 section 2; #457, #458): a set of cells becomes one soft shape on the world-pixel
 * grid, never the tiles' squares. `hash2` and `vnoise` are `head.js`'s, verbatim; `metaMask`,
 * `insideDist`, `clipMask` and `organicMask` keep the prototype's constants, seeds and order.
 *
 * What differs is only where the board comes from: the prototype read its painted ground classes
 * (`groundOK`) and legend; here the caller passes the grid, and {@link groundOk} derives the same
 * "a patch may lie here" mask from the rules' tiles (never a blocked cell, a pit, deep water or the
 * face that hangs below a higher tier). Pure and deterministic: typed arrays, no `Math.random`.
 *
 * Every mask covers the whole board (`w * 40` by `h * 40` px, row-major) but is computed only over
 * the region its cells can reach, so a small patch costs a small patch.
 */
import type { Grid } from '../../core/types';
import { TOPDOWN_TILE } from '../projection';

/** World px a cell spans (`CS` in `head.js`). */
export const CS = TOPDOWN_TILE;

/** The prototype's integer hash in [0, 1] (`head.js`), verbatim. */
export function hash2(x: number, y: number, k: number): number {
  let t = (x * 374761393 + y * 668265263 + k * 1442695041) >>> 0;
  t = Math.imul(t ^ (t >>> 13), 1274126177) >>> 0;
  return ((t ^ (t >>> 16)) & 0xffff) / 65535;
}

/** Smoothstep value noise in [-1, 1] with a period of `p` px (`head.js`), verbatim. */
export function vnoise(x: number, y: number, k: number, p = 2.6): number {
  const fx = x / p,
    fy = y / p,
    ix = Math.floor(fx),
    iy = Math.floor(fy),
    tx = fx - ix,
    ty = fy - iy,
    sx = tx * tx * (3 - 2 * tx),
    sy = ty * ty * (3 - 2 * ty);
  const a = hash2(ix, iy, k),
    b = hash2(ix + 1, iy, k),
    c = hash2(ix, iy + 1, k),
    d = hash2(ix + 1, iy + 1, k);
  return ((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy) * 2 - 1;
}

/** The board in cells, and in px. */
export interface Board {
  /** Cells across and down. */
  readonly w: number;
  readonly h: number;
}

const at = (a: ArrayLike<number>, i: number): number => a[i] ?? 0;

/** A rectangle of board px, half-open: `x0 <= x < x1`. */
export interface Region {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** The px a mask of `cells` can reach: their bounding box grown by a cell, inside the board. */
export function reachOf(board: Board, cells: readonly { x: number; y: number }[]): Region | null {
  if (cells.length === 0) return null;
  let cx0 = Infinity,
    cy0 = Infinity,
    cx1 = -Infinity,
    cy1 = -Infinity;
  for (const { x, y } of cells) {
    cx0 = Math.min(cx0, x);
    cy0 = Math.min(cy0, y);
    cx1 = Math.max(cx1, x);
    cy1 = Math.max(cy1, y);
  }
  return {
    x0: Math.max(0, (cx0 - 1) * CS),
    y0: Math.max(0, (cy0 - 1) * CS),
    x1: Math.min(board.w * CS, (cx1 + 2) * CS),
    y1: Math.min(board.h * CS, (cy1 + 2) * CS),
  };
}

/** How many px of a cell's top a higher tier's cut face hangs over (`Q_FACE`, `world_quarry.js`). */
export const FACE_PX = 13;

/**
 * Where a patch may lie, per board px (`surfvis.js` `groundOK`, from the rules): 1 on a cell a
 * figure could stand on, 0 on a blocked cell, a pit or deep water, and on the face a higher tier
 * hangs over the top of the cell below it.
 */
export function groundOk(grid: Grid): Uint8Array {
  const BW = grid.width * CS,
    BH = grid.height * CS,
    g = new Uint8Array(BW * BH);
  for (let cy = 0; cy < grid.height; cy++)
    for (let cx = 0; cx < grid.width; cx++) {
      const tile = grid.tiles[cy * grid.width + cx];
      if (!tile || tile.blocked || tile.terrain === 'pit' || tile.terrain === 'water_deep')
        continue;
      const above = cy > 0 ? grid.tiles[(cy - 1) * grid.width + cx] : undefined;
      const face = above && above.elevation > tile.elevation ? FACE_PX : 0;
      for (let y = cy * CS + face; y < (cy + 1) * CS; y++)
        g.fill(1, y * BW + cx * CS, y * BW + (cx + 1) * CS);
    }
  return g;
}

/**
 * `metaMask`: one soft blob per cell, its centre nudged up to 0.3 cell and its radius 0.92 ± 0.12
 * (seeds `seedK` + 31, 32, 33); the field is the sum of (1 − d²/r²)² over the 3×3 cells round a px,
 * plus slow noise (periods 21, 9 and 2.5) that fades inside so a pool never opens a hole, cut at
 * `edge × 0.62`.
 */
export function metaMask(
  board: Board,
  isOn: (x: number, y: number) => boolean,
  seedK: number,
  edge: number,
  region: Region,
): Uint8Array {
  const BW = board.w * CS,
    BH = board.h * CS,
    m = new Uint8Array(BW * BH);
  const blobs = new Map<number, readonly [number, number, number]>();
  for (let y = 0; y < board.h; y++)
    for (let x = 0; x < board.w; x++)
      if (isOn(x, y))
        blobs.set(y * board.w + x, [
          x + 0.5 + (hash2(x, y, seedK + 31) - 0.5) * 0.6,
          y + 0.5 + (hash2(x, y, seedK + 32) - 0.5) * 0.6,
          0.92 + (hash2(x, y, seedK + 33) - 0.5) * 0.24,
        ]);
  if (!blobs.size) return m;
  const thr = edge * 0.62;
  for (let py = region.y0; py < region.y1; py++)
    for (let px = region.x0; px < region.x1; px++) {
      const cx = px / CS,
        cy = py / CS,
        ix = Math.floor(cx),
        iy = Math.floor(cy);
      let f = 0;
      for (let j = -1; j <= 1; j++)
        for (let k = -1; k <= 1; k++) {
          const X = ix + j,
            Y = iy + k;
          if (X < 0 || Y < 0 || X >= board.w || Y >= board.h) continue;
          const o = blobs.get(Y * board.w + X);
          if (!o) continue;
          const d2 = ((cx - o[0]) ** 2 + (cy - o[1]) ** 2) / (o[2] * o[2]);
          if (d2 < 1) f += (1 - d2) ** 2;
        }
      if (!f) continue;
      const n =
        vnoise(px, py, seedK, 21) * 0.2 +
        vnoise(px, py, seedK + 2, 9) * 0.09 +
        vnoise(px, py, seedK + 1, 2.5) * 0.03;
      if (f + n * Math.max(0, 1 - f / (thr * 2.6)) > thr) m[py * BW + px] = 1;
    }
  return m;
}

/** 0 outside; 1 at the edge, rising inward (a 4-neighbour chamfer, capped), as `insideDist`. */
export function insideDist(
  m: Uint8Array,
  BW: number,
  BH: number,
  cap = 8,
  region?: Region,
): Uint8Array {
  const r = region ?? { x0: 0, y0: 0, x1: BW, y1: BH };
  const D = new Uint8Array(BW * BH);
  for (let y = r.y0; y < r.y1; y++)
    for (let x = r.x0; x < r.x1; x++) {
      const i = y * BW + x;
      if (!m[i]) continue;
      D[i] = Math.min(cap, 1 + Math.min((x && at(D, i - 1)) || 0, (y && at(D, i - BW)) || 0));
      if (!x || !y) D[i] = 1;
    }
  for (let y = r.y1 - 1; y >= r.y0; y--)
    for (let x = r.x1 - 1; x >= r.x0; x--) {
      const i = y * BW + x;
      if (!m[i]) continue;
      const right = x < BW - 1 ? at(D, i + 1) : 0,
        down = y < BH - 1 ? at(D, i + BW) : 0;
      D[i] = Math.min(at(D, i), 1 + Math.min(right, down));
    }
  return D;
}

/** The farthest a patch reaches past its authored cells, in px (`CAP`). */
export const CAP = 9;

/**
 * `clipMask`, in the prototype's order: drop px off the ground and on blocked cells; keep each px
 * within a wandering 3.5–9 px of its authored cells (seeds 191, 193); force every on cell's core,
 * 12 px in from its edges, on; stand the patch off bad ground by a wandering 0–3.4 px (seed 197,
 * the chamfer capped at 5); then two 5×5 majority passes (15 or more on, 9 or fewer off).
 */
export function clipMask(
  m: Uint8Array,
  board: Board,
  isOn: (x: number, y: number) => boolean,
  ground: Uint8Array,
  blockedCell: (x: number, y: number) => boolean,
  region: Region,
): Uint8Array {
  const BW = board.w * CS,
    BH = board.h * CS,
    GW = board.w,
    GH = board.h;
  const blocked = new Uint8Array(GW * GH),
    on = new Uint8Array(GW * GH);
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      blocked[y * GW + x] = blockedCell(x, y) ? 1 : 0;
      on[y * GW + x] = isOn(x, y) ? 1 : 0;
    }
  const odist = (px: number, py: number): number => {
    let best = 99;
    const cx0 = Math.floor(px / CS),
      cy0 = Math.floor(py / CS);
    for (let cy = Math.max(0, cy0 - 1); cy <= Math.min(GH - 1, cy0 + 1); cy++)
      for (let cx = Math.max(0, cx0 - 1); cx <= Math.min(GW - 1, cx0 + 1); cx++)
        if (on[cy * GW + cx]) {
          const dx = Math.max(0, cx * CS - px, px - (cx * CS + CS - 1)),
            dy = Math.max(0, cy * CS - py, py - (cy * CS + CS - 1));
          best = Math.min(best, Math.hypot(dx, dy));
        }
    return best;
  };
  const near = (px: number, py: number): boolean => {
    const d = odist(px, py);
    return (
      d <= 0 ||
      d <
        3.5 +
          (CAP - 3.5) *
            Math.min(
              1,
              Math.max(0, 0.5 + 0.9 * vnoise(px, py, 191, 8) + 0.5 * vnoise(px, py, 193, 3.5)),
            )
    );
  };
  for (let y = region.y0; y < region.y1; y++)
    for (let x = region.x0; x < region.x1; x++) {
      const i = y * BW + x,
        cell = Math.floor(y / CS) * GW + Math.floor(x / CS);
      if (m[i] && (!ground[i] || blocked[cell] || !near(x, y))) m[i] = 0;
      else if (
        !m[i] &&
        ground[i] &&
        on[cell] &&
        !blocked[cell] &&
        x % CS > 12 &&
        x % CS < CS - 12 &&
        y % CS > 12 &&
        y % CS < CS - 12
      )
        m[i] = 1;
    }
  // the stand-off from bad ground: the chamfer of the bad ground's own inside, capped at 5
  const bad = new Uint8Array(BW * BH);
  for (let y = region.y0; y < region.y1; y++)
    for (let x = region.x0; x < region.x1; x++) bad[y * BW + x] = ground[y * BW + x] ? 0 : 1;
  const nb = insideDist(bad, BW, BH, 5, region);
  for (let y = region.y0; y < region.y1; y++)
    for (let x = region.x0; x < region.x1; x++) {
      const i = y * BW + x;
      if (m[i] && nb[i] && at(nb, i) <= Math.round(3.4 * (0.5 + 0.5 * vnoise(x, y, 197, 7))))
        m[i] = 0;
    }
  const ry0 = Math.max(2, region.y0),
    ry1 = Math.min(BH - 2, region.y1),
    rx0 = Math.max(2, region.x0),
    rx1 = Math.min(BW - 2, region.x1);
  for (let pass = 0; pass < 2; pass++) {
    const src = m.slice();
    for (let y = ry0; y < ry1; y++)
      for (let x = rx0; x < rx1; x++) {
        const i = y * BW + x;
        let c = 0;
        for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) c += at(src, i + j * BW + k);
        if (c >= 15) m[i] = ground[i] ? 1 : 0;
        else if (c <= 9) m[i] = 0;
      }
  }
  return m;
}
