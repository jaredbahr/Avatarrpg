# Ground joins over the authored route

- **Updated:** 20 September 2026, scheduled DeepSeek Flash continuation run.
  Incoming owner: the next scheduled session for the same goal; no successor
  assigned at handoff.
- **Outcome:** where two ground materials meet, the board now shows a dressed
  join instead of ending each material on a bare line, and standing water is
  treated as a material of its own, so a pond keeps a sandy bank, bank stones
  and reeds instead of a tile-shaped outline. The join is drawn from the rules
  grid over the authored ground as well as on procedural ground, on both
  renderers. Ships as playable version `0.2.4`.
- **Acceptance:** `npm run verify` passes on this head (typecheck, lint,
  formatting, 884 tests in 107 files). The route review harness passes both
  backends at 1368x912 and at portrait 834x1194 with Huge text. Fifteen focused
  installed-Chrome cases pass on the production build, including forced WebGL.
  Required Linux exact-head CI has not run for this head yet.
- **Location:** worktree `C:/Users/Jared/.codex/worktrees/route-junction-dressing`,
  branch `codex/junction-dressing` based on `origin/main` at `eabe9ab` (the
  v0.2.3 merge). Clean tree; `.shots/joins-*` and `.shots/route-v024*` are
  ignored capture evidence; no preview server left running.

## What changed

- `src/render/geometry/board.ts`: each tile now carries the material on each of
  its four edges (`TileRelief.seams`), computed once per grid beside the relief.
  Standing water is its own material; a join needs equal elevation.
- `src/render/painters/board.ts`: `paintTileSeams` draws the join — the
  neighbouring material reaching into the tile in a ragged wedge, a contact
  shade, and sparse litter (grass tufts, laid chips, grit, bank stones, reeds).
  `paintTileDecor` calls it, so procedural ground keeps the joins it always
  should have had. `quiet` drops litter and most of the shade for the over-art
  pass, because litter on every edge read as decoration rather than ground.
- `src/render/backends/canvas2d.ts`: `drawSeams` runs over a complete authored
  scene, where the full decor is suppressed.
- `src/render/decorSheets.ts`, `src/render/backends/pixi.ts`: a third decor mode
  (`seams`) bakes the same painter into the WebGL chunks for that scene case.
- `vite.config.ts`: the `omit-unused-pixi-systems` transform drops Pixi's alpha
  mask pipe and the mask filter it alone carries (ADR 0040).
- `package.json` / `package-lock.json` / `CHANGELOG.md`: version `0.2.4` and the
  player-facing notes. ADR 0041 records the ground-join contract.

## Evidence

- **Stills:** `.shots/route-v024/{canvas,webgl}/` (1368x912) and
  `.shots/route-v024-portrait/{canvas,webgl}/` (834x1194, Huge text) from
  `npx playwright test -c playwright.route-visual.config.ts` with
  `FNT_REVIEW_BROWSER_CHANNEL=chrome`; each folder carries the harness's own
  `provenance.json` (seeded Sura/Riko/Kaya `route-review` newGame, direct
  `enterNode` jumps, real wheel zoom and pointer drag). Close-ups at 96 px of
  the forest pond and road edge are in `.shots/joins-close/` and
  `.shots/joins-compare/` in this worktree (ignored, machine-local).
- **What the stills show:** the pond's outline is no longer a clean polygon —
  the sand bank eats into the water with a ragged edge, with a stone or two and
  a reed clump on some edges — and the road/paving material boundaries are worn
  rather than ruled, on both backends. The join is deliberately quiet: a
  stronger version drew a band of evenly spaced stones along every boundary and
  looked worse than the bare line, which is why litter is sparse and the
  over-art pass is muted.
- **Where it is visible:** over every partial scene whose material edges follow
  the grid (village paving/grass, the forest road and pond, the cutting) and on
  procedural ground when art is missing or High contrast is on. It does **not**
  fire across an elevation change by design — the pale stone rim of the quarry
  floor is raised ground, so the Driller battle still shows its authored cliff
  edge rather than a join.
- **Focused browser cases (installed Chrome, production build):**
  `e2e/renderer.spec.ts`, `e2e/partial-ground.spec.ts`, `e2e/explore.spec.ts`
  on the `surface-touch` project — 15 passed in 43.6 s.
- **Budget:** `node scripts/check-bundle-size.mjs` reports 297.8 KB gzipped of
  the unchanged 300 KB, with the PWA output present; the ground-join painter
  costs about 0.5 KB and the alpha-pipe exclusion saves about 2.5 KB. Before
  them the shipped product sat at 299.8 KB with 0.2 KB to spare.

## Findings worth keeping

- **The route's ground is authored art.** Every map from Ba Dan to the quarry
  floor is a `groundMode: 'partial'` scene, so the procedural decor pass —
  including the joins as first written — never runs in normal play; only the
  fallback and High-contrast paths saw it. That is why the over-art pass exists,
  and why any further "the material edge is bare" work has to decide between
  runtime dressing (this) and authored art (the regions themselves).
- **Removing Pixi's color and stencil mask pipes breaks WebGL here.** With
  `AlphaMaskPipe`, `ColorMaskPipe` and `StencilMaskPipe` all removed from
  `SharedRenderPipes`, `e2e/renderer.spec.ts` found no board pixels at all on
  this host's software rasteriser; with only the alpha pipe removed, the same
  spec passes (3/3). ADR 0040 records the narrower decision.
- The joins are seeded from `tileNoise`, so a boundary never shimmers; the
  decor signature now includes standing water, so a puddle that appears or dries
  re-bakes the shore it touches.

## Open gaps (not closed by this change)

- Audible listening and physical Surface/iPad play: still untested, as before.
- The route review's remaining items: the pond and canal bed/bank _plates_ are
  still uniform teal fields and the quarry floor's pale stain is still flat
  (art, not painter); prop and wall contact shadows are still hard rectangles;
  large fields still carry no dressing; the board's outer polygon edge against
  the paper is untouched by this pass.
- No manual playthrough of this head; the browser evidence is seeded fixtures
  plus focused cases, not a continuous run.

## Next actions

1. Read the CI run this push starts: `Typecheck, lint, unit tests`,
   `End-to-end (Chromium touch, WebKit iPad)` and `Screenshot gallery` on this
   exact head; auto-merge is enabled with a merge commit. After the merge,
   confirm the Pages deployment and that the live title shows `v0.2.4`.
2. Re-capture the route with the harness and compare against the three approved
   references again — the joins changed the material boundaries, so item 3 of
   the 20 September review (prop and wall contact shadows) is the next bounded
   render step, and item 2 (the pond/canal bed and bank plates, the quarry
   stain) is an art task for an image-generation session.
3. Keep the JS budget in mind: 297.8 KB of 300 leaves ~2.2 KB, so the next
   product change has room but should still be measured.

## Completion

Not merged at handoff: the revision is pushed for exact-head CI. The outgoing
owner relinquishes these files: `src/render/geometry/board.ts`,
`src/render/painters/board.ts`, `src/render/backends/{canvas2d,pixi}.ts`,
`src/render/decorSheets.ts`, `vite.config.ts`, the new ADRs and this handoff.
