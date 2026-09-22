# Handoff — the two bare village lawns, painted from accepted material

Owner: DeepSeek Flash interim run, 2026-09-21. Branch
`codex/village-outer-fields`, worktree
`C:/Users/Jared/.codex/worktrees/village-outer-fields`, based on the release
head `5a2ee58` (PR #74, v0.2.10) because this closes a gap that release opened.

This is the step recorded as open in
[`village-ground-tone-repair.md`](village-ground-tone-repair.md): the palette
step made the procedural cells match the illustrated lawn's _tone_, but not its
_texture_, and two fields carried no plate at all — south-west `x1..4,y10..14`
and north-east `x18..22,y1..5`.

## What changed

1. `scripts/art/ba-dan-neighborhood-ground.ts` gains two regions beside the
   four existing courts: `northeast-lawn` (`x15..23,y1..7`) and
   `southwest-lawn` (`x0..6,y9..14`), half-open. Both are assembled by the
   same packer, from the same verified opaque source interiors — quiet grass
   (`x10..11,y4`) and broad flagstone (`x5..9,y7..8`) of the tracked courtyard
   asset — with the same `existing()` pixel copy through reviewed overlaps and
   the same 0.4-cell exterior feather. Each new region overlaps its neighbours
   by two or more cells (north house court and east gate approach for the
   north-east; western approach and south house court for the south-west), so
   two exterior feathers can never leave an uncovered band between pieces.
2. Two shipped plates, `public/art/maps/ba-dan-scene/northeast-lawn-ground.webp`
   (1024×512, 36.5 KB) and `southwest-lawn-ground.webp` (832×416, 24.4 KB).
   The map family goes 820 KB → 881 KB, precache 17.62 → 17.67 MB of 25 MB.
   Re-running the packer leaves the four existing plates byte-identical.
3. `src/content/scenes/baDan.ts` registers both frames in
   `BA_DAN_NEIGHBORHOOD_GROUNDS`; `src/content/scenes/baDan.test.ts` decodes
   them, pins three opaque interiors each, and adds three material joins
   (`southwest-lawn`↔`western-approach`, `southwest-lawn`↔`south-house-court`,
   `northeast-lawn`↔`north-house-court`) to the existing ≤8/channel contract.
4. `docs/art/ba-dan-scene.md` describes six pieces and the overlap rule.

## Evidence on this head

- **Coverage probe** (decode every registered ground piece, read the alpha at
  each cell centre, same mapping the packer writes): village cells with no
  opaque plate **144 → 86**; south-west field `20/20 bare → 0/20`;
  north-east field `25/25 bare → 0/25`. The remaining 86 are the deliberate rim
  rows and tree columns.
- **Frames, same fixture, both backends**
  (`FNT_REVIEW_BROWSER_CHANNEL=chrome npx playwright test -c
playwright.ba-dan-apron.config.ts`, 1368×912, canvas and WebGL, 8 views each).
  Canvas: default `village_explore-fit` **9.753%** of pixels moved (all up),
  `rim-0-7`/`rim-0-8` **5.912%** (the south-west field), `rim-23-7` **3.978%**
  (the north-east field's rim column), `rim-23-15` 2.499%, `rim-12-0` 1.463%,
  `rim-12-15` 0.463%. WebGL: 10.558% / 6.044% / 1.445% on the same views with
  the same direction. Moved pixels move _up_ in luminance and onto green —
  this replaces flat cells with the plates' mown lawn, it does not darken the
  board. No pixel moved down by more than 0.03% on any view.
- **Plate proof.** Both new plates were decoded to PNG over flat grey and
  compared with the shipped `north-house-court`/`south-house-court` plates: the
  same swatch repetition, the same paving notches, the same feather. The new
  pieces introduce no new material or technique, so the known tiling banding is
  the accepted one, on more cells.
- **Checks.** `npm run verify` green (922 tests / 114 files; typecheck, lint and
  format included, run after the last file write). `npm run build` +
  `node scripts/check-bundle-size.mjs`: **299.9 KB** of the 300 KB gzipped JS
  budget. `npm run art:validate` and `npm run check:assets` green (map family
  and precache inside budget).

## Open, recorded honestly

- **The camera cannot centre these fields.** Adding `[2,12]` and `[20,3]` to
  the review fixture's rim list and re-capturing both backends moved **0.000%**
  of pixels: at `tilePx` 64 the follow camera's clamp stops short of those
  tiles, so the views were dead ones and were removed again. The two fields are
  therefore evidenced by the neighbouring rim views above and by the coverage
  probe, not by a frame centred on them. A play-zoom capture taken by walking
  the party into each field would close that gap honestly.
- **The bundle is at 299.9 of 300 KB gzipped.** This change cost 0.1 KB of data.
  Any further product code has to pay for itself first.
- **Still flat:** the rim rows and tree columns (86 cells), and the road/stone
  procedural tones (`TERRAIN_STYLES.road` `#5b5044`, `stone` `#565452`), which
  the palette step deliberately did not touch and which remain unmeasured.
- Not claimed: no playthrough, no listening, no physical device, no Large-text
  check, no WebKit run, no comparison against the approved reference beyond the
  views above.

## Next action

Do **not** open this branch's PR while PR #74's exact-head CI is running. Once
#74 has merged, rebase `codex/village-outer-fields` onto the merge commit, run
`npm run verify` on the rebased head, and open one PR for it (the two plates,
the registration, the tests and the art doc).

## CI cost

No push to `main`, no pull request, no workflow run, no dispatch, no re-run.
The branch push triggers nothing (`push` is limited to `main`).
