import { describe, expect, it } from 'vitest';
import { AMBUSH_ROAD, QUARRY_FLOOR } from '../maps/combat';
import { CUTTING_SCENE, DRILLER_FLOOR_SCENE } from './quarryProjected';

describe('projected quarry scenes', () => {
  it('opts The Cutting into the reviewed ground and exterior rim pages', () => {
    expect(AMBUSH_ROAD.projection).toBe('oblique');
    expect(AMBUSH_ROAD.scene).toBe(CUTTING_SCENE);
    expect(CUTTING_SCENE.ground.map((piece) => piece.url)).toEqual([
      'art/maps/cutting-scene/ground-west.webp',
      'art/maps/cutting-scene/ground-east.webp',
    ]);
    expect(CUTTING_SCENE.scenery).toHaveLength(3);
    expect(CUTTING_SCENE.paintedWater).toBeUndefined();
  });

  it('opts the Driller floor into its ground pages while preserving the rear gap', () => {
    expect(QUARRY_FLOOR.projection).toBe('oblique');
    expect(QUARRY_FLOOR.scene).toBe(DRILLER_FLOOR_SCENE);
    expect(DRILLER_FLOOR_SCENE.ground.map((piece) => piece.url)).toEqual([
      'art/maps/driller-floor-scene/ground-west.webp',
      'art/maps/driller-floor-scene/ground-east.webp',
    ]);
    expect(DRILLER_FLOOR_SCENE.scenery).toHaveLength(4);
    expect(DRILLER_FLOOR_SCENE.scenery[1]?.id).toBe('driller-rear-east-rim');
    expect(DRILLER_FLOOR_SCENE.paintedWater).toBeUndefined();
  });
});
