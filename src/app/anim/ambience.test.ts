import { describe, expect, it } from 'vitest';
import { FX_AMBIENCE } from '../../content/fx';
import { BA_DAN_CANOPIES, BA_DAN_CHIMNEYS } from '../../content/scenes/baDan';
import type { Grid, Tile } from '../../core/types';
import {
  PARTICLE_STRIDE,
  glintExtent,
  particleSpan,
  sampleParticles,
  sampleStrokes,
} from '../../render/fx/simulate';
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
    // A canal one cell wide along row 2, a bridge on cell 6, dry ground all round it.
    const canalGrid: Grid = {
      width: 12,
      height: 5,
      tiles: Array.from({ length: 60 }, (_, i) => {
        const x = i % 12;
        const y = Math.floor(i / 12);
        return {
          terrain: 'dirt',
          ...(y === 2 && x !== 6 && x < 10
            ? { surface: { id: 'water', duration: -1, spread: 0 } }
            : {}),
        } as Tile;
      }),
    };
    const water = waterCells(canalGrid);
    const lit = (time: number) =>
      ambientEmitters(village, canalGrid, time, [], false, water).filter((e) => e.def === glint);

    it('is the same at the same time, and a fresh scatter in a later cycle', () => {
      expect(lit(31_000)).toEqual(lit(31_000));
      expect(lit(31_000)).not.toEqual(lit(31_000 + 4800));
    });

    it('is sparse and slow: 3.4 to 3.8 s, a few cells at a time, every cell in its turn', () => {
      expect(glint.duration).toBeGreaterThanOrEqual(3400);
      expect(glint.duration).toBeLessThanOrEqual(3800);
      let most = 0;
      let total = 0;
      let samples = 0;
      for (let time = 0; time < 240_000; time += 250) {
        const now = lit(time);
        most = Math.max(most, now.length);
        total += now.length;
        samples += 1;
        for (const e of now) expect(e.elapsed).toBeLessThanOrEqual(glint.duration);
      }
      // Eight cells, two slots each: never every slot lit, and on average well under half of them.
      expect(most).toBeLessThan(water.length * 2);
      expect(total / samples).toBeGreaterThan(water.length * 0.2);
      expect(total / samples).toBeLessThan(water.length * 0.6);
      const seen = new Set<number>();
      for (let time = 0; time < 120_000; time += 250)
        for (const e of lit(time)) seen.add(Math.floor(e.from.x));
      expect(seen.size).toBe(water.length);
    });

    it('never has two ripples at the top of their swell side by side', () => {
      for (let time = 0; time < 240_000; time += 250) {
        const peaking = lit(time).filter((e) => Math.abs(e.elapsed - glint.duration / 2) < 125);
        for (const a of peaking)
          for (const b of peaking)
            if (a !== b)
              expect(Math.abs(Math.floor(a.from.x) - Math.floor(b.from.x))).toBeGreaterThan(1);
      }
    });

    it('keeps every point of every crescent inside permanent water', () => {
      const permanentWater = (x: number, y: number) =>
        water.some((cell) => cell.x === Math.floor(x) && cell.y === Math.floor(y));
      for (let time = 0; time < 240_000; time += 137) {
        for (const e of lit(time)) {
          const cx = Math.floor(e.from.x);
          expect(water.some((c) => c.x === cx && c.y === Math.floor(e.from.y))).toBe(true);
          expect(cx).not.toBe(6);
          // Re-sample each deterministic seed across its life, including moments other than
          // the scene-clock sample above. Both crescents and every polygon point must remain wet.
          for (const elapsed of [
            0,
            glint.duration * 0.17,
            glint.duration / 2,
            glint.duration * 0.83,
            glint.duration,
          ])
            for (const stroke of sampleStrokes(glint, elapsed, e.seed, e.from, e.to))
              for (let i = 0; i < stroke.points.length; i += 2)
                expect(permanentWater(stroke.points[i] ?? -1, stroke.points[i + 1] ?? -1)).toBe(
                  true,
                );
        }
      }
    });

    it('derives the full directional envelope from the ripple definition', () => {
      const extent = glintExtent(glint, { x: 0.08, y: 0 });
      expect(extent.left).toBeCloseTo(0.18308, 6);
      expect(extent.right).toBeCloseTo(0.389064, 6);
      expect(extent.top).toBeCloseTo(0.18308, 6);
      expect(extent.bottom).toBeCloseTo(0.309064, 6);
      expect(extent.left + extent.right).toBeLessThan(0.96);
      expect(extent.top + extent.bottom).toBeLessThan(0.96);
    });

    it('draws a thin, flat, pale arc that fades: one long crescent, sometimes a shorter one', () => {
      expect(glint.blend).toBe('normal');
      expect(glint.color).toBe('shallows');
      expect(glint.reach).toBeGreaterThanOrEqual(0.3);
      expect(glint.reach).toBeLessThanOrEqual(0.34);
      expect(glint.width).toBeLessThanOrEqual(0.03);
      const counts = new Set<number>();
      for (let seed = 1; seed < 80; seed++) {
        const strokes = sampleStrokes(
          glint,
          glint.duration / 2,
          seed,
          { x: 3.4, y: 2.5 },
          { x: 3.48, y: 2.5 },
        );
        counts.add(strokes.length);
        expect(strokes.length).toBeGreaterThanOrEqual(1);
        expect(strokes.length).toBeLessThanOrEqual(glint.count);
        expect(strokes[0]?.alpha).toBeGreaterThan(strokes[1]?.alpha ?? 0);
        for (const stroke of strokes) {
          expect(stroke.fill).toBe(true);
          expect(stroke.alpha).toBeLessThanOrEqual(0.3 + 1e-9);
          // Across and down on the screen, in tile widths: long and flat.
          const across: number[] = [];
          const down: number[] = [];
          for (let i = 0; i < stroke.points.length; i += 2) {
            const x = stroke.points[i] ?? 0;
            const y = stroke.points[i + 1] ?? 0;
            across.push(x - y);
            down.push((x + y) / 2);
          }
          const wide = Math.max(...across) - Math.min(...across);
          const deep = Math.max(...down) - Math.min(...down);
          expect(wide).toBeGreaterThan(0.3);
          expect(deep).toBeLessThan(wide / 5);
        }
      }
      // The lower arc is there on some ripples and not on others.
      expect([...counts].sort()).toEqual([1, 2]);
    });

    it('fades in and out: nothing at the start or end of a ripple', () => {
      const from = { x: 3.4, y: 2.5 };
      const to = { x: 3.48, y: 2.5 };
      for (const elapsed of [0, glint.duration])
        for (const stroke of sampleStrokes(glint, elapsed, 7, from, to))
          expect(stroke.alpha).toBeLessThan(0.01);
      const mid = sampleStrokes(glint, glint.duration / 2, 7, from, to);
      expect(Math.max(...mid.map((s) => s.alpha))).toBeGreaterThan(0.2);
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
    const isLeaf = (def: unknown) => canopy.some((leaf) => leaf === def);
    const trees = [
      { x: 5, y: 5 },
      { x: 21, y: 2 },
    ];

    it('lets leaves go above and around each tree, two loops per colour', () => {
      const live = ambientEmitters(village, grid, 4000, [], false, [], trees).filter((e) =>
        isLeaf(e.def),
      );
      expect(live).toHaveLength(trees.length * 2 * canopy.length);
      for (const e of live) {
        const tree = trees.find((t) => e.to.x === t.x && e.to.y === t.y);
        expect(tree).toBeDefined();
        expect(e.from.x).toBeLessThan(e.to.x);
        expect(e.from.y).toBeLessThan(e.to.y);
      }
    });

    it('is few, small, slow, foliage-coloured and falling', () => {
      expect(canopy.map((leaf) => leaf.color).sort()).toEqual(['moss', 'straw']);
      let slots = 0;
      for (const def of canopy) {
        if (def.kind !== 'particles') throw new Error('leaves are particles');
        expect(def.cell).toBe('leaf');
        expect(def.size[0]).toBeGreaterThanOrEqual(0.16);
        expect(def.size[1]).toBeLessThanOrEqual(0.22);
        expect(def.speed[1]).toBeLessThanOrEqual(0.3);
        expect(def.spin).toBeGreaterThanOrEqual(0.7);
        expect(def.spin).toBeLessThanOrEqual(1);
        expect(def.opacity).toBeLessThanOrEqual(0.75);
        // A heading a little below due east on the ground: down the screen as well as across it.
        expect(Math.sin(def.spread)).toBeGreaterThan(0);
        slots += def.count;
      }
      // Three or four leaves a canopy at a time: one loop of each colour's count.
      expect(slots).toBeGreaterThanOrEqual(3);
      expect(slots).toBeLessThanOrEqual(4);
    });

    it('is absent under reduce motion or without trees', () => {
      const still = ambientEmitters(village, grid, 4000, [], true, [], trees);
      expect(still.some((e) => isLeaf(e.def))).toBe(false);
      const none = ambientEmitters(village, grid, 4000);
      expect(none.some((e) => isLeaf(e.def))).toBe(false);
    });
  });

  it('keeps the whole village in the air under the Canvas 2D cap of 96 particles (ADR 0004)', () => {
    const village = FX_AMBIENCE.village;
    if (!village) throw new Error('no village ambience');
    const out = new Float32Array(400 * PARTICLE_STRIDE);
    let most = 0;
    for (let time = 0; time < 120_000; time += 100) {
      let live = 0;
      for (const e of ambientEmitters(
        village,
        grid,
        time,
        BA_DAN_CHIMNEYS,
        false,
        [],
        BA_DAN_CANOPIES,
      ))
        if (e.def.kind === 'particles')
          live += sampleParticles(e.def, e.elapsed, e.seed, e.from, e.to, out);
      most = Math.max(most, live);
    }
    expect(most).toBeGreaterThan(40);
    expect(most).toBeLessThanOrEqual(96);
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
      expect(waterCells(small).map(({ x, y }) => ({ x, y }))).toEqual([
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ]);
      expect(waterCells(small)).toBe(waterCells(small));
    });
  });
});
