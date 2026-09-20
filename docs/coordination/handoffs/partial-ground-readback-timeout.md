# Partial-ground WebGL readback handoff

- **Updated:** 2026-09-19 UTC; `/root/release_local_regression`; incoming owner `/root`.
- **Outcome:** The CI-only partial-ground WebGL restoration poll now uses the existing renderer-specific readback allowance. The repair preserves every colour, surface, accessibility, and re-entry assertion; the separate re-entry rendering mismatch remains with the renderer investigation owner.
- **Location:** `C:\Users\Jared\.codex\worktrees\ci-35474090671-diagnosis`, branch `codex/ci-35474090671-diagnosis`, source commit `e57e7ef` based on CI head `d0bf98c`; integrated by `/root` as `7ad2fe8`.
- **Evidence:** CI run `35474090671` failed `e2e/partial-ground.spec.ts:351` twice at restoration poll line 392. Its downloaded artifact is preserved at `C:\Users\Jared\.codex\worktrees\ci-35474090671-artifact`. The trace measured WebGL screenshots at 14.1–14.5s while the poll had the default 10s timeout. The repair passes the existing `readbackTimeout` (60s WebGL, 10s Canvas) to that poll.
- **Verification:** `npm run verify` passed 105 files and 873 tests. Focused installed-WebKit run (`FNT_E2E_WEBKIT=1 --project=ipad-landscape`, partial-elevation test) passed Canvas and reached the WebGL restoration phase; WebGL then failed the independent re-entry assertion with `abs(reentered.r - bare.r) = 128.5918` against `<14`. No CI rerun or push.
- **Coordination:** Root owns release integration and the Linux CI discriminator. The WebKit/compositor re-entry mismatch is outside this timeout repair; do not weaken its assertions.
- **Completion/transfer:** Test repair is integrated and ownership transfers to `/root`.
