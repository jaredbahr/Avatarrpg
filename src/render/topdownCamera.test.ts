/**
 * The top-down projection's camera (ADR 0104, phase T1): an identity ground
 * transform at 40 world px a tile, flat picking, and integer zoom that never
 * puts a tile under a fingertip (N >= dpr device px per world px).
 */
import { describe, expect, it } from 'vitest';
import { buildGrid } from '../core/rules/grid';
import { mapSchema } from '../content/schemas';
import { FOREST_ROAD } from '../content/maps/combat';
import { Camera, MIN_TILE_PX, TILE, isWholeScale } from './camera';
import { TOPDOWN_FIXTURE as FIXTURE } from './topdown.fixture';
import type { Viewport } from './camera';
import { liftAlong, liftAt, pickCell } from './geometry/elevation';
import {
  TOPDOWN_TILE,
  exploreTilePx,
  groundBounds,
  projectGround,
  tileSize,
  unprojectGround,
  usesIntegerZoom,
} from './projection';

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

/** The boards the port meets: a fight, the village, and one far larger than any screen. */
const BOARDS = [
  { name: 'fight 20x12', width: 20, height: 12 },
  { name: 'village 24x16', width: 24, height: 16 },
  { name: 'wide 60x40', width: 60, height: 40 },
] as const;

function onDeviceGrid(value: number, dpr: number): boolean {
  return Math.abs(value * dpr - Math.round(value * dpr)) < 1e-9;
}

/** Whole device px per world px, on the device-pixel grid, and N >= dpr so a tile is a fingertip. */
function expectTappableAndSettled(camera: Camera, label: string): void {
  const { dpr } = camera.viewport;
  expect(isWholeScale(camera.deviceScale), `${label}: device scale ${camera.deviceScale}`).toBe(
    true,
  );
  expect(camera.deviceScale, `${label}: N >= dpr`).toBeGreaterThanOrEqual(dpr - 1e-9);
  expect(camera.tile * camera.scale, `${label}: tile CSS px`).toBeGreaterThanOrEqual(
    MIN_TILE_PX - 1e-9,
  );
  expect(onDeviceGrid(camera.offsetX, dpr), `${label}: offsetX ${camera.offsetX}`).toBe(true);
  expect(onDeviceGrid(camera.offsetY, dpr), `${label}: offsetY ${camera.offsetY}`).toBe(true);
}

function topdown(viewport: Viewport, grid: { width: number; height: number }): Camera {
  const camera = new Camera(viewport, grid, 'topdown');
  camera.integerZoom = usesIntegerZoom('topdown');
  return camera;
}

describe('top-down ground contract', () => {
  it('is the identity ground transform at 40 world px a tile, leaving the others at 64', () => {
    expect(TOPDOWN_TILE).toBe(40);
    expect(tileSize('topdown')).toBe(40);
    expect(tileSize('oblique')).toBe(TILE);
    expect(tileSize('orthographic')).toBe(TILE);
    expect(usesIntegerZoom('topdown')).toBe(true);
    expect(usesIntegerZoom('oblique')).toBe(true);
    expect(usesIntegerZoom('orthographic')).toBe(false);
    expect(groundBounds(20, 12, 'topdown')).toEqual({ minX: 0, minY: 0, width: 20, height: 12 });
    for (const x of [-1, 0, 0.125, 7.5, 19.999, 20])
      for (const y of [-1, 0, 3.25, 11.5, 12]) {
        expect(projectGround({ x, y }, 'topdown')).toEqual({ x, y });
        expect(unprojectGround(projectGround({ x, y }, 'topdown'), 'topdown')).toEqual({ x, y });
      }
  });

  it('round-trips ground points through the camera at every scale, offset and dpr', () => {
    for (const viewport of VIEWPORTS)
      for (const scale of [1 / viewport.dpr, 1, 2, 3])
        for (const offset of [0, 17, 263.5]) {
          const camera = new Camera(viewport, { width: 20, height: 12 }, 'topdown');
          camera.scale = scale;
          camera.offsetX = offset;
          camera.offsetY = offset / 2;
          for (const x of [0, 0.5, 3.25, 19.75])
            for (const y of [0, 0.5, 6.125, 11.75]) {
              const screen = camera.project({ x, y });
              expect(screen.x).toBeCloseTo(x * 40 * scale - offset, 9);
              expect(screen.y).toBeCloseTo(y * 40 * scale - offset / 2, 9);
              const back = camera.unproject(screen);
              expect(back.x).toBeCloseTo(x, 9);
              expect(back.y).toBeCloseTo(y, 9);
            }
          const box = camera.toScreen({ x: 3, y: 4 });
          const corner = camera.project({ x: 3, y: 4 });
          expect(box.size).toBeCloseTo(40 * scale, 9);
          expect(box.x).toBeCloseTo(corner.x, 9);
          expect(box.y).toBeCloseTo(corner.y, 9);
          expect(camera.worldWidth).toBeCloseTo(20 * 40 * scale, 9);
          expect(camera.worldHeight).toBeCloseTo(12 * 40 * scale, 9);
          expect(camera.groundMatrix()).toEqual({
            a: scale,
            b: 0,
            c: 0,
            d: scale,
            tx: 0 - camera.offsetX,
            ty: 0 - camera.offsetY,
          });
        }
  });

  it('leaves the oblique board on 64 px tiles', () => {
    const camera = new Camera(
      { width: 1000, height: 700, dpr: 1 },
      { width: 24, height: 16 },
      'oblique',
    );
    expect(camera.tile).toBe(64);
    camera.scale = 1;
    expect(camera.toScreen({ x: 0, y: 0 }).size).toBe(64);
  });

  it('lifts nothing and picks the flat cell, raised or not', () => {
    const grid = buildGrid(FIXTURE);
    const camera = new Camera({ width: 1000, height: 700, dpr: 2 }, grid, 'topdown');
    camera.scale = 1.5;
    camera.offsetX = 37;
    camera.offsetY = 11;
    let raised = 0;
    for (let y = 0; y < grid.height; y++)
      for (let x = 0; x < grid.width; x++) {
        const tile = grid.tiles[y * grid.width + x];
        if ((tile?.elevation ?? 0) > 0) {
          raised += 1;
          // The same cell lifts on the oblique board, so the fixture tests what it says.
          if (!tile?.blocked) expect(liftAt(grid, { x, y }, 'oblique')).toBeGreaterThan(0);
        }
        expect(liftAt(grid, { x, y }, 'topdown')).toBe(0);
        expect(liftAlong(grid, { x: x + 0.37, y: y + 0.81 }, 'topdown')).toBe(0);
        for (const fx of [0.001, 0.5, 0.999])
          for (const fy of [0.001, 0.5, 0.999]) {
            expect(pickCell(grid, { x: x + fx, y: y + fy }, 'topdown')).toEqual({ x, y });
            const screen = camera.project({ x: x + fx, y: y + fy });
            expect(camera.pickTile(screen.x, screen.y, grid)).toEqual({ x, y });
          }
      }
    expect(raised).toBeGreaterThan(0);
  });

  it('is a map projection the content schema accepts', () => {
    expect(mapSchema.safeParse({ ...FOREST_ROAD, projection: 'topdown' }).success).toBe(true);
    expect(mapSchema.safeParse({ ...FOREST_ROAD, projection: 'oblique' }).success).toBe(true);
    expect(mapSchema.safeParse({ ...FOREST_ROAD, projection: 'isometric' }).success).toBe(false);
  });
});

describe('top-down integer zoom: N >= dpr', () => {
  it('fits (Recentre) at the largest whole scale that shows the board, never under a fingertip', () => {
    for (const viewport of VIEWPORTS)
      for (const board of BOARDS) {
        const label = `${viewport.name}, ${board.name}`;
        const camera = topdown(viewport, board);
        camera.fit();
        expectTappableAndSettled(camera, label);
        const n = camera.deviceScale;
        const fits = (device: number) =>
          board.width * 40 * (device / viewport.dpr) <= viewport.width - 24 + 1e-9 &&
          board.height * 40 * (device / viewport.dpr) <= viewport.height - 24 + 1e-9;
        const tappable = Math.ceil(viewport.dpr - 1e-9);
        if (fits(tappable)) {
          // The whole board shows: nothing to pan to, and Recentre has nothing to do.
          expect(camera.fitted, label).toBe(true);
          expect(fits(n), label).toBe(true);
          expect(fits(n + 1), label).toBe(false);
        } else {
          // Combat may scroll here (owner's answer 1): the smallest tappable tile, and pan.
          expect(n, label).toBe(tappable);
          expect(camera.fitted, label).toBe(false);
          const before = { x: camera.offsetX, y: camera.offsetY };
          camera.panBy(-200, -150);
          expect(camera.offsetX !== before.x || camera.offsetY !== before.y, `${label}: pans`).toBe(
            true,
          );
          expectTappableAndSettled(camera, `${label}, panned`);
        }
      }
  });

  it('stops a pinch out at N = dpr, with no smoothed overview below it', () => {
    for (const viewport of VIEWPORTS)
      for (const board of BOARDS) {
        const label = `${viewport.name}, ${board.name}`;
        const camera = topdown(viewport, board);
        camera.fitExplore(120);
        expectTappableAndSettled(camera, `${label}, explore`);
        for (let i = 0; i < 12; i++) {
          camera.zoomAt({ x: viewport.width / 3, y: viewport.height / 2 }, 0.7);
          expectTappableAndSettled(camera, `${label}, out ${i}`);
        }
        expect(camera.deviceScale, label).toBeGreaterThanOrEqual(Math.ceil(viewport.dpr - 1e-9));
        for (let i = 0; i < 12; i++) {
          camera.zoomAt({ x: viewport.width / 2, y: viewport.height / 3 }, 1.4);
          expectTappableAndSettled(camera, `${label}, in ${i}`);
        }
      }
  });

  it('holds N >= dpr through a resnap, a raise to fit and a dpr change', () => {
    for (const board of BOARDS) {
      const camera = topdown({ width: 1194, height: 834, dpr: 2 }, board);
      camera.fit();
      // A tween left part way between whole scales, then a phone's 3x screen.
      camera.scale = 1.3;
      camera.viewport = { width: 390, height: 844, dpr: 3 };
      camera.resnap();
      expectTappableAndSettled(camera, `${board.name}, resnap`);
      camera.raiseToFit();
      expectTappableAndSettled(camera, `${board.name}, raise`);
      camera.viewport = { width: 1368, height: 912, dpr: 1.5 };
      camera.fit();
      expectTappableAndSettled(camera, `${board.name}, Surface`);
      expect(camera.deviceScale).toBeGreaterThanOrEqual(2);
    }
  });

  it('opens exploration at N = 3 on a 1x screen (120 px tiles)', () => {
    const camera = topdown({ width: 1368, height: 912, dpr: 1 }, { width: 24, height: 16 });
    camera.fitExplore(120);
    expect(camera.deviceScale).toBe(3);
    expect(camera.tile * camera.scale).toBe(120);
  });

  it('is what exploration asks for on a top-down map, and the oblique and flat asks are unchanged', () => {
    expect(exploreTilePx('topdown')).toBe(120);
    expect(exploreTilePx('oblique')).toBe(96);
    expect(exploreTilePx('orthographic')).toBe(48);
    for (const board of BOARDS) {
      const camera = topdown({ width: 1368, height: 912, dpr: 1 }, board);
      camera.fitExplore(exploreTilePx('topdown'));
      expect(camera.deviceScale, board.name).toBe(3);
    }
    // Other screens still open on whole device px, never under a fingertip.
    for (const viewport of VIEWPORTS) {
      const camera = topdown(viewport, { width: 24, height: 16 });
      camera.fitExplore(exploreTilePx('topdown'));
      expectTappableAndSettled(camera, viewport.name);
    }
  });
});
