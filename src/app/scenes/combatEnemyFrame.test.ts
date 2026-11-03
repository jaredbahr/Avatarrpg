import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../core/types';
import { buildGrid } from '../../core/rules/grid';
import { COMBAT_CAMERA_RING_TILES, FOREST_ROAD, QUARRY_FLOOR } from '../../content/maps/combat';
import { Camera, type Viewport } from '../../render/camera';
import { actorBodyBounds } from '../../render/geometry/actorSilhouette';
import { liftAlong, liftAt } from '../../render/geometry/elevation';
import { enemyScale } from '../anim/actorScale';
import { frameEnemyTargets, type EnemyFrameActor, type EnemyFrameProp } from './combatEnemyFrame';

const FOREST_ENEMIES: readonly EnemyFrameActor[] = [
  { pos: { x: 17, y: 5 }, size: 1, scale: 1.25, headroom: 0.4, lift: 0 },
  { pos: { x: 17, y: 7 }, size: 1, scale: 1.25, headroom: 0.4, lift: 0 },
  { pos: { x: 18, y: 3 }, size: 1, scale: 1, headroom: 0.4, lift: 0.25 },
];
const FOREST_GRID = buildGrid(FOREST_ROAD);
const FOREST_PROPS: readonly EnemyFrameProp[] = FOREST_ROAD.props.map((prop) => ({
  pos: prop.pos,
  lift: liftAt(FOREST_GRID, prop.pos, 'oblique'),
}));

const FOREST_TARGETS: readonly Vec2[] = [
  // The authored forest enemies and all four live props, including the oil flask.
  ...FOREST_ENEMIES.map((enemy) => enemy.pos),
  ...FOREST_ROAD.props.map((prop) => prop.pos),
];

function forestCamera(viewport: Viewport): Camera {
  const camera = new Camera(viewport, FOREST_ROAD, 'oblique');
  camera.integerZoom = true;
  camera.clampToProgrammaticReachableSet = true;
  camera.fitExplore(96, 12, 'floor');
  camera.centreOn({ x: 3, y: 4 });
  return camera;
}

function projectedCorners(camera: Camera, cells: readonly Vec2[]) {
  return cells.flatMap((cell) =>
    [
      cell,
      { x: cell.x + 1, y: cell.y },
      { x: cell.x + 1, y: cell.y + 1 },
      { x: cell.x, y: cell.y + 1 },
    ].map((corner) => camera.project(corner)),
  );
}

function uprightBounds(camera: Camera, enemy: EnemyFrameActor) {
  const box = camera.spriteBox(enemy.pos, enemy.size);
  box.y -= enemy.lift * box.size;
  return actorBodyBounds(
    { ...box, width: box.size * enemy.size },
    enemy.size,
    enemy.headroom,
    enemy.scale,
  );
}

function propBounds(camera: Camera, prop: EnemyFrameProp) {
  const box = camera.spriteBox(prop.pos);
  const y = box.y - prop.lift * box.size;
  return { left: box.x, top: y, right: box.x + box.size, bottom: y + box.size };
}

function expectTargetsVisible(
  camera: Camera,
  cells: readonly Vec2[],
  enemies: readonly EnemyFrameActor[] = [],
  props: readonly EnemyFrameProp[] = [],
  whole = true,
): void {
  const tolerance = 0.5 / camera.viewport.dpr;
  for (const point of projectedCorners(camera, cells)) {
    expect(point.x).toBeGreaterThanOrEqual(-tolerance);
    expect(point.y).toBeGreaterThanOrEqual(-tolerance);
    expect(point.x).toBeLessThanOrEqual(camera.viewport.width + tolerance);
    expect(point.y).toBeLessThanOrEqual(camera.viewport.height + tolerance);
  }
  for (const enemy of enemies) {
    const body = uprightBounds(camera, enemy);
    expect(body.left).toBeGreaterThanOrEqual(-tolerance);
    expect(body.top).toBeGreaterThanOrEqual(-tolerance);
    expect(body.right).toBeLessThanOrEqual(camera.viewport.width + tolerance);
    expect(body.bottom).toBeLessThanOrEqual(camera.viewport.height + tolerance);
  }
  for (const prop of props) {
    const bounds = propBounds(camera, prop);
    expect(bounds.left).toBeGreaterThanOrEqual(-tolerance);
    expect(bounds.top).toBeGreaterThanOrEqual(-tolerance);
    expect(bounds.right).toBeLessThanOrEqual(camera.viewport.width + tolerance);
    expect(bounds.bottom).toBeLessThanOrEqual(camera.viewport.height + tolerance);
  }
  expect(camera.onWholeDevicePixels).toBe(whole);
  expect(camera.offsetX * camera.viewport.dpr).toBeCloseTo(
    Math.round(camera.offsetX * camera.viewport.dpr),
    9,
  );
  expect(camera.offsetY * camera.viewport.dpr).toBeCloseTo(
    Math.round(camera.offsetY * camera.viewport.dpr),
    9,
  );
}

function frame(camera: Camera) {
  return [camera.scale, camera.offsetX, camera.offsetY];
}

describe('enemy and prop camera framing', () => {
  it.each([
    { name: '1280 by 800 desktop with its dock', width: 1280, height: 450, dpr: 1 },
    { name: 'iPad portrait with its dock', width: 820, height: 600, dpr: 2 },
  ])('shows the complete forest target tiles on $name', (viewport) => {
    const camera = forestCamera(viewport);

    expect(frameEnemyTargets(camera, FOREST_TARGETS, FOREST_ENEMIES, FOREST_PROPS)).toBe(true);

    expectTargetsVisible(camera, FOREST_TARGETS, FOREST_ENEMIES, FOREST_PROPS);
    // The next whole stop cannot fit this envelope, regardless of its pan.
    const points = projectedCorners(camera, FOREST_TARGETS);
    const spanX =
      Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x));
    const spanY =
      Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y));
    const nextRatio = (camera.scale + 1 / viewport.dpr) / camera.scale;
    expect(spanX * nextRatio > viewport.width || spanY * nextRatio > viewport.height).toBe(true);
  });

  it('includes every cell of a large enemy footprint', () => {
    const camera = forestCamera({ width: 820, height: 600, dpr: 2 });
    const cells = [
      ...FOREST_TARGETS,
      { x: 18, y: 3 },
      { x: 19, y: 3 },
      { x: 18, y: 4 },
      { x: 19, y: 4 },
    ];

    const enemies = [
      ...FOREST_ENEMIES,
      { pos: { x: 18, y: 3 }, size: 2 as const, scale: 2, headroom: 0.4, lift: 0.25 },
    ];

    expect(frameEnemyTargets(camera, cells, enemies, FOREST_PROPS)).toBe(true);
    expectTargetsVisible(camera, cells, enemies, FOREST_PROPS);
  });

  it('includes upright heads and lift after the forest enemies spread apart', () => {
    const viewport = { width: 1280, height: 450, dpr: 1 };
    const camera = forestCamera(viewport);
    const tileOnlyCamera = forestCamera(viewport);
    const enemies: readonly EnemyFrameActor[] = [
      { pos: { x: 6, y: 6 }, size: 1, scale: 1.25, headroom: 0.4, lift: 0.25 },
      { pos: { x: 17, y: 7 }, size: 1, scale: 1.25, headroom: 0.4, lift: 0 },
    ];
    const cells = [
      ...enemies.map((enemy) => enemy.pos),
      ...FOREST_ROAD.props.map((prop) => prop.pos),
    ];

    expect(frameEnemyTargets(tileOnlyCamera, cells)).toBe(true);
    expect(enemies.some((enemy) => uprightBounds(tileOnlyCamera, enemy).top < 0)).toBe(true);
    expect(frameEnemyTargets(camera, cells, enemies, FOREST_PROPS)).toBe(true);

    expect(camera.scale).toBeLessThan(tileOnlyCamera.scale);
    expect(camera.deviceScale).toBeLessThan(1);
    expectTargetsVisible(camera, cells, enemies, FOREST_PROPS, false);
  });

  it('uses the existing overview when no whole stop fits a narrow DPR 1 canvas', () => {
    const camera = forestCamera({ width: 390, height: 600, dpr: 1 });

    expect(frameEnemyTargets(camera, FOREST_TARGETS, FOREST_ENEMIES, FOREST_PROPS)).toBe(true);

    expect(camera.deviceScale).toBeLessThan(1);
    expectTargetsVisible(camera, FOREST_TARGETS, FOREST_ENEMIES, FOREST_PROPS, false);
    const first = frame(camera);
    expect(frameEnemyTargets(camera, FOREST_TARGETS, FOREST_ENEMIES, FOREST_PROPS)).toBe(true);
    expect(frame(camera)).toEqual(first);
  });

  it('shows full quarry prop caches when only the quarry bender is left', () => {
    const viewport = { width: 1280, height: 450, dpr: 1 };
    const grid = buildGrid(QUARRY_FLOOR);
    const makeCamera = () => {
      const camera = new Camera(
        viewport,
        QUARRY_FLOOR,
        'oblique',
        COMBAT_CAMERA_RING_TILES.quarry_floor,
      );
      camera.integerZoom = true;
      camera.fitExplore(96, 12, 'floor');
      return camera;
    };
    const camera = makeCamera();
    const groundOnlyCamera = makeCamera();
    const pos = { x: 17, y: 8 };
    const enemies: readonly EnemyFrameActor[] = [
      {
        pos,
        size: 1,
        scale: enemyScale('unit.enemy.quarrybender', 1, 'oblique'),
        headroom: null,
        lift: liftAlong(grid, pos, 'oblique'),
      },
    ];
    const props: readonly EnemyFrameProp[] = QUARRY_FLOOR.props.map((prop) => ({
      pos: prop.pos,
      lift: liftAt(grid, prop.pos, 'oblique'),
    }));
    const cells = [pos, ...props.map((prop) => prop.pos)];
    const brazier = props.find((prop) => prop.pos.x === 10 && prop.pos.y === 3);
    if (!brazier) throw new Error('Quarry Floor has no brazier at 10,3');

    expect(frameEnemyTargets(groundOnlyCamera, cells, enemies)).toBe(true);
    expect(groundOnlyCamera.onWholeDevicePixels).toBe(true);
    expect(propBounds(groundOnlyCamera, brazier).top).toBeCloseTo(-22.04, 2);
    expect(frameEnemyTargets(camera, cells, enemies, props)).toBe(true);

    expect(camera.deviceScale).toBeLessThan(1);
    expectTargetsVisible(camera, cells, enemies, props, false);
  });

  it('includes the lift under a prop cache without reducing a fitting whole stop', () => {
    const viewport = { width: 1280, height: 450, dpr: 1 };
    const camera = forestCamera(viewport);
    const unliftedCamera = forestCamera(viewport);
    const prop = { pos: { x: 10, y: 6 }, lift: 0.5 };
    const cells = [prop.pos];

    expect(frameEnemyTargets(unliftedCamera, cells, [], [{ ...prop, lift: 0 }])).toBe(true);
    expect(propBounds(unliftedCamera, prop).top).toBeLessThan(-0.5);
    expect(frameEnemyTargets(camera, cells, [], [prop])).toBe(true);

    expect(camera.scale).toBe(unliftedCamera.scale);
    expectTargetsVisible(camera, cells, [], [prop]);
  });

  it('respects the existing maximum zoom for a compact target group', () => {
    const camera = forestCamera({ width: 1280, height: 450, dpr: 1 });
    const cells = [{ x: 10, y: 6 }];

    expect(frameEnemyTargets(camera, cells)).toBe(true);
    expectTargetsVisible(camera, cells);
    const scale = camera.scale;
    camera.zoomAt({ x: 640, y: 225 }, 100);

    expect(camera.scale).toBe(scale);
  });

  it('produces the same frame on repeated requests after a partial pinch', () => {
    const camera = forestCamera({ width: 820, height: 600, dpr: 2 });
    camera.zoomAt({ x: 410, y: 300 }, 1.01);

    expect(frameEnemyTargets(camera, FOREST_TARGETS, FOREST_ENEMIES, FOREST_PROPS)).toBe(true);
    const first = frame(camera);
    expect(frameEnemyTargets(camera, FOREST_TARGETS, FOREST_ENEMIES, FOREST_PROPS)).toBe(true);

    expect(frame(camera)).toEqual(first);
    expectTargetsVisible(camera, FOREST_TARGETS, FOREST_ENEMIES, FOREST_PROPS);
  });

  it('leaves an empty target list and its camera untouched', () => {
    const camera = forestCamera({ width: 1280, height: 450, dpr: 1 });
    const before = frame(camera);

    expect(frameEnemyTargets(camera, [])).toBe(false);

    expect(frame(camera)).toEqual(before);
  });

  it('retains the widest legal integer frame when a painted extent makes fitting impossible', () => {
    const viewport = { width: 80, height: 80, dpr: 1 };
    const camera = forestCamera(viewport);
    camera.viewExtent = { x: 0, y: 0, width: 80, height: 80 };
    const cells = [
      { x: 0, y: 0 },
      { x: 19, y: 11 },
    ];

    expect(frameEnemyTargets(camera, cells)).toBe(false);

    expect(camera.onWholeDevicePixels).toBe(true);
    expect(camera.scale).toBe(camera.minExtentScale);
    const before = frame(camera);
    expect(frameEnemyTargets(camera, cells)).toBe(false);
    expect(frame(camera)).toEqual(before);
  });

  it('widens to the overview when a visible tile centre has clipped oblique corners', () => {
    const camera = forestCamera({ width: 100, height: 100, dpr: 1 });
    const cells = [{ x: 10, y: 6 }];
    camera.centreOn({ x: 10, y: 6 });

    const centre = camera.project({ x: 10.5, y: 6.5 });
    expect(centre.x).toBeGreaterThanOrEqual(0);
    expect(centre.x).toBeLessThanOrEqual(100);
    expect(centre.y).toBeGreaterThanOrEqual(0);
    expect(centre.y).toBeLessThanOrEqual(100);
    expect(projectedCorners(camera, cells).some((point) => point.x < 0 || point.x > 100)).toBe(
      true,
    );

    expect(frameEnemyTargets(camera, cells)).toBe(true);

    expectTargetsVisible(camera, cells, [], [], false);
  });
});
