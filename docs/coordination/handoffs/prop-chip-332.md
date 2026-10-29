# Prop preview chip without coordinates

- **Updated:** 2026-10-29 UTC; outgoing owner `/root/riverside_ci_triage`; incoming integration owner `/root`.
- **Outcome:** Forecast chips name the affected prop and its consequence without exposing grid coordinates. Prop targeting, preview calculations, affected-unit names and confirmation copy are unchanged.
- **Acceptance:** The Quarry Gate touch preview shows the Oil Flask's break consequence without a coordinate tuple; the confirmation bar continues to name the flask and its consequence.
- **Location:** `/workspace/avatarrpg-332`, branch `codex/fix-332-prop-chip`, implementation commit `2c19716e632573c9e4e763e1b36e0eb00ccf8c3c`, based on `bc77ae2eceb6740dd4c143cae61595a1f4884bc2`. Not pushed; no PR.
- **Worktree state:** Implementation is committed. This handoff is the only pending tracked change. The focused Playwright preview process has exited; no local server is retained.
- **Completed:** `src/app/scenes/CombatScene.ts` removes the `at (x,y)` prefix from prop forecast chips. `e2e/combat-preview.spec.ts` asserts the Oil Flask chip still contains “flask shatters and oil spreads” and has no coordinate tuple.
- **Decisions:** Follows demo-flow audit item 24 and roadmap issue #332. Grid coordinates are useful in internal maps and technical diagnostics; the tactical preview should state the player-facing prop and result, and this display is the only screen in the audited flow that exposed a coordinate.
- **Verification:** On implementation commit `2c19716e`, `FNT_E2E_PORT=4332 npm run e2e -- --config /workspace/avatarrpg-env/playwright-332.config.ts --project=surface-touch --grep='touching a prop target names its break consequence before confirmation'` passed (1 test; 15.2 seconds). Focused Prettier check and ESLint passed for both edited source files. Full `ci:local` was not run per integration plan; WebKit and physical-device checks were not run.
- **Coordination:** Changes are limited to the prop forecast chip, its existing browser test, and this handoff. No changes to target selection, preview predictions, or unrelated combat screens. Root owns the combined integration and final required checks.
- **Next actions:** Root can cherry-pick this branch's implementation and handoff commits into the planned issue-fix batch, then run required verification on the combined revision.
- **Completion/transfer:** Implementation commit is complete and editing ownership is relinquished to `/root` for integration. No push, PR, or merge is claimed.
