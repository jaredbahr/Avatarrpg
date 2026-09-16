import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encode as encodeJpeg } from 'jpeg-js';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { placeOnBaseline } from './align';
import {
  flatten,
  imageSize,
  newImage,
  parseHex,
  pixelAt,
  readImage,
  setPixel,
  toHex,
} from './image';
import { cornerColor, keyDistance, keyOut } from './key';
import { dominantColors } from './palette';
import { scaleBy, scaleTo } from './scale';
import { alphaBounds, aspectCrop, crop, lowestOpaqueRow, squareCrop } from './trim';

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

describe('imageSize and readImage', () => {
  const pngBytes = (w: number, h: number): Uint8Array => {
    const png = new PNG({ width: w, height: h });
    png.data = Buffer.from(painted(w, h, RED, [0, 0, 1, 1], RED).data);
    return new Uint8Array(PNG.sync.write(png));
  };
  const jpegBytes = (w: number, h: number): Uint8Array => {
    const image = painted(w, h, [244, 233, 216, 255], [w / 4, h / 4, w / 2, h / 2], RED);
    return new Uint8Array(
      encodeJpeg({ width: w, height: h, data: Buffer.from(image.data) }, 92).data,
    );
  };

  it('reads a PNG and a JPEG size from the header alone', () => {
    expect(imageSize(pngBytes(48, 20))).toEqual({ format: 'png', width: 48, height: 20 });
    expect(imageSize(jpegBytes(64, 40))).toEqual({ format: 'jpeg', width: 64, height: 40 });
    expect(imageSize(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))).toBeNull();
  });

  it('decodes either from disk into the same RGBA image', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fnt-image-'));
    writeFileSync(join(dir, 'a.png'), pngBytes(12, 8));
    writeFileSync(join(dir, 'b.jpg'), jpegBytes(32, 32));
    const png = readImage(join(dir, 'a.png'));
    expect([png.width, png.height]).toEqual([12, 8]);
    expect(pixelAt(png, 3, 3)).toEqual(RED);
    const jpeg = readImage(join(dir, 'b.jpg'));
    expect([jpeg.width, jpeg.height]).toEqual([32, 32]);
    const centre = pixelAt(jpeg, 16, 16);
    expect(centre[0]).toBeGreaterThan(180);
    expect(centre[1]).toBeLessThan(90);
    expect(centre[3]).toBe(255);
    writeFileSync(join(dir, 'c.txt'), 'not a picture');
    expect(() => readImage(join(dir, 'c.txt'))).toThrow(/PNG or a JPEG/);
  });

  it('flattens clear pixels onto a colour and leaves opaque ones alone', () => {
    const image = painted(4, 4, [0, 0, 0, 0], [1, 1, 2, 2], RED);
    setPixel(image, 0, 0, [255, 255, 255, 128]);
    const flat = flatten(image, '#f4e9d8');
    expect(pixelAt(flat, 3, 3)).toEqual([244, 233, 216, 255]);
    expect(pixelAt(flat, 1, 1)).toEqual(RED);
    expect(pixelAt(flat, 0, 0)).toEqual([250, 244, 236, 255]);
  });
});

describe('aspect crops', () => {
  it('cut the largest centred box in the asked aspect', () => {
    expect(aspectCrop({ width: 2048, height: 1152 }, 20, 12)).toEqual({
      x: 64,
      y: 0,
      width: 1920,
      height: 1152,
    });
    expect(aspectCrop({ width: 1920, height: 1400 }, 24, 16)).toEqual({
      x: 0,
      y: 60,
      width: 1920,
      height: 1280,
    });
    expect(squareCrop({ width: 1024, height: 1536 })).toEqual({
      x: 0,
      y: 256,
      width: 1024,
      height: 1024,
    });
    expect(squareCrop({ width: 512, height: 512 })).toEqual({
      x: 0,
      y: 0,
      width: 512,
      height: 512,
    });
  });
});

describe('keyDistance', () => {
  it('measures how far the corners sit from the key, and nothing for auto', () => {
    expect(keyDistance(painted(8, 8, GREEN, [2, 2, 2, 2], RED))).toBe(0);
    const parchment = painted(8, 8, [244, 233, 216, 255], [2, 2, 2, 2], RED);
    expect(keyDistance(parchment)).toBeGreaterThan(200);
    expect(
      keyDistance(parchment, { color: 'auto', tolerance: 30, feather: 20, despill: false }),
    ).toBe(0);
  });
});
