# Forest aftermath WebGL E2E budget handoff

Owner: world-conversations agent. Integration owner: root.
Base `100197bf025e141afbdbe901ce49d9116487559c`; branch `codex/forest-aftermath-e2e`.
Worktree `C:/Users/Jared/.codex/worktrees/forest-aftermath-e2e`.

## Outcome

The new retained-world aftermath tests now give only their forced WebGL cases the
repository's established slow-test allowance. Canvas timing and all assertions
are unchanged. Forest aftermath still exercises conversation reload, save/load,
the final node, and party HP preservation; Cutting aftermath still exercises its
full conversation and return to the retained map.

## Diagnosis

CI run `35435673189` on the Surface touch project (playwright report artifact
`10582585738`) exhausted
the default 60-second test budget in
`e2e/forest-aftermath.spec.ts:47`. The final screenshot, save/reload, scene
visibility checks, story node, and visible party state had already completed;
the last `page.evaluate` was the action recorded at the timeout boundary.
The two retained traces measured about 64.0 seconds and 54.1 seconds from the
test start to the final state checks. Individual software-rasterized actions
included a 5.2-second screenshot and several 4.6–7.8-second clicks. This is
renderer budget exhaustion, not a failed story or party assertion.

The downloaded report and expanded traces are preserved at
`C:/Users/Jared/.codex/worktrees/route-art-followup/.shots/integration/ci-35435673189-playwright-report`.
The relevant files are
`extracted-traces/0de6f0040d106e4f267ce5f17d7360102957d1d6/test.trace` and
`extracted-traces/b2e6d5e5d07ccad9eeae9252754868385a905050/test.trace`.

## Change

Source commit `65baab86ebbea5ded52a2d505abb5d62a476de71` adds
`if (renderer === 'webgl') test.slow()` to both
`e2e/forest-aftermath.spec.ts` and `e2e/cutting-aftermath.spec.ts`. The latter
was included because CI stopped before reaching the same newly added forced
WebGL coverage; it receives the same narrow allowance rather than becoming the
next first failure. No retry, assertion, renderer, game behavior, or global
timeout changed.

## Verification

- Focused installed-Chrome production-preview run, strict port 4293, using
  `--use-angle=swiftshader`: all four Canvas/WebGL cases passed in 31.5s.
- `npm run verify`: typecheck, lint, and formatting passed; Vitest reached
  830 passing tests in 96 passing files. The pre-existing denylist test failed
  on `docs/art/fire-deserter-review.md` containing `fire nation`; this task did
  not modify that file.
- No browser installation, CI rerun, push, or production source change was made.
  The owned preview server was stopped; port 4293 is free.

## Transfer

The temporary local Playwright config and dependency junction are ignored and
remain local. Root should cherry-pick source commit
`65baab86ebbea5ded52a2d505abb5d62a476de71` and this handoff commit, then run
the normal fresh-revision CI gates. Editing ownership is released after this
handoff.
