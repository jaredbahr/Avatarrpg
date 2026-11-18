/**
 * Trend fitting for the long-session soak (#525).
 *
 * A leak is a positive slope per cycle, not a big number: a cache that fills to its cap and stays
 * there is healthy, and a count that is small but one higher after every cycle is not. So each
 * measured series is fitted with a least-squares line over the cycles after a warm-up, and judged
 * on the growth that line predicts across the measured cycles, against an allowance for noise.
 */

export interface Trend {
  /** Least-squares slope, in units per cycle. */
  readonly slope: number;
  readonly intercept: number;
  readonly first: number;
  readonly last: number;
  readonly min: number;
  readonly max: number;
  /** Cycles fitted (after the warm-up). */
  readonly points: number;
  /** Growth the fitted line predicts from the first fitted cycle to the last. */
  readonly growth: number;
}

/** Fits `values` (one per cycle, in order) after dropping the first `warmup` cycles. */
export function fitTrend(values: readonly number[], warmup = 0): Trend {
  const fitted = values.slice(warmup);
  const n = fitted.length;
  if (n === 0) throw new Error('fitTrend needs at least one value after the warm-up');
  const first = fitted[0] ?? 0;
  const last = fitted[n - 1] ?? 0;
  let sumX = 0;
  let sumY = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const [x, y] of fitted.entries()) {
    sumX += x;
    sumY += y;
    if (y < min) min = y;
    if (y > max) max = y;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let covariance = 0;
  let variance = 0;
  for (const [x, y] of fitted.entries()) {
    covariance += (x - meanX) * (y - meanY);
    variance += (x - meanX) ** 2;
  }
  const slope = variance === 0 ? 0 : covariance / variance;
  return {
    slope,
    intercept: meanY - slope * meanX,
    first,
    last,
    min,
    max,
    points: n,
    growth: slope * (n - 1),
  };
}

export interface Allowance {
  /**
   * Growth over the fitted cycles that is still noise, in the series' own units. A count that
   * must return to exactly its level uses 0; a heap figure uses a byte allowance.
   */
  readonly absolute: number;
  /** The same, as a fraction of the series' level at the first fitted cycle. */
  readonly relative?: number;
  /**
   * A known growth per cycle that is allowed on top, for a leak that is measured, explained and
   * out of reach. The series still fails when it grows faster than that.
   */
  readonly perCycle?: number;
}

export interface Verdict {
  readonly name: string;
  readonly trend: Trend;
  readonly allowed: number;
  readonly leaking: boolean;
}

/**
 * Judges one series. It leaks when the fitted growth exceeds the allowance AND the last cycle
 * really sits above the first by more than the allowance: the second test keeps one late spike
 * from tilting the line of an otherwise flat series into a failure.
 */
export function judgeTrend(
  name: string,
  values: readonly number[],
  warmup: number,
  allowance: Allowance,
): Verdict {
  const trend = fitTrend(values, warmup);
  const allowed =
    Math.max(allowance.absolute, (allowance.relative ?? 0) * Math.abs(trend.first)) +
    (allowance.perCycle ?? 0) * (trend.points - 1);
  const leaking = trend.growth > allowed && trend.last - trend.first > allowed;
  return { name, trend, allowed, leaking };
}
