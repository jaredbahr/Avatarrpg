/**
 * The unit gate bounds WORK, never the wall clock (#796).
 *
 * A test that says "this took under N ms" fails when a neighbour is busy and passes when the
 * machine is fast, so it reports the machine, not the code. What such a test protects is nearly
 * always "this must not do more work than it needs" (a search that runs once per candidate, a
 * recompute over the whole board) or "this must terminate". Both are counts: calls to a spied
 * function, cells painted, commands applied, battles run. A count is the same on every machine.
 *
 * - `expectWorkWithin` is the always-on bound. Set it at 1.5 to 2 times the measured count, so a
 *   real regression (5x) fails and an honest content change has room.
 * - `TIME_BUDGETS` turns on the few budgets where time itself is the requirement (a frame budget,
 *   the core bench). Only the nightly hosted run sets `FNT_TIME_BUDGETS=1`; everywhere else those
 *   tests are skipped by `it.runIf(TIME_BUDGETS)`, with the flag in their name.
 * - `HANG_GUARD_MS` is the single timeout of the gate (`vitest.config.ts` reads it). It is not a
 *   budget: nothing is tuned against it and no test passes its own number.
 *
 * `eslint.config.js` holds the line: a `*.test.ts` file may not pass a timeout, set one with
 * `vi.setConfig`, or read a clock outside this module.
 */
import { performance } from 'node:perf_hooks';

/**
 * Ten minutes. The slowest single test in the suite (one board of the top-down ground pack) took
 * 39 s on a shared 4-core container and 194 s with eight busy processes beside it, so this is
 * fifteen times the first and three times the second. A real hang is still stopped and named by
 * Vitest inside the CI job's own 45-minute limit.
 */
export const HANG_GUARD_MS = 10 * 60_000;

/**
 * For `spawnSync`/`execFileSync` in a test: kill a stuck child, never judge a slow one. Half the
 * test's guard, because Vitest cannot interrupt a synchronous child; the child's own limit has to.
 */
export const CHILD_HANG_GUARD_MS = HANG_GUARD_MS / 2;

/** True only in the nightly hosted run (`FNT_TIME_BUDGETS=1`, set in `.github/workflows/ci.yml`). */
export const TIME_BUDGETS = process.env.FNT_TIME_BUDGETS === '1';

/** Appended to a time-budget test's name, so a skipped one says why in the report. */
export const TIME_BUDGET_TAG = '[time budget: runs only with FNT_TIME_BUDGETS=1, nightly]';

/** Fails with the measure, the measured count and the bound when the work exceeds the bound. */
export function expectWorkWithin(measure: string, measured: number, bound: number): void {
  if (!Number.isFinite(measured) || measured < 0)
    throw new Error(`Work bound "${measure}": measured ${measured} is not a count`);
  if (measured > bound) {
    throw new Error(
      `Work bound exceeded: ${measure}: measured ${measured}, bound ${bound} ` +
        `(${(measured / bound).toFixed(2)}x the bound). The code under test now does more work; ` +
        'raise the bound only when the extra work is intended.',
    );
  }
}

/** Wall time of `run` in ms. For `it.runIf(TIME_BUDGETS)` tests only. */
export function elapsedMs(run: () => void): number {
  const started = performance.now();
  run();
  return performance.now() - started;
}

/** CPU time (user + system) this process spent in `run`, in ms. For time-budget tests only. */
export function cpuMs(run: () => void): number {
  const before = process.cpuUsage();
  run();
  const used = process.cpuUsage(before);
  return (used.user + used.system) / 1000;
}

/** Fails with the measure, the measured time and the budget. For time-budget tests only. */
export function expectTimeWithin(measure: string, measuredMs: number, budgetMs: number): void {
  if (measuredMs > budgetMs) {
    throw new Error(
      `Time budget exceeded: ${measure}: measured ${measuredMs.toFixed(0)} ms, budget ${budgetMs} ms`,
    );
  }
}
