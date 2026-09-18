import { expect, it } from 'vitest';
import { QUARRY_GATE } from '../maps/combat';
import { QUARRY_GATE_SCENE, QUARRY_GATE_WALL_CELLS, quarryWallVariant } from './quarryGate';
import { QUARRY_WEST_FRAMES } from './quarryWestFrames';

it('centers four low cover decals on the actual passable cover cells', () => {
  const cells = QUARRY_GATE.rows.flatMap((row, y) =>
    [...row].flatMap((key, x) => (key === 'c' ? [{ x, y }] : [])),
  );
  expect(QUARRY_GATE_SCENE.ground).toHaveLength(6);
  const decals = QUARRY_GATE_SCENE.ground.slice(2);
  expect(decals).toHaveLength(cells.length);
  for (const [index, cell] of cells.entries()) {
    const decal = decals[index];
    expect(decal).toMatchObject({
      x: 768 + (cell.x - cell.y) * 64 - 56,
      y: (cell.x + cell.y + 1) * 32 - 24,
      width: 112,
      height: 48,
    });
  }
});

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
    const western = QUARRY_WEST_FRAMES.find((piece) => piece.id === wall.id);
    if (western) {
      expect(wall).toEqual(western);
      expect(western.fadeGroup).toBe('quarry-west-structure');
      expect(western.sourceRect.x + western.sourceRect.width).toBeLessThanOrEqual(1024);
      expect(western.sourceRect.y + western.sourceRect.height).toBeLessThanOrEqual(1543);
      const left = 768 + (cell.x - cell.y) * 64 - 64;
      expect(wall.x).toBeGreaterThanOrEqual(left);
      expect(wall.x + wall.width).toBeLessThanOrEqual(left + 128);
      expect(wall.y + wall.height).toBeLessThanOrEqual((cell.x + cell.y + 2) * 32);
      expect(wall.depth).toEqual({ x: cell.x + 0.5, y: cell.y + 0.5 });
    } else {
      expect([wall.width, wall.height]).toEqual([128, 176]);
      expect(wall.x + 64).toBe(768 + (cell.x - cell.y) * 64);
      expect(wall.y + 144).toBe((cell.x + cell.y + 1) * 32);
      expect((wall.depth.x + wall.depth.y) * 32).toBe(wall.y + 144);
    }
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
