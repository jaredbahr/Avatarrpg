import { afterEach, describe, expect, it, vi } from 'vitest';
import { visibleFrameBounds, visibleSpriteBounds } from './spriteCache';

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

  it('caches distinct visible bounds for crop rectangles in the same atlas', () => {
    const atlas = {} as CanvasImageSource;
    let cropX = -1;
    const drawImage = vi.fn((_source: CanvasImageSource, sx: number) => {
      cropX = sx;
    });
    const getImageData = vi.fn(() => {
      const data = new Uint8ClampedArray(3 * 2 * 4);
      const x = cropX === 0 ? 0 : 2;
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
    const firstFrame = { x: 0, y: 0, w: 3, h: 2 };
    const secondFrame = { x: 8, y: 4, w: 3, h: 2 };

    const first = visibleFrameBounds(atlas, firstFrame);
    const second = visibleFrameBounds(atlas, secondFrame);

    expect(first).toEqual({ left: 0, top: 0, right: 1, bottom: 1 });
    expect(second).toEqual({ left: 2, top: 0, right: 3, bottom: 1 });
    expect(visibleFrameBounds(atlas, firstFrame)).toBe(first);
    expect(visibleFrameBounds(atlas, secondFrame)).toBe(second);
    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(getImageData).toHaveBeenCalledTimes(2);
  });

  it('falls back to complete requested frame bounds when pixel access fails', () => {
    const atlas = {} as CanvasImageSource;
    const drawImage = vi.fn();
    const getImageData = vi.fn(() => {
      throw new DOMException('Canvas is not origin-clean', 'SecurityError');
    });
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({ drawImage, getImageData })),
      })),
    });
    const frame = { x: 5, y: 7, w: 4, h: 3 };

    expect(visibleFrameBounds(atlas, frame)).toEqual({ left: 0, top: 0, right: 4, bottom: 3 });
  });

  it('falls back to complete requested frame bounds when no 2D context is available', () => {
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: vi.fn(() => null),
      })),
    });

    expect(visibleFrameBounds({} as CanvasImageSource, { x: 0, y: 0, w: 2, h: 5 })).toEqual({
      left: 0,
      top: 0,
      right: 2,
      bottom: 5,
    });
  });

  it('uses complete sprite bounds when pixel access fails', () => {
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({
          drawImage: vi.fn(),
          getImageData: vi.fn(() => {
            throw new Error('pixel read failed');
          }),
        })),
      })),
    });
    const canvas = { width: 7, height: 5 } as HTMLCanvasElement;

    expect(visibleSpriteBounds(canvas)).toEqual({ left: 0, top: 0, right: 7, bottom: 5 });
  });
});
