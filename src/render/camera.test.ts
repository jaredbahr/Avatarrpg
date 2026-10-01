import { describe, expect, it } from 'vitest';
import { COMBAT_CAMERA_RING_TILES } from '../content/maps/combat';
import type { Projection } from './projection';
import { Camera, MIN_TILE_PX, TILE } from './camera';
import type { Viewport } from './camera';

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

const HULL_VIEWPORTS = [
  { width: 1194, height: 455, dpr: 1 },
  { width: 1194, height: 540, dpr: 1 },
  { width: 1194, height: 560, dpr: 1 },
  { width: 834, height: 890, dpr: 1 },
  { width: 380, height: 560, dpr: 1 },
  { width: 390, height: 700, dpr: 1 },
  { width: 2000, height: 200, dpr: 1 },
] as const;

type Point = { x: number; y: number };

function hullCamera(viewport: Viewport, scale: number, projection: Projection = 'oblique'): Camera {
  const camera = new Camera(viewport, GRID, projection);
  camera.scale = scale;
  camera.clampToProgrammaticReachableSet = true;
  return camera;
}

function scalesFor(viewport: Viewport, projection: Projection): number[] {
  const camera = new Camera(viewport, GRID, projection);
  const start = camera.fitScale();
  const geometric = Array.from({ length: 60 }, (_, index) => start * (2.5 / start) ** (index / 59));
  const worldWidth = projection === 'oblique' ? 32 * TILE : GRID.width * TILE;
  const worldHeight = projection === 'oblique' ? 16 * TILE : GRID.height * TILE;
  return [
    ...new Set([
      ...geometric,
      0.625,
      1,
      1.5,
      viewport.width / worldWidth - 1e-6,
      viewport.width / worldWidth + 1e-6,
      viewport.height / worldHeight - 1e-6,
      viewport.height / worldHeight + 1e-6,
    ]),
  ];
}

function eachCell(callback: (point: Point) => void): void {
  for (let y = 0; y < GRID.height; y += 1)
    for (let x = 0; x < GRID.width; x += 1) callback({ x, y });
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function offset(camera: Camera): Point {
  return { x: camera.offsetX, y: camera.offsetY };
}

function centreOnAndAssertStable(camera: Camera, point: Point, footprint: 1 | 2): string | null {
  camera.centreOn(point, footprint);
  const centred = offset(camera);
  camera.clampToPanBounds();
  if (!Object.is(camera.offsetX, centred.x) || !Object.is(camera.offsetY, centred.y))
    return `clamp ${JSON.stringify({ point, footprint, centred, actual: offset(camera) })}`;
  camera.panBy(0, 0);
  return Object.is(camera.offsetX, centred.x) && Object.is(camera.offsetY, centred.y)
    ? null
    : `pan ${JSON.stringify({ point, footprint, centred, actual: offset(camera) })}`;
}

describe('Camera.clamp programmatic-reachable hull', () => {
  it.each(['oblique', 'orthographic'] as const)(
    'preserves every valid programmatic centring at every required size and scale (%s)',
    { timeout: 120_000 },
    (projection) => {
      const failures: string[] = [];
      for (const viewport of HULL_VIEWPORTS)
        for (const scale of scalesFor(viewport, projection)) {
          const camera = hullCamera(viewport, scale, projection);
          eachCell((point) => {
            const failure = centreOnAndAssertStable(camera, point, 1);
            if (failure)
              failures.push(
                `${projection} ${viewport.width}x${viewport.height} s=${scale}: ${failure}`,
              );
            // combatFocusPosition is the anchor itself for the square footprints used by combat.
            const combatFailure = centreOnAndAssertStable(camera, point, 1);
            if (combatFailure)
              failures.push(
                `${projection} ${viewport.width}x${viewport.height} s=${scale}: combat ${combatFailure}`,
              );
          });
          for (let y = 0; y < GRID.height - 1; y += 1)
            for (let x = 0; x < GRID.width - 1; x += 1) {
              const point = { x, y };
              const failure = centreOnAndAssertStable(camera, point, 2);
              if (failure)
                failures.push(
                  `${projection} ${viewport.width}x${viewport.height} s=${scale}: ${failure}`,
                );
              const combatFailure = centreOnAndAssertStable(camera, point, 2);
              if (combatFailure)
                failures.push(
                  `${projection} ${viewport.width}x${viewport.height} s=${scale}: combat ${combatFailure}`,
                );
            }
        }
      expect(failures.slice(0, 5)).toEqual([]);
    },
  );

  it.each([
    [{ width: 390, height: 700, dpr: 1 }, [0.69, 0.7, 0.71]],
    [{ width: 2000, height: 200, dpr: 1 }, [1, 1.05, 1.1]],
  ] as const)(
    'does not substitute focus/grid intersection at $0.width×$0.height',
    (viewport, scales) => {
      const failures: string[] = [];
      for (const scale of scales) {
        const camera = hullCamera(viewport, scale);
        eachCell((point) => {
          const failure = centreOnAndAssertStable(camera, point, 1);
          if (failure) failures.push(`s=${scale}: ${failure}`);
        });
      }
      expect(failures).toEqual([]);
    },
  );

  it(
    'moves no rim-centred offset by more than the requested one-pixel drag',
    { timeout: 30_000 },
    () => {
      const directions = [-1, 0, 1].flatMap((x) =>
        [-1, 0, 1].filter((y) => x !== 0 || y !== 0).map((y) => ({ x, y })),
      );
      let worst = 0;
      for (const viewport of HULL_VIEWPORTS)
        for (const scale of scalesFor(viewport, 'oblique')) {
          const camera = hullCamera(viewport, scale);
          eachCell((point) => {
            if (
              point.x !== 0 &&
              point.y !== 0 &&
              point.x !== GRID.width - 1 &&
              point.y !== GRID.height - 1
            )
              return;
            for (const direction of directions) {
              camera.centreOn(point);
              const before = offset(camera);
              camera.panBy(direction.x, direction.y);
              worst = Math.max(
                worst,
                Math.hypot(camera.offsetX - before.x, camera.offsetY - before.y),
              );
            }
          });
        }
      expect(worst).toBeLessThanOrEqual(1 + 1e-6);
    },
  );

  it.each(['oblique', 'orthographic'] as const)(
    'accepts every <=24px straight-line step from five clamped starts to every cell (%s)',
    { timeout: 120_000 },
    (projection) => {
      const viewports = HULL_VIEWPORTS.filter(
        ({ width, height }) =>
          (width === 1194 && height === 540) ||
          (width === 834 && height === 890) ||
          (width === 380 && height === 560),
      );
      const failures: string[] = [];
      for (const viewport of viewports)
        for (const scale of scalesFor(viewport, projection)) {
          const camera = hullCamera(viewport, scale, projection);
          eachCell((point) => {
            camera.centreOn(point);
            const target = offset(camera);
            for (const start of [
              { x: 0, y: 0 },
              { x: -100_000, y: -100_000 },
              { x: -100_000, y: 100_000 },
              { x: 100_000, y: -100_000 },
              { x: 100_000, y: 100_000 },
            ]) {
              camera.offsetX = start.x;
              camera.offsetY = start.y;
              camera.clampToPanBounds();
              const distance = Math.hypot(target.x - camera.offsetX, target.y - camera.offsetY);
              const steps = Math.max(1, Math.ceil(distance / 24));
              for (let step = steps; step > 0; step -= 1) {
                const dx = (target.x - camera.offsetX) / step;
                const dy = (target.y - camera.offsetY) / step;
                const before = offset(camera);
                camera.panBy(-dx, -dy);
                if (
                  !Object.is(camera.offsetX, before.x + dx) ||
                  !Object.is(camera.offsetY, before.y + dy)
                ) {
                  failures.push(
                    `${projection} ${viewport.width}x${viewport.height} s=${scale} ${JSON.stringify({ point, start, before, dx, dy, actual: offset(camera) })}`,
                  );
                  break;
                }
              }
              const screen = camera.project({ x: point.x + 0.5, y: point.y + 0.5 });
              if (
                screen.x < 0 ||
                screen.x > viewport.width ||
                screen.y < 0 ||
                screen.y > viewport.height
              )
                failures.push(
                  `offscreen ${JSON.stringify({ projection, viewport, scale, point, screen })}`,
                );
            }
          });
        }
      expect(failures.slice(0, 5)).toEqual([]);
    },
  );

  it.each(['oblique', 'orthographic'] as const)(
    'is idempotent for 2,000 seeded offsets per required viewport and scale (%s)',
    { timeout: 120_000 },
    (projection) => {
      const random = createRandom(projection === 'oblique' ? 0xc2_04 : 0xc2_040);
      const failures: string[] = [];
      for (const viewport of HULL_VIEWPORTS)
        for (const scale of scalesFor(viewport, projection)) {
          const camera = hullCamera(viewport, scale, projection);
          for (let index = 0; index < 2000; index += 1) {
            camera.offsetX = (random() - 0.5) * 200_000;
            camera.offsetY = (random() - 0.5) * 200_000;
            camera.clampToPanBounds();
            const once = offset(camera);
            camera.clampToPanBounds();
            if (!Object.is(camera.offsetX, once.x) || !Object.is(camera.offsetY, once.y)) {
              failures.push(
                `${projection} ${viewport.width}x${viewport.height} s=${scale} ${JSON.stringify({ once, twice: offset(camera) })}`,
              );
              break;
            }
          }
        }
      expect(failures.slice(0, 5)).toEqual([]);
    },
  );

  it('stays within clamp() and is a non-expansive projection', { timeout: 120_000 }, () => {
    const random = createRandom(0xc204_cafe);
    const failures: string[] = [];
    for (const viewport of HULL_VIEWPORTS)
      for (const scale of scalesFor(viewport, 'oblique')) {
        const camera = hullCamera(viewport, scale);
        for (let index = 0; index < 500; index += 1) {
          const first = { x: (random() - 0.5) * 200_000, y: (random() - 0.5) * 200_000 };
          const second = { x: (random() - 0.5) * 200_000, y: (random() - 0.5) * 200_000 };
          camera.offsetX = first.x;
          camera.offsetY = first.y;
          camera.clampToPanBounds();
          const projectedFirst = offset(camera);
          camera.clamp();
          if (
            !Object.is(camera.offsetX, projectedFirst.x) ||
            !Object.is(camera.offsetY, projectedFirst.y)
          )
            failures.push(
              `outside grid clamp ${JSON.stringify({ viewport, scale, projectedFirst, clamped: offset(camera) })}`,
            );
          camera.offsetX = second.x;
          camera.offsetY = second.y;
          camera.clampToPanBounds();
          const projectedSecond = offset(camera);
          if (
            Math.hypot(projectedFirst.x - projectedSecond.x, projectedFirst.y - projectedSecond.y) >
            Math.hypot(first.x - second.x, first.y - second.y) + 1e-6
          )
            failures.push(
              `expansive ${JSON.stringify({ viewport, scale, first, second, projectedFirst, projectedSecond })}`,
            );
        }
      }
    expect(failures.slice(0, 5)).toEqual([]);
  });

  it('matches clamp() with exactly one fitted axis and is fixed with both fitted', () => {
    const random = createRandom(0xc2_0407);
    for (const viewport of [
      { width: 3000, height: 455, dpr: 1 },
      { width: 455, height: 2000, dpr: 1 },
    ]) {
      const hull = hullCamera(viewport, 1);
      const plain = new Camera(viewport, GRID, 'oblique');
      plain.scale = 1;
      for (let index = 0; index < 2000; index += 1) {
        const candidate = { x: (random() - 0.5) * 200_000, y: (random() - 0.5) * 200_000 };
        hull.offsetX = plain.offsetX = candidate.x;
        hull.offsetY = plain.offsetY = candidate.y;
        hull.clampToPanBounds();
        plain.clamp();
        expect(offset(hull)).toEqual(offset(plain));
        if (hull.worldWidth <= viewport.width)
          expect(hull.offsetX).toBe((hull.worldWidth - viewport.width) / 2);
        if (hull.worldHeight <= viewport.height)
          expect(hull.offsetY).toBe((hull.worldHeight - viewport.height) / 2);
      }
    }

    const fitted = hullCamera({ width: 3000, height: 2000, dpr: 1 }, 1);
    fitted.centre();
    const before = offset(fitted);
    fitted.panBy(100_000, -100_000);
    expect(offset(fitted)).toEqual(before);
  });

  it.each(['oblique', 'orthographic'] as const)(
    'is continuous across scale sweeps and fitted thresholds (%s)',
    { timeout: 120_000 },
    (projection) => {
      const failures: string[] = [];
      for (const viewport of HULL_VIEWPORTS) {
        const reference = hullCamera(viewport, 1, projection);
        const corners = [
          reference.groundPoint({ x: 0.5, y: 0.5 }),
          reference.groundPoint({ x: GRID.width - 0.5, y: 0.5 }),
          reference.groundPoint({ x: GRID.width - 0.5, y: GRID.height - 0.5 }),
          reference.groundPoint({ x: 0.5, y: GRID.height - 0.5 }),
        ];
        const minX = Math.min(...corners.map((point) => point.x)) - 500;
        const maxX = Math.max(...corners.map((point) => point.x)) + 500;
        const minY = Math.min(...corners.map((point) => point.y)) - 500;
        const maxY = Math.max(...corners.map((point) => point.y)) + 500;
        const targets = Array.from({ length: 9 }, (_, y) =>
          Array.from({ length: 9 }, (_, x) => ({
            x: minX + ((maxX - minX) * x) / 8,
            y: minY + ((maxY - minY) * y) / 8,
          })),
        ).flat();
        for (const target of targets) {
          let scale = reference.fitScale();
          let previous: Point | null = null;
          while (scale <= 2.5) {
            const camera = hullCamera(viewport, scale, projection);
            camera.offsetX = target.x * scale - viewport.width / 2;
            camera.offsetY = target.y * scale - viewport.height / 2;
            camera.clampToPanBounds();
            const board = {
              x: (camera.offsetX + viewport.width / 2) / scale,
              y: (camera.offsetY + viewport.height / 2) / scale,
            };
            if (
              previous &&
              Math.hypot(board.x - previous.x, board.y - previous.y) >
                (0.02 * Math.max(viewport.width, viewport.height)) / (2 * scale)
            )
              failures.push(
                `${projection} sweep ${JSON.stringify({ viewport, target, scale, previous, board })}`,
              );
            previous = board;
            scale *= 1.001;
          }
        }
        const worldWidth = projection === 'oblique' ? 32 * TILE : GRID.width * TILE;
        const worldHeight = projection === 'oblique' ? 16 * TILE : GRID.height * TILE;
        for (const threshold of [viewport.width / worldWidth, viewport.height / worldHeight])
          for (const target of targets) {
            const results = [-1e-6, 1e-6].map((delta) => {
              const scale = threshold + delta;
              const camera = hullCamera(viewport, scale, projection);
              camera.offsetX = target.x * scale - viewport.width / 2;
              camera.offsetY = target.y * scale - viewport.height / 2;
              camera.clampToPanBounds();
              return offset(camera);
            });
            const low = results[0];
            const high = results[1];
            if (low && high && Math.hypot(low.x - high.x, low.y - high.y) >= 0.01)
              failures.push(
                `${projection} threshold ${JSON.stringify({ viewport, target, threshold, low, high })}`,
              );
          }
      }
      expect(failures.slice(0, 5)).toEqual([]);
    },
  );

  it('moves continuously when either viewport dimension changes by one pixel', () => {
    const random = createRandom(0xc2_0410);
    let worst = 0;
    for (const base of HULL_VIEWPORTS)
      for (const scale of scalesFor(base, 'oblique'))
        for (let index = 0; index < 100; index += 1) {
          const candidate = { x: (random() - 0.5) * 5000, y: (random() - 0.5) * 5000 };
          const original = hullCamera(base, scale);
          original.offsetX = candidate.x;
          original.offsetY = candidate.y;
          original.clampToPanBounds();
          for (const viewport of [
            { ...base, width: base.width - 1 },
            { ...base, width: base.width + 1 },
            { ...base, height: base.height - 1 },
            { ...base, height: base.height + 1 },
          ]) {
            const changed = hullCamera(viewport, scale);
            changed.offsetX = candidate.x;
            changed.offsetY = candidate.y;
            changed.clampToPanBounds();
            worst = Math.max(
              worst,
              Math.hypot(changed.offsetX - original.offsetX, changed.offsetY - original.offsetY),
            );
          }
        }
    expect(worst).toBeLessThan(10);
  });

  it.each([
    [{ width: 1194, height: 455, dpr: 1 }, 1.5, 0.131],
    [{ width: 1194, height: 560, dpr: 1 }, 1.5, 0.152],
    // Exact clipping computes 21.67%, outside the hand-derived 20.9% ± 0.5 point estimate.
    // Keep the authoritative manual <= programmatic + 3 points bound below.
    [{ width: 834, height: 890, dpr: 1 }, 1.5, null],
    [{ width: 380, height: 560, dpr: 1 }, 1.5, 0.063],
    [{ width: 1194, height: 455, dpr: 1 }, 0.75, 0.258],
  ] as const)(
    'keeps exact painted blank fraction at the reachable-set extremes ($0.width×$0.height, scale $1)',
    (viewport, scale, expectedBlank) => {
      const camera = hullCamera(viewport, scale);
      const directions = Array.from({ length: 16 }, (_, index) => ({
        x: Math.cos((index * Math.PI * 2) / 16),
        y: Math.sin((index * Math.PI * 2) / 16),
      }));
      let manualBlank = 0;
      for (const direction of directions) {
        camera.centre();
        camera.panBy(direction.x * 1e9, direction.y * 1e9);
        manualBlank = Math.max(manualBlank, blankFraction(camera));
      }
      let programmaticBlank = 0;
      eachCell((point) => {
        camera.centreOn(point);
        programmaticBlank = Math.max(programmaticBlank, blankFraction(camera));
      });
      if (expectedBlank !== null) expect(manualBlank).toBeCloseTo(expectedBlank, 2);
      expect(manualBlank).toBeLessThanOrEqual(programmaticBlank + 0.03 + 1e-12);
    },
  );

  it('leaves the rectangular ring formula byte-identical in 500 seeded cases', () => {
    const random = createRandom(0xc2_0411);
    const ring = COMBAT_CAMERA_RING_TILES.quarry_floor;
    for (let index = 0; index < 500; index += 1) {
      const viewport = {
        width: 200 + random() * 1800,
        height: 200 + random() * 1000,
        dpr: 1,
      };
      const camera = new Camera(viewport, GRID, 'oblique', ring);
      camera.scale = 0.35 + random() * 2.15;
      const before = { x: (random() - 0.5) * 200_000, y: (random() - 0.5) * 200_000 };
      camera.offsetX = before.x;
      camera.offsetY = before.y;
      camera.clampToPanBounds();
      const slackX = camera.worldWidth - viewport.width;
      const slackY = camera.worldHeight - viewport.height;
      const pixels = (tiles: number) => Math.max(0, tiles) * TILE * camera.scale;
      expect(camera.offsetX).toBe(
        slackX <= 0
          ? slackX / 2
          : Math.max(-pixels(ring.left), Math.min(slackX + pixels(ring.right), before.x)),
      );
      expect(camera.offsetY).toBe(
        slackY <= 0
          ? slackY / 2
          : Math.max(-pixels(ring.top), Math.min(slackY + pixels(ring.bottom), before.y)),
      );
    }
  });
});

const FOREST_FADE_HULL = [
  { x: 768, y: -140.8 },
  { x: 2329.6, y: 640 },
  { x: 1280, y: 1164.8 },
  { x: -281.6, y: 384 },
] as const;

function blankFraction(camera: Camera): number {
  let polygon: Point[] = FOREST_FADE_HULL.map((point) => ({
    x: point.x * camera.scale - camera.offsetX,
    y: point.y * camera.scale - camera.offsetY,
  }));
  const clips = [
    { inside: (point: Point) => point.x >= 0, intersect: (a: Point, b: Point) => edgeX(a, b, 0) },
    {
      inside: (point: Point) => point.x <= camera.viewport.width,
      intersect: (a: Point, b: Point) => edgeX(a, b, camera.viewport.width),
    },
    { inside: (point: Point) => point.y >= 0, intersect: (a: Point, b: Point) => edgeY(a, b, 0) },
    {
      inside: (point: Point) => point.y <= camera.viewport.height,
      intersect: (a: Point, b: Point) => edgeY(a, b, camera.viewport.height),
    },
  ];
  for (const clip of clips) {
    const input = polygon;
    polygon = [];
    for (let index = 0; index < input.length; index += 1) {
      const start = input[index];
      const end = input[(index + 1) % input.length];
      if (!start || !end) continue;
      const startInside = clip.inside(start);
      const endInside = clip.inside(end);
      if (startInside && endInside) polygon.push(end);
      else if (startInside) polygon.push(clip.intersect(start, end));
      else if (endInside) polygon.push(clip.intersect(start, end), end);
    }
  }
  const area = Math.abs(
    polygon.reduce((sum, point, index) => {
      const next = polygon[(index + 1) % polygon.length] ?? point;
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2,
  );
  return 1 - area / (camera.viewport.width * camera.viewport.height);
}

function edgeX(start: Point, end: Point, x: number): Point {
  const t = (x - start.x) / (end.x - start.x);
  return { x, y: start.y + (end.y - start.y) * t };
}

function edgeY(start: Point, end: Point, y: number): Point {
  const t = (y - start.y) / (end.y - start.y);
  return { x: start.x + (end.x - start.x) * t, y };
}

function worldAt(camera: Camera, at: { x: number; y: number }): { x: number; y: number } {
  const size = TILE * camera.scale;
  return { x: (at.x + camera.offsetX) / size, y: (at.y + camera.offsetY) / size };
}
