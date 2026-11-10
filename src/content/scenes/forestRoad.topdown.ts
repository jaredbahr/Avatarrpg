/**
 * The Forest Road's top-down objects (ADR 0104 §3, phase T4): the prototype's `placeForest`
 * (`prototypes/topdown/src/b3/world_forest.js`, owner-approved in `forest-combat.html`) on the game's
 * rows, with the same seeded placement, so the pines, the bank's rubble and the roadside dressing
 * stand where the prototype drew them. Positions are game world px (40 a cell): the prototype's plate
 * px less the grid's offset in the plate (`GRID`).
 *
 * Where the game's rules differ from the prototype's own collision, the rules win and the art follows:
 * - the perch at (19, 2) is walkable high ground (`A`), so its boulder stands just past the grid's
 *   east edge, and its rubble on the perch;
 * - a boulder the prototype scattered on a walkable bank cell becomes rubble, which a figure stands
 *   in (as on the `r` cells), so nothing that reads solid sits on an open cell;
 * - the bank cell (17, 3) and the grass cell (2, 10) are blocked by roadside props in the rules
 *   (`FOREST_ROADSIDE_PROPS`: the quarry blocks and the fallen log), so a boulder and a log stand there.
 */
import type { Vec2 } from '../../core/types';
import type { TopDownObject, TopDownObjectKind } from '../topdownLayout';
import {
  CELL,
  GH,
  GRID,
  GW,
  PLATE_W,
  ROWS,
  classifyPoint,
  hash2,
} from './forestRoad.topdown.terrain';

const PINES = ['pine_a', 'pine_b', 'pine_c', 'pine_a', 'pine_b'] as const;
/** A figure's feet in a cell, in plate px (the prototype's `cellX`, `cellY`). */
const cellX = (x: number): number => GRID.x + x * CELL + CELL / 2;
const cellY = (y: number): number => GRID.y + y * CELL + CELL - 9;
const rowAt = (x: number, y: number): string => ROWS[y]?.[x] ?? '';

/** How far up the bank a piece may step to stand dry. */
const MAX_STEP_UP = 30;

/** The foot row (the row above `base`) over the footprint's columns, as the validation reads it. */
function dryFoot(x: number, base: number, cells: readonly Vec2[] | undefined): boolean {
  const xs = cells?.map((c) => c.x) ?? [Math.floor(x / CELL)];
  const y = base - 1;
  for (let px = Math.min(...xs) * CELL + 4; px <= (Math.max(...xs) + 1) * CELL - 4; px += 4)
    if (classifyPoint(px, y).ground !== 'ground') return false;
  for (let dx = -4; dx <= 4; dx += 2)
    if (classifyPoint(x + dx, y).ground !== 'ground') return false;
  return true;
}

interface PutOptions {
  /** The cells it blocks in the rules: its footprint, and it is solid. */
  readonly cells?: readonly Vec2[];
  readonly kind?: TopDownObjectKind;
  readonly fade?: boolean;
}

/**
 * The placed objects, in the prototype's order (the bake grounds them in this order). `cx` and `by`
 * are the prototype's centre x and base in plate px.
 */
function placeForest(): TopDownObject[] {
  const out: TopDownObject[] = [];
  const ids = new Map<string, number>();
  const put = (sprite: string, cx: number, by: number, id: string, o: PutOptions = {}): void => {
    const kind = o.kind ?? 'prop';
    const x = Math.round(cx) - GRID.x;
    let base = Math.round(by) - GRID.y;
    // a standing piece whose foot the prototype set at the creek's edge steps up the bank until its
    // whole foot (and a tree's root) is on dry ground
    if (kind !== 'flat') for (let k = 0; k < MAX_STEP_UP && !dryFoot(x, base, o.cells); k++) base--;
    const n = ids.get(id) ?? 0;
    ids.set(id, n + 1);
    // a piece that blocks nothing stands on the cell under its foot
    const foot = { x: Math.floor(x / CELL), y: Math.floor((base - 1) / CELL) };
    const footprint = o.cells ?? [foot];
    const exterior = footprint.some((c) => c.x < 0 || c.y < 0 || c.x >= GW || c.y >= GH);
    out.push({
      id: n ? `${id}-${n}` : id,
      sprite,
      kind,
      x,
      base,
      footprint,
      solid: o.cells !== undefined,
      ...(exterior && { exterior: true }),
      depth: { x: x / CELL, y: base / CELL },
      ...((kind === 'tree' || o.fade) && { fadeWhenOccluding: true }),
    });
  };

  // the pine wall: every T cell, the creek's alders and dark bushes on the last row
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      if (rowAt(x, y) !== 'T') continue;
      const k =
        y === GH - 1
          ? (['bush_dark', 'bush_dark', 'alder'] as const)[(x * 7 + y) % 3]
          : PINES[(x * 5 + y * 3) % PINES.length];
      put(
        k ?? 'pine_a',
        cellX(x) + Math.round((hash2(x, y, 3) - 0.5) * 14),
        GRID.y + y * CELL + CELL - 4 + Math.round(hash2(x, y, 4) * 6),
        `tree-${x}-${y}`,
        { kind: 'tree', cells: [{ x, y }] },
      );
    }
  // two ragged rows in the north margin, with deer paths between the trunks of the first
  for (let i = 0; i < 2; i++)
    for (let x = -10; x < PLATE_W + 30; x += 34 + Math.round(hash2(i, x, 5) * 16)) {
      const by = GRID.y - 10 - i * 46 - Math.round(hash2(x, i, 6) * 20);
      if (i === 0 && x > GRID.x - 20 && x < GRID.x + GW * CELL + 20 && hash2(x, i, 9) < 0.35)
        continue;
      // a trunk past the plate's side would root in nothing; its crown was only the frame's corner
      if (x < 0 || x >= PLATE_W) continue;
      put(PINES[(((x + i * 3) % 5) + 5) % 5] ?? 'pine_a', x, by, `north-${i}-${x}`, {
        kind: 'tree',
      });
    }
  // the dark ends of the side margins
  for (const [side, x0] of [
    [-1, 4],
    [1, PLATE_W - 76],
  ] as const)
    for (let y = 0; y < GH; y++) {
      const c = rowAt(side < 0 ? 0 : GW - 1, y);
      if (c !== 'T' && !(y <= 3 || y >= 9)) continue;
      put(
        PINES[(y * 7 + x0) % PINES.length] ?? 'pine_a',
        x0 + 36 + Math.round(hash2(y, side, 7) * 20),
        GRID.y + y * CELL + CELL - 2,
        `${side < 0 ? 'west' : 'east'}-${y}`,
        { kind: 'tree' },
      );
    }
  // the rocky bank under the slinger's perch (^ elevation 1, A elevation 2) and the rubble (cover)
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      const c = rowAt(x, y);
      if (c === 'A') {
        // the perch is walkable high ground: its boulder rises just past the grid's edge
        put('boulder', cellX(x) + 30, GRID.y + y * CELL + CELL - 3, `perch-${x}-${y}`, {
          cells: [{ x: x + 1, y }],
        });
        put('rubble', cellX(x) + 14, GRID.y + y * CELL + CELL + 4, `perch-rubble-${x}-${y}`);
      }
      if (c === '^' && rowAt(x, y + 1) !== '^' && !(x === 18 && y === 3)) {
        const blocked = x === 17 && y === 3; // the quarry blocks' cell, closed by the rules
        if (!blocked && hash2(x, y, 11) >= 0.7) continue;
        put(
          blocked ? 'boulder' : 'rubble',
          cellX(x) + Math.round((hash2(x, y, 13) - 0.5) * 10),
          GRID.y + y * CELL + CELL - 2,
          `bank-${x}-${y}`,
          blocked ? { cells: [{ x, y }] } : {},
        );
      }
      if (c === 'r') put('rubble', cellX(x), GRID.y + y * CELL + CELL - 6, `rubble-${x}-${y}`);
    }
  // the encounter's roadside dressing (`FOREST_ROADSIDE_PROPS`), on the cells the rules close
  put('signpost', cellX(4), cellY(2) + 4, 'signpost', { cells: [{ x: 4, y: 2 }], fade: true });
  put('fence', cellX(1) + 20, cellY(2) + 2, 'fence-ab', {
    cells: [
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ],
  });
  put('fence', cellX(4) + 4, cellY(3) - 8, 'fence-c', { cells: [{ x: 4, y: 3 }] });
  put('stump', cellX(2), cellY(1) + 4, 'woodpile', { cells: [{ x: 2, y: 1 }] });
  put('cart_wheel', cellX(12), cellY(2) + 4, 'cart-wheel', { cells: [{ x: 12, y: 2 }] });
  put('milestone', cellX(14), cellY(2) + 4, 'milestone', { cells: [{ x: 14, y: 2 }] });
  put('lamp', cellX(14) + 8, cellY(3) + 4, 'lantern', { cells: [{ x: 14, y: 3 }], fade: true });
  put('log', cellX(2), cellY(10) + 4, 'mushroom-log', { cells: [{ x: 2, y: 10 }] });
  put('log', GRID.x + 7 * CELL, GRID.y - 8, 'deadfall-north');
  put('log', GRID.x + 15 * CELL + 10, GRID.y + 4 * CELL - 4 - 120, 'deadfall-bank');
  for (const [x, y] of [
    [6, 1],
    [10, 2],
    [13, 9],
    [2, 9],
    [16, 10],
    [9, 1],
  ] as const)
    put(hash2(x, y, 1) < 0.5 ? 'tuft' : 'flowers', cellX(x), cellY(y) + 6, `flat-${x}-${y}`, {
      kind: 'flat',
    });
  return out;
}

export const FOREST_TOPDOWN_OBJECTS: readonly TopDownObject[] = placeForest();
