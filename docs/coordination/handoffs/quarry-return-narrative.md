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
- **Worktree state:** party voices are committed in `b816d4a`; the agreed engine
  contract is integrated in merge commit `4e6ed49`. Return content and its tests
  are authored locally and awaiting the follow-up commit. No local-only assets.
  An ignored `.shots` config uses installed Chrome for local browser checks.
  No physical-device testing performed.
- **Completed locally:** party-specific variants at separate moments, Wen's
  pre-battle assessment, positive-HP speaker tests and same-element pair coverage;
  removed generic riverside punchlines; recorded Jared's rejected Dema example.
  The victory summary now leaves the party at the quarry with a continuation;
  post-victory NPC routes remember rescue, optional visits and Ruon's custody.
  Homeward objectives survive roadside discoveries and repeat conversations.
  This work is not merged or deployed.
- **Verification:** local `npm run verify` passed 608 tests on the combined content
  and engine contract. These include speaker availability, same-element pairs,
  outcome-sensitive return routes, discovery revisits and chapter progression.
  Prior-head CI does not verify this follow-up. The eventual PR description
  records the exact tested SHA and browser results.
- **Coordination:** writing owns story/content and NPC routes/objectives. Gameplay
  owns core/UI and navigation tests. Its contract is
  [PR #45](https://github.com/jaredbahr/Avatarrpg/pull/45), head `47d903f`, ADR 0022:
  optional `end.next` targets exploration; ordered map `objectiveVariants` use
  `{ when, text }`. No save field is added. Same-element kit work belongs to gameplay.
- **Deferred acceptance:** #40 and #45 must finish their required checks and merge.
  This branch includes their exact implementations, but their production status
  is not assumed. Gameplay owns the full continuous traversal/save-load browser
  acceptance after this content is available. All ten contribution nodes must
  also be visited through ordinary movement across suitable parties; content
  resolution tests alone do not prove that playthrough.
- **Next actions:** complete focused browser checks; commit/push and open one
  follow-up PR; report its exact head to gameplay for continuous route testing;
  mark ready after dependency integration, then confirm current-head CI and merge.
- **Completion/transfer:** pending. Writing ownership remains with this task.
