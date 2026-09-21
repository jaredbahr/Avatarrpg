import { describe, expect, it } from 'vitest';
import {
  FALLBACK_SHADOW_WIDTH,
  SHADOW_MARGIN,
  measureArtWidth,
  shadowWidthFromArt,
} from './propFootprint';

/**
 * The prop shadow is measured from art, so the measurement is the contract:
 * a prop's own base decides the width, something wide up in the air does not,
 * and unreadable art still grounds the prop rather than drawing nothing.
 */

/** A `width` x `height` RGBA buffer, clear except for the given rows. */
function art(
  width: number,
  height: number,
  rows: readonly (readonly [number, number, number])[],
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const [from, to, y] of rows) {
    for (let x = from; x <= to; x++) data[(y * width + x) * 4 + 3] = 255;
  }
  return data;
}

describe('prop shadow footprint', () => {
  it('sizes the shadow from the lower half of the art, not a wide canopy', () => {
    // Rows 0-3 are a wide canopy; rows 4-9 are the two-tile-wide base.
    const data = art(10, 10, [
      [0, 9, 0],
      [0, 9, 2],
      [4, 5, 4],
      [4, 5, 9],
    ]);
    expect(shadowWidthFromArt(data, 10, 10)).toBeCloseTo((2 / 10) * SHADOW_MARGIN, 9);
  });

  it('keeps the shadow inside the tile even for art that fills it', () => {
    const data = art(10, 10, [[0, 9, 5]]);
    expect(shadowWidthFromArt(data, 10, 10)).toBe(1);
  });

  it('gives a narrow base a floor, and empty art the fallback', () => {
    const narrow = art(10, 10, [[5, 5, 9]]);
    expect(shadowWidthFromArt(narrow, 10, 10)).toBeCloseTo(0.2, 9);
    expect(shadowWidthFromArt(new Uint8ClampedArray(10 * 10 * 4), 10, 10)).toBe(
      FALLBACK_SHADOW_WIDTH,
    );
    expect(shadowWidthFromArt(new Uint8ClampedArray(0), 0, 0)).toBe(FALLBACK_SHADOW_WIDTH);
  });

  it('does not measure an image that has not decoded yet', () => {
    const pending = { complete: false, naturalWidth: 0, naturalHeight: 0 } as HTMLImageElement;
    expect(measureArtWidth(pending)).toBeNull();
  });
});
