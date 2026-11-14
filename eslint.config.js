// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Layering rules, enforced here rather than by convention:
 *
 *   src/core/     pure rules. No DOM, no Math.random, no Date.now, no content
 *                 imports except types. Everything here must run in Node.
 *   src/content/  data only. May import core *types*, never core logic and
 *                 never presentation.
 *   src/render/   drawing. May import core types + content, never app scenes.
 *   src/app/      wiring, scenes, storage, hot-seat. May import anything.
 *
 * Breaking a layer is a lint error, not a review comment.
 */
const impureGlobals = [
  {
    name: 'window',
    message: 'src/core must stay pure — no DOM access. Move this to src/app or src/render.',
  },
  {
    name: 'document',
    message: 'src/core must stay pure — no DOM access. Move this to src/app or src/render.',
  },
  {
    name: 'localStorage',
    message: 'src/core must stay pure — use src/app/storage instead.',
  },
  {
    name: 'navigator',
    message: 'src/core must stay pure — no DOM access.',
  },
];

const impureProperties = [
  {
    object: 'Math',
    property: 'random',
    message: 'src/core must be deterministic — use the seeded Rng from src/core/rng.ts.',
  },
  {
    object: 'Date',
    property: 'now',
    message: 'src/core must be deterministic — pass timestamps in from src/app.',
  },
];

/**
 * The unit gate bounds work, never the wall clock (#796; `scripts/test-support/workBounds.ts`).
 * A timeout in the gate is one hang guard, set once in `vitest.config.ts`; a test that reads a
 * clock or passes its own timeout is measuring the machine it runs on.
 */
const TEST_FN = '/^(it|test|describe|bench|beforeAll|afterAll|beforeEach|afterEach)$/';
/** A number, or a constant named like one, as the last argument after the test body. */
const TIMEOUT_ARG =
  ':matches(Literal[raw=/^[0-9_.]+$/], BinaryExpression, Identifier[name=/(TIMEOUT|BUDGET|_MS|[a-z]Ms|[tT]imeout)$/]).arguments:last-child:not(:first-child)';
const ownTimeout =
  'Do not give a test its own timeout: it fails on a busy machine while every rule passes. ' +
  'The one hang guard is HANG_GUARD_MS in vitest.config.ts; prove termination with a work bound ' +
  '(expectWorkWithin in scripts/test-support/workBounds.ts).';
const ownClock =
  'Do not read a clock in a unit test. Bound the work with expectWorkWithin; where time is the ' +
  'requirement use elapsedMs/cpuMs and expectTimeWithin from scripts/test-support/workBounds.ts ' +
  'inside it.runIf(TIME_BUDGETS).';
const wallClockGuards = [
  // it('name', fn, 20_000) and the same on describe, hooks, it.each(...)(...), it.skipIf(...)(...)
  {
    selector: `CallExpression[callee.name=${TEST_FN}] > ${TIMEOUT_ARG}`,
    message: ownTimeout,
  },
  {
    selector: `CallExpression[callee.object.name=${TEST_FN}] > ${TIMEOUT_ARG}`,
    message: ownTimeout,
  },
  {
    selector: `CallExpression[callee.type='CallExpression'] > ${TIMEOUT_ARG}`,
    message: ownTimeout,
  },
  // it('name', { timeout }, fn), vi.setConfig({ testTimeout }), spawnSync(..., { timeout: 10_000 })
  {
    selector: `CallExpression[callee.name=${TEST_FN}] > ObjectExpression > Property[key.name=/^(timeout|retry)$/]`,
    message: ownTimeout,
  },
  {
    selector: `CallExpression[callee.type='CallExpression'] > ObjectExpression > Property[key.name=/^(timeout|retry)$/]`,
    message: ownTimeout,
  },
  {
    selector: 'Property[key.name=/^(testTimeout|hookTimeout|teardownTimeout)$/]',
    message: ownTimeout,
  },
  {
    selector: "Property[key.name='timeout'][value.type='Literal']",
    message:
      'A child-process timeout in a test is a hang guard, not a budget: use CHILD_HANG_GUARD_MS ' +
      'from scripts/test-support/workBounds.ts.',
  },
  // performance.now() - started, Date.now() - t0, and the reverse
  {
    selector:
      "BinaryExpression[operator='-'] > CallExpression[callee.property.name=/^(now|hrtime|bigint|cpuUsage)$/]",
    message: ownClock,
  },
  {
    selector:
      "CallExpression[callee.object.name='process'][callee.property.name=/^(hrtime|cpuUsage|uptime)$/]",
    message: ownClock,
  },
  {
    selector: "MemberExpression[object.object.name='process'][object.property.name='hrtime']",
    message: ownClock,
  },
];
const clockCalls = [
  {
    selector:
      "CallExpression[callee.object.name=/^(performance|Date)$/][callee.property.name='now']",
    message: ownClock,
  },
];

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      // Claude Code agent worktrees (full repo copies) live here.
      '.claude/worktrees/**',
      'dev-dist/**',
      'node_modules/**',
      '.vite/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.shots/**',
      'gallery/**',
      'prototypes/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      eqeqeq: ['error', 'smart'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', ...impureGlobals],
      'no-restricted-properties': ['error', ...impureProperties],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/render/**', '**/app/**', '**/ui/**'],
              message: 'src/core may not import presentation code.',
            },
            {
              group: ['**/content/**'],
              message:
                'src/core may not import content values — content is injected through the Ruleset at call time.',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/content/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/render/**', '**/app/**', '**/ui/**'],
              message: 'src/content may not import presentation code.',
            },
            {
              group: ['**/core/rules/**', '**/core/state/**', '**/core/sim/**'],
              message: 'src/content is data only — it may import core types, not core logic.',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/render/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/app/**'],
              message: 'src/render may not import app scenes — it receives what it draws.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', 'e2e/**/*.ts', 'scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
      'no-restricted-properties': 'off',
      'no-restricted-imports': 'off',
    },
  },
  {
    // The vitest suite. `src/app` tests may still read a clock to stamp the real-time animators
    // they drive; nothing may subtract one, and no test anywhere sets its own timeout.
    files: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    rules: { 'no-restricted-syntax': ['error', ...wallClockGuards] },
  },
  {
    files: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    ignores: ['src/app/**'],
    rules: { 'no-restricted-syntax': ['error', ...wallClockGuards, ...clockCalls] },
  },
  {
    // Build-time Node scripts and config files: Node globals, console allowed.
    files: ['scripts/**', '*.config.js', '*.config.ts', 'vite.config.ts', 'playwright.config.ts'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
);
