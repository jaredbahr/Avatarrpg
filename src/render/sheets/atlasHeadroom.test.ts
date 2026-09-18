import { expect, it, vi } from 'vitest';
import { resolveAsset } from '../../content/assets/manifest';
import { atlasHeadroom } from './store';
import type { AtlasJson } from './atlasJson';

it('measures a stable envelope including taller attack frames with the authored anchor', () => {
  const entry = resolveAsset('unit.fire.kaya');
  if (entry.kind !== 'sheet') throw new Error('Expected hero sheet');
  const atlas: AtlasJson = {
    image: 'fixture.png',
    width: 16,
    height: 16,
    frames: new Map([
      ['idle', { x: 0, y: 0, w: 8, h: 8 }],
      ['cast', { x: 8, y: 0, w: 8, h: 8 }],
    ]),
  };
  let frameX = 0;
  const drawImage = vi.fn((_image: unknown, x: number) => {
    frameX = x;
  });
  const getImageData = vi.fn(() => {
    const data = new Uint8ClampedArray(8 * 8 * 4);
    data[((frameX === 0 ? 4 : 1) * 8 + 3) * 4 + 3] = 255;
    return { data };
  });
  vi.stubGlobal('document', {
    createElement: () => ({ getContext: () => ({ drawImage, getImageData }) }),
  });
  try {
    const result = atlasHeadroom(
      {
        ...entry,
        pixelsPerTile: 4,
        anchor: { x: 0.5, y: 0.75 },
        clips: {
          idle: { frames: ['idle'], fps: 1, loop: true },
          cast: { frames: ['cast', 'cast'], fps: 8, loop: false },
        },
      },
      atlas,
      {} as CanvasImageSource,
    );
    expect(result).toBeCloseTo((0.75 * 8 - 1) / 4 - 0.85, 9);
    // Duplicate clip references are read only once; no extra draw-time cache.
    expect(getImageData).toHaveBeenCalledTimes(2);
  } finally {
    vi.unstubAllGlobals();
  }
});
