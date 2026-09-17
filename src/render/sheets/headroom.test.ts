import { describe, expect, it } from 'vitest';
import { FOOT_LINE, frameHeadroom, headroomFromPixels } from './bake';

/** A `w` x `h` RGBA frame, clear except for rows from `top` down. */
function frame(w: number, h: number, top: number | null): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  if (top === null) return data;
  for (let y = top; y < h; y++) {
    for (let x = w / 4; x < (w * 3) / 4; x++) data[(y * w + x) * 4 + 3] = 255;
  }
  return data;
}

describe('headroom', () => {
  const px = 128;
  const w = 128;
  const h = 192;
  // The tile's top edge, in frame pixels: the foot line less 0.85 of a tile.
  const tileTop = FOOT_LINE * h - 0.85 * px;

  it('reads how far the first opaque row stands above the tile from the pixels', () => {
    // A normalised figure: 8 px of margin then 121 px of figure above the foot line.
    const top = Math.round(FOOT_LINE * h) - 121;
    expect(headroomFromPixels(frame(w, h, top), w, h, px)).toBeCloseTo((tileTop - top) / px, 5);
    // Art at the very top row uses the whole frame.
    expect(headroomFromPixels(frame(w, h, 0), w, h, px)).toBeCloseTo(tileTop / px, 5);
    // Art that stays inside the tile needs none.
    expect(headroomFromPixels(frame(w, h, Math.ceil(tileTop) + 4), w, h, px)).toBe(0);
    expect(headroomFromPixels(frame(w, h, null), w, h, px)).toBe(0);
  });

  it('gives a fetched atlas the whole frame until its pixels are read', () => {
    expect(frameHeadroom({ h }, FOOT_LINE, px)).toBeCloseTo(tileTop / px, 5);
    expect(headroomFromPixels(frame(w, h, 0), w, h, px)).toBeCloseTo(
      frameHeadroom({ h }, FOOT_LINE, px),
      5,
    );
  });
});
