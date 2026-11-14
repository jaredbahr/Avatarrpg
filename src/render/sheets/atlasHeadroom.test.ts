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
  const drawImage = vi.fn();
  // The whole 16 x 16 page: the idle's top pixel is on its row 4, the taller cast's on row 1.
  const getImageData = vi.fn(() => {
    const data = new Uint8ClampedArray(16 * 16 * 4);
    data[(4 * 16 + 3) * 4 + 3] = 255;
    data[(1 * 16 + 8 + 3) * 4 + 3] = 255;
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
    // The page is read back once, not once a cel (`pagePixels.ts`); no extra draw-time cache.
    expect(getImageData).toHaveBeenCalledTimes(1);
    expect(getImageData).toHaveBeenCalledWith(0, 0, 16, 16);
  } finally {
    vi.unstubAllGlobals();
  }
});
