# Handoff — the `settleLayout` timeout that reddened `main` after v0.2.8

Owner: DeepSeek Flash scheduled continuation, 21 September 2026, thirteenth run.
Branch `codex/settle-budget`, worktree `C:/Users/Jared/.codex/worktrees/settle-budget`,
base `8345e1d` (the v0.2.8 merge commit).

## What was red

PR [#71](https://github.com/jaredbahr/Avatarrpg/pull/71) merged as v0.2.8 with
every required job green on `bf48ab0`. The merge commit `8345e1d` then ran on
`main` twice: `Deploy to GitHub Pages` succeeded (so Pages serves 0.2.8), and
`CI` run
[35590666334](https://github.com/jaredbahr/Avatarrpg/actions/runs/35590666334)
failed. Thirteen of its fourteen jobs were green — including all three Chromium
touch shards, WebKit iPad and all three Surface-WebGL gallery shards — and one
gallery shard and its `Screenshot gallery` gate were red:

- `Gallery iPad WebGL 3/3`, job 106319630731: `09-rock-throw Rock Throw lands`
  failed with `page.waitForFunction: Timeout 30000ms exceeded` at
  `e2e/helpers.ts:151` (`settleLayout`), called from `openBattle`
  (`e2e/gallery/beats.ts:162`) — the beat's last settle before staging.
- `Screenshot gallery` failed only because its shards are gated on that job.

The same shard passed on the pull-request head run 35584375193 minutes earlier,
and the beat passed again locally. The frame count is the whole story: on the
`ipad-webgl` project the runner paints 2388x1668 pixels through a software
rasteriser at one worker, and `settleLayout` needs four animation frames. A
30 s budget therefore only survives frames shorter than 7.5 s.

## What changed

- `e2e/helpers.ts` — `settleLayout` now runs its sampling loop inside one page
  call: it retries whole read rounds until the deadline (the retry
  `waitForFunction` polling used to provide) and returns what it saw. On
  timeout it throws with the frames observed, the longest frame and the three
  reads, so the next failure distinguishes slow frames from a camera that
  drifts. A Node-side backstop covers the case the page cannot report on — a
  paused or wedged clock, where no animation frame arrives at all.
- `e2e/gallery/suite.ts` — the gallery's WebGL settle allowance goes 30 s to
  60 s, with the reasoning and the run id recorded on the field.

Nothing here touches the game, so this is a maintenance repair: no version
bump, no new build behaviour, and the released 0.2.8 stays the newest build.

## Evidence

- `npm run verify` on the branch: typecheck, lint, format and 911 tests in 113
  files, all green.
- A scratch spec (since deleted) drove the helper through four cases on the
  `surface-touch` project against the production build:

  | case                                    | result                                                                                                                                  |
  | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
  | camera already still                    | resolves in 102 ms                                                                                                                      |
  | camera drifting for 3 reads, then still | resolves in 164 ms (the retry path works)                                                                                               |
  | camera drifting forever                 | throws `the camera did not hold still within 2000 ms (124 frames in 2060 ms, longest 17 ms); reads: …offsetY:261.5 -> …262.5 -> …263.5` |
  | clock paused, no frames at all          | throws `no animation frame arrived in 6000 ms` after 7.0 s instead of hanging                                                           |

- Real specs that share this helper on `surface-touch`: `directional-walk` (4
  cases) and `riverside-tea` (3 cases) all pass, canvas and WebGL.
- The failing beat itself, through the repaired helper and the gallery config:
  `gallery-c.spec.ts › 09-rock-throw Rock Throw lands` passes on
  `surface-canvas` (3.7 s).
- Not run here: the iPad-WebGL project, which is the arbiter. Local WebGL is
  GPU-backed. The 60 s bound and the new report are what the next runner
  failure will be judged on.

## Next actions

1. Let the PR's exact-head checks finish; it is armed for a merge commit.
2. After that merge, release `codex/apron-plates` (`1e26044`, worktree
   `C:/Users/Jared/.codex/worktrees/apron-plates`) from fresh `main` as the next
   interim version — it is verified and held, and the one-CI-owner rule says it
   waits for this repair rather than running beside it.
3. If `Gallery iPad WebGL` fails again, read the frame timings in the new
   message before touching the bound: many frames over the budget is the same
   fault, one frame or none is a different one.
