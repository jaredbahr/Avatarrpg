import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * `GH_PAGES_BASE` is set by the deploy workflow to `/<repo>/` so that the
 * built asset URLs resolve on GitHub Pages. Locally it stays `/`.
 */
const base = process.env.GH_PAGES_BASE ?? '/';

export default defineConfig({
  base,
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
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
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
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
        theme_color: '#1b1410',
        background_color: '#1b1410',
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
