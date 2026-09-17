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
});
