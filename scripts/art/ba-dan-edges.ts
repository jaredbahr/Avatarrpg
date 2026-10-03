/**
 * Ba Dan's edge water: the flooded west ford where the road ends, and the low
 * canal outside the south lawn (`BA_DAN_EDGE_WATER` in `scenes/baDan.ts`).
 *
 * Both are the courtyard canal's construction, not a new material: the same
 * diamond metric around each water cell (`canalMetric`), the same channel bed
 * darkening and cooling toward the middle (`bedShade`, `BED_COOL`), and the
 * same dressed kerb from wet stone at the waterline to dry paving at its outer
 * edge (`kerbShade`). What changes is where the paving comes from and the
 * grain. The courtyard plate ends well short of the rim, so the bed and kerb
 * are the garden's own flagstone (`flagstoneTexel`), which tiles that same
 * paving anywhere on the logical grid; and they are drawn two world pixels a
 * texel in flat steps, like the garden and apron they sit among, rather than
 * as a smooth ramp.
 *
 * This module is now the footprint reference: the shipped page is the painted
 * fieldstone master (`ba-dan-water.ts`) cut to the same alpha, with no film.
 * What follows describes the reference pack the footprint is measured against.
 *
 * The renderer's water film only covers a `~` tile, and neither of these is
 * one — the ford is blocked `W`, the canal is off the board — so the film is
 * baked in: the same colour at the strength its two coats add up to. The ford
 * also carries a line of drowned stepping stones (`BA_DAN_FORD_STONES`).
 *
 * On the board a texel is opaque; past the rim it takes the apron's own
 * stepped fade at that point, so the water runs out into the page with the
 * grass around it instead of ending on a kerb.
 *
 * npx tsx scripts/art/ba-dan-edges.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Vec2 } from '../../src/core/types';
import {
  BA_DAN_CANAL_BANK_RADIUS,
  BA_DAN_EDGE_WATER,
  BA_DAN_EDGE_WATER_PAGE,
  BA_DAN_FORD_STONES,
} from '../../src/content/scenes/baDan';
import {
  BED_COOL,
  KERB_DESATURATE,
  KERB_WET_COOL,
  bedShade,
  kerbShade,
} from './ba-dan-canal-banks';
import { APRON_FADE, apronAlpha, apronDepth } from './ba-dan-exterior-apron';
import {
  DIRECTORY,
  FLAGSTONE_TONES,
  GRAIN,
  flagstoneTexel,
  texelTouchesBoard,
  worldLogical,
} from './ba-dan-garden';
import { newImage, pixelAt, setPixel } from './lib/image';
import type { Image } from './lib/image';
import { encodeWebpLossless } from './lib/webp';

type Rgb = readonly [number, number, number];

/**
 * World pixels of water per tile of distance from the shore: a diamond's
 * half-height per half tile, so a one-row channel is deepest at its middle.
 */
const INSET_PER_TILE = 64;
/** Shade and kerb steps are rounded to these, so the bed reads as flat bands. */
const SHADE_STEP = 0.06;
/**
 * The renderer's water film: `SURFACE_STYLES.water`, #3e8fb0 at 0.4, laid as a
 * 0.6 first coat and a 0.4 interior coat, which add up to this over the bed.
 */
export const FILM = { colour: [0x3e, 0x8f, 0xb0] as Rgb, alpha: 1 - (1 - 0.24) * (1 - 0.16) };
/** A drowned stepping stone: its top, and the dark rim round it, in tiles. */
const STONE_TOP = 0.15;
const STONE_RIM = 0.2;
/** A stone's top sits just under the surface: the shelf's shade, not the channel's. */
const STONE_SHADE = 0.9;

/** The courtyard canal's metric, over any set of water cells: 1 at the waterline. */
export function waterMetric(x: number, y: number, cells: readonly Vec2[]): number {
  let metric = Infinity;
  for (const cell of cells)
    metric = Math.min(
      metric,
      2 * Math.max(Math.abs(x - (cell.x + 0.5)), Math.abs(y - (cell.y + 0.5))),
    );
  return metric;
}

/**
 * How far inside the water a point is, in tiles: its distance to the nearest
 * cell that is not water. The courtyard canal measures this in the plate's
 * pixels; measured from each cell's own centre instead, every join between two
 * water cells would read as a shallow ridge across the channel.
 */
export function shoreDistance(x: number, y: number, cells: readonly Vec2[]): number {
  const water = new Set(cells.map((cell) => `${cell.x},${cell.y}`));
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  let best = Infinity;
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const col = cx + dx;
      const row = cy + dy;
      if (water.has(`${col},${row}`)) continue;
      const across = Math.max(col - x, 0, x - (col + 1));
      const down = Math.max(row - y, 0, y - (row + 1));
      best = Math.min(best, Math.max(across, down));
    }
  return best;
}

const step = (value: number): number => Math.round(value / SHADE_STEP) * SHADE_STEP;

const scale = (rgb: Rgb, by: Rgb): Rgb =>
  [0, 1, 2].map((c) => Math.min(255, Math.round((rgb[c] ?? 0) * (by[c] ?? 1)))) as unknown as Rgb;

const mix = (from: Rgb, to: Rgb, amount: number): Rgb =>
  [0, 1, 2].map((c) =>
    Math.round((from[c] ?? 0) * (1 - amount) + (to[c] ?? 0) * amount),
  ) as unknown as Rgb;

/** The nearest stepping stone's distance, in tiles on the ground plane. */
function stoneDistance(x: number, y: number, stones: readonly Vec2[]): number {
  return Math.min(...stones.map((stone) => Math.hypot(x - stone.x, y - stone.y)));
}

/** The painted colour of an edge-water texel, or null where the piece is clear. */
export function edgeTexel(
  tx: number,
  ty: number,
  cells: readonly Vec2[],
  stones: readonly Vec2[] = [],
): Rgb | null {
  const { x, y } = worldLogical((tx + 0.5) * GRAIN, (ty + 0.5) * GRAIN);
  const metric = waterMetric(x, y, cells);
  if (metric > BA_DAN_CANAL_BANK_RADIUS) return null;
  const paving = flagstoneTexel(tx, ty);
  if (metric <= 1) {
    const inset = shoreDistance(x, y, cells) * INSET_PER_TILE;
    const stone = stones.length ? stoneDistance(x, y, stones) : Infinity;
    let bed: Rgb;
    if (stone <= STONE_TOP) {
      // A stone's top: the paving's lightest tone, just under the surface.
      const top = FLAGSTONE_TONES[6]?.tone ?? paving;
      bed = scale(top, [STONE_SHADE, STONE_SHADE, STONE_SHADE]);
    } else if (stone <= STONE_RIM) {
      // Its rim, where the water is deepest against it: the paving's darkest tone, in shade.
      const rim = FLAGSTONE_TONES[0]?.tone ?? paving;
      bed = scale(rim, [0.55, 0.55, 0.55]);
    } else {
      const shade = step(bedShade(x, y, inset));
      bed = scale(paving, [shade, shade, shade]);
    }
    return mix(scale(bed, [BED_COOL.red, BED_COOL.green, BED_COOL.blue]), FILM.colour, FILM.alpha);
  }
  const { shade, wetness } = kerbShade(metric - 1);
  const flat = step(shade);
  const grey = paving[0] * 0.3 + paving[1] * 0.55 + paving[2] * 0.15;
  const dressed = paving.map(
    (c) => c * (1 - KERB_DESATURATE) + grey * KERB_DESATURATE,
  ) as unknown as Rgb;
  const wet = Math.round(wetness * 2) / 2;
  return scale(dressed, [flat * (1 - wet * KERB_WET_COOL), flat, flat * (1 + wet * KERB_WET_COOL)]);
}

/** One edge piece: opaque on the board, the apron's stepped fade past it. */
export function packEdgeWater(
  plate: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  },
  cells: readonly Vec2[],
  stones: readonly Vec2[] = [],
): Image {
  if (plate.x % GRAIN || plate.y % GRAIN || plate.width % GRAIN || plate.height % GRAIN)
    throw new Error('An edge piece must lie on the texel lattice.');
  const image = newImage(plate.width, plate.height);
  for (let ty = plate.y / GRAIN; ty < (plate.y + plate.height) / GRAIN; ty++)
    for (let tx = plate.x / GRAIN; tx < (plate.x + plate.width) / GRAIN; tx++) {
      const colour = edgeTexel(tx, ty, cells, stones);
      if (!colour) continue;
      const { x, y } = worldLogical((tx + 0.5) * GRAIN, (ty + 0.5) * GRAIN);
      // As the apron does: a texel with any pixel past the fade stays clear.
      const pastFade = [0.5, GRAIN - 0.5].some((dx) =>
        [0.5, GRAIN - 0.5].some((dy) => {
          const point = worldLogical(tx * GRAIN + dx, ty * GRAIN + dy);
          return apronDepth(point.x, point.y) >= APRON_FADE;
        }),
      );
      const alpha = texelTouchesBoard(tx, ty)
        ? 255
        : pastFade
          ? 0
          : apronAlpha(apronDepth(x, y), x, y);
      if (!alpha) continue;
      for (let dy = 0; dy < GRAIN; dy++)
        for (let dx = 0; dx < GRAIN; dx++)
          setPixel(image, tx * GRAIN - plate.x + dx, ty * GRAIN - plate.y + dy, [...colour, alpha]);
    }
  return image;
}

export const EDGE_WATER_PATH = `${DIRECTORY}/edge-water.webp`;

/** Every edge piece, packed at its `source` on the one shipped page. */
export function packEdgePage(): Image {
  const page = newImage(BA_DAN_EDGE_WATER_PAGE.width, BA_DAN_EDGE_WATER_PAGE.height);
  for (const piece of BA_DAN_EDGE_WATER) {
    const image = packEdgeWater(
      piece,
      piece.cells,
      piece.id === 'west-ford' ? BA_DAN_FORD_STONES : [],
    );
    for (let py = 0; py < image.height; py++)
      for (let px = 0; px < image.width; px++)
        setPixel(page, piece.source.x + px, piece.source.y + py, pixelAt(image, px, py));
  }
  return page;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/art/ba-dan-edges.ts')) {
  // The shipped page is the painted master (`ba-dan-water.ts`); this packer is the
  // geometric reference (footprint and apron fade), so it writes an audit copy only.
  mkdirSync('.shots/edges', { recursive: true });
  writeFileSync('.shots/edges/edge-water.webp', await encodeWebpLossless(packEdgePage()));
  console.log('.shots/edges/edge-water.webp');
}
