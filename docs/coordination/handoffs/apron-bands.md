# Apron bands: the fix for PR #71's systematic webgl timeout

Owner: DeepSeek interim run, 2026-09-21. Branch `codex/apron-plates` at
`b71e0b5`, worktree `C:/Users/Jared/.codex/worktrees/apron-plates`, based on
PR #71's head `ea0a4b6`. Nothing here is released yet.

## Why

Release PR #71 (v0.2.8, "every scene's ground past its rim") is red on one job
and stays red across attempts: `[surface-touch] e2e/painted-rubble.spec.ts:21`
(`webgl`) dies inside `sample()` at `e2e/painted-rubble.spec.ts:56` with
`page.screenshot: Test timeout of 300000ms exceeded`. The other Chromium
shards, WebKit iPad and the unit job are green on that head, so the cost is in
what this head added, and the added thing is measured: each apron shipped as
one plate, which is the ring's axis-aligned bounding box — 3200 px for the
village and 2688 px for the forest road, against the 2048-pixel texture
`docs/device-matrix.md` promises every iPad takes — and 84.8% / 83.3% of those
plates' texels are fully clear. A screenshot forces the readback that pays for
them.

## What this branch ships

- `scripts/art/lib/apron-bands.ts`: the ring as twelve bands per scene, derived
  from the board's oblique lattice (`u = x - y` across, `v = x + y` down). A
  band is a slice of `v`; its pixels are one interval across a cap and two —
  one per flank — across the hole the board leaves. Every edge is a `min` or a
  `max` of two lines, so no raster work is involved.
- `src/content/scenes/baDan.ts` and `forestRoad.ts` carry those rectangles as
  literals, like every other ground piece, and list them as ground.
  `scripts/art/lib/apron-plates.ts` cuts the shipped WebPs into exactly them.
- `scripts/art/apron-plates.test.ts` proves, against both scenes, that the
  scene table is `apronBands(...)`, that every painted ring pixel is covered
  exactly once, that no band exceeds 2048, that the bands hold under half the
  old plate's area, and that the files re-encode byte-for-byte.
- The single `exterior-apron.webp` files are deleted. Bytes: village 30.3 KB ->
  27.8 KB, forest 166 KB -> 162 KB. `schemas.ts` raises the scene's ground
  bound 12 -> 32, because a ring cannot be one piece under the texture cap.

## Evidence on `b71e0b5`

- `npm run verify` green (917 tests; typecheck, lint, format included).
- `npm run build` + `node scripts/check-bundle-size.mjs`: 299.7 KB of the
  300 KB budget — only 0.3 KB of headroom, so weigh any runtime addition.
- `npm run art:validate` and `npm run check:assets` green; precache 17.59 MB of
  25 MB.
- `scripts/art/forest-apron-preview.ts` (with and without `--no-apron`) shows
  the shipped bands continuing the authored ground past the rim and fading,
  with no seam at a band border.
- Not run: the webgl e2e itself (it only reproduces on the runner's software
  rasteriser) and any physical-device or listening check.

## Next action

Land `b71e0b5` on PR #71's head with one focused push (fast-forward
`codex/exterior-aprons` onto it) once that PR has no run in flight, then let
the required checks judge the new head. If `painted-rubble` still exceeds its
budget there, the plate size was not the cause: the time is spent in
`page.screenshot`, so measure that spec's probe count next rather than changing
art again.
