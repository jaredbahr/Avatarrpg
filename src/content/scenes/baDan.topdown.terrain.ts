/**
 * Ba Dan's top-down terrain layer, as data (ADR 0104 §3, phase T3): which Wang terrain every
 * 32 px vertex carries, the road and court polylines and the noise seeds that make their edges
 * wander, the canal, the ford, the riverside path, and the rim (the cut cliff edge of the ground
 * mass) with its mouths.
 *
 * It is the prototype's classifier (`prototypes/topdown/src/v13/geo.js`: `vt`, `inMass`,
 * `cliffCode`), ported deterministically, with the roads, courts and rim re-authored from
 * `village.ts`'s rows, which stay the rules authority. The prototype's own seeded generator is
 * kept, so the rim's bites draw the same numbers in the same order; nothing here calls
 * `Math.random`, reads the DOM or holds a canvas.
 *
 * Imported by the content validation (`schemas.ts`) and the ground packer
 * (`scripts/art/topdown/pack-ground.ts`); the shipped runtime never imports it (it draws the
 * packed plates, `baDan.topdown.art.ts`).
 *
 * Coordinates. The terrain lives on the prototype's vertex grid: vertex (vx, vy) is world px
 * (32 vx, 32 vy) of the prototype's 1248 x 992 board. The game's top-down world px (40 a cell,
 * cell (0, 0) at the origin) is that minus {@link ORIGIN}, which is the prototype's "content cell
 * (cx, cy) at world px (128 + 40 cx, 192 + 40 cy)". So the plate's top-left is game px (-128, -192)
 * and the ground mass runs past the 24 x 16 grid into the rim and the void, as the prototype's does.
 */
import type { MapEdgeSide, Vec2 } from '../../core/types';

/** A Wang tile, and the vertex pitch, in world px (one art px a world px). */
export const TILE = 32;
/** Columns and rows of 32 px tiles in the plate (the prototype's `MW`, `MH`). */
export const COLS = 39;
export const ROWS = 31;
/** The plate in world px. */
export const PLATE_W = COLS * TILE;
export const PLATE_H = ROWS * TILE;
/** Game world px of the plate's top-left (vertex (0, 0)). */
export const ORIGIN: Vec2 = { x: -128, y: -192 };
/** The game's top-down cell. */
export const CELL = 40;

/** The prototype's seed (`gseed`), and its linear congruential generator. */
export const SEED = 9137;

/** A seeded generator in [0, 1): the prototype's `grnd`, with its state held by the caller. */
export interface Lcg {
  (): number;
  /** The state after the last draw, so another module can continue the same sequence. */
  readonly state: () => number;
}

export function makeLcg(seed: number): Lcg {
  let s = seed >>> 0;
  // The prototype's float form, kept as written: `s * 1103515245` passes 2^53 and rounds before the
  // `>>> 0`, so `Math.imul` would draw a different (if equally deterministic) sequence.
  const next = (): number => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296;
  return Object.assign(next, { state: () => s });
}

/** The prototype's integer hash in [0, 1]. */
export function hash2(x: number, y: number, k: number): number {
  let t = (x * 374761393 + y * 668265263 + k * 1442695041) >>> 0;
  t = Math.imul(t ^ (t >>> 13), 1274126177) >>> 0;
  return ((t ^ (t >>> 16)) & 0xffff) / 65535;
}

/** Smooth value noise in [-1, 1] with a period of about `p` units (the prototype's `vnoise`). */
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

/* ------------------------------------------------------------------ */
/* The rim                                                             */
/* ------------------------------------------------------------------ */

const rng = makeLcg(SEED);
/** Soft organic bites along one side: runs of 4 or more vertices, one tile deep (the prototype's `bites`). */
function bites(n: number): number[] {
  const a: number[] = [];
  let v = 0,
    run = 0;
  for (let i = 0; i < n; i++) {
    run++;
    if (run >= 4 && rng() < 0.22) {
      v = v ? 0 : 1;
      run = 0;
    }
    a.push(v);
  }
  return a;
}
/** The bites drawn in the prototype's order: north, south, west, east. */
const BN = bites(COLS + 1),
  BS = bites(COLS + 1),
  BW = bites(ROWS + 1),
  BE = bites(ROWS + 1);
/** The generator's state once the rim has drawn its bites: the ground bake continues from here. */
export const RNG_AFTER_RIM = rng.state();
export const RIM_BITES = { north: BN, south: BS, west: BW, east: BE } as const;

const bite = (a: readonly number[], i: number): number => a[i] ?? 0;
/**
 * The ground mass's extent per vertex row and column. The prototype's rectangle of vertices with
 * soft bites, kept straight where the east road, the canal and the ford leave. Re-authored for the
 * game's grid: the south edge drops one tile under the river path's steps so they have a lip to
 * go over, and takes its own bites (outward) elsewhere, where the prototype's ran ruler straight.
 */
export const topV = (vx: number): number => 2 + bite(BN, vx);
export const bottomV = (vx: number): number => (vx >= 26 && vx <= 31 ? 29 : 28 + bite(BS, vx));
export const leftV = (vy: number): number => (vy >= 11 && vy <= 20 ? 2 : 2 + bite(BW, vy));
export const rightV = (vy: number): number => (vy >= 14 && vy <= 20 ? 36 : 36 - bite(BE, vy));

export function inMass(vx: number, vy: number): boolean {
  return vx >= leftV(vy) && vx <= rightV(vy) && vy >= topV(vx) && vy <= bottomV(vx);
}

/** Cliff code per vertex: 1 ground, 0 void, 2 the cliff face's foot (void directly below ground). */
export function cliffCode(vx: number, vy: number): 0 | 1 | 2 {
  return inMass(vx, vy) ? 1 : inMass(vx, vy - 1) ? 2 : 0;
}

/* ------------------------------------------------------------------ */
/* Roads, courts and water                                             */
/* ------------------------------------------------------------------ */

/** A polyline in vertices and its half width in vertices. */
export interface Road {
  readonly id: string;
  readonly points: readonly (readonly [number, number])[];
  readonly halfWidth: number;
}

/**
 * The roads, from the game's rows (vertex vx = 4 + 1.25 cx, vy = 6 + 1.25 cy for a cell's corner):
 * - the east road on rows 7-8 (centre y 320 world px, vy 16), from the ford past the west lip to the
 *   walkway over the east lip; the prototype's sat half a row low, so it follows the game;
 * - the north lane along the house fronts (row 4) and its spur down column 9 to the bridge, both as
 *   the prototype has them, which already match;
 * - the paving south of the road at columns 9-13 (row 9), where the lanes meet it;
 * - the dry crossing at column 13 to the watch-post plaza (rows 5-6);
 * - the lane between the south houses (columns 10-12) down to the well court;
 * - the south lane along the south house fronts, row 14 (the prototype's sat 1.5 rows lower, under
 *   houses that stood at rows 13-15).
 */
export const ROADS: readonly Road[] = [
  {
    id: 'east-road',
    points: [
      [2, 16.1],
      [8, 15.9],
      [13, 16.2],
      [19, 15.9],
      [25, 16.2],
      [31, 15.9],
      [35, 16.1],
      [38, 16],
    ],
    halfWidth: 1.5,
  },
  {
    // The gate: the road widens where it leaves over the east lip, so both exit rows run on stone.
    id: 'east-gate',
    points: [
      [31, 16.4],
      [38, 16.4],
    ],
    halfWidth: 1.6,
  },
  {
    id: 'south-square',
    points: [
      [16, 17.9],
      [21, 17.9],
    ],
    halfWidth: 0.9,
  },
  {
    id: 'north-lane',
    points: [
      [10, 10.85],
      [13, 10.65],
      [16, 10.95],
      [20, 10.65],
      [24, 10.95],
      [27, 10.65],
      [30, 10.85],
    ],
    halfWidth: 1.15,
  },
  {
    id: 'bridge-spur',
    points: [
      [15.9, 10.8],
      [15.9, 13.5],
    ],
    halfWidth: 1.2,
  },
  {
    id: 'dry-crossing',
    points: [
      [20.9, 15],
      [23.5, 13.6],
      [26, 14.6],
    ],
    halfWidth: 1.25,
  },
  {
    id: 'well-lane',
    points: [
      [18.5, 17],
      [18.4, 20],
      [19.2, 22.6],
    ],
    halfWidth: 1.15,
  },
  {
    id: 'south-lane',
    points: [
      [11, 24.1],
      [17, 23.8],
      [23, 24.2],
      [27.5, 24],
    ],
    halfWidth: 1.05,
  },
];

/** A round paved court: centre and radius in vertices. */
export interface Court {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

/** Mira's court round her table (the rest spot (10, 5)), the well court at (12, 13), the watch-post plaza. */
export const COURTS: readonly Court[] = [
  { id: 'mira-court', x: 16.2, y: 11.8, r: 2.6 },
  { id: 'well-court', x: 19.4, y: 22.4, r: 2.4 },
  { id: 'watch-plaza', x: 23.6, y: 14.2, r: 2.4 },
];

/** The noise seeds the paved edges and the quay draw on, so a reader can find them in one place. */
export const NOISE = {
  pavedLow: [7, 2.2, 0.6],
  pavedHigh: [11, 1.0, 0.55],
  quay: [5, 1.8, 0.05],
  pathSpill: [3, 2.6],
} as const;

/** The canal: water on one vertex row from the west lip to the dry crossing, stone kerbs either side. */
export const CANAL = { row: 14, from: 2, to: 20, kerbTo: 21 } as const;
/** The flooded ford where the east road ends at the west: cells (0, 7) and (0, 8). */
export const FORD = { x0: 4, x1: 5, y0: 15, y1: 17, lipRow: 18 } as const;
/**
 * The riverside path, a trodden dirt track (a polyline in vertices, its half width, and how much its
 * edge wanders) from below the sign at (18, 12) down through (19, 15) to the steps over the south lip.
 */
export const RIVER_PATH: Road & { readonly wander: number } = {
  id: 'riverside-path',
  points: [
    [27.9, 22.6],
    [29.0, 24.5],
    [28.0, 26.6],
    [28.9, 28.4],
    [28.5, 30],
  ],
  halfWidth: 1.15,
  wander: 0.7,
};

const segD = (x: number, y: number, a: readonly number[], b: readonly number[]): number => {
  const ax = a[0] ?? 0,
    ay = a[1] ?? 0,
    vx = (b[0] ?? 0) - ax,
    vy = (b[1] ?? 0) - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(x - ax - vx * t, y - ay - vy * t);
};
const lineD = (x: number, y: number, pts: Road['points']): number => {
  let d = 1e9;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i];
    if (a && b) d = Math.min(d, segD(x, y, a, b));
  }
  return d;
};

export function paved(vx: number, vy: number): boolean {
  const n =
    vnoise(vx, vy, NOISE.pavedLow[0], NOISE.pavedLow[1]) * NOISE.pavedLow[2] +
    vnoise(vx, vy, NOISE.pavedHigh[0], NOISE.pavedHigh[1]) * NOISE.pavedHigh[2];
  for (const road of ROADS) if (lineD(vx, vy, road.points) <= road.halfWidth + n) return true;
  for (const c of COURTS) if (Math.hypot(vx - c.x, (vy - c.y) * 1.15) <= c.r + n * 1.2) return true;
  return false;
}

/** A vertex's terrain: G grass, C cobble, W water, D dirt, V void (outside the ground mass). */
export type Terrain = 'G' | 'C' | 'W' | 'D' | 'V';

function vtRaw(vx: number, vy: number): Terrain {
  if (!inMass(vx, vy)) return 'V';
  if (vy === CANAL.row && vx >= CANAL.from && vx <= CANAL.to) return 'W';
  if (vx >= FORD.x0 && vx <= FORD.x1 && vy >= FORD.y0 && vy <= FORD.y1) return 'W';
  if (vx >= CANAL.from && vx <= CANAL.kerbTo && (vy === CANAL.row - 1 || vy === CANAL.row + 1))
    return 'C';
  if (vx >= FORD.x0 - 1 && vx <= FORD.x1 + 1 && vy === FORD.lipRow) return 'C';
  if (
    lineD(vx, vy, RIVER_PATH.points) <=
    RIVER_PATH.halfWidth + vnoise(vx, vy, NOISE.pathSpill[0], NOISE.pathSpill[1]) * RIVER_PATH.wander
  )
    return 'D';
  if (paved(vx, vy)) return 'C';
  if (
    vx >= 4 &&
    vx <= 19 &&
    (vy === CANAL.row - 2 || vy === CANAL.row + 2) &&
    vnoise(vx, vy, NOISE.quay[0], NOISE.quay[1]) > NOISE.quay[2]
  )
    return 'C';
  return 'G';
}

const VT = new Map<number, Terrain>();
/** A vertex's terrain, tidied: a lone cobble vertex (fewer than two paved or water sides) becomes grass. */
export function vt(vx: number, vy: number): Terrain {
  const key = vy * 1000 + vx;
  const hit = VT.get(key);
  if (hit) return hit;
  let v = vtRaw(vx, vy);
  if (v === 'C') {
    const nc = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].filter(([dx, dy]) => {
      const q = vtRaw(vx + (dx ?? 0), vy + (dy ?? 0));
      return q === 'C' || q === 'W';
    }).length;
    if (nc < 2) v = 'G';
  }
  VT.set(key, v);
  return v;
}

/** The Wang set a tile's corners draw from: grass and cobble, the canal, dirt (the prototype's `SETS`). */
export function wangSet(corners: readonly Terrain[]): 'gc' | 'canal' | 'dirt' | null {
  const key = [...new Set(corners)].sort().join('');
  const sets: Record<string, 'gc' | 'canal' | 'dirt'> = {
    G: 'gc',
    C: 'gc',
    W: 'canal',
    D: 'dirt',
    CG: 'gc',
    CW: 'canal',
    DG: 'dirt',
  };
  return sets[key] ?? null;
}

/** The four corners of tile (tx, ty): top-left, top-right, bottom-left, bottom-right. */
export function tileCorners(tx: number, ty: number): [Terrain, Terrain, Terrain, Terrain] {
  return [vt(tx, ty), vt(tx + 1, ty), vt(tx, ty + 1), vt(tx + 1, ty + 1)];
}

/* ------------------------------------------------------------------ */
/* Reading the baked ground at a point                                 */
/* ------------------------------------------------------------------ */

/** What the baked ground is at a point: walkable ground, water, the cliff tile at the lip, or void. */
export type GroundClass = 'ground' | 'water' | 'cliff' | 'void';

/**
 * The ground at game world px (x, y), as the bake draws it. A point in a tile with any void corner
 * is on the cliff tile (the lip runs through it), or the void itself where its nearest vertex is
 * void; otherwise its nearest vertex's terrain decides (each quarter of a Wang tile follows its
 * corner), and water is water.
 */
export function classifyPoint(x: number, y: number): { ground: GroundClass; terrain: Terrain } {
  const px = x - ORIGIN.x,
    py = y - ORIGIN.y;
  const tx = Math.floor(px / TILE),
    ty = Math.floor(py / TILE);
  const near = vt(Math.round(px / TILE), Math.round(py / TILE));
  if (near === 'V') return { ground: 'void', terrain: 'V' };
  if (tileCorners(tx, ty).includes('V')) return { ground: 'cliff', terrain: near };
  return { ground: near === 'W' ? 'water' : 'ground', terrain: near };
}

/* ------------------------------------------------------------------ */
/* Mouths                                                              */
/* ------------------------------------------------------------------ */

/**
 * A rim mouth: where a way leaves the board over the lip. Each cell, walked outward from its centre
 * along `side`, must stay on a road or path (or a deck) until the ground ends at the rim, within
 * {@link MOUTH_REACH} cells. The east road leaves on its walkway, the river path down its steps.
 */
export interface RimMouth {
  readonly id: string;
  readonly side: MapEdgeSide;
  readonly cells: readonly Vec2[];
}

export const MOUTH_REACH = 3;

export const MOUTHS: readonly RimMouth[] = [
  {
    id: 'east-road',
    side: 'east',
    cells: [
      { x: 23, y: 7 },
      { x: 23, y: 8 },
    ],
  },
  {
    // The rules' river path is (18..20, 15); the track and its steps leave through the middle cell.
    id: 'riverside-steps',
    side: 'south',
    cells: [{ x: 19, y: 15 }],
  },
];

/** The terrain layer as the content validation reads it. */
export interface TopDownTerrainLayer {
  readonly classify: (x: number, y: number) => { ground: GroundClass; terrain: Terrain };
  readonly mouths: readonly RimMouth[];
  readonly mouthReach: number;
}

export const BA_DAN_TOPDOWN_TERRAIN: TopDownTerrainLayer = {
  classify: classifyPoint,
  mouths: MOUTHS,
  mouthReach: MOUTH_REACH,
};
