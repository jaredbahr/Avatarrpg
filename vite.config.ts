import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { version } from './package.json';

// Stamp the code being built so even an offline cached bundle identifies itself.
function buildRevision(): string {
  const cwd = fileURLToPath(new URL('.', import.meta.url));
  try {
    const options = {
      cwd,
      encoding: 'utf8' as const,
      stdio: ['ignore', 'pipe', 'ignore'] as ['ignore', 'pipe', 'ignore'],
    };
    const revision = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], options).trim();
    const modified = execFileSync(
      'git',
      ['status', '--porcelain', '--untracked-files=no'],
      options,
    ).trim();
    return `${revision}${modified ? '-modified' : ''}`;
  } catch {
    return 'local';
  }
}

/**
 * `GH_PAGES_BASE` is set by the deploy workflow to `/<repo>/` so that the
 * built asset URLs resolve on GitHub Pages. Locally it stays `/`.
 */
const base = process.env.GH_PAGES_BASE ?? '/';

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_REVISION__: JSON.stringify(buildRevision()),
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    // The larger village stays inside the existing tablet download budget.
    minify: 'terser',
    terserOptions: { compress: { passes: 2 } },
    // The whole game is one bundle; 300 KB gzipped is the budget we verify in CI.
    chunkSizeWarningLimit: 900,
  },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.svg'],
      workbox: {
        /*
         * Sound effects precache: the whole set is well under a tenth of a
         * megabyte, and a footstep that arrives on the second walk is worse
         * than one that costs nothing to have ready. Music, when there is
         * any, must be excluded here — a first load on a tablet has to stay
         * a breath (ADR 0012).
         */
        globPatterns: ['**/*.{js,css,html,svg,png,webp,json,woff2,ogg}'],
        cleanupOutdatedCaches: true,
        navigateFallback: `${base}index.html`,
      },
      devOptions: {
        // Lets the e2e offline spec exercise the service worker without a prod build.
        enabled: false,
      },
      manifest: {
        name: 'Four Nations Tactics',
        short_name: 'FN Tactics',
        description:
          'A hot-seat turn-based tactical RPG set a few decades after Korra. Non-commercial fan work.',
        theme_color: '#e7d9bd',
        background_color: '#e7d9bd',
        display: 'standalone',
        orientation: 'landscape',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
