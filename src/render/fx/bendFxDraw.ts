/**
 * Drawing painted effect cels (the top-down shots, #588): where a resolved
 * sprite lands, for both backends, and the Canvas 2D draw.
 */

import { BackdropStore } from '../backdrops';
import type { Camera } from '../camera';
import { tileSize } from '../projection';
import type { BendFxSprite } from '../view';

/** The effect pages, decoded once through the loader the paintings use. */
export const bendFxPages = new BackdropStore(4, 'Bend effect page', 'drawing without it');

/**
 * Where a sprite goes in unscaled world pixels, the space `groundPoint`
 * returns: its pivot's point, its size, the pivot as a fraction of the cel,
 * and its turn in radians. Canvas 2D scales and pans it with the camera; Pixi
 * sets it on a sprite inside the camera-scaled layer. One rule for both.
 */
export function bendFxPlacement(sprite: BendFxSprite, camera: Camera) {
  const at = camera.boardPoint(sprite.at);
  const tile = tileSize(camera.projection);
  return {
    x: at.x,
    y: at.y,
    w: sprite.width * tile,
    h: sprite.height * tile,
    ax: sprite.pivot.x / sprite.frame.w,
    ay: sprite.pivot.y / sprite.frame.h,
    rotation: (sprite.turn * Math.PI) / 180,
    /** -1 mirrors the cel top to bottom about its pivot, before the turn. */
    sy: sprite.flipY ? -1 : 1,
  };
}

/** What a sprite draws from: its page and rectangle. Null until the page has loaded. */
export function bendFxSource(
  sprite: BendFxSprite,
): { image: HTMLImageElement | HTMLCanvasElement; frame: BendFxSprite['frame'] } | null {
  const page = bendFxPages.get(sprite.image);
  if (!page) return null;
  return { image: page, frame: sprite.frame };
}

/** Canvas 2D: the sprites under the actors, or over them, in order. */
export function drawBendFx(
  ctx: CanvasRenderingContext2D,
  sprites: readonly BendFxSprite[],
  camera: Camera,
  over: boolean,
): void {
  const s = camera.scale;
  for (const sprite of sprites) {
    if ((sprite.z === 'overActor') !== over) continue;
    const source = bendFxSource(sprite);
    if (!source) continue;
    const p = bendFxPlacement(sprite, camera);
    const f = source.frame;
    ctx.save();
    ctx.translate(p.x * s - camera.offsetX, p.y * s - camera.offsetY);
    ctx.rotate(p.rotation);
    if (p.sy < 0) ctx.scale(1, -1);
    ctx.globalAlpha = sprite.alpha;
    // The cels are pixel art at the world's grain (ADR 0086): never blended between texels.
    ctx.imageSmoothingEnabled = false;
    if (sprite.blend === 'add') ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(
      source.image,
      f.x,
      f.y,
      f.w,
      f.h,
      -p.ax * p.w * s,
      -p.ay * p.h * s,
      p.w * s,
      p.h * s,
    );
    ctx.restore();
  }
}
