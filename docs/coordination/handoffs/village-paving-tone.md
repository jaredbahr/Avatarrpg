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

| Measure (canvas, same script)                   | before   | after    |
| ----------------------------------------------- | -------- | -------- |
| authored paving vs procedural cells, seam pixels | 1.65x    | 1.51x    |
| — road only                                      | 1.49x    | 1.48x    |
| — stone only                                     | 1.95x    | 1.61x    |
| east road band window `600,350–900,430`          | 2.06x    | 1.65x    |
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

## Not established — the gate before this lands

**Blast radius, unmeasured.** `road` is not one material along the route: the
village's illustrated plaza is bright cream paving (the plates read ~`#d0be8f`
in the window above), while the forest road is *packed brown earth* and the
cutting/quarry paintings are flagstone over earth. A global lift moves every
board that shows road or stone cells without an illustrated plate over them. The
road-heavy boards have **not** been read before/after: the one capture of
`battle_forest_road` came back behind the "hand the tablet over" scrim, so it
carries no tone information. Until the forest road and the cutting are compared
on the same fixture, the alternative is open: keep the global lift, or give the
village rim its own paving tone sampled from the plates and leave `road` alone.
Also unmeasured: `dirt`, `sand`, `wall` remain at their legacy tones, and this
probe reads only the village.

No playthrough, no listening, no physical device, no WebKit run, no Large-text
check on this head. The `stone` tone is also the ink for pebbles and the wet-edge
sheen in `src/render/painters/board.ts`; pebbles are ~3 px and keep their dark
ink outline, but the bank edges want a look in the same before/after pass.

## Next action

1. If #74 merged green, rebase `codex/road-tone` onto the merge commit; the diff
   should reduce to these commits alone.
2. Capture `battle_forest_road` and `battle_cutting` (canvas and webgl) on this
   head with the scrim gone — `enterNode` plus a `waitForIdle`/dismiss, or the
   gallery fixture — and compare against `8c57646` for the same nodes. Decide
   between the global lift and a village-only rim tone from that pair.
3. If the lift holds, open one PR for the pair of commits with `npm run verify`,
   the frames and the before/after table above; otherwise keep the measurement
   and re-scope to the apron.

## CI cost

No push to `main`, no pull request, no workflow run started, no check re-run,
no dispatch. One branch push, which triggers nothing (`push` is limited to
`main`). `npm ci` in the new worktree and local verification only.
