import { describe, expect, it } from 'vitest';
import { buildGrid } from '../core/rules/grid';
import { BA_DAN_VILLAGE } from '../content/maps/village';
import { Camera, TILE } from './camera';
import type { Viewport } from './camera';

const map = BA_DAN_VILLAGE;
const extent = map.scene?.paintExtent;
if (!extent) throw new Error('Ba Dan declares no paint extent');

/** Phone and tablet both ways, laptop, desktop, a wide monitor and a tall one (CSS px of the map box). */
const VIEWPORTS: Viewport[] = [
  { width: 390, height: 600, dpr: 3 },
  { width: 844, height: 360, dpr: 3 },
  { width: 820, height: 1000, dpr: 2 },
  { width: 1180, height: 700, dpr: 2 },
  { width: 1368, height: 714, dpr: 1 },
  { width: 1920, height: 960, dpr: 1 },
  { width: 2560, height: 1200, dpr: 1 },
  { width: 1000, height: 1800, dpr: 1 },
];
const ZOOMS = [0, 0.5, 1, 1.5, 2.5];
const DIRECTIONS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;

function villageCamera(viewport: Viewport, withExtent = true): Camera {
  const camera = new Camera(viewport, map, 'oblique');
  camera.centreMargin = map.cameraCentreMargin;
  if (withExtent) camera.viewExtent = extent;
  camera.fitExplore(96);
  return camera;
}

/** Zoom to `scale` (0 = as far out as allowed), anchored on the view centre. */
function zoomTo(camera: Camera, scale: number): void {
  const at = { x: camera.viewport.width / 2, y: camera.viewport.height / 2 };
  if (scale === 0) camera.zoomAt(at, 1e-6);
  else camera.zoomAt(at, scale / camera.scale);
}

function expectInside(camera: Camera): void {
  const { scale, offsetX, offsetY, viewport } = camera;
  const eps = 1e-6;
  expect(offsetX).toBeGreaterThanOrEqual(extent!.x * scale - eps);
  expect(offsetY).toBeGreaterThanOrEqual(extent!.y * scale - eps);
  expect(offsetX + viewport.width).toBeLessThanOrEqual((extent!.x + extent!.width) * scale + eps);
  expect(offsetY + viewport.height).toBeLessThanOrEqual((extent!.y + extent!.height) * scale + eps);
}

describe('Camera.viewExtent on Ba Dan', () => {
  it('is the painting: 3000 x 1600.67 world px from (-200, -100)', () => {
    expect(extent).toEqual({ x: -200, y: -100, width: 3000, height: 2401 / 1.5 });
  });

  it.each(VIEWPORTS)('never shows past the painting at $width x $height', (viewport) => {
    for (const zoom of ZOOMS) {
      for (const [dx, dy] of DIRECTIONS) {
        const camera = villageCamera(viewport);
        expectInside(camera);
        zoomTo(camera, zoom);
        camera.panBy(dx * 1e6, dy * 1e6);
        expectInside(camera);
        // every gesture and refit path ends on the same bounds
        camera.zoomAt({ x: viewport.width / 3, y: viewport.height / 4 }, 0.9);
        camera.clamp();
        expectInside(camera);
        camera.centreOn({ x: 0, y: 0 });
        expectInside(camera);
        camera.centreOn({ x: 23, y: 15 });
        expectInside(camera);
      }
    }
  });

  it('survives a resize (rotating a tablet) by zooming in rather than showing the margin', () => {
    const camera = villageCamera({ width: 390, height: 600, dpr: 1 });
    zoomTo(camera, 0);
    camera.viewport = { width: 1000, height: 1800, dpr: 1 };
    camera.clamp();
    expectInside(camera);
    expect(camera.scale).toBeGreaterThanOrEqual(camera.minExtentScale);
  });

  it('brings every walkable tile fully on screen, and hides no figure the old bounds showed', () => {
    const grid = buildGrid(map);
    const walkable = grid.tiles.flatMap((tile, i) =>
      tile.blocked ? [] : [{ x: i % grid.width, y: Math.floor(i / grid.width) }],
    );
    expect(walkable.length).toBeGreaterThan(200);
    const onScreen = (camera: Camera, points: { x: number; y: number }[]) =>
      points.every(
        (p) =>
          p.x >= -1e-6 &&
          p.y >= -1e-6 &&
          p.x <= camera.viewport.width + 1e-6 &&
          p.y <= camera.viewport.height + 1e-6,
      );
    for (const viewport of VIEWPORTS) {
      for (const zoom of ZOOMS) {
        const bounded = villageCamera(viewport);
        const before = villageCamera(viewport, false);
        zoomTo(bounded, zoom);
        zoomTo(before, zoom);
        for (const pos of walkable) {
          const where = `${viewport.width}x${viewport.height} zoom ${bounded.scale} tile ${pos.x},${pos.y}`;
          const shows = (camera: Camera) => {
            camera.centreOn(pos);
            const corners = [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
            ].map(([cx, cy]) => camera.project({ x: pos.x + cx!, y: pos.y + cy! }));
            const foot = camera.project({ x: pos.x + 0.5, y: pos.y + 0.5 });
            // a figure reaches 48 world px either side of its foot, 120 up and 8 down
            const figure = [
              { x: foot.x - 48 * camera.scale, y: foot.y - 120 * camera.scale },
              { x: foot.x + 48 * camera.scale, y: foot.y + 8 * camera.scale },
            ];
            return { tile: onScreen(camera, corners), figure: onScreen(camera, figure) };
          };
          const now = shows(bounded);
          const was = shows(before);
          expect(now.tile, where).toBe(true);
          // the painted-extent bound must not hide a figure the centre-margin bound alone showed
          if (was.figure) expect(now.figure, where).toBe(true);
        }
      }
    }
  });

  it('reaches the east, south and west exits', () => {
    const exits = [
      { x: 23, y: 7 },
      { x: 23, y: 8 },
      { x: 18, y: 15 },
      { x: 19, y: 15 },
      { x: 20, y: 15 },
      { x: 0, y: 6 },
      { x: 0, y: 7 },
      { x: 0, y: 8 },
    ];
    const grid = buildGrid(map);
    for (const viewport of VIEWPORTS) {
      const camera = villageCamera(viewport);
      for (const pos of exits) {
        if (grid.tiles[pos.y * grid.width + pos.x]?.blocked) continue;
        camera.centreOn(pos);
        const foot = camera.project({ x: pos.x + 0.5, y: pos.y + 0.5 });
        expect(foot.x).toBeGreaterThan(0);
        expect(foot.x).toBeLessThan(viewport.width);
        expect(foot.y).toBeGreaterThan(0);
        expect(foot.y).toBeLessThan(viewport.height);
      }
    }
  });

  it('keeps hit-testing exact after a clamp', () => {
    const camera = villageCamera(VIEWPORTS[4]!);
    camera.panBy(1e6, 1e6);
    for (const pos of [
      { x: 2, y: 3 },
      { x: 12, y: 8 },
    ]) {
      const p = camera.project({ x: pos.x + 0.5, y: pos.y + 0.5 });
      expect(camera.toTile(p.x, p.y)).toEqual(pos);
      expect(camera.unproject(p).x).toBeCloseTo(pos.x + 0.5, 6);
      expect(camera.unproject(p).y).toBeCloseTo(pos.y + 0.5, 6);
    }
  });
});

describe('a scene without an extent keeps its bounds', () => {
  it('still reaches the 1368 x 714 numbers measured before (x -378, y -199 at 1.5)', () => {
    const camera = villageCamera({ width: 1368, height: 714, dpr: 1 }, false);
    expect(camera.minExtentScale).toBe(0);
    expect(camera.scale).toBe(1.5);
    const reach = { left: Infinity, top: Infinity };
    for (const [dx, dy] of DIRECTIONS) {
      camera.panBy(dx * 1e6, dy * 1e6);
      reach.left = Math.min(reach.left, camera.offsetX / camera.scale);
      reach.top = Math.min(reach.top, camera.offsetY / camera.scale);
    }
    expect(reach.left).toBeCloseTo(-378, 0);
    expect(reach.top).toBeCloseTo(-199, 0);
  });

  it('does not change the combat camera', () => {
    const viewport = { width: 1344, height: 640, dpr: 1 };
    const camera = new Camera(viewport, { width: 20, height: 12 });
    camera.fit();
    expect(camera.viewExtent).toBeUndefined();
    expect(camera.scale).toBeCloseTo((640 - 24) / (12 * TILE), 9);
  });
});
