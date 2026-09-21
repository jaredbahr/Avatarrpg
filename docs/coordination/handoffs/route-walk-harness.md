# Handoff: a real-input route walk (first taps land)

- **Updated:** 21 September 2026, twelfth scheduled DeepSeek Flash continuation
  run. Branch `codex/field-dressing`, worktree
  `C:/Users/Jared/.codex/worktrees/field-dressing`, based on `main` `8ad6de1`
  (v0.2.7). No PR yet: release PR #71 (v0.2.8) was mid-CI, so this run took a
  separate, unblocked step and did not touch that branch.
- **Outcome:** new local harness `e2e/route-walk.review.ts` +
  `playwright.route-walk.config.ts` that drives the shipped route with pointer
  taps on the map canvas — no `walkTo` dispatch, no story fixture past the
  village entry node. The first leg now completes on both backends.

## Evidence (this head, installed Chrome 1368x912)

`FNT_REVIEW_BROWSER_CHANNEL=chrome npx playwright test -c playwright.route-walk.config.ts`
— 2 passed (21.6 s). Per-backend report in
`.shots/route-walk/{canvas,webgl}/report.json` plus `00-village-spawn.png`,
`10/11-village-east-exit-{before,after}.png`, `20/21-forest-road-roadblock-*.png`.

| Renderer | Leg                   | Result                                                     |
| -------- | --------------------- | ---------------------------------------------------------- |
| canvas   | village east exit     | reached, **4 taps**, `ba_dan_village` → `forest_road`      |
| canvas   | forest road roadblock | stopped in the authored `road_depart` dialogue after 1 tap |
| webgl    | village east exit     | reached, **4 taps**, `ba_dan_village` → `forest_road`      |
| webgl    | forest road roadblock | stopped in the authored `road_depart` dialogue after 1 tap |

No page errors on either backend. Build stamp `8ad6de1`; party
Sura/Riko/Kaya, seed `route-walk`; taps only.

## What the first leg actually proves

The party walked from the village spawn to the `(23,7)` east exit on four
clicks, the exit fired, and the forest road mounted with the party at `(1,4)` —
on Canvas and WebGL. That is the first evidence in the repository of a scene
transition produced by _pointer input_ rather than by `dispatch({type:'walkTo'})`,
which every other route harness uses.

## Two things this run learned the hard way (both now fixed or recorded)

1. **`state.party[i].pos` is not the leader's tile out of combat.** It read
   `(0,0)`, so the first version aimed every tap from the wrong origin and never
   moved the party. `state.location.pos` is the authoritative explore position
   (`ExploreScene` falls back to it for the same reason). The harness uses it.
2. **Aim along walkable tiles, not at the exit's projected point.** A ray to an
   off-screen exit crosses blocked cells; the tap is refused and nothing moves.
   The harness now steps out along the party→target ray and taps the furthest
   _walkable, on-screen_ tile, falling back to one legal neighbour.

## Open, recorded honestly

- The second leg stops because the authored `road_depart` story node opens
  dialogue mid-walk. The harness needs a story-advance step between legs
  (`e2e/quarry-return.spec.ts` has the shape: click the primary dialogue button,
  skip interludes, then resume tapping). That is harness work, not a game defect;
  nothing here says the roadblock is unreachable by a player.
- Coverage is one transition plus the roadblock approach. The gate, cutting,
  floor, Driller, outcome and return are still unwalked with real input.
- Not evidence: a playthrough, a listening check, Large text, touch, or a
  physical Surface/iPad. Frames are a desktop browser at one viewport.

## Next action (exact)

1. Add the dialogue/interlude advance between legs, then walk
   `forest_road → (19,4) → quarry_gate` and let the roadblock fight start from a
   tap; stop there and record the framing. Copy the battle-finishing helper from
   `e2e/quarry-return.spec.ts` only if the walk needs to continue past a fight.
2. Re-run both backends with `FNT_REVIEW_BROWSER_CHANNEL=chrome`, read the frames,
   and put the findings into `route-walk-harness.md`.
3. Recheck live CI for release PR #71 first; when it has merged, confirm the
   Pages deployment serves 0.2.8, then carry this harness into the next product
   branch's PR rather than opening a second release PR for it.
