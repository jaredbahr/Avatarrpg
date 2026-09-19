import { describe, expect, it } from 'vitest';
import { AMBUSH_ROAD, QUARRY_FLOOR } from '../maps/combat';
import {
  CUTTING_SCENE,
  DRILLER_FLOOR_SCENE,
  DRILLER_FLOOR_WALL_CELLS,
  DRILLER_REAR_LOADING_CELLS,
  DRILLER_REAR_LOADING_SCENERY,
} from './quarryProjected';

describe('projected quarry scenes', () => {
  it('shares only the exterior surround underneath the two live floors', () => {
    expect(CUTTING_SCENE.ground.slice(0, 2)).toEqual(DRILLER_FLOOR_SCENE.ground.slice(0, 2));
    expect(CUTTING_SCENE.ground.slice(0, 2).map((piece) => piece.url)).toEqual([
      'art/maps/quarry-surround/west.webp',
      'art/maps/quarry-surround/east.webp',
    ]);
  });
  it('opts The Cutting into local material regions and its exterior rim', () => {
    expect(AMBUSH_ROAD.projection).toBe('oblique');
    expect(AMBUSH_ROAD.scene).toBe(CUTTING_SCENE);
    expect(CUTTING_SCENE.groundMode).toBe('partial');
    expect(CUTTING_SCENE.ground.slice(2).map((piece) => piece.url)).toEqual([
      'art/maps/cutting-scene/dirt-west.webp',
      'art/maps/cutting-scene/dirt-east.webp',
      'art/maps/cutting-scene/road.webp',
      'art/maps/cutting-scene/stone.webp',
    ]);
    expect(CUTTING_SCENE.scenery).toHaveLength(3);
    expect(CUTTING_SCENE.paintedWater).toBeUndefined();
  });

  it('opts the Driller floor into local material regions while preserving the rear gap', () => {
    expect(QUARRY_FLOOR.projection).toBe('oblique');
    expect(QUARRY_FLOOR.scene).toBe(DRILLER_FLOOR_SCENE);
    expect(DRILLER_FLOOR_SCENE.groundMode).toBe('partial');
    expect(DRILLER_FLOOR_SCENE.ground.slice(2).map((piece) => piece.url)).toEqual([
      'art/maps/driller-floor-scene/dirt-west.webp',
      'art/maps/driller-floor-scene/dirt-east.webp',
      'art/maps/driller-floor-scene/stone.webp',
    ]);
    expect(DRILLER_FLOOR_SCENE.scenery).toHaveLength(3);
    expect(DRILLER_FLOOR_SCENE.scenery.slice(0, 2).map((piece) => piece.footprint[0])).toEqual(
      DRILLER_FLOOR_WALL_CELLS,
    );
    expect(DRILLER_FLOOR_SCENE.scenery.slice(0, 2).map((piece) => piece.url)).toEqual([
      'art/maps/quarry-gate-scene/wall-end.webp',
      'art/maps/quarry-gate-scene/wall-end.webp',
    ]);
    for (const [index, piece] of DRILLER_FLOOR_SCENE.scenery.slice(0, 2).entries()) {
      const cell = DRILLER_FLOOR_WALL_CELLS[index];
      expect(cell).toBeDefined();
      if (!cell) continue;
      expect(piece).toMatchObject({
        x: 768 + (cell.x - cell.y) * 64 - 64,
        y: (cell.x + cell.y + 1) * 32 - 144,
        width: 128,
        height: 176,
        footprint: [cell],
        depth: { x: cell.x + 0.5, y: cell.y + 0.5 },
        wall: true,
        fadeWhenOccluding: true,
      });
    }
    expect(DRILLER_REAR_LOADING_CELLS).toEqual([
      { x: 14, y: -1 },
      { x: 15, y: -1 },
      { x: 16, y: -1 },
      { x: 17, y: -1 },
      { x: 18, y: -1 },
      { x: 19, y: -1 },
    ]);
    expect(DRILLER_REAR_LOADING_SCENERY).toEqual([
      {
        id: 'driller-rear-loading',
        url: 'art/maps/driller-floor-scene/rear-loading.webp',
        x: 1652,
        y: 382,
        width: 370,
        height: 249,
        footprint: DRILLER_REAR_LOADING_CELLS,
        depth: { x: 16.5, y: -0.5 },
        exterior: true,
      },
    ]);
    expect(DRILLER_FLOOR_SCENE.paintedWater).toBeUndefined();
  });
});
