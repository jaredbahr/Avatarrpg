# Handoff — the ground tone step inside Ba Dan (measured, not yet repaired)

Owner: DeepSeek Flash scheduled continuation, 2026-09-21 (interim run while
PR #73 is mid-CI). Branch `codex/village-density`, worktree
`C:/Users/Jared/.codex/worktrees/village-density`, based on `main` `abf6af2`
(v0.2.8 shipped; #73 is v0.2.9, untouched by this branch).

This branch carries **a measurement and its method**, no product change. It was
pushed without a pull request on purpose: a handoff alone must not spend a
release-headed CI run (`docs/coordination/README.md`, "Keep CI work
proportional"). The next revision of this branch should be the repair, and its
PR is the one that spends the run.

## The gap, and why this measurement was the blocker

`ba-dan-exterior-apron.md` records it as an open gap: "the tone step between
authored pieces and procedural cells _inside_ the board is pre-existing and
still visible". `finish-through-driller.md` needs "coherent ... ground
contact" across the route, and the approved
`assets/reference/player-view-2026-09-17/ba-dan-exploration.png` is one
continuous sunlit surface. Before touching either side of the seam, the open
question was **which side moves** — a palette change and an art regeneration
are different repairs with different blast radii.

## Method (reproducible)

The village explore view was captured three times at the default follow camera,
through the real app, on the 1368x912 canvas the review fixtures already use:

1. `authored` — the shipped scene.
2. `procedural` — the same scene with the map's `scene.ground` replaced by `[]`
   (`Object.defineProperty(map, 'scene', ...)` plus `app.resync()`, the same
   fixture trick `e2e/partial-ground.spec.ts` uses). Scenery, actors and the
   camera are untouched.
3. `cells` — ground **and** scenery removed, so every green pixel left is a
   procedural cell.

Per pixel: `authored − procedural` isolates the ground images, and the `cells`
frame isolates the cells that the images do not cover. Frames and the scratch
classifier live in the ignored `.shots/tone/` of this worktree
(`.shots/tone.mjs`, `.shots/cover.mjs`) so the next session can re-run rather
than re-derive them.

## What it measured (Canvas, 1368x912, `village_explore`, default camera)

- **Authored ground**: mean `#8d9557` over 59,528 samples (2px grid).
- **Bare procedural cells still on screen**: mean `#425830` over the 48px grid,
  matching `TERRAIN_STYLES.grass.fill` `#41552f` exactly.
- **A large contiguous band of them**, not a hairline: the 48px class map shows
  the whole south-west field (roughly rows 8–13, columns 0–11 of the map) and
  the north-east field as bare cells, meeting the authored plaza on a hard
  diagonal. About a third of the green ground in that view is procedural.

So the step is **1.9x in luminance across a long, straight seam** — the dark
olive legacy board tone meeting the light illustrated ground the game is now
built from. That matches the visible dark band in
`.shots/rim-probe/{canvas,webgl}/village_explore-fit.png`.

The forest road was measured the same way: its bare cells are **1,708 sampled
pixels against 211,335 authored ones**, so it barely shows the seam. The seam is
a village-and-quarry problem, not a route-wide one.

## The repair this points at, with its exact chain

Move the **procedural cells up to the illustrated tone** (the reverse — dulling
the approved art — contradicts the reference). That is one value, but it is
mirrored in four more places, all of which must move together:

1. `src/render/palettes.ts` — `TERRAIN_STYLES.grass` (`fill`, `edge`, `detail`).
2. `src/render/backends/shaders.ts` — `TERRAIN_COLORS`, whose `vec3(0.255,
0.333, 0.184)` _is_ `#41552f`; the WebGL base colour must stay equal to the
   Canvas style (backend parity is mandatory, fidelity is not).
3. `scripts/art/ba-dan-exterior-apron.ts` imports `TERRAIN_STYLES` and repaints
   the rim from it, so `public/art/maps/ba-dan-scene/exterior-apron.webp` must
   be regenerated and its byte-identical repack test re-run.
4. `docs/art/prompts/maps/{ba_dan_village,forest_road,ambush_road}.md` quote
   `#41552f` as the palette anchor, and `src/content/prompts.test.ts` allows only
   hexes that exist in the palettes.
5. The forest apron mirrors the forest's own authored pixels, so it needs no
   change; check its rim against the lightened cells after the move.

## Risks the next session must check, not assume

- **Combat readability**: `TERRAIN_STYLES.grass` is also the fallback under
  combat boards and behind every surface wash. Read ADR 0007/0008 before
  committing to a value; a lightening that flattens the grid is a regression
  even if the village seam closes.
- **Colour assertions**: `e2e/painted-rubble.spec.ts`,
  `e2e/partial-ground.spec.ts` and `e2e/forest-aftermath.spec.ts` read real
  pixels; they compare mostly relative shifts, but re-run them before pushing.
- **The gallery** captures the village and the road, so its frames will move;
  that is expected for a tone change, not evidence of a failure.

## Next action

1. Re-capture first (`.shots/tone.mjs`), pick a `fill`/`edge`/`detail` triple
   that lands between `#425830` and `#8d9557` while keeping the cell detail
   readable, then make the five-part chain above in one commit.
2. `npm run verify`, regenerate and `art:validate` the village apron,
   `npm run build` + `scripts/check-bundle-size.mjs` (the ceiling is 299.8 of
   300 KB gzipped, so this must stay byte-neutral), then re-capture the village
   and forest rims on Canvas and WebGL and read them against the reference.
3. Rebase on #73's merge commit, take the next free patch version (0.2.10 at
   this checkpoint), open the PR and arm merge-commit auto-merge.

Not claimed by this branch: a playthrough, listening, a physical device, or any
large-text check. The measurement is a fixture at one viewport, on Canvas.
