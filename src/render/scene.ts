import { resolveAsset } from '../content/assets/manifest';
import type { SceneScenery } from '../core/types';
import type { Camera } from './camera';
import type { MapView } from './view';
import { BackdropStore } from './backdrops';

/** Separate bounded cache: multi-piece scenes must not evict their own ground each frame. */
export const sceneImages = new BackdropStore(16);

// A small alpha mask avoids fading roofs when a figure is only inside the
// transparent image padding. Weak keys release masks with evicted images.
const masks = new WeakMap<HTMLImageElement, Uint8ClampedArray>();
const MASK_SIZE = 128;

function covers(image: HTMLImageElement, x: number, y: number): boolean {
  if (x < 0 || x >= 1 || y < 0 || y >= 1) return false;
  let mask = masks.get(image);
  if (!mask) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = MASK_SIZE;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return true;
    context.drawImage(image, 0, 0, MASK_SIZE, MASK_SIZE);
    mask = context.getImageData(0, 0, MASK_SIZE, MASK_SIZE).data;
    masks.set(image, mask);
  }
  return (
    (mask[(Math.floor(y * MASK_SIZE) * MASK_SIZE + Math.floor(x * MASK_SIZE)) * 4 + 3] ?? 0) > 64
  );
}

/** Roof cutaway follows actual on-screen overlap and ground depth, on either backend. */
export function sceneryOpacity(scenery: SceneScenery, view: MapView, camera: Camera): number {
  if (!scenery.fadeWhenOccluding) return 1;
  const image = sceneImages.get(scenery.url);
  if (!image) return 1;
  const depth = camera.groundPoint(scenery.depth).y;
  const party = view.units.filter((unit) => !unit.fallen && unit.faction === 'party');
  const occupants = [
    ...view.units
      .filter((unit) => !unit.fallen)
      .map((unit) => ({
        pos: unit.renderPos ?? unit.pos,
        size: unit.size,
        scale: unit.scale ?? 1,
      })),
    // Nearby people remain readable for conversation; a distant villager does
    // not turn an entire neighbourhood transparent permanently.
    ...view.npcs
      .filter((npc) =>
        party.some((unit) => {
          const pos = unit.renderPos ?? unit.pos;
          return Math.hypot(pos.x - npc.pos.x, pos.y - npc.pos.y) <= 3;
        }),
      )
      .map((npc) => {
        const entry = resolveAsset(npc.sprite);
        return {
          pos: npc.pos,
          size: entry.kind === 'sheet' ? entry.footprint.w : 1,
          scale: npc.scale ?? 1,
        };
      }),
  ];
  for (const { pos, size, scale } of occupants) {
    const foot = camera.groundPoint({ x: pos.x + size / 2, y: pos.y + 0.5 });
    if (foot.y > depth) continue;
    // Head, torso and feet probes follow upright figures, not the ground's
    // affine transform. Future route points cannot fade an unoccupied building.
    for (const lift of [8, 32, 56]) {
      if (
        covers(
          image,
          (foot.x - scenery.x) / scenery.width,
          (foot.y - lift * scale - scenery.y) / scenery.height,
        )
      )
        return 0.28;
    }
  }
  return 1;
}
