/**
 * The statistics the balance report and its tripwire stand on (ADR 0114).
 *
 * Everything here is arithmetic on numbers a simulation already produced: no
 * randomness, no clock. Three jobs:
 *
 *  1. **An interval beside every number.** A rate gets a Wilson score interval,
 *     which stays honest at 0% and 100% where the plain "p ± z·se" collapses to
 *     a zero-width lie. A mean gets mean ± z · standard error.
 *  2. **A two-sample comparison.** A change to the AI re-rolls every trajectory,
 *     so a new run behaves like a fresh sample of the same fight and has to be
 *     compared with the old one as two samples, not digit for digit.
 *  3. **A threshold for many comparisons at once.** One report compares a few
 *     hundred numbers; `familyZ` picks the z that keeps the chance of any false
 *     alarm in a whole run at the level asked for.
 */

/** z for a two-sided 95% interval. */
export const Z95 = 1.96;

export interface Interval {
  readonly low: number;
  readonly high: number;
}

/** A mean with what is needed to compare it later: its standard error and count. */
export interface MeanStats {
  readonly n: number;
  readonly mean: number;
  /** Standard error of the mean: sample standard deviation / sqrt(n). */
  readonly se: number;
}

/**
 * Wilson score interval for `successes` out of `n`.
 *
 * At 40 wins of 40 it answers 91.2–100%, which is the true statement: forty
 * straight wins do not show the win rate is 100%.
 */
export function wilsonInterval(successes: number, n: number, z: number = Z95): Interval {
  if (n <= 0) return { low: 0, high: 1 };
  const p = successes / n;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denominator;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator;
  // The algebra lands exactly on 0 and 1 at the ends; rounding must not leave them.
  return {
    low: successes === 0 ? 0 : Math.max(0, centre - half),
    high: successes === n ? 1 : Math.min(1, centre + half),
  };
}

/** Mean and standard error (sample standard deviation, n - 1) of `samples`. */
export function meanStats(samples: readonly number[]): MeanStats {
  const n = samples.length;
  if (n === 0) return { n: 0, mean: 0, se: 0 };
  let sum = 0;
  for (const sample of samples) sum += sample;
  const mean = sum / n;
  if (n === 1) return { n, mean, se: 0 };
  let squares = 0;
  for (const sample of samples) squares += (sample - mean) * (sample - mean);
  return { n, mean, se: Math.sqrt(squares / (n - 1) / n) };
}

/** mean ± z · standard error. */
export function meanInterval(stats: MeanStats, z: number = Z95): Interval {
  return { low: stats.mean - z * stats.se, high: stats.mean + z * stats.se };
}

/**
 * The `q` quantile of `samples` (0 to 1), linearly interpolated between the two
 * nearest order statistics. The 10th percentile of HP left is the fight a table
 * has on a bad night, which a mean hides.
 */
export function quantile(samples: readonly number[], q: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const position = Math.min(1, Math.max(0, q)) * (sorted.length - 1);
  const below = Math.floor(position);
  const lower = sorted[below] ?? 0;
  const upper = sorted[Math.min(sorted.length - 1, below + 1)] ?? lower;
  return lower + (upper - lower) * (position - below);
}

/**
 * z for the difference of two rates, with the pooled standard error.
 *
 * Two samples that agree exactly (both 100 of 100, say) have no spread to
 * divide by; they also have no difference, so the answer is 0.
 */
export function proportionShiftZ(
  successesA: number,
  nA: number,
  successesB: number,
  nB: number,
): number {
  if (nA <= 0 || nB <= 0) return 0;
  const difference = successesB / nB - successesA / nA;
  if (difference === 0) return 0;
  const pooled = (successesA + successesB) / (nA + nB);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB));
  return se > 0 ? difference / se : Math.sign(difference) * Infinity;
}

/** z for the difference of two means, each with its own standard error (Welch). */
export function meanShiftZ(a: MeanStats, b: MeanStats): number {
  const difference = b.mean - a.mean;
  if (difference === 0) return 0;
  const se = Math.sqrt(a.se * a.se + b.se * b.se);
  return se > 0 ? difference / se : Math.sign(difference) * Infinity;
}

/** The complementary error function, to a fractional error under 1.2e-7. */
function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const polynomial =
    -z * z -
    1.26551223 +
    t *
      (1.00002368 +
        t *
          (0.37409196 +
            t *
              (0.09678418 +
                t *
                  (-0.18628806 +
                    t *
                      (0.27886807 +
                        t *
                          (-1.13520398 +
                            t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))));
  const value = t * Math.exp(polynomial);
  return x >= 0 ? value : 2 - value;
}

/** The chance a standard normal value falls outside ±z. */
export function twoSidedTail(z: number): number {
  return erfc(Math.abs(z) / Math.SQRT2);
}

/**
 * The z at which `comparisons` two-sided tests together raise a false alarm
 * with probability at most `familyAlpha` (Bonferroni: each test gets
 * familyAlpha / comparisons). It needs no independence between the tests, which
 * matters because every table size replays the same seeds.
 */
export function familyZ(comparisons: number, familyAlpha: number): number {
  const perTest = familyAlpha / Math.max(1, comparisons);
  let low = 0;
  let high = 12;
  for (let step = 0; step < 60; step++) {
    const middle = (low + high) / 2;
    if (twoSidedTail(middle) > perTest) low = middle;
    else high = middle;
  }
  return high;
}

export interface ShiftVerdict {
  /** Current minus baseline, in the measure's own unit. */
  readonly shift: number;
  readonly z: number;
  /** |z| reached the threshold: more than sampling noise explains. */
  readonly significant: boolean;
  /** |shift| reached the smallest change worth a person's attention. */
  readonly material: boolean;
  /** Both: this is what trips the gate. */
  readonly tripped: boolean;
}

/**
 * The comparison rule: a shift counts only when it is both statistically
 * significant and large enough to matter. Significance alone would flag a real
 * but trivial change at a high trial count; size alone would flag noise at a
 * low one.
 */
export function judgeShift(
  shift: number,
  z: number,
  zThreshold: number,
  minimumEffect: number,
): ShiftVerdict {
  const significant = Math.abs(z) >= zThreshold;
  const material = Math.abs(shift) >= minimumEffect;
  return { shift, z, significant, material, tripped: significant && material };
}
