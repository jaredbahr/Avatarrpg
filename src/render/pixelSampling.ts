/**
 * How art is sampled onto the screen (ADR 0088).
 *
 * Pixel art drawn so that one art pixel covers a whole number of device
 * pixels is sampled nearest-neighbour: each art pixel becomes an exact N x N
 * block, and a 1 px outline stays one block wide. Anything else (a 2 px party
 * sheet at one device pixel per world pixel, Ba Dan's 1.5 px painting, the
 * ease of a zoom between two whole scales, a skewed shadow) is resampled with
 * smoothing, because nearest-neighbour at a fractional ratio doubles some
 * pixels and drops others, which is the fault integer zoom exists to remove.
 *
 * Both backends ask the same question, so a frame samples alike on each.
 */

/** Float slack for a ratio built from frame sizes and a CSS scale. */
const RATIO_EPSILON = 1e-3;

/** True when one source pixel covers a whole number (at least one) of device pixels. */
export function crispRatio(devicePerSource: number): boolean {
  const ratio = Math.abs(devicePerSource);
  return ratio >= 1 - RATIO_EPSILON && Math.abs(ratio - Math.round(ratio)) <= RATIO_EPSILON;
}

/**
 * Draws with nearest-neighbour sampling when the context's current transform
 * puts `sourceWidth` source pixels on a whole number of device pixels each
 * across `destWidth`, and with smoothing otherwise, then restores the
 * context's setting. A rotated or skewed transform is always smoothed.
 */
export function drawArt(
  ctx: CanvasRenderingContext2D,
  sourceWidth: number,
  destWidth: number,
  draw: () => void,
): void {
  const before = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = !crispOnContext(ctx, sourceWidth, destWidth);
  draw();
  ctx.imageSmoothingEnabled = before;
}

function crispOnContext(
  ctx: CanvasRenderingContext2D,
  sourceWidth: number,
  destWidth: number,
): boolean {
  if (!(sourceWidth > 0) || typeof ctx.getTransform !== 'function') return false;
  const m = ctx.getTransform();
  if (m.b !== 0 || m.c !== 0 || Math.abs(m.a) !== Math.abs(m.d)) return false;
  return crispRatio((m.a * destWidth) / sourceWidth);
}

/** Pixi's two filters, by the same rule. */
export function scaleModeFor(devicePerSource: number): 'nearest' | 'linear' {
  return crispRatio(devicePerSource) ? 'nearest' : 'linear';
}
