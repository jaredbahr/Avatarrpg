/**
 * A prop's grounded cast (`groundedCast` in lighting.ts) as a canvas both
 * backends draw into the shadow union: white where the cast falls, at the
 * art's own pixel size and origin, so it is placed exactly as the prop is.
 * Built once per drawn sprite and key (a piece's `feet` are fixed with its art);
 * the sprite cache's canvases are its keys, so a cast goes when its sprite is evicted.
 */
import type { SceneScenery } from '../core/types';
import { footprintSpan, groundedCast, type CastKey, type GroundSpan } from './lighting';

const casts = new WeakMap<object, Map<string, HTMLCanvasElement | null>>();

export function groundedCastArt(
  source: HTMLCanvasElement | HTMLImageElement,
  key: CastKey,
  feet?: GroundSpan,
): HTMLCanvasElement | null {
  let byKey = casts.get(source);
  if (!byKey) {
    byKey = new Map();
    casts.set(source, byKey);
  }
  const id = `${key.x},${key.y}`;
  const cached = byKey.get(id);
  if (cached !== undefined) return cached;
  const width = source.width;
  const height = source.height;
  let art: HTMLCanvasElement | null = null;
  if (width > 0 && height > 0) {
    const read = document.createElement('canvas');
    read.width = width;
    read.height = height;
    const readCtx = read.getContext('2d', { willReadFrequently: true });
    if (readCtx) {
      readCtx.drawImage(source, 0, 0);
      const pixels = readCtx.getImageData(0, 0, width, height).data;
      const cast = groundedCast(
        (x, y) => pixels[(y * width + x) * 4 + 3] ?? 0,
        width,
        height,
        key,
        128,
        feet,
      );
      art = document.createElement('canvas');
      art.width = cast.width;
      art.height = cast.height;
      const ctx = art.getContext('2d');
      if (ctx) {
        const image = ctx.createImageData(cast.width, cast.height);
        cast.mask.forEach((on, i) => {
          if (on) image.data.set([255, 255, 255, 255], i * 4);
        });
        ctx.putImageData(image, 0, 0);
      }
    }
  }
  byKey.set(id, art);
  return art;
}

const pieces = new WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement | null>>();

/**
 * A scenery piece as it is drawn, at one canvas pixel per world pixel and
 * mirrored when the piece is: the art a piece's grounded cast and contact line
 * are cut from (`SceneScenery.castFrom: 'base'`). Cached per image and piece.
 */
export function pieceArt(
  image: HTMLImageElement,
  piece: SceneScenery,
  draw: (context: CanvasRenderingContext2D, width: number, height: number) => void,
): HTMLCanvasElement | null {
  let byPiece = pieces.get(image);
  if (!byPiece) {
    byPiece = new Map();
    pieces.set(image, byPiece);
  }
  const cached = byPiece.get(piece.id);
  if (cached !== undefined) return cached;
  const width = Math.max(1, Math.round(piece.width));
  const height = Math.max(1, Math.round(piece.height));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  let art: HTMLCanvasElement | null = null;
  if (context) {
    if (piece.flip) {
      context.translate(width, 0);
      context.scale(-1, 1);
    }
    draw(context, width, height);
    art = canvas;
  }
  byPiece.set(piece.id, art);
  return art;
}

/**
 * Where a piece's footprint lies on its art (`pieceArt`, one pixel per scene pixel): the feet its grounded cast may
 * stand on. `groundPoint` is the camera's map from a logical ground point to scene pixels.
 */
export function pieceFeet(
  piece: SceneScenery,
  camera: { groundPoint(pos: { x: number; y: number }): { x: number; y: number } },
): GroundSpan {
  return footprintSpan(piece.footprint, (point) => {
    const p = camera.groundPoint(point);
    return { x: p.x - piece.x, y: p.y - piece.y };
  });
}
