import { describe, expect, it } from 'vitest';
import { Camera } from '../camera';
import { loadingPlaceholderBox } from '../painters/registry';
import { canvasActorDepth } from './canvas2d';
import { pixiActorDepth } from './pixi';

describe('square-footprint backend parity', () => {
  const camera = new Camera(
    { width: 1000, height: 700, dpr: 1 },
    { width: 20, height: 12 },
    'oblique',
  );

  it('sorts a 2x2 from its front row on both backends', () => {
    const square = { x: 4, y: 3 };
    const behindItsBackRow = { x: 4, y: 4 };
    for (const depth of [canvasActorDepth, pixiActorDepth]) {
      expect(depth(camera, square, 2, true)).toBeGreaterThan(
        depth(camera, behindItsBackRow, 1, true),
      );
      expect(depth(camera, square, 2, false)).toBeLessThan(
        depth(camera, behindItsBackRow, 1, false),
      );
    }
  });

  it('gives a generic 2x2 placeholder the full footprint box', () => {
    expect(
      loadingPlaceholderBox({ x: 10, y: 74, size: 64 }, { footprintWidth: 2, footprintHeight: 2 }),
    ).toEqual({ x: 10, y: 10, size: 128, height: 128 });
  });
});
