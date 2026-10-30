import { describe, expect, it } from 'vitest';
import { Camera } from './camera';
import { PixelMarkDrawableCache } from './pixelMarkDrawables';
import { talkPipMark } from './pixelOverlayGeometry';
import { resolvePixelMarkDraws } from './pixelMarkRendering';

describe('pixel mark placement', () => {
  it('translates visible bounds into local coordinates before resolving anchored marks', () => {
    const camera = new Camera({ width: 200, height: 100, dpr: 1 }, { width: 10, height: 10 });
    camera.offsetX = 400;
    camera.offsetY = 400;
    const cache = new PixelMarkDrawableCache(
      (raster) => ({ key: raster.key }) as unknown as HTMLCanvasElement,
    );

    const first = resolvePixelMarkDraws(camera, [talkPipMark({ x: 500, y: 450 }, 0.7)], cache)[0];
    const pannedCamera = new Camera({ width: 200, height: 100, dpr: 1 }, { width: 10, height: 10 });
    pannedCamera.offsetX = 401;
    pannedCamera.offsetY = 400;
    const panned = resolvePixelMarkDraws(
      pannedCamera,
      [talkPipMark({ x: 501, y: 450 }, 0.4)],
      cache,
    )[0];

    expect(first).toBeDefined();
    expect(first?.bounds.left).toBe(495);
    expect(first?.bounds.top).toBe(445);
    expect(panned?.source).toBe(first?.source);
    expect(panned?.bounds.left).toBe((first?.bounds.left ?? 0) + 1);
    expect(
      resolvePixelMarkDraws(camera, [talkPipMark({ x: 900, y: 900 }, 0.7)], cache),
    ).toHaveLength(0);
  });

  it('includes world marks visible after shake or a raised-top lift', () => {
    const camera = new Camera({ width: 200, height: 100, dpr: 1 }, { width: 10, height: 10 });
    const cache = new PixelMarkDrawableCache(
      (raster) => ({ key: raster.key }) as unknown as HTMLCanvasElement,
    );

    const shaken = resolvePixelMarkDraws(camera, [talkPipMark({ x: -50, y: 40 }, 0.7)], cache, {
      x: 1,
      y: 0,
    });
    const lifted = resolvePixelMarkDraws(camera, [talkPipMark({ x: 40, y: 145 }, 0.7)], cache);

    expect(shaken).toHaveLength(1);
    expect(lifted).toHaveLength(1);
  });
});
