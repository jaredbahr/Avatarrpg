import { describe, expect, it } from 'vitest';
import { cropPixels, type PagePixels } from './pagePixels';

/** A page whose every pixel's red channel names it: 10 * y + x. */
function page(width: number, height: number): PagePixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      data[(y * width + x) * 4] = 10 * y + x;
      data[(y * width + x) * 4 + 3] = 255;
    }
  return { data, width, height };
}

const reds = (pixels: Uint8ClampedArray) => pixels.filter((_, i) => i % 4 === 0);
const alphas = (pixels: Uint8ClampedArray) => pixels.filter((_, i) => i % 4 === 3);

describe('cropPixels', () => {
  it('cuts a cel out of the page row by row, as reading it alone would', () => {
    const cel = cropPixels(page(6, 5), { x: 2, y: 1, w: 3, h: 2 });
    expect([...reds(cel)]).toEqual([12, 13, 14, 22, 23, 24]);
    expect([...alphas(cel)]).toEqual([255, 255, 255, 255, 255, 255]);
  });

  it('leaves the part of a cel off the page transparent', () => {
    const cel = cropPixels(page(4, 3), { x: 2, y: 1, w: 3, h: 3 });
    expect([...reds(cel)]).toEqual([12, 13, 0, 22, 23, 0, 0, 0, 0]);
    expect([...alphas(cel)]).toEqual([255, 255, 0, 255, 255, 0, 0, 0, 0]);
  });

  it('returns a clear cel wholly off the page', () => {
    expect([...alphas(cropPixels(page(4, 3), { x: 5, y: 0, w: 2, h: 2 }))]).toEqual([0, 0, 0, 0]);
  });
});
