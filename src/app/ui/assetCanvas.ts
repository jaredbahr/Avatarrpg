/**
 * A portrait, or any other still asset, drawn into a <canvas> sized in rem.
 *
 * `painterCanvas` draws a painter and nothing else, which is why a manifest
 * entry that pointed at a real bitmap used to come out as a flat square in
 * every HUD portrait: the DOM side never asked the sprite cache for the image.
 * This asks. The first paint is the painter (or the bitmap, if it is already
 * in), and when the bitmap lands the canvas is repainted in place, provided it
 * is still on the page, so a dialog that closed meanwhile costs nothing.
 *
 * The bitmap is drawn from the image itself rather than from the sprite
 * cache's bucketed canvas: an 11rem stage portrait at Largest text on an iPad
 * is over 500 device pixels, well past the cache's 256px cap.
 */

import { resolvePainter } from '../../render/painters/registry';
import { sprites } from '../../render/spriteCache';
import { painterCanvas } from './dom';

/** The size every pixel-art dialogue portrait is drawn at (ADR 0107). */
export const PIXEL_PORTRAIT_PX = 160;

/**
 * Draws a 160 px pixel-art portrait so every art pixel covers a whole number of
 * device pixels. When the box is within a quarter of a whole multiple, or 3x and up, the
 * portrait is drawn at that multiple, nearest-neighbour and centred; any other box
 * upscales to the next whole multiple and smooths down from there, so a small
 * HUD portrait is never sampled at a fraction.
 */
export function drawPixelPortrait(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  px: number,
): void {
  const ratio = px / PIXEL_PORTRAIT_PX;
  const near = Math.round(ratio);
  ctx.imageSmoothingEnabled = false;
  // A big box (3x and up, e.g. the 15rem stage portrait at Large text, 4.5x) sits crisp at the whole
  // multiple below instead of smoothing: the picture is centred and loses under a quarter of the box.
  const mult = Math.abs(ratio - near) <= 0.25 ? near : ratio >= 3 ? Math.floor(ratio) : 0;
  if (mult >= 1) {
    const size = PIXEL_PORTRAIT_PX * mult;
    const offset = Math.floor((px - size) / 2);
    ctx.drawImage(image, offset, offset, size, size);
    return;
  }
  const up = Math.max(1, Math.ceil(ratio));
  const big = document.createElement('canvas');
  big.width = big.height = PIXEL_PORTRAIT_PX * up;
  const bigCtx = big.getContext('2d');
  if (!bigCtx) {
    ctx.drawImage(image, 0, 0, px, px);
    return;
  }
  bigCtx.imageSmoothingEnabled = false;
  bigCtx.drawImage(image, 0, 0, big.width, big.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(big, 0, 0, px, px);
}

export function assetCanvas(assetKey: string, remSize: number, extraClass = ''): HTMLCanvasElement {
  const draw = (ctx: CanvasRenderingContext2D, px: number): void => {
    const image = sprites.imageFor(assetKey);
    if (image) {
      if (assetKey.startsWith('portrait.') && image.naturalWidth === PIXEL_PORTRAIT_PX) {
        drawPixelPortrait(ctx, image, px);
      } else {
        ctx.drawImage(image, 0, 0, px, px);
      }
    } else {
      resolvePainter(assetKey).draw(ctx, { x: 0, y: 0, size: px });
    }
  };

  const canvas = painterCanvas(assetKey, remSize, draw, extraClass);

  if (!sprites.imageFor(assetKey)) {
    void sprites.whenLoaded(assetKey).then((loaded) => {
      if (!loaded || !canvas.isConnected) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      draw(ctx, canvas.width);
    });
  }

  return canvas;
}
