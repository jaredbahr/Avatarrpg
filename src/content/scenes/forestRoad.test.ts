import { expect, it } from 'vitest';
import { FOREST_ROAD } from '../maps/combat';
import {
  FOREST_PINE_CELLS,
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
  expect(FOREST_RUBBLE_CELLS).toEqual(cells('r'));
  expect(FOREST_PINE_CELLS).toEqual(cells('T'));
  expect(FOREST_ROAD.legend.r).toMatchObject({ cover: true, surface: 'rubble' });
  expect(FOREST_ROAD.legend.r?.blocked).not.toBe(true);
  expect(FOREST_ROAD.legend['^']).toMatchObject({ elevation: 1 });
  expect(FOREST_ROAD.legend['^']?.blocked).not.toBe(true);
});

it('keeps pine tips inside the agreed top bleed and all feet on projected cell centers', () => {
  for (const tree of FOREST_ROAD_SCENE.scenery) {
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
