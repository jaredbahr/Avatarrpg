import { describe, expect, it } from 'vitest';
import { summariseTrials } from './balance';
import type { TrialSample } from './balance';
import {
  Z95,
  familyZ,
  judgeShift,
  meanInterval,
  meanShiftZ,
  meanStats,
  proportionShiftZ,
  quantile,
  twoSidedTail,
  wilsonInterval,
} from './stats';

describe('wilsonInterval', () => {
  it('does not collapse at the ceiling: 40 wins of 40 is not proof of 100%', () => {
    const interval = wilsonInterval(40, 40);
    expect(interval.low).toBeCloseTo(40 / (40 + Z95 * Z95), 10);
    expect(interval.low).toBeCloseTo(0.9124, 4);
    expect(interval.high).toBe(1);
  });

  it('does not collapse at the floor', () => {
    const interval = wilsonInterval(0, 10);
    expect(interval.low).toBe(0);
    expect(interval.high).toBeCloseTo(0.2775, 4);
  });

  it('matches the textbook value in the middle', () => {
    const interval = wilsonInterval(50, 100);
    expect(interval.low).toBeCloseTo(0.4038, 4);
    expect(interval.high).toBeCloseTo(0.5962, 4);
  });

  it('narrows as the trials grow', () => {
    const few = wilsonInterval(30, 40);
    const many = wilsonInterval(300, 400);
    expect(many.high - many.low).toBeLessThan(few.high - few.low);
  });

  it('says nothing is known with no trials', () => {
    expect(wilsonInterval(0, 0)).toEqual({ low: 0, high: 1 });
  });
});

describe('meanStats', () => {
  it('gives the mean and the standard error of the mean', () => {
    const stats = meanStats([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(stats.n).toBe(8);
    expect(stats.mean).toBe(5);
    // Sample variance 32 / 7; the standard error divides by another 8.
    expect(stats.se).toBeCloseTo(Math.sqrt(32 / 7 / 8), 12);
  });

  it('has no spread for a constant, one value or none', () => {
    expect(meanStats([3, 3, 3]).se).toBe(0);
    expect(meanStats([3])).toEqual({ n: 1, mean: 3, se: 0 });
    expect(meanStats([])).toEqual({ n: 0, mean: 0, se: 0 });
  });

  it('puts the interval at mean ± z standard errors', () => {
    const interval = meanInterval({ n: 100, mean: 0.8, se: 0.01 });
    expect(interval.low).toBeCloseTo(0.8 - 0.0196, 12);
    expect(interval.high).toBeCloseTo(0.8 + 0.0196, 12);
  });
});

describe('quantile', () => {
  it('interpolates between order statistics, whatever the input order', () => {
    const samples = [0.9, 0.1, 0.5, 0.3, 0.7];
    expect(quantile(samples, 0)).toBe(0.1);
    expect(quantile(samples, 0.5)).toBe(0.5);
    expect(quantile(samples, 1)).toBe(0.9);
    expect(quantile(samples, 0.1)).toBeCloseTo(0.18, 12);
    expect(samples[0]).toBe(0.9);
  });

  it('is zero for no samples', () => {
    expect(quantile([], 0.1)).toBe(0);
  });
});

describe('two-sample comparison', () => {
  it('reads two identical samples as no shift, even with no spread', () => {
    expect(proportionShiftZ(100, 100, 100, 100)).toBe(0);
    expect(meanShiftZ({ n: 100, mean: 0, se: 0 }, { n: 100, mean: 0, se: 0 })).toBe(0);
  });

  it('uses the pooled standard error for two rates', () => {
    // 90 and 70 of 100: pooled 0.8, se sqrt(0.8 * 0.2 * 0.02).
    expect(proportionShiftZ(90, 100, 70, 100)).toBeCloseTo(-0.2 / Math.sqrt(0.0032), 12);
  });

  it('adds the two standard errors in quadrature for two means', () => {
    const z = meanShiftZ({ n: 100, mean: 0.8, se: 0.03 }, { n: 100, mean: 0.7, se: 0.04 });
    expect(z).toBeCloseTo(-0.1 / 0.05, 10);
  });

  it('calls a difference between two spreadless samples infinite', () => {
    expect(meanShiftZ({ n: 10, mean: 1, se: 0 }, { n: 10, mean: 2, se: 0 })).toBe(Infinity);
  });
});

describe('familyZ', () => {
  it('knows the normal tail', () => {
    expect(twoSidedTail(1.96)).toBeCloseTo(0.05, 4);
    expect(twoSidedTail(0)).toBeCloseTo(1, 6);
  });

  it('is the ordinary z for one comparison', () => {
    expect(familyZ(1, 0.05)).toBeCloseTo(1.96, 3);
  });

  it('holds the whole family to the rate asked for, and rises with the family', () => {
    for (const comparisons of [1, 48, 192, 384, 1000]) {
      const z = familyZ(comparisons, 0.01);
      expect(twoSidedTail(z) * comparisons).toBeLessThanOrEqual(0.01);
      // And no stricter than it must be.
      expect(twoSidedTail(z - 0.01) * comparisons).toBeGreaterThan(0.01);
    }
    expect(familyZ(192, 0.01)).toBeCloseTo(4.05, 1);
    expect(familyZ(384, 0.01)).toBeGreaterThan(familyZ(192, 0.01));
  });
});

describe('judgeShift', () => {
  it('trips only when a shift is both significant and large enough to matter', () => {
    expect(judgeShift(-0.1, -6, 4, 0.05).tripped).toBe(true);
    // Real, but too small to care about.
    expect(judgeShift(-0.02, -6, 4, 0.05)).toMatchObject({
      significant: true,
      material: false,
      tripped: false,
    });
    // Big, but no more than noise explains.
    expect(judgeShift(-0.1, -2, 4, 0.05)).toMatchObject({
      significant: false,
      material: true,
      tripped: false,
    });
    expect(judgeShift(0, 0, 4, 0.05).tripped).toBe(false);
  });

  it('judges a rise the same as a fall', () => {
    expect(judgeShift(0.1, 6, 4, 0.05).tripped).toBe(true);
  });
});

describe('summariseTrials', () => {
  const trial = (
    outcome: TrialSample['outcome'],
    rounds: number,
    partyDeaths: number,
    hpLeft: number,
  ): TrialSample => ({ outcome, rounds, partyDeaths, hpLeft });

  it('derives every measure from the same trials', () => {
    const summary = summariseTrials([
      trial('victory', 3, 0, 0.9),
      trial('victory', 4, 1, 0.5),
      trial('defeat', 6, 3, 0),
      trial('victory', 3, 0, 0.8),
    ]);
    expect(summary.trials).toBe(4);
    expect(summary.wins).toBe(3);
    expect(summary.winRate).toBe(0.75);
    expect(summary.winInterval).toEqual(wilsonInterval(3, 4));
    expect(summary.hpLeft.mean).toBeCloseTo(0.55, 12);
    expect(summary.rounds.mean).toBe(4);
    expect(summary.deaths.mean).toBe(1);
    expect(summary.trialsWithDeath).toBe(2);
    expect(summary.deathRateInterval).toEqual(wilsonInterval(2, 4));
    expect(summary.hpLeftP10).toBeCloseTo(0.15, 12);
    expect(summary.stalemates).toBe(0);
  });

  it('counts a stalemate as neither a win nor a clean finish', () => {
    const summary = summariseTrials([trial('stalemate', 61, 0, 1), trial('victory', 3, 0, 1)]);
    expect(summary.wins).toBe(1);
    expect(summary.stalemates).toBe(1);
  });
});
