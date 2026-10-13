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
    // A haze on the roof, never a solid column, and standing up off the oblique ground.
    expect(village.chimney.opacity).toBeLessThanOrEqual(0.6);
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

  describe('water glints', () => {
    const village = FX_AMBIENCE.village;
    if (!village?.glint) throw new Error('no village glint');
    const { glint } = village;
    const row = (x: number): Vec2 => ({ x, y: 2 });
    const water = [0, 1, 2, 3, 4, 5, 7, 8].map(row);
    const lit = (time: number) =>
      ambientEmitters(village, grid, time, [], false, water).filter((e) => e.def === glint);

    it('is the same at the same time, and a fresh scatter in a later cycle', () => {
      expect(lit(31_000)).toEqual(lit(31_000));
      expect(lit(31_000)).not.toEqual(lit(31_000 + 9000));
    });

    it('keeps only a few cells lit, each on a slow path along its own cell', () => {
      let most = 0;
      for (let time = 0; time < 120_000; time += 500) {
        const now = lit(time);
        most = Math.max(most, now.length);
        for (const e of now) expect(e.elapsed).toBeLessThanOrEqual(glint.duration);
      }
      expect(most).toBeGreaterThan(0);
      expect(most).toBeLessThan(water.length);
    });

    it('never draws outside the water cells it is given, at any moment', () => {
      for (let time = 0; time < 120_000; time += 250) {
        for (const e of lit(time)) {
          const inside = water.find(
            (c) => Math.floor(e.from.x) === c.x && Math.floor(e.from.y) === c.y,
          );
          expect(inside).toBeDefined();
          const strokes = sampleStrokes(glint, e.elapsed, e.seed, e.from, e.to);
          for (const stroke of strokes) {
            // Every end of the stroke, with its width, is inside its own cell.
            for (let i = 0; i < stroke.points.length; i += 2) {
              expect(stroke.points[i]).toBeGreaterThan((inside?.x ?? 0) + 0.1);
              expect(stroke.points[i]).toBeLessThan((inside?.x ?? 0) + 0.9);
              expect(stroke.points[i + 1]).toBeGreaterThan((inside?.y ?? 0) + 0.2);
              expect(stroke.points[i + 1]).toBeLessThan((inside?.y ?? 0) + 0.8);
            }
            expect(stroke.alpha).toBeLessThanOrEqual(0.2);
          }
        }
      }
    });

    it('stays away from the cells it is not given, such as a bridge in the canal', () => {
      for (let time = 0; time < 60_000; time += 250)
        for (const e of lit(time)) expect(Math.floor(e.from.x)).not.toBe(6);
    });

    it('is omitted under reduce motion, with the motes', () => {
      const chimneys = [{ x: 8, y: 6 }];
      for (const time of [100, 31_000, 987_654]) {
        const still = ambientEmitters(village, grid, time, chimneys, true, water);
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
