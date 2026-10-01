import { describe, expect, it } from 'vitest';
import { COMBAT_CAMERA_RING_TILES } from '../content/maps/combat';
import {
  Camera,
  clampCentreToConvexPolygon,
  insetConvexPolygon,
  MIN_TILE_PX,
  PAN_INSET,
  TILE,
} from './camera';

/** A Surface-sized map area in landscape: the whole 20x12 board fits. */
const LANDSCAPE = { width: 1344, height: 640, dpr: 1 };
/** A phone-sized area: fitting the board would leave tiles far below a fingertip. */
const NARROW = { width: 380, height: 560, dpr: 1 };
const GRID = { width: 20, height: 12 };

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

describe('Camera.clamp painted ring', () => {
  it.each([
    [
      'forest',
      COMBAT_CAMERA_RING_TILES.forest_road,
      { top: 2.2, right: 4.4, bottom: 2.2, left: 4.4 },
    ],
    ['gate', COMBAT_CAMERA_RING_TILES.quarry_gate, { top: 8.75, right: 5, bottom: 1.25, left: 5 }],
    [
      'Cutting',
      COMBAT_CAMERA_RING_TILES.ambush_road,
      { top: 8.75, right: 5, bottom: 1.25, left: 5 },
    ],
    [
      'floor',
      COMBAT_CAMERA_RING_TILES.quarry_floor,
      { top: 8.75, right: 5, bottom: 1.25, left: 5 },
    ],
  ] as const)(
    'allows the %s ring but never the page beyond it',
    (_map, ringTiles, expectedRingTiles) => {
      expect(ringTiles).toEqual(expectedRingTiles);
      const camera = new Camera(NARROW, GRID, 'oblique', ringTiles);
      camera.fitExplore(96);

      camera.panBy(100_000, 100_000);
      expect(camera.offsetX).toBeCloseTo(-ringTiles.left * TILE * camera.scale, 6);
      expect(camera.offsetY).toBeCloseTo(-ringTiles.top * TILE * camera.scale, 6);

      camera.panBy(-200_000, -200_000);
      expect(camera.offsetX).toBeCloseTo(
        camera.worldWidth - NARROW.width + ringTiles.right * TILE * camera.scale,
        6,
      );
      expect(camera.offsetY).toBeCloseTo(
        camera.worldHeight - NARROW.height + ringTiles.bottom * TILE * camera.scale,
        6,
      );
    },
  );

  it('keeps a fitted axis centred during manual pan', () => {
    const camera = new Camera(LANDSCAPE, GRID, 'oblique', COMBAT_CAMERA_RING_TILES.forest_road);
    camera.fit();
    const initialY = camera.offsetY;
    camera.panBy(0, 100_000);
    expect(camera.offsetY).toBe(initialY);
    expect(camera.offsetY).toBeCloseTo((camera.worldHeight - LANDSCAPE.height) / 2, 6);
  });

  it('reapplies painted pan bounds after the viewport changes', () => {
    const camera = new Camera(NARROW, GRID, 'oblique', COMBAT_CAMERA_RING_TILES.forest_road);
    camera.fitExplore(96);
    camera.panBy(-200_000, -200_000);
    camera.viewport = { width: 520, height: 640, dpr: 1 };
    camera.clampToPanBounds();

    expect(camera.offsetX).toBeCloseTo(
      camera.worldWidth - camera.viewport.width + camera.clampRingTiles.right * TILE * camera.scale,
      6,
    );
    expect(camera.offsetY).toBeCloseTo(
      camera.worldHeight -
        camera.viewport.height +
        camera.clampRingTiles.bottom * TILE * camera.scale,
      6,
    );
  });

  it('does not change fit scale, tile size, or programmatic grid centring', () => {
    const baseline = new Camera(NARROW, GRID, 'oblique');
    const ringed = new Camera(NARROW, GRID, 'oblique', COMBAT_CAMERA_RING_TILES.forest_road);
    baseline.fitExplore(96);
    ringed.fitExplore(96);

    expect(ringed.scale).toBe(baseline.scale);
    expect(TILE * ringed.scale).toBe(96);
    expect(ringed.offsetX).toBe(baseline.offsetX);
    expect(ringed.offsetY).toBe(baseline.offsetY);
  });

  it('centreOn clamps an edge actor to the grid, not the painted ring', () => {
    const camera = new Camera(NARROW, GRID, 'oblique', COMBAT_CAMERA_RING_TILES.quarry_floor);
    camera.fitExplore(96);
    camera.centreOn({ x: 1, y: 3 });

    expect(camera.offsetX).toBeCloseTo(770, 6);
    expect(camera.offsetY).toBe(0);
  });
});

describe('clampCentreToConvexPolygon', () => {
  const diamond = [
    { x: 0, y: -4 },
    { x: 6, y: 0 },
    { x: 0, y: 4 },
    { x: -6, y: 0 },
  ] as const;

  it.each([
    ['clockwise', diamond],
    ['counter-clockwise', [...diamond].reverse()],
  ] as const)('leaves an inside point unchanged (%s)', (_direction, polygon) => {
    expect(clampCentreToConvexPolygon({ x: 1, y: 0.5 }, polygon)).toEqual({ x: 1, y: 0.5 });
  });

  it('projects an outside point to the nearest boundary point', () => {
    expect(clampCentreToConvexPolygon({ x: 10, y: 0 }, diamond)).toEqual({ x: 6, y: 0 });
    expect(clampCentreToConvexPolygon({ x: 0, y: -10 }, diamond)).toEqual({ x: 0, y: -4 });
  });

  it.each(['orthographic', 'oblique'] as const)(
    'handles both projections at every zoom (%s)',
    (projection) => {
      const camera = new Camera(NARROW, GRID, projection);
      const hull =
        projection === 'oblique'
          ? [
              { x: 0, y: -2.2 },
              { x: 24.4, y: 10 },
              { x: 8, y: 18.2 },
              { x: -16.4, y: 6 },
            ]
          : [
              { x: -2, y: -2 },
              { x: 22, y: -2 },
              { x: 22, y: 14 },
              { x: -2, y: 14 },
            ];
      camera.clampPaintHull = hull;
      camera.fitExplore(96);
      for (const factor of [1, 1.5, 2.5]) {
        if (factor !== 1) camera.zoomAt({ x: 180, y: 260 }, factor);
        camera.panBy(100_000, 100_000);
        const point = {
          x: (camera.offsetX + camera.viewport.width / 2) / camera.scale,
          y: (camera.offsetY + camera.viewport.height / 2) / camera.scale,
        };
        const boardHull = hull.map((p) => camera.boardPoint(p));
        expect(clampCentreToConvexPolygon(point, boardHull)).toEqual(point);
        camera.panBy(-200_000, -200_000);
      }
    },
  );
});

describe('Camera.clamp convex paint hull', () => {
  const forestHull = [
    { x: 0, y: -2.2 },
    { x: 24.4, y: 10 },
    { x: 8, y: 18.2 },
    { x: -16.4, y: 6 },
  ] as const;

  it('insets the Forest Road hull by the viewport and grows reach when zoomed in', () => {
    const viewport = { width: 1194, height: 455, dpr: 1 };
    const camera = new Camera(viewport, GRID, 'oblique');
    const boardHull = forestHull.map((point) => camera.boardPoint(point));
    const insetAt = (zoom: number) =>
      insetConvexPolygon(
        boardHull,
        (PAN_INSET * viewport.width) / (2 * zoom),
        (PAN_INSET * viewport.height) / (2 * zoom),
      );
    const reach = (polygon: readonly { x: number }[]) =>
      Math.max(...polygon.map((point) => point.x)) - Math.min(...polygon.map((point) => point.x));
    // The inset is a fixed share of the viewport, so the pannable reach left
    // inside the hull grows as the board is magnified.
    expect(insetAt(1).length).toBeGreaterThan(0);
    expect(reach(insetAt(2))).toBeGreaterThan(reach(insetAt(1)));
    expect(reach(insetAt(3))).toBeGreaterThan(reach(insetAt(2)));
  });

  it('centres an axis when its viewport inset consumes the hull on that axis', () => {
    const camera = new Camera({ width: 4000, height: 455, dpr: 1 }, GRID, 'oblique');
    camera.clampPaintHull = forestHull;
    camera.scale = 1;
    camera.panBy(100_000, 0);
    expect(camera.offsetX).toBeCloseTo((camera.worldWidth - camera.viewport.width) / 2, 6);
  });

  it('keeps at least half the 1194x455 viewport under Forest Road paint at every extreme', () => {
    const camera = new Camera({ width: 1194, height: 455, dpr: 1 }, GRID, 'oblique');
    camera.clampPaintHull = forestHull;
    camera.fit();
    const coveredFraction = (): number => {
      const polygon = forestHull.map((point) => {
        const board = camera.boardPoint(point);
        return {
          x: board.x * camera.scale - camera.offsetX,
          y: board.y * camera.scale - camera.offsetY,
        };
      });
      let covered = 0;
      const samples = 120;
      for (let sy = 0; sy < samples; sy += 1)
        for (let sx = 0; sx < samples; sx += 1) {
          const point = {
            x: ((sx + 0.5) * camera.viewport.width) / samples,
            y: ((sy + 0.5) * camera.viewport.height) / samples,
          };
          const crosses = polygon.map((a, index) => {
            const b = polygon[(index + 1) % polygon.length] ?? a;
            return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
          });
          if (crosses.every((cross) => cross >= 0) || crosses.every((cross) => cross <= 0))
            covered += 1;
        }
      return covered / samples ** 2;
    };
    for (const [dx, dy] of [
      [100_000, 0],
      [-200_000, 0],
      [100_000, 100_000],
      [0, -200_000],
    ] as const) {
      camera.panBy(dx, dy);
      expect(coveredFraction(), `${dx},${dy}`).toBeGreaterThanOrEqual(0.5);
    }
  });

  it.each(['orthographic', 'oblique'] as const)(
    'keeps a fitted axis centred while clamping the overflowing axis (%s)',
    (projection) => {
      const camera =
        projection === 'oblique'
          ? new Camera({ width: 1344, height: 500, dpr: 1 }, GRID, projection)
          : new Camera({ width: 900, height: 300, dpr: 1 }, GRID, projection);
      camera.clampPaintHull =
        projection === 'oblique'
          ? [
              { x: 0, y: -2.2 },
              { x: 24.4, y: 10 },
              { x: 8, y: 18.2 },
              { x: -16.4, y: 6 },
            ]
          : [
              { x: -2, y: -2 },
              { x: 22, y: -2 },
              { x: 22, y: 14 },
              { x: -2, y: 14 },
            ];
      camera.fit();
      const centredX = camera.offsetX;
      camera.panBy(0, 100_000);
      expect(camera.offsetX).toBe(centredX);
      expect(camera.offsetX).toBeCloseTo((camera.worldWidth - camera.viewport.width) / 2, 6);
    },
  );
});

function worldAt(camera: Camera, at: { x: number; y: number }): { x: number; y: number } {
  const size = TILE * camera.scale;
  return { x: (at.x + camera.offsetX) / size, y: (at.y + camera.offsetY) / size };
}
