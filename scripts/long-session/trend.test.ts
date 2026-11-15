import { describe, expect, it } from 'vitest';
import { fitTrend, judgeTrend } from './trend';

describe('fitTrend', () => {
  it('fits a straight line exactly', () => {
    const trend = fitTrend([10, 13, 16, 19, 22]);
    expect(trend.slope).toBeCloseTo(3);
    expect(trend.intercept).toBeCloseTo(10);
    expect(trend.growth).toBeCloseTo(12);
    expect([trend.first, trend.last, trend.min, trend.max, trend.points]).toEqual([
      10, 22, 10, 22, 5,
    ]);
  });

  it('drops the warm-up before fitting', () => {
    // The first two cycles fill the caches; after that the count is flat.
    const trend = fitTrend([20, 60, 67, 67, 67, 67], 2);
    expect(trend.slope).toBe(0);
    expect(trend.points).toBe(4);
    expect(trend.first).toBe(67);
  });

  it('has no slope with one point, and refuses none', () => {
    expect(fitTrend([5]).slope).toBe(0);
    expect(() => fitTrend([1, 2], 2)).toThrow();
  });
});

describe('judgeTrend', () => {
  it('calls a count that is one higher every cycle a leak, however small it is', () => {
    // The window listeners `App.start()` used to add: six a cycle from a low level.
    const verdict = judgeTrend('globalListeners', [26, 32, 38, 44, 50, 56], 1, { absolute: 0 });
    expect(verdict.leaking).toBe(true);
    expect(verdict.trend.slope).toBeCloseTo(6);
  });

  it('does not call a big flat number a leak', () => {
    const verdict = judgeTrend('imageArea', [25_968_432, 25_968_432, 25_968_432, 25_968_432], 0, {
      absolute: 0,
    });
    expect(verdict.leaking).toBe(false);
  });

  it('allows noise up to the allowance, absolute or relative, whichever is larger', () => {
    const heap = [12.4e6, 12.9e6, 12.6e6, 13.0e6, 12.7e6, 12.9e6];
    expect(judgeTrend('heap', heap, 0, { absolute: 2e6 }).leaking).toBe(false);
    expect(judgeTrend('heap', heap, 0, { absolute: 0, relative: 0.1 }).leaking).toBe(false);
    expect(judgeTrend('heap', heap, 0, { absolute: 1e5 }).leaking).toBe(true);
  });

  it('does not fail a flat series for one late spike that tilts the line', () => {
    // A cache caught mid-fill on one sample and back at its level on the last.
    const verdict = judgeTrend('canvases', [9, 9, 9, 9, 9, 9, 9, 30, 9], 0, { absolute: 2 });
    expect(verdict.trend.slope).toBeGreaterThan(0);
    expect(verdict.leaking).toBe(false);
  });

  it('does not call a falling series a leak', () => {
    expect(judgeTrend('timeouts', [9, 7, 5, 3], 0, { absolute: 0 }).leaking).toBe(false);
  });
});
