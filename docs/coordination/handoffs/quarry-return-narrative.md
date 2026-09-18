# Quarry return narrative

- **Updated:** 2026-09-18 UTC; writing owner `01a0b294-82fd-7f02-9b91-303660f2ca1a`.
- **Outcome:** coherent victory return to Ba Dan, responsive NPCs/objectives and
  distinct situational contributions for the ten heroes. Preserve a terminal
  defeat ending. No new region, tactical kit or reward changes.
- **Acceptance:** normal movement reaches the return conversations; their facts
  match victory and Ruon's custody; every hero has an available contribution
  with absent/unconscious fallbacks; repeat visits preserve continuity; required
  checks pass on the integrated head. See the contribution table in
  [the writing guide](../../writing-guide.md).
- **Location:** `C:\Users\Jared\Documents\ChatGPT\Avatar RPG-return-writing`, branch
  `codex/quarry-return-narrative`, based on narrative integration `2bb426c` from
  [PR #40](https://github.com/jaredbahr/Avatarrpg/pull/40). No follow-up PR yet.
- **Worktree state:** uncommitted content, focused tests, writing guide and three
  narrative-string edits in `VillageLife.ts`. No local-only assets. Dependency
  installation finished. No physical-device testing performed.
- **Completed locally:** party-specific variants at separate moments, Wen's
  pre-battle assessment, positive-HP speaker tests and same-element pair coverage;
  removed generic riverside punchlines; recorded Jared's rejected Dema example.
  This work is not merged or deployed.
- **Verification:** intermediate local `npm run verify` passed 594 tests. Later
  journal/title edits still need final verification. Prior-head CI does not verify
  this follow-up. The eventual PR description records the exact tested SHA.
- **Coordination:** writing owns story/content and NPC routes/objectives. Gameplay
  owns core/UI and navigation tests. Its contract is
  [PR #45](https://github.com/jaredbahr/Avatarrpg/pull/45), head `47d903f`, ADR 0022:
  optional `end.next` targets exploration; ordered map `objectiveVariants` use
  `{ when, text }`. No save field is added. Same-element kit work belongs to gameplay.
- **Deferred dependency:** production return wiring awaits integration of #45's
  types/schema/UI. Until it is included, this branch does not claim a playable
  post-victory return. The dependency is available; it requires integration rather
  than user input.
- **Next actions:** finish and verify the independent dialogue commit; merge the
  agreed #45 branch; wire `act1_epilogue.next` to `quarry_after_explore`, author
  post-victory map objectives and NPC routes; test victory/escort/trade/revisits;
  open one follow-up PR and report its exact head to gameplay for route testing.
- **Completion/transfer:** pending. Writing ownership remains with this task.
