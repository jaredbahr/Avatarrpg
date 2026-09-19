# Combat outcome preview handoff

- **Updated:** 2026-09-18 UTC; outgoing owner `combat_preview`; integration owner `/root`.
- **Outcome:** The combat confirm step forecasts live prop breaks, prop movement,
  reaction surfaces, landing hazards, shove destinations, and status upgrade or
  cleanse results from the current rules. Chance outcomes remain probabilities.
  Art, maps, navigation, kits, and balance are outside this handoff.
- **Acceptance:** A prop-only aim produces a named consequence; oil flask break
  reaches fire-on-oil; a water barrel reports cover removal and Wet collateral;
  Shove reports the brazier's oil landing; cabbage-cart break reports blind and
  collateral pushes; unit pushes stop at blockers, map edges, and large-unit
  footprints; previews leave source state and RNG unchanged.
- **Location:** `C:/Users/Jared/.codex/worktrees/combat-preview`, branch
  `codex/combat-outcome-preview`, based on `origin/main` at
  `44ed3f60141b97dfcc2899c854846d7f02b4930c`. Frozen PR64 candidate
  `dac99826d02fb770bb53213168a9c4d9c5161854` was not edited. Local-only; no
  standalone PR or push.
- **Worktree state:** Final implementation and focused tests are committed on
  this branch; the checked head is recorded below after the last verification.
- **Completed:**
  - `src/core/rules/reactions.ts` runs a bounded throwaway `BattleDraft`,
    journals shared surface reactions, prop outcomes, exact shoves, landing
    effects, and status forecasts.
  - `src/core/state/battleDraft.ts` records reactions and supports preview drafts
    that do not choose chance status branches; normal resolver drafts retain the
    existing RNG behavior.
  - `src/core/rules/abilities.ts` exposes additive prop, shove, and status data
    while retaining existing reaction and target fields.
  - `src/app/scenes/CombatScene.ts` names prop consequences, cover removal,
    destinations, landing hazards, upgrades, and clears in the confirmation bar.
  - `src/core/rules/combatPreview.test.ts` covers deterministic prop, reaction,
    shove, boss-footprint, and status scenarios.
  - `e2e/combat-preview.spec.ts` covers a touch aim at the quarry oil flask and
    checks the named break label before confirmation.
- **Decisions:** Prop damage and break effects run before impact through the same
  `BattleDraft` methods as resolution. The preview cursor is detached and chance
  statuses are described rather than selected. Prop targets are included for
  push or pull even when blocked; ordinary surface aims do not invent a prop
  consequence when no live prop event occurs.
- **Verification:**
  - `npm run typecheck` — passed.
  - `npm run lint` — passed.
  - `npm test` — passed locally: 73 files, 695 tests (before the final handoff
    commit; focused follow-up tests are listed below).
  - `npm test -- --run src/core/rules/combatPreview.test.ts src/core/rules/reactions.test.ts src/core/state/props.test.ts` — passed: 78 tests after the final preview refinements.
  - `npx playwright test e2e/combat-preview.spec.ts --project=surface-touch` —
    not run to completion because this host has no installed Playwright Chromium
    executable; the test is committed for CI touch coverage.
  - `npm run verify` — run against the final checked head and recorded in the
    transfer message.
- **Coordination:** Core rules, `BattleDraft`, and the lower confirmation panel
  belong to this task. Camera methods in `CombatScene` remain owned by the
  separate gameplay guidance worktree. Root should integrate this branch's
  checked commits and resolve only any overlapping camera context.
- **Next actions:** Verify the final head and handoff doc, then integrate the
  branch into the release route. Re-run required combined browser and gallery
  checks after integration.
- **Completion/transfer:** Pending root integration; this owner relinquishes
  editing after the checked commit and handoff are sent.
