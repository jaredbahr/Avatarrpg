/**
 * The quarry boards' top-down terrain (ADR 0104 §3, phase T5): the prototype's quarry ground
 * (`prototypes/topdown/src/b3/world_quarry.js` `bakeQuarry`, owner-approved in
 * `tutorial-demo.html`) as a pure classifier over each map's authored rows. The ground packer
 * (`scripts/art/topdown/boards/quarry.ts`) bakes its plates from the same functions and the content
 * validation reads them through `classify`; the shipped runtime never imports this.
 *
 * Every pixel is classed from the rows: the cell values are blended between cell centres
 * (smoothstep) and broken by two octaves of value noise, so no edge follows the cell grid. Raised
 * rock (the legend's elevation 1 and 2: ledges, terraces, the cut walls) is a shelf on its own
 * cells, and its cut face hangs `Q_FACE` px a tier below the shelf's front edge. The board sits on
 * a mass of rock that ends in the rim cliff over the void; the road mouths run off the plate.
 *
 * The plate is the prototype's: 960 x 680 px, the 20 x 12 grid at (80, 128) in it. Nothing here
 * draws a random number: the prototype's quarry bake uses only its integer hash and value noise.
 *
 * **Where it differs from the prototype**: `guard` (on by default; off reproduces the prototype's
 * classes exactly). The prototype's shelf edges wander up to half a cell either way, and a two-tier
 * face hangs 26 px, so a face could cover where a figure stands on a walkable cell below it, or a
 * shelf reach into it. The rules win: a smooth bump round each walkable cell's standing box (its
 * centre, a figure's width either side and a little below it) keeps a higher shelf, and its face,
 * out of it, and keeps the cell's own tier in it. A face may still hang over the top `Q_FACE` px
 * of the cell below, never over its centre (`validateTopDownLayout`). Each blocked rock cell keeps
 * rock at its centre. The bump has no edge of its own; elsewhere the edges are the prototype's.
 */
import type { MapEdgeSide, TileTemplate, Vec2 } from '../../core/types';
import { AMBUSH_ROAD, QUARRY_FLOOR, QUARRY_GATE } from '../maps/combat';
import { LEGEND } from '../maps/legend';
import {
  hash2,
  vnoise,
  type PointClass,
  type QuarryTerraceTerrain,
  type RimMouth,
} from './baDan.topdown.terrain';

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
/** A cut face hangs this many px a tier below its shelf (the prototype's `Q_FACE`). */
export const Q_FACE = 13;

/** The prototype's terrain classes (`bakeQuarry`'s `cls`). */
export const QUARRY = { floor: 0, road: 1, water: 2, pit: 3, grass: 4, rock: 5, void: 9 } as const;
export type QuarryClass = (typeof QUARRY)[keyof typeof QUARRY];

/** One quarry board's terrain: its map, the rows and the prototype's per-level switches. */
export interface QuarryTerrainConfig {
  /** The map id (`MapDef.id`). */
  readonly mapId: string;
  /** The prototype's level key (`levels.js`), for the record. */
  readonly level: 'gate' | 'cutting' | 'floor';
  readonly rows: readonly string[];
  /**
   * The gate's south curtain (`#` and `G` on the last row) is drawn as cut rock, not floor: the
   * prototype's `qcell` special case for its gate board.
   */
  readonly southWallIsRock?: boolean;
  /** The road's mouths: rows of the west and east edge cells that run off the plate. */
  readonly mouths: readonly RimMouth[];
}

/** What the bake lays per plate pixel: the level, the class and, under a shelf, its cut face. */
export interface QuarryGround {
  readonly config: QuarryTerrainConfig;
  readonly rows: QuarryRows;
  /** -1 the void, 0 the floor, 1 and 2 the shelves. */
  readonly lev: Int8Array;
  readonly cls: Uint8Array;
  /** 0, or the row of the face (1 its lit lip, `faceH` its foot) this pixel is. */
  readonly face: Uint8Array;
  readonly faceH: Uint8Array;
}

const legend = (c: string): Partial<TileTemplate> => LEGEND[c] ?? LEGEND['.'] ?? {};
const elevation = (c: string): number => legend(c).elevation ?? 0;
const blocked = (c: string): boolean => legend(c).blocked === true;

/** The pieces of the bake that read the rows, for one board. */
export class QuarryRows {
  readonly rows: readonly string[];
  private readonly stubs: readonly Stub[];

  constructor(readonly config: QuarryTerrainConfig) {
    this.rows = config.rows;
    this.stubs = roadStubs(this);
  }

  /** The rows' character at cell (x, y), clamped onto the board. */
  ch(x: number, y: number): string {
    const row = this.rows[Math.max(0, Math.min(GH - 1, y))] ?? '';
    return row[Math.max(0, Math.min(GW - 1, x))] ?? '.';
  }

  /**
   * The authored character, extended past the board: a walkable edge cell carries on (an exit), the
   * rest is rock. Spilled oil beside the road is road (it lies on the road; it does not cut it).
   * The prototype's `qcell`.
   */
  qcell(x: number, y: number): string {
    const cx = Math.max(0, Math.min(GW - 1, x)),
      cy = Math.max(0, Math.min(GH - 1, y)),
      c = this.ch(cx, cy);
    const oilOnRoad =
      c === 'o' &&
      (this.ch(Math.max(0, cx - 1), cy) === '=' || this.ch(Math.min(GW - 1, cx + 1), cy) === '=');
    if (x === cx && y === cy)
      return this.config.southWallIsRock && y === GH - 1 && (c === '#' || c === 'G')
        ? 'X'
        : oilOnRoad
          ? '='
          : c;
    if (oilOnRoad) return '=';
    if (blocked(c) || elevation(c)) return 'X';
    return c === '=' || c === '.' || c === ',' ? c : 'X';
  }

  /** A smoothstep-blended cell indicator at plate px (the prototype's `cellField`). */
  field(fn: (c: string) => number, wx: number, wy: number): number {
    const fx = (wx - GRID.x) / CELL - 0.5,
      fy = (wy - GRID.y) / CELL - 0.5,
      ix = Math.floor(fx),
      iy = Math.floor(fy),
      sx0 = fx - ix,
      sy0 = fy - iy;
    const sx = sx0 * sx0 * (3 - 2 * sx0),
      sy = sy0 * sy0 * (3 - 2 * sy0);
    return (
      fn(this.qcell(ix, iy)) * (1 - sx) * (1 - sy) +
      fn(this.qcell(ix + 1, iy)) * sx * (1 - sy) +
      fn(this.qcell(ix, iy + 1)) * (1 - sx) * sy +
      fn(this.qcell(ix + 1, iy + 1)) * sx * sy
    );
  }

  /** The rock mass: an inset rectangle with soft organic bites, open where a road leaves the board. */
  inMass(wx: number, wy: number): boolean {
    const n =
      vnoise(wx, wy, 201, 30) * 14 + vnoise(wx, wy, 203, 9) * 7 + vnoise(wx, wy, 205, 17) * 9;
    const L = 18 + n,
      R = PLATE_W - 18 - n,
      Tp = 22 + n,
      B = PLATE_H - 46 + n;
    if (wy >= Tp && wy <= B && wx >= L && wx <= R) return true;
    // a road mouth: the road's own rows carry it out to the frame
    const cy = Math.floor((wy - GRID.y) / CELL);
    if (cy >= 0 && cy < GH && wy >= Tp && wy <= B) {
      const c = wx < L ? this.ch(0, cy) : this.ch(GW - 1, cy);
      if (c === '=') return true;
    }
    return false;
  }

  /** Over 0 where a road stub's end rounds off into a tongue (the prototype's `stubTip`). */
  stubTip(x: number, y: number): number {
    let t = 0;
    for (const b of this.stubs) {
      const L = 70;
      const dx = b.side ? b.xEnd - x : x - b.xEnd;
      const f = (dx + L) / L;
      if (f <= 0.35) continue;
      const v = Math.abs(y - b.yc) / b.half;
      t = Math.max(
        t,
        (Math.min(1.2, f) - 0.35) * 0.55 + Math.max(0, v - 0.45) * (f - 0.35) * 1.6 - 0.0,
      );
    }
    return t;
  }

  get roadStubs(): readonly Stub[] {
    return this.stubs;
  }
}

/** A road that ends inside the board: its side (0 west, 1 east), its last column's edge, its rows. */
export interface Stub {
  readonly side: 0 | 1;
  readonly xEnd: number;
  readonly yc: number;
  readonly half: number;
}

/** The road stubs that end inside the board (the prototype's `roadStubs`). */
function roadStubs(q: QuarryRows): Stub[] {
  const out: Stub[] = [];
  for (const side of [0, 1] as const) {
    const R = (ch: string): boolean => ch === '=' || ch === 'o';
    const end = (r: number): number => {
      if (side === 0) {
        if (!R(q.ch(0, r))) return -1;
        let e = 0;
        while (e + 1 < GW && R(q.ch(e + 1, r))) e++;
        return e >= GW - 1 ? -1 : e;
      }
      if (!R(q.ch(GW - 1, r))) return -1;
      let e = GW - 1;
      while (e - 1 >= 0 && R(q.ch(e - 1, r))) e--;
      return e <= 0 ? -1 : e;
    };
    let y = 0;
    while (y < GH) {
      const e0 = end(y);
      if (e0 < 0) {
        y++;
        continue;
      }
      let y1 = y;
      while (y1 + 1 < GH && end(y1 + 1) === e0) y1++;
      // a band beside more road is not an end
      const adj = (y > 0 && q.ch(e0, y - 1) === '=') || (y1 < GH - 1 && q.ch(e0, y1 + 1) === '=');
      if (!adj)
        out.push({
          side,
          xEnd: side ? GRID.x + e0 * CELL : GRID.x + (e0 + 1) * CELL,
          yc: GRID.y + ((y + y1 + 1) * CELL) / 2,
          half: ((y1 - y + 1) * CELL) / 2,
        });
      y = y1 + 1;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* The guard: the rules win where a figure stands                      */
/* ------------------------------------------------------------------ */

/** The standing box round a cell's centre: a figure's width either side, and its feet below. */
const BOX_HALF_W = 12;
const BOX_BELOW = 8;
/**
 * How far the guard's bump falls off outside its box, in px: gently along an edge, so where it
 * holds an edge back the edge eases there rather than stepping, and quickly across it.
 */
const FALL_X = 8;
const FALL_Y = 3;
/** A face is 13 px a tier, give or take 2 (its noise), and one more so its foot clears the box. */
const reach = (tiers: number): number => tiers * Q_FACE + 3;
/** 1 inside the box, falling smoothly to 0 outside it. */
function boxBump(px: number, py: number, x0: number, x1: number, y0: number, y1: number): number {
  const dx = Math.max(x0 - px, 0, px - x1) / FALL_X,
    dy = Math.max(y0 - py, 0, py - y1) / FALL_Y;
  if (dx >= 1 || dy >= 1) return 0;
  const d = Math.hypot(dx, dy);
  if (d >= 1) return 0;
  const t = 1 - d;
  return t * t * (3 - 2 * t);
}

/**
 * How much harder a shelf of level `level` finds it to reach plate px (x, y) (`up`), and how much
 * easier the level finds it to stay (`keep`), from the walkable cells round it: a higher shelf, and
 * the face hanging below it, stay out of a walkable cell's standing box; a raised walkable cell
 * keeps its own tier there; a blocked rock cell keeps rock at its centre.
 */
function guardAt(q: QuarryRows, x: number, y: number, level: 1 | 2): { up: number; keep: number } {
  const cx = Math.floor((x - GRID.x) / CELL),
    cy = Math.floor((y - GRID.y) / CELL);
  let up = 0,
    keep = 0;
  // the cells round it, on the board's rows and on the road running on past its sides (a mouth)
  for (let gy = cy - 1; gy <= cy + 2; gy++)
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      if (gy < 0 || gy >= GH) continue;
      const c = q.qcell(gx, gy);
      const X = GRID.x + gx * CELL + CELL / 2,
        Y = GRID.y + gy * CELL + CELL / 2;
      const e = elevation(c);
      if (blocked(c)) {
        if (e >= level) keep = Math.max(keep, boxBump(x, y, X - 4, X + 4, Y - 4, Y + 4));
        continue;
      }
      if (e < level)
        up = Math.max(
          up,
          boxBump(x, y, X - BOX_HALF_W, X + BOX_HALF_W, Y - reach(level - e), Y + BOX_BELOW),
        );
      else
        keep = Math.max(
          keep,
          boxBump(x, y, X - BOX_HALF_W, X + BOX_HALF_W, Y - BOX_BELOW, Y + BOX_BELOW),
        );
    }
  return { up, keep };
}

/**
 * How far a shelf's edge steps back up the shelf over a walkable cell below it: past where a face
 * of that many tiers would reach the cell's standing box, with room either way for the edge's
 * wander. Under a raised walkable cell the edge has its own box to keep clear of too, so it steps
 * back half as far.
 */
const STEP_BACK = { blocked: [0, 8, 22], walkable: [0, 4, 11] } as const;
const STEP_HOLD = 24;

/**
 * How far down the shelves are read at plate px (x, y): over each walkable cell with a higher cell
 * above it, the edge between them steps back up the shelf by `STEP_BACK`, so the face hangs over
 * the cell's top and clear of its centre. Blended smoothly along the edge between cell centres and
 * faded out a cell above and below it, so the edge keeps the prototype's wander, moved up.
 */
function stepBack(q: QuarryRows, x: number, y: number): number {
  const fx = (x - GRID.x) / CELL - 0.5,
    ix = Math.floor(fx),
    t = fx - ix,
    sx = t * t * (3 - 2 * t);
  // the step at the top of row `by`, along the edge
  const step = (cx: number, by: number): number => {
    if (by <= 0 || by >= GH) return 0;
    const below = q.qcell(cx, by),
      above = q.qcell(cx, by - 1);
    if (blocked(below)) return 0;
    const drop = Math.min(2, elevation(above) - elevation(below));
    return drop > 0 ? (STEP_BACK[blocked(above) ? 'blocked' : 'walkable'][drop] ?? 0) : 0;
  };
  // the two cell edges either side: the full step for `STEP_HOLD` px above an edge (where the
  // shelf's own edge wanders), fading out by the cell's centre above it and a cell below it (slowly
  // enough that the read never folds back on itself)
  const b0 = Math.floor((y - GRID.y) / CELL);
  let s = 0;
  for (const by of [b0, b0 + 1]) {
    const along = step(ix, by) * (1 - sx) + step(ix + 1, by) * sx;
    if (!along) continue;
    const d = GRID.y + by * CELL - y;
    const u =
      d >= 0
        ? Math.min(1, Math.max(0, (CELL - d) / (CELL - STEP_HOLD)))
        : Math.max(0, 1 + d / CELL);
    s += along * u * u * (3 - 2 * u);
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* The levels, classes and faces                                       */
/* ------------------------------------------------------------------ */

/**
 * Steps 1 and 2 of the prototype's `bakeQuarry`: each plate pixel's level and class from the rows,
 * then the cut faces below every higher shelf. With `guard` off, exactly the prototype's.
 */
export function quarryGround(config: QuarryTerrainConfig, guard = true): QuarryGround {
  const q = new QuarryRows(config);
  const PW = PLATE_W,
    PH = PLATE_H;
  const lev = new Int8Array(PW * PH),
    cls = new Uint8Array(PW * PH);
  const nv = (x: number, y: number): number =>
    vnoise(x, y, 211, 17) * 0.24 + vnoise(x, y, 212, 7) * 0.16 + vnoise(x, y, 213, 3) * 0.07;
  const elev1 = (c: string): number => (elevation(c) >= 1 ? 1 : 0);
  const elev2 = (c: string): number => (elevation(c) >= 2 ? 1 : 0);
  const isPit = (c: string): number => (c === 'P' ? 1 : 0);
  const isPool = (c: string): number => (c === 'W' || c === '~' ? 1 : 0);
  const isRoad = (c: string): number => (c === '=' ? 1 : 0);
  const isGrass = (c: string): number => (c === ',' || c === 'T' ? 1 : 0);
  const isFloor = (c: string): number =>
    c !== '=' && c !== ',' && c !== 'T' && c !== '~' && c !== 'W' && !elevation(c) ? 1 : 0;
  // 1. levels and classes
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++) {
      const i = y * PW + x;
      if (!q.inMass(x, y)) {
        lev[i] = -1;
        cls[i] = QUARRY.void;
        continue;
      }
      // the shelves are read a little further down where a face hangs over walkable ground, so the
      // whole edge, its wander kept, steps back up the shelf
      const sy = guard ? y + stepBack(q, x, y) : y;
      const n = nv(x, sy),
        h1 = q.field(elev1, x, sy) + n,
        h2 = q.field(elev2, x, sy) + n;
      let t1 = 0.5,
        t2 = 0.5;
      if (guard) {
        const g1 = guardAt(q, x, y, 1),
          g2 = guardAt(q, x, y, 2);
        t1 += g1.up - g1.keep;
        t2 += g2.up - g2.keep;
      }
      lev[i] = h2 > t2 ? 2 : h1 > t1 ? 1 : 0;
      if (lev[i]) {
        cls[i] = QUARRY.rock;
        continue;
      }
      const m =
        vnoise(x, y, 221, 19) * 0.26 + vnoise(x, y, 222, 8) * 0.16 + vnoise(x, y, 223, 3) * 0.07;
      const fp = q.field(isPit, x, y),
        fw = q.field(
          isPool,
          x + Math.round(vnoise(y, 3, 224, 17) * 10),
          y + Math.round(vnoise(x, 4, 225, 17) * 8),
        );
      // only near a pit or a pool: the noise alone never opens a speck of either
      if (fp > 0.08 && fp + m * 1.4 > 0.62) cls[i] = QUARRY.pit;
      else if (fw > 0.08 && fw + m * 1.7 > 0.55) cls[i] = QUARRY.water;
      else {
        // the strongest of road, grass and floor wins (no band of a third ground between two others)
        const fr =
          q.field(
            isRoad,
            x + Math.round(vnoise(y, 5, 228, 26) * 13 + vnoise(y, 6, 230, 8) * 4),
            y + Math.round(vnoise(x, 7, 227, 36) * 14 + vnoise(x, 8, 226, 13) * 5),
          ) +
          m * 1.7 -
          q.stubTip(x, y);
        const gf = q.field(isGrass, x, y);
        const fg = gf > 0.03 || q.field(isPool, x, y) > 0.03 ? gf - m : -9;
        const ff = q.field(isFloor, x, y) + vnoise(x, y, 229, 13) * 0.2;
        cls[i] = fr >= fg && fr >= ff ? QUARRY.road : fg >= ff ? QUARRY.grass : QUARRY.floor;
      }
    }
  // 2. the cut faces: below a higher shelf, Q_FACE px a tier (the face belongs to the shelf above it)
  const face = new Uint8Array(PW * PH),
    faceH = new Uint8Array(PW * PH);
  for (let x = 0; x < PW; x++)
    for (let y = 1; y < PH; y++) {
      const i = y * PW + x,
        li = lev[i] ?? 0;
      if (li < 0) continue;
      for (let k = 1; k <= 2 * Q_FACE + 3 && y - k >= 0; k++) {
        const j = (y - k) * PW + x,
          up = lev[j] ?? 0;
        if (up <= li) {
          if (face[j]) continue;
          else break;
        }
        const F = (up - li) * Q_FACE + Math.round(vnoise(x, y - k, 231, 6) * 2);
        if (k <= F) {
          face[i] = k;
          faceH[i] = F;
        }
        break;
      }
    }
  return { config, rows: q, lev, cls, face, faceH };
}

/* ------------------------------------------------------------------ */
/* The validation's reader                                             */
/* ------------------------------------------------------------------ */

const cache = new Map<string, QuarryGround>();
/** A board's ground, baked once per process (the validation and the packer share it). */
export function groundOf(config: QuarryTerrainConfig): QuarryGround {
  let g = cache.get(config.mapId);
  if (!g || g.config !== config) {
    g = quarryGround(config);
    cache.set(config.mapId, g);
  }
  return g;
}

/** How far down the void the rim's face shows under the mass before it falls into the dark. */
export const RIM_DEPTH = 34;

/**
 * The ground at game world px (x, y), as the bake lays it: off the plate and below the rim is the
 * void, the rim's face under the mass a cliff, a pit a hole (`void`), a shelf's cut face `face`,
 * the top of a rock cell the rules block `rock`. Walkable ground on another tier than its cell's
 * (a shelf reaching into a floor cell, the floor into a shelf) is a `cliff`: a figure there would
 * stand on the wrong height. The pool on the road is shallow water the rules walk through (`~`).
 */
export function classifyQuarry(config: QuarryTerrainConfig, x: number, y: number): PointClass {
  const px = Math.floor(x - ORIGIN.x),
    py = Math.floor(y - ORIGIN.y);
  if (px < 0 || py < 0 || px >= PLATE_W || py >= PLATE_H) return { ground: 'void', terrain: 'V' };
  const g = groundOf(config);
  const i = py * PLATE_W + px;
  const c = g.cls[i] ?? QUARRY.void;
  if (c === QUARRY.void) {
    let k = 0;
    while (k < 40 && py - k - 1 >= 0 && g.cls[(py - k - 1) * PLATE_W + px] === QUARRY.void) k++;
    const above = py - k - 1 >= 0 ? g.cls[(py - k - 1) * PLATE_W + px] : QUARRY.void;
    return above !== QUARRY.void && k < RIM_DEPTH
      ? { ground: 'cliff', terrain: 'V' }
      : { ground: 'void', terrain: 'V' };
  }
  if (g.face[i]) return { ground: 'face', terrain: 'V' };
  if (c === QUARRY.pit) return { ground: 'void', terrain: 'V' };
  const cell = g.rows.qcell(Math.floor((px - GRID.x) / CELL), Math.floor((py - GRID.y) / CELL));
  const level = g.lev[i] ?? 0;
  if (blocked(cell)) return level > 0 ? { ground: 'rock', terrain: 'V' } : onGround(c);
  if (level !== elevation(cell)) return { ground: 'cliff', terrain: 'V' };
  return onGround(c);
}

function onGround(c: number): PointClass {
  if (c === QUARRY.rock) return { ground: 'ground', terrain: 'C' };
  if (c === QUARRY.grass) return { ground: 'ground', terrain: 'G' };
  if (c === QUARRY.water) return { ground: 'ground', terrain: 'W' };
  return { ground: 'ground', terrain: 'D' };
}

/** From an edge cell's centre to the plate's side: two and a half cells. */
export const MOUTH_REACH = 3;

/** The road's mouths: the given rows of an edge column, running off the plate's side. */
export const mouth = (id: string, side: MapEdgeSide, rows: readonly number[]): RimMouth => ({
  id,
  side,
  cells: rows.map((y) => ({ x: side === 'west' ? 0 : GW - 1, y })),
});

/* ------------------------------------------------------------------ */
/* The three boards                                                    */
/* ------------------------------------------------------------------ */

/** The quarry gate (`enc_quarry_gate`): the road through the gatehouse yard, east and west. */
export const QUARRY_GATE_TERRAIN: QuarryTerrainConfig = {
  mapId: 'quarry_gate',
  level: 'gate',
  rows: QUARRY_GATE.rows,
  southWallIsRock: true,
  mouths: [mouth('west-road', 'west', [5, 6]), mouth('east-road', 'east', [5, 6])],
};

/** The Cutting (`enc_ambush`): the four-wide road between the cut walls, the pool in its middle. */
export const CUTTING_TERRAIN: QuarryTerrainConfig = {
  mapId: 'ambush_road',
  level: 'cutting',
  rows: AMBUSH_ROAD.rows,
  mouths: [mouth('west-road', 'west', [4, 5, 6, 7]), mouth('east-road', 'east', [4, 5, 6, 7])],
};

/** The Driller floor (`enc_grumbler`): the terraced pit, the haul road in from the west. */
export const QUARRY_FLOOR_TERRAIN: QuarryTerrainConfig = {
  mapId: 'quarry_floor',
  level: 'floor',
  rows: QUARRY_FLOOR.rows,
  mouths: [mouth('west-road', 'west', [5, 6])],
};

export const QUARRY_TERRAINS: readonly QuarryTerrainConfig[] = [
  QUARRY_GATE_TERRAIN,
  CUTTING_TERRAIN,
  QUARRY_FLOOR_TERRAIN,
];

/** A board's terrain as the layout validation reads it. */
export const quarryTerrain = (config: QuarryTerrainConfig): QuarryTerraceTerrain => ({
  kind: 'quarry-terrace',
  classify: (x, y) => classifyQuarry(config, x, y),
  mouths: config.mouths,
  mouthReach: MOUTH_REACH,
});
