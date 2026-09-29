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
});
