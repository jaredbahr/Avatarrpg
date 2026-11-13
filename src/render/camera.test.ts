import { describe, expect, it } from 'vitest';
import { FOREST_ROAD } from '../content/maps/combat';
import { Camera, MIN_TILE_PX, TILE } from './camera';
import type { Viewport } from './camera';

/** A Surface-sized map area in landscape: the whole 20x12 board fits. */
const LANDSCAPE = { width: 1344, height: 640, dpr: 1 };
/** A phone-sized area: fitting the board would leave tiles far below a fingertip. */
const NARROW = { width: 380, height: 560, dpr: 1 };
const GRID = { width: 20, height: 12 };

describe('Camera.spriteBox actor foot', () => {
  it('keeps the orthographic square 2x2 box unchanged', () => {
    const camera = new Camera(LANDSCAPE, GRID, 'orthographic');
    expect(camera.spriteBox({ x: 15, y: 5 }, 2, true)).toEqual(camera.toScreen({ x: 15, y: 6 }));
  });
});

describe('Camera.fit', () => {
  it('fits the whole board when a tile stays at fingertip size', () => {
    const camera = new Camera(LANDSCAPE, GRID);
    camera.fit();
    expect(camera.fitted).toBe(true);
    expect(camera.worldWidth).toBeLessThanOrEqual(LANDSCAPE.width);
    expect(camera.worldHeight).toBeLessThanOrEqual(LANDSCAPE.height);
    expect(TILE * camera.scale).toBeGreaterThanOrEqual(MIN_TILE_PX);
  });

  it('prefers a tappable tile over a fitted board on a narrow viewport', () => {
    const camera = new Camera(NARROW, GRID);
    camera.fit();
    expect(TILE * camera.scale).toBeCloseTo(MIN_TILE_PX, 6);
    expect(camera.fitted).toBe(false);
    // The map is wider than the viewport, so it must be pannable and clamped.
    expect(camera.worldWidth).toBeGreaterThan(NARROW.width);
    expect(camera.offsetX).toBeGreaterThanOrEqual(0);
  });

  it('centres on a tile when the board does not fit', () => {
    const camera = new Camera(NARROW, GRID);
    camera.fit();
    camera.centreOn({ x: 19, y: 0 });
    const { x, size } = camera.toScreen({ x: 19, y: 0 });
    expect(x + size).toBeLessThanOrEqual(NARROW.width + 0.5);
    expect(x).toBeGreaterThanOrEqual(-0.5);
  });
});

describe('Camera.zoomAt', () => {
  it('keeps the world point under the finger fixed', () => {
    const camera = new Camera(LANDSCAPE, GRID);
    camera.fit();
    const at = { x: 400, y: 300 };
    const before = worldAt(camera, at);
    camera.zoomAt(at, 1.8);
    const after = worldAt(camera, at);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(camera.fitted).toBe(false);
  });

  it('never zooms out past the fitted board', () => {
    const camera = new Camera(LANDSCAPE, GRID);
    camera.fit();
    const fitted = camera.scale;
    camera.zoomAt({ x: 10, y: 10 }, 0.2);
    expect(camera.scale).toBeCloseTo(fitted, 6);
    expect(camera.fitted).toBe(true);
  });

  it('caps zoom in at the maximum scale and stays clamped to the map', () => {
    const camera = new Camera(LANDSCAPE, GRID);
    camera.fit();
    for (let i = 0; i < 20; i++) camera.zoomAt({ x: 0, y: 0 }, 1.5);
    expect(camera.scale).toBeCloseTo(2.5, 6);
    expect(camera.offsetX).toBeGreaterThanOrEqual(0);
    expect(camera.offsetX).toBeLessThanOrEqual(camera.worldWidth - LANDSCAPE.width);
    expect(camera.offsetY).toBeGreaterThanOrEqual(0);
    expect(camera.offsetY).toBeLessThanOrEqual(camera.worldHeight - LANDSCAPE.height);
  });

  it('pans only while zoomed; a fitted board stays put', () => {
    const camera = new Camera(LANDSCAPE, GRID);
    camera.fit();
    const { offsetX, offsetY } = camera;
    camera.panBy(50, -30);
    expect(camera.offsetX).toBe(offsetX);
    expect(camera.offsetY).toBe(offsetY);

    camera.zoomAt({ x: 600, y: 300 }, 2);
    const zoomed = camera.offsetX;
    camera.panBy(50, 0);
    expect(camera.offsetX).toBe(zoomed - 50);
  });

  it('refits after a resize when the board was fitted, and keeps a zoom otherwise', () => {
    const camera = new Camera(LANDSCAPE, GRID);
    camera.fit();
    expect(camera.fitted).toBe(true);
    camera.viewport = { width: 1000, height: 600, dpr: 1 };
    camera.fit();
    expect(camera.fitted).toBe(true);
    expect(TILE * camera.scale).toBeGreaterThanOrEqual(MIN_TILE_PX);

    camera.zoomAt({ x: 100, y: 100 }, 2);
    const scale = camera.scale;
    camera.viewport = { width: 1100, height: 650, dpr: 1 };
    camera.clamp();
    expect(camera.scale).toBe(scale);
  });
});

describe('Camera centre clamp', () => {
  const inwardMargin = 0.609375;
  const maps = [
    {
      name: 'village',
      width: 24,
      height: 16,
      projection: 'topdown',
      cameraCentreMargin: -inwardMargin,
    },
    {
      name: 'forest road',
      width: FOREST_ROAD.width,
      height: FOREST_ROAD.height,
      projection: 'topdown',
      cameraCentreMargin: -0.609375,
    },
  ] as const;
  const viewports = [
    { width: 1368, height: 912, dpr: 1 },
    { width: 834, height: 1194, dpr: 1 },
    { width: 390, height: 844, dpr: 1 },
  ];
  const directions = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ] as const;

  const cameraFor = (viewport: Viewport, map: (typeof maps)[number]) => {
    const camera = new Camera(viewport, map, map.projection);
    camera.centreMargin = map.cameraCentreMargin;
    camera.fitExplore(96);
    return camera;
  };
  const expectCentreInside = (camera: Camera, map: (typeof maps)[number]) => {
    const centre = camera.unproject({
      x: camera.viewport.width / 2,
      y: camera.viewport.height / 2,
    });
    expect(centre.x).toBeGreaterThanOrEqual(inwardMargin - 1e-9);
    expect(centre.x).toBeLessThanOrEqual(map.width - inwardMargin + 1e-9);
    expect(centre.y).toBeGreaterThanOrEqual(inwardMargin - 1e-9);
    expect(centre.y).toBeLessThanOrEqual(map.height - inwardMargin + 1e-9);
  };

  it.each(maps.flatMap((map) => viewports.map((viewport) => ({ map, viewport }))))(
    'keeps the viewport centre on the $map.name at $viewport.width×$viewport.height',
    ({ map, viewport }) => {
      for (const [x, y] of directions) {
        const dragged = cameraFor(viewport, map);
        dragged.panBy(x * 1e6, y * 1e6);
        expectCentreInside(dragged, map);

        const zoomedOut = cameraFor(viewport, map);
        zoomedOut.panBy(x * 1e6, y * 1e6);
        zoomedOut.zoomAt({ x: viewport.width / 3, y: viewport.height / 3 }, 0);
        expectCentreInside(zoomedOut, map);
        zoomedOut.panBy(x * 1e6, y * 1e6);
        expectCentreInside(zoomedOut, map);

        const resized = cameraFor(viewport, map);
        resized.panBy(x * 1e6, y * 1e6);
        resized.viewport = {
          ...viewport,
          width: viewport.width + 77,
          height: viewport.height - 53,
        };
        resized.clampToPanBounds();
        expectCentreInside(resized, map);
      }
    },
  );

  it.each(maps.flatMap((map) => viewports.map((viewport) => ({ map, viewport }))))(
    'centres interior $map.name tiles at $viewport.width×$viewport.height',
    ({ map, viewport }) => {
      const camera = cameraFor(viewport, map);
      for (const tile of [
        { x: 1, y: 1 },
        { x: map.width - 2, y: 1 },
        { x: map.width - 2, y: map.height - 2 },
        { x: 1, y: map.height - 2 },
        { x: map.width / 2, y: map.height / 2 },
      ]) {
        camera.centreOn(tile);
        const screen = camera.project({ x: tile.x + 0.5, y: tile.y + 0.5 });
        expect(screen.x).toBeCloseTo(viewport.width / 2, 9);
        expect(screen.y).toBeCloseTo(viewport.height / 2, 9);
      }
    },
  );

  it.each(maps.flatMap((map) => viewports.map((viewport) => ({ map, viewport }))))(
    'keeps followed $map.name corner diamonds and one tile of headroom visible at $viewport.width×$viewport.height',
    ({ map, viewport }) => {
      for (const scale of [1.5, 2.5]) {
        const camera = cameraFor(viewport, map);
        camera.scale = scale;
        for (const tile of [
          { x: 0, y: 0 },
          { x: map.width - 1, y: 0 },
          { x: map.width - 1, y: map.height - 1 },
          { x: 0, y: map.height - 1 },
        ]) {
          camera.centreOn(tile);
          const foot = camera.project({ x: tile.x + 0.5, y: tile.y + 0.5 });
          const points = [
            camera.project({ x: tile.x, y: tile.y }),
            camera.project({ x: tile.x + 1, y: tile.y }),
            camera.project({ x: tile.x + 1, y: tile.y + 1 }),
            camera.project({ x: tile.x, y: tile.y + 1 }),
            { x: foot.x, y: foot.y - TILE * scale },
          ];
          for (const point of points) {
            expect(point.x).toBeGreaterThanOrEqual(-1e-9);
            expect(point.x).toBeLessThanOrEqual(viewport.width + 1e-9);
            expect(point.y).toBeGreaterThanOrEqual(-1e-9);
            expect(point.y).toBeLessThanOrEqual(viewport.height + 1e-9);
          }
        }
      }
    },
  );

  it('leaves maps without the field on the existing rectangular clamp path', () => {
    const camera = new Camera(viewports[0]!, maps[0], 'topdown');
    camera.fitExplore(96);
    let expectedX = camera.offsetX;
    let expectedY = camera.offsetY;
    const slackX = camera.worldWidth - camera.viewport.width;
    const slackY = camera.worldHeight - camera.viewport.height;
    for (const [dx, dy] of [
      [500, -300],
      [-5000, 80],
      [40, 5000],
      [120, -75],
    ] as const) {
      camera.panBy(dx, dy);
      expectedX = Math.max(0, Math.min(slackX, expectedX - dx));
      expectedY = Math.max(0, Math.min(slackY, expectedY - dy));
      expect(camera.offsetX).toBeCloseTo(expectedX, 12);
      expect(camera.offsetY).toBeCloseTo(expectedY, 12);
    }
  });
});

function worldAt(camera: Camera, at: { x: number; y: number }): { x: number; y: number } {
  const size = TILE * camera.scale;
  return { x: (at.x + camera.offsetX) / size, y: (at.y + camera.offsetY) / size };
}
