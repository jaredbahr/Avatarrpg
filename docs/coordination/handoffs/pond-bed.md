# The pond gets a bed under its water

- **Updated:** 20 September 2026, third scheduled DeepSeek Flash continuation.
  Incoming owner: the next scheduled session for the same goal.
- **Outcome:** the forest pond's water cells now carry an opaque bed — the
  forest's own floor material, sampled in world space with the road's own atlas
  mapping, shaded darker with distance from the shore — instead of leaving the
  0.4-alpha water film to show whatever ground the pond sat on. Same branch as
  the shore bite; both are still unshipped and land together as the next release
  after PR #68. This is the route review's water item: "the references show an
  irregular shoreline with a visible bed" (submerged stones and bank planting
  are partly met — the atlas's own pebbles show as stones — with reeds still
  open).
- **Acceptance:** `npm run verify` passes (889 tests in 107 files); the bed
  covers every wet pixel, the plate stays free of bank-coloured dry ground past
  the bite and of teal, and the middle of the pond is measurably darker than its
  shelf; both backends pass the route harness. Full numbers in
  [the art doc](../../art/forest-pond-shoreline.md) and
  [ADR 0045](../../adr/0045-pond-bed.md).
- **Location:** worktree `C:/Users/Jared/.codex/worktrees/water-shoreline`, branch
  `codex/water-shoreline`, still off `347cee0` (the v0.2.5 merge), with the shore
  bite in `48698af` and the bed on top. `node_modules` here is a junction to the
  sibling `prop-contact-shadow` worktree's install. A clean rebase onto the #68
  merge is still owed; the two branches touch no file in common
  (`prop-contact-shadow` owns `shapes.ts` / `propFootprint.ts` / `spriteCache.ts`
  and ADR 0043, this one owns the forest pond packer, its plate, its test and
  ADR 0044/0045).
- **Completed:**
  - `scripts/art/forest-shoreline.ts`: `packShoreline(source, atlas)` now paints
    the bed first — the atlas's dry-earth quadrant sampled with
    `forest-route-ground.ts`'s own world mapping, so the substrate continues the
    ground's grain across the wet line — then composites the bite over it.
    `BED_SHELF` 0.78, `BED_SHADE` 0.55, `BED_DEPTH` 1.5 cells, `BED_MOTTLE` 0.07,
    `BED_COOL` red ×0.94 / blue ×1.06. Nothing is synthesised: the material is the
    artist's, only shaded.
  - `public/art/maps/forest-scene/pond-bank.webp`: repacked, 34 822 → 36 562
    bytes. 131 072 bed pixels (all of them wet), 6 014 deeper than 0.9 cells,
    deepest shade 0.387, bite and registration metrics unchanged.
  - `scripts/art/forest-shoreline.test.ts`: the "every water centre is clear"
    contract is replaced by the bed contract — no clear pixel inside the pond,
    `bedPixels === waterPixels`, the plate still carries no teal and no dry bank
    past the bite, the shelf is < 0.85 of the bank's brightness, the middle is
    < 0.8 of the shelf's, the deepest shade stays under `BED_SHELF - 0.6 *
BED_SHADE` and above 0.3, the bite's inner sliver interpolates from bank to
    bed across `BITE_FEATHER`, and every water centre is bed and dimmer than the
    bank.
  - `docs/adr/0045-pond-bed.md`, `docs/art/forest-pond-shoreline.md`.
- **Decisions:** keep the rules tile and the runtime water layer untouched; put
  the bed in the ground plate, where both backends already draw the same asset.
  The atlas was confirmed as this plate's own source before it was used: decoding
  the shipped `route-ground.webp` and comparing it with the sheet at the same
  world points gave a median channel delta of 5 (p90 15) — lossy-encode and
  road/shoulder-mix noise. The bed's own constants were tuned against captures:
  at `BED_SHELF` 0.84 the water read as a pale wash, and 0.78 with 0.55 of depth
  falloff keeps the pond's middle green-teal while showing the bottom.
- **Verification:** on this head, `npm run verify` passes typecheck, lint, format
  and 889 tests in 107 files; `npm run build` plus
  `node scripts/check-bundle-size.mjs` report 298.3 KB gzipped of the 300 KB
  budget with the PWA output present; `npm run check:assets` reports the precache
  at 17.32 MB of 25 MB and the asset budget OK. The route harness
  (`FNT_REVIEW_BROWSER_CHANNEL=chrome npx playwright test -c
playwright.route-visual.config.ts`, `FNT_ROUTE_REVIEW_DIR=.shots/water/bed3`)
  passes 2/2 in 32 s on installed Chrome. Captures: `.shots/water/bed3/`,
  stacked before/after at `.shots/water/bed3/before-after-{canvas,webgl}.png`.
  Measured on the pond's middle 180×130 at `1368x912`: before 70.3/92.3/91.1,
  after 87.8/107.0/96.0 — 17% lighter, still green-teal, now with visible
  substrate and depth. Not covered: no playthrough, no listening, no physical
  device, and the captures are seeded fixtures entered with `enterNode`.
- **Next actions:**
  1. Watch PR #68 (v0.2.6) through its exact-head checks. **At this checkpoint its
     `E2E WebKit iPad` job had FAILED** (`run 35541158404`, head `2ea6775`) on
     `[ipad-landscape] e2e/combat-preview.spec.ts:103 › player action controls are
disabled during an enemy turn`: `controls.moveDisabled` was `false` on the
     first attempt and the retry. Diagnosis: that test forces the battle's
     `turnIndex` to an enemy in one `page.evaluate`, then reads the buttons in a
     **second** task and asserts with a plain `expect`, so it races the enemy
     turn's own start and end; the sibling test in the same file samples the same
     fixture through a retrying `expect(locator).toBeDisabled()`. Nothing in #68
     (`shapes.ts`, `propFootprint.ts`, `spriteCache.ts`, ADR 0043) touches turn
     state, the HUD or the AI. Repair it as one bounded, atomic poll — sample the
     three fields in a single snapshot and poll until the snapshot shows the
     enemy turn with the controls disabled — then push that as #68's new head
     after the current run finishes, not before.
  2. Then rebase this branch onto the #68 merge, add the `0.2.7` version bump,
     the changelog entry and the PR text, re-run `npm run verify` plus the route
     capture (the #68 merge changes prop contact, so re-capture), and open the PR
     with merge-commit auto-merge.
  3. Remaining review art after that: reeds and bank planting at the pond, the
     village canal's bed and bank, the quarry floor's flat stain, and field
     dressing for large flat fields. Note for the orchestrator: those need
     _generated_ material, and this unattended DeepSeek environment has no
     image-generation tool and no `OPENAI_API_KEY`, so the reusable-material
     route taken here (the atlas's own floor, shaded) is the only lever
     available to a scheduled run.
- **Completion/transfer:** committed on this branch and pushed; no PR yet on
  purpose, because the version bump and changelog must land on top of #68. The
  outgoing owner keeps editing ownership of the packer, its plate, its test and
  the two art documents until the PR is open and reviewed.
