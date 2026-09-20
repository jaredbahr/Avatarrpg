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

One failure remains, and it is a different class: `riverside-tea.spec.ts` "tea
holds on the porch and yields to walking and forms (webgl)" failed
`expect((await teaPortrait()).equals(hold)).toBe(false)` — the two portraits
were byte-identical, so the opposite tea cel never reached the screen. It ran
to completion twice at 309.3s.

It is newly _visible_ rather than new: at `b174495` shard 3/3 aborted on the
resize case and skipped this one, so the WebGL backend has not run it in
Chromium CI, while its Canvas twin passes in 10.7s and WebKit passes. No
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
- `docs/coordination/handoffs/riverside-tea-rest.md` and the tea clock review
  hold the earlier history; the paused-clock handling is shared with the
  activity pause path, so a fix here touches that contract.

## Next action

1. Diagnose the tea WebGL case in its own isolated branch, on top of
   `8ae6996`. Do not relax the visible-cel assertion and do not re-raise this
   branch's budget: the case has room.
2. Merge this follow-up (the handoff text) and that repair into
   `codex/quarry-gate-integration` and push **once**, so the required checks run
   on a single new revision and auto-merge can land it.
3. Re-read the WebKit job of run `35490500300` before assuming the WebKit side
   is clean: it was still running when this was written, and the previous
   revision failed its reaction case.
