# Target visibility: bounded CI round-trip correction

Owner: quarry composition agent. Integration owner: root.
Base `4582fee`; branch `codex/target-visibility-batching`.
Worktree `C:/Users/Jared/Documents/ChatGPT/Avatar RPG-target-visibility-batching`.
Only the target-visibility test and this handoff change. No renderer, app, timeout,
retry policy, assertions, CI configuration, push or version changes.

## Diagnosis from the actual failed run

PR64 head `9e005b1`, run `35432834135`, surface-touch Chromium desktop WebGL.
Root's downloaded report is at
`C:/Users/Jared/.codex/worktrees/route-pacing-review/.shots/ci-35432834135/report`;
log is `.shots/aftermath/ci-35432834135-e2e.log` in that same root worktree.

The failure is cumulative test-budget exhaustion under slow rendering/readback,
not evidence that Confirm alone hangs for 180 seconds:

- Original trace `data/ba96a012b2150f699790c2111740c7576478ef39.zip`,
  `1-trace.trace`, call `call@13532`: Confirm starts at 2041200.395ms and records
  “tap action done” at 2050568.021ms, about 9.37 seconds later. “Before Hooks”
  begins at 1867620.464ms: the action begins roughly 173.6 seconds into the test
  and completes after the overall 180-second budget. It reaches the actual tap.
- Retry trace `data/b38c405a47887fc7309b9ca6ded1dd791623c469.zip`,
  call `call@150`: Confirm is reached at 2240321.6ms, after a long series of slow
  reads. Its trace ends during actionability near overall timeout; it does not
  demonstrate a standalone 180-second button wait. Relative to “Before Hooks”
  at 2059204.145ms, the recorded call begins around 181 seconds; timeout/reporting
  and protocol completion cross each other at that boundary.
- Earlier operations show the same cost: Focus about 9.7s, Fire Jab about 10.2s,
  canvas boundingBox about 5.2s, ordinary state/camera reads about 1.95s, Cancel
  about 9.9s. Both Cancel and Confirm passed the preceding visible/enabled,
  minimum 44px size and document.elementFromPoint center-hit checks.
- Retry logs four WebGL warnings: “GPU stall due to ReadPixels.” Screencast
  continues throughout: median frame interval 645ms (original 639ms), rather
  than a frozen DOM. Last screenshots show the confirmation dock unobstructed.
- Original recorded platform is Linux, Playwright 1.63.0, Chromium 153, touch/DPR 1.
  These traces support software-renderer/readback pressure and accumulated
  round-trip latency. They do not isolate how much comes from software GPU,
  tracing readback or runner resources; no renderer profiling claim is made.

The full job stopped after 125 passed, one exhausted test with retry and 243 not
run. This change does not claim those unrun cases passed or request a new CI run.

## Correction and retained coverage

`e2e/target-visibility.spec.ts` batches reads that need the same settled frame:
painted target projection, stretched canvas rectangle, camera offsets and center
hit test; button dimensions and center hit; wheel pre/post zoom; final AP, canvas
height and document overflow. It preserves the existing DPR/backing-store math.

All actual target touchscreen taps and Cancel/Confirm locator.tap actions remain.
Playwright's explicit visible/enabled assertions remain, as do button minimum
dimensions, elementFromPoint checks, target-in-canvas checks, unchanged preview
and cancellation battle snapshots, selected zoom, exact AP cost and phone width.
Every settleLayout and waitForIdle remains, including fresh post-Cancel target
geometry. The forced WebGL slow allowance is unchanged, not increased.

Controlled local desktop traces show **63 → 50 protocol calls**, 13 fewer (20.6%).
`waitForSelector` falls 12 → 4 and `evaluateExpression` 21 → 16. Counts for
`expect` (8), `touchscreenTap` (2), `tap` (2), `waitForFunction` (10) are unchanged.
Using the CI's observed costs suggests tens of seconds saved; that is an estimate,
not a measured CI result or a fix for the underlying slow software rasterizer.

## Local validation

Production build from the isolated `4582fee` app source passed; the only dirty
source was the test, so the bundle identifies `4582fee-modified`. Both the
original test comparison and edited tests used that same production bundle.

- Four edited cases passed with tracing: Canvas desktop 5.6s / phone 4.6s;
  WebGL desktop 4.6s / phone 4.5s (23.5s batch including setup).
- One original `4582fee` WebGL desktop comparison passed in 5.2s. This is a controlled
  call-count comparison, not reproduction of Linux CI's software-GPU slowdown.
- `npm run verify`: typecheck, lint, format and 822 tests / 94 files passed.
- No browser installation, CI rerun, push or renderer mutation was performed.

Local artifacts: `.shots/target-batching/results.json`, `results/**/trace.zip`,
`baseline-results.json`, `baseline-results/**/trace.zip`. The ignored local
Playwright config uses Surface touch settings, optional
`FNT_REVIEW_BROWSER_CHANNEL=msedge`, production preview, strict port 4265, no listener
reuse and trace on. Only the original baseline test's relative helper imports
were adjusted for its diagnostic directory. Port 4265 stopped after both batches.

Integration still needs the normal fresh-revision CI gates. If forced software
WebGL remains near the deadline after this reduction, profile its rendering and
trace costs separately; do not remove touch/assertions or keep increasing timeouts.
