/**
 * The day's light, as both backends draw it (ADR 0121).
 *
 * The grade is a colour operation on the world's art, `colour * multiply + lift` per channel with
 * the lift weighted by the pixel's alpha. WebGL runs it as a filter over the graded layers; Canvas 2D
 * draws each piece of art from a graded copy of its page (`gradedSource`), made once per page and
 * grade. Both give the same pixels, and neither resamples anything: integer zoom and nearest sampling
 * are untouched.
 *
 * A lamp's glow (its pool on the ground, its lit glass) is stepped rings of one colour on the
 * world-pixel grid (ADR 0093), added onto what is under it: one art pixel a world pixel, hard edges,
 * no gradient.
 */
import type { LampGlowStyle, LightGrade } from './view';

/** Grades straight-alpha RGBA pixels in place; alpha is left as it is. */
export function gradePixels(data: Uint8ClampedArray, grade: LightGrade): void {
  const [mr, mg, mb] = grade.multiply;
  const lr = grade.lift[0] * 255;
  const lg = grade.lift[1] * 255;
  const lb = grade.lift[2] * 255;
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] ?? 0) === 0) continue;
    data[i] = (data[i] ?? 0) * mr + lr;
    data[i + 1] = (data[i + 1] ?? 0) * mg + lg;
    data[i + 2] = (data[i + 2] ?? 0) * mb + lb;
  }
}

/** A grade's identity, so a page graded once is not graded again for the same light. */
export function gradeKey(grade: LightGrade): string {
  return [...grade.multiply, ...grade.lift].map((v) => v.toFixed(4)).join(',');
}

type Page = HTMLCanvasElement | HTMLImageElement;
/**
 * One graded copy per page, for one grade at a time: a change of light replaces it. Pages that go
 * (a resize clears the sprite caches) take their copies with them.
 */
const graded = new WeakMap<Page, { key: string; canvas: HTMLCanvasElement | null }>();

/**
 * The page as `grade` leaves it, the same size so every source rectangle still holds. Null grade is
 * the page itself; a page that cannot be read (not loaded, or a context the browser refuses) is
 * drawn as it is rather than not at all.
 */
export function gradedSource<T extends Page>(
  source: T,
  grade: LightGrade | null,
): T | HTMLCanvasElement {
  if (!grade) return source;
  const key = gradeKey(grade);
  const hit = graded.get(source);
  if (hit && hit.key === key) return hit.canvas ?? source;
  const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  if (!(width > 0 && height > 0)) return source;
  let canvas: HTMLCanvasElement | null = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    try {
      ctx.drawImage(source, 0, 0);
      const pixels = ctx.getImageData(0, 0, width, height);
      gradePixels(pixels.data, grade);
      ctx.putImageData(pixels, 0, 0);
    } catch {
      canvas = null;
    }
  } else canvas = null;
  graded.set(source, { key, canvas });
  return canvas ?? source;
}

/** A glow's rings as alpha per world pixel, row by row; the centre is pixel (radiusX, radiusY). */
export function lampGlowMask(style: LampGlowStyle): {
  readonly width: number;
  readonly height: number;
  readonly alpha: Float32Array;
} {
  const width = style.radiusX * 2 + 1;
  const height = style.radiusY * 2 + 1;
  const alpha = new Float32Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const dx = (x - style.radiusX) / style.radiusX;
      const dy = (y - style.radiusY) / style.radiusY;
      const d = dx * dx + dy * dy;
      // Outermost first, so the innermost ring the pixel is inside sets its level.
      let level = 0;
      for (const ring of style.rings) if (d <= ring.scale * ring.scale) level = ring.alpha;
      alpha[y * width + x] = level;
    }
  return { width, height, alpha };
}

/**
 * Where a glow's art lies, in world px: its top-left on a whole world pixel, so every ring edge is a
 * world-pixel step. `centre` is in tiles of `tile` world px.
 */
export function lampGlowBox(
  centre: { readonly x: number; readonly y: number },
  style: LampGlowStyle,
  tile: number,
): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.round(centre.x * tile) - style.radiusX,
    y: Math.round(centre.y * tile) - style.radiusY,
    w: style.radiusX * 2 + 1,
    h: style.radiusY * 2 + 1,
  };
}

const glowArt = new WeakMap<LampGlowStyle, Map<string, HTMLCanvasElement | null>>();
/**
 * A glow's art in `rgb` (0..255), premultiplied as the canvas holds it, to be drawn additively:
 * Canvas 2D's `lighter`, Pixi's `add`. Made once per style and colour.
 */
export function lampGlowArt(
  style: LampGlowStyle,
  rgb: readonly [number, number, number] = style.color,
): HTMLCanvasElement | null {
  let byColour = glowArt.get(style);
  if (!byColour) glowArt.set(style, (byColour = new Map()));
  const key = rgb.join(',');
  if (byColour.has(key)) return byColour.get(key) ?? null;
  const mask = lampGlowMask(style);
  const canvas = document.createElement('canvas');
  canvas.width = mask.width;
  canvas.height = mask.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    byColour.set(key, null);
    return null;
  }
  const image = ctx.createImageData(mask.width, mask.height);
  for (let i = 0; i < mask.alpha.length; i++) {
    const a = mask.alpha[i] ?? 0;
    if (a <= 0) continue;
    image.data[i * 4] = rgb[0];
    image.data[i * 4 + 1] = rgb[1];
    image.data[i * 4 + 2] = rgb[2];
    image.data[i * 4 + 3] = Math.round(a * 255);
  }
  ctx.putImageData(image, 0, 0);
  byColour.set(key, canvas);
  return canvas;
}
