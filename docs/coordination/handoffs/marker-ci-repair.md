# Exploration marker CI repair

- **Outcome:** Made the intercepted probe atlas deterministic by remapping
  `unit.enemy.thug/idle/1` to the same red source rectangle as idle frame 0.
  The test still fetches and renders the intercepted atlas and keeps its strict
  red pixel predicate.
- **Cause:** CI run `35478889189` trace showed successful `thug.json` and
  `thug.png` fulfillment, a visible `1368x715` canvas, and sample point
  `(876, 314.64)`. The red/green probe alternated at 1 fps; slow software
  WebGL screenshot readback phase-locked repeated polls on green.
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
