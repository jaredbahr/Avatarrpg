import { defineConfig } from 'vitest/config';

const include = ['src/**/*.test.ts', 'scripts/**/*.test.ts'];
const exclude = ['e2e/**', 'node_modules/**', 'dist/**'];
const timingSensitive = ['src/core/sim/runCombat.test.ts', 'scripts/bundle-report-cli.test.ts'];

export default defineConfig({
  test: {
    // The rules core is pure TypeScript, so the default node environment is
    // enough. Presentation code is covered by Playwright instead.
    environment: 'node',
    // Keep mock call history behavior from Vitest 2.
    clearMocks: false,
    reporters: ['default'],
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include,
          exclude: [...exclude, ...timingSensitive],
          sequence: { groupOrder: 2 },
        },
      },
      {
        extends: true,
        test: {
          name: 'simulation and bundle CLI',
          include: timingSensitive,
          exclude,
          // These files spawn their own workers or npm processes. Run one file
          // at a time before the general pool starts.
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
