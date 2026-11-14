/**
 * Integer zoom (ADR 0088): the top-down pixel-art board draws at a whole number of
 * device pixels per world pixel, on the device-pixel grid, and picking stays
 * the exact inverse of drawing. Its N >= dpr floor is `topdownCamera.test.ts`'s.
 */
import { describe, expect, it } from 'vitest';
import { buildGrid } from '../core/rules/grid';
import { FOREST_ROAD, QUARRY_FLOOR } from '../content/maps/combat';
import { Camera, MIN_TILE_PX, isWholeScale, wholeDeviceScale } from './camera';
import { TOPDOWN_TILE as TILE } from './projection';
import type { Viewport } from './camera';

/** The viewports the device matrix names, with their device pixel ratios. */
const VIEWPORTS: readonly (Viewport & { name: string })[] = [
  { name: 'desktop 1x', width: 1368, height: 912, dpr: 1 },
  { name: 'Surface 1.5x', width: 1368, height: 912, dpr: 1.5 },
  { name: 'iPad landscape 2x', width: 1194, height: 834, dpr: 2 },
  { name: 'iPad portrait 2x', width: 834, height: 1194, dpr: 2 },
  { name: 'combat canvas 2x', width: 1194, height: 634, dpr: 2 },
  { name: 'phone 3x', width: 390, height: 844, dpr: 3 },
  { name: 'phone landscape 3x', width: 844, height: 300, dpr: 3 },
];

function onDeviceGrid(value: number, dpr: number): boolean {
  return Math.abs(value * dpr - Math.round(value * dpr)) < 1e-9;
}

function expectSettled(camera: Camera): void {
  const { dpr } = camera.viewport;
  expect(isWholeScale(camera.deviceScale), `device scale ${camera.deviceScale}`).toBe(true);
  expect(onDeviceGrid(camera.offsetX, dpr), `offsetX ${camera.offsetX}`).toBe(true);
  expect(onDeviceGrid(camera.offsetY, dpr), `offsetY ${camera.offsetY}`).toBe(true);
}

function integerCamera(viewport: Viewport, grid: { width: number; height: number }): Camera {
  const camera = new Camera(viewport, grid, 'topdown');
  camera.integerZoom = true;
  return camera;
}

describe('wholeDeviceScale', () => {
  it('rounds by ratio, floors and ceils, and never goes under one device pixel', () => {
    expect(wholeDeviceScale(1.5, 1, 'nearest')).toBe(2);
    expect(wholeDeviceScale(1.4, 1, 'nearest')).toBe(1);
    expect(wholeDeviceScale(1.5, 1.5, 'nearest')).toBe(2);
    expect(wholeDeviceScale(1.5, 2, 'nearest')).toBe(3);
    expect(wholeDeviceScale(1.5, 3, 'nearest')).toBe(5);
    expect(wholeDeviceScale(0.2, 1, 'nearest')).toBe(1);
    expect(wholeDeviceScale(0.2, 1, 'floor')).toBe(1);
    expect(wholeDeviceScale(1.2, 2, 'floor')).toBe(2);
    expect(wholeDeviceScale(1.2, 2, 'ceil')).toBe(3);
    // Float noise from a CSS scale that is already whole stays where it is.
    expect(wholeDeviceScale(4 / 3, 1.5, 'ceil')).toBe(2);
    expect(wholeDeviceScale(4 / 3, 1.5, 'floor')).toBe(2);
  });

  it('meets halfway by ratio, so a pinch steps in and out symmetrically', () => {
    for (let k = 1; k < 6; k++) {
      const meet = Math.sqrt(k * (k + 1));
      expect(wholeDeviceScale(meet * 0.999, 1, 'nearest')).toBe(k);
      expect(wholeDeviceScale(meet * 1.001, 1, 'nearest')).toBe(k + 1);
    }
  });
});

describe('integer zoom: the settled views', () => {
  for (const viewport of VIEWPORTS) {
    it(`frames the combat board on whole device pixels (${viewport.name})`, () => {
      for (const preferred of [96, 64, 40]) {
        const camera = integerCamera(viewport, FOREST_ROAD);
        camera.fitExplore(preferred, 12, 'floor');
        camera.centreOn({ x: 4, y: 6 });
        expectSettled(camera);
        expect(TILE * camera.scale).toBeGreaterThanOrEqual(MIN_TILE_PX);
      }
    });

    it(`fits a board to whole device pixels, panning only for a fingertip (${viewport.name})`, () => {
      const camera = integerCamera(viewport, FOREST_ROAD);
      camera.fit();
      expectSettled(camera);
      expect(TILE * camera.scale).toBeGreaterThanOrEqual(MIN_TILE_PX);
      // Either the whole board is in view, or a smaller whole scale would
      // put a tile under a fingertip (the portrait pan exception).
      const smaller = (camera.deviceScale - 1) / viewport.dpr;
      if (!camera.fitted) expect(TILE * smaller).toBeLessThan(MIN_TILE_PX);
    });
  }

  it('leaves the continuous camera alone when integer zoom is off', () => {
    const camera = new Camera({ width: 1368, height: 912, dpr: 1.5 }, FOREST_ROAD, 'orthographic');
    camera.fitExplore(96);
    expect(camera.scale).toBe(1.5);
    camera.offsetX = 10.3;
    expect(camera.offsetX).toBe(10.3);
    expect(camera.snapScale(1.37)).toBe(1.37);
  });
});

describe('integer zoom: picking', () => {
  const grid = buildGrid(QUARRY_FLOOR);
  const cells = Array.from({ length: grid.width * grid.height }, (_, i) => ({
    x: i % grid.width,
    y: Math.floor(i / grid.width),
  }));

  for (const viewport of VIEWPORTS) {
    it(`picks every cell from where it is drawn (${viewport.name})`, () => {
      const camera = integerCamera(viewport, grid);
      camera.fitExplore(96);
      for (const zoom of [1, 1.6, 0.6]) {
        camera.zoomAt({ x: viewport.width * 0.37, y: viewport.height * 0.61 }, zoom);
        camera.centreOn({ x: 9.3, y: 5.7 });
        expectSettled(camera);
        for (const cell of cells) {
          const centre = camera.project({ x: cell.x + 0.5, y: cell.y + 0.5 });
          expect(camera.toTile(centre.x, centre.y)).toEqual(cell);
          // And the drawn transform is the one the pointer inverts.
          const back = camera.unproject(centre);
          expect(back.x).toBeCloseTo(cell.x + 0.5, 9);
          expect(back.y).toBeCloseTo(cell.y + 0.5, 9);
        }
      }
    });
  }

  it('draws world pixels on the device grid: the board origin lands on whole device pixels', () => {
    for (const viewport of VIEWPORTS) {
      const camera = integerCamera(viewport, grid);
      camera.fitExplore(96);
      camera.panBy(13.37, -7.21);
      const m = camera.groundMatrix();
      expect(onDeviceGrid(m.tx, viewport.dpr), `${viewport.name} tx ${m.tx}`).toBe(true);
      expect(onDeviceGrid(m.ty, viewport.dpr), `${viewport.name} ty ${m.ty}`).toBe(true);
      // One world pixel is a whole number of device pixels along both axes.
      expect(isWholeScale(m.a * viewport.dpr)).toBe(true);
    }
  });
});

describe('integer zoom: gestures', () => {
  const viewport = { width: 1194, height: 834, dpr: 2 };

  it('steps a slow pinch through whole device scales, anchored on the fingers', () => {
    // A board wider than the view at every step, so the pan clamp never moves the anchor.
    const camera = integerCamera(viewport, { width: 60, height: 40 });
    camera.fitExplore(TILE);
    camera.centreOn({ x: 30, y: 20 });
    const at = { x: 400, y: 300 };
    const seen = new Set<number>([camera.deviceScale]);
    for (let i = 0; i < 40; i++) {
      const before = camera.unproject(at);
      camera.zoomAt(at, 1.03);
      expectSettled(camera);
      seen.add(camera.deviceScale);
      // The ground under the fingers moves by less than one device pixel.
      const after = camera.project(before);
      expect(Math.abs(after.x - at.x)).toBeLessThanOrEqual(0.5 / viewport.dpr + 1e-9);
      expect(Math.abs(after.y - at.y)).toBeLessThanOrEqual(0.5 / viewport.dpr + 1e-9);
    }
    // Every whole step up to the limit, none skipped.
    expect([...seen].sort((a, b) => a - b)).toEqual([2, 3, 4, 5]);
  });

  it('zooms out one wheel notch at a time to the fitted board and no further', () => {
    const camera = integerCamera(viewport, FOREST_ROAD);
    camera.fitExplore(96);
    for (let i = 0; i < 30; i++) {
      camera.zoomAt({ x: 600, y: 400 }, Math.exp(-100 * 0.002));
      expectSettled(camera);
    }
    expect(camera.deviceScale).toBe(wholeDeviceScale(camera.fitScale(), viewport.dpr, 'floor'));
    // Back in again: the request was clamped, so the first notches count.
    const out = camera.deviceScale;
    camera.zoomAt({ x: 600, y: 400 }, Math.exp(100 * 0.002));
    camera.zoomAt({ x: 600, y: 400 }, Math.exp(100 * 0.002));
    expect(camera.deviceScale).toBe(out + 1);
  });

  it('combat floors its tuned tile, exploration rounds it', () => {
    const viewport = { width: 1368, height: 912, dpr: 1 };
    const combat = integerCamera(viewport, FOREST_ROAD);
    // 100 px is 2.5 world px a world pixel: floored to 2, rounded by ratio to 3.
    combat.fitExplore(100, 12, 'floor');
    const explore = integerCamera(viewport, FOREST_ROAD);
    explore.fitExplore(100);
    expect([combat.deviceScale, explore.deviceScale]).toEqual([2, 3]);
  });

  it('keeps sub-pixel drags: the exact offset survives the snap', () => {
    const camera = integerCamera({ width: 1368, height: 912, dpr: 1 }, FOREST_ROAD);
    camera.fitExplore(96);
    camera.centreOn({ x: 10, y: 6 });
    const start = camera.offsetX;
    for (let i = 0; i < 10; i++) camera.panBy(-0.3, 0);
    expect(camera.offsetX).toBe(start + 3);
    expectSettled(camera);
  });

  it('a refit after a dpr change lands back on whole device pixels without losing the zoom', () => {
    const camera = integerCamera({ width: 1368, height: 912, dpr: 2 }, FOREST_ROAD);
    camera.fitExplore(96);
    const css = camera.scale;
    camera.viewport = { width: 1368, height: 912, dpr: 1.5 };
    expect(camera.onWholeDevicePixels).toBe(false);
    camera.resnap();
    expectSettled(camera);
    expect(Math.abs(Math.log(camera.scale / css))).toBeLessThan(Math.log(1.5));
  });

  it('raiseToFit lifts a zoomed-out board to its whole-pixel fit and keeps a closer zoom', () => {
    const camera = integerCamera({ width: 1368, height: 912, dpr: 2 }, FOREST_ROAD);
    camera.fit();
    const fit = camera.scale;
    camera.zoomAt({ x: 600, y: 400 }, 2);
    const zoomed = camera.scale;
    camera.raiseToFit();
    expect(camera.scale).toBe(zoomed);
    camera.viewport = { width: 2736, height: 1824, dpr: 2 };
    camera.scale = fit;
    camera.raiseToFit();
    expectSettled(camera);
    expect(camera.scale).toBeGreaterThan(fit);
    expect(camera.fitted).toBe(true);
  });
});
