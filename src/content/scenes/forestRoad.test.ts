import { expect, it } from 'vitest';
import { FOREST_ROAD } from '../maps/combat';
import {
  FOREST_PINE_CELLS,
  FOREST_RAISED_SHELF,
  FOREST_RAISED_SHELF_CELLS,
  FOREST_BANK_NEST_REEDS,
  FOREST_ROAD_SCENE,
  FOREST_RUBBLE_CELLS,
  FOREST_WATER_CELLS,
} from './forestRoad';
import { FOREST_GRASS_REGIONS } from './forestRoadGround';

const cells = (key: string) =>
  FOREST_ROAD.rows.flatMap((row, y) =>
    [...row].flatMap((value, x) => (value === key ? [{ x, y }] : [])),
  );

it('registers forest art only to the existing water, cover and blocked tree cells', () => {
  expect(FOREST_ROAD_SCENE.groundMode).toBe('partial');
  expect(FOREST_ROAD_SCENE.ground.map((piece) => piece.url)).toContain(
    'art/maps/forest-scene/route-ground.webp',
  );
  for (const [name, region] of Object.entries(FOREST_GRASS_REGIONS)) {
    expect(FOREST_ROAD_SCENE.ground).toContainEqual({
      url: `art/maps/forest-scene/grass-${name}.webp`,
      ...region,
    });
  }
  expect(FOREST_ROAD_SCENE.ground.map((piece) => piece.url)).not.toContain(
    'art/maps/forest-scene/water.webp',
  );
  expect(FOREST_WATER_CELLS).toEqual(cells('~'));
  expect(FOREST_RAISED_SHELF_CELLS).toEqual(cells('^'));
  expect(FOREST_RAISED_SHELF_CELLS).not.toContainEqual({ x: 19, y: 4 });
  expect(FOREST_ROAD_SCENE.ground).toContainEqual({
    url: 'art/maps/forest-scene/raised-shelf.webp',
    ...FOREST_RAISED_SHELF,
  });
  expect(FOREST_RUBBLE_CELLS).toEqual(cells('r'));
  expect(FOREST_PINE_CELLS).toEqual(cells('T'));
  expect(FOREST_ROAD.legend.r).toMatchObject({ cover: true, surface: 'rubble' });
  expect(FOREST_ROAD.legend.r?.blocked).not.toBe(true);
  expect(FOREST_ROAD.legend['^']).toMatchObject({ elevation: 1 });
  expect(FOREST_ROAD.legend['^']?.blocked).not.toBe(true);
});

it('keeps pine tips inside the agreed top bleed and all feet on projected cell centers', () => {
  for (const tree of FOREST_ROAD_SCENE.scenery.filter(({ id }) => id.startsWith('forest-pine-'))) {
    const cell = tree.footprint[0];
    if (!cell) throw new Error('Tree has no footprint');
    expect(tree.width).toBeLessThanOrEqual(144);
    expect(tree.height).toBeLessThanOrEqual(224);
    expect(tree.y).toBeGreaterThanOrEqual(-192);
    expect(tree.x + tree.width * 0.51).toBeCloseTo(768 + (cell.x - cell.y) * 64);
    expect(tree.y + tree.height * 0.99).toBeCloseTo((cell.x + cell.y + 1) * 32);
    expect((tree.depth.x + tree.depth.y) * 32).toBeCloseTo(tree.y + tree.height * 0.99);
  }
});

it('registers the passable flood-bank nest reeds at their authored depth', () => {
  expect(FOREST_BANK_NEST_REEDS).toMatchObject({
    id: 'forest-bank-nest-reeds',
    url: 'art/maps/forest-scene/old-nest-reeds.webp',
    x: 516,
    y: 454,
    width: 120,
    height: 58,
    footprint: [{ x: 6, y: 9 }],
    depth: { x: 6.1, y: 9.08 },
  });
  expect(FOREST_ROAD.rows[9]?.[6]).toBe(',');
  expect(FOREST_BANK_NEST_REEDS.fadeWhenOccluding).toBeUndefined();
  expect(FOREST_BANK_NEST_REEDS.wall).toBeUndefined();
  expect(FOREST_ROAD_SCENE.scenery).toContainEqual(FOREST_BANK_NEST_REEDS);
});
