/**
 * A figure's ground shadow (`figureShadow` in lighting.ts) as two canvases both backends draw into the
 * shadow union, one world pixel a canvas pixel: `cast`, white wherever the pool and its cast fall, and
 * `contact`, white under the soles. Each goes in at its own level and the union keeps the stronger.
 * Built once per size and key; a handful exist at a time (one per figure scale and width).
 */
import { FIGURE_CONTACT, figureShadow, type CastKey } from './lighting';
import type { FrameFeet } from './sheets/feet';
import { feetBlob } from './shadow/hardShadowMask';
import type { Vec2 } from '../core/types';

/**
 * The top-down board's figure shadow (ADR 0104, T4; ADR 0103's grounding): the owner's Imagination
 * `feetBlob`, a hard ellipse under the feet in place of the swept pool, at this strength of the
 * shadow ink (170 of 255 on soft ground, as Imagination draws it).
 */
export const TOPDOWN_FEET_LEVEL = 170 / 255;

/** The feet blob's strength on paving (205 of 255): cobble is darker, so the blob is too. */
export const TOPDOWN_FEET_PAVED_LEVEL = 205 / 255;

const pavedKeys = new WeakMap<readonly Vec2[], ReadonlySet<string>>();

/**
 * The feet blob's strength for a figure at `at` (tiles, fractional mid-walk): paving's on one of
 * the scene's `pavedCells`, soft ground's elsewhere.
 */
export function topdownFeetLevel(paved: readonly Vec2[] | undefined, at: Vec2): number {
  if (!paved?.length) return TOPDOWN_FEET_LEVEL;
  let keys = pavedKeys.get(paved);
  if (!keys) {
    keys = new Set(paved.map((c) => `${c.x},${c.y}`));
    pavedKeys.set(paved, keys);
  }
  return keys.has(`${Math.round(at.x)},${Math.round(at.y)}`)
    ? TOPDOWN_FEET_PAVED_LEVEL
    : TOPDOWN_FEET_LEVEL;
}

/** How wide a figure's feet are, in world px of a one-tile figure at scale 1: the blob is 65 % of it. */
export const TOPDOWN_FEET_WIDTH = 32;

const blobCache = new Map<number, HTMLCanvasElement | null>();

/** `feetBlob` for a figure `width` world px wide, white, one canvas px a world px. */
export function feetBlobArt(width: number): HTMLCanvasElement | null {
  const w = Math.max(4, Math.round(width));
  const cached = blobCache.get(w);
  if (cached !== undefined) return cached;
  const blob = feetBlob(w, 255);
  const canvas = document.createElement('canvas');
  canvas.width = blob.width;
  canvas.height = blob.height;
  const ctx = canvas.getContext('2d');
  let art: HTMLCanvasElement | null = null;
  if (ctx) {
    const image = ctx.createImageData(blob.width, blob.height);
    for (let i = 0; i < blob.data.length; i += 4)
      if (blob.data[i + 3]) image.data.set([255, 255, 255, 255], i);
    ctx.putImageData(image, 0, 0);
    art = canvas;
  }
  if (blobCache.size > 16) blobCache.clear();
  blobCache.set(w, art);
  return art;
}

export interface FigureShadowArt {
  readonly cast: HTMLCanvasElement;
  readonly contact: HTMLCanvasElement;
  /** The foot's position in either canvas, in its pixels (world pixels). */
  readonly footX: number;
  readonly footY: number;
}

const cache = new Map<string, FigureShadowArt | null>();

export function figureShadowArt(
  tilePx: number,
  key: CastKey,
  widthTiles = 1,
): FigureShadowArt | null {
  const id = `${tilePx.toFixed(3)}:${widthTiles}:${key.x},${key.y}`;
  const cached = cache.get(id);
  if (cached !== undefined) return cached;
  const shadow = figureShadow(tilePx, key, widthTiles);
  const paint = (keep: (level: number) => boolean) => {
    const canvas = document.createElement('canvas');
    canvas.width = shadow.width;
    canvas.height = shadow.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const image = ctx.createImageData(shadow.width, shadow.height);
    shadow.mask.forEach((level, i) => {
      if (keep(level)) image.data.set([255, 255, 255, 255], i * 4);
    });
    ctx.putImageData(image, 0, 0);
    return canvas;
  };
  const cast = paint((level) => level > 0);
  const contact = paint((level) => level === FIGURE_CONTACT);
  const art = cast && contact ? { cast, contact, footX: shadow.footX, footY: shadow.footY } : null;
  if (cache.size > 32) cache.clear();
  cache.set(id, art);
  return art;
}

const soleArt = new WeakMap<FrameFeet, HTMLCanvasElement | null>();

/**
 * The contact under a cel's soles (ADR 0093's planting amendment), as a canvas the cel's own size plus two rows,
 * drawn exactly where the cel is: white on each sole's bottom row and the row under it, and one pixel either side
 * of each sole on the row under it, so a line the painting's contact tone shows under the boot where it meets the
 * ground. A lifted foot has no sole (`feetFromPixels`), so it has no contact.
 */
export function soleContactArt(feet: FrameFeet, width: number): HTMLCanvasElement | null {
  const cached = soleArt.get(feet);
  if (cached !== undefined) return cached;
  const height = feet.ground + 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  let art: HTMLCanvasElement | null = null;
  if (ctx && width > 0) {
    const image = ctx.createImageData(width, height);
    const set = (x: number, y: number) => {
      if (x >= 0 && y >= 0 && x < width && y < height)
        image.data.set([255, 255, 255, 255], (y * width + x) * 4);
    };
    feet.soles.forEach((row, x) => {
      if (row < 0) return;
      set(x, row - 1);
      for (const dx of [-1, 0, 1]) set(x + dx, row);
    });
    ctx.putImageData(image, 0, 0);
    art = canvas;
  }
  soleArt.set(feet, art);
  return art;
}

/** What a figure's ground shadow reads of a resolved cel: its size, anchor and measured feet. */
interface FeetCel {
  readonly frame: { readonly w: number; readonly h: number };
  readonly anchor: { readonly x: number; readonly y: number };
  readonly pixelsPerTile: number;
  readonly feet?: FrameFeet;
}

/**
 * Where a figure's pool is centred, from its foot point, in tiles of its own scale: the middle of its heading's
 * resting soles (`resting`, the idle cel), so the pool sits under both feet rather than under the anchor, which on
 * a three-quarter heading is the near foot. One offset a heading, so the pool stays still while the legs move.
 * Mirrored with the body. A cel with no measured feet centres it on the foot point.
 */
export function poolOffset(
  resting: FeetCel | null | undefined,
  flip: boolean,
): { x: number; y: number } {
  const feet = resting?.feet;
  if (!resting || !feet) return { x: 0, y: 0 };
  const x = (feet.centre.x - resting.anchor.x * resting.frame.w) / resting.pixelsPerTile;
  const y = (feet.centre.y - resting.anchor.y * resting.frame.h) / resting.pixelsPerTile;
  return { x: flip ? -x : x, y };
}
