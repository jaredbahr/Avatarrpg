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
  SOURCE_DIR,
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
    // The quantised palette plus the ink.
    expect(colours.size).toBeLessThanOrEqual(COLOURS + 1);
    expect(colours.has((INK[0] << 16) | (INK[1] << 8) | INK[2])).toBe(true);
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
