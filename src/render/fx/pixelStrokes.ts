/**
 * Strokes at the world's grain (G1, ADR 0085; ADR 0086).
 *
 * The stroke shapes (fire licks, slabs, cracks, whips, bolts, gusts, ripples)
 * are sampled exactly as before; what changes is how they reach the screen.
 * Each emitter's shapes are drawn into a small canvas at one pixel a world
 * pixel, then hardened: a pixel at least half covered is kept, solid, in the
 * emitter's colour or its ink, whichever it is nearer, and every other pixel
 * is cleared. The canvas is then drawn nearest-sampled where the vector paths
 * used to go, by both backends, so a stroke has the same hard one-pixel edge
 * on the world grid as the cels beside it. A shape's own fade is kept as its
 * opacity, in eighths.
 */

import { TILE } from '../camera';
import type { Stroke } from './simulate';

export interface StrokeRaster {
  /** The emitter's strokes, hardened, at one pixel a world pixel. */
  readonly canvas: HTMLCanvasElement;
  /** The raster's corner in world pixels (tile x `TILE`). */
  readonly x: number;
  readonly y: number;
  /** The part of `canvas` in use; the canvas is pooled and may be larger. */
  readonly width: number;
  readonly height: number;
}

/** Opacity a hardened pixel keeps, by the shape's fade, in eighths (0 drops it). */
export const fadeLevel = (alpha: number): number =>
  Math.round(Math.max(0, Math.min(1, alpha)) * 8) / 8;

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * Hardens one drawn layer `drawn` (straight RGBA, as `getImageData` returns
 * it) into `out`: covered pixels become `colour` or `ink`, at `level`
 * opacity, over anything fainter already there. Pure, for the tests.
 */
export function harden(
  drawn: Uint8ClampedArray,
  out: Uint8ClampedArray,
  colour: readonly [number, number, number],
  ink: readonly [number, number, number] | null,
  level: number,
): void {
  const a = Math.round(level * 255);
  for (let i = 0; i < drawn.length; i += 4) {
    if ((drawn[i + 3] ?? 0) < 128 || (out[i + 3] ?? 0) >= a) continue;
    let tone = colour;
    if (ink) {
      const d = (t: readonly number[]) =>
        ((drawn[i] ?? 0) - (t[0] ?? 0)) ** 2 +
        ((drawn[i + 1] ?? 0) - (t[1] ?? 0)) ** 2 +
        ((drawn[i + 2] ?? 0) - (t[2] ?? 0)) ** 2;
      if (d(ink) < d(colour)) tone = ink;
    }
    out[i] = tone[0];
    out[i + 1] = tone[1];
    out[i + 2] = tone[2];
    out[i + 3] = a;
  }
}

/** The world-pixel box the shapes cover, padded by their widths; null when empty. */
export function strokeBounds(
  shapes: readonly Stroke[],
): { x: number; y: number; width: number; height: number } | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let pad = 0;
  for (const shape of shapes) {
    if (fadeLevel(shape.alpha) === 0) continue;
    pad = Math.max(pad, (shape.width + 0.05) * TILE);
    for (let i = 0; i + 1 < shape.points.length; i += 2) {
      const x = (shape.points[i] ?? 0) * TILE;
      const y = (shape.points[i + 1] ?? 0) * TILE;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  if (!Number.isFinite(x0)) return null;
  const margin = Math.ceil(pad / 2) + 2;
  const x = Math.floor(x0) - margin;
  const y = Math.floor(y0) - margin;
  return { x, y, width: Math.ceil(x1) + margin - x, height: Math.ceil(y1) + margin - y };
}

/** Rasters are pooled by slot; the largest a stroke may cover, so a stray shape cannot allocate a huge canvas. */
const MAX_SIDE = 1024;

export class StrokeRasterer {
  private readonly pool: HTMLCanvasElement[] = [];
  private scratch: HTMLCanvasElement | null = null;

  /**
   * Draws `shapes` as `slot`'s raster. `colour` and `ink` are hex; `ink` is
   * null for a stroke without an outline. Null when nothing is visible or no
   * 2D context is available.
   */
  raster(
    slot: number,
    shapes: readonly Stroke[],
    colour: string,
    ink: string | null,
  ): StrokeRaster | null {
    const box = strokeBounds(shapes);
    if (!box) return null;
    const width = Math.min(MAX_SIDE, box.width);
    const height = Math.min(MAX_SIDE, box.height);
    const scratch = (this.scratch ??= document.createElement('canvas'));
    fit(scratch, width, height);
    const sctx = scratch.getContext('2d', { willReadFrequently: true });
    let canvas = this.pool[slot];
    if (!canvas) {
      canvas = document.createElement('canvas');
      this.pool[slot] = canvas;
    }
    fit(canvas, width, height);
    const ctx = canvas.getContext('2d');
    if (!sctx || !ctx) return null;
    const out = new Uint8ClampedArray(width * height * 4);
    const levels = [...new Set(shapes.map((s) => fadeLevel(s.alpha)))]
      .filter((l) => l > 0)
      .sort((a, b) => b - a);
    const fill = rgb(colour);
    const outline = ink ? rgb(ink) : null;
    for (const level of levels) {
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, width, height);
      sctx.setTransform(TILE, 0, 0, TILE, -box.x, -box.y);
      sctx.lineCap = 'round';
      sctx.lineJoin = 'round';
      for (const shape of shapes) {
        if (fadeLevel(shape.alpha) !== level) continue;
        sctx.beginPath();
        for (let i = 0; i + 1 < shape.points.length; i += 2) {
          const x = shape.points[i] ?? 0;
          const y = shape.points[i + 1] ?? 0;
          if (i === 0) sctx.moveTo(x, y);
          else sctx.lineTo(x, y);
        }
        if (shape.closed) sctx.closePath();
        if (ink) {
          sctx.strokeStyle = ink;
          sctx.lineWidth = shape.width + 0.05;
          sctx.stroke();
        }
        if (shape.fill) {
          sctx.fillStyle = colour;
          sctx.fill();
        } else {
          sctx.strokeStyle = colour;
          sctx.lineWidth = Math.max(1 / TILE, shape.width);
          sctx.stroke();
        }
      }
      harden(sctx.getImageData(0, 0, width, height).data, out, fill, outline, level);
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(new ImageData(out, width, height), 0, 0);
    return { canvas, x: box.x, y: box.y, width, height };
  }
}

/** Grows a pooled canvas in steps of 64, never shrinks it. */
function fit(canvas: HTMLCanvasElement, width: number, height: number): void {
  const w = Math.max(canvas.width, Math.ceil(width / 64) * 64);
  const h = Math.max(canvas.height, Math.ceil(height / 64) * 64);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
}
