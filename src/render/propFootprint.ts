/**
 * How wide a prop's contact shadow should be.
 *
 * A prop painter knows its own silhouette and can pass a width, but prop art
 * arrives as a bitmap stretched over the tile, so the only honest source for
 * "how wide is this thing where it meets the ground" is the art itself. The
 * old fixed 0.5-of-a-tile shadow was narrower than the barrel, the cart and
 * the stone pile that stand on it, which hid its rim under them and left each
 * prop meeting the ground on a bare line.
 *
 * The measurement below is deliberately blunt and stable: the widest opaque
 * run across the lower half of the art's own silhouette, plus a small margin
 * so the feathered rim shows past the base. Height is ignored, so a tall
 * banner and a squat crate of the same width get the same shadow.
 */

/** Alpha at or below this is background, not art. */
const ALPHA_FLOOR = 8;

/** How much wider than the measured base the shadow is drawn. */
export const SHADOW_MARGIN = 1.15;

/** A prop whose art could not be measured still gets a grounded shadow. */
export const FALLBACK_SHADOW_WIDTH = 0.7;

/** Never narrower than this, nor wider than the tile the sprite is cached in. */
const MIN_SHADOW_WIDTH = 0.2;
const MAX_SHADOW_WIDTH = 1;

/**
 * Widest opaque run across the lower half of an RGBA image, as a fraction of
 * its width, with the shadow margin applied. `data` is the straight
 * `getImageData` buffer: four bytes per pixel, alpha last.
 */
export function shadowWidthFromArt(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  margin = SHADOW_MARGIN,
): number {
  if (!(width > 0) || !(height > 0) || data.length < width * height * 4)
    return FALLBACK_SHADOW_WIDTH;

  const opaque = (x: number, y: number): boolean => data[(y * width + x) * 4 + 3]! > ALPHA_FLOOR;

  let top = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!opaque(x, y)) continue;
      if (top < 0) top = y;
      bottom = y;
      break;
    }
  }
  if (top < 0) return FALLBACK_SHADOW_WIDTH;

  // The lower half of the silhouette is the part that has to touch the
  // ground; a wide canopy or a raised arm must not widen the shadow.
  const first = top + Math.floor((bottom - top + 1) / 2);
  let left = width;
  let right = -1;
  for (let y = first; y <= bottom; y++) {
    for (let x = 0; x < width; x++) {
      if (!opaque(x, y)) continue;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (right < 0) return FALLBACK_SHADOW_WIDTH;

  const measured = ((right - left + 1) / width) * margin;
  return Math.min(MAX_SHADOW_WIDTH, Math.max(MIN_SHADOW_WIDTH, measured));
}

/**
 * Measures a loaded image on a small scratch canvas. Returns null while the
 * bitmap is still loading, or when the canvas refuses pixels, so the caller
 * can fall back rather than cache a wrong width.
 */
export function measureArtWidth(image: HTMLImageElement, sample = 64): number | null {
  if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) return null;
  const side = Math.max(8, Math.round(sample));
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.clearRect(0, 0, side, side);
    ctx.drawImage(image, 0, 0, side, side);
    const { data } = ctx.getImageData(0, 0, side, side);
    return shadowWidthFromArt(data, side, side);
  } catch {
    return null;
  }
}
