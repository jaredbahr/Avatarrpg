/**
 * The board's decor, baked for WebGL.
 *
 * The decor painters draw with a Canvas 2D context (`painters/board.ts`), and
 * the Canvas 2D backend calls them straight onto the board. The WebGL backend
 * paints the same routines into square chunk canvases once per grid and zoom
 * bucket, uploads each as a texture and draws them as sprites, so both
 * backends show the identical cliffs, canopies and walls from one source.
 *
 * Bounded like the sprite cache: chunks are keyed by grid signature, chunk
 * index and pixel size, evicted least-recently-used, and never baked sharper
 * than `DECOR_PX_CAP` device pixels a tile, so a chunk stays inside the
 * 2048 px texture every iPad accepts and the whole set inside a few MB.
 */

import type { Grid } from '../core/types';
import type { TileRelief } from './geometry/board';
import { DECOR_CHUNK, boardRelief, decorSignature } from './geometry/board';
import { paintElevationBase, paintTileDecor } from './painters/board';

/** Device pixels per tile at the sharpest bake. */
export const DECOR_PX_CAP = 128;

/** Chunks kept: at the cap, sixteen of them are 64 MB of canvas. */
const MAX_CHUNKS = 16;

export class DecorSheets {
  private chunks = new Map<string, HTMLCanvasElement>();
  private signature = '';
  private relief: ReadonlyMap<number, TileRelief> = new Map();

  /**
   * Points the sheets at a grid. Returns true when the decor changed, which
   * the caller uses to know its sprites' textures are stale.
   */
  sync(grid: Grid): boolean {
    const signature = decorSignature(grid);
    if (signature === this.signature) return false;
    this.signature = signature;
    this.relief = boardRelief(grid);
    this.chunks.clear();
    return true;
  }

  clear(): void {
    this.chunks.clear();
  }

  /** The baked chunk at (`cx`, `cy`) in chunk units, `px` device pixels a tile. */
  get(grid: Grid, cx: number, cy: number, px: number, elevationOnly = false): HTMLCanvasElement {
    const size = Math.max(8, Math.min(DECOR_PX_CAP, Math.round(px)));
    const key = `${cx},${cy}|${size}|${elevationOnly ? 'elevation' : 'full'}`;
    const existing = this.chunks.get(key);
    if (existing) {
      this.chunks.delete(key);
      this.chunks.set(key, existing);
      return existing;
    }

    const canvas = document.createElement('canvas');
    canvas.width = size * DECOR_CHUNK;
    canvas.height = size * DECOR_CHUNK;
    const ctx = canvas.getContext('2d');
    if (ctx) this.bake(ctx, grid, cx, cy, size, elevationOnly);

    this.chunks.set(key, canvas);
    while (this.chunks.size > MAX_CHUNKS) {
      const oldest = this.chunks.keys().next().value;
      if (oldest === undefined) break;
      this.chunks.delete(oldest);
    }
    return canvas;
  }

  /**
   * Paints the chunk's tiles plus a one-tile margin round them, so a canopy
   * that overhangs its tile shows on the neighbouring chunk too; the canvas
   * clips the rest.
   */
  private bake(
    ctx: CanvasRenderingContext2D,
    grid: Grid,
    cx: number,
    cy: number,
    size: number,
    elevationOnly: boolean,
  ): void {
    const x0 = cx * DECOR_CHUNK;
    const y0 = cy * DECOR_CHUNK;
    for (let y = y0 - 1; y <= y0 + DECOR_CHUNK; y++) {
      if (y < 0 || y >= grid.height) continue;
      for (let x = x0 - 1; x <= x0 + DECOR_CHUNK; x++) {
        if (x < 0 || x >= grid.width) continue;
        const index = y * grid.width + x;
        const tile = grid.tiles[index];
        if (!tile) continue;
        const box = { x: (x - x0) * size, y: (y - y0) * size, size };
        if (elevationOnly) paintElevationBase(ctx, box, tile, { x, y }, this.relief.get(index));
        else paintTileDecor(ctx, box, tile, { x, y }, this.relief.get(index));
      }
    }
  }
}
