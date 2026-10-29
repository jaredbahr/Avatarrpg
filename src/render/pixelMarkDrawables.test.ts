import { describe, expect, it } from 'vitest';
import { PixelMarkDrawableCache } from './pixelMarkDrawables';
import type { PixelMarkSpec } from './pixelMarks';

const mark = (color: string): PixelMarkSpec => ({
  bounds: { left: -1, top: -1, width: 3, height: 3 },
  palette: { ink: color },
  operations: [{ kind: 'circle', color: 'ink', centre: { x: 0, y: 0 }, radius: 1, fill: true }],
});

describe('pixel mark drawable cache', () => {
  it('bounds idle entry count while protecting every source used this frame', () => {
    const cache = new PixelMarkDrawableCache(
      (raster) => ({ key: raster.key }) as unknown as HTMLCanvasElement,
      1024 * 1024,
      2,
    );

    cache.beginFrame();
    const first = cache.get(mark('#ef476f'), { left: -1, top: -1, width: 3, height: 3 });
    const second = cache.get(mark('#ffd166'), { left: -1, top: -1, width: 3, height: 3 });
    const third = cache.get(mark('#06d6a0'), { left: -1, top: -1, width: 3, height: 3 });
    expect(cache.endFrame()).toEqual([]);
    expect(cache.size).toBe(3);

    cache.beginFrame();
    expect(cache.get(mark('#ffd166'), { left: -1, top: -1, width: 3, height: 3 }).drawable).toBe(
      second.drawable,
    );
    expect(cache.get(mark('#06d6a0'), { left: -1, top: -1, width: 3, height: 3 }).drawable).toBe(
      third.drawable,
    );
    expect(cache.endFrame()).toContain(first.key);
    expect(cache.size).toBe(2);
  });
});
