# Painted-rubble CI readback repair

Owner: CI repair session on `codex/ci-rubble-readback`, based on PR #64 head
`7b052f1ead899ea0d69d58fe68a00ba93d895dc0`. This is a local source
handoff to the PR #64 integration owner; no separate PR or CI run was started.

## Cause and change

[CI run 35417898299](https://github.com/jaredbahr/Avatarrpg/actions/runs/35417898299)
failed the forced-WebGL `painted-rubble` test twice. Both retained traces in
[the Playwright report](https://github.com/jaredbahr/Avatarrpg/actions/runs/35417898299/artifacts/10576314740)
show a first full-canvas pixel screenshot taking 15.2–15.4 seconds, followed by
an extra diagnostic full-canvas screenshot taking 14.8–15.3 seconds. Setup and
software-rendered protocol actions consumed roughly 23 seconds before capture.
The next pixel capture began near the test's 60-second deadline; Playwright
reported a detached canvas as teardown closed the page. No pixel assertion
failed.

The test now captures the actual composited screen in a 7×7 CSS-pixel region
around its rubble probe. It retains all five sampled states, their camera
bounds checks, and the three existing color-difference assertions and thresholds.
It removes the two redundant full-canvas diagnostic shots; Playwright still
attaches a failure screenshot and trace. The WebGL case uses the existing
`test.slow()` convention because the CI trace demonstrates unusually slow
software rendering. Canvas keeps its original timeout.

## Local evidence and remaining gate

- Production build passed.
- Focused Canvas and forced-WebGL tests passed on installed Chrome with
  SwiftShader: 2 tests in 18.5 seconds at DPR 1, and 2 tests in 39.3 seconds at
  DPR 2. Both runs exercised the same rendered-pixel assertions.
- `npm run verify` passed: typecheck, lint, formatting and 748 tests in 81 files.

The integration owner should review and apply this commit to PR #64, then
require all three CI checks on its new exact head. Local SwiftShader does not
establish the Linux runner's Mesa performance or WebKit result.
