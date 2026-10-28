# Compact combat framing assertion

Local-only branch: `codex/compact-framing-contract`.
Base: `589cc3d8e7e2ee57852dcc92b938a6a0b18f4550` (main after reveal #304).
Owner: delegated Avatar CI evidence task; no open framing-fix claim/PR found at intake.

## Problem and contract

Scheduled main run [40661689631](https://github.com/jaredbahr/Avatarrpg/actions/runs/40661689631) at `94755c05` repeats the earlier Chromium huge-text failure: expected tilePx 40, received 64. Both trace attempts show stable camera reads, not a deadline failure.

[ADR 0088](../../adr/0088-integer-zoom-camera.md) is accepted and owner-confirmed: settled oblique views use whole device pixels; combat floors its preferred 96/64/40 CSS tile while preserving the 40 CSS-pixel touch minimum. A preference is not a guaranteed output stop. At DPR 1, 40/64 = 0.625 device pixels per world pixel; at DPR 2 it is 1.25. Both violate the contract. The smallest tappable whole stop is 64 CSS px on both configured e2e projects (device matrix: Chromium DPR 1 and WebKit DPR 2). Camera.fitExplore already implements this contract. Its result is correct; the old continuous-scale assertion is stale.

The current player-view target still requires readable touch controls and stable framing. This test correction does not change visual direction or the camera.

## Local change

- Replace only the stale exact huge-text expectation with the contract's exact 64 px output for the configured projects, with an explicit integer-device-scale assertion.
- Preserve the existing map height, Focus-control and ability/cancel reflow stability assertions.
- Add eight exact camera regression cases for preferences 40/64 at DPR 1/1.5/2/3. They explicitly demonstrate that 64 is not a universal output across DPRs.
- No production source, WebKit timing, workflow, portrait or asset changes. Existing ADR applies; no new rendering contract is introduced.

## Validation and review

- Focused cameraIntegerZoom suite: 47/47 passed, including eight new cases; one worker, Vitest 2.1.9, Node 24.19.0. Test time 75 ms, total 1.52 s.
- TypeScript noEmit passed.
- Independent read-only source review approved the two-file patch with no findings, checked DPR table and retained assertions. Review did not launch tests or browsers.
- First unit invocation executed no tests because a maximum-only worker flag conflicted with Vitest's default minimum; the unchanged tests passed after both were explicitly set to one.
- No browser suite, build or full ci:local ran in this source-only assignment. No browser-pass or merge-ready claim; unchanged e2e deadlines and all behavioral assertions remain in place.
- Before publication, the integration owner still needs full required validation and an admitted focused browser check at the current combined head. No publication, merge or deployment is authorized by this handoff.

Preserved run evidence and readable comparison:
`C:/Users/Jared/Documents/Codex/2026-10-27/task-6/avatar-evidence-40661689631/REPORT.md`.
Local logs: `C:/Users/Jared/Documents/Codex/2026-10-27/task-6/framing-focused-tests-final.log` and `framing-typecheck.log`. Original failed unit-invocation log is retained beside them.
