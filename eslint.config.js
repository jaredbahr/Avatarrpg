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

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'dev-dist/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.shots/**',
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
