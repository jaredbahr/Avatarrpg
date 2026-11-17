/**
 * Saltstep and Emberwatch's top-down terrain (RG-02, ADR 0104 §3): one classifier for the region's boards, as a pure
 * function of each map's authored rows. The ground packer (`scripts/art/topdown/boards/rg02.ts`) bakes its plates
 * from it and the content validation reads it through `classify`; the shipped runtime never imports it.
 *
 * Like the Forest Road's (`forestRoad.topdown.terrain.ts`), every pixel is classed from 32 px vertices that sample the
 * 40 px cells, blended between them and broken by two octaves of value noise, so no edge follows the cell grid. A
 * bump round each cell's centre, gone by the cell's edge, keeps the cell's own class where a figure stands (the rules win). Outside the
 * grid the rows run on: an edge cell's class carries on to the plate's side, and the rim (`T`) is the void the map
 * edge falls into (ADR 0103).
 *
 * The plate runs two cells past the grid either side, three above and two below, as the Act I boards' do.
 */
import type { MapEdgeSide, Vec2 } from '../../core/types';
import { hash2, vnoise, type PointClass, type RimMouth } from './baDan.topdown.terrain';

export { hash2, vnoise };

export const TILE = 32;
export const CELL = 40;
/** The grid's top-left in plate px. */
export const GRID = { x: 80, y: 120 } as const;

/** The classes the bake lays: the harbour, the planks, the quay's sand, packed earth, flagstones, a puddle, the void. */
export const RG = { water: 0, deck: 1, sand: 2, earth: 3, stone: 4, puddle: 5, void: 6 } as const;
export type RgClass = (typeof RG)[keyof typeof RG];
const CLASSES: readonly RgClass[] = [0, 1, 2, 3, 4, 5, 6];

/** One RG-02 board's terrain: its map's rows and what each character is drawn as. */
export interface Rg02TerrainConfig {
  readonly mapId: string;
  readonly rows: readonly string[];
  /** The class each row character is drawn as; a character not listed is packed earth. */
  readonly chars: Readonly<Record<string, RgClass>>;
  /** What lies past the grid where the rows do not carry on (the harbour, or the void). */
  readonly beyond: RgClass;
  /** Row characters that carry on only one cell past the grid, not to the plate's edge (a yard's clutter on its rim). */
  readonly ends?: string;
  readonly mouths: readonly RimMouth[];
}

export class Rg02Terrain {
  readonly gw: number;
  readonly gh: number;
  readonly plateW: number;
  readonly plateH: number;
  /** The plate's top-left in game world px. */
  readonly origin: Vec2;
  private readonly vw: number;
  private readonly weights: Float32Array;

  constructor(readonly config: Rg02TerrainConfig) {
    this.gh = config.rows.length;
    this.gw = config.rows[0]?.length ?? 0;
    this.plateW = GRID.x * 2 + this.gw * CELL;
    this.plateH = GRID.y + this.gh * CELL + 2 * CELL;
    this.origin = { x: -GRID.x, y: -GRID.y };
    this.vw = Math.ceil(this.plateW / TILE) + 1;
    const vh = Math.ceil(this.plateH / TILE) + 1;
    this.weights = new Float32Array(this.vw * vh * CLASSES.length);
    for (let vy = 0; vy < vh; vy++)
      for (let vx = 0; vx < this.vw; vx++)
        this.weights[(vy * this.vw + vx) * CLASSES.length + this.charClass(vx * TILE, vy * TILE)] =
          1;
  }

  /** The class the rows give plate px (x, y): an edge cell's class carries on past the grid. */
  charClass(px: number, py: number): RgClass {
    const cx = Math.floor((px - GRID.x) / CELL),
      cy = Math.floor((py - GRID.y) / CELL);
    const x = Math.max(0, Math.min(this.gw - 1, cx)),
      y = Math.max(0, Math.min(this.gh - 1, cy));
    const c = this.config.rows[y]?.[x] ?? '';
    const k = this.config.chars[c] ?? RG.earth;
    // the rows carry on past the grid only where they lead somewhere: the rim and the void end there
    if ((cx !== x || cy !== y) && k === RG.void) return this.config.beyond;
    if (Math.max(Math.abs(cx - x), Math.abs(cy - y)) > 1 && this.config.ends?.includes(c))
      return this.config.beyond;
    return k;
  }

  /** The class at cell (x, y) of the rows, or undefined off the grid. */
  cellClass(x: number, y: number): RgClass | undefined {
    if (x < 0 || y < 0 || x >= this.gw || y >= this.gh) return undefined;
    return this.config.chars[this.config.rows[y]?.[x] ?? ''] ?? RG.earth;
  }

  /** The class the bake lays at plate px (x, y), inside the plate. */
  classAt(px: number, py: number): RgClass {
    const tx = Math.floor(px / TILE),
      ty = Math.floor(py / TILE),
      u = (px - tx * TILE + 0.5) / TILE,
      v = (py - ty * TILE + 0.5) / TILE;
    const n = CLASSES.length;
    const i0 = (ty * this.vw + tx) * n,
      i1 = i0 + n,
      i2 = ((ty + 1) * this.vw + tx) * n,
      i3 = i2 + n;
    const cx = Math.floor((px - GRID.x) / CELL),
      cy = Math.floor((py - GRID.y) / CELL);
    const own = this.cellClass(cx, cy);
    const dx = px - (GRID.x + cx * CELL + CELL / 2),
      dy = py - (GRID.y + cy * CELL + CELL / 2);
    // a soft bump keeps each cell's own class round its centre; on ground, water and the void are also held off a
    // flat core out past a figure's half width (12 px), so a narrow deck between two arms of the harbour still carries
    // its figure. Both let go by the cell's edge, where anything left over would snap the boundary to the grid line.
    const d = Math.hypot(dx, dy * 1.1);
    const bump = own === undefined ? 0 : 0.9 * Math.max(0, 1 - d / 20);
    const dry = own !== undefined && own !== RG.water && own !== RG.void;
    const hold = dry ? 1.4 * Math.max(0, Math.min(1, (20 - d) / 7)) : 0;
    let best: RgClass = RG.earth,
      score = -1e9;
    for (const k of CLASSES) {
      const w =
        (this.weights[i0 + k] ?? 0) * (1 - u) * (1 - v) +
        (this.weights[i1 + k] ?? 0) * u * (1 - v) +
        (this.weights[i2 + k] ?? 0) * (1 - u) * v +
        (this.weights[i3 + k] ?? 0) * u * v;
      if (w <= 0 && k !== own) continue;
      const s =
        w +
        vnoise(px, py, 21 + k * 7, 11) * 0.3 +
        vnoise(px, py, 23 + k * 7, 4) * 0.16 +
        (k === own ? bump : 0) -
        (k === RG.water || k === RG.void ? hold : 0);
      if (s > score) {
        score = s;
        best = k;
      }
    }
    return best;
  }

  /** The ground at game world px (x, y), as the bake lays it (`validateTopDownLayout`). */
  classify = (x: number, y: number): PointClass => {
    const px = Math.floor(x - this.origin.x),
      py = Math.floor(y - this.origin.y);
    if (px < 0 || py < 0 || px >= this.plateW || py >= this.plateH)
      return { ground: 'void', terrain: 'V' };
    const c = this.classAt(px, py);
    if (c === RG.water) return { ground: 'water', terrain: 'W' };
    if (c === RG.void) return { ground: 'void', terrain: 'V' };
    return { ground: 'ground', terrain: c === RG.stone ? 'C' : c === RG.earth ? 'G' : 'D' };
  };
}

/** A road mouth: the walkable cells of an exit's cross-section at the map edge. */
export const mouth = (id: string, side: MapEdgeSide, cells: readonly Vec2[]): RimMouth => ({
  id,
  side,
  cells,
});
/** From an edge cell's centre to the plate's side: two and a half cells. */
export const MOUTH_REACH = 3;
