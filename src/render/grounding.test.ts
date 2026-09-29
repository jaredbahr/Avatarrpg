import { describe, expect, it } from 'vitest';
import type { SceneScenery } from '../core/types';
import { contactRaster } from './grounding';

const affine = {
  toWorld: ({ x, y }: { x: number; y: number }) => ({
    x: 256 + (x - y) * 64,
    y: (x + y) * 32,
  }),
};

const piece: SceneScenery = {
  id: 'test-house',
  url: 'test.webp',
  x: 0,
  y: 0,
  width: 128,
  height: 128,
  footprint: [
    { x: 2, y: 2 },
    { x: 3, y: 2 },
  ],
  depth: { x: 3, y: 2 },
};

const opaqueTexels = (data: Uint8ClampedArray): number => {
  let count = 0;
  for (let i = 3; i < data.length; i += 4) if ((data[i] ?? 0) > 0) count++;
  return count;
};

describe('scene grounding rasters', () => {
  it('combines footprint contact, occlusion and grass wear deterministically', () => {
    const first = contactRaster([piece], affine);
    const second = contactRaster([piece], affine);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first && second && Buffer.from(first.data).equals(Buffer.from(second.data))).toBe(true);
    expect(first && opaqueTexels(first.data)).toBeGreaterThan(100);
    expect(contactRaster([], affine)).toBeNull();
  });

  it('steps the shadow in flat bands, with no ordered screen at its edge', () => {
    const raster = contactRaster([piece], affine);
    if (!raster) throw new Error('no raster');
    const { width, height, data } = raster;
    const alpha = (x: number, y: number): number => data[(y * width + x) * 4 + 3] ?? 0;
    let painted = 0;
    let singles = 0;
    for (let y = 1; y < height - 1; y++)
      for (let x = 1; x < width - 1; x++) {
        const a = alpha(x, y);
        if (a) painted++;
        const around = [alpha(x - 1, y), alpha(x + 1, y), alpha(x, y - 1), alpha(x, y + 1)];
        if (a && around.every((n) => n !== a)) singles++;
      }
    // A texel unlike all four neighbours is the unit a dither screen is made of.
    expect(singles / painted).toBeLessThan(0.02);
  });
});

describe('low growth that opts out of the contact shadow', () => {
  const reeds: SceneScenery = {
    ...piece,
    id: 'test-reeds',
    footprint: [{ x: 6, y: 6 }],
    depth: { x: 6.1, y: 6.08 },
    contactShadow: false,
  };

  it('casts no footprint patch, alone or beside a piece that does', () => {
    // Alone it leaves nothing to draw at all.
    expect(contactRaster([reeds], affine)).toBeNull();
    // Beside a house, the house's own contact is unchanged by it.
    const both = contactRaster([piece, reeds], affine);
    const house = contactRaster([piece], affine);
    if (!both || !house) throw new Error('no raster');
    expect(opaqueTexels(both.data)).toBe(opaqueTexels(house.data));
  });
});
