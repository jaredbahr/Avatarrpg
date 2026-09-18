import { expect, it } from 'vitest';
import { QUARRY_GATE } from '../maps/combat';
import { QUARRY_GATE_SCENE, QUARRY_GATE_WALL_CELLS, quarryWallVariant } from './quarryGate';

it('uses exactly the existing 32 blocked wall cells and keeps their projected feet/depth aligned', () => {
  const cells = QUARRY_GATE.rows.flatMap((row, y) =>
    [...row].flatMap((key, x) => (key === '#' ? [{ x, y }] : [])),
  );
  expect(QUARRY_GATE_WALL_CELLS).toEqual(cells);
  expect(QUARRY_GATE_SCENE.scenery).toHaveLength(32);
  expect(QUARRY_GATE.legend['#']).toMatchObject({ blocked: true, blocksSight: true });
  for (const wall of QUARRY_GATE_SCENE.scenery) {
    expect(wall.footprint).toHaveLength(1);
    const cell = wall.footprint[0];
    if (!cell) throw new Error('Missing wall footprint');
    expect([wall.width, wall.height]).toEqual([128, 176]);
    expect(wall.x + 64).toBe(768 + (cell.x - cell.y) * 64);
    expect(wall.y + 144).toBe((cell.x + cell.y + 1) * 32);
    expect((wall.depth.x + wall.depth.y) * 32).toBe(wall.y + 144);
    expect(wall.fadeWhenOccluding).toBe(true);
  }
  expect(QUARRY_GATE.legend['^']?.blocked).not.toBe(true);
  expect(QUARRY_GATE.legend.c).toMatchObject({ terrain: 'wood', cover: true });
  expect(QUARRY_GATE.legend.c?.blocked).not.toBe(true);
});

it('selects bonded interiors, exposed ends and corners from actual cardinal wall adjacency', () => {
  expect(quarryWallVariant({ x: 5, y: 0 })).toBe('interior');
  expect(quarryWallVariant({ x: 4, y: 0 })).toBe('corner');
  expect(quarryWallVariant({ x: 4, y: 1 })).toBe('end');
  expect(quarryWallVariant({ x: 17, y: 10 })).toBe('end');
  expect(quarryWallVariant({ x: 17, y: 11 })).toBe('corner');
});
