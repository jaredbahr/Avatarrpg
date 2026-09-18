import { resolveAsset } from '../content/assets/manifest';
import type { SceneImage, SceneScenery } from '../core/types';
import type { Camera } from './camera';
import type { MapView } from './view';
import { BackdropStore } from './backdrops';

/** Separate bounded cache: multi-piece scenes must not evict their own ground each frame. */
export const sceneImages = new BackdropStore(16);

// A small alpha mask avoids fading roofs when a figure is only inside the
// transparent image padding. Weak keys release masks with evicted images.
const masks = new WeakMap<HTMLImageElement, Map<string, Uint8Array>>();
const MASK_SIZE = 128;
const MAX_SLICE_MASKS = 32;

/** A bad atlas region is unavailable, just like a missing page. */
export function sceneSourceRect(piece: SceneImage, image: HTMLImageElement) {
  const rect = piece.sourceRect ?? {
    x: 0,
    y: 0,
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
  if (
    !Object.values(rect).every(Number.isInteger) ||
    rect.x < 0 ||
    rect.y < 0 ||
    rect.width <= 0 ||
    rect.height <= 0 ||
    rect.x + rect.width > image.naturalWidth ||
    rect.y + rect.height > image.naturalHeight ||
    (piece.sourceRect && (image.naturalWidth > 2048 || image.naturalHeight > 2048))
  )
    return null;
  return rect;
}

export function sceneImage(piece: SceneImage): HTMLImageElement | null {
  const image = sceneImages.get(piece.url);
  return image && sceneSourceRect(piece, image) ? image : null;
}

export function drawSceneImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  piece: SceneImage,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const rect = sceneSourceRect(piece, image);
  if (rect) context.drawImage(image, rect.x, rect.y, rect.width, rect.height, x, y, width, height);
}

function covers(image: HTMLImageElement, piece: SceneImage, x: number, y: number): boolean {
  if (x < 0 || x >= 1 || y < 0 || y >= 1) return false;
  const rect = sceneSourceRect(piece, image);
  if (!rect) return false;
  let slices = masks.get(image);
  if (!slices) {
    slices = new Map();
    masks.set(image, slices);
  }
  const key = `${rect.x},${rect.y},${rect.width},${rect.height}`;
  let mask = slices.get(key);
  if (!mask) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = MASK_SIZE;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return true;
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, MASK_SIZE, MASK_SIZE);
    const rgba = context.getImageData(0, 0, MASK_SIZE, MASK_SIZE).data;
    mask = Uint8Array.from({ length: MASK_SIZE * MASK_SIZE }, (_, i) => rgba[i * 4 + 3] ?? 0);
    slices.set(key, mask);
    const oldest = slices.keys().next().value;
    if (slices.size > MAX_SLICE_MASKS && oldest !== undefined) slices.delete(oldest);
  }
  slices.delete(key);
  slices.set(key, mask);
  return (mask[Math.floor(y * MASK_SIZE) * MASK_SIZE + Math.floor(x * MASK_SIZE)] ?? 0) > 64;
}

/** Roof cutaway follows actual on-screen overlap and ground depth, on either backend. */
export function sceneryOpacity(scenery: SceneScenery, view: MapView, camera: Camera): number {
  if (!scenery.fadeWhenOccluding) return 1;
  const image = sceneImage(scenery);
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
          scenery,
          (foot.x - scenery.x) / scenery.width,
          (foot.y - lift * scale - scenery.y) / scenery.height,
        )
      )
        return 0.28;
    }
  }
  return 1;
}
