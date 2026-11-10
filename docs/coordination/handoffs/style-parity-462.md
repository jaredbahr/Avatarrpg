# Top-down style parity handoff

- **Updated:** 2026-11-07 05:43 UTC; Codex session `/root/avatar_rules_parity`; incoming owner: root for final review/publication.
- **Outcome:** Add a regression test proving synthetic top-down map presentation preserves Act 1 rules outcomes. No production changes.
- **Acceptance:** Compare default and swapped content indexes through both legal Ruon routes, all four Act 1 encounters, battle return crossings, cross-style save/load in both directions, and seeded `runCombat` results. A broken empty-rubble presentation must fail the same campaign oracle.
- **Location:** `jaredbahr/Avatarrpg`, `D:\AvatarRPG-work\style-parity-462-20261107-a`, branch `codex/style-parity-462-20261107-a`, base `894ac421fc9fd60606fb64ce8b259bdf455a11b0`; no PR yet.
- **Worktree state:** Test and this handoff are local; no push. No relevant processes remain.
- **Completed:** `src/content/styleParity.test.ts` drives both trade and escort routes with legal reducer commands, compares events and complete game/RNG state in lockstep, checks every battle return position, exercises cross-style load/reconciliation after two Grumbler AI turns, runs `runCombat` across all four encounters, and verifies source-map immutability. Party AI profiles match the existing simulator; authored HP is unchanged.
- **Decisions:** Synthetic empty scenes are registered for every map via `withTopDownMaps`. Campaign traversal follows the real story and map exits. The save fixture uses the same `reconcileBattleResult`, `reconcileDisciplines`, then `reconcileWorld` order as `App.adoptSave`.
- **Verification:** Focused Vitest passed 4/4; focused ESLint, Prettier check, `npm run typecheck`, and `git diff --check` passed before this handoff. `npm run ci:local` is not yet run; no browser, runtime, or visual review is claimed.
- **Coordination:** Test-only source plus this task handoff. Root reviewed the source and authorized commit, followed by exact-head `npm run ci:local` (9/9). Do not push until root reviews final commit and validation.
- **Next actions:** Commit only `src/content/styleParity.test.ts` and this file. Run `npm run ci:local` on that exact HEAD. Preserve any original failure and report its exact stage; do not weaken assertions or rerun to seek a pass.
- **Completion/transfer:** Pending validation and root publication. Root owns final review, push, READY PR, and merge workflow.
