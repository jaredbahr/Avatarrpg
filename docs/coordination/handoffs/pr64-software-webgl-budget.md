# PR64 software-WebGL budget repair

- **Branch:** `codex/pr64-software-webgl-budget`, based on the PR64 head
  `b174495`. Four test-only commits, no product change, no assertion change.
- **Status:** verified locally and pushed as a branch with **no pull request
  opened**, so no second CI run was dispatched while the required PR64 run was
  active. Merge it into `codex/quarry-gate-integration` and push once.
- **Why it exists:** the required browser job has been failing on cost, not on
  behaviour. This replaces the per-spec timeout whack-a-mole with one measured
  constant so the next revision is judged on what it does rather than on how
  many seconds of software rasterisation it can afford.

## What run 35488793966 measured

Head `b174495`, started 2026-09-20T04:18Z, terminal at 04:55Z.
`Typecheck, lint, unit tests` passed. `Chromium touch 1/3` passed in 30.5
minutes, `2/3` failed at 04:46Z, `3/3` failed at 04:36Z, `WebKit iPad` failed
at 04:54Z, and the aggregator correctly failed with the gallery skipped.
Artifacts `playwright-report-chromium-2`, `-3` and `-webkit` (retained 7 days)
hold the traces and reports.

Every failure was a Playwright protocol call still in flight when the test's own
budget ran out — not an assertion failure, and not a stalled page:

- shard 2/3 ran 51 cases before abandoning 8. `painted-rubble.spec.ts` (webgl)
  spent 375.4s over two attempts against a 180s `test.slow()` budget; its last
  recorded step was `Frame.evaluateExpression` at 183s into the attempt.
  `forest-aftermath.spec.ts` (webgl) was flaky: 369.3s over two attempts.
- shard 3/3 ran 22 cases before abandoning 38.
  `resize-presentation.spec.ts` "with normal" (webgl) burned 255.7s over two
  attempts against its 120s `setTimeout`, both attempts ending in a live
  `Frame.evaluateExpression`. Cases that passed were close to their caps:
  `renders the board through the WebGL backend when forced` 107.4s of 120,
  `paints the ground under the tiles on webgl` 59.0s of 120.
- `maxFailures: 1` means each of those timeouts also discarded the rest of its
  shard, so 46 cases produced no result at all.

The `WebKit iPad` job failed differently, and it is not a budget problem: its
131 completed cases took 31.5 minutes and its cap is far from binding.
`reactions.spec.ts` "the confirm step names the reaction before you commit"
failed its second assertion after 33.8s because the confirm bar read `Nobody
there.` — the tap landed next to the staged oil tile. Selecting an ability adds
the aim hint, which changes the map's height, and the camera is measured from
the canvas element, so it refits a frame or two later through the
ResizeObserver. WebKit's frames are fast enough for the projection to beat the
refit; a software-WebGL Chromium frame is slower than the refit itself, which
is why only WebKit saw it. The Chromium shards ran the same case in 2.7s and
passed.

The traces give the underlying rate. In the painted-rubble attempt, steps
alternate between ~6.2s and ~19.9s: two `requestAnimationFrame` waits of about
3.1s each, then a probe of the same tile. That is a forced-WebGL frame costing
**~3s** and a clipped Playwright screenshot costing **~14s** at the Surface
viewport on a runner with no GPU. The Canvas 2D twin cases in the same report
finish in 4–7s. This matches the repo's premise in `docs/device-matrix.md` and
`playwright.config.ts`: CI Chromium reports an unaccelerated WebGL
implementation (the `auto-selects Canvas 2D when WebGL is not accelerated` case
passes), so `?renderer=webgl` is SwiftShader, and WebKit's Linux WebGL is
Mesa's software path.

## What changed

1. `7dcdeb5` — `e2e/budget.ts` exports `SOFTWARE_WEBGL_BUDGET_MS = 300_000` and
   `allowSoftwareWebgl(test, renderer)`. Every spec that forces a renderer now
   calls it, in both engines: the previous allowances ranged from "no
   allowance at all" (`world.spec.ts` gave the Chromium WebGL case 60s,
   `shopfront.spec.ts` and `exploration-walking.spec.ts` had none) through
   `test.slow()`, to one 300s case. Canvas 2D keeps the suite default, and a
   spec that set itself a longer budget keeps it.
2. `cfdcdee` — `settleLayout`'s default wait is 30s, not 10s. The helper needs
   three camera reads two frames apart, so four frames, which is ~12s at the
   measured rate; the gallery already passed 30s to this same helper for
   exactly this reason.
3. `b9e8069` — the painted-rubble live-material colour check and the hatch
   change count sample the same tile in the same state, and `average()` reads
   the same 7x7 centre from either window, so one 96px capture now answers
   both. That removes a screenshot and a frame wait from the most expensive
   case in the suite.
4. `9f3ff87` — `settleMapCanvas(page)` settles the camera and then requires the
   canvas backing store to agree with the CSS box at the device pixel ratio.
   That is the guard the iPad Rock Throw case already grew inline; the reaction
   spec and the Water Whip footer-reflow case both project a tile straight
   after selecting an ability, and both now use the shared helper.

Not changed: any assertion, threshold, viewport, product source, workflow,
shard split or job limit. `maxFailures: 1` and the 60-minute browser job limit
stay, which is what keeps a genuinely hung case from running away now that the
per-case cap is larger. The gallery spec keeps its own `test.slow()`: it is a
separate job with its own measured allowances and it currently passes.

## Verification, and the honest gap

- `npm run verify` passes on the final tree: typecheck, lint, format, 873 tests
  in 105 files.
- Discovery is unchanged: `--list --project=surface-touch` reports 181 tests in
  44 files, and shards 1/3, 2/3, 3/3 resolve to 62, 59 and 60 cases.
- **Gap:** the repaired browser cases were not re-run. This host has no
  Playwright browser build (the config's `/opt/pw-browsers/chromium` is a dev
  container path), and the worktree deliberately did not dispatch a second CI
  run. The new per-case cap is derived from the measured cost plus margin, not
  from a passing run of the repaired suite. The next exact-head CI is the
  first real evidence.

## Result on the repaired head `8ae6996`

Run `35490500300`: `Typecheck, lint, unit tests` passed, `Chromium touch 1/3`
and `2/3` passed, `3/3` failed on one case. Both shards that failed at
`b174495` on cost now pass, including `painted-rubble.spec.ts` and
`forest-aftermath.spec.ts` in 2/3. Every case that timed out in 3/3 now passes
inside the new budget, and its reported cost is the measurement the repair was
built on:

| case (webgl)                         | before              | cap then | now    | cap now |
| ------------------------------------ | ------------------- | -------- | ------ | ------- |
| `resize-presentation` normal         | 128s, both attempts | 120s     | 156.2s | 300s    |
| `resize-presentation` missing sheets | never reached       | 120s     | 159.4s | 300s    |
| `resize-presentation` reduced        | never reached       | 120s     | 135.9s | 300s    |
| `renderer.spec` board through WebGL  | 107.4s              | 120s     | 106.3s | 300s    |
| `renderer.spec` painted ground       | 59.0s               | 120s     | 62.2s  | 300s    |

`WebKit iPad` ran the full 195-case set for the first time (at `b174495` it
aborted at 131 cases and 31.5 minutes) and failed only one case: the same
`riverside-tea.spec.ts` WebGL case. The reaction case it failed at `b174495`
now passes, so `settleMapCanvas` is confirmed on the engine that saw the race.
WebKit took 36.9 minutes for 143 executed cases, still inside its 60-minute job
limit.

That remaining failure is a different class from every budget failure above:
`riverside-tea.spec.ts` "tea
holds on the porch and yields to walking and forms (webgl)" failed
`expect((await teaPortrait()).equals(hold)).toBe(false)` — the two portraits
were byte-identical, so the opposite tea cel never reached the screen. It ran
to completion twice on Chromium (309.3s) and twice on WebKit (120.8s).

It is newly _visible_ rather than new: at `b174495` shard 3/3 aborted on the
resize case and skipped this one, so the WebGL backend has not run it in
Chromium CI, while its Canvas twin passes on both engines in about 11s. The
Canvas path passes, both WebGL paths fail, and
[the tea handoff](riverside-tea-rest.md) records it passing on installed Chrome
and Windows WebKit for both backends — so this is the observation method
meeting CI's software WebGL, not a regression this branch introduced. No
assertion was weakened to get this far and none should be.

Leads for whoever takes it:

- The tea clip is two cels four seconds apart, driven by
  `VillageLayer.actorFrame` → `sheets.frame(sprite, 'tea', drawingTime(elapsed))`.
  The spec has to drive elapsed through a mocked clock because
  `VillageLife.update` advances its own clock by `Math.min(60, delta)` per
  frame: at the ~0.3 fps a software-WebGL frame manages, the animation runs
  about twenty times slower than wall clock and cannot be reached by waiting,
  which is why `page.clock.runFor(4000)` is there.
- So the question is what that burst actually did on this project: how many
  `requestAnimationFrame` callbacks `runFor(4000)` fired, whether
  `VillageLife.elapsed` advanced the full 4000 ms, and whether the last frame
  was published. Reading the app's own elapsed and chosen cel around the burst
  answers that without touching the pixel assertion.
- The blunt asymmetry — identical pixels only where the board is a WebGL
  surface, on both engines — points at presentation rather than at the cel
  math: a Canvas 2D backing store composites fresh at screenshot time, while a
  WebGL surface drawn inside one mocked-clock task may not have been presented
  since. If the probe shows elapsed advancing correctly and the cel resolving
  to the other frame, the repair belongs in how the test makes the browser
  present a frame, not in the assertion.
- `docs/coordination/handoffs/riverside-tea-rest.md` and the tea clock review
  hold the earlier history; the paused-clock handling is shared with the
  activity pause path, so a fix here touches that contract.

## Result on `690933c`, the tea attempt

Run `35492405943` on `690933c`: `Chromium touch 3/3` failed the tea case again
(329.7s over two attempts) and nothing else. The probe added in this revision
answers the question it was added to answer, and it rules out the explanation
the fix was built on:

```
tea-webgl-advance: {"before":5846,"after":9846,"advanced":4000}
```

The mocked four seconds did reach the animation — `VillageLife.elapsed` moved
by exactly one two-cel period — and handing real frames back through
`clock.resume()` and `settleLayout()` still left the two portraits
byte-identical. So the cel is not failing to advance, and waiting for a
committed frame is not the repair. The Canvas variant of the same case passes
the same comparison on the same clip.

That narrows it to what the _clip_ contains. The clip is a page region, so it
carries the board canvas under the shared 2D life layer, and the two backends
differ only in that board. Either the tea figure is not inside this region on
the WebGL path, or what changes in the Canvas comparison is the board's own
animation rather than the cel — in which case the Canvas pass is not evidence
about the cel at all, and the assertion has been measuring the wrong thing on
both backends while only failing on one.

## Result on `3342cdf`, the drawn-cel repair

The previous next action named the right place to look. Two facts from the
failing report's own attachments (`playwright-report-chromium-3`, run
`35492405943`) decide it:

- The clip is the figure. At 1280x720 the case reads page region x 378-438,
  y 248-358, and the full-page `tea-webgl-hold` attachment draws the seated
  tea figures and their table there, over static paving rather than moving
  water. The region was never pointing at the wrong tile or at an animated
  board.
- The comparison loaded the dice. On that runner one clipped Playwright
  capture cost about 14s and one software-WebGL frame about 3s, against an
  authored cel of 4s. The "four seconds later" read therefore happens many
  real seconds after the frozen read, and after `clock.resume()` the app's own
  clock runs with real time again, so the frame the compositor finally hands
  back can be the held cel a whole number of cel periods later. The automatic
  failure screenshots show the same lottery: attempt 1 had changed cel pixels
  inside the clip (810 of them), attempt 2 had none.

The repair stops measuring the composited page for this assertion. The seated
figure is drawn by the shared 2D life layer, the app's loop already drives that
layer from `performance.now()`, and the layer's own pixels are the cel the app
drew: identical on both backends because the board underneath is not in them.
`e2e/riverside-tea.spec.ts` now reads that layer's backing store in the same
60x110 region and compares those images, and the two intervals jump the frozen
clock with `fastForward(4000)` plus one drawn frame instead of stepping 240
software-WebGL frames.

Assertion strength is unchanged: reduced motion still holds the seated cup
pose, one interval still changes the cel, one more interval still returns the
held cup drawing, and the walk and form paths still clear the hold. The drawn
crop is attached as `tea-<backend>-sip` so a failing run carries the cel it
disagreed with.

## Result on `b73a225`, the cel read alone was not enough

Run `35495049916` judged the drawn-cel revision: `Typecheck, lint, unit tests`
passed, `Chromium touch 1/3` and `2/3` passed, `WebKit iPad` passed, and
`Chromium touch 3/3` failed the same webgl tea case. So the compositor read was
one half of the fault, not all of it. The attached evidence named the other
half: the expected crop in the failure message decodes to a 60x110 image with
every channel zero - the region held nothing at all - while the `sip` crop the
canvas case attached in the same run shows both seated figures.

The trace from that run holds the reason. Playwright records each element's
bounding rect per snapshot, and the map wrapper's bottom edge moves during the
case (`476.2` at one snapshot, `549.6` at the next), because the dock the
activities panel lives in resizes the map. `ExploreScene.refit()` answers a
viewport change by refitting the camera, so the projection of tile (8.5, 18.85)
measured once, right after the early `settleLayout`, no longer points at the
seated figure by the time the case samples. On the runner the crop landed on
empty paving and two blanks compared equal; on WebKit and on this host the same
stale point still overlapped the figures, which is why the case has been
intermittent rather than plainly broken, and why the old page-clip comparison
also failed and passed on different runs.

The spec now reads `rendererCamera()` with every sample instead of once, and
each sample is preceded by a drawn frame, so the crop is projected from the
camera that drew it. A sample whose region holds no drawn pixel now fails with
`the tea region must contain the drawn figure` instead of reporting two equal
blanks, and the held crop is attached as `tea-<backend>-cel-hold` so a failure
carries the region it compared.

## Local verification of `3342cdf` + this repair

- `npm run verify` passes: typecheck, lint, format and 873 unit tests.
- The focused spec passes all three cases in 13.7s (canvas 6.0s, webgl 6.2s),
  and again under installed Chrome with
  `--use-angle=swiftshader --enable-unsafe-swiftshader --disable-gpu` in 15.2s
  (webgl 8.3s).
- Layout flux: with the activities panel opened and closed between the two
  samples, the webgl case still passes (6.7s), because each sample re-reads the
  camera the last drawn frame used.
- Non-vacuity: with the interval shortened to 1000ms the same case fails, so
  the comparison is still measuring the cel rather than passing on any change.
- Robustness: with a real 8s stall inserted before the post-advance read - the
  condition that broke this case - webgl still passes in 14.7s, because a
  frozen mocked clock no longer lets real time reach the drawing.
- The launcher config used for those runs pointed at installed Chrome because
  this worktree has no bundled browser. It is not committed.

Not settled here, and not claimed: whether the composited read was also stale
in the runs before this one. Accelerated Chrome and SwiftShader both returned a
fresh composited frame on this host, and only CPU-throttled SwiftShader returned
a stale one, so the compositor and the resumed real clock could not be separated
locally. Neither repair depends on the answer: the case no longer reads through
the compositor, and it no longer projects from a camera read taken minutes
earlier in wall time.

## Result on `71e0122`, the tea case passes

Run `35497577226` cleared the case this task exists for. Both tea variants
passed in `Chromium touch 3/3` (`tea-webgl` 48.7s, `tea-canvas` 8.9s) and
`WebKit iPad` passed the whole job, with `Chromium touch 1/3` and `2/3` green.
The attached crops now agree across backends: `tea-canvas-cel-hold` and
`tea-webgl-cel-hold` are the same 60x110 image, which is what a shared life
layer drawing the same cel should produce.

That shard still failed, on a case the tea failure had been hiding:
`target-visibility.spec.ts` "Fire Jab target stays tappable with separate
decisions on webgl at desktop lower edge". Its trace shows no hang - 46 real
input round trips, each click, tap and enabled check costing seconds of
software rasterisation, consumed 296.8s of the 300s cap before the last step
(its canvas twin finishes in 5s, and the narrow webgl variant was skipped
behind it). The case now asks for 480s on the webgl renderer only, with the
measurement recorded beside it. Assertions are unchanged, and a hung case
still fails.

## Next action

1. Push this revision to `codex/quarry-gate-integration`, the PR64 head, and
   read the run it starts. The tea case is fixed; the remaining risk is the
   next case in shard 3 that a 300s software-WebGL cap cannot cover.
2. If the browser jobs pass, the auto-merge already enabled on PR64 lands it
   with a merge commit. Confirm the merge, the Pages deployment and the version
   the deployed build shows before treating v0.2.2 as shipped.
3. The tea case is much cheaper now (no 240-frame bursts). If the WebKit job
   grows past its 60-minute budget - it ran 36.9 of 60 before this work - shard
   WebKit the way Chromium is sharded rather than raising the job limit.
4. The same pattern - a projection measured once, then used after the dock
   resizes the map - is worth checking in the other specs that project a tile
   before a panel change. `settleMapCanvas` in `e2e/helpers.ts` guards the
   backing store, not this staleness.
5. If another forced-WebGL case lands within seconds of 300s, widen the shared
   `SOFTWARE_WEBGL_BUDGET_MS` rather than adding a third per-spec exception.
