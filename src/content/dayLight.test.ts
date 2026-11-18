import { describe, expect, it } from 'vitest';
import { DAY_PHASES } from '../core/types';
import { COMBAT_LIGHT_STRENGTH, DAY_LIGHT, LAMP_GLASS, LAMP_POOL } from './dayLight';

const luma = (m: readonly [number, number, number]) => 0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2];

describe('the day light table (ADR 0121)', () => {
  it('names every phase, and leaves the day as painted', () => {
    expect(Object.keys(DAY_LIGHT).sort()).toEqual([...DAY_PHASES].sort());
    for (const phase of ['morning', 'midday', 'afternoon'] as const) {
      expect(DAY_LIGHT[phase]).toEqual({ grade: null, lampsLit: false });
    }
  });

  it('keeps every grade readable: no channel below 0.7, lifts small', () => {
    for (const phase of DAY_PHASES) {
      const grade = DAY_LIGHT[phase].grade;
      if (!grade) continue;
      for (const v of grade.multiply) expect(v).toBeGreaterThanOrEqual(0.7);
      for (const v of grade.multiply) expect(v).toBeLessThanOrEqual(1);
      for (const v of grade.lift) expect(v).toBeGreaterThanOrEqual(0);
      for (const v of grade.lift) expect(v).toBeLessThanOrEqual(24);
    }
  });

  it('makes night a little deeper and cooler than evening, and dawn the faintest', () => {
    const evening = DAY_LIGHT.evening.grade;
    const night = DAY_LIGHT.night.grade;
    const dawn = DAY_LIGHT.dawn.grade;
    if (!evening || !night || !dawn) throw new Error('missing grade');
    expect(luma(night.multiply)).toBeLessThan(luma(evening.multiply));
    expect(night.multiply[2] / night.multiply[0]).toBeGreaterThan(
      evening.multiply[2] / evening.multiply[0],
    );
    expect(luma(dawn.multiply)).toBeGreaterThan(luma(evening.multiply));
    expect(DAY_LIGHT.evening.lampsLit && DAY_LIGHT.night.lampsLit).toBe(true);
    expect(DAY_LIGHT.dawn.lampsLit).toBe(false);
    expect(COMBAT_LIGHT_STRENGTH).toBeGreaterThan(0);
    expect(COMBAT_LIGHT_STRENGTH).toBeLessThan(1);
  });

  it('lights the lamps in warm amber in at most three hard rings, the pool modest', () => {
    for (const glow of [LAMP_POOL, LAMP_GLASS]) {
      const [r, g, b] = glow.color;
      // Amber, not lemon: red leads, green well under it, blue low.
      expect(r).toBeGreaterThan(g);
      expect(g).toBeLessThan(r * 0.75);
      expect(b).toBeLessThan(r * 0.5);
      expect(glow.rings.length).toBeGreaterThan(0);
      expect(glow.rings.length).toBeLessThanOrEqual(3);
      for (const n of [glow.radiusX, glow.radiusY]) expect(Number.isInteger(n)).toBe(true);
      // Outermost first: rings shrink and brighten inward.
      glow.rings.forEach((ring, i) => {
        const prev = glow.rings[i - 1];
        if (!prev) return;
        expect(ring.scale).toBeLessThan(prev.scale);
        expect(ring.alpha).toBeGreaterThan(prev.alpha);
      });
    }
    expect(Math.max(...LAMP_POOL.rings.map((r) => r.alpha))).toBeLessThanOrEqual(0.35);
  });
});
