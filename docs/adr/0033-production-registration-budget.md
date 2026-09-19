# ADR 0033: Omit unused content and atlas initialization

**Status:** accepted, 2026-09-19

The combined 0.2.1 candidate exceeded the unchanged 300 KiB aggregate gzipped
JavaScript budget at 305.2 KiB, including worker and service-worker scripts.

Load `validateContent` dynamically inside the existing development-only branch.
Production never called this validator, but its static import retained schema
initialization. CI still validates all content; runtime save, audio and effect
schemas and their error messages remain intact.

Extend the existing optional Pixi registration exclusion to `spritesheet/init`.
The game parses atlas JSON through `src/render/sheets/atlasJson.ts` and loads
shared sheets for both backends. It does not use Pixi Assets or Spritesheet.
Keep all texture-source, graphics, text, particle and filter registrations.
Using Pixi's atlas loader in future requires restoring its registration first.

Also register only Pixi's browser environment. The application has no
`Worker`, `OffscreenCanvas`, or `WebWorkerAdapter` path, so registering
`webworkerExt` retains an unused Pixi worker-environment chunk. The Vite
transform replaces only `extensions.add(browserExt, webworkerExt)` with the
browser registration and guards the exact upstream call. Pixi's browser
environment, rendering registrations, application PWA service worker, and
the game's asset loading all remain present. Any future worker renderer must
remove this exclusion and add browser coverage before it ships.

The Canvas2D backend is implemented by the application's separate canvas
renderer; Pixi is constructed only as `WebGLRenderer`. Omit Pixi's
`CanvasFilterSystem` registration while retaining its `FilterSystem` and
`FilterPipe` registrations used by WebGL. The guarded transform fails if the
upstream registration shape changes. A future Pixi CanvasRenderer requires
restoring this system and covering that path.

The production build retains its original dynamic chunks and minifier settings.
No dependency files, validation messages, budgets or CI checks change. The local
candidate totals 297.8 KiB with PWA output present. Renderer and offline checks
must pass on the integrated candidate before release.
