import { describe, expect, it } from 'vitest';
import { Camera } from './camera';

describe('flat ground contract', () => {
  it('picks both sides of a tile edge, including outside the board', () => {
    for (const projection of ['orthographic', 'topdown'] as const) {
      const camera = new Camera(
        { width: 1000, height: 700, dpr: 2 },
        { width: 24, height: 16 },
        projection,
      );
      camera.scale = 1.5;
      camera.offsetX = 237;
      camera.offsetY = 109;
      for (const x of [-0.001, 0.001, 3.999, 4.001, 23.999, 24.001]) {
        const screen = camera.project({ x, y: 7.5 });
        expect(camera.toTile(screen.x, screen.y)).toEqual({ x: Math.floor(x), y: 7 });
      }
    }
  });

  it('centres a gated 2x2 and gives its orthographic sprite the square front-row box', () => {
    const camera = new Camera(
      { width: 1000, height: 700, dpr: 1 },
      { width: 200, height: 120 },
      'orthographic',
    );
    camera.scale = 1;
    // A board far wider than the viewport, so the pan clamp never binds.
    camera.centreOn({ x: 40, y: 30 }, 2, true);
    expect(camera.project({ x: 41, y: 31 })).toEqual({ x: 500, y: 350 });
    const box = camera.spriteBox({ x: 4, y: 3 }, 2, true);
    expect(box).toEqual(camera.toScreen({ x: 4, y: 4 }));
  });
});
