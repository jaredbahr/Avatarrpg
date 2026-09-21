# Handoff: the pond bed keeps the water blue

Observed 2026-09-20 21:25 CDT on `codex/water-shoreline` (PR #69). The bed pass
shipped a plate that the pixel gate reads as not-water on a software
rasteriser; this change cools the bed until it does, without touching the
brightness the depth gradient is tuned for.

## What was wrong

`e2e/renderer.spec.ts:38` ("renders the board through the WebGL backend when
forced") samples the middle of tile `(5,6)` — an authored water cell — and
requires blue-minus-red above 20. Exact-head CI `35549396144` failed that
assertion twice on both jobs that reach it (`E2E Chromium touch 3/3`, `E2E
WebKit iPad`):

| Where                                            | Sampled `r/g/b` | `b-r` | Verdict |
| ------------------------------------------------ | --------------- | ----- | ------- |
| CI Chromium 3/3, this head                       | 90.7/109.2/94.6 | 3.8   | fail    |
| CI WebKit iPad, this head                        | 92.9/111.7/98.6 | 5.7   | fail    |
| Local SwiftShader, this head                     | 92.6/112.1/99.4 | 6.8   | fail    |
| Local SwiftShader, `main` `87c97b3`              | —               | >20   | pass    |
| Local SwiftShader, this head with `main`'s plate | —               | >20   | pass    |
| Local hardware GL, this head                     | 66.8/89.9/89.9  | 23.1  | pass    |

The control is the point: `main`'s plate passes on the same runner class, and
swapping only `pond-bank.webp` back to `main`'s makes the failing head pass, so
the regression is the bed plate and not the runner, the spec or the reeds. The
`bed3` capture in `pond-bed.md` already recorded the cause in passing — the
pond's middle measured 87.8/107.0/96.0 after the bed against 70.3/92.3/91.1
before, "about 17% lighter, still green-teal" — which is blue-minus-red 8.2
where this gate wants 20. Hardware GL keeps the film's blue over the lighter
bed; both software rasterisers lose it.

## Change

`BED_COOL` moves from red ×0.94 / blue ×1.06 to red ×0.80 / blue ×1.26 in
`scripts/art/forest-shoreline.ts`, and `public/art/maps/forest-scene/
pond-bank.webp` is repacked from the same source sheet. Brightness, shelf,
depth, mottle, bite, feathers and every art contract in
`scripts/art/forest-shoreline.test.ts` are untouched (`deepestShade` still
0.387), so the bed still reads as the forest's own floor seen through water —
it just holds the water's colour on a rasteriser that does not have the GPU
path's blend.

## Verification

- Local SwiftShader, this head, after the change: the forced-WebGL water gate
  passes (22.3 s). Before the change the same command failed with
  `b-r = 6.8`.
- `npm run verify`, `npm run art:validate`, `npm run check:assets` on this
  head: recorded in the commit message.
- Not covered here: a route capture after the colour shift, the WebKit
  rasteriser on this exact plate (CI's `E2E WebKit iPad` is the only place it
  runs), audible listening, or a physical device. The bed's colour is a
  material change on a shipped plate, so the next run should re-run the route
  harness and read the pond against the references before calling the release
  done.

## Next actions

1. Let exact-head CI for this repair finish; the WebKit job is the one that
   decides whether 1.26 is enough on Mesa's software path (CI measured 5.7
   there against 3.8 on Chromium, so the margin is thinner).
2. `e2e/riverside-tea.spec.ts` is the next flake in the same shard, and it is
   independent of this plate: on `main`'s `push` run `35547980370` it failed
   with an empty crop on both jobs, because `settleLayout` can hand back a fit
   one layout behind and the seated party then stands 30 px below the stage.
   A reproducer and the numbers are in the rolling checkpoint; the retry rail
   in `teaCel` (three frames) is too short for a software rasteriser's settle.
