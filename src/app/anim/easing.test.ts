import { describe, expect, it } from 'vitest';
import {
  easeInCubic,
  easeInOutCubic,
  easeInOutSine,
  easeOutBack,
  easeOutQuad,
  linear,
  stroll,
} from './easing';

const ALL = {
  linear,
  stroll,
  easeInOutCubic,
  easeOutQuad,
  easeOutBack,
  easeInOutSine,
  easeInCubic,
};

describe('easing', () => {
  it('keeps the middle of a stroll at an even pace instead of sprinting', () => {
    const distances = [0.25, 0.4, 0.55, 0.7].map((t) => stroll(t + 0.05) - stroll(t));
    for (const d of distances) {
      expect(d).toBeCloseTo(distances[0] ?? 0, 9);
      expect(d).toBeLessThan(0.065);
    }
  });
  it.each(Object.entries(ALL))('%s maps 0 to 0 and 1 to 1', (_name, ease) => {
    expect(ease(0)).toBeCloseTo(0, 9);
    expect(ease(1)).toBeCloseTo(1, 9);
  });

  it.each(Object.entries(ALL))('%s clamps outside 0..1', (_name, ease) => {
    expect(ease(-1)).toBeCloseTo(ease(0), 9);
    expect(ease(2)).toBeCloseTo(ease(1), 9);
  });

  it.each(Object.entries(ALL).filter(([name]) => name !== 'easeOutBack'))(
    '%s never goes backwards',
    (_name, ease) => {
      let previous = -Infinity;
      for (let i = 0; i <= 100; i++) {
        const value = ease(i / 100);
        expect(value).toBeGreaterThanOrEqual(previous - 1e-12);
        previous = value;
      }
    },
  );

  it('easeOutBack overshoots once and settles', () => {
    const peak = Math.max(...Array.from({ length: 101 }, (_, i) => easeOutBack(i / 100)));
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.15);
  });
});
