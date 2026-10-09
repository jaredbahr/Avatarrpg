import type { Image } from './image';

/** The fine-grain contract for a lossy upright (`ba-dan-restyle.test.ts` holds the same numbers). */
export const LOSSY_MAX_RGB = 80;
export const LOSSY_MEAN_RGB = 4;

export interface LossyError {
  /** Count of pixels whose alpha differs at all; must be zero. */
  readonly alphaMismatches: number;
  /** Largest per-channel RGB difference over pixels that are not transparent. */
  readonly maxRgb: number;
  /** Mean per-channel RGB difference over pixels that are not transparent. */
  readonly meanRgb: number;
}

/**
 * Compare a decoded lossy image with its lossless source: alpha is judged
 * exactly, RGB by its worst and mean error where something is drawn (RGB under
 * alpha 0 is never seen and the encoder is free to rewrite it).
 */
export function lossyError(source: Image, decoded: Image): LossyError {
  if (source.width !== decoded.width || source.height !== decoded.height)
    throw new Error('lossyError: images differ in size');
  let alphaMismatches = 0;
  let maxRgb = 0;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < source.data.length; i += 4) {
    if (source.data[i + 3] !== decoded.data[i + 3]) alphaMismatches++;
    if (source.data[i + 3] === 0) continue;
    for (let c = 0; c < 3; c++) {
      const diff = Math.abs((source.data[i + c] ?? 0) - (decoded.data[i + c] ?? 0));
      maxRgb = Math.max(maxRgb, diff);
      sum += diff;
      count++;
    }
  }
  return { alphaMismatches, maxRgb, meanRgb: count === 0 ? 0 : sum / count };
}
