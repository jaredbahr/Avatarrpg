import { expect, it } from 'vitest';
import { FOREST_ROAD } from '../../src/content/maps/combat';
import { validateFlocks } from './validate';

it('holds every flock strip wide enough for its flap frames', () => {
  expect(validateFlocks()).toEqual([]);
  const scene = FOREST_ROAD.scene!;
  const flock = scene.flock!;
  // One frame more than the 192 px strip holds.
  const short = { ...FOREST_ROAD, scene: { ...scene, flock: { ...flock, frames: 7 } } };
  expect(validateFlocks('public', [short])).toEqual([
    `${FOREST_ROAD.id}: flock ${flock.url} is 192x32, too small for 7 frames of 32 px`,
  ]);
});
