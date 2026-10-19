import { afterEach, describe, expect, it, vi } from 'vitest';
import { visibleFrameBounds } from './spriteCache';

describe('cached visible animation bounds', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('caches by source identity as well as frame rectangle', () => {
    const firstSource = {} as CanvasImageSource;
    const secondSource = {} as CanvasImageSource;
    let drawnSource: CanvasImageSource | null = null;
    const drawImage = vi.fn((source: CanvasImageSource) => {
      drawnSource = source;
    });
    const getImageData = vi.fn(() => {
      const data = new Uint8ClampedArray(16);
      const x = drawnSource === firstSource ? 0 : 1;
      data[x * 4] = 255;
      data[x * 4 + 3] = 255;
      return { data };
    });
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({ drawImage, getImageData })),
      })),
    });
    const frame = { x: 0, y: 0, w: 2, h: 2 };

    const first = visibleFrameBounds(firstSource, frame);
    const repeated = visibleFrameBounds(firstSource, frame);
    const second = visibleFrameBounds(secondSource, frame);

    expect(repeated).toBe(first);
    expect(first.left).toBe(0);
    expect(second.left).toBe(1);
    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(getImageData).toHaveBeenCalledTimes(2);
  });
});
