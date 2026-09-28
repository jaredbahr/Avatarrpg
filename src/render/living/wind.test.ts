import { describe, expect, it } from 'vitest';
import { FOREST_ROAD_SCENE } from '../../content/scenes/forestRoad';
import { flockAt, flockFrame, GUST_LENGTH, gust, gustCrests, heldSway, sway } from './wind';

const flock = FOREST_ROAD_SCENE.flock!;
const pines = FOREST_ROAD_SCENE.scenery.filter((piece) => piece.wind);

describe('forest wind', () => {
  it('moves only the pines and the two grass plates', () => {
    expect(pines.length).toBeGreaterThan(4);
    expect(pines.every((piece) => piece.id.startsWith('forest-pine-'))).toBe(true);
    expect(FOREST_ROAD_SCENE.ground.filter((piece) => piece.wind).map((p) => p.url)).toEqual([
      'art/maps/forest-scene/grass-north.webp',
      'art/maps/forest-scene/grass-south.webp',
    ]);
  });

  it('leans a crown a few pixels downwind at most, as a pure function of the clock', () => {
    for (const pine of pines) {
      for (let time = 0; time < 20_000; time += 173) {
        const lean = sway(time, pine) * pine.height;
        expect(lean).toBeGreaterThan(0);
        expect(lean).toBeLessThan(5);
        expect(sway(time, pine)).toBe(sway(time, pine));
      }
    }
  });

  it('holds three drawings of the lean on Canvas 2D', () => {
    const held = new Set<number>();
    for (const pine of pines)
      for (let time = 0; time < 20_000; time += 50) held.add(heldSway(time, pine));
    expect(held.size).toBeLessThanOrEqual(3);
  });

  it('puts the grass band on the gust crests, one period apart', () => {
    const crests = gustCrests(12_345, -1000, 3000);
    expect(crests.length).toBeGreaterThan(1);
    for (const x of crests) expect(gust(12_345, x)).toBeCloseTo(1, 6);
    expect((crests[1] ?? 0) - (crests[0] ?? 0)).toBeCloseTo(GUST_LENGTH, 6);
    expect(crests[0]).toBeLessThanOrEqual(-1000 + GUST_LENGTH);
  });
});

describe('the flush', () => {
  it('lifts every bird out of a pine crown and flies it across and off the board', () => {
    const early = flockAt(flock, pines, 800);
    expect(early).toHaveLength(flock.count);
    // Each bird as it leaves: the newest one in the flock, just after its start.
    for (let i = 0; i < flock.count; i++) {
      const bird = flockAt(flock, pines, i * 150 + 30).at(-1);
      if (!bird) throw new Error(`bird ${i} never took off`);
      const crown = pines.some(
        (pine) =>
          bird.x >= pine.x - 60 &&
          bird.x <= pine.x + pine.width + 60 &&
          bird.y >= pine.y - 150 &&
          bird.y <= pine.y + pine.height * 0.3,
      );
      expect(crown).toBe(true);
    }
    // By the end every bird has flown more than the board's half-width.
    const late = flockAt(flock, pines, 3300);
    early.forEach((bird, index) => {
      const end = late[index];
      expect(Math.hypot((end?.x ?? bird.x) - bird.x, (end?.y ?? bird.y) - bird.y)).toBeGreaterThan(
        1100,
      );
    });
    expect(flockAt(flock, pines, -1)).toEqual([]);
    expect(flockAt(flock, pines, 60_000)).toEqual([]);
  });

  it('flaps through every frame of the strip', () => {
    const frames = new Set<number>();
    for (let t = 0; t < 1000; t += 16)
      for (const bird of flockAt(flock, pines, t)) frames.add(bird.frame);
    expect([...frames].sort()).toEqual([0, 1, 2, 3, 4, 5].slice(0, flock.frames));
    expect(flockFrame(flock, 5).sourceRect).toEqual({ x: 160, y: 0, width: 32, height: 32 });
  });
});
