/**
 * The effects atlas.
 *
 * Every particle is one of a handful of shapes drawn once, in white with the
 * art bible's ink edge, into a small canvas: a soft glow, a flat disc, a
 * ring, a spark streak, a shard, a leaf, a puff of smoke, a droplet and a
 * square of stone. Tinting does the colour, so one atlas serves every
 * element on both backends; the WebGL layer uploads it once and the Canvas
 * 2D layer tints cells into small cached copies.
 */

import type { FxCell } from '../../content/fx';
import { FX_CELLS } from '../../content/fx';
import { CEL_FRAMES, CEL_SIZE, FX_CELS, FX_CEL_SHEETS, type FxCel } from '../../content/fxCels';

/** Nine tinted shapes plus 48 coloured animation cels in one 1024px texture. */
export const ATLAS_COLUMNS = 8;
export const ATLAS_CELL = 128;
export const ATLAS_SIZE = ATLAS_COLUMNS * ATLAS_CELL;

const INK = '#1b1410';

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

export function celAtlasFrame(cel: FxCel, frame: number): CellFrame {
  return frameAt(FX_CELLS.length + FX_CELS.indexOf(cel) * CEL_FRAMES + frame);
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
                    frame.size,
                    frame.size,
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

/** Draws one shape, white on transparent, inside a `size` square at the origin. */
export function paintCell(ctx: CanvasRenderingContext2D, cell: FxCell, size: number): void {
  const c = size / 2;
  const ink = Math.max(1.5, size * 0.045);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  switch (cell) {
    case 'glow': {
      const g = ctx.createRadialGradient(c, c, 0, c, c, c * 0.95);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      break;
    }
    case 'disc': {
      ctx.beginPath();
      ctx.arc(c, c, c * 0.72, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = ink;
      ctx.strokeStyle = INK;
      ctx.stroke();
      break;
    }
    case 'ring': {
      ctx.beginPath();
      ctx.arc(c, c, c * 0.7, 0, Math.PI * 2);
      ctx.lineWidth = size * 0.12;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      break;
    }
    case 'spark': {
      ctx.beginPath();
      ctx.moveTo(size * 0.08, c);
      ctx.lineTo(c, c - size * 0.09);
      ctx.lineTo(size * 0.92, c);
      ctx.lineTo(c, c + size * 0.09);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      break;
    }
    case 'shard': {
      ctx.beginPath();
      ctx.moveTo(size * 0.5, size * 0.1);
      ctx.lineTo(size * 0.86, size * 0.62);
      ctx.lineTo(size * 0.56, size * 0.9);
      ctx.lineTo(size * 0.16, size * 0.7);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = ink;
      ctx.strokeStyle = INK;
      ctx.stroke();
      break;
    }
    case 'leaf': {
      ctx.beginPath();
      ctx.moveTo(size * 0.12, size * 0.6);
      ctx.quadraticCurveTo(size * 0.4, size * 0.05, size * 0.9, size * 0.3);
      ctx.quadraticCurveTo(size * 0.6, size * 0.92, size * 0.12, size * 0.6);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = ink;
      ctx.strokeStyle = INK;
      ctx.stroke();
      break;
    }
    case 'puff': {
      ctx.fillStyle = '#ffffff';
      const lobes: [number, number, number][] = [
        [0.5, 0.55, 0.32],
        [0.3, 0.6, 0.24],
        [0.7, 0.62, 0.24],
        [0.42, 0.38, 0.22],
        [0.62, 0.4, 0.2],
      ];
      ctx.beginPath();
      for (const [x, y, r] of lobes) {
        ctx.moveTo(size * (x + r), size * y);
        ctx.arc(size * x, size * y, size * r, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.lineWidth = ink;
      ctx.strokeStyle = INK;
      ctx.stroke();
      break;
    }
    case 'drop': {
      ctx.beginPath();
      ctx.moveTo(c, size * 0.1);
      ctx.bezierCurveTo(size * 0.85, size * 0.55, size * 0.75, size * 0.9, c, size * 0.9);
      ctx.bezierCurveTo(size * 0.25, size * 0.9, size * 0.15, size * 0.55, c, size * 0.1);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = ink;
      ctx.strokeStyle = INK;
      ctx.stroke();
      break;
    }
    case 'square': {
      ctx.beginPath();
      ctx.moveTo(size * 0.2, size * 0.22);
      ctx.lineTo(size * 0.82, size * 0.18);
      ctx.lineTo(size * 0.8, size * 0.8);
      ctx.lineTo(size * 0.18, size * 0.78);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = ink;
      ctx.strokeStyle = INK;
      ctx.stroke();
      break;
    }
  }
}
