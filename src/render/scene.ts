import { resolveAsset } from '../content/assets/manifest';
import { tileAt } from '../core/rules/grid';
import { SQUARE_FOOTPRINTS } from '../core/rules/footprint';
import type { Grid, MapScene, SceneImage, SceneScenery } from '../core/types';
import type { Camera } from './camera';
import type { MapView } from './view';
import { renderFoot } from './renderFoot';
import { BackdropStore } from './backdrops';
import { featherAlpha } from './geometry/feather';
import { PAINTED_FACE_SHADE, SHADOW_RGB } from './lighting';

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
 * the ~35 MB a quarry scene already keeps resident under the old cap. ADR 0072
 * raised the cap from 32 to 40 for the Forest Road's eight roadside sprites,
 * which together decode to well under 1 MB.
 */
export const SCENE_IMAGE_CAP = 40;

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
  return scenery.length < scene.scenery.length ? { ...scene, scenery } : scene;
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

const featheredImages = new WeakMap<HTMLImageElement, WeakMap<object, HTMLCanvasElement>>();

/**
 * Where the three visible planes of a painted stone block meet, as fractions
 * of its art: the left and right edges of the front faces start this far down,
 * and the near corner this far (the quarry wall cubes, 256x352; read off the
 * course lines, where the faces' top edge runs at the 2:1 slope).
 */
const BLOCK_SIDE_CORNER = 106 / 352;
const BLOCK_NEAR_CORNER = 172 / 352;

/** The quarry's painted stone cubes, every one drawn on the same 256x352 cube. */
const BLOCK_CUBE_ART = /\/wall-(?:end|interior|corner)\.webp$/;

export function sceneIsBlock(piece: SceneImage): boolean {
  return BLOCK_CUBE_ART.test(piece.url);
}

/** Art that is prepared before it is drawn: a feathered rim, or a block given form. */
export function sceneNeedsPrepare(piece: SceneImage): boolean {
  return Boolean(piece.feather) || sceneIsBlock(piece);
}

/**
 * The painted block cubes are lit evenly, so against the reference they read
 * as flat cut-outs. Planes are shaded in place, alpha untouched, so both
 * backends and the cast-shadow silhouette see the same piece.
 */
function shadeBlockFaces(context: CanvasRenderingContext2D, width: number, height: number): void {
  const mid = width / 2;
  const side = BLOCK_SIDE_CORNER * height;
  const near = BLOCK_NEAR_CORNER * height;
  context.save();
  context.globalCompositeOperation = 'source-atop';
  const face = (shade: number, outer: number) => {
    const gradient = context.createLinearGradient(0, near, 0, height);
    gradient.addColorStop(0, `rgba(${SHADOW_RGB.join(',')},${shade})`);
    gradient.addColorStop(1, `rgba(${SHADOW_RGB.join(',')},${shade + PAINTED_FACE_SHADE.foot})`);
    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(outer, side);
    context.lineTo(mid, near);
    context.lineTo(mid, height);
    context.lineTo(outer, height);
    context.closePath();
    context.fill();
  };
  face(PAINTED_FACE_SHADE.south, 0);
  face(PAINTED_FACE_SHADE.east, width);
  context.restore();
}

/** Alpha-only preparation. Weak image keys release canvases with evicted decoded pages. */
export function sceneDrawable(
  piece: SceneImage,
  image = sceneImage(piece),
): HTMLImageElement | HTMLCanvasElement | null {
  if (!image || !sceneNeedsPrepare(piece)) return image;
  const cached = featheredImages.get(image)?.get(piece);
  if (cached) return cached;
  const rect = sceneSourceRect(piece, image);
  if (!rect) return null;
  const canvas = document.createElement('canvas');
  canvas.width = rect.width;
  canvas.height = rect.height;
  const context = canvas.getContext('2d');
  if (!context) return image;
  context.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  const pixels = context.getImageData(0, 0, rect.width, rect.height);
  for (let y = 0; y < rect.height; y++)
    for (let x = 0; x < rect.width; x++) {
      const alpha = (y * rect.width + x) * 4 + 3;
      pixels.data[alpha] = Math.round(
        (pixels.data[alpha] ?? 0) * featherAlpha(piece, x, rect.width),
      );
    }
  context.putImageData(pixels, 0, 0);
  if (sceneIsBlock(piece)) shadeBlockFaces(context, rect.width, rect.height);
  let pieces = featheredImages.get(image);
  if (!pieces) {
    pieces = new WeakMap();
    featheredImages.set(image, pieces);
  }
  pieces.set(piece, canvas);
  return canvas;
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
  if (!rect) return;
  const source = sceneDrawable(piece, image);
  if (!source) return;
  if (source === image)
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height, x, y, width, height);
  else context.drawImage(source, 0, 0, rect.width, rect.height, x, y, width, height);
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
export function sceneryOpacity(
  scenery: SceneScenery,
  view: MapView,
  camera: Camera,
  squareFootprints = SQUARE_FOOTPRINTS,
): number {
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
        square: squareFootprints,
      })),
    // Nearby people remain readable for conversation; a distant villager does
    // not turn an entire neighbourhood transparent permanently.
    ...view.npcs
      .filter((npc) =>
        party.some((unit) => {
          const pos = unit.renderPos ?? unit.pos;
          const at = npc.renderPos ?? npc.pos;
          return Math.hypot(pos.x - at.x, pos.y - at.y) <= 3;
        }),
      )
      .map((npc) => {
        const entry = resolveAsset(npc.sprite);
        return {
          pos: npc.renderPos ?? npc.pos,
          size: entry.kind === 'sheet' ? entry.footprint.w : 1,
          scale: npc.scale ?? 1,
          square: false,
        };
      }),
  ];
  for (const { pos, size, scale, square } of occupants) {
    const foot = camera.groundPoint(renderFoot(pos, size as 1 | 2, square, camera.projection));
    // Level with the piece is in front of it on both backends (depthOrder.ts),
    // so a figure at the tie has nothing to see through.
    if (foot.y >= depth) continue;
    // Head, torso and feet probes follow upright figures, not the ground's
    // affine transform. Future route points cannot fade an unoccupied building.
    const across = (foot.x - scenery.x) / scenery.width;
    for (const lift of [8, 32, 56]) {
      if (
        covers(
          image,
          scenery,
          scenery.flip ? 1 - across : across,
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
  squareFootprints = SQUARE_FOOTPRINTS,
): ReadonlyMap<SceneScenery, number> {
  const result = new Map<SceneScenery, number>();
  const groups = new Map<string, number>();
  for (const piece of pieces) {
    const opacity = sceneryOpacity(piece, view, camera, squareFootprints);
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
