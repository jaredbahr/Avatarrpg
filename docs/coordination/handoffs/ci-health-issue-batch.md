# CI health and prop-label issue batch

- **Updated:** 2026-10-29 UTC; integration owner `/root`.
- **Location:** `/workspace/avatarrpg-ci-health`, branch `codex/ci-health-and-prop-labels`, based on `bc77ae2e`. Release candidate v0.2.12; no deployment is claimed.
- **Scope:** #322 (WebGL texture lifetime), #323 (Gao talk regression timing), and #332 (prop chips without coordinates). Worker handoffs record focused evidence; combined local CI and remote checks must pass before delivery.
- **Ownership:** root owns release metadata, integration and shared coordination. The renderer worker owns `pixi.ts`; the other workers have transferred their completed edits. Existing branches for #326, #327, #329 and #330 are outside this batch.

## Findings and changes

- #322: the all-technique forced-WebGL test reproduced `Cannot read properties of null (reading 'alphaMode')` in Pixi batching. Instrumentation identified still-attached elevation sprites whose textures were destroyed by the general texture LRU. Cleanup moves after rendering and protects sprite texture wrappers and shared sources on the stage and the separately rendered shadow group. The initial particle-cache attempt did not solve the failure; it was preserved outside the checkout, then removed. Per AGENTS.md routing, the renderer investigation escalated from Luna High to Sol High after that failed attempt. The original browser assertions are retained.
- #323: the real Gao tap queued the right conversation and brought him home, but the test's fixed eleven-second allowance ended while the party was still walking at the approved pace. The test now waits for an active, bounded approach animation and renders the handoff, keeping the real tap, queued destination, home-position and final dialogue assertions. No runtime conversation change was needed.
- #332: combat prop chips show the name and consequence without a grid-coordinate tuple. Targeting and forecast calculations are unchanged. The existing Oil Flask touch-preview case asserts the consequence remains visible without coordinates.

## Validation and remaining issues

The setup baseline passed all nine local CI steps, including 2,998 tests. Worker evidence is in `ci-bending-cels-322.md`, `ci-resident-tap-323.md`, and `prop-chip-332.md`. Final combined validation belongs to this integration revision and must be recorded with its exact HEAD when available; baseline results do not substitute for that gate.

#324 remains open. The full Canvas riverside discovery/forms/campaign-preservation case passed in Chromium (one case, approximately 1.2 minutes). Forms use a 3,800 ms wall-clock activity lock; the passive presentation-time clamp does not stretch their duration. The reported WebKit iPad failure needs that engine's trace before a runtime or timeout change is justified. No speculative fix or assertion weakening was made. #325's intermittent cases are also outside this batch.

## Access blocker and next actions

Native HTTPS Git reads work. The running network policy blocks `api.github.com` with a CONNECT 403, so live issue/PR reads, PR creation and CI dispatch are unavailable. The official Playwright 1.63.0 container manifest resolves, but its blob redirect to `centralus.data.mcr.microsoft.com` is blocked, preventing local WebKit validation. Both exact host additions were saved in the environment configuration draft without removing existing destinations. They still need to be applied through environment settings; draft persistence does not establish runtime access or publication.

1. Complete `npm run ci:local` and the affected Chromium browser cases on the combined revision. Keep test logs outside tracked files and confirm a clean worktree.
2. After the network changes apply, retry the affected GitHub/API and container operations. Read actual issue acceptance, open PR ownership and latest remote main before making remote changes; do not request replacement credentials merely because GitHub access was policy-blocked.
3. Push only after the local gate is green. Open one landing PR with the exact tested HEAD, dispatch the repository's CI once for its spec changes, and attach the PR to this task. Keep unfinished work in draft and do not duplicate integration PRs or CI runs.
4. Diagnose any remaining WebKit failures, including #324. Preserve required checks and the merge-commit policy in AGENTS.md; no missing or failing check authorizes a merge. Report an actual queued/merged state and deployed version only after verifying them.
