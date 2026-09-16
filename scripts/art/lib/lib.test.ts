import { describe, expect, it } from 'vitest';
import { placeOnBaseline } from './align';
import { newImage, parseHex, pixelAt, setPixel, toHex } from './image';
import { cornerColor, keyOut } from './key';
import { dominantColors } from './palette';
import { scaleBy, scaleTo } from './scale';
import { alphaBounds, crop, lowestOpaqueRow } from './trim';

/** A `w` x `h` image filled with `fill`, with a `[x, y, w, h]` box of `paint` on it. */
function painted(
  w: number,
  h: number,
  fill: readonly number[],
  box: [number, number, number, number],
  paint: readonly number[],
) {
  const image = newImage(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) setPixel(image, x, y, fill);
  for (let y = box[1]; y < box[1] + box[3]; y++) {
    for (let x = box[0]; x < box[0] + box[2]; x++) setPixel(image, x, y, paint);
  }
  return image;
}

const GREEN = [0, 255, 0, 255];
const RED = [214, 58, 52, 255];

describe('image', () => {
  it('round-trips hex colours', () => {
    expect(parseHex('#d1462f')).toEqual([209, 70, 47]);
    expect(toHex([209, 70, 47])).toBe('#d1462f');
    expect(() => parseHex('red')).toThrow();
  });
});

describe('keyOut', () => {
  it('clears the key colour and keeps the figure, despilling its green', () => {
    // An olive figure with green spill on it, well clear of the key.
    const image = painted(16, 16, GREEN, [4, 4, 8, 8], [120, 160, 60, 255]);
    const keyed = keyOut(image);
    expect(pixelAt(keyed, 0, 0)[3]).toBe(0);
    const inside = pixelAt(keyed, 8, 8);
    expect(inside[3]).toBe(255);
    // Green was clamped to the larger of red and blue.
    expect(inside[1]).toBe(120);
  });

  it('reads the key from the corners when asked', () => {
    const image = painted(16, 16, [244, 233, 216, 255], [4, 4, 8, 8], RED);
    expect(cornerColor(image)).toEqual([244, 233, 216]);
    const keyed = keyOut(image, { color: 'auto', tolerance: 30, feather: 20, despill: false });
    expect(pixelAt(keyed, 0, 0)[3]).toBe(0);
    expect(pixelAt(keyed, 8, 8)).toEqual([214, 58, 52, 255]);
  });
});

describe('trim', () => {
  it('finds the figure and cuts it out', () => {
    const image = keyOut(painted(32, 32, GREEN, [10, 6, 5, 12], RED));
    expect(alphaBounds(image)).toEqual({ x: 10, y: 6, width: 5, height: 12 });
    expect(lowestOpaqueRow(image)).toBe(17);
    const cut = crop(image, { x: 10, y: 6, width: 5, height: 12 });
    expect(cut.width).toBe(5);
    expect(pixelAt(cut, 0, 0)).toEqual([214, 58, 52, 255]);
    expect(alphaBounds(newImage(4, 4))).toBeNull();
  });
});

describe('scale', () => {
  it('averages boxes exactly and keeps a flat fill flat', () => {
    const image = painted(8, 8, RED, [0, 0, 8, 8], RED);
    const small = scaleBy(image, 0.25);
    expect(small.width).toBe(2);
    expect(pixelAt(small, 1, 1)).toEqual([214, 58, 52, 255]);
  });

  it('does not bleed clear pixels into an edge', () => {
    const image = newImage(4, 4);
    setPixel(image, 0, 0, RED);
    setPixel(image, 1, 0, RED);
    const small = scaleTo(image, 2, 2);
    // Two of four covered: half alpha, full red.
    expect(pixelAt(small, 0, 0)).toEqual([214, 58, 52, 128]);
    expect(pixelAt(small, 1, 1)[3]).toBe(0);
  });

  it('refuses to upscale', () => {
    expect(() => scaleTo(newImage(4, 4), 8, 8)).toThrow(/upscale/);
  });
});

describe('placeOnBaseline', () => {
  it('stands the feet on the baseline, centred', () => {
    const figure = painted(20, 40, [0, 0, 0, 0], [5, 0, 10, 40], RED);
    const { image, problems } = placeOnBaseline(figure, 128, 192);
    expect(problems).toEqual([]);
    const baseline = Math.round(192 * 0.85);
    expect(lowestOpaqueRow(image)).toBe(baseline - 1);
    const bounds = alphaBounds(image);
    expect(bounds?.x).toBe(59);
    expect(bounds?.width).toBe(10);
  });

  it('reports a figure that does not fit instead of squeezing it', () => {
    const wide = painted(140, 40, [0, 0, 0, 0], [0, 0, 140, 40], RED);
    expect(placeOnBaseline(wide, 128, 192).problems[0]).toMatch(/wide/);
    const tall = painted(20, 170, [0, 0, 0, 0], [0, 0, 20, 170], RED);
    expect(placeOnBaseline(tall, 128, 192).problems[0]).toMatch(/tall/);
  });
});

describe('dominantColors', () => {
  it('names the biggest colours and the nearest palette entry', () => {
    const image = painted(16, 16, [209, 70, 47, 255], [0, 0, 8, 16], [62, 143, 176, 255]);
    const hits = dominantColors(image, ['#d1462f', '#3e8fb0', '#6f9e4c'], 2);
    expect(hits).toHaveLength(2);
    expect(hits.map((h) => h.nearest).sort()).toEqual(['#3e8fb0', '#d1462f']);
    expect(hits[0]?.distance).toBeLessThan(4);
    expect(hits[0]?.share).toBeCloseTo(0.5, 2);
  });
});
