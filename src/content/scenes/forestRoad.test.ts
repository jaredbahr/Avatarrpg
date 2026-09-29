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
      wind: true,
    });
  }
  expect(FOREST_ROAD_SCENE.ground.map((piece) => piece.url)).not.toContain(
    'art/maps/forest-scene/water.webp',
  );
  expect(FOREST_WATER_CELLS).toEqual(cells('~'));
  // The painted shelf is the two authored elevated groups, and every cell it
  // paints has to be raised on the map: tier 1, or (19,2)'s tier-2 perch. M3
  // widens the NE bank past these six cells, and the extra tiers are drawn by
  // the relief painter until the shelf plate is repacked, so the plate may only
  // ever under-claim, never paint a cell the rules call flat.
  for (const cell of FOREST_RAISED_SHELF_CELLS) {
    expect(cells('^').concat(cells('A')), `${cell.x},${cell.y} is raised`).toContainEqual(cell);
  }
  expect(cells('A')).toEqual([{ x: 19, y: 2 }]);
  expect(FOREST_ROAD.legend[FOREST_ROAD.rows[2]?.[19] ?? '']?.elevation).toBe(2);
  expect(FOREST_RAISED_SHELF_CELLS).not.toContainEqual({ x: 19, y: 4 });
  expect(FOREST_ROAD_SCENE.ground).toContainEqual({
    url: 'art/maps/forest-scene/raised-shelf.webp',
    ...FOREST_RAISED_SHELF,
  });
  expect(FOREST_RUBBLE_CELLS).toEqual(cells('r'));
  expect(FOREST_PINE_CELLS).toEqual(cells('T'));
  // Cover rides on the live rubble surface, never a permanent tile flag: a
  // converted or cleared cell must stop giving cover.
  expect(FOREST_ROAD.legend.r).toMatchObject({ surface: 'rubble', surfaceDuration: -1 });
  expect(FOREST_ROAD.legend.r?.cover ?? false).toBe(false);
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
