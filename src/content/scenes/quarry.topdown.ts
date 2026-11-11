/**
 * The quarry boards' top-down objects (ADR 0104 §3, phase T5): the prototype's `placeQuarry` and
 * `dressPlateaus` (`prototypes/topdown/src/b3/world_quarry.js`, owner-approved in
 * `tutorial-demo.html`) on the game's rows for the quarry gate, the Cutting and the Driller floor,
 * with the same hashed placement, so the gatehouse, the curtain wall, the scaffolds, the shaft's
 * headframe, the rubble and the plateaus' scree stand where the prototype drew them. Positions are
 * game world px (40 a cell): the prototype's plate px less the grid's offset in the plate (`GRID`).
 *
 * The rules' own props (the brazier, the barrels, the oil flask, the hay bale, Pella's cart, the
 * rubble piles) are not here: the game draws them at run time (`public/art/topdown/props/`), so
 * they burn, break and move as the rules say.
 *
 * Where the game's rules differ from the prototype's own collision, the rules win and the art
 * follows (each is listed in `QUARRY_DEVIATIONS`):
 * - the gate's `c` cells are low cover a figure stands in (ADR 0104's 2026-11-07 amendment): a
 *   short sack-and-crate line on the cell, not a solid stack of crates;
 * - a piece the prototype stood on a walkable cell (its own collision blocked it, the rules do not)
 *   moves onto the nearest blocked cell, or goes where none is near;
 * - a loose rubble heap on a walkable shelf would read as the rules' rubble (cover) that is not
 *   there, so it is scree, the shelf's own gravel.
 */
import type { Vec2 } from '../../core/types';
import { LEGEND } from '../maps/legend';
import type { TopDownObject, TopDownObjectKind } from '../topdownLayout';
import {
  CELL,
  CUTTING_TERRAIN,
  GH,
  GRID,
  GW,
  PLATE_H,
  PLATE_W,
  QUARRY_FLOOR_TERRAIN,
  QUARRY_GATE_TERRAIN,
  QuarryRows,
  hash2,
  type QuarryTerrainConfig,
} from './quarry.topdown.terrain';

/**
 * The prototype's sprites' sizes (`tutorial-demo.html`'s objects, alpha cut and trimmed), which its
 * plateau dressing reads to keep clear of what already stands. `quarry-board.test.ts` holds them to
 * the sprites.
 */
export const QUARRY_SPRITE_SIZE: Readonly<Record<string, readonly [number, number]>> = {
  crate: [20, 24],
  crates: [37, 41],
  dead_shrub: [25, 34],
  drill_junk: [44, 30],
  gallery_door: [52, 46],
  gatehouse: [85, 55],
  headframe: [54, 83],
  lamp: [37, 81],
  lime_boulder: [40, 36],
  lime_rubble: [40, 21],
  minecart: [28, 36],
  oil_barrels: [36, 32],
  qwall: [67, 43],
  qwall_b: [64, 38],
  rails: [71, 19],
  sack: [22, 28],
  scaffold: [43, 64],
  scree: [33, 14],
  signpost: [29, 51],
  stone_blocks: [28, 30],
  tool_rack: [34, 38],
};

/** How far a rubble heap in the grass sits up on its spoil patch. */
const RUBBLE_LIFT = 6;

const legend = (c: string) => LEGEND[c] ?? LEGEND['.'];
const walkable = (c: string): boolean => !legend(c)?.blocked;

/** A cell's centre x in plate px (the prototype's `cellX`). */
const cellX = (x: number): number => GRID.x + x * CELL + CELL / 2;

interface PutOptions {
  /** The cells it blocks in the rules: its footprint, and it is solid. */
  readonly cells?: readonly Vec2[];
  /** The cells it stands on without blocking them (the gate's low cover, a rubble heap). */
  readonly on?: readonly Vec2[];
  readonly kind?: TopDownObjectKind;
  readonly flip?: boolean;
  readonly fade?: boolean;
}

/** A piece the prototype placed: its sprite, centre x and base in plate px, and how it stands. */
interface Piece {
  readonly sprite: string;
  readonly cx: number;
  readonly by: number;
  readonly id: string;
  readonly o: PutOptions;
}

/** One deviation from the prototype, for the record (and the PR). */
export interface QuarryDeviation {
  readonly mapId: string;
  readonly id: string;
  readonly what: string;
}

class Board {
  readonly pieces: Piece[] = [];
  private readonly ghosts: Piece[] = [];
  readonly deviations: QuarryDeviation[] = [];
  readonly q: QuarryRows;
  constructor(readonly config: QuarryTerrainConfig) {
    this.q = new QuarryRows(config);
  }
  ch(x: number, y: number): string {
    return x < 0 || y < 0 || x >= GW || y >= GH ? 'X' : (this.config.rows[y]?.[x] ?? 'X');
  }
  put(sprite: string, cx: number, by: number, id: string, o: PutOptions = {}): void {
    this.pieces.push({ sprite, cx: Math.round(cx), by: Math.round(by), id, o });
  }
  /** A piece the prototype stood where the rules do not let it: its dressing still keeps clear of it. */
  ghost(sprite: string, cx: number, by: number): void {
    this.ghosts.push({ sprite, cx: Math.round(cx), by: Math.round(by), id: 'ghost', o: {} });
  }
  differ(id: string, what: string): void {
    this.deviations.push({ mapId: this.config.mapId, id, what });
  }

  /**
   * The prototype's plateau dressing: scree heaps, a few dead shrubs and a loose rubble heap, each
   * on its own spot well inside a rock plateau and away from everything placed before it.
   */
  dressPlateaus(): void {
    const q = this.q;
    const rockCell = (cx: number, cy: number): boolean => {
      if (cx < 0 || cy < 0 || cx >= GW || cy >= GH) return q.qcell(cx, cy) === 'X';
      const l = legend(this.ch(cx, cy));
      return (l?.elevation ?? 0) > 0 && !l?.ramp;
    };
    const inside = (px: number, py: number): boolean => {
      const cx = Math.floor((px - GRID.x) / CELL),
        cy = Math.floor((py - GRID.y) / CELL);
      for (let j = -1; j <= 1; j++)
        for (let k = -1; k <= 1; k++) if (!rockCell(cx + j, cy + k)) return false;
      return q.inMass(px - 40, py - 22) && q.inMass(px + 40, py + 40);
    };
    let shrubs = 0,
      n = 0;
    for (let k = 0; k < 400 && n < 15; k++) {
      const px = 30 + Math.floor(hash2(k, 1, 501) * (PLATE_W - 60)),
        py = 40 + Math.floor(hash2(k, 2, 501) * (PLATE_H - 120));
      if (!inside(px, py)) continue;
      const near = [...this.pieces, ...this.ghosts].some((o) => {
        const w = QUARRY_SPRITE_SIZE[o.sprite]?.[0] ?? 0;
        return Math.hypot(Math.round(o.cx - w / 2) + w / 2 - px, o.by - py) < 95;
      });
      if (near) continue;
      const r = hash2(k, 3, 501),
        key = r < 0.22 && shrubs < 5 ? 'dead_shrub' : r < 0.3 ? 'lime_rubble' : 'scree';
      if (key === 'dead_shrub') shrubs++;
      this.put(key, px, py, `dress-${k}`, { flip: hash2(k, 4, 501) < 0.5 });
      n++;
    }
  }
}

/* ------------------------------------------------------------------ */
/* The three boards, in the prototype's order                          */
/* ------------------------------------------------------------------ */

/** The per-cell pass every quarry board shares: the gate's `c` cover, and the rubble heaps. */
function cellPass(b: Board, extra: (x: number, y: number, c: string) => void): void {
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      const c = b.ch(x, y);
      extra(x, y, c);
      const bx = cellX(x),
        by = GRID.y + y * CELL + CELL - 3;
      if (c === 'c') {
        // low cover a figure stands in (ADR 0104, 2026-11-07): a short sack-and-crate line, in
        // front of the figure's feet, not the prototype's solid stack of crates
        b.put('sack', bx - 9, by, `cover-${x}-${y}`, { on: [{ x, y }] });
        b.put('crate', bx + 10, by - 1, `cover-crate-${x}-${y}`, { on: [{ x, y }] });
        b.differ(
          `cover-${x}-${y}`,
          `(${x},${y}) \`c\`: a sack and a crate (low cover), not the solid \`crates\` stack`,
        );
      }
      if (c === 'r' || c === 'R') {
        // in the grass, the heap sits up on its own spoil patch, so its shadow lies on the spoil
        // rather than half on the dark moss beside it
        const inGrass = [b.ch(x - 1, y), b.ch(x + 1, y), b.ch(x, y + 1)].includes(',');
        b.put(
          'lime_rubble',
          bx + Math.round((hash2(x, y, 7) - 0.5) * 8),
          by - 4 - (inGrass ? RUBBLE_LIFT : 0),
          `rubble-${x}-${y}`,
          { on: [{ x, y }] },
        );
        if (inGrass)
          b.differ(
            `rubble-${x}-${y}`,
            `the heap on (${x},${y}) sits ${RUBBLE_LIFT} px up, on its spoil patch`,
          );
      }
    }
}

function gate(): Board {
  const b = new Board(QUARRY_GATE_TERRAIN);
  const wallRun: number[] = [];
  const STRUCTURE: Readonly<Record<number, string>> = {
    4: 'stone_blocks',
    9: 'lime_boulder',
    12: 'minecart',
    17: 'stone_blocks',
  };
  cellPass(b, (x, y, c) => {
    if (c !== '#') return;
    if (y === 0) wallRun.push(x);
    else if (y < GH - 1) {
      const k =
        y < 6
          ? x === 9 || x === 12
            ? 'oil_barrels'
            : 'scaffold'
          : (STRUCTURE[x] ?? 'stone_blocks');
      b.put(k, cellX(x), GRID.y + y * CELL + CELL - 3, `${k}-${x}-${y}`, {
        cells: [{ x, y }],
        fade: k === 'scaffold',
      });
    }
  });
  // the curtain wall along the north edge, the gatehouse in its middle over the gate's two cells
  for (const x of wallRun)
    b.put(x % 3 === 1 ? 'qwall_b' : 'qwall', cellX(x) + 6, GRID.y + CELL - 2, `wall-${x}`, {
      cells: [{ x, y: 0 }],
    });
  b.put('gatehouse', GRID.x + 11 * CELL, GRID.y + CELL + 2, 'gatehouse', {
    cells: [
      { x: 10, y: 0 },
      { x: 11, y: 0 },
    ],
  });
  // the prototype's lamp blocked (5, 10) and its signpost stood on (1, 2): both are open ground
  b.differ(
    'lamp',
    'the lamp the prototype stood on open (5,10) is left out (no blocked cell beside it is free)',
  );
  b.differ(
    'signpost',
    'the signpost the prototype stood on open (1,2) is left out (the shelf beside it is cut rock)',
  );
  b.put('lime_rubble', cellX(7), GRID.y + 11 * CELL + 26, 'south-rubble');
  b.put('lime_boulder', cellX(14) + 6, GRID.y + 11 * CELL + 30, 'south-boulder');
  // the prototype's dressing kept clear of the lamp and the signpost too: measured with them
  b.ghost('lamp', cellX(5) + 2, GRID.y + 10 * CELL + 30);
  b.ghost('signpost', cellX(1), GRID.y + 3 * CELL - 6);
  b.dressPlateaus();
  return b;
}

function cutting(): Board {
  const b = new Board(CUTTING_TERRAIN);
  cellPass(b, () => {});
  b.put('scaffold', cellX(10) + 2, GRID.y + 3 * CELL + 30, 'scaffold', {
    cells: [{ x: 10, y: 3 }],
    fade: true,
  });
  b.put('tool_rack', cellX(9), GRID.y + 9 * CELL - 4, 'tool-rack', { cells: [{ x: 9, y: 8 }] });
  b.ghost('stone_blocks', cellX(11) + 8, GRID.y + 8 * CELL + 36);
  // the minecart's foot is on the rock at (8, 2), where the prototype blocked (7, 2)
  b.put('minecart', cellX(8) - 6, GRID.y + 2 * CELL + 34, 'minecart', { cells: [{ x: 8, y: 2 }] });
  b.put('lime_boulder', cellX(12), GRID.y + 2 * CELL + 34, 'boulder', { cells: [{ x: 12, y: 2 }] });
  b.dressPlateaus();
  // the prototype's stone blocks stood on open (11, 8): they stand on the cut rock beside it
  b.put('stone_blocks', cellX(10) + 2, GRID.y + 8 * CELL + 36, 'stone-blocks', {
    cells: [{ x: 10, y: 8 }],
  });
  b.differ(
    'stone-blocks',
    'the stone blocks move 46 px west, from open (11,8) onto the rock at (10,8)',
  );
  return b;
}

function floor(): Board {
  const b = new Board(QUARRY_FLOOR_TERRAIN);
  cellPass(b, (x, y, c) => {
    if (c === '#')
      b.put('lime_boulder', cellX(x), GRID.y + y * CELL + CELL - 3, `boulder-${x}-${y}`, {
        cells: [{ x, y }],
      });
  });
  // the drill shaft (P) under its headframe, its legs on the floor at the shaft's south lip
  b.put('headframe', GRID.x + 19 * CELL - 4, GRID.y + 8 * CELL + 2, 'headframe', {
    cells: [
      { x: 18, y: 7 },
      { x: 19, y: 7 },
    ],
    fade: true,
  });
  // the barred galleries in the north face ("the gallery entrances have been barred with timber")
  for (const x of [5, 13])
    b.put('gallery_door', cellX(x), GRID.y + CELL + 4, `gallery-${x}`, { cells: [{ x, y: 0 }] });
  // rails along the north terrace, flat on the floor
  b.put('rails', cellX(9), GRID.y + 2 * CELL + 12, 'rails-west', { kind: 'flat' });
  b.put('rails', cellX(9) + 62, GRID.y + 2 * CELL + 12, 'rails-east', { kind: 'flat' });
  // what the prototype stood on open ground: its dressing kept clear of it, so it is measured
  b.ghost('minecart', cellX(10) + 4, GRID.y + 2 * CELL + 6);
  b.ghost('drill_junk', cellX(14) + 6, GRID.y + 8 * CELL + 34);
  b.ghost('tool_rack', cellX(2) + 4, GRID.y + 2 * CELL + 4);
  b.ghost('stone_blocks', cellX(17) + 6, GRID.y + 9 * CELL + 2);
  b.ghost('scaffold', cellX(3), GRID.y + 10 * CELL + 4);
  b.dressPlateaus();
  // the crew's tools and the cut blocks stand on the rock beside the benches, not on them
  b.put('tool_rack', cellX(1) + 4, GRID.y + 2 * CELL + 4, 'tool-rack', { cells: [{ x: 1, y: 2 }] });
  b.differ('tool-rack', 'the tool rack moves from the open ramp (2,2) onto the rock at (1,2)');
  b.put('stone_blocks', cellX(18) + 6, GRID.y + 9 * CELL + 2, 'stone-blocks', {
    cells: [{ x: 18, y: 9 }],
  });
  b.differ(
    'stone-blocks',
    'the stone blocks move from the open ramp (17,9) onto the rock at (18,9)',
  );
  b.put('scaffold', cellX(1), GRID.y + 10 * CELL + 4, 'scaffold', {
    cells: [{ x: 1, y: 10 }],
    fade: true,
  });
  b.differ('scaffold', 'the scaffold moves from the open ramp (3,10) onto the rock at (1,10)');
  b.differ('minecart', 'the minecart the prototype stood on open (10,2) is left out');
  b.differ('drill-junk', "the driller's junk the prototype stood on open (14,8) is left out");
  return b;
}

/* ------------------------------------------------------------------ */
/* The layout                                                          */
/* ------------------------------------------------------------------ */

function objects(b: Board): TopDownObject[] {
  return b.pieces.map((p): TopDownObject => {
    const kind = p.o.kind ?? 'prop';
    const x = p.cx - GRID.x,
      base = p.by - GRID.y;
    // a piece that blocks nothing stands on the cell under its foot
    const foot = { x: Math.floor(x / CELL), y: Math.floor((base - 1) / CELL) };
    const footprint = p.o.cells ?? p.o.on ?? [foot];
    const exterior = footprint.some((c) => c.x < 0 || c.y < 0 || c.x >= GW || c.y >= GH);
    // a loose heap on a walkable cell that the rules do not cover reads as cover: the shelf's scree
    let sprite = p.sprite;
    const onOpen =
      !p.o.cells && !p.o.on && kind !== 'flat' && !exterior && walkable(b.ch(foot.x, foot.y));
    if (onOpen && sprite === 'lime_rubble') {
      sprite = 'scree';
      b.differ(p.id, `a loose rubble heap on open (${foot.x},${foot.y}) is scree`);
    }
    return {
      id: p.id,
      sprite,
      kind,
      x,
      base,
      footprint,
      solid: p.o.cells !== undefined,
      ...(exterior && { exterior: true }),
      ...(p.o.flip && { flip: true }),
      depth: { x: x / CELL, y: base / CELL },
      ...(p.o.fade && { fadeWhenOccluding: true }),
    };
  });
}

const BOARDS = [gate(), cutting(), floor()];

export const QUARRY_GATE_TOPDOWN_OBJECTS: readonly TopDownObject[] = objects(BOARDS[0] as Board);
export const CUTTING_TOPDOWN_OBJECTS: readonly TopDownObject[] = objects(BOARDS[1] as Board);
export const QUARRY_FLOOR_TOPDOWN_OBJECTS: readonly TopDownObject[] = objects(BOARDS[2] as Board);

/** Every way the boards differ from the prototype's placement, and why. */
export const QUARRY_DEVIATIONS: readonly QuarryDeviation[] = BOARDS.flatMap((b) => b.deviations);
