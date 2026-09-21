# Handoff — forest road exterior apron (v0.2.x candidate, unmerged)

> Shipped inside **v0.2.8**, batched with the quarry-gate surround and the
> Ba Dan apron; see [the release handoff](exterior-aprons-release.md).

Owner: DeepSeek Flash scheduled continuation, 20 September 2026 (session
worktree `C:/Users/Jared/.codex/worktrees/forest-road-apron`, branch
`codex/forest-road-apron`, based on `89a65df`, the v0.2.6 + tea-settle merge).

This branch is deliberately **draft, no PR**: PR #69 (v0.2.7) held the release
gate while this was written, and `codex/frame-surround-coverage` and
`codex/village-outer-apron` are already queued behind it. A fourth PR would have
spent a full CI run on a head that the rebase replaces.

## What this change is

The forest road had the defect the Ba Dan apron fixed inside the village: the
authored plates covered the board and stopped, so the outer grass and both road
ends met the bare page along one hard diagonal. This adds
`public/art/maps/forest-scene/exterior-apron.webp`, packed by
`scripts/art/forest-exterior-apron.ts` and registered last in
`FOREST_ROAD_SCENE.ground`.

Unlike the village apron, it paints no new colour: it continues the route's own
authored pixels (`grass-north`, `grass-south`, `route-ground`, in draw order)
outward along the normal, walking past the pond, ledge and cover cells to the
ground they stand on. The road therefore leaves the board as road. `scene.ground`
may still hold twelve pieces — the identical hunk `codex/frame-surround-coverage`
and `codex/village-outer-apron` already carry, so the three merge cleanly.

## Evidence on `HEAD`

- `npx vitest run scripts/art/forest-exterior-apron.test.ts` — three tests: the
  packed plate is byte-identical to the shipped file; no apron pixel past the
  2.2-tile fade, and none inside the board that overpaints authored ground
  (`GUARD_ALPHA`); the plate is pinned to `FOREST_ROAD`'s own 20x12 size and its
  scene entry; the band is painted at six rim points; the rim seam is closed
  (ground plus apron cover more than 245/255 at four faces); and the road leaves
  as road while the meadow leaves as meadow, measured against the mean authored
  colour of each material.
- `npm run verify` on this head — recorded in the PR-less branch push summary
  below (see the commit message for the pass line).
- Local composites, both with and without the apron:
  `npx tsx scripts/art/forest-apron-preview.ts [--no-apron]` writes
  `.shots/forest-apron/preview{,-no-apron}.png` (`.shots/` is git-ignored). They
  show the hard diamond replaced by ground that continues and dissolves.
- **In-engine frames, both backends:**
  `FNT_REVIEW_BROWSER_CHANNEL=chrome npx playwright test -c
playwright.forest-apron.config.ts` runs the committed review fixture
  `e2e/forest-apron.review.ts` (not in the default projects, so it never runs in
  CI) and writes `.shots/forest-apron/{canvas,webgl}/{fit,rim-*}.png` from the
  `forest_explore` node: the default follow camera, then zoom 64 on the north,
  west, east and south rim and both road exits (`0,4` and `19,4`). Those frames
  found the combed-band defect below and then confirmed its repair: the road
  continues out of frame on both flanks, the grass keeps its texture, and the
  ground dissolves into the page.

## Open gaps (not closed by this change)

- **The seam is closed and the combed band is fixed** (both recorded in
  `docs/art/forest-exterior-apron.md`). The seam band reaches 0.35 tiles inside
  the rim and fills only where the whole ground composite is thinner than
  `GUARD_ALPHA`, so the invariant is "never overpaint authored ground" rather
  than "never paint a playable pixel" (`village-outer-apron` kept the stricter
  one because its own cells are procedural and its rim did not feather). Its
  cell-quantised contour reads as texture noise in both backends' frames, not as
  a line.
- **The frames are not a playthrough.** They are the exploration follow camera on
  both backends at one viewport; the forest road's combat framing, the quarry
  side of the transition and the return have not been re-walked with the apron in
  place, and nothing was checked on a physical device, at Large text, or by
  listening.
- Nothing here was checked on a physical device, at Large text, or by listening.

## Next action

1. Once v0.2.7 has merged, rebase this branch onto `main`; keep the 0.2.x number
   that is still free after `codex/frame-surround-coverage` and
   `codex/village-outer-apron` land, and add the changelog entry.
2. Re-capture the frames after the rebase, walk the forest road's combat framing
   with the apron in place, and set the changelog entry.
3. Then open the release PR with merge-commit auto-merge under Jared's standing
   policy, and confirm Pages serves the new version.

If a later session decides the seam fill is worse than the hard rim it replaces,
the reviewable alternative is to drop the fill and rebuild the two grass packs
with an opaque rim row instead.
