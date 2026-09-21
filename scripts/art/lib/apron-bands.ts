/**
 * Where the exterior apron's bands are.
 *
 * The ground outside a partial-ground board is a ring around a diamond, and one
 * plate holding that ring is its axis-aligned bounding box. Measured on the
 * shipped v0.2.8 plates, 84.8% of the village's texels and 83.3% of the
 * forest's are fully transparent, and the boxes are 3200 and 2688 pixels wide
 * against the 2048-pixel texture `docs/device-matrix.md` promises every iPad
 * takes. The renderer pays for both: texture upload and fill on pixels that
 * only ever show the page.
 *
 * So the ring ships as bands. The board's own oblique lattice is `u = x - y`
 * across and `v = x + y` down, which turns the rim into four straight edges and
 * each band into a slice of `v`. Inside a band the ring's pixels are one
 * interval where the slice crosses a cap of the diamond and two — one per flank
 * — where it crosses the hole the board leaves. Every edge here is a `min` or a
 * `max` of two lines, so a band's extremes are its own corners and no raster
 * work is needed to find them.
 *
 * This runs at art time, not in the game: the scenes carry the rectangles as
 * the same literals every other ground piece uses, and `apron-plates.test.ts`
 * pins those literals to this function and to the shipped files.
 */

/** The oblique ground lattice: half a tile across is a whole tile down. */
const TILE = { width: 64, height: 32 } as const;
/**
 * Longest slice of `v` in one band, in tiles. A flank of a band that long is
 * `2 * depth` tiles wider, so the shipped bands stay near 800 pixels across
 * rather than walking up to the 2048-pixel cap.
 */
const RUN = 8;

export interface ApronBand {
  /** Column of the plate, from its own left edge. */
  readonly x: number;
  /** Row of the plate, from its own top edge. */
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ApronBandsOptions {
  /** Board size in tiles. */
  readonly width: number;
  readonly height: number;
  /** Tiles of apron painted outside the rim. */
  readonly depth: number;
  /**
   * Tiles of board the ring is allowed to reach back inside the rim. The
   * village paints only outside it; the forest closes the feather its own
   * authored ground leaves, which is a band inside the rim.
   */
  readonly inset?: number;
}

interface Geometry {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly inset: number;
}

/** Leftmost board `x` the outer rectangle holds along the anti-diagonal `v`. */
function outerLeftX(v: number, geometry: Geometry): number {
  return Math.max(-geometry.depth, v - (geometry.height + geometry.depth));
}

/** Rightmost board `x` the outer rectangle holds along `v`. */
function outerRightX(v: number, geometry: Geometry): number {
  return Math.min(geometry.width + geometry.depth, v + geometry.depth);
}

/** Leftmost board `x` of the hole the board itself leaves along `v`. */
function holeLeftX(v: number, geometry: Geometry): number {
  return Math.max(geometry.inset, v - (geometry.height - geometry.inset));
}

/** Rightmost board `x` of that hole along `v`. */
function holeRightX(v: number, geometry: Geometry): number {
  return Math.min(geometry.width - geometry.inset, v - geometry.inset);
}

/** `u`, the plate's own across coordinate, for a board point on the line `v`. */
function across(x: number, v: number): number {
  return 2 * x - v;
}

/**
 * The plate column of an `u`. The lattice samples each pixel at its centre, so
 * a pixel belongs to a band when its own sample is inside it; taking the
 * ceiling of the half-open edge is what makes neighbouring bands share a border
 * without painting it twice.
 */
function columnOf(u: number, geometry: Geometry): number {
  return Math.ceil(u * TILE.width + (geometry.height + 2 * geometry.depth) * TILE.width - 0.5);
}

/** The plate row of a `v`, by the same half-pixel sample. */
function rowOf(v: number, geometry: Geometry): number {
  return Math.ceil(v * TILE.height + 2 * geometry.depth * TILE.height - 0.5);
}

/**
 * The `v` values a band may start on. Each is a corner of the outer rectangle,
 * a corner of the hole, or a place the hole opens or closes, so every edge
 * inside a band is a single straight line. Longer stretches are then cut into
 * runs so a band never walks too far sideways.
 */
function stops(geometry: Geometry): number[] {
  const { width, height, depth, inset } = geometry;
  const first = -2 * depth;
  const last = width + height + 2 * depth;
  const corners = [first, 2 * inset, height, width, width + height - 2 * inset, last].filter(
    (v) => v >= first && v <= last,
  );
  const unique = [...new Set(corners)].sort((a, b) => a - b);
  const result: number[] = [];
  for (let i = 0; i + 1 < unique.length; i++) {
    const from = unique[i] ?? 0;
    const to = unique[i + 1] ?? 0;
    const steps = Math.max(1, Math.ceil((to - from) / RUN));
    for (let step = 0; step < steps; step++) result.push(from + ((to - from) * step) / steps);
  }
  result.push(unique.at(-1) ?? last);
  return result;
}

/**
 * The `u` intervals one band holds. A band that never crosses the hole is a
 * single run; a band that does is two, and the two meet where the hole is a
 * point, so they share an edge and never a column.
 */
function spans(from: number, to: number, geometry: Geometry): readonly (readonly number[])[] {
  const ends = [from, to];
  const left = Math.min(...ends.map((v) => across(outerLeftX(v, geometry), v)));
  const right = Math.max(...ends.map((v) => across(outerRightX(v, geometry), v)));
  const innerLeft = Math.max(...ends.map((v) => across(holeLeftX(v, geometry), v)));
  const innerRight = Math.min(...ends.map((v) => across(holeRightX(v, geometry), v)));
  const crosses = ends.some((v) => holeLeftX(v, geometry) < holeRightX(v, geometry));
  if (!crosses) return [[left, right]];
  return [
    [left, innerLeft],
    [innerRight, right],
  ];
}

/**
 * The ring as bands, in paint order. Every rectangle is exact: its own rows and
 * columns are the extremes of the ring's edges across that band, so nothing
 * here covers a pixel a neighbouring band already covers.
 */
export function apronBands(options: ApronBandsOptions): ApronBand[] {
  const geometry: Geometry = {
    width: options.width,
    height: options.height,
    depth: options.depth,
    inset: options.inset ?? 0,
  };
  const bands: ApronBand[] = [];
  const edges = stops(geometry);
  for (let i = 0; i + 1 < edges.length; i++) {
    const from = edges[i] ?? 0;
    const to = edges[i + 1] ?? 0;
    const top = Math.max(0, rowOf(from, geometry));
    const bottom = Math.max(0, rowOf(to, geometry));
    if (bottom <= top) continue;
    for (const [u0, u1] of spans(from, to, geometry)) {
      const left = Math.max(0, columnOf(u0 ?? 0, geometry));
      const right = Math.max(0, columnOf(u1 ?? 0, geometry));
      if (right <= left) continue;
      bands.push({ x: left, y: top, width: right - left, height: bottom - top });
    }
  }
  return bands;
}
