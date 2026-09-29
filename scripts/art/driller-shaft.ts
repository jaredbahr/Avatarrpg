/**
 * The Driller floor's drill shaft and gantry decks (M6 §1.6), painted from the
 * authoritative rows as ground plates drawn over the pages.
 *
 *   written by `node --import tsx scripts/art/quarry-route-ground.ts driller`
 *
 * - **The shaft** (legend `P`, a pit the party can see across but never enter)
 *   is the hole the driller climbed out of: a two-plank timber collar round the
 *   mouth, inked on both sides, and inside it the timber lining of the far
 *   walls dropping away into the pit. It is a plate of its own, as the
 *   Cutting's pool is, because a dark hole inside a page would break the page's
 *   DL-2 window span; nothing about it is a page material.
 * - **The gantry perches** (legend `A`, tier 2, reached only from the tier-1
 *   bench) are plank decks stood one course above the bench, with a joist face
 *   toward any lower neighbour, so the four perches read as the timber they are
 *   rather than as a fifth stone diamond.
 *
 * Every pixel is a flat tone from the game's own palettes: `TERRAIN_STYLES`'s
 * wood and pit, the quarry table's block row and the bible's ink.
 */
import { QUARRY_FLOOR } from '../../src/content/maps/combat';
import { TERRAIN_STYLES } from '../../src/render/palettes';
import { tileNoise } from '../../src/render/painters/shapes';
import type { Vec2 } from '../../src/core/types';
import { newImage, parseHex, setPixel } from './lib/image';
import type { Image } from './lib/image';
import { alphaBounds, crop } from './lib/trim';
import { FOREST_INK } from './forest-village-material';
import { ROCK_COURSE } from './quarry-rock';

type Rgb = readonly [number, number, number];

const TILE_DIAGONAL = Math.hypot(64, 32);
/** The ink line, both halves of it: the pages ink a join from both sides. */
const INK = 2 / TILE_DIAGONAL;
/** The collar: two planks, a fifth of a cell deep in all. */
const COLLAR = 0.2;
/** How far the far walls' lining shows before the pit swallows it, in world pixels. */
const LINING = 26;
const THROAT = 42;
const DECK_RISE = ROCK_COURSE;

const ink = parseHex(FOREST_INK);
const wood = {
  fill: parseHex(TERRAIN_STYLES.wood.fill),
  edge: parseHex(TERRAIN_STYLES.wood.edge),
  detail: parseHex(TERRAIN_STYLES.wood.detail),
};
const pit = {
  fill: parseHex(TERRAIN_STYLES.pit.fill),
  edge: parseHex(TERRAIN_STYLES.pit.edge),
  detail: parseHex(TERRAIN_STYLES.pit.detail),
};

const rows = QUARRY_FLOOR.rows;
const keyAt = (x: number, y: number): string | undefined => rows[y]?.[x];
const elevationOf = (key: string | undefined): number =>
  key === undefined ? 0 : (QUARRY_FLOOR.legend[key]?.elevation ?? 0);

/** Logical point of a world pixel. */
const logical = (wx: number, wy: number): { gx: number; gy: number } => ({
  gx: ((wx - 768) / 64 + wy / 32) / 2,
  gy: (wy / 32 - (wx - 768) / 64) / 2,
});

/**
 * How far inside its region a logical point lies: the distance to the nearest
 * edge shared with a cell outside it, and which way that edge faces.
 */
function inset(
  gx: number,
  gy: number,
  inside: (x: number, y: number) => boolean,
): { depth: number; axis: 'x' | 'y' } {
  const x = Math.floor(gx),
    y = Math.floor(gy);
  let depth = Infinity;
  let axis: 'x' | 'y' = 'x';
  for (const [ox, oy, distance] of [
    [-1, 0, gx - x],
    [1, 0, x + 1 - gx],
    [0, -1, gy - y],
    [0, 1, y + 1 - gy],
  ] as const) {
    if (inside(x + ox, y + oy)) continue;
    if (distance < depth) {
      depth = distance;
      axis = ox !== 0 ? 'x' : 'y';
    }
  }
  return { depth, axis };
}

const isShaft = (x: number, y: number): boolean => keyAt(x, y) === 'P';

/** The collar's planks, laid along whichever edge they are nearest. */
function collarPixel(gx: number, gy: number, depth: number, axis: 'x' | 'y'): Rgb {
  if (depth < INK || depth > COLLAR - INK) return ink;
  const plank = depth < COLLAR / 2 ? 0 : 1;
  if (Math.abs(depth - COLLAR / 2) < INK / 2) return wood.edge;
  // Along the plank: butt joints half a cell apart, staggered plank to plank.
  const along = axis === 'x' ? gy : gx;
  const run = along * 2 + plank * 0.5;
  if (run - Math.floor(run) < 0.035) return ink;
  // The outer plank carries the light on its lip.
  if (plank === 0 && depth < INK + 0.02) return wood.detail;
  return wood.fill;
}

function shaftPixel(wx: number, wy: number): Rgb | null {
  const { gx, gy } = logical(wx, wy);
  if (!isShaft(Math.floor(gx), Math.floor(gy))) return null;
  const { depth, axis } = inset(gx, gy, isShaft);
  if (depth < COLLAR) return collarPixel(gx, gy, depth, axis);
  // Inside the mouth: straight up the screen to the collar is how far down the
  // far wall this pixel looks.
  let down = 1;
  while (down <= THROAT) {
    const above = logical(wx, wy - down);
    if (inset(above.gx, above.gy, isShaft).depth < COLLAR) break;
    down++;
  }
  if (down <= 2) return ink;
  if (down <= LINING) {
    // Timber lining: boards on edge, a dark seam every eight pixels, and an
    // upright every half cell holding them.
    if ((down - 2) % 8 === 0) return ink;
    const post = Math.floor(wx) % 32;
    if (post < 3) return wood.fill;
    return wood.edge;
  }
  if (down <= THROAT) return (down - LINING) % 8 === 0 ? pit.edge : pit.detail;
  return tileNoise(Math.floor(wx / 3), Math.floor(wy / 3), 13) < 0.06 ? pit.detail : pit.fill;
}

/** Every perch cell, in row order. */
export const DRILLER_GANTRY_CELLS: readonly Vec2[] = rows.flatMap((row, y) =>
  [...row].flatMap((key, x) => (key === 'A' ? [{ x, y }] : [])),
);

/**
 * One pixel of a perch at `cell`. As the cut rock stands (`quarry-rock.ts`):
 * the deck is the footprint lifted `DECK_RISE`, and where the ground under a
 * pixel's deck would already be off it onto lower ground, the pixel is the
 * joist face. Toward higher ground (the terrace wall behind a perch) there is
 * no face: the rock hides it.
 */
function deckPixel(cell: Vec2, wx: number, wy: number): Rgb | null {
  const here = logical(wx, wy);
  if (Math.floor(here.gx) !== cell.x || Math.floor(here.gy) !== cell.y) return null;
  const onDeck = (x: number, y: number): boolean => x === cell.x && y === cell.y;
  let drop = 1;
  let right = false;
  while (drop <= DECK_RISE) {
    const at = logical(wx, wy + drop);
    const x = Math.floor(at.gx),
      y = Math.floor(at.gy);
    if (!onDeck(x, y)) {
      // Higher ground or the board's edge: the deck runs on under it.
      if (elevationOf(keyAt(x, y)) >= 2 || keyAt(x, y) === undefined) drop = DECK_RISE + 1;
      // Off the +x edge the face turns right, away from the light.
      else right = x > cell.x;
      break;
    }
    drop++;
  }
  if (drop <= DECK_RISE) {
    // The joist face: inked at its foot and under the deck's lip, with a
    // beam end every half cell.
    const height = drop - 1;
    if (height < 2 || drop > DECK_RISE - 1) return ink;
    if (Math.floor(wx) % 32 < 4) return right ? ink : wood.edge;
    return right ? wood.edge : wood.fill;
  }
  const top = logical(wx, wy + DECK_RISE);
  const topInset = inset(top.gx, top.gy, onDeck).depth;
  if (inset(here.gx, here.gy, onDeck).depth < INK || topInset < INK) return ink;
  // Planks run along x, five to the cell, each with its own butt joint.
  const across = (top.gy - cell.y) * 5;
  const plank = Math.floor(across);
  if (across - plank < 0.1) return wood.edge;
  const along = top.gx - cell.x + tileNoise(plank, cell.x + cell.y, 3) * 0.6;
  if (Math.abs(along - 0.5) < 0.02) return wood.edge;
  return wood.detail;
}

export interface Plate {
  readonly image: Image;
  readonly x: number;
  readonly y: number;
}

/**
 * Carry the outline two pixels out, as the pages' `bleedEdges` does, so the
 * oblique scaling filters the plate's edge against its own ink rather than
 * against whatever lies under it.
 */
function bleed(image: Image, pixels = 2): void {
  for (let pass = 0; pass < pixels; pass++) {
    const previous = new Uint8Array(image.data);
    for (let py = 0; py < image.height; py++)
      for (let px = 0; px < image.width; px++) {
        if (previous[(py * image.width + px) * 4 + 3]) continue;
        for (const [dx, dy] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ] as const) {
          const nx = px + dx,
            ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= image.width || ny >= image.height) continue;
          const from = (ny * image.width + nx) * 4;
          if (!previous[from + 3]) continue;
          image.data.set(previous.subarray(from, from + 4), (py * image.width + px) * 4);
          break;
        }
      }
  }
}

/** Paint `pixel` over a world-space box and cut the result to its alpha bounds. */
function plate(
  box: { x: number; y: number; width: number; height: number },
  pixel: (wx: number, wy: number) => Rgb | null,
): Plate {
  const image = newImage(box.width, box.height);
  for (let py = 0; py < box.height; py++)
    for (let px = 0; px < box.width; px++) {
      const rgb = pixel(box.x + px + 0.5, box.y + py + 0.5);
      if (rgb) setPixel(image, px, py, [rgb[0], rgb[1], rgb[2], 255]);
    }
  bleed(image);
  const bounds = alphaBounds(image);
  if (!bounds) throw new Error('Empty Driller plate');
  return { image: crop(image, bounds), x: box.x + bounds.x, y: box.y + bounds.y };
}

/** The world box round a set of cells' diamonds. */
function cellBox(cells: readonly Vec2[]): { x: number; y: number; width: number; height: number } {
  const xs = cells.flatMap(({ x, y }) => [768 + (x - y - 1) * 64, 768 + (x - y + 1) * 64]);
  const ys = cells.flatMap(({ x, y }) => [(x + y) * 32, (x + y + 2) * 32]);
  const x = Math.min(...xs),
    y = Math.min(...ys);
  // Padded for the bleed.
  return { x: x - 2, y: y - 2, width: Math.max(...xs) - x + 4, height: Math.max(...ys) - y + 4 };
}

export function buildDrillerShaft(): Plate {
  const cells = rows.flatMap((row, y) =>
    [...row].flatMap((key, x) => (key === 'P' ? [{ x, y }] : [])),
  );
  return plate(cellBox(cells), shaftPixel);
}

export function buildDrillerGantry(cell: Vec2): Plate {
  return plate(cellBox([cell]), (wx, wy) => deckPixel(cell, wx, wy));
}
