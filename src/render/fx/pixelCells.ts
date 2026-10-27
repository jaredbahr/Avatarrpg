/**
 * The particle shapes as pixel sprites at the world's grain (G1, ADR 0085).
 *
 * Each shape is rasterised once at every size on a short ladder of whole world
 * pixels, with hard alpha, flat tones and the art bible's ink, and a particle
 * draws the rung nearest its size at one art px a world px, never a scaled
 * copy. Like the painted shapes before them they are white, so tinting gives
 * the colour: the lit body is white (the role colour exactly), the shadow side
 * a fixed grey under it, and the outline `#1b1410`, interrupted on the lit
 * upper left. Tiny rungs carry no ink, which would leave nothing but outline.
 *
 * Pure and deterministic: no canvas, no randomness. `atlas.ts` writes the
 * rungs into each shape's square of the effects atlas.
 */

import type { FxCell } from '../../content/fx';

/** World-pixel sizes a particle can draw at. */
export const PIXEL_LADDER = [2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 28, 32] as const;

/** The rung nearest `px` by ratio, so a 9 px particle takes 8 or 10 rather than drifting. */
export function ladderSize(px: number): number {
  if (!(px > PIXEL_LADDER[0])) return PIXEL_LADDER[0];
  let best: number = PIXEL_LADDER[0];
  let error = Infinity;
  for (const rung of PIXEL_LADDER) {
    const e = Math.abs(Math.log(px / rung));
    if (e < error) {
      error = e;
      best = rung;
    }
  }
  return best;
}

/** Where rung `size` sits inside a shape's atlas square: rungs up to 16 on the first row, the rest under them. */
export function ladderOffset(size: number): { x: number; y: number } {
  let x = 0;
  for (const rung of PIXEL_LADDER) {
    if (rung === size) return rung <= 16 ? { x, y: 0 } : { x, y: 17 };
    x = rung === 16 ? 0 : x + rung + 1;
  }
  throw new Error(`${size} px is not on the pixel ladder`);
}

/** The uninked copy of the ladder sits this far below the inked one in a shape's square. */
export const LIGHT_ROW = 50;

/** The body, its shadow side and the ink, before tinting. */
export const BODY = [255, 255, 255] as const;
export const SHADE = [184, 184, 184] as const;
export const INK = [0x1b, 0x14, 0x10] as const;
/** The outer step of a glow: a hard ring of lower opacity, never a gradient. */
export const GLOW_HALO_ALPHA = 104;

type Inside = (u: number, v: number) => boolean;

const circle =
  (cx: number, cy: number, r: number): Inside =>
  (u, v) =>
    (u - cx) ** 2 + (v - cy) ** 2 <= r * r;

function polygon(points: readonly (readonly [number, number])[]): Inside {
  return (u, v) => {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i] ?? [0, 0];
      const [xj, yj] = points[j] ?? [0, 0];
      if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
}

const any =
  (...parts: Inside[]): Inside =>
  (u, v) =>
    parts.some((part) => part(u, v));

/** The shapes the 128 px painted cells drew, on the unit square. */
const SHAPES: Readonly<Record<Exclude<FxCell, 'glow' | 'ring' | 'spark'>, Inside>> = {
  disc: circle(0.5, 0.5, 0.38),
  shard: polygon([
    [0.5, 0.1],
    [0.86, 0.62],
    [0.56, 0.9],
    [0.16, 0.7],
  ]),
  leaf: (u, v) => {
    // An ellipse leaning up to the right, as the painted leaf's two curves made.
    const x = u - 0.5;
    const y = v - 0.5;
    const c = Math.cos(-0.5);
    const s = Math.sin(-0.5);
    const a = x * c - y * s;
    const b = x * s + y * c;
    return (a / 0.42) ** 2 + (b / 0.2) ** 2 <= 1;
  },
  puff: any(
    circle(0.5, 0.55, 0.32),
    circle(0.3, 0.6, 0.24),
    circle(0.7, 0.62, 0.24),
    circle(0.42, 0.38, 0.22),
    circle(0.62, 0.4, 0.2),
  ),
  drop: any(
    circle(0.5, 0.64, 0.26),
    polygon([
      [0.5, 0.08],
      [0.25, 0.6],
      [0.75, 0.6],
    ]),
  ),
  square: polygon([
    [0.2, 0.22],
    [0.82, 0.18],
    [0.8, 0.8],
    [0.18, 0.78],
  ]),
};

/** Shapes the painted atlas inked; the glow, ring and spark were light and stay so. */
const INKED = new Set<FxCell>(['disc', 'shard', 'leaf', 'puff', 'drop', 'square']);

function coverage(cell: FxCell, size: number): Uint8Array {
  const mask = new Uint8Array(size * size);
  const at = (i: number) => (i + 0.5) / size;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = at(x);
      const v = at(y);
      const r = Math.hypot(u - 0.5, v - 0.5);
      let value = 0;
      switch (cell) {
        case 'glow':
          value = r <= 0.27 ? 2 : r <= 0.45 ? 1 : 0;
          break;
        case 'ring': {
          // Never thinner than a pixel, however small the rung.
          const band = Math.max(0.12, 1 / size);
          value = r <= 0.42 && r >= 0.42 - band ? 2 : 0;
          break;
        }
        case 'spark':
          value =
            Math.abs(u - 0.5) / 0.44 + Math.abs(v - 0.5) / 0.1 <= 1 ||
            (Math.abs(u - 0.5) <= 0.44 && y === Math.floor(size / 2))
              ? 2
              : 0;
          break;
        default:
          value = SHAPES[cell](u, v) ? 2 : 0;
      }
      mask[y * size + x] = value;
    }
  // A shape too small to land on any pixel centre still shows as one pixel.
  if (!mask.some((m) => m > 0)) mask[Math.floor(size / 2) * size + Math.floor(size / 2)] = 2;
  return mask;
}

/**
 * One shape at one rung, `size` x `size` RGBA, row-major. Body and shadow are
 * split along the down-right diagonal through the shape's own centre; the ink
 * runs on silhouette pixels from 8 px up (only down and right at 6–7 px).
 */
export function rasterCell(cell: FxCell, size: number, ink = true): Uint8ClampedArray {
  const mask = coverage(cell, size);
  const out = new Uint8ClampedArray(size * size * 4);
  let cx = 0;
  let cy = 0;
  let n = 0;
  for (let i = 0; i < mask.length; i++)
    if ((mask[i] ?? 0) > 0) {
      cx += i % size;
      cy += Math.floor(i / size);
      n += 1;
    }
  cx /= Math.max(1, n);
  cy /= Math.max(1, n);
  const solid = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < size && y < size && (mask[y * size + x] ?? 0) === 2;
  const inked = ink && INKED.has(cell) && size >= 6;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const m = mask[y * size + x] ?? 0;
      if (m === 0) continue;
      const at = (y * size + x) * 4;
      let tone: readonly number[] = BODY;
      if (m === 2 && inked) {
        const down = !solid(x + 1, y) || !solid(x, y + 1);
        const up = !solid(x - 1, y) || !solid(x, y - 1);
        if (down || (size >= 8 && up && x + y > cx + cy)) tone = INK;
        else if (size >= 8 && x - cx + (y - cy) > size * 0.12) tone = SHADE;
      } else if (m === 2 && size >= 8 && cell !== 'glow' && x - cx + (y - cy) > size * 0.2) {
        tone = SHADE;
      }
      out[at] = tone[0] ?? 255;
      out[at + 1] = tone[1] ?? 255;
      out[at + 2] = tone[2] ?? 255;
      out[at + 3] = m === 2 ? 255 : GLOW_HALO_ALPHA;
    }
  return out;
}
