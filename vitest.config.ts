import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The rules core is pure TypeScript, so the default node environment is
    // enough. Presentation code is covered by Playwright instead.
    environment: 'node',
    // Keep mock call history behavior from Vitest 2.
    clearMocks: false,
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    reporters: ['default'],
  },
});
