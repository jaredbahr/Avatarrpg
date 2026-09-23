import { resolveAsset } from '../content/assets/manifest';
import { tileAt } from '../core/rules/grid';
import type { Grid, MapScene, SceneImage, SceneScenery } from '../core/types';
import type { Camera } from './camera';
import type { MapView } from './view';
import { BackdropStore } from './backdrops';

/**
 * How many distinct scene images stay decoded at once.
 *
 * A partial scene paints its authored ground only when *every* ground piece —
 * and every scenery piece — is resident, because a board that shows part of a
 * painting and the procedural fallback under the rest is neither. So this cap
 * is a content contract, not just a memory knob: a scene with more distinct
 * images than this can never satisfy `sceneGround`, falls back to the grid
 * forever, and re-decodes its evicted pieces every frame while it does.
 * `scene.test.ts` holds every partial scene under it, so a split piece fails
 * the suite instead of silently deleting the village.
 *
 * The decoded cost is small next to the paintings' (a plate is 300-900 px
 * wide): the widest scene here holds 27 distinct images, about 23 MB, against
 * the ~35 MB a quarry scene already keeps resident under the old cap.
 */
export const SCENE_IMAGE_CAP = 32;

/** Separate bounded cache: multi-piece scenes must not evict their own ground each frame. */
export const sceneImages = new BackdropStore(SCENE_IMAGE_CAP);

/**
 * Keep stateful structure art aligned with the grid loaded from a save.
 *
 * A content scene can be newer than a saved battle. Most scenery is
 * presentation-only and remains valid across that boundary, but a piece that
 * opts into `wall` represents authored wall cells and must not
 * appear on an older open tile. `terrain === 'wall'` is intentional: a stale
 * save may contain a later solid prop on that coordinate without having the
 * authored masonry that the scene describes. Exterior scenery has no tile to
 * validate and remains visible.
 *
 * A registered heap is stateful art too: rubble grants cover, so once its cell
 * holds anything else (mud, water, nothing) the heap would still promise cover
 * that is gone. The ground piece that fits inside that cell's tile is its heap;
 * it stands down until rubble returns. The spill under it is painted into the
 * route plates and stays.
 */
export function sceneForGrid(scene: MapScene, grid: Grid): MapScene {
  const scenery = scene.scenery.filter(
    (piece) =>
      !piece.wall ||
      piece.exterior ||
      piece.footprint.every((cell) => {
        const tile = tileAt(grid, cell);
        return tile?.terrain === 'wall' && tile.blocked;
      }),
  );
  const cleared = scene.paintedRubble?.filter(
    (cell) => tileAt(grid, cell)?.surface?.id !== 'rubble',
  );
  const ground = cleared?.length
    ? scene.ground.filter(
        (piece) =>
          !cleared.some(({ x, y }) => {
            // The cell's projected tile box, in the scene's world pixels.
            const left = (x - y + grid.height - 1) * 64;
            const top = (x + y) * 32;
            return (
              piece.x >= left &&
              piece.y >= top &&
              piece.x + piece.width <= left + 128 &&
              piece.y + piece.height <= top + 64
            );
          }),
      )
    : scene.ground;
  return scenery.length < scene.scenery.length || ground !== scene.ground
    ? { ...scene, scenery, ground }
    : scene;
}

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

/** Evaluate each slice once per frame, then fade connected artwork as one mass.
 * Only opted-in slices participate; groups never cross the current scene.
 */
export function sceneryOpacities(
  pieces: readonly SceneScenery[],
  view: MapView,
  camera: Camera,
): ReadonlyMap<SceneScenery, number> {
  const result = new Map<SceneScenery, number>();
  const groups = new Map<string, number>();
  for (const piece of pieces) {
    const opacity = sceneryOpacity(piece, view, camera);
    result.set(piece, opacity);
    if (piece.fadeWhenOccluding && piece.fadeGroup)
      groups.set(piece.fadeGroup, Math.min(groups.get(piece.fadeGroup) ?? 1, opacity));
  }
  for (const piece of pieces) {
    if (piece.fadeWhenOccluding && piece.fadeGroup)
      result.set(piece, groups.get(piece.fadeGroup) ?? 1);
  }
  return result;
}
