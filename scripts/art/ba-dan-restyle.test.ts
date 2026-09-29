import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BA_DAN_TEXTURES } from '../../src/content/scenes/baDan';
import { readImage } from './lib/image';
import { decodeWebp } from './lib/webp';
import {
  COLOURS,
  INK,
  OUTPUT_DIR,
  RESTYLE_ASSETS,
  SEAT_STEPS,
  SOURCE_DIR,
  bridgeFront,
  isStone,
  packAsset,
  restyle,
} from './ba-dan-restyle';

interface Pins {
  pixellab: { assets: Record<string, { sha256: string }> };
  shipped: { assets: Record<string, string> };
}
const pins = JSON.parse(readFileSync(`${SOURCE_DIR}/pins.json`, 'utf8')) as Pins;

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

async function shipped(name: string) {
  return decodeWebp(new Uint8Array(readFileSync(`${OUTPUT_DIR}/${name}.webp`)));
}

describe.each(RESTYLE_ASSETS)('$name', (asset) => {
  it('packs from its pinned sources', () => {
    expect(sha256(`${SOURCE_DIR}/pixellab/${asset.name}.png`)).toBe(
      pins.pixellab.assets[asset.name]?.sha256,
    );
    expect(sha256(`${SOURCE_DIR}/shipped/${asset.name}.png`)).toBe(pins.shipped.assets[asset.name]);
  });

  it('ships exactly what the pipeline packs, at the size the scene expects', async () => {
    const packed = packAsset(asset);
    const file = await shipped(asset.name);
    expect({ width: file.width, height: file.height }).toEqual(
      BA_DAN_TEXTURES[asset.name as keyof typeof BA_DAN_TEXTURES],
    );
    expect({ width: packed.width, height: packed.height }).toEqual({
      width: file.width,
      height: file.height,
    });
    expect(Buffer.from(file.data).equals(Buffer.from(packed.data))).toBe(true);
  });

  it('keeps the pixel grain: whole texel blocks, hard alpha, a small inked palette', async () => {
    const file = await shipped(asset.name);
    const k = asset.scale;
    const colours = new Set<number>();
    let broken = 0;
    let soft = 0;
    for (let y = 0; y < file.height; y++) {
      for (let x = 0; x < file.width; x++) {
        const i = (y * file.width + x) * 4;
        const a = file.data[i + 3] ?? 0;
        if (a !== 0 && a !== 255) soft++;
        const j = ((y - (y % k)) * file.width + (x - (x % k))) * 4;
        // Every pixel repeats the top-left pixel of its k x k texel block.
        for (let c = 0; c < 4; c++) if (file.data[i + c] !== file.data[j + c]) broken++;
        if (a)
          colours.add(
            ((file.data[i] ?? 0) << 16) | ((file.data[i + 1] ?? 0) << 8) | (file.data[i + 2] ?? 0),
          );
      }
    }
    expect(broken).toBe(0);
    expect(soft).toBe(0);
    // The quantised palette plus the ink, and a seated piece's own few tones.
    const seat = asset.seat ? SEAT_STEPS.length + (asset.seat.tufts ? 4 : 0) : 0;
    expect(colours.size).toBeLessThanOrEqual(COLOURS + 1 + seat);
    expect(colours.has((INK[0] << 16) | (INK[1] << 8) | INK[2])).toBe(true);
  });

  it.runIf(asset.seat)('is seated in the ground rather than set down on it', () => {
    const redraw = readImage(`${SOURCE_DIR}/pixellab/${asset.name}.png`);
    const source = readImage(`${SOURCE_DIR}/shipped/${asset.name}.png`);
    const seated = restyle(redraw, source, asset).image;
    const standing = restyle(redraw, source, { ...asset, seat: undefined }).image;
    // Mean luma of the stone in the lowest few texels of each column.
    const foot = (image: typeof seated): { luma: number; opaque: number } => {
      let sum = 0,
        count = 0,
        opaque = 0;
      for (let x = 0; x < image.width; x++) {
        let bottom = -1;
        for (let y = image.height - 1; y >= 0; y--)
          if (image.data[(y * image.width + x) * 4 + 3]) {
            bottom = y;
            break;
          }
        for (let y = 0; y <= bottom; y++) if (image.data[(y * image.width + x) * 4 + 3]) opaque++;
        for (let y = bottom - 1; y >= 0 && y >= bottom - 4; y--) {
          const i = (y * image.width + x) * 4;
          const [r, g, b] = [image.data[i]!, image.data[i + 1]!, image.data[i + 2]!];
          if (!isStone(r, g, b)) continue;
          sum += 0.299 * r + 0.587 * g + 0.114 * b;
          count++;
        }
      }
      return { luma: sum / count, opaque };
    };
    const before = foot(standing);
    const after = foot(seated);
    if (asset.seat?.sink) {
      // The shaded side faces are gone: the slabs lie flush.
      expect(after.opaque).toBeLessThan(before.opaque * 0.95);
    } else {
      expect(after.luma, 'the base course weathers darker').toBeLessThan(before.luma * 0.8);
    }
    expect(after.opaque).toBeGreaterThan(before.opaque * 0.8);
  });

  it('draws its silhouette in the bible ink, never black', () => {
    const redraw = readImage(`${SOURCE_DIR}/pixellab/${asset.name}.png`);
    const source = readImage(`${SOURCE_DIR}/shipped/${asset.name}.png`);
    const { image } = restyle(redraw, source, asset);
    const { width, height, data } = image;
    const opaque = (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < width && y < height && (data[(y * width + x) * 4 + 3] ?? 0) > 0;
    let edge = 0;
    let black = 0;
    let unInked = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!opaque(x, y)) continue;
        const i = (y * width + x) * 4;
        if (Math.max(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0) === 0) black++;
        if (opaque(x + 1, y) && opaque(x - 1, y) && opaque(x, y + 1) && opaque(x, y - 1)) continue;
        edge++;
        if (data[i] !== INK[0] || data[i + 1] !== INK[1] || data[i + 2] !== INK[2]) unInked++;
      }
    }
    expect(edge).toBeGreaterThan(0);
    expect(black).toBe(0);
    expect(unInked).toBe(0);
  });
});

it("ships the bridge's front layer cut from the bridge it ships", async () => {
  const bridge = await shipped('canal-bridge');
  const front = await shipped('canal-bridge-front');
  const expected = bridgeFront(bridge);
  expect({ width: front.width, height: front.height }).toEqual({
    width: bridge.width,
    height: bridge.height,
  });
  expect(Buffer.from(front.data).equals(Buffer.from(expected.data))).toBe(true);
  // The near half, not all of it and not none of it.
  let near = 0,
    all = 0;
  for (let i = 3; i < bridge.data.length; i += 4) {
    if (bridge.data[i]) all++;
    if (front.data[i]) near++;
  }
  expect(near).toBeGreaterThan(all * 0.2);
  expect(near).toBeLessThan(all * 0.8);
});
