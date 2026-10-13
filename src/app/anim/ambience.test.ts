import { describe, expect, it } from 'vitest';
import { FX_AMBIENCE } from '../../content/fx';
import type { Grid, Tile, Vec2 } from '../../core/types';
import { particleSpan, sampleStrokes } from '../../render/fx/simulate';
import { ambientEmitters, waterCells } from './ambience';

const grid: Grid = { width: 20, height: 12, tiles: [] };

describe('ambientEmitters', () => {
  it('is still air for no recipe', () => {
    expect(ambientEmitters(null, grid, 1000)).toEqual([]);
  });

  it('keeps two loops of every emitter live, spanning the board', () => {
    const forest = FX_AMBIENCE.forest;
    if (!forest) throw new Error('no forest ambience');
    const live = ambientEmitters(forest, grid, 5000);
    expect(live).toHaveLength(forest.emitters.length * 2);
    for (const emitter of live) {
      expect(emitter.from).toEqual({ x: 0, y: 0 });
      expect(emitter.to).toEqual({ x: 20, y: 12 });
      expect(emitter.elapsed).toBeGreaterThanOrEqual(0);
      expect(emitter.def.kind).toBe('particles');
      if (emitter.def.kind === 'particles') {
        expect(emitter.elapsed).toBeLessThan(particleSpan(emitter.def));
      }
      expect(emitter.palette).toBe('earth');
    }
  });

  it('reseeds each loop so a new cycle is a new scatter, and is stable within one', () => {
    const forest = FX_AMBIENCE.forest;
    if (!forest) throw new Error('no forest ambience');
    const first = forest.emitters[0];
    if (!first) throw new Error('no emitter');
    const period = particleSpan(first);
    const a = ambientEmitters(forest, grid, 100)[0];
    const b = ambientEmitters(forest, grid, 200)[0];
    const next = ambientEmitters(forest, grid, 100 + period)[0];
    expect(a?.seed).toBe(b?.seed);
    expect(a?.seed).not.toBe(next?.seed);
    expect(next?.elapsed).toBe(a?.elapsed);
  });

  it('raises smoke from each chimney, at the chimney', () => {
    const village = FX_AMBIENCE.village;
    if (!village?.chimney) throw new Error('no village chimney smoke');
    const chimneys = [
      { x: 3.5, y: -1.25 },
      { x: 8, y: 6 },
    ];
    const live = ambientEmitters(village, grid, 4000, chimneys);
    const smoke = live.filter((emitter) => emitter.def === village.chimney);
    expect(smoke).toHaveLength(4);
    expect(smoke.map((emitter) => emitter.from)).toEqual([
      chimneys[0],
      chimneys[0],
      chimneys[1],
      chimneys[1],
    ]);
    for (const emitter of smoke) expect(emitter.to).toEqual(emitter.from);
    // A soft blob that thins as it rises, never a hard-edged one, standing up off the oblique ground.
    expect(village.chimney.cell).toBe('glow');
    expect(village.chimney.fade).toBe('out');
    expect(village.chimney.upright).toBe(true);
  });

  it('holds still: no motes, and the same wisp at every moment', () => {
    const village = FX_AMBIENCE.village;
    if (!village?.chimney) throw new Error('no village chimney smoke');
    const chimneys = [{ x: 8, y: 6 }];
    const early = ambientEmitters(village, grid, 100, chimneys, true);
    const late = ambientEmitters(village, grid, 987_654, chimneys, true);
    expect(early).toHaveLength(2);
    expect(early.every((emitter) => emitter.def === village.chimney)).toBe(true);
    expect(late).toEqual(early);
    // Frozen mid-life, so the wisp is there rather than between loops.
    expect(early.every((emitter) => emitter.elapsed > 1000)).toBe(true);
  });

  it('draws no smoke where the scene has no chimneys', () => {
    const village = FX_AMBIENCE.village;
    if (!village) throw new Error('no village ambience');
    expect(ambientEmitters(village, grid, 4000, [], true)).toEqual([]);
    expect(ambientEmitters(village, grid, 4000)).toHaveLength(village.emitters.length * 2);
  });

  describe('water ripples', () => {
    const village = FX_AMBIENCE.village;
    if (!village?.glint) throw new Error('no village ripple');
    const { glint } = village;
    const row = (x: number): Vec2 => ({ x, y: 2 });
    const water = [0, 1, 2, 3, 4, 5, 7, 8].map(row);
    const lit = (time: number) =>
      ambientEmitters(village, grid, time, [], false, water).filter((e) => e.def === glint);

    it('is the same at the same time, and a fresh scatter in a later cycle', () => {
      expect(lit(31_000)).toEqual(lit(31_000));
      expect(lit(31_000)).not.toEqual(lit(31_000 + 5200));
    });

    it('lights most cells within any four seconds, never all of them at once or in step', () => {
      let most = 0;
      for (let time = 0; time < 120_000; time += 500) {
        const now = lit(time);
        most = Math.max(most, now.length);
        for (const e of now) expect(e.elapsed).toBeLessThanOrEqual(glint.duration);
        // Never in step: three or more alive together are never all at the same point of their life.
        const ages = new Set(now.map((e) => Math.round(e.elapsed / 100)));
        if (now.length >= 3) expect(ages.size).toBeGreaterThan(1);
      }
      expect(most).toBeGreaterThan(water.length / 2);
      expect(most).toBeLessThan(water.length * 2);
      for (let time = 0; time < 120_000; time += 4000) {
        const seen = new Set<number>();
        for (let t = time; t < time + 4000; t += 250)
          for (const e of lit(t)) seen.add(Math.floor(e.from.x));
        expect(seen.size).toBeGreaterThanOrEqual(Math.floor(water.length * 0.6));
      }
    });

    it('stays in open water: inside its cell, clear of the banks, at any moment', () => {
      for (let time = 0; time < 40_000; time += 700) {
        for (const e of lit(time)) {
          const inside = water.find(
            (c) => Math.floor(e.from.x) === c.x && Math.floor(e.from.y) === c.y,
          );
          expect(inside).toBeDefined();
          const strokes = sampleStrokes(glint, e.elapsed, e.seed, e.from, e.to);
          expect(strokes).toHaveLength(glint.count);
          for (const stroke of strokes) {
            for (let i = 0; i < stroke.points.length; i += 2) {
              expect(stroke.points[i]).toBeGreaterThan((inside?.x ?? 0) + 0.1);
              expect(stroke.points[i]).toBeLessThan((inside?.x ?? 0) + 0.9);
              expect(stroke.points[i + 1]).toBeGreaterThan((inside?.y ?? 0) + 0.15);
              expect(stroke.points[i + 1]).toBeLessThan((inside?.y ?? 0) + 0.85);
            }
            // Faint at its brightest, and nothing at either end of its life.
            expect(stroke.alpha).toBeLessThanOrEqual(0.45);
            expect(stroke.fill).toBe(true);
          }
        }
      }
    });

    it('fades in and out: nothing at the start or end of a ripple', () => {
      const from = { x: 3.4, y: 2.5 };
      const to = { x: 3.52, y: 2.5 };
      for (const elapsed of [0, glint.duration])
        for (const stroke of sampleStrokes(glint, elapsed, 7, from, to))
          expect(stroke.alpha).toBeLessThan(0.01);
      const mid = sampleStrokes(glint, glint.duration / 2, 7, from, to);
      expect(Math.max(...mid.map((s) => s.alpha))).toBeGreaterThan(0.3);
    });

    it('stays away from the cells it is not given, such as a bridge in the canal', () => {
      for (let time = 0; time < 60_000; time += 250)
        for (const e of lit(time)) expect(Math.floor(e.from.x)).not.toBe(6);
    });

    it('is omitted under reduce motion, with the motes', () => {
      const chimneys = [{ x: 8, y: 6 }];
      for (const time of [100, 31_000, 987_654]) {
        const still = ambientEmitters(village, grid, time, chimneys, true, water, [{ x: 4, y: 4 }]);
        expect(still.some((e) => e.def === glint)).toBe(false);
        expect(still.every((e) => e.def === village.chimney)).toBe(true);
      }
    });

    it('is not in a recipe that has none, and not for a grid without water', () => {
      const forest = FX_AMBIENCE.forest;
      expect(forest?.glint).toBeUndefined();
      expect(ambientEmitters(forest ?? null, grid, 5000, [], false, water).length).toBe(
        (forest?.emitters.length ?? 0) * 2,
      );
      expect(ambientEmitters(village, grid, 31_000).some((e) => e.def === glint)).toBe(false);
    });
  });

  describe('canopy leaves', () => {
    const village = FX_AMBIENCE.village;
    if (!village?.canopy) throw new Error('no village canopy');
    const { canopy } = village;
    const trees = [
      { x: 5, y: 5 },
      { x: 21, y: 2 },
    ];

    it('lets leaves go above and around each tree, two loops apiece', () => {
      const live = ambientEmitters(village, grid, 4000, [], false, [], trees).filter(
        (e) => e.def === canopy,
      );
      expect(live).toHaveLength(trees.length * 2);
      for (const e of live) {
        const tree = trees.find((t) => e.to.x === t.x && e.to.y === t.y);
        expect(tree).toBeDefined();
        expect(e.from.x).toBeLessThan(e.to.x);
        expect(e.from.y).toBeLessThan(e.to.y);
      }
    });

    it('is small and slow, and absent under reduce motion or without trees', () => {
      expect(canopy.size[1]).toBeLessThanOrEqual(0.2);
      expect(canopy.speed[1]).toBeLessThanOrEqual(0.3);
      expect(canopy.count).toBeLessThanOrEqual(6);
      const still = ambientEmitters(village, grid, 4000, [], true, [], trees);
      expect(still.some((e) => e.def === canopy)).toBe(false);
      const none = ambientEmitters(village, grid, 4000);
      expect(none.some((e) => e.def === canopy)).toBe(false);
    });
  });

  describe('waterCells', () => {
    const tile = (water: number | null): Tile =>
      ({
        terrain: 'dirt',
        ...(water === null ? {} : { surface: { id: 'water', duration: water, spread: 0 } }),
      }) as Tile;

    it('lists the permanent water only, by position, and reuses the answer per grid', () => {
      const tiles = [tile(null), tile(-1), tile(3), tile(-1), tile(null), tile(null)];
      const small: Grid = { width: 3, height: 2, tiles };
      expect(waterCells(small)).toEqual([
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ]);
      expect(waterCells(small)).toBe(waterCells(small));
    });
  });
});
