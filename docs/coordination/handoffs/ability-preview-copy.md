# Combat preview displacement copy handoff

- **Updated:** 2026-09-19 UTC; outgoing owner `world_conversations`.
- **Outcome:** The shared combat confirmation sentence now says `Mercenary:
pushes to (12,5)` or `Mercenary: pulls to (12,5)`, fixing the visible `pushs`
  typo found in manual Quarry Gate play.
- **Location:** `C:/Users/Jared/.codex/worktrees/ability-preview-copy`, branch
  `codex/ability-preview-copy`, based on `ff243ab`. No PR, push, CI run, or
  preview server was used.
- **Completed:** `src/app/ui/combatPreviewText.ts` owns the small
  `formatShoveMovement` sentence helper; `CombatScene` uses it for unblocked
  shove forecasts; `combatPreviewText.test.ts` covers both push and pull
  inflections with the actual visible sentence.
- **Scope:** Presentation copy only. Core shove forecasts, pathing, resolution,
  renderers, camera, layout, rules, and ability data are unchanged.
- **Verification:** Focused helper plus combat-preview tests passed (13 tests).
  `npm run verify` passed typecheck, lint, Prettier, 95 test files, and 824
  tests. The worktree-local `node_modules` junction points to the existing
  dependency install and is ignored; no dependency files are part of the
  handoff.
- **Limits:** This is automated copy and unit-test evidence. No browser capture,
  physical-device, CI, or subjective writing review was performed for this
  one-word correction.
