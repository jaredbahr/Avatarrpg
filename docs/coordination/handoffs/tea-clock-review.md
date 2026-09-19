# Riverside tea clock review

- **Outcome:** Stabilize the normal-motion tea screenshot comparison against
  slow WebGL screenshot readback by freezing the fixture clock only after the
  UI setup and advancing the authored two-cel tea clip by exactly 4000ms.
- **Location:** `codex/tea-clock-review`, based on release head `f5a4a87`.
- **Completed:** `e2e/riverside-tea.spec.ts` installs Playwright Clock before
  navigation, keeps setup on the running clock, then pauses for the final hold
  comparison. Reduced-motion equality, rules-driven walk clearing, form
  clearing, and supported-character coverage remain unchanged.
- **Decision:** The manifest defines the tea clip as two frames at `0.25` fps,
  so the fixture advances one full cel interval rather than waiting on wall
  time. CI run `35457611402` recorded 144 passing tests and the same WebGL tea
  screenshot failure on both attempts; no trace-based timing claim is made.
- **Verification:** `npx playwright test -c .tea-focused.config.ts
  e2e/riverside-tea.spec.ts --project=surface-touch` passed all three cases in
  30.8s using installed system Chrome. The temporary launcher config selected
  the installed browser because this worktree lacks the bundled browser. No
  product files, renderer state, workflow files, push, or full CI run are in
  scope.
- **Next action:** Hand the commit to root for integration review.
