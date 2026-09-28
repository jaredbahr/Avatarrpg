import { describe, expect, it } from 'vitest';
import { FOREST_ROAD_SCENE } from '../../content/scenes/forestRoad';
import { firstGustCrest, flockAt, flockFrame, flockSpan, GUST_LENGTH, gust, sway } from './wind';

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
      for (let time = 0; time < 20_000; time += 50) held.add(sway(time, pine, true));
    expect(held.size).toBeLessThanOrEqual(3);
  });

  it('puts the grass band on the gust crests, one period apart', () => {
    const first = firstGustCrest(12_345, -1000);
    expect(first).toBeLessThanOrEqual(-1000);
    expect(first).toBeGreaterThan(-1000 - GUST_LENGTH);
    for (let x = first; x <= 3000; x += GUST_LENGTH) expect(gust(12_345, x)).toBeCloseTo(1, 6);
  });
});

describe('the flush', () => {
  it('lifts every bird out of a pine crown and flies it across and off the board', () => {
    const early = flockAt(flock, pines, 800);
    expect(early).toHaveLength(flock.count);
    // Each bird as it leaves: the newest one in the flock, just after its start.
    for (let i = 0; i < flock.count; i++) {
      const bird = flockAt(flock, pines, i * 150 + 30).find((b) => b.id === i);
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
    for (const bird of early) {
      const end = late.find((b) => b.id === bird.id);
      if (!end) throw new Error(`bird ${bird.id} left before the end`);
      expect(Math.hypot(end.x - bird.x, end.y - bird.y)).toBeGreaterThan(1100);
    }
    expect(flockAt(flock, pines, -1)).toEqual([]);
    expect(flockAt(flock, pines, 60_000)).toEqual([]);
  });

  it('stops all flock work once the last bird has gone', () => {
    // The last bird leaves at the span's end, and after it nothing is computed at all.
    expect(flockSpan(flock)).toBe((flock.count - 1) * 150 + 3400);
    expect(flockAt(flock, pines, flockSpan(flock)).map((b) => b.id)).toEqual([flock.count - 1]);
    const untouchable = new Proxy(pines, {
      get: () => {
        throw new Error('perches read after the flush ended');
      },
    });
    expect(flockAt(flock, untouchable, flockSpan(flock) + 1)).toEqual([]);
  });

  it('flaps through every frame of the strip', () => {
    const frames = new Set<number>();
    for (let t = 0; t < 1000; t += 16)
      for (const bird of flockAt(flock, pines, t)) frames.add(bird.frame);
    expect([...frames].sort()).toEqual([0, 1, 2, 3, 4, 5].slice(0, flock.frames));
    expect(flockFrame(flock, 5).sourceRect).toEqual({ x: 160, y: 0, width: 32, height: 32 });
  });
});
