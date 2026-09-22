# Handoff — the ground tone step inside Ba Dan, repaired

Owner: DeepSeek Flash interim run, 2026-09-21 (second session on this gap).
Branch `codex/village-density`, worktree
`C:/Users/Jared/.codex/worktrees/village-density`, based on **`main` `abf6af2`
(v0.2.8)** on purpose — see "Do not open a PR from this head" below.

This is the repair for the gap measured in
[`village-ground-tone.md`](village-ground-tone.md): the procedural cell tone the
illustrated ground plates are drawn over was the legacy dark olive `#41552f`,
against an authored lawn measured at `#8d9557` — a 1.79x luminance step along
long, straight seams inside the village board.

## What moved

## Also in this release: 0.2.9 hid the illustrated village

Reviewing the tone change on the merged 0.2.9 base showed the village drawing
its **procedural fallback** — grid cells, decor canopies, dark road band — where
the illustrated ground used to be. Cause, confirmed by A/B: `sceneImages` is a
`BackdropStore(16)`, an LRU, and a partial scene paints its authored ground only
when _every_ ground and scenery piece is resident at once. 0.2.9's twelve apron
bands per scene took Ba Dan from 16 distinct scene images to 27 and the forest
road from 10 to 21, so both can never complete: permanent fallback, plus a
re-decode of every evicted piece each frame. Nothing in 0.2.9's checks could see
it — the gallery is an artifact rather than a comparison, and the band proofs
test geometry.

Fix in this branch: `SCENE_IMAGE_CAP = 32` in `src/render/scene.ts`, plus a
content contract in `src/render/scene.test.ts` that fails on exactly those two
scenes (27 and 21) under the old cap. Evidence: `.shots/village-fallback-cap16.png`
against `.shots/village-resident-fixed.png`, and the re-captured
`.shots/rim-probe/{canvas,webgl}/` frames (village and forest, both backends,
both authored again). Measured residency: village 27 pieces / 22.9 MB decoded,
forest 21 / 23.4 MB, against the ~35 MB a quarry scene already keeps resident
under the old cap.

## The tone change

1. `src/render/palettes.ts` — `TERRAIN_STYLES.grass` `#41552f` / `#35471f` /
   `#55693c` → **`#7d8850` / `#717a40` / `#95a060`** (fill / edge / detail, same
   relative offsets, lifted into the illustrated family).
2. `src/render/backends/shaders.ts` — `TERRAIN_COLORS` grass
   `vec3(0.255, 0.333, 0.184)` → `vec3(0.490, 0.533, 0.314)`, the same value as
   the Canvas fill. Backend parity is mandatory; fidelity is not.
3. `docs/art/prompts/maps/{ba_dan_village,forest_road,ambush_road}.md` — the
   grass hue anchor moves with the palette (`src/content/prompts.test.ts` allows
   only hexes that exist in the palettes).
4. `public/art/maps/ba-dan-scene/exterior-apron.webp` — regenerated with
   `npx tsx scripts/art/ba-dan-exterior-apron.ts`. The apron paints the
   procedural grass tone outside the rim, so without this it is a stale dark
   ring around a lightened board. Bytes 30.3 KB → 57.3 KB, still inside the art
   family budget.

**Why the palette and not more art.** Every authored source in the repository
already uses a light grass: the legacy complete paintings
(`public/art/maps/ba_dan_village.webp`, `ambush_road.webp`), the illustrated
plates the villages are built from, and the approved reference. `#41552f` was
the outlier, not the art. The alternative — covering the two bare fields with
more plates sampled from accepted material — is still available and is the
follow-up if the flatness of those fields reads badly (below).

## Evidence on this head

- **A/B, same fixture, same script.** Canvas 1368x912, `village_explore`, the
  default follow camera, 2px grid, green pixels only:
  - before: authored lawn `#8d9656` (n=59,105) vs bare cells `#425730`
    (n=72,189) → **1.79x** luminance;
  - after: authored lawn `#979e5b` (n=54,815) vs bare cells `#79864e`
    (n=74,277) → **1.19x**.
    The before column was re-measured on this head by stashing only the three
    product files, so both numbers come from the same probe.
- **Frames.** `.shots/rim-probe/{canvas,webgl}/village_explore-fit.png` and the
  rim views, captured through the committed review fixture
  (`FNT_REVIEW_BROWSER_CHANNEL=chrome npx playwright test -c
playwright.ba-dan-apron.config.ts`); `.shots/rim-probe-before/` holds the same
  views from before the change for side-by-side reading. Against
  `assets/reference/player-view-2026-09-17/ba-dan-exploration.png` the SW field
  no longer reads as a shadow band, and the WebGL frame matches the Canvas one.
- **Rule layer.** `.shots/views/canvas-village_explore-high.png` under High
  contrast: the ink grid, tufts and stones still read over the lighter grass.
- **Checks.** `npm run verify` green (911 tests / 113 files; typecheck, lint,
  format included). `npm run build` + `node scripts/check-bundle-size.mjs`:
  **299.0 KB** of the 300 KB gzipped budget (JS only; unchanged code size).
  `npm run art:validate` and `npm run check:assets` green, precache 17.61 MB of
  25 MB.
- **Pixel-reading e2e, local, `surface-touch` only:** `e2e/painted-rubble.spec.ts`,
  `e2e/partial-ground.spec.ts` and `e2e/forest-aftermath.spec.ts` — 12 passed
  (canvas and webgl) in 2.2 min. The WebGL cases are the slow ones (22–33 s).

Not claimed: no playthrough, no listening, no physical device, no Large-text
check, and no WebKit run.

## Rebased onto the shipped v0.2.9 (done in this run)

PR #73 (v0.2.9, apron bands) merged at 21:43Z as merge commit `92a30e5`, exactly
on its checked head `cae38c5`. It rewrites this same seam: it deletes the
single-plate `exterior-apron.webp`, ships twelve band plates per scene, raises
the scene's ground bound 12 → 32, and adds
`scripts/art/lib/apron-{bands,plates}.ts`. Nothing in this run touched that
branch or its run until the merge was confirmed on the live API.

This branch was then rebased onto `92a30e5` with one conflict — the regenerated
single-plate `exterior-apron.webp`, which #73 deletes — resolved by taking the
deletion, and `npx tsx scripts/art/ba-dan-exterior-apron.ts` was re-run on that
base so the twelve village bands are cut from the new tone (the `verify` suite
re-cuts them byte-for-byte). The forest apron mirrors the forest's own authored
pixels and needed nothing. On the rebased head: `npm run verify` green (922
tests / 114 files, including the five new residency cases), `npm run build` +
`scripts/check-bundle-size.mjs` 299.8 KB of 300 KB gzipped, `art:validate` and
`check:assets` green (precache 17.62 MB of 25 MB), and the village and forest
re-captured on both backends.

## This branch is the v0.2.10 release

Because 0.2.9 is already serving the fallback village, the residency fix ships
in this same pull request rather than waiting for its own release train: two
content commits under one release commit, one CI run, one merge. The tone change
and the residency fix are independent (the tone is visible in both the authored
ground and the fallback cells), so if the tone change needs to come out, revert
`918506d` alone and keep `4a17f5b`.

## Open, recorded honestly

- **The road and paving side of the same step is untouched.** `TERRAIN_STYLES.road`
  (`#5b5044`) and `stone` (`#565452`) are still the legacy tones, so the apron's
  road band at the east exit still meets the illustrated paving as a dark grey
  band (visible in `.shots/rim-probe/canvas/village_explore-rim-23-7.png` at the
  road's right edge). Grass was the measured gap; road/stone needs its own
  measurement first, because their blast radius is different (the ambush road
  board is mostly `=` road, though it draws its painting rather than the cells).
- **The two bare fields are still flat.** The tone now matches, but the plates
  carry texture the cells do not. The measured fields are the south-west
  (`x1..4, y10..14`) and north-east (`x18..22, y1..5`); covering them with
  regions assembled the way `scripts/art/ba-dan-neighborhood-ground.ts` already
  assembles the other courts is the next art step, and it needs its own review
  for tiling repetition.
- **Uncovered cells remain** across the rim rows and around the fields — 102 of
  the 384 cells have no opaque plate over them, by design (the outer tree rim).
  With the tone matched this is now a texture difference, not a tonal one.
- `#73`'s release also brings the bundle to 299.8 KB gzipped, so any _code_
  added by the follow-up must pay for itself.

## CI cost

No push to `main`, no pull request, no workflow run started, no check re-run.
One branch push, which triggers nothing (`push` is limited to `main`).
