/**
 * A colour check against the art bible.
 *
 * Reports the frame's dominant opaque colours and, for each, the nearest
 * palette entry and how far off it is. It is a spot-check for drift, not a
 * gate: skin, hair and an ink line are not palette colours and never will be.
 */

import type { Image } from './image';
import { toHex } from './image';

export interface PaletteHit {
  readonly color: string;
  /** Share of opaque pixels, 0-1. */
  readonly share: number;
  readonly nearest: string;
  readonly distance: number;
}

/** Quantises to 5 bits a channel, counts, and returns the top `count` colours with their nearest palette entry. */
export function dominantColors(image: Image, palette: readonly string[], count = 6): PaletteHit[] {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  let opaque = 0;
  for (let i = 0; i < image.data.length; i += 4) {
    if ((image.data[i + 3] ?? 0) < 200) continue;
    opaque += 1;
    const r = image.data[i] ?? 0;
    const g = image.data[i + 1] ?? 0;
    const b = image.data[i + 2] ?? 0;
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bucket.n += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }
  const swatches = palette.map((hex) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return { hex, rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255] };
  });
  return [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, count)
    .map((bucket) => {
      const rgb = [bucket.r / bucket.n, bucket.g / bucket.n, bucket.b / bucket.n];
      let nearest = { hex: '#000000', distance: Infinity };
      for (const swatch of swatches) {
        const distance = Math.hypot(
          rgb[0]! - swatch.rgb[0]!,
          rgb[1]! - swatch.rgb[1]!,
          rgb[2]! - swatch.rgb[2]!,
        );
        if (distance < nearest.distance) nearest = { hex: swatch.hex, distance };
      }
      return {
        color: toHex(rgb),
        share: opaque ? bucket.n / opaque : 0,
        nearest: nearest.hex,
        distance: Math.round(nearest.distance),
      };
    });
}
