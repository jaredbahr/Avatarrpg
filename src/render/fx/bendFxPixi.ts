/**
 * The WebGL side of painted bend effects (ADR 0055, step 5): one pooled
 * sprite a cel, placed by `bendFxPlacement` and textured from `bendFxSource`,
 * the brightened cel when it flashes, exactly as Canvas 2D draws it.
 */

import type { Container, Texture } from 'pixi.js';
import { Sprite } from 'pixi.js';
import type { Camera } from '../camera';
import type { BendFxSprite } from '../view';
import { bendFxPlacement } from './bendFxDraw';

export function syncBendFx(
  layer: Container,
  sprites: readonly BendFxSprite[],
  camera: Camera,
  texture: (sprite: BendFxSprite) => Texture | null,
): void {
  let used = 0;
  for (const sprite of sprites) {
    const tex = texture(sprite);
    if (!tex) continue;
    const p = bendFxPlacement(sprite, camera);
    let s = layer.children[used] as Sprite | undefined;
    if (!s) s = layer.addChild(new Sprite());
    used++;
    s.texture = tex;
    s.anchor.set(p.ax, p.ay);
    s.position.set(p.x, p.y);
    s.rotation = p.rotation;
    s.width = p.w;
    s.height = p.h;
    // After the size: Pixi's height setter keeps the sign of `scale.y`.
    s.scale.y = Math.abs(s.scale.y) * p.sy;
    s.alpha = sprite.alpha;
    s.blendMode = sprite.blend === 'add' ? 'add' : 'normal';
    s.visible = true;
  }
  layer.children.forEach((child, index) => {
    child.visible = index < used;
  });
}
