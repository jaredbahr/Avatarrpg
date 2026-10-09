import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readImage } from './lib/image';
import { lossyError } from './lib/lossy-compare';
import { decodeWebp, encodeUprightWebp } from './lib/webp';
import {
  footLine,
  OUTPUT_DIR,
  packAsset,
  RESTYLE_ASSETS,
  SOURCE_DIR,
  TREE_ASSETS,
  validateFineImage,
} from './ba-dan-restyle';

interface FinePins {
  assets?: Record<string, { sha256: string }>;
}
const pins = JSON.parse(readFileSync(`${SOURCE_DIR}/fine/pins.json`, 'utf8')) as FinePins;

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

async function shipped(name: string) {
  return decodeWebp(new Uint8Array(readFileSync(`${OUTPUT_DIR}/${name}.webp`)));
}

/** Fraction of fully opaque 2x2 windows whose four RGBA pixels are identical. */
function uniform2x2(image: { width: number; height: number; data: Uint8Array }): number {
  let total = 0;
  let uniform = 0;
  for (let y = 0; y + 1 < image.height; y++) {
    for (let x = 0; x + 1 < image.width; x++) {
      const cells = [
        (y * image.width + x) * 4,
        (y * image.width + x + 1) * 4,
        ((y + 1) * image.width + x) * 4,
        ((y + 1) * image.width + x + 1) * 4,
      ];
      if (cells.some((i) => image.data[i + 3] !== 255)) continue;
      total++;
      const first = cells[0]!;
      if (
        cells
          .slice(1)
          .every((i) => image.data.slice(i, i + 4).every((v, c) => v === image.data[first + c]))
      )
        uniform++;
    }
  }
  return total === 0 ? 0 : uniform / total;
}

describe.each(RESTYLE_ASSETS)('$name fine source', (asset) => {
  it('has provenance and the registered canvas', () => {
    const path = `${SOURCE_DIR}/fine/${asset.name}.png`;
    expect(pins.assets?.[asset.name]?.sha256, 'fine/pins.json hash').toBe(sha256(path));
    const source = readImage(path);
    expect({ width: source.width, height: source.height }).toEqual({
      width: asset.width,
      height: asset.height,
    });
  });

  it('has binary alpha, shipped-design bounds and an exact foot line', async () => {
    const source = readImage(`${SOURCE_DIR}/fine/${asset.name}.png`);
    expect(() => validateFineImage(source, asset)).not.toThrow();
    const output = await shipped(asset.name);
    expect({ width: output.width, height: output.height }).toEqual({
      width: asset.width,
      height: asset.height,
    });
    expect(() => validateFineImage(output, asset)).not.toThrow();
    expect(footLine(output)).toBe(asset.footY);
  });

  it('is a deterministic lossy re-pack with exact alpha, and keeps fine grain', async () => {
    const packed = packAsset(asset);
    const encoded = await encodeUprightWebp(packed);
    const tracked = new Uint8Array(readFileSync(`${OUTPUT_DIR}/${asset.name}.webp`));
    expect(Buffer.from(tracked).equals(Buffer.from(encoded))).toBe(true);
    // Encoding is lossy, so the shipped pixels are judged by decoded error:
    // alpha exact, RGB bounded by its worst and mean error against the source.
    const error = lossyError(packed, await shipped(asset.name));
    expect(error.alphaMismatches, `${asset.name} alpha`).toBe(0);
    expect(error.maxRgb, `${asset.name} max RGB error`).toBeLessThanOrEqual(80);
    expect(error.meanRgb, `${asset.name} mean RGB error`).toBeLessThan(4);
    const score = uniform2x2(packed);
    // The former whole-number nearest-upscaled plates score well above this.
    // These reviewed fine sources score at most 0.0001594; 1% leaves headroom.
    expect(score, `${asset.name} uniform-2x2 score ${score.toFixed(6)}`).toBeLessThan(0.01);
  });
});

describe.each(TREE_ASSETS)('$name fine source (packed into village-trees.webp)', (asset) => {
  it('has provenance, the registered canvas, binary alpha, bounds and an exact foot line', () => {
    const path = `${SOURCE_DIR}/fine/${asset.name}.png`;
    expect(pins.assets?.[asset.name]?.sha256, 'fine/pins.json hash').toBe(sha256(path));
    const source = readImage(path);
    expect({ width: source.width, height: source.height }).toEqual({
      width: asset.width,
      height: asset.height,
    });
    expect(() => validateFineImage(source, asset)).not.toThrow();
    expect(footLine(source)).toBe(asset.footY);
    expect(uniform2x2(source), `${asset.name} fine grain`).toBeLessThan(0.01);
  });
});
