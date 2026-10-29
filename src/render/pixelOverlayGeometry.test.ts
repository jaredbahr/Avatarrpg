import { describe, expect, it } from 'vitest';
import { Camera } from './camera';
import { rasterizePixelMark } from './pixelMarks';
import {
  aimArcPixelMarks,
  boardPixelFromTile,
  pathPixelMarks,
  targetReticleMark,
} from './pixelOverlayGeometry';

describe('pixel overlay geometry', () => {
  it.each(['above', 'below'] as const)(
    'keeps elevation and obscured cues distinct when the target is %s',
    (elevation) => {
      const cue = targetReticleMark({ x: 320, y: 240 }, { elevation, obscured: true });
      const [height, cloud] = cue.spec.operations;
      expect(height?.kind).toBe('polygon');
      expect(cloud?.kind).toBe('polygon');
      if (height?.kind !== 'polygon' || cloud?.kind !== 'polygon') return;

      const heightRight = Math.max(...height.points.map((point) => point.x));
      const cloudLeft = Math.min(...cloud.points.map((point) => point.x));
      expect(heightRight).toBe(8);
      expect(cloudLeft).toBe(8);

      const raster = rasterizePixelMark(cue.spec);
      let heightPixels = 0;
      let cloudPixels = 0;
      for (let y = 0; y < raster.height; y++) {
        for (let x = 0; x < raster.width; x++) {
          const index = (y * raster.width + x) * 4 + 3;
          if ((raster.data[index] ?? 0) === 0) continue;
          const localX = raster.left + x;
          if (localX < 8) heightPixels++;
          if (localX > 8) cloudPixels++;
        }
      }
      expect(heightPixels).toBeGreaterThan(0);
      expect(cloudPixels).toBeGreaterThan(0);
    },
  );

  it('points a horizontal route and aim arrow horizontally in orthographic projection', () => {
    const camera = new Camera(
      { width: 256, height: 256, dpr: 1 },
      { width: 4, height: 4 },
      'orthographic',
    );
    const route = pathPixelMarks(
      {
        path: [{ x: 1, y: 0 }],
        pathFrom: { x: 0, y: 0 },
        pathOrigin: null,
        pathStart: 0,
        calmPath: false,
        crispOverlays: false,
      },
      camera,
    );
    const routeArrow = route.at(-1)?.spec.operations[0];
    const aimArrow = aimArcPixelMarks(
      { from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, arc: 0, color: '#fff' },
      camera,
    )[0]?.spec.operations.at(-1);

    expect(routeArrow?.kind).toBe('polygon');
    expect(aimArrow?.kind).toBe('polygon');
    if (routeArrow?.kind !== 'polygon' || aimArrow?.kind !== 'polygon') return;
    expect(routeArrow.points[0]?.x).toBeGreaterThan(0);
    expect(aimArrow.points[0]?.x).toBeGreaterThan(0);
    expect(routeArrow.points[0]?.y).toBe(0);
    expect(aimArrow.points[0]?.y).toBe(boardPixelFromTile(camera, { x: 1, y: 0 }).y);
  });

  it('projects a horizontal route and aim arrow along the oblique board basis', () => {
    const camera = new Camera(
      { width: 256, height: 256, dpr: 1 },
      { width: 4, height: 4 },
      'oblique',
    );
    const route = pathPixelMarks(
      {
        path: [{ x: 1, y: 0 }],
        pathFrom: { x: 0, y: 0 },
        pathOrigin: null,
        pathStart: 0,
        calmPath: false,
        crispOverlays: false,
      },
      camera,
    );
    const routeArrow = route.at(-1)?.spec.operations[0];
    const aimArrow = aimArcPixelMarks(
      { from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, arc: 0, color: '#fff' },
      camera,
    )[0]?.spec.operations.at(-1);

    expect(routeArrow?.kind).toBe('polygon');
    expect(aimArrow?.kind).toBe('polygon');
    if (routeArrow?.kind !== 'polygon' || aimArrow?.kind !== 'polygon') return;
    expect(routeArrow.points[0]?.x).toBeGreaterThan(0);
    expect(routeArrow.points[0]?.y).toBeGreaterThan(0);
    expect(aimArrow.points[0]?.x).toBeGreaterThan(0);
    expect(aimArrow.points[0]?.y).toBeGreaterThan(0);
  });
});
