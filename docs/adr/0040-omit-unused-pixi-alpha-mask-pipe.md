# ADR 0040: Omit Pixi's alpha mask pipe and mask filter

**Status:** accepted, 2026-09-20

## Context

The illustrated-world work reached the unchanged 300 KiB aggregate gzipped
JavaScript budget: the shipped product measured 299.8 KiB before the ground-join
painter, leaving 0.2 KiB. A budget is a guard rail for a tablet on a family's
wifi, so the answer is to stop shipping code the game cannot reach rather than
to lift the limit (ADR 0033 set that pattern).

Browser and Canvas rendering both mask, but never through Pixi: the board clips
with a Canvas 2D path (`painters/tiles.ts`), the WebGL ground shader handles the
rest, every other surface is DOM, and a source search finds no mask assigned to
a Pixi display object. `AlphaMaskPipe` is registered by
`rendering/renderers/shared/system/SharedSystems.mjs` for every renderer, and it
is the only importer of `filters/mask/MaskFilter` — 6.1 KiB of minified filter
plus its pipe, carried for a renderer that never draws a mask.

## Decision

Extend the existing `omit-unused-pixi-systems` Vite transform (ADR 0033, ADR 0038) with a guarded replacement for `SharedSystems.mjs` that drops the
`AlphaMaskPipe` import and its entry in `SharedRenderPipes`. The guard throws if
upstream changes that registration, so a Pixi upgrade fails the build instead of
silently shipping the pipe again.

Only the alpha pipe is omitted. Removing `ColorMaskPipe` and `StencilMaskPipe`
in the same edit was measured on the software WebGL rasteriser this project
tests on: `e2e/renderer.spec.ts` then found no board pixels at all, while the
same suite passes with the two pipes left in place. Their cost is small next to
the filter the alpha pipe carries, and a renderer whose stencil state misbehaves
is not a saving worth having.

Measured on the Pages-base production build: 299.8 KiB before, 297.8 KiB after,
including the 0.5 KiB ground-join painter that prompted the review, with the PWA
and service worker present.

## Consequences

Future work that alpha-masks a Pixi container must restore this registration and
cover that path on WebGL before it ships; the guard error names it. Mask
behaviour stays available to the Canvas 2D backend, which is the application's
own renderer, and the color and stencil pipes remain registered. No asset, save,
rules, budget or check changes, and both required renderer checks still run
unchanged.
