# Combat opening clock budget — #370

The fourth branch dispatch, `41037590127`, on published integration head
`567e6dbd` passed 29 WebKit iPad landscape cases before stopping at the
original `combat-focus.spec.ts` opening formation case. Both attempts exceeded
its unchanged 40-second test limit while advancing the paused page clock by
300 ms and reading the `data-battle-opening` hold; Playwright then reported
that the page was closed. The check-run summary left 110 cases unrun. This is
evidence of a test-time budget failure, not evidence that the hold or camera
assertions themselves failed.

This isolated test-only follow-up uses Playwright's documented `fastForward`
for the 300 ms inside-hold advance and the 100 ms completion polls. It fires
due timers once per jump instead of painting each intermediate frame. The first
hold detection still advances by 50 ms, and the real hold, formation camera,
opening completion and actor camera assertions remain. The 40-second timeout,
retry policy and product source are unchanged.

On this source, pinned TypeScript, scoped ESLint, Prettier and diff checks
passed. The original case passed 1/1 with zero retries in production-preview
system Chromium at an iPad-like 1194×834 DPR 2 viewport, in 7.5 seconds under
the unchanged 40-second limit. The log and exit receipt are
`/workspace/avatarrpg-env/370-combat-clock-focused.{log,receipt}`. Hosted WebKit
and the remaining 110 cases are still unverified; this isolated branch has not
been pushed or merged into the integration branch.
