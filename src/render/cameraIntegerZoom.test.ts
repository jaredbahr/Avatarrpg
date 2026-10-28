/**
 * Integer zoom (ADR 0088): the pixel-art boards draw at a whole number of
 * device pixels per world pixel, on the device-pixel grid, and picking stays
 * the exact inverse of drawing.
 */
import { describe, expect, it } from 'vitest';
import { buildGrid } from '../core/rules/grid';
import { FOREST_ROAD, QUARRY_FLOOR } from '../content/maps/combat';
import { BA_DAN_VILLAGE } from '../content/maps/village';
import { Camera, MIN_TILE_PX, TILE, isWholeScale, wholeDeviceScale } from './camera';
import type { Viewport } from './camera';
import { liftAt } from './geometry/elevation';

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

function integerCamera(
  viewport: Viewport,
  grid: { width: number; height: number },
  projection: 'oblique' | 'orthographic' = 'oblique',
): Camera {
  const camera = new Camera(viewport, grid, projection);
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
    it(`explores Ba Dan on whole device pixels (${viewport.name})`, () => {
      const camera = integerCamera(viewport, BA_DAN_VILLAGE);
      camera.centreMargin = BA_DAN_VILLAGE.cameraCentreMargin;
      camera.viewExtent = BA_DAN_VILLAGE.scene?.paintExtent;
      camera.fitExplore(96);
      camera.centreOn({ x: 7, y: 6 });
      expectSettled(camera);
      expect(TILE * camera.scale).toBeGreaterThanOrEqual(MIN_TILE_PX);
      // Within one whole step, by ratio, of the 96 px tile the view was tuned for.
      const ratio = (TILE * camera.scale) / 96;
      const step = (camera.deviceScale + 1) / camera.deviceScale;
      expect(Math.max(ratio, 1 / ratio)).toBeLessThanOrEqual(step + 1e-9);
      // The painting's edge never shows.
      const extent = camera.viewExtent!;
      expect(camera.offsetX).toBeGreaterThanOrEqual(extent.x * camera.scale - 1e-9);
      expect(camera.offsetY).toBeGreaterThanOrEqual(extent.y * camera.scale - 1e-9);
      expect(camera.offsetX + viewport.width).toBeLessThanOrEqual(
        (extent.x + extent.width) * camera.scale + 1e-9,
      );
      expect(camera.offsetY + viewport.height).toBeLessThanOrEqual(
        (extent.y + extent.height) * camera.scale + 1e-9,
      );
    });

    it(`frames the oblique combat board on whole device pixels (${viewport.name})`, () => {
      for (const preferred of [96, 64, 40]) {
        const camera = integerCamera(viewport, FOREST_ROAD);
        camera.fitExplore(preferred, 12, 'floor');
        camera.centreOn({ x: 4, y: 6 });
        expectSettled(camera);
        expect(TILE * camera.scale).toBeGreaterThanOrEqual(MIN_TILE_PX);
      }
    });

    it(`fits a board to whole device pixels, panning only for a fingertip (${viewport.name})`, () => {
      for (const projection of ['oblique', 'orthographic'] as const) {
        const camera = integerCamera(viewport, FOREST_ROAD, projection);
        camera.fit();
        expectSettled(camera);
        expect(TILE * camera.scale).toBeGreaterThanOrEqual(MIN_TILE_PX);
        // Either the whole board is in view, or a smaller whole scale would
        // put a tile under a fingertip (the portrait pan exception).
        const smaller = (camera.deviceScale - 1) / viewport.dpr;
        if (!camera.fitted) expect(TILE * smaller).toBeLessThan(MIN_TILE_PX);
      }
    });
  }

  it.each([
    { dpr: 1, preferred: 40, expected: 64 },
    { dpr: 1, preferred: 64, expected: 64 },
    { dpr: 1, preferred: 96, expected: 64 },
    { dpr: 1.5, preferred: 40, expected: 64 / 1.5 },
    { dpr: 1.5, preferred: 64, expected: 64 / 1.5 },
    { dpr: 2, preferred: 40, expected: 64 },
    { dpr: 2, preferred: 64, expected: 64 },
    { dpr: 2, preferred: 96, expected: 96 },
    { dpr: 3, preferred: 40, expected: 128 / 3 },
    { dpr: 3, preferred: 64, expected: 64 },
  ])(
    'snaps a $preferred px combat preference at DPR $dpr to $expected px',
    ({ dpr, preferred, expected }) => {
      // A short canvas keeps the board fit below the preferred scale. ADR 0088
      // floors the preference, then enforces the smallest whole, tappable stop.
      const camera = integerCamera({ width: 1280, height: 200, dpr }, FOREST_ROAD);
      camera.fitExplore(preferred, 12, 'floor');
      expect(TILE * camera.scale).toBeCloseTo(expected, 9);
      expect(TILE * camera.scale).toBeGreaterThanOrEqual(MIN_TILE_PX);
      expectSettled(camera);
    },
  );

  it('leaves the continuous camera alone when integer zoom is off', () => {
    const camera = new Camera({ width: 1368, height: 912, dpr: 1.5 }, FOREST_ROAD, 'oblique');
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
    it(`picks every cell, raised tops included, from where it is drawn (${viewport.name})`, () => {
      const camera = integerCamera(viewport, grid);
      camera.fitExplore(96);
      for (const zoom of [1, 1.6, 0.6]) {
        camera.zoomAt({ x: viewport.width * 0.37, y: viewport.height * 0.61 }, zoom);
        camera.centreOn({ x: 9.3, y: 5.7 });
        expectSettled(camera);
        for (const cell of cells) {
          // A flat cell can sit under a raised top in front of it; the lifted
          // picks are the raised cells' own.
          const flat = camera.project({ x: cell.x + 0.5, y: cell.y + 0.5 });
          expect(camera.pickTile(flat.x, flat.y, null)).toEqual(cell);
        }
        for (const cell of cells.filter((c) => liftAt(grid, c, 'oblique') > 0)) {
          const lift = liftAt(grid, cell, 'oblique');
          const centre = camera.project({ x: cell.x + 0.5, y: cell.y + 0.5 });
          const drawn = { x: centre.x, y: centre.y - lift * TILE * camera.scale };
          expect(camera.pickTile(drawn.x, drawn.y, grid)).toEqual(cell);
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
    const camera = integerCamera(viewport, FOREST_ROAD);
    camera.fitExplore(96);
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
    expect([...seen].sort((a, b) => a - b)).toEqual([3, 4, 5]);
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

  it('at 1 dpr, zooms out past one device pixel to the whole board, and back', () => {
    const camera = integerCamera({ width: 1368, height: 612, dpr: 1 }, FOREST_ROAD);
    camera.fitExplore(96, 12, 'floor');
    expect(camera.deviceScale).toBe(1);
    expect(camera.fitted).toBe(false);
    for (let i = 0; i < 6; i++) camera.zoomAt({ x: 600, y: 300 }, 0.8);
    // The overview: the continuous fit, the one stop under a device pixel.
    expect(camera.scale).toBeCloseTo(camera.fitScale(), 9);
    expect(camera.fitted).toBe(true);
    // A HUD reflow keeps it, and a dpr-less refit does not pull it back to 1x.
    camera.raiseToFit();
    expect(camera.fitted).toBe(true);
    for (let i = 0; i < 6; i++) camera.zoomAt({ x: 600, y: 300 }, 1.25);
    expectSettled(camera);
    // And in past the 2x the explore view opens at, to the third step.
    for (let i = 0; i < 20; i++) camera.zoomAt({ x: 600, y: 300 }, 1.25);
    expect(camera.deviceScale).toBe(3);
  });

  it('combat floors its tuned tile, exploration rounds it', () => {
    const viewport = { width: 1368, height: 912, dpr: 1 };
    const combat = integerCamera(viewport, FOREST_ROAD);
    combat.fitExplore(96, 12, 'floor');
    const explore = integerCamera(viewport, FOREST_ROAD);
    explore.fitExplore(96);
    expect([combat.deviceScale, explore.deviceScale]).toEqual([1, 2]);
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
    const camera = integerCamera({ width: 1368, height: 912, dpr: 2 }, FOREST_ROAD, 'orthographic');
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
