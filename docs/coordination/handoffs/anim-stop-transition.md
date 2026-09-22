# Combat stop transition and gait timing (M1)

2026-09-22 04:08 UTC. Bounded animation-timing worker, worktree
`D:/AvatarRPG-work/anim-stop-transition`, branch `codex/anim-stop-transition` off
`e4c317e` (= `origin/main`). This sandbox cannot write `.git`, so the change is
**uncommitted in the working tree** and awaits the supervisor's diff review,
commit and push. Scope was `src/app/animator.ts`, `src/app/anim/*.ts` and their
tests only.

## Defect and reproduction

`docs/coordination/handoffs/live-candidate-review.md` ("Gait and stopping"):
a two-cell combat move ran 220 ms, on WebGL travelled 0.902 tile in the first
40 ms, and then "immediately selects ready stance". Half of that had already
landed: `c5a0883` gave combat moves `strollTiming(curve.length,
TIMING.combatWalkStep)` in `choreography.ts`, so travel is distance-based at
280 ms per tile with the same 120 ms bounded ramp as exploration, and two cells
take 680 ms. What remained was the stop: `Animator.locomotion` switched the
drawn clip from `walk` straight to the resting (ready) clip on the frame the
route ended, so the last stride cut to guard with no settle at all.

New `src/app/anim/stopTransition.test.ts` (vitest, node, no DOM) drives the real
`Animator` for a two-cell combat move, a four-tile north-then-east move, a
forced slide and a reduced-motion move, and samples the drawn position and pose
at fixed times the way `CombatScene.poseFields` builds its view (a pose track
wins, and a walk pose takes the directional clip from `locomotion`).

Measured before/after, same test file, only `STOP_SETTLE_MS` changed:

| Sample                                    | Before         | After           |
| ----------------------------------------- | -------------- | --------------- |
| Two-cell travel (`finishesAt - start`)    | 680 ms         | 680 ms          |
| Travel in the first 40 ms                 | 0.0238 tile    | 0.0238 tile     |
| Largest 16 ms step (both routes, 60 fps)  | 0.0571 tile    | 0.0571 tile     |
| Drawn clip 1 ms after the route ends      | `idle` (guard) | `rest` (settle) |
| Drawn clip 100 ms after the route ends    | `idle` (guard) | `rest` (settle) |
| Ready stance selected after the route end | 0 ms           | 140 ms          |

With the dwell set to 0 the test fails exactly as the live report describes
(`expected 'idle' to be 'rest'` at `end + 1` on both sampled routes); with the
dwell in place all four cases pass. The old 0.902 tile in 40 ms cannot recur
under `strollTiming`, and the new 16 ms bound pins the cruising pace.

## Change

`src/app/animator.ts` only:

- `STOP_SETTLE_MS = 140`: how long a finished walk holds its settled pose
  before the ready stance is selected.
- `private stops: Map<string, { from, to }>`: one window per unit, written when
  a voluntary move track is pushed (`from` = the route's end, `to` = that plus
  `STOP_SETTLE_MS * rate`, so reduce motion collapses it with everything else),
  dropped in `prune` once past, cleared by `clear`.
- `locomotion` now selects `walk` while travelling, then the settled `rest`
  clip (directional, so its facing is the last travel direction) inside the
  window, then the caller's resting clip. Combat's `resting` is `idle`, so the
  ready stance arrives one dwell later; exploration already passes `rest`, so
  the world and riverside views are unchanged by construction.
- A forced `gait: 'slide'` move deletes that unit's window: a push takes the
  stance over, and the struck figure does not settle out of a walk it was
  knocked out of. This is what keeps the knockback contract in
  `animator.test.ts` ("does not lose the north-facing idle when an unrendered
  push moves south") intact at its existing sample time.

Unchanged on purpose: `busy()`, `finishesAt`, the walk duration, the stroll
ramp, footstep cues, `WALK_MS_PER_TILE` clip phase, the 220 ms slide clock and
the reduce-motion action lock. The dwell is pose selection only, so the e2e
`waitForIdle` helper and the AI pacing see exactly the timeline they saw
before (ADR 0004).

One thing left alone: `TIMING.combatWalkStep` and `TIMING.strollStep` are
separate constants that are both 280, so combat and exploration share the
`strollTiming` pace by value rather than by reference. Unifying them is a
one-line content change in `choreography.ts` that this task did not need.

## Existing assertions changed, and why

Five assertions sampled `locomotion` 1 ms after a route ended and asserted the
ready stance — literally the old snap. Each now keeps its original intent and
is stricter, asserting the settled stop pose and then the ready stance past the
dwell:

- `src/app/animator.test.ts`: "keeps the attack facing after recovery" (rest at
  500 ms, ready stance at 600 ms; reduce motion collapses it, so that branch
  still asserts the guard at 500 ms), "resolves skipped walk and attack
  headings in playback order" (restSouth then idleSouth), and "carries one
  distance phase across tile boundaries, then settles into combat ready
  stance" (retitled, rest at `finishesAt + 1`, idle at `+300`).
- `src/app/anim/direction.test.ts`: the north/south walk and the twelve
  projected-heading cases now assert `rest<dir>` at `finishesAt + 1` and
  `idle<dir>` at `+300`, keeping the walked facing in both.

No assertion was relaxed, no threshold widened, and no test was deleted.

## Verification

- `npx vitest run src/app`: 23 files, 214 tests passed, 1 failed — the
  pre-existing `src/app/ui/icons.test.ts` line-ending case described below.
  `src/app/anim/stopTransition.test.ts`, `src/app/animator.test.ts` and
  `src/app/anim/*.test.ts` are green.
- `npm run test` (whole suite): 116 files, 932 tests passed, 1 failed — the
  same `icons.test.ts` case.
- `npm run typecheck`, `npm run lint`: pass.
- `npx prettier --write` on the four changed files, then `npx prettier --check`
  on those files: "All matched files use Prettier code style".
- `npm run verify` stops at `format:check`: this Windows checkout has CRLF
  working files while `.prettierrc.json` sets `endOfLine: "lf"`, so 498
  untouched files are reported. `src/app/ui/icons.test.ts` fails for the same
  reason: `public/art/icons/game-icons.svg` is `w/crlf`, and comparing it with
  `spriteText()` shows the two are byte-identical once line endings are
  normalised. Both are environment artefacts of this worktree, present without
  this change; typecheck, lint, focused format and the full unit suite were run
  separately in their place.

## Not claimed

- No browser capture, video, contact sheet or physical-device evidence. The
  settle is asserted through the animator's drawn fields, not through a
  rendered frame; `npm run e2e` and the gallery were not run.
- Enemy units still cut from walk to idle at the end of their move: their
  sheets carry no settled clip (so a settle would resolve back to idle anyway)
  and `CombatScene.poseFields` only consults `locomotion` for `faction ===
'party'`, which is outside this task's file scope.
- No new sprite frames, clips or assets; no change to `src/core`, `src/render`,
  content, sheets, CSS, e2e or CI.

## Risks

- The gallery's combat walk case (`e2e/gallery/hero-walk-beats.ts`) samples
  70–360 ms into a 680 ms two-cell move, and `e2e/motion-transitions.spec.ts`
  stages a cast and a push right after a short walk, so the dwell should be
  invisible to both — reasoned from the sample times, not re-run here.
- Any caller that samples `locomotion` at exactly a route's end now sees the
  settled clip rather than the resting one; `src/app/scenes/ExploreScene.ts`
  passes `rest` and is unaffected, and `CombatScene` gets the intended settle.
- 140 ms is a judgement call ("brief, explicit dwell") sized against the 120 ms
  stroll ramp and the query's 100–400 ms acceptance window; it is one constant
  if the visual review wants it longer or shorter.

## Next actions

1. Supervisor: read the diff in this working tree, commit on
   `codex/anim-stop-transition`, and run `npm run verify` on a LF checkout.
2. If a browser pass is wanted, capture a two-cell combat move and a longer
   turning move on both backends and check the last stride, the held stop pose
   and the guard that follows.
   | Largest 16 ms step (both routes) | 0.0571 tile | 0.0571 tile |
