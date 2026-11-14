import { defineConfig } from 'vitest/config';
import { HANG_GUARD_MS } from './scripts/test-support/workBounds';

const exclude = ['e2e/**', 'node_modules/**', 'dist/**'];
const serial = [
  'src/core/sim/runCombat.test.ts',
  'src/core/sim/disciplineSmoke.test.ts',
  'src/content/topdownLayout.test.ts',
  'scripts/bundle-report-cli.test.ts',
  'scripts/perf/core-bench.test.ts',
  'src/core/state/immutability.property.test.ts',
];

export default defineConfig({
  test: {
    environment: 'node',
    // Keep mock call history behavior from Vitest 2.
    clearMocks: false,
    reporters: ['default'],
    /*
     * The gate's only timeout, and it is a hang guard, not a budget (#796). A test passes or
     * fails on what it asserts, on a busy machine as on an idle one; a test that must not do too
     * much work bounds a count (`expectWorkWithin`), and one that must terminate caps its own
     * steps. No test, hook or file sets a timeout of its own: ESLint rejects it. The value and
     * its reasoning are in `scripts/test-support/workBounds.ts`.
     */
    testTimeout: HANG_GUARD_MS,
    hookTimeout: HANG_GUARD_MS,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
          exclude: [...exclude, ...serial],
          sequence: { groupOrder: 2 },
        },
      },
      {
        extends: true,
        test: {
          name: 'serial',
          include: serial,
          exclude,
          // Subprocesses, the combat worker pool and the nightly time budgets
          // run one file at a time, so they do not compete with the shared
          // pool for cores. Nothing here depends on it to pass.
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
