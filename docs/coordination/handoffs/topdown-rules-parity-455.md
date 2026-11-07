# Handoff: top-down rules scene parity (#455)

- **Updated:** 2026-11-07; implementation owner `/root/avatar_rules_parity`; awaiting root review.
- **Outcome:** Top-down map swaps retain scene fields read by core rules. No `src/core/` files changed.
- **Acceptance:** Exported carry-over list names the core reader; empty presentations preserve `paintedRubble`, explicit presentation data wins, and return tiles match across rubble combat maps, battle crossings and party sizes 1–6.
- **Location:** `jaredbahr/Avatarrpg`, `D:/AvatarRPG-work/topdown-rules-parity-455-20261106-a`, branch `codex/topdown-rules-parity-455-20261106-a`, based on `768fdeaaba01d321ac3bf3d4a80f185574cfb423`. Implementation commit: `57c8889d1c5c47b00ea36ff1faccead9ebabfa84`.
- **Completed:** `src/content/topdown.ts` exports the rules-scene field list and carries missing fields into top-down scenes. Added `src/content/topdownRulesParity.test.ts`; updated the presentation identity assertion to preserve the existing no-carry identity case and check the cloned scene when rubble is carried.
- **Verification:** `npm run ci:local` passed on the implementation tree: typecheck, lint, format, 288 test files / 3,463 tests, build, bundle budget, art validation, asset budget and balance. Mutation check: bypassing scene carry-over made the parity test fail at Forest Road `(8,4)`, party size 1 (`top-down` returned `(8,4)`, oblique returned `(9,4)`). Git Bash was added to `PATH` for the repo's `sh`-based art check.
- **Coordination:** Live #455 labels were `codex-ready` and `agent:codex`; no issue comments or owning PR found. Open PR #450 is the noted presentation dependency; the #451 handoff says its `paintedRubble` parity task was not started. No push or PR created.
- **Next:** Root review and publication; required checks must run on the eventual PR head. Remove this session's generated `.review/regions/regen-check` after validation.
- **Transfer:** Local commits preserved; implementation owner stops editing on transfer.
