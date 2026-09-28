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
 * Applies exact text replacements to one Pixi module, throwing if any `from`
 * text is missing so a Pixi upgrade fails the build instead of silently
 * shipping the omitted code again.
 */
function replaceExactly(
  code: string,
  replacements: readonly (readonly [from: string, to: string])[],
  review: string,
): { code: string; map: null } {
  let next = code;
  for (const [from, to] of replacements) {
    if (!next.includes(from)) throw new Error(`Pixi changed; review ${review}.`);
    next = next.replace(from, to);
  }
  return { code: next, map: null };
}

/** A stand-in for an omitted Pixi function that fails loudly if it is ever reached. */
function omittedPixi(name: string): string {
  return `const ${name} = () => { throw new Error('Pixi ${name} is omitted from this build (ADR 0056).'); };`;
}

/**
 * `GH_PAGES_BASE` is set by the deploy workflow to `/<repo>/` so that the
 * built asset URLs resolve on GitHub Pages. Locally it stays `/`.
 */
const base = process.env.GH_PAGES_BASE ?? '/';

export default defineConfig({
  base,
  // Keep parallel worktree/dev-server dependency graphs isolated. Shared
  // node_modules junctions otherwise let Vite workers overwrite each other's
  // optimized-dependency hashes during visual capture.
  cacheDir: '.vite',
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
    // Vite passes terser `safari10: true` by default. That Safari 10/11 workaround
    // costs 0.7 KB gzipped and cannot matter: an es2022 target needs Safari 15.
    terserOptions: { compress: { passes: 2 }, safari10: false },
    // The whole game is one bundle; 320 KB gzipped is the budget we verify in CI.
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
    {
      // Input, accessibility and HTML UI belong to the app's native DOM.
      // Atlas JSON uses our shared loader, not Pixi's Assets/Spritesheet.
      // These optional Pixi registration entry points are never used. Keep
      // graphics/text/filter/particle/texture initialization intact (ADR 0001).
      name: 'omit-unused-pixi-systems',
      transform(code, id) {
        // The game uploads still images/canvases and has no video textures.
        // Keep the other source registrations intact (ADR 0038).
        if (/[/\\]pixi\.js[/\\]lib[/\\]rendering[/\\]init\.mjs$/.test(id)) {
          const videoImport =
            "import { VideoSource } from './renderers/shared/texture/sources/VideoSource.mjs';";
          if (!code.includes(videoImport) || !code.includes('  VideoSource,')) {
            throw new Error(
              'Pixi texture registration changed; review the video-source exclusion.',
            );
          }
          const maskImports = [
            "import { AlphaMask } from './mask/alpha/AlphaMask.mjs';",
            "import { ColorMask } from './mask/color/ColorMask.mjs';",
            "import { StencilMask } from './mask/stencil/StencilMask.mjs';",
            "import './mask/MaskEffectManager.mjs';",
          ];
          for (const line of maskImports) {
            if (!code.includes(line)) {
              throw new Error('Pixi mask registration changed; review the mask exclusion.');
            }
          }
          if (
            !code.includes(
              'extensions.add(\n  AlphaMask,\n  ColorMask,\n  StencilMask,\n  VideoSource,',
            )
          ) {
            throw new Error('Pixi mask registration changed; review the mask exclusion.');
          }
          let next = code.replace(videoImport, '').replace('  VideoSource,', '');
          for (const line of maskImports) next = next.replace(line, '');
          next = next.replace('  AlphaMask,\n  ColorMask,\n  StencilMask,\n', '');
          return { code: next, map: null };
        }
        // The game renders on the main thread and has no Worker or OffscreenCanvas
        // path. Register the browser environment only; the worker extension would
        // otherwise retain Pixi's unused worker environment chunk (ADR 0033).
        if (/[/\\]pixi\.js[/\\]lib[/\\]index\.mjs$/.test(id)) {
          const registration = 'extensions.add(browserExt, webworkerExt);';
          if (!code.includes(registration)) {
            throw new Error(
              'Pixi environment registration changed; review the worker-environment exclusion.',
            );
          }
          return {
            code: code.replace(registration, 'extensions.add(browserExt);'),
            map: null,
          };
        }
        // Canvas rendering is our separate Canvas2D backend. Pixi is created
        // only as a WebGLRenderer, so its CanvasRenderer filter system cannot
        // be selected (ADR 0033).
        if (/[/\\]pixi\.js[/\\]lib[/\\]filters[/\\]init\.mjs$/.test(id)) {
          const canvasFilterImport =
            "import { CanvasFilterSystem } from './CanvasFilterSystem.mjs';";
          if (
            !code.includes(canvasFilterImport) ||
            !code.includes('extensions.add(FilterSystem, CanvasFilterSystem);')
          ) {
            throw new Error(
              'Pixi filter registration changed; review the CanvasFilterSystem exclusion.',
            );
          }
          return {
            code: code
              .replace(canvasFilterImport, '')
              .replace(
                'extensions.add(FilterSystem, CanvasFilterSystem);',
                'extensions.add(FilterSystem);',
              ),
            map: null,
          };
        }
        // Nothing in the game masks a Pixi display object: the board clips in
        // Canvas 2D and in the ground shader, and every other surface is DOM.
        // The alpha mask pipe is the only importer of Pixi's mask filter, so
        // both leave the shared render pipes; the color and stencil pipes stay,
        // because a build without them drew no board on the software WebGL
        // rasteriser (ADR 0040).
        if (
          /[/\\]pixi\.js[/\\]lib[/\\]rendering[/\\]renderers[/\\]shared[/\\]system[/\\]SharedSystems\.mjs$/.test(
            id,
          )
        ) {
          const alphaPipe = [
            "import { AlphaMaskPipe } from '../../../mask/alpha/AlphaMaskPipe.mjs';\n",
            '  AlphaMaskPipe,\n',
          ];
          for (const line of alphaPipe) {
            if (!code.includes(line)) {
              throw new Error(
                'Pixi shared-system registration changed; review the alpha-pipe exclusion.',
              );
            }
          }
          let next = code;
          for (const line of alphaPipe) next = next.replace(line, '');
          return { code: next, map: null };
        }
        // Graphics and particle containers register a pipe per renderer. Only
        // the WebGL ones can run, for the reason above (ADR 0056).
        if (/[/\\]pixi\.js[/\\]lib[/\\]scene[/\\]graphics[/\\]init\.mjs$/.test(id)) {
          return replaceExactly(
            code,
            [
              [
                "import { CanvasGraphicsContextSystem } from './canvas/CanvasGraphicsContextSystem.mjs';\n",
                '',
              ],
              ["import { CanvasGraphicsPipe } from './canvas/CanvasGraphicsPipe.mjs';\n", ''],
              ['extensions.add(CanvasGraphicsPipe);\n', ''],
              ['extensions.add(CanvasGraphicsContextSystem);\n', ''],
            ],
            'the canvas graphics exclusion',
          );
        }
        if (/[/\\]pixi\.js[/\\]lib[/\\]scene[/\\]particle-container[/\\]init\.mjs$/.test(id)) {
          return replaceExactly(
            code,
            [
              [
                "import { CanvasParticleContainerPipe } from './canvas/CanvasParticleContainerPipe.mjs';\n",
                '',
              ],
              [
                "import { GpuParticleContainerPipe } from './gpu/GpuParticleContainerPipe.mjs';\n",
                '',
              ],
              ['extensions.add(GpuParticleContainerPipe);\n', ''],
              ['extensions.add(CanvasParticleContainerPipe);\n', ''],
            ],
            'the particle pipe exclusion',
          );
        }
        // Its WGSL twin is only compiled by the WebGPU renderer; Shader binds a
        // GL-only program's resources by name, as it does for our own filters.
        if (
          /[/\\]pixi\.js[/\\]lib[/\\]scene[/\\]particle-container[/\\]shared[/\\]shader[/\\]ParticleShader\.mjs$/.test(
            id,
          )
        ) {
          return replaceExactly(
            code,
            [
              [
                "import { GpuProgram } from '../../../../rendering/renderers/gpu/shader/GpuProgram.mjs';\n",
                '',
              ],
              ["import wgsl from './particles.wgsl.mjs';\n", ''],
              [
                `    const gpuProgram = GpuProgram.from({
      fragment: {
        source: wgsl,
        entryPoint: "mainFragment"
      },
      vertex: {
        source: wgsl,
        entryPoint: "mainVertex"
      }
    });
`,
                '',
              ],
              ['      gpuProgram,\n', ''],
            ],
            'the particle WGSL exclusion',
          );
        }
        // Every path the game draws is built from points; nothing hands Pixi
        // SVG markup or an SVG path string, so the parser becomes a loud stub.
        if (
          /[/\\]pixi\.js[/\\]lib[/\\]scene[/\\]graphics[/\\]shared[/\\]GraphicsContext\.mjs$/.test(
            id,
          )
        ) {
          return replaceExactly(
            code,
            [["import { SVGParser } from './svg/SVGParser.mjs';", omittedPixi('SVGParser')]],
            'the SVG parser exclusion',
          );
        }
        if (
          /[/\\]pixi\.js[/\\]lib[/\\]scene[/\\]graphics[/\\]shared[/\\]path[/\\]GraphicsPath\.mjs$/.test(
            id,
          )
        ) {
          return replaceExactly(
            code,
            [
              [
                "import { parseSVGPath } from '../svg/parseSVGPath.mjs';",
                omittedPixi('parseSVGPath'),
              ],
            ],
            'the SVG path exclusion',
          );
        }
        if (
          /[/\\]pixi\.js[/\\]lib[/\\](accessibility|events|dom|spritesheet)[/\\]init\.mjs$/.test(id)
        ) {
          return { code, map: null, moduleSideEffects: false };
        }
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // No includeAssets or manifest icons: globPatterns already precaches every
      // icon, and listing them again put each one in the manifest twice.
      includeManifestIcons: false,
      workbox: {
        /*
         * Sound effects precache: the whole set is well under a tenth of a
         * megabyte, and a footstep that arrives on the second walk is worse
         * than one that costs nothing to have ready. Music, when there is
         * any, must be excluded here — a first load on a tablet has to stay
         * a breath (ADR 0012).
         */
        globPatterns: ['**/*.{js,css,html,svg,png,webp,json,woff2,ogg}'],
        /*
         * The precache manifest is inlined in sw.js, which the JavaScript gate
         * counts (ADR 0048), and two hundred 32-digit md5 revisions do not
         * compress. A revision only has to change when its file does, so twelve
         * hex digits keep a 1 in 2^48 chance of an edit going unnoticed and
         * save 2.3 KB gzipped. Hashed build assets carry no revision at all.
         */
        manifestTransforms: [
          (entries) => ({
            manifest: entries.map((entry) => ({
              ...entry,
              revision: entry.revision ? entry.revision.slice(0, 12) : entry.revision,
            })),
            warnings: [],
          }),
        ],
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
        description: 'A hot-seat turn-based tactical RPG set after Korra. Non-commercial fan work.',
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
