import { expect, it } from 'vitest';
import { FOREST_ROAD } from '../maps/combat';
import {
  FOREST_ALDER_CELLS,
  FOREST_CREEK_POOLS,
  FOREST_DEADFALL,
  FOREST_LODGE,
  FOREST_LODGE_CELLS,
  FOREST_PERCH_CELLS,
  FOREST_PINE_CELLS,
  FOREST_THICKET_CELLS,
  FOREST_RAISED_SHELF,
  FOREST_RAISED_SHELF_CELLS,
  FOREST_BANK_NEST_REEDS,
  FOREST_CREEK_REEDS,
  FOREST_POND_REEDS,
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
  // The painted shelf is exactly the rules' raised cells: every tier-1 cell of
  // the NE bank and the shoulder, and (19,2)'s tier-2 perch standing on it. A
  // raised cell it missed would fall back to the relief painter's bare slab.
  expect(FOREST_RAISED_SHELF_CELLS).toEqual(cells('^'));
  expect(FOREST_PERCH_CELLS).toEqual(cells('A'));
  expect(cells('A')).toEqual([{ x: 19, y: 2 }]);
  expect(FOREST_ROAD.legend[FOREST_ROAD.rows[2]?.[19] ?? '']?.elevation).toBe(2);
  expect(FOREST_RAISED_SHELF_CELLS).not.toContainEqual({ x: 19, y: 4 });
  expect(FOREST_ROAD_SCENE.ground).toContainEqual({
    url: 'art/maps/forest-scene/raised-shelf.webp',
    ...FOREST_RAISED_SHELF,
  });
  expect(FOREST_RUBBLE_CELLS).toEqual(cells('r'));
  // Every blocked tree cell is visibly something: a pine, an alder or the
  // keeper's lodge, and no cell is two of them.
  const standing = [...FOREST_PINE_CELLS, ...FOREST_ALDER_CELLS, ...FOREST_LODGE_CELLS];
  const byKey = (list: readonly { x: number; y: number }[]) =>
    list.map(({ x, y }) => `${x},${y}`).sort();
  expect(byKey(standing)).toEqual(byKey(cells('T')));
  expect(new Set(byKey(standing)).size).toBe(standing.length);
  expect(FOREST_LODGE.footprint).toEqual(FOREST_LODGE_CELLS);
  // Exterior trees stand past the rim, never on the board.
  for (const cell of FOREST_THICKET_CELLS)
    expect(FOREST_ROAD.rows[cell.y]?.[cell.x], `${cell.x},${cell.y}`).toBeUndefined();
  // The creek's pools are exactly the deep-water cells, and the deadfall lies in one.
  expect(byKey(FOREST_CREEK_POOLS.flatMap((pool) => pool.cells))).toEqual(byKey(cells('W')));
  expect(cells('W')).toContainEqual(FOREST_DEADFALL.footprint[0]);
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

it('registers the varied pond and creek reeds on the existing bank cells', () => {
  const placement = (reed: (typeof FOREST_POND_REEDS)[number]) => ({
    url: reed.url,
    height: reed.height,
    footprint: reed.footprint,
  });
  expect(FOREST_POND_REEDS.map(placement)).toEqual([
    {
      url: 'art/maps/forest-scene/bank-reed-0.webp',
      height: 48,
      footprint: [{ x: 4, y: 5 }],
    },
    {
      url: 'art/maps/forest-scene/bank-reed-1.webp',
      height: 20,
      footprint: [{ x: 7, y: 7 }],
    },
    {
      url: 'art/maps/forest-scene/bank-reed-3.webp',
      height: 36,
      footprint: [{ x: 5, y: 8 }],
    },
  ]);
  expect(FOREST_CREEK_REEDS.map(placement)).toEqual([
    {
      url: 'art/maps/forest-scene/bank-reed-2.webp',
      height: 30,
      footprint: [{ x: 3, y: 10 }],
    },
    {
      url: 'art/maps/forest-scene/bank-reed-1.webp',
      height: 20,
      footprint: [{ x: 13, y: 10 }],
    },
  ]);
});
