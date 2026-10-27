/**
 * The effects atlas.
 *
 * Every particle is one of a handful of shapes, each rasterised as pixel art
 * at every rung of a short ladder of sizes (`pixelCells.ts`), in white with
 * the art bible's ink edge: a stepped glow, a flat disc, a ring, a spark
 * streak, a shard, a leaf, a puff of smoke, a droplet and a square of stone.
 * Tinting does the colour, so one atlas serves every element on both
 * backends; the WebGL layer uploads it once, nearest-sampled, and the Canvas
 * 2D layer tints cells into small cached copies. The element cels sit in
 * their own slots at their 96 px master size (ADR 0086).
 */

import type { FxCell } from '../../content/fx';
import { FX_CELLS } from '../../content/fx';
import { CEL_FRAMES, CEL_SIZE, FX_CELS, FX_CEL_SHEETS, type FxCel } from '../../content/fxCels';
import { PIXEL_LADDER, ladderOffset, ladderSize, rasterCell } from './pixelCells';
import { resampleCel } from './celResample';
import { TILE } from '../camera';

/** Nine tinted shape ladders plus 52 coloured animation cels in one 1024px texture. */
export const ATLAS_COLUMNS = 8;
export const ATLAS_CELL = 128;
export const ATLAS_SIZE = ATLAS_COLUMNS * ATLAS_CELL;

export interface CellFrame {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

/** Where a cell sits in the atlas, in pixels. */
export function cellFrame(cell: FxCell): CellFrame {
  const index = FX_CELLS.indexOf(cell);
  return frameAt(index);
}

function frameAt(index: number): CellFrame {
  const column = index % ATLAS_COLUMNS;
  const row = Math.floor(index / ATLAS_COLUMNS);
  return { x: column * ATLAS_CELL, y: row * ATLAS_CELL, size: ATLAS_CELL };
}

let cached: HTMLCanvasElement | null = null;
let loading: Promise<void> | null = null;
const ready = new Set<FxCel>();
const listeners = new Set<() => void>();

/** A cel's square in the atlas: its master at one art px a pixel, in the slot's corner. */
export function celAtlasFrame(cel: FxCel, frame: number): CellFrame {
  const slot = frameAt(FX_CELLS.length + FX_CELS.indexOf(cel) * CEL_FRAMES + frame);
  return { x: slot.x, y: slot.y, size: CEL_SIZE };
}

export const celReady = (cel: FxCel): boolean => ready.has(cel);

/** GPU sources must be refreshed when a sheet finishes loading. */
export function onFxAtlasChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** A missing file leaves the existing shape fallback available on both backends. */
export function fxCelsReady(): Promise<void> {
  fxAtlas();
  return loading ?? Promise.resolve();
}

/** The atlas canvas, painted on first use. */
export function fxAtlas(): HTMLCanvasElement {
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    for (const cell of FX_CELLS) {
      const frame = cellFrame(cell);
      ctx.save();
      ctx.translate(frame.x, frame.y);
      paintCell(ctx, cell, frame.size);
      ctx.restore();
    }
  }
  cached = canvas;
  loading = Promise.all(
    FX_CEL_SHEETS.map(
      (sheet) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          image.onload = () => {
            if (
              ctx &&
              image.naturalWidth === CEL_SIZE * CEL_FRAMES &&
              image.naturalHeight === CEL_SIZE * sheet.clips.length
            ) {
              sheet.clips.forEach((clip, row) => {
                for (let col = 0; col < CEL_FRAMES; col++) {
                  const frame = celAtlasFrame(clip, col);
                  ctx.drawImage(
                    image,
                    col * CEL_SIZE,
                    row * CEL_SIZE,
                    CEL_SIZE,
                    CEL_SIZE,
                    frame.x,
                    frame.y,
                    CEL_SIZE,
                    CEL_SIZE,
                  );
                }
                ready.add(clip);
              });
              for (const listener of listeners) listener();
            }
            resolve();
          };
          image.onerror = () => resolve();
          image.src = `${import.meta.env.BASE_URL}${sheet.url}`;
        }),
    ),
  ).then(() => undefined);
  return canvas;
}

/**
 * Draws one shape's pixel ladder, white on transparent, into its `size`
 * square at the origin: every rung of `PIXEL_LADDER` at one art px a pixel
 * (`pixelCells.ts`). A particle draws the rung nearest its size, unscaled.
 */
export function paintCell(ctx: CanvasRenderingContext2D, cell: FxCell, size: number): void {
  for (const rung of PIXEL_LADDER) {
    const at = ladderOffset(rung);
    if (at.x + rung > size || at.y + rung > size) continue;
    const pixels = new ImageData(new Uint8ClampedArray(rasterCell(cell, rung)), rung, rung);
    const t = ctx.getTransform();
    ctx.putImageData(pixels, t.e + at.x, t.f + at.y);
  }
}

/** The rung of a shape a `px` world-pixel particle draws, in atlas pixels. */
export function rungFrame(cell: FxCell, px: number): CellFrame & { readonly rung: number } {
  const rung = ladderSize(px);
  const base = cellFrame(cell);
  const at = ladderOffset(rung);
  return { x: base.x + at.x, y: base.y + at.y, size: rung, rung };
}

/** Resampled cels kept: a fight shows a handful of cue sizes at a time. */
const MAX_SIZED = 64;
const masters = new Map<string, Uint8ClampedArray>();
const sized = new Map<string, HTMLCanvasElement>();

/** The whole world-pixel size a cel `tiles` across draws at. */
export const celPx = (tiles: number): number => Math.max(1, Math.round(tiles * TILE));

/**
 * A cel's `frame`, resampled to `px` x `px` world pixels (`celResample.ts`),
 * for both backends to draw unscaled. Null until its sheet has loaded.
 * `key` in the result changes only with the cel, frame and size.
 */
export function celAtSize(
  cel: FxCel,
  frame: number,
  px: number,
): { readonly canvas: HTMLCanvasElement; readonly key: string } | null {
  if (!ready.has(cel)) return null;
  const key = `${cel}/${frame}/${px}`;
  const kept = sized.get(key);
  if (kept) {
    sized.delete(key);
    sized.set(key, kept);
    return { canvas: kept, key };
  }
  const masterKey = `${cel}/${frame}`;
  let master = masters.get(masterKey);
  if (!master) {
    const at = celAtlasFrame(cel, frame);
    const ctx = fxAtlas().getContext('2d');
    if (!ctx) return null;
    master = ctx.getImageData(at.x, at.y, CEL_SIZE, CEL_SIZE).data;
    masters.set(masterKey, master);
  }
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.putImageData(
    new ImageData(new Uint8ClampedArray(resampleCel(master, CEL_SIZE, px)), px, px),
    0,
    0,
  );
  sized.set(key, canvas);
  while (sized.size > MAX_SIZED) {
    const oldest = sized.keys().next().value;
    if (oldest === undefined) break;
    sized.delete(oldest);
  }
  return { canvas, key };
}
