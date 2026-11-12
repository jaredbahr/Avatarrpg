# Return from Pause after Settings (#673)

- **Owner / source:** `root/pause-return-focus673-20261112`, branch `codex/pause-return-focus-673`,
  based on main `055bfefe48977aec57ad6bd6b29a9a66eed3e680`.
- **Claim and validation:** [issue comment 6825651525](https://github.com/jaredbahr/Avatarrpg/issues/673#issuecomment-6825651525),
  verified before edits. Revision-specific outcomes and evidence belong in the live claim and eventual PR.
- **Problem:** while a world conversation is open, Pause → Settings → Show grid rebuilds the exploration
  header. Settings → Done correctly returns to the parent Settings button, but Resume loses focus because
  Dialog's original Pause opener is detached. The unchanged-settings control returns correctly.
- **Change:** App accepts an optional return callback for Pause and invokes it only after normal dismissal
  leaves focus on the body, the same scene remains and no modal owns focus. Programmatic `closePause`
  cancels it before closing. Exploration supplies a lazy callback to its current, connected, visible,
  enabled Pause button; unmount retires the reference. Combat's existing pause/resume behavior and
  callers without a callback retain their current behavior, including Node tests without a document.
- **Coverage:** new `e2e/menu-return-focus.spec.ts` preserves the original no-change/Show-grid keyboard
  oracles and whole-state equality. It adds text size, difficulty after a header rebuild, child focus,
  one-layer Escape, a controlled connected-focus owner, and actual Load cancellation observed through
  focus events on the old header. Load setup uses public `saveTo`; navigation uses real controls.
  Difficulty changes only the chosen difficulty value. Fixtures use supported conversation helpers,
  not an earned campaign route. No staged-dialogue, combat or broader layout acceptance is claimed.
- **Baseline:** root observed 1 PASS control / 1 FAIL Show grid, 29.133 s, log SHA256
  `98ab52c6c7fa5f845c4cdb02fac249bc6a1cd9b94d319ef8f016f886cdec4b3d`.
  The original probe, focus observations and receipt remain at
  `/workspace/avatarrpg-env/settings-return-discovery-20261112/`; no baseline rerun is needed.
- **Scope:** only App's private callback and open/close Pause methods, ExploreScene's current Pause
  reference/banner/unmount, the new browser spec and this handoff. No generic Dialog, SettingsPanel,
  PauseMenu, conversation/staged/combat scene, save/adoptSave, rules, content, renderer, style, asset,
  version, workflow or budget changes. The separate ballot-load fix is not included.
- **Acceptance:** root owns focused existing App pause/reward checks, native browser checks and unchanged
  required exact-head `ci:local` gates before DRAFT publication. Browser cases retain 60 s / 10 s limits
  and zero retries. The report-only Lighthouse dependency is unavailable in the current approved toolchain;
  no dependency install or Lighthouse qualification is claimed. Record actual setup failures if encountered.
  Physical/manual input, WebKit/Safari, PWA, FPS, device floors, merged runtime and owner acceptance remain open.
- **Transfer evidence:** exact source hashes and reviewed hunk boundaries are external at
  `/workspace/avatarrpg-env/pause-return-focus673/implementation-receipt.json`. The integration owner
  coordinates review and serialized validation; no runtime result follows from source review alone.
