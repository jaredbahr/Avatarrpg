/**
 * A portrait, or any other still asset, drawn into a <canvas> sized in rem.
 *
 * `painterCanvas` draws a painter and nothing else, which is why a manifest
 * entry that pointed at a real bitmap used to come out as a flat square in
 * every HUD portrait: the DOM side never asked the sprite cache for the image.
 * This asks. The first paint is the painter (or the bitmap, if it is already
 * in), and when the bitmap lands the canvas is repainted in place, provided it
 * is still on the page, so a dialog that closed meanwhile costs nothing.
 * An optional fallback image lets an expression portrait keep showing the
 * neutral face while its variant is cold or unavailable.
 *
 * The bitmap is drawn from the image itself rather than from the sprite
 * cache's bucketed canvas: an 11rem stage portrait at Largest text on an iPad
 * is over 500 device pixels, well past the cache's 256px cap.
 */

import { resolvePainter } from '../../render/painters/registry';
import { sprites } from '../../render/spriteCache';
import { painterCanvas } from './dom';

export function assetCanvas(
  assetKey: string,
  remSize: number,
  extraClass = '',
  fallbackAssetKey?: string,
): HTMLCanvasElement {
  const draw = (ctx: CanvasRenderingContext2D, px: number): void => {
    const image = sprites.imageFor(assetKey);
    if (image) {
      ctx.drawImage(image, 0, 0, px, px);
    } else {
      const fallbackImage =
        fallbackAssetKey && fallbackAssetKey !== assetKey
          ? sprites.imageFor(fallbackAssetKey)
          : null;
      if (fallbackImage) ctx.drawImage(fallbackImage, 0, 0, px, px);
      else resolvePainter(fallbackAssetKey ?? assetKey).draw(ctx, { x: 0, y: 0, size: px });
    }
  };

  const canvas = painterCanvas(assetKey, remSize, draw, extraClass);

  const imageKeys = sprites.imageFor(assetKey)
    ? []
    : [...new Set([assetKey, fallbackAssetKey].filter((key): key is string => !!key))];
  for (const key of imageKeys) {
    if (sprites.imageFor(key)) continue;
    void sprites.whenLoaded(key).then((loaded) => {
      if (!loaded && !fallbackAssetKey) return;
      if (!canvas.isConnected) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      draw(ctx, canvas.width);
    });
  }

  return canvas;
}
