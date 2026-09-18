# Quarry return narrative

- **Updated:** 2026-09-18 UTC; replacement writing owner
  `01a0b2e3-170e-7bb1-b2ab-d9e45dd780a9`, succeeding
  `01a0b294-82fd-7f02-9b91-303660f2ca1a`.
- **Outcome:** coherent victory return to Ba Dan, responsive NPCs/objectives and
  distinct situational contributions for the ten heroes. Preserve a terminal
  defeat ending. No new region, tactical kit or reward changes.
- **Acceptance:** normal movement reaches the return conversations; their facts
  match victory and Ruon's custody; every hero has an available contribution
  with absent/unconscious fallbacks; repeat visits preserve continuity; required
  checks pass on the integrated head. See the contribution table in
  [the writing guide](../../writing-guide.md).
- **Location:** `C:\Users\Jared\Documents\ChatGPT\Avatar RPG-return-writing`, branch
  `codex/quarry-return-narrative`, [draft PR #49](https://github.com/jaredbahr/Avatarrpg/pull/49).
  Published implementation head `0a26073` incorporates
  [#40](https://github.com/jaredbahr/Avatarrpg/pull/40) at `2bb426c`,
  [#45](https://github.com/jaredbahr/Avatarrpg/pull/45) at `ece2dc7` and main `a5edfdc`.
  Check the PR for the latest integration head and its checks.
- **Worktree state:** recovered clean; party voices and return content/tests are
  committed and published. No local-only assets. An ignored `.shots` config uses
  installed Chrome for local browser checks. No physical-device testing performed.
- **Completed locally:** party-specific variants at separate moments, Wen's
  pre-battle assessment, positive-HP speaker tests and same-element pair coverage;
  removed generic riverside punchlines; recorded Jared's rejected Dema example.
  The victory summary now leaves the party at the quarry with a continuation;
  post-victory NPC routes remember rescue, optional visits and Ruon's custody.
  Homeward objectives survive roadside discoveries and repeat conversations.
  This work is published as a draft, not merged or deployed.
- **Verification:** fresh `npm run verify` passed on `0a26073`: 611 tests, plus
  typecheck, lint and formatting. Tests include speaker availability, same-element
  pairs, outcome-sensitive return routes, discovery revisits and chapter progression.
  Browser and CI results belong in the PR with their exact tested head. Earlier
  successful checks do not verify a later integration revision.
- **Coordination:** writing owns story/content and NPC routes/objectives. Gameplay
  task `01a0b293-318a-7603-bd56-5b87e944054e` owns core/UI, navigation acceptance
  and the `e2e/bending-cels.spec.ts` clock race repair. Reuse that repair, do not
  author a competing fix. ADR 0022 defines optional `end.next` exploration targets
  and ordered map `objectiveVariants` with `{ when, text }`. No save field is added.
  Gameplay's #48 early kits are independent of draft publication; preserve writing's
  biographies alongside gameplay's grants/tests during eventual integration.
- **Deferred acceptance:** #40 and #45 must finish their required checks and merge.
  Gameplay owns the continuous normal-campaign traversal/save-load browser run;
  writing owns narrative corrections it uncovers. All ten contribution nodes must
  be reached through ordinary movement across suitable parties; content resolution
  tests alone do not establish that. The orchestrator owns full slice acceptance
  after combined art, kits and narrative integration.
- **Next actions:** finish focused browser checks; integrate the owned race repair
  and dependency merges; coordinate route and save checkpoints using the existing
  [playtest](../../connected-world-playtest.md). Keep #49 draft until bounded
  acceptance and dependencies are satisfied, then verify its current head and
  enable merge-commit auto-merge after addressing any feedback.
- **Completion/transfer:** pending. Replacement writing owner retains editing and
  integration ownership of #40 and #49.
