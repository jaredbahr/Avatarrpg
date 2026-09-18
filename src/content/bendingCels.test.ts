import { describe, expect, it } from 'vitest';
import { ALL_ABILITIES } from './abilities';
import { BENDING_CEL_CUES } from './bendingCels';
import { FX_CELS, celFrameIndex } from './fxCels';
import { resolveFx } from './fx';
import { sampleParticles, PARTICLE_STRIDE } from '../render/fx/simulate';
import { validateFxCels } from '../../scripts/art/validate';

describe('bending animation cels', () => {
  it('covers every existing bending technique with a visible named impact', () => {
    const bending = ALL_ABILITIES.filter((a) => /^fx\.(fire|water|earth|air)\./.test(a.fx));
    for (const ability of bending) {
      expect(BENDING_CEL_CUES[ability.fx], ability.id).toBeDefined();
      const recipe = resolveFx(ability.fx);
      const impact = recipe.impact.find((e) => e.kind === 'particles' && e.cel);
      expect(impact, ability.id).toBeDefined();
      if (impact?.kind !== 'particles') continue;
      const out = new Float32Array(PARTICLE_STRIDE);
      expect(
        sampleParticles(impact, 180, 12, { x: 5, y: 5 }, { x: 6, y: 5 }, out),
        ability.id,
      ).toBe(1);
      expect(out[4], ability.id).toBeGreaterThan(0.5);
      expect([...out].every(Number.isFinite)).toBe(true);
      expect(
        sampleParticles(impact, 1200, 12, { x: 5, y: 5 }, { x: 6, y: 5 }, out),
        ability.id,
      ).toBe(0);
    }
    expect(new Set(bending.map((a) => a.fx))).toEqual(new Set(Object.keys(BENDING_CEL_CUES)));
  });

  it('ships readable frames with clear gutters for every clip', () => {
    expect(validateFxCels()).toEqual([]);
  });

  it('samples loops and one-shot cels identically after skipped frames', () => {
    for (const cel of FX_CELS)
      for (const elapsed of [-1, 0, 125, 250, 375, 500, 20000]) {
        const frame = celFrameIndex(cel, elapsed, 500);
        expect(frame).toBeGreaterThanOrEqual(0);
        expect(frame).toBeLessThan(4);
        expect(Number.isInteger(frame)).toBe(true);
      }
    expect([0, 125, 250, 375, 700].map((t) => celFrameIndex('ice', t, 500))).toEqual([
      0, 1, 2, 3, 3,
    ]);
    expect(celFrameIndex('flame', 1000, 500)).toBe(celFrameIndex('flame', 0, 500));
  });

  it('grounds ice and stone, aims fire in either direction and keeps air translucent', () => {
    const out = new Float32Array(PARTICLE_STRIDE);
    for (const key of ['fx.water.spikes', 'fx.earth.wall']) {
      const def = resolveFx(key).impact.find((e) => e.kind === 'particles' && e.cel);
      if (def?.kind !== 'particles') throw new Error(key);
      sampleParticles(def, 150, 1, { x: 5, y: 5 }, { x: 6, y: 5 }, out);
      expect((out[1] ?? 0) + (out[2] ?? 0) * 0.34).toBeCloseTo(5.35);
      expect(out[3]).toBe(0);
    }
    for (const key of ['fx.fire.jab', 'fx.air.blast']) {
      const def = resolveFx(key).travel?.emitters.find((e) => e.kind === 'particles' && e.cel);
      if (def?.kind !== 'particles') throw new Error(key);
      for (const x of [1, 9]) {
        sampleParticles(def, def.duration, 1, { x: 5, y: 5 }, { x, y: 5 }, out);
        expect(out[0]).toBe(x);
        expect(out[1]).toBe(5);
        expect(out[3]).toBeCloseTo(x < 5 ? Math.PI : 0);
      }
      if (key.includes('air')) expect(out[4]).toBeLessThan(0.7);
    }
  });
});
