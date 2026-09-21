# Handoff: the tea cel sample waits for the layer's own drawn state

Observed 2026-09-20 21:35 CDT on `codex/tea-cel-flake` (base `main` `87c97b3`).
`e2e/riverside-tea.spec.ts` failed on `main`'s own push run `35547980370` with
"the tea region must contain the drawn figure" (0 inked of a 60x110 crop, four
samples over ~4 s) on both Chromium touch shards and the WebKit iPad shard.
This change is test-side only: no product file, asset or workflow changes.

## What was wrong

Closing the activities panel reflows the HUD, the map resizes a frame later
through the `ResizeObserver`, and the camera refits a frame after that.
`settleLayout` compares three camera reads two frames apart, so three identical
reads inside that gap hand back a fit that is one layout behind. In that fit
the seated party stands well below the stage bottom — run `35547980370`
measured the projected foot at y 518 on a 485 px stage — and the crop of the
region the assertion would have used came back empty on a software rasteriser.
The retry rail in `teaCel` was three frames, and a slow frame is long enough
that all three stayed inside the same lag.

Two corrections to the first attempt at this repair, both measured here:

- **A `waitForFunction` cannot be the settle.** The clock is faked from
  `page.clock.install()`, so a frame is published when the test asks for one;
  a predicate parked on `requestAnimationFrame` has no frame to wake on and can
  only time out. That is what the staged attempt did — 30 s, 6/6 WebGL repeats.
- **"Foot inside the stage" is not the property to wait for.** On a settled
  camera at this viewport the foot measured y 475 in one local run and y 524 on
  the same 1280x485 stage in another, both with a stable camera and a crop that
  does contain the figure: the crop reaches 55 px above the foot, so it reads
  the seated figure's head and shoulders, and the assertion is on ink. Demanding
  the whole crop inside the stage can never be true and would only time out.

## Change

- The spec settles before it samples: it reads the projected foot, the life
  layer's backing store and its CSS box from inside the page, steps whole
  frames through the faked clock, and stops when the layer has drawn at the box
  it is showing (its store is sized from the camera's viewport, so a store that
  disagrees with the box is a layer that has been resized and not repainted —
  the blank crop) and the camera has held still across two published frames.
- Exhausting the rail is not a failure: it attaches
  `tea-<backend>-foot-settle` with the last store, box and camera key and falls
  through, and the `inked > 0` assertion below still owns the real claim. A
  figure that was never drawn fails however long the wait.
- The `teaCel` retry rail grows from three frames to twenty-four for the layer
  that has resized and cleared but not yet repainted.

## Verification

- `npx playwright test e2e/riverside-tea.spec.ts -c .shots/tea-settle.config.ts`
  (installed Chrome, `--use-angle=swiftshader --enable-unsafe-swiftshader`,
  which is CI's rasteriser path) — `3 passed in 44.8 s` on the first run
  (canvas 8.8 s, webgl 17.8 s), `9 passed in 1.6 m` with `--repeat-each=3`,
  and `6 passed` with `--repeat-each=2` on the final head.
- `npx prettier --check` and `npx tsc --noEmit` clean on this head.
- Not covered here: **CI's own rasteriser is the only place the slow-frame lag
  is measured.** Locally the layer is usually already painted at the right box
  when the rail starts (`store 1280x485`, `box 1280x485`, `painted true` on the
  first probe), so these runs show the spec passes with the rail, not that the
  rail is what makes CI pass. The next exact-head CI run on this branch is the
  real evidence; if the shard still fails, the attached `foot-settle` artifact
  names the store, box and camera it sampled.

## Next actions

1. Let this branch's CI decide; do not touch release PR #69's head for this
   change. If CI is green, merge as its own PR — the flake is on `main`, so it
   is not a release-only fix.
2. Release PR #69 (head `13eac9c`, run `35551860339`) owns the pond-bed colour:
   let it finish, check Pages serves the merge, and capture the pond against
   the references.
