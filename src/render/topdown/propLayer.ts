/**
 * What both backends need to stand the breakable props on a top-down board (#459): each prop's
 * top-down drawing (`TOPDOWN_PROPS`), where it stands in world px, and one shadow layer for all of
 * them from the cached `hardShadowMask` (`objectShadow.ts`). The layer is keyed by the props it was
 * built from, so it is rebuilt only when a prop appears, moves, breaks or leaves, or a drawing
 * finishes loading; a prop that is gone is simply not in the next layer.
 *
 * The drawings load like the scene's pages, through a bounded `BackdropStore`; until one is in, the
 * backends keep drawing that prop's oblique sprite, so a missing file shows the old prop, never none.
 */
import type { Vec2 } from '../../core/types';
import { BackdropStore } from '../backdrops';
import { TOPDOWN_TILE } from '../projection';
import type { RgbaImage } from '../shadow/hardShadowMask';
import type { RenderProp } from '../view';
import {
  ObjectShadowCache,
  PAVED_SHADOW_SCALE,
  shadowLayer,
  type ShadowCaster,
  type ShadowLayer,
} from './objectShadow';
import { topdownProp, topdownPropBox, topdownPropUrl, type TopdownPropSprite } from './props';

/** Distinct prop drawings kept decoded: six props, the Earth Wall and rubble, with room to spare. */
export const TOPDOWN_PROP_IMAGE_CAP = 12;

export const topdownPropImages = new BackdropStore(
  TOPDOWN_PROP_IMAGE_CAP,
  'Top-down prop',
  'drawing its oblique sprite',
);

const masks = new ObjectShadowCache();

/** A prop as the top-down board draws it: its drawing, once loaded, and its box in world px. */
export interface TopdownPropArt {
  readonly sprite: TopdownPropSprite;
  readonly url: string;
  readonly image: HTMLImageElement | HTMLCanvasElement;
  readonly box: { x: number; y: number; w: number; h: number };
}

/** Steps a rising drawing comes out of the ground in: whole art px, and few masks to cast. */
export const RISE_STEPS = 8;
const risen = new Map<string, HTMLCanvasElement | null>();

/**
 * The drawing `step` eighths of the way out of the ground (#590): its top `step / RISE_STEPS` of rows
 * stood on its own base row, the rest still below the ground. Null without a DOM.
 */
function risenImage(image: HTMLImageElement, url: string, step: number) {
  const key = `${url}#${step}`;
  if (!risen.has(key) && typeof document !== 'undefined') {
    const { naturalWidth: w, naturalHeight: h } = image;
    const shown = Math.round((h * step) / RISE_STEPS);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')?.drawImage(image, 0, 0, w, shown, 0, h - shown, w, shown);
    risen.set(key, canvas);
  }
  return risen.get(key) ?? null;
}

/** The prop's top-down drawing and box, or null where it has none or it has not loaded. */
export function topdownPropArt(
  prop: Pick<RenderProp, 'kind' | 'pos' | 'rise'>,
  images: Pick<BackdropStore, 'get'> = topdownPropImages,
): TopdownPropArt | null {
  const sprite = topdownProp(prop.kind);
  if (!sprite) return null;
  const url = topdownPropUrl(sprite);
  const image = images.get(url);
  if (!image) return null;
  const box = topdownPropBox(prop.pos, sprite);
  // A rising wall stands only as far out of the ground as it has come, its shadow with it.
  const step = prop.rise === undefined ? RISE_STEPS : Math.ceil(prop.rise * RISE_STEPS);
  if (step >= RISE_STEPS) return { sprite, url, image, box };
  const part = step > 0 ? risenImage(image, url, step) : null;
  return part ? { sprite, url: `${url}#${step}`, image: part, box } : null;
}

let scratch: HTMLCanvasElement | null = null;

/** An image's pixels, read once through a scratch canvas; null without a DOM. */
export function imagePixels(image: CanvasImageSource & { width: number; height: number }) {
  if (typeof document === 'undefined') return null;
  const w = 'naturalWidth' in image ? image.naturalWidth : image.width;
  const h = 'naturalHeight' in image ? image.naturalHeight : image.height;
  if (!w || !h) return null;
  scratch ??= document.createElement('canvas');
  scratch.width = w;
  scratch.height = h;
  const ctx = scratch.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;
  return { width: w, height: h, data: new Uint8ClampedArray(data) } satisfies RgbaImage;
}

/** The shadow scale under a world pixel: paving's where the scene says a cell is paved. */
export function pavedScale(paved: readonly Vec2[] | undefined): (wx: number, wy: number) => number {
  if (!paved?.length) return () => 1;
  const keys = new Set(paved.map((c) => `${c.x},${c.y}`));
  return (wx, wy) =>
    keys.has(`${Math.floor(wx / TOPDOWN_TILE)},${Math.floor(wy / TOPDOWN_TILE)}`)
      ? PAVED_SHADOW_SCALE
      : 1;
}

/** The props' shadow layer and the key it was built for. */
export interface PropShadows {
  readonly key: string;
  readonly layer: ShadowLayer | null;
}

let last: PropShadows | null = null;

/**
 * One shadow layer for every loaded top-down prop in `props` (the backends pass the live props of
 * the view). `pixels` reads a drawing's pixels on a mask cache miss.
 */
export function propShadows(
  props: readonly Pick<RenderProp, 'id' | 'kind' | 'pos' | 'castShadow' | 'rise'>[],
  paved: readonly Vec2[] | undefined,
  images: Pick<BackdropStore, 'get'> = topdownPropImages,
  pixels: (image: HTMLImageElement) => RgbaImage | null = imagePixels,
): PropShadows {
  const arts = props
    .filter((prop) => prop.castShadow !== false)
    .map((prop) => ({ prop, art: topdownPropArt(prop, images) }))
    .filter((entry): entry is { prop: (typeof props)[number]; art: TopdownPropArt } =>
      Boolean(entry.art),
    );
  // A mask lookup is a cache hit after the first frame; a drawing whose pixels could not be read
  // yet is left out of the key, so the layer is rebuilt once they can.
  const casters: (ShadowCaster & { readonly id: string })[] = [];
  for (const { art } of arts) {
    // A rising drawing is a canvas; `imagePixels` reads either.
    const mask = masks.get(art.url, () => pixels(art.image as HTMLImageElement));
    if (mask) casters.push({ id: art.url, x: art.box.x, y: art.box.y, mask });
  }
  const key = [paved ? paved.length : -1, ...casters.map((c) => `${c.id}@${c.x},${c.y}`)].join('|');
  if (last?.key === key) return last;
  last = { key, layer: shadowLayer(casters, pavedScale(paved)) };
  return last;
}

/** Test seam: forget the cached masks and layer. */
export function resetPropShadows(): void {
  masks.clear();
  last = null;
}

/** How many masks the cache holds (bounded by `OBJECT_SHADOW_CAP`). */
export function cachedMaskCount(): number {
  return masks.size;
}

const canvases = new WeakMap<RgbaImage, HTMLCanvasElement>();

/**
 * A computed RGBA image as a canvas both backends can draw (Pixi through its bounded texture map),
 * made once per image object; null without a DOM.
 */
export function rgbaCanvas(image: RgbaImage): HTMLCanvasElement | null {
  const hit = canvases.get(image);
  if (hit) return hit;
  if (typeof document === 'undefined' || image.width <= 0 || image.height <= 0) return null;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const data = ctx.createImageData(image.width, image.height);
  data.data.set(image.data);
  ctx.putImageData(data, 0, 0);
  canvases.set(image, canvas);
  return canvas;
}
