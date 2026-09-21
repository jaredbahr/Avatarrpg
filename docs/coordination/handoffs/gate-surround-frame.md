# The gatehouse wears the quarry's exterior mass

> Shipped inside **v0.2.8**, batched with the Ba Dan and forest-road aprons;
> see [the release handoff](exterior-aprons-release.md) for why and what
> changed.

- **Updated:** 20 September 2026, seventh scheduled DeepSeek Flash continuation
  run. Incoming owner: the next scheduled session for the same goal.
- **Outcome:** the quarry gate battle and gate return no longer end at a bare
  projected diamond. The scene reuses the reviewed exterior surround that The
  Cutting and the Driller floor already ship, so the frame continues into
  terraced rock on the left and below the board instead of flat paper.
- **Location:** worktree `C:/Users/Jared/.codex/worktrees/frame-surround-coverage`,
  branch `codex/frame-surround-coverage`, based on `main` `87c97b3` (v0.2.6).
  Not pushed as a PR: the branch is pushed as a checkpoint only, because the
  release version this becomes is decided after v0.2.7 lands (see below).

## What changed

`src/content/scenes/quarryProjected.ts` now exports the two surround plates as
`QUARRY_SURROUND`, and `src/content/scenes/quarryGate.ts` paints them first in
`QUARRY_GATE_SCENE.ground`, under the existing earth, road, limestone and cover
decals. No rule, collision, save, camera, preview, painter or asset changed: the
same two `.webp` files were already in the precache for the other two quarry
scenes, so the bundle and its budget are untouched.

`src/content/schemas.ts` raises the `scene.ground` bound from 8 to 12, because
the gate is now the widest shipped scene (two surround plates, four material
regions, four cover decals). The bound remains so a scene cannot quietly grow
into an unbounded pile of ground draws.

## Evidence

- Before: `.shots/frame/before/{canvas,webgl}/battle_quarry_gate-fit.png` at
  `87c97b3` - cream paper triangles down the left, top-left and bottom-left, and
  along the bottom edge of the board.
- After: `.shots/frame/gate-surround/{canvas,webgl}/battle_quarry_gate-fit.png`
  on this branch - the same frame continues into authored terrace rock on both
  backends. Canvas and WebGL agree.
- Harness: `FNT_REVIEW_BROWSER_CHANNEL=chrome` and
  `npx playwright test -c playwright.route-visual.config.ts` (installed Chrome,
  1368x912, seeded fixtures entered with `enterNode`, Canvas and WebGL compared
  frame for frame). 2 passed in 32 s.
- `npm run verify` passes on this head: typecheck, lint, format gate and 897
  tests in 109 files, including the new
  `quarryGate.test.ts` guard that the surround leads the gate's ground list.

## What this does not fix

The same "board edge against bare paper" framing gap stays in Ba Dan and the
forest road, which have no exterior mass to reuse - the Ba Dan exploration
capture still shows cream wedges at the top corners. Those need their own
authored apron/fringe plates, which this environment cannot generate; the
existing `north-grass-fringe.webp` is the precedent for what they should be.
This is a bounded stills comparison on a desktop browser at one viewport, not a
playthrough, a listening test or a physical-device check.

## Next action

v0.2.7 (PR #69) ships the water pass. Once it is on `main`, rebase this branch
onto that merge, bump the version to `0.2.8` with a changelog entry and the
release notes, re-capture the gate frame, and open the PR with merge-commit
auto-merge. Do not open the PR before the bump: the policy wants the shipped
version in the branch's final head, not a follow-up commit.
