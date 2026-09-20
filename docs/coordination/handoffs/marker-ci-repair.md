# Exploration marker CI repair

- **Outcome:** Made the intercepted probe atlas deterministic by remapping
  `unit.enemy.thug/idle/1` to the same red source rectangle as idle frame 0.
  The test still fetches and renders the intercepted atlas and keeps its strict
  red pixel predicate.
- **Observed facts:** CI run `35478889189` trace showed successful `thug.json`
  and `thug.png` fulfillment, a visible `1368x715` canvas, and sample point
  `(876, 314.64)`. The probe's idle entries were red frame 0 and green frame 1
  at 1 fps. The timeout occurred during repeated screenshot polling.
- **Inference:** Slow software WebGL screenshot readback could phase-lock those
  polls on the green frame, explaining the red-only timeout; the deterministic
  fixture removes that timing dependency.
- **Evidence:** Retained report and trace at
  `C:\Users\Jared\.codex\worktrees\marker-ci-repair-artifacts\ci-artifact-35478889189`.
  The report has no screenshot attachment; its trace contains the network
  fulfillments, coordinates and timeout.
- **Validation:** Focused Edge run, Canvas and WebGL: 2/2 passed. Temporary
  invalid-atlas negative probe: passed because the same red predicate stayed
  false; the probe was removed and is not part of CI. `npm run verify`: passed
  (105 files, 873 tests).
- **Scope:** Test fixture and this handoff only. No renderer/product change,
  clock control, generic green acceptance, push, or CI rerun.
