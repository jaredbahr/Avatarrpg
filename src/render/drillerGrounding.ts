import { HEADINGS, headingClip, type ClipName, type Heading } from '../content/assets/clips';
import { TOPDOWN_SHEETS } from '../content/assets/topdownSheets';
import type { CastKey } from './lighting';
import { feetBlob, hardShadowMask } from './shadow/hardShadowMask';
import type { ResolvedFrame } from './sheets/store';

export interface DrillerGroundingArt {
  readonly cast: HTMLCanvasElement;
  readonly blob: HTMLCanvasElement;
  /** Art-pixel offsets from the resolved frame anchor to each canvas's top-left. */
  readonly castXFromAnchorPx: number;
  readonly castYFromAnchorPx: number;
  readonly blobXFromAnchorPx: number;
  readonly blobYFromAnchorPx: number;
}

const cache = new WeakMap<object, Map<string, DrillerGroundingArt | null>>();

/** Resolve the static heading represented by the actually selected Driller clip. */
export function drillerGroundingPose(
  clip: ClipName,
  mirrored: boolean,
): { readonly heading: Heading; readonly mirror: boolean } {
  if (clip === 'cast') return { heading: 'east', mirror: mirrored };
  for (const heading of HEADINGS)
    if (
      clip === headingClip('idle', heading) ||
      clip === headingClip('walk', heading) ||
      clip === headingClip('rest', heading)
    )
      return { heading, mirror: false };
  // The packed legacy idle/walk/cast is the east view, mirrored for the west side.
  return { heading: 'east', mirror: mirrored };
}

function imageCanvas(frame: ResolvedFrame): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = frame.frame.w;
  canvas.height = frame.frame.h;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  try {
    context.drawImage(
      frame.source,
      frame.frame.x,
      frame.frame.y,
      frame.frame.w,
      frame.frame.h,
      0,
      0,
      frame.frame.w,
      frame.frame.h,
    );
    return canvas;
  } catch {
    return null;
  }
}

function canvasFromAlpha(
  width: number,
  height: number,
  alpha: Uint8ClampedArray,
): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const image = context.createImageData(width, height);
  for (let i = 0; i < alpha.length; i++) {
    if ((alpha[i] ?? 0) === 0) continue;
    image.data.set([255, 255, 255, alpha[i] ?? 0], i * 4);
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

/**
 * A Driller's static top-down shadow caster and contact blob. Alpha is read
 * from the resolved static heading frame, never from an animated cast cel.
 */
export function drillerGroundingArt(
  frame: ResolvedFrame,
  heading: Heading,
  castKey: CastKey,
  mirror = false,
): DrillerGroundingArt | null {
  const tread = TOPDOWN_SHEETS.driller.treadGrounding?.[HEADINGS.indexOf(heading)];
  if (!tread || frame.placeholder || frame.frame.w <= 0 || frame.frame.h <= 0) return null;
  let sourceCache = cache.get(frame.source as object);
  if (!sourceCache) {
    sourceCache = new Map();
    cache.set(frame.source as object, sourceCache);
  }
  const key = [
    frame.frame.x,
    frame.frame.y,
    frame.frame.w,
    frame.frame.h,
    heading,
    mirror ? 1 : 0,
    frame.anchor.x,
    frame.anchor.y,
    frame.pixelsPerTile,
    castKey.x,
    castKey.y,
    tread.spanPx,
    tread.centerXFromAnchorPx,
    tread.baselineYFromAnchorPx,
  ].join(':');
  if (sourceCache.has(key)) return sourceCache.get(key) ?? null;
  const cropped = imageCanvas(frame);
  const ctx = cropped?.getContext('2d', { willReadFrequently: true });
  if (!cropped || !ctx) {
    if (sourceCache.size >= 32) sourceCache.clear();
    sourceCache.set(key, null);
    return null;
  }
  let rgba: ImageData;
  try {
    rgba = ctx.getImageData(0, 0, frame.frame.w, frame.frame.h);
  } catch {
    if (sourceCache.size >= 32) sourceCache.clear();
    sourceCache.set(key, null);
    return null;
  }
  const alpha = new Uint8Array(frame.frame.w * frame.frame.h);
  for (let i = 0; i < alpha.length; i++) {
    const a = rgba.data[i * 4 + 3] ?? 0;
    alpha[i] = a >= 128 ? 255 : 0;
  }
  if (mirror) {
    for (let y = 0; y < frame.frame.h; y++)
      for (let x = 0; x < Math.floor(frame.frame.w / 2); x++) {
        const left = y * frame.frame.w + x;
        const right = y * frame.frame.w + (frame.frame.w - 1 - x);
        [alpha[left], alpha[right]] = [alpha[right] ?? 0, alpha[left] ?? 0];
      }
  }
  const projected = hardShadowMask(alpha, frame.frame.w, frame.frame.h, {
    dir: castKey,
    reach: 24,
    groundedOnly: true,
  });
  const castAlpha = new Uint8ClampedArray(projected.width * projected.height);
  for (let i = 0; i < projected.alpha.length; i++)
    if (projected.alpha[i] === 125) castAlpha[i] = 255;
  const cast = canvasFromAlpha(projected.width, projected.height, castAlpha);

  const span = tread.spanPx;
  let requestedWidth = Math.max(4, Math.ceil(span / 0.65));
  let blobImage = feetBlob(requestedWidth);
  const opaque = (image: typeof blobImage) => {
    let minX = image.width,
      maxX = -1,
      minY = image.height,
      maxY = -1;
    for (let y = 0; y < image.height; y++)
      for (let x = 0; x < image.width; x++)
        if ((image.data[(y * image.width + x) * 4 + 3] ?? 0) >= 128) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
    return { minX, maxX, minY, maxY, span: maxX >= minX ? maxX - minX + 1 : 0 };
  };
  let bounds = opaque(blobImage);
  while (bounds.span < span) {
    requestedWidth++;
    blobImage = feetBlob(requestedWidth);
    bounds = opaque(blobImage);
  }
  const blob = canvasFromAlpha(
    blobImage.width,
    blobImage.height,
    Uint8ClampedArray.from({ length: blobImage.width * blobImage.height }, (_, i) =>
      (blobImage.data[i * 4 + 3] ?? 0) >= 128 ? 255 : 0,
    ),
  );
  if (!cast || !blob || bounds.maxX < bounds.minX || bounds.maxY < bounds.minY) {
    if (sourceCache.size >= 32) sourceCache.clear();
    sourceCache.set(key, null);
    return null;
  }
  const centerX = (bounds.minX + bounds.maxX + 1) / 2;
  const treadCenter = (mirror ? -1 : 1) * tread.centerXFromAnchorPx;
  const art = {
    cast,
    blob,
    castXFromAnchorPx: -projected.pad - frame.anchor.x * frame.frame.w,
    castYFromAnchorPx: -frame.anchor.y * frame.frame.h,
    blobXFromAnchorPx: treadCenter - centerX,
    // The tread baseline crosses the ellipse's center, as in the prototype's feetBlob.
    // Bottom-aligning it hides the contact under the body and separates the cast from the treads.
    blobYFromAnchorPx: tread.baselineYFromAnchorPx - (bounds.minY + bounds.maxY + 1) / 2,
  };
  if (sourceCache.size >= 32) sourceCache.clear();
  sourceCache.set(key, art);
  return art;
}

export interface DrillerGroundingGeometry {
  readonly cast: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly blob: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
}

/** Places pixels from a 40-px-per-tile source at the backend's pixel scale. */
export function drillerGroundingGeometry(
  foot: { readonly x: number; readonly y: number },
  frame: ResolvedFrame,
  art: DrillerGroundingArt,
  unitScale: number,
  pixelScale: number,
): DrillerGroundingGeometry {
  const px = (40 / frame.pixelsPerTile) * unitScale * pixelScale;
  const castX = foot.x + art.castXFromAnchorPx * px;
  const castY = foot.y + art.castYFromAnchorPx * px;
  const blobX = foot.x + art.blobXFromAnchorPx * px;
  const blobY = foot.y + art.blobYFromAnchorPx * px;
  return {
    cast: { x: castX, y: castY, w: art.cast.width * px, h: art.cast.height * px },
    blob: { x: blobX, y: blobY, w: art.blob.width * px, h: art.blob.height * px },
  };
}
