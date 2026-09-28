import { describe, expect, it } from 'vitest';
import { FX_AMBIENCE } from '../../content/fx';
import type { Grid } from '../../core/types';
import { particleSpan } from '../../render/fx/simulate';
import { ambientEmitters } from './ambience';

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
});
