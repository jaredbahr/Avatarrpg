# Handoff — the paving side of the ground tone step

Owner: DeepSeek Flash interim run, 2026-09-21 (after PR #74 was pushed and its
exact-head CI was already running). Branch `codex/road-tone`, worktree
`C:/Users/Jared/.codex/worktrees/road-tone`, based on **`codex/village-density`
`8c57646` (v0.2.10)** on purpose: that branch rewrites the same apron plates and
the same palette block, so this branch layers on it and rebases cleanly when #74
merges. **No PR was opened and nothing was pushed to `main` or to #74**: the
release head was left untouched while its run `35659737521` is in flight.

## The gap this addresses

[`village-ground-tone-repair.md`](village-ground-tone-repair.md) records the road
half as untouched: `TERRAIN_STYLES.road` and `.stone` were still the legacy dark
tones, so wherever the illustrated village is not covered by a plate — the rim,
and the generated apron that continues the outermost cell's material outside it —
the board fell back to a dark grey band against light illustrated paving.

## Measured first

Scratch probe `.shots/pavingtone.spec.ts` (not committed) captures the same
authored / no-ground / no-art trio as the grass probe, on the committed review
fixture, viewport 1368x912, default follow camera, `village_explore`:

| Measure (canvas, same script)                    | before       | after         |
| ------------------------------------------------ | ------------ | ------------- |
| authored paving vs procedural cells, seam pixels | 1.65x        | 1.51x         |
| — road only                                      | 1.49x        | 1.48x         |
| — stone only                                     | 1.95x        | 1.61x         |
| east road band window `600,350–900,430`          | 2.06x        | 1.65x         |
| — authored plate tone / cell tone (luminance)    | 189.9 / 92.0 | 190.2 / 115.1 |

The fixed-window pair is the honest one: identical window, identical script, and
the authored column is the illustrated plates (unchanged by definition). The
"seam pixels" row is self-selecting — it only samples pixels that still disagree
by more than 24/765, so it understates the lift and its sample shrank 2429 →
2015 pixels as the cells moved toward the art.

## What moved

1. `src/render/palettes.ts` — `TERRAIN_STYLES.road` `#5b5044/#4a4036/#6b6053`
   → `#776f5d/#665f4f/#877f6c`; `stone` `#565452/#434140/#666461` →
   `#8a8880/#77756e/#9a988f` (same fill→edge→detail offsets as before).
2. `src/render/backends/shaders.ts` — `TERRAIN_COLORS` road `vec3(0.357, 0.314,
0.267)` → `vec3(0.467, 0.435, 0.365)`, stone `vec3(0.337, 0.329, 0.322)` →
   `vec3(0.541, 0.533, 0.502)`, the Canvas fills exactly.
3. `docs/art/prompts/maps/{ba_dan_village,forest_road,ambush_road,quarry_gate,
ba_dan_riverside,quarry_floor}.md` — the two hue anchors moved with the
   palette; `src/content/prompts.test.ts` rejects a prompt quoting a hex the
   palettes no longer hold.
4. `public/art/maps/ba-dan-scene/exterior-apron-{1,3,8,10}.webp` — re-cut with
   `npx tsx scripts/art/ba-dan-exterior-apron.ts`; only the four bands that
   carry the road or paving reach changed.

## Checks on this head

`npm run verify` green (922 tests / 114 files; typecheck, lint, format).
`npm run build` + `scripts/check-bundle-size.mjs` 299.8 KB of 300 KB gzipped
(unchanged code size). `npm run art:validate` and `npm run check:assets` green
(precache 17.62 MB of 25 MB). `scripts/art/apron-plates.test.ts` was the only
failing test before the plates were re-cut, and is what pins them to the palette.

## The gate, measured: the blast radius is the fallback, not the art

The open question was whether a _global_ lift would drag the forest road's
packed brown earth and the cutting's flagstone with the village's paving.
`e2e/route-tone.review.ts` (committed, with `playwright.route-tone.config.ts`)
answers it on one fixture — 1368x912, seed `tone-probe`, party Sura/Riko/Kaya,
each node entered directly with the first hand-off card cleared — by shooting
`.map-canvas` only, so the pass-the-tablet card can never cover the frame the
way a whole-page shot did. It writes the authored board, the procedural-only
board and the bare cells per node and per renderer;
`scripts/route-tone-compare.mjs` diffs the two heads' folders ("moved" is a
channel sum over 24).

| authored board, canvas           | pixels moved | share | brighter / darker | mean luminance before -> after |
| -------------------------------- | ------------ | ----- | ----------------- | ------------------------------ |
| `battle_forest_road`             | 5,655        | 0.67% | 5,655 / 0         | 106.5 -> 126.7                 |
| `battle_ambush` (cutting)        | 1,914        | 0.23% | 1,914 / 0         | 144.6 -> 156.2                 |
| `village_explore` (control)      | 18,160       | 1.85% | 18,160 / 0        | 107.1 -> 129.4                 |
| `battle_grumbler` (quarry floor) | 20,143       | 2.37% | 20,143 / 0        | 87.6 -> 112.0                  |
| `battle_quarry_gate`             | 243          | 0.03% | 243 / 0           | 156.0 -> 167.4                 |
| `forest_explore`                 | 5,084        | 0.52% | 5,084 / 0         | 106.6 -> 125.7                 |
| `cutting_explore`                | 2,675        | 0.27% | 2,675 / 0         | 144.2 -> 155.8                 |

The same pair on `?renderer=webgl` moves together: 0.65% (forest road,
98.3 -> 115.3), 0.23% (cutting, 144.6 -> 156.2) and 1.84% (village,
105.4 -> 126.3), as the mirrored `TERRAIN_COLORS` should.

What actually moved is the fallback the plates do not own: on the forest road
the rubble cell's bare stone apron plus a few dozen plate-seam hairlines at the
pond corners (board mean 137.7); one hairline cluster at the cutting's brink
(169.1); the rim and the road/paving apron bands in the village (137.9); the
quarry floor's bare `^`/`A` terrace stone. **Every moved pixel on every board
moved toward its board, not away from it**, and the road band of the forest road
board is fully covered by the authored plates, so the raised `road` tone never
shows there at all. Before/after crops at 6x of the pond corner and the rubble
apron look the same to the eye; the change is a lightness step in pixels the art
does not cover.

**Decision: keep the global lift.** The village was the only board where the
legacy tone was doing much work; the two boards the route plays most are within
0.7%, and a village-only rim tone would need a second palette key and a second
shader colour to reach the 0.03-0.7% the global key now improves elsewhere.

## Still not measured

- `dirt`, `sand` and `wall` remain at their legacy tones; the probe classifies
  by hue, not by tile, so their own reach is not split out — the board numbers
  above include every pixel they paint on these seven boards.
- The `stone` tone is also the ink for pebbles and the wet-edge sheen in
  `src/render/painters/board.ts`. Pebbles are ~3 px and keep their dark
  outline, and the pond-corner crops look unchanged, but the bank edges have
  not been read as their own pass.
- No playthrough, listening, physical device, WebKit run or Large-text check on
  this head. The frames are the dev container's Chromium, GPU-backed.

## Next action

1. Once #74 has merged, rebase `codex/road-tone` onto that merge commit; the
   diff should reduce to these commits alone, and `npm run verify` on the
   rebased head is the gate for the PR.
2. Open **one** PR — the palette pair plus the probe and the compare script —
   with the tables above. Merge-commit auto-merge, as usual. Do not open it
   while a release run is in flight: the measurement needs no CI.
3. The next unclaimed village step is the two bare fields (`x1..4,y10..14`,
   `x18..22,y1..5`), which want plates assembled like
   `scripts/art/ba-dan-neighborhood-ground.ts`.

## CI cost

No push to `main`, no pull request, no workflow run started, no check re-run,
no dispatch. Two branch pushes, which trigger nothing (`push` is limited to
`main`); `npm ci` in the new worktree, one `npm run verify`, and local probes.
