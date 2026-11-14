import { defineConfig } from 'vitest/config';

const exclude = ['e2e/**', 'node_modules/**', 'dist/**'];
const serial = [
  'src/core/sim/runCombat.test.ts',
  'src/core/rules/turnCycle.property.test.ts',
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
          // Keep subprocesses and timing-sensitive workloads off the shared
          // pool while Vitest enforces their existing deadlines and budgets.
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
