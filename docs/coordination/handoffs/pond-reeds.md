# The pond bank carries reeds again

- **Updated:** 20 September 2026, fifth scheduled DeepSeek Flash continuation
  run. Incoming owner: the next scheduled session for the same goal.
- **Outcome:** the forest pond's waterline is planted. Three low reed fringes
  stand on the cells that touch the water, cut from the artist's own flood-bank
  reed mass (`assets/source/forest-bank/old-nest-reeds.png`) with the nest left
  out of the crop. This closes the "reeds and bank planting" half of the route
  review's water item, whose bed and wandered shore this branch already carries.
  Explicitly excluded: any rule, collision, surface, save, preview, camera, UI
  or painter change, and the quarry floor's flat stain.
- **Acceptance:** the shipped plate re-packs byte-for-byte from the tracked
  source; the scene registers three placements, each on a passable cell the
  bank walk measures as touching the water; each keeps the plate's aspect and
  lands on the pond's own registered patch. Held by
  `scripts/art/pond-reeds.test.ts`.
- **Location:** worktree `C:/Users/Jared/.codex/worktrees/water-shoreline`,
  branch `codex/water-shoreline`, HEAD `200cdb7` (base `347cee0`, the v0.2.5
  merge, with the shore bite, the pond bed and the canal bed beneath it). No PR
  yet, on purpose: the `0.2.7` version bump, changelog and PR text land on top
  of PR #68's merge so the release number follows the one already in flight.
- **Worktree state:** committed and pushed with this handoff; `node_modules` is
  a junction to the sibling `prop-contact-shadow` worktree's install.
  Local-only evidence: `.shots/water/reeds1/` (the whole-route harness run on
  this head). Git-ignored; nothing else is uncommitted.
- **Completed:**
  - New `scripts/art/pond-reeds.ts`: `packPondReeds(raw)` crops
    `REED_CROP` = `{ x: 20, y: 545, width: 540, height: 330 }` — the reed fan to
    the left of the nest, whose own alpha bounds start at `(20, 363)` so the
    left edge keeps the artist's pointed tips — then fades only the edges the
    crop cut through (`REED_FEATHER` right 64, top 74, bottom 18, left 0) with a
    smoothstep, and packs to `REED_WIDTH` 512 (512 by 313, 80 570 bytes). Every
    opaque pixel is the artist's; the only new values are alpha on the cut
    edges. Written straight to `public/art/maps/forest-scene/pond-reeds.webp`,
    so it reproduces from a clean checkout.
  - `src/content/scenes/forestRoad.ts`: `REED_PLATE` records the packed size and
    `FOREST_POND_REEDS` derives three passable `SceneScenery` placements —
    cells `(4,5)` 96 wide, `(7,7)` 104, `(5,8)` 120 — with the plate's own
    aspect, the pines' projected foot line `(x + y + 1) * 32` and the nest's
    depth offset, and they join `FOREST_ROAD_SCENE.scenery`. No wall, no fade,
    no ground disk: they are dressing you can walk through, like the nest.
  - `scripts/art/pond-reeds.test.ts` (3 tests): byte-reproducible packing at the
    registered size; the cut edges are clear and the mass rises inward; every
    placement is within half a cell of the water on a passable cell, keeps the
    aspect, sits on the pond patch, keeps the foot line and the depth offset.
  - `src/content/credits.ts` and `NOTICE.md`: the new plate is accounted for as
    this project's own work cut from the flood-bank source.
- **Decisions:** reeds are standing scenery, not ground. The pond plate's own
  contract clears everything past its dry matte, so planting inside it would
  either break that contract or paint over the water the rules own; a scenery
  layer also matches ADR 0039's modular model. The crop starts at the source's
  own alpha bound and ends at x 560, left of the nest, so no second nest is
  painted. **Honest limitation:** the authored material is a washed-up reed
  mass, so the planting reads as low heaps of cut reeds at the waterline rather
  than upright rushes. Upright growth needs generated art, which this
  unattended environment cannot produce; take it only if a future session has
  an image generator available.
- **Verification:** on this head, `npm run verify` passes typecheck, lint,
  format and 897 tests in 109 files. The route harness
  (`FNT_REVIEW_BROWSER_CHANNEL=chrome npx playwright test -c
playwright.route-visual.config.ts`, `FNT_ROUTE_REVIEW_DIR=.shots/water/reeds1`)
  passes 2/2 in 34 s on installed Chrome, Canvas and WebGL, capturing the whole
  route at `1368x912`; `.shots/water/reeds1/{canvas,webgl}/forest_explore-96.png`
  shows the three fringes standing at the pond's edge over the new bed. Not
  covered: no playthrough, no listening, no physical device, and the captures
  are seeded fixtures entered with `enterNode`. Reproducibility, budget and the
  packed size are re-checked before the push and recorded in the rolling
  checkpoint.
- **Coordination:** this branch owns `scripts/art/forest-shoreline.ts`,
  `scripts/art/pond-reeds.ts`, their plates, their tests, ADRs 0044/0045/0046,
  the canal packer and the pond's scenery entries in `forestRoad.ts`. It shares
  no file with PR #68 (`codex/prop-contact-shadow` owns `shapes.ts`,
  `propFootprint.ts`, `spriteCache.ts`, ADR 0043). Do not open its PR before
  #68 merges.
- **Next actions:**
  1. Watch PR #68 (v0.2.6) to its merge on green exact-head checks; Pages must
     serve it before this branch moves to release.
  2. Rebase this branch onto that merge, bump `package.json`/lock to `0.2.7`,
     add the changelog entry and open the PR with merge-commit auto-merge.
  3. Re-run `npm run verify` plus the route capture on the rebased head (the #68
     merge repaints prop contact in the same frames) and attach the stacked
     before/after for the pond and the canal.
  4. Remaining review art after that: the quarry floor's flat stain and field
     dressing for large flat fields, both of which want authored material.
- **Completion/transfer:** committed on this branch and pushed; no PR yet. The
  outgoing owner has relinquished editing ownership of the files above to the
  next scheduled session for the same goal.
