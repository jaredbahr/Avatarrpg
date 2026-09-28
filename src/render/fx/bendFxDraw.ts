/**
 * Drawing painted bend effects (ADR 0055, step 5): where a resolved sprite
 * lands, for both backends, and the Canvas 2D draw.
 *
 * A flashed sprite draws its cel brightened (`bendFlash.ts`), a copy of
 * that one cel: never the unit's white mask, which Canvas 2D builds for a
 * whole page.
 */

import { BackdropStore } from '../backdrops';
import type { Camera } from '../camera';
import { TILE } from '../camera';
import type { BendFxSprite } from '../view';
import { flashedCel } from './bendFlash';

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
  return {
    x: at.x,
    y: at.y,
    w: sprite.width * TILE,
    h: sprite.height * TILE,
    ax: sprite.pivot.x / sprite.frame.w,
    ay: sprite.pivot.y / sprite.frame.h,
    rotation: (sprite.turn * Math.PI) / 180,
    /** -1 mirrors the cel top to bottom about its pivot, before the turn. */
    sy: sprite.flipY ? -1 : 1,
  };
}

/**
 * What a sprite draws from: its page and rectangle, or, flashed, its
 * brightened cel whole. Null until the page has loaded.
 */
export function bendFxSource(
  sprite: BendFxSprite,
): { image: HTMLImageElement | HTMLCanvasElement; frame: BendFxSprite['frame'] } | null {
  const page = bendFxPages.get(sprite.image);
  if (!page) return null;
  const { frame, flash } = sprite;
  const cel = flash > 0 ? flashedCel(page, sprite.image, frame, flash) : null;
  return cel
    ? { image: cel, frame: { x: 0, y: 0, w: frame.w, h: frame.h } }
    : { image: page, frame };
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
