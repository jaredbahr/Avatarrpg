# Responsive combat gesture regression repair

- Updated: 19 September 2026; gesture CI repair agent → root integration owner.
- Outcome: correct a stale 96px initial-frame premise in the pinch integration
  test while protecting responsive framing and every existing gesture assertion.
- Location: `codex/gesture-ci-repair`, isolated worktree
  `C:/Users/Jared/.codex/worktrees/gesture-ci-repair`, based exactly on
  `fc37c6a0bb4928d6a4926c5c0d502d928705940f`; landing through PR64 only.
- Diagnosis: CombatScene intentionally chooses 64px normal-text framing for
  compact decision canvases. CI35438371967 and local Chrome1194x834 both failed
  the obsolete >=96 expectation before any pinch. Product behavior is unchanged.
- Completed: `e2e/gestures.spec.ts` allows the established 64px compact frame in
  the gesture test and independently asserts exact 64px/96px framing at fixed
  1194x834/1368x912 profiles. It records actual canvas/camera JSON, checks usable
  canvas dimensions and the full acting tile's visibility. The existing actor
  visibility assertion is shared unchanged. Zoom ratio, anchored tile, Recentre,
  pan, wheel, footer reflow, fitted targeting and actor-change tests remain intact.
- Verification: source on fc37c6a plus this test change passes `npm run verify`:
  typecheck, lint, formatting and 836 tests in 99 files. Installed Chrome passes
  all 27 gesture checks across Surface, iPad landscape and portrait sizes, no
  skips/flakes. Compact canvas measured 1194x541.109 CSS pixels with 64px tiles;
  Surface measured 1368x619.109 with 96px tiles. Local evidence:
  `gesture-before.local`, `gesture-matrix-final.local`, `gesture-verify.local`.
- Coordination: test-only source; no product code, release version, CI dispatch,
  push or budget changes. Root owns integration, current-head CI and automatic
  merge; other owners' worktrees were untouched.
- WebKit: all 18 gesture checks pass on Windows WebKit 2359 using the actual
  iPad landscape/portrait project settings, no skips/flakes. Measured canvas
  heights are 541.125 and 619.125 CSS pixels; exact scale and full actor tile
  checks pass. Evidence: `gesture-webkit-final.local`. Root supplied the runtime.
  Reproduction uses production preview on port 4269; port 4190 caused initial
  navigation to time out before the app loaded, while 4269 loaded immediately.
- Transfer: source committed locally for root to cherry-pick into PR64.
  No preview servers remain running. Full current-head CI remains root-owned.
  Windows browser emulation does not establish physical iPad behavior.
