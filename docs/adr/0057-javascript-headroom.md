# ADR 0057: Recover JavaScript headroom without raising the gate

**Status:** accepted, 2026-09-28

## Context

The production JavaScript gate (ADR 0048) is 320 KB gzipped. The shipped total
had reached 317.5 KB, with pending UI-polish and forest-wind work together
landing near 320 and bend integration still owing render code. Raising the gate
is a separate budget decision; this ADR only stops shipping bytes that the game
cannot reach.

`scripts/check-bundle-size.mjs` sums the gzip size of every `.js` file under
`dist/`: the application chunk, Pixi's lazily imported `browserAll` chunk,
`sw.js`, the Workbox runtime and `registerSW.js`. A lazy `import()` chunk still
counts, so splitting code saves nothing against the gate; only deletions do.

Per-module attribution from the production sourcemap showed no dead application
module worth the name, and zod has to stay because it validates save files.
The recoverable bytes were in the build configuration and in Pixi registrations
for renderers the game never creates.

## Decision

1. **Terser without `safari10`.** Vite passes `safari10: true` to terser by
   default. The build targets es2022, which needs Safari 15, so the workaround
   only costs bytes. Saves 0.67 KB.
2. **A compact precache manifest.** The manifest is inlined in `sw.js`, and 200
   md5 revisions of 32 hex digits do not compress. A `manifestTransforms` step
   keeps 12 digits, which leaves a 1 in 2^48 chance that an edited file keeps its
   revision. `includeAssets` and `includeManifestIcons` are dropped because
   `globPatterns` already precaches every icon, and each icon had been listed
   twice. Saves 2.32 KB.
3. **No Canvas or WebGPU graphics and particle pipes.** Pixi is only created as
   a `WebGLRenderer` (ADR 0033), so `CanvasGraphicsPipe`,
   `CanvasGraphicsContextSystem`, `CanvasParticleContainerPipe` and
   `GpuParticleContainerPipe` can never be selected. `ParticleShader` also loses
   its WGSL program. `Shader` binds a GL-only program's resources by name, the
   same path the game's own GL-only filters take. Saves 1.28 KB.
4. **No SVG parser.** Every path the game draws is built from points. Nothing
   calls `Graphics.svg()` or builds a `GraphicsPath` from a string. Saves 2.22 KB.
5. **No tagged-text measurement.** `measureTaggedText` only runs when a
   `TextStyle` has `tagStyles`, and no label the game draws has one. Saves
   1.34 KB.

Items 3 to 5 extend the guarded `omit-unused-pixi-systems` transform in
`vite.config.ts`, following ADRs 0033, 0038 and 0040. Every replacement throws
at build time if the upstream text changes, so a Pixi upgrade fails the build
instead of silently shipping the code again. Omitted functions become stubs
that throw a named error if they are ever called, rather than failing quietly.

Measured on the local production build:

| Production JavaScript | Before (KB) | After (KB) |
| --------------------- | ----------: | ---------: |
| Application bundle    |       302.5 |      297.0 |
| Service worker        |         6.0 |        3.7 |
| Workbox runtime       |         5.1 |        5.1 |
| Browser helper chunk  |         3.8 |        3.8 |
| Registration          |         0.1 |        0.1 |
| **Total**             |   **317.5** |  **309.7** |

## Considered and not done

- **Lazy screens.** Journal, credits and the save-slot manager are each under
  1 KB gzipped, and a lazy chunk still counts against this gate.
- **Replacing zod or moving it to `zod/mini`.** Saves are validated at runtime
  with zod, and the content modules `fx`, `sounds`, `tuning` and `bends` parse
  through it too. Porting them is a rewrite of save validation for about 8 KB,
  so it needs a separate review.
- **Colour names.** Pixi's colord names plugin (about 1.2 KB) resolves the
  `'black'` and `'white'` defaults in `TextStyle` and `FillGradient`. Replacing it
  would change how any named colour resolves.
- **Minifying GLSL strings.** About 0.7 KB of indentation and comments in
  `backends/shaders.ts`. Rewriting shader text at build time is a rendering risk
  that the saving does not justify yet.
- **Colour and stencil mask pipes.** ADR 0040 measured that the board fails to
  draw on the software rasteriser without them.

## Consequences

The gate stays at 320 KB, with about 10 KB of headroom again. A future feature
that draws SVG, uses tagged text, or creates a Canvas or WebGPU Pixi renderer
must first restore the matching registration; the stub's error names this ADR.
Precache revisions are 12 hex digits; the offline behaviour and the precached
set are otherwise unchanged.
