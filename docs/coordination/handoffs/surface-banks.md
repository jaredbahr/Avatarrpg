# A pool meets the ground on a ragged bank

- **Updated:** 20 September 2026, scheduled DeepSeek Flash continuation run.
  Incoming owner: the next scheduled session for the same goal; no successor
  assigned at handoff.
- **Outcome:** the authored **oil, mud, rubble and ice** washes no longer fill
  the exact square the rules use. Each surface lays a thin coat over its whole
  tile, a firmer coat inside a ragged, seeded outline, an irregular bank and a
  wandering rim that the material gathers along — on both renderers. Ships as
  playable version `0.2.5`.
- **Acceptance:** `npm run verify` passes on this head (typecheck, lint,
  formatting, 889 tests in 107 files). The route review harness passes both
  backends at 1368x912 and at portrait 834x1194 with Huge text. The production
  build passes with entry `index-CnqluOEF.js` at 298.2 KB gzipped of the
  unchanged 300 KB budget. Required Linux exact-head CI has not run yet.
- **Location:** worktree `C:/Users/Jared/.codex/worktrees/ground-contact`,
  branch `codex/ground-contact` based on `origin/main` at `344376f` (the v0.2.4
  merge). Clean tree; `.shots/route-v025*` and `.shots/probe/*` are ignored
  capture evidence; the scratch probe spec and its config were deleted before
  commit; no preview server left running.

## What changed

- `src/render/surfaceRendering.ts`: `surfaceOutline` walks the tile's own
  perimeter clockwise and insets each **open** edge by a `tileNoise` depth, so
  one pool has one ragged outline and a side shared with the same material
  stays on the tile edge. `surfaceRim` returns the same walk per open edge for
  the bank band, the gathered material and the rim stroke.
  `SURFACE_RIM.wash` is how far the wash thins (6–17% of a tile) and
  `SURFACE_RIM.coat` splits the material alpha into a base and an interior
  coat. `SURFACE_RIM.spread` is the shader's matching wander.
- `src/render/painters/tiles.ts`: the wash is now a base coat over the whole
  tile plus a firmer coat inside that outline, the bank and rim follow the
  outline instead of the tile edges, and mud, oil and rubble gather along it.
  Ice, fire and steam keep the plain bank.
- `src/render/backends/shaders.ts`: `edgeDistance` is perturbed by
  `vnoise(w * 2.0)` and feeds an `interior` factor that scales the ice, mud,
  oil and rubble washes, so WebGL fades at the bank too.
- `docs/adr/0042-ragged-surface-banks.md`, `package.json`,
  `package-lock.json`, `CHANGELOG.md`: the decision, version `0.2.5` and the
  player-facing note.

## Evidence

- **Diagnosis (why this and not "prop shadows").** The 20 September review read
  two stone stacks on the Driller floor as "sitting on plain dark rectangles
  rather than a grounded shadow". A throwaway Playwright probe (`centerTile`
  11,7 at 1:1, canvas + WebGL) sampled the pixel and mapped it back through
  `rendererCamera().groundTransform`: the rectangle is tile **(11,5)**, whose
  tile carries `surface: { id: 'mud', duration: -1 }`. Re-running with
  `scene.ground = []` removed it; painting `terrain === 'wall'` magenta showed
  the wall tile's own thin fill separately. So the "shadow" is an authored mud
  patch drawn to the tile square — a surface-bank defect, not a prop-shadow or
  a baked-art defect. No image generation was needed.
- **Stills:** `.shots/route-v025/{canvas,webgl}/` (1368x912) and
  `.shots/route-v025-portrait/{canvas,webgl}/` (834x1194, Huge text) from
  `npx playwright test -c playwright.route-visual.config.ts` with
  `FNT_REVIEW_BROWSER_CHANNEL=chrome`; each folder carries the harness's own
  `provenance.json`. Before/after crops of the same camera are in
  `.shots/probe/{before,rim,rim2,rim3,final}/` (machine-local, ignored).
- **What the stills show:** in `battle_grumbler-fit.png` the mud patch beside
  the lower stack and the oil patches behind both stacks now fade at their
  boundaries and are edged with a wavy rim and uneven grit instead of a ruled
  line; the same reads in `battle_quarry_gate-64.png` on the gate's oil
  channel. Canvas and WebGL agree in character but not pixel for pixel, as
  before.
- **A caught regression:** the first implementation walked each side in its own
  direction, which folded the closed outline over itself at every corner and
  filled the pools with visible triangular fans. The perimeter walk
  (`perimeterPoint`) and a `never draws outside the cell` test in
  `painters/tiles.test.ts` hold that line.
- **Contracts kept:** the base coat still covers the whole hazard tile and no
  outline point leaves it (`surfaceRendering.test.ts`, `painters/tiles.test.ts`);
  the tactical bank, the colourblind hatch and the High-contrast path are
  untouched; no rule, save, preview or content change.
- **Budget:** 298.2 KB gzipped of the unchanged 300 KB, up 0.4 KB from v0.2.4.

## Findings worth keeping

- The route's ground is authored art, and the generator
  (`scripts/art/quarry-route-ground.ts`) leaves **dynamic** cells (`~`, `o`, `m`)
  and **void** cells (`#`) transparent, so those cells show the procedural
  terrain and the live surface. That is why a mud or oil patch is the only thing
  drawn there, and why its outline was exactly the tile square.
- A blocked wall tile in a partial scene still shows its own flat terrain fill
  where the authored scenery piece does not cover the tile diamond — a thin
  strip at a stack's base today. It reads as the stack's base contact; if a
  later pass changes it, do it as a contact shadow rather than as more wash.
- `surfaceRim`/`surfaceOutline` are pure and seeded, so a boundary never
  shimmers and the WebGL decor bake stays stable.

## Open gaps (not closed by this change)

- **Prop contact shadows** — the flat ellipses under barrels, carts, rubble and
  figures (`painters/shapes.ts#groundShadow`, `spriteCache.ts`) — are untouched,
  and are the review's remaining bounding item.
- The pond and canal bed/bank **plates** are still uniform teal fields and the
  quarry floor's pale stain is still flat: art, not painter.
- Water's own wash still insets itself with a rectangle on Canvas; the shader's
  water uses a different foam bank. They were left alone to keep this change
  bounded.
- Audible listening, physical Surface/iPad play and a continuous manual
  playthrough remain untested, as before.

## Next actions

1. Read the CI run this push starts: `Typecheck, lint, unit tests`,
   `End-to-end (Chromium touch, WebKit iPad)` and `Screenshot gallery` on this
   exact head; auto-merge is enabled with a merge commit. After the merge,
   confirm the Pages deployment and that the live title shows `v0.2.5`.
2. Soften the prop contact shadow next: one feathered, grounded shadow for
   pillar-, crate- and rubble-class props in `painters/shapes.ts`. Check that
   `groundShadow`'s 0.86-of-the-box baseline stays put so no sprite shifts.
3. Then re-capture and compare against the three approved references again; the
   remaining review items are the field dressing and the pond/canal plates.

## Completion

Not merged at handoff: the revision is pushed for exact-head CI. The outgoing
owner relinquishes `src/render/surfaceRendering.ts`,
`src/render/painters/tiles.ts`, `src/render/backends/shaders.ts`, their tests,
ADR 0042 and this handoff.
