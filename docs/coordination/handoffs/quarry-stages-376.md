# Quarry campaign stages — #376 local candidate

Base: PR #373, `6a85dc6fec39802f6246f4098c85928beecf4017`.
Local preparation branch: `codex/376-staged-candidate`.
External publication remains with the existing #370/#373 integration owner.
No push, dispatch, merge or deployment is part of this preparation checkpoint.

## Why and scope

The full dispatch [41123728916](https://github.com/jaredbahr/Avatarrpg/actions/runs/41123728916)
failed the original escort campaign twice at its unchanged 600-second budget.
The attempts reached different late controls; battle and story operations alone
consumed roughly 418–427 seconds, with routes, journals, walks and save/reloads
using the remaining budget. This evidence supports cumulative case cost; it does
not prove a product hang or claim that a source optimization fixes WebKit.

Each custody route becomes three independently runnable cases with the same
600-second case limit. The 10-second expectation limit, retries, original battle
driver, real clicks, story/battle guards and all existing assertions remain.
No product, content, workflow, budget or retry configuration changes are included.

## Checkpoint contract

The original `finishBattle` replaces living enemy HP with 1 before issuing real
commands. A mutation-free core replay cannot reproduce that combat history.
The new checkpoints instead come from legal core commands using the original
route seeds, original party and player order, default levels and story choices.
Their full serialized state and command transcripts are separately drift-pinned.
The generator validates deserialization and the existing App reconciliation chain.

Stages 2 and 3 clear storage, seed slot 1, then use the real **Load a save →
Slot 1 → Load** UI. Before continuing, each asserts the complete adopted fixture
state (including HP and RNG), player/session metadata and route boundary.
Stage 1 and stage 2 also compare their completed UI milestone with the legal
fixture's explicit route-boundary projection. This establishes story/route
continuity; it does not claim byte-identical combat histories across the cuts.
The projection retains the complete screen, flags, world, story, location,
pending choices and battle, plus each party member's id, character id, name,
level, XP and abilities in order. It does not compare RNG, log or other party
fields between independently played histories. No omission applies to the
complete fixture drift pins or complete adopted-save equality assertion.
In the four native boundary captures, a separate complete-state comparison found
that only RNG, log and party HP differed; removing those three fields made the
entire states equal. That observed equality also covered party fields omitted
from the runtime projection; it does not assert that all future combat histories
will match them. The evidence is `boundary-comparison.json` in the local evidence
directory. Both original save/reload checkpoint equality checks remain in stage 3.

## Original-to-stage mapping

Line numbers refer to the original `e2e/quarry-return.spec.ts` at the base above.
Shared helper implementations retain their interactions and assertions.

| Original lines | Stage | Coverage retained                                                     |
| -------------- | ----- | --------------------------------------------------------------------- |
| 358–376        | 1     | Clock, storage reset, original party/players/seed and new game        |
| 377–382        | 1     | Opening and walked Mira invitation                                    |
| 383–392        | 1     | East road, journal, forest battle and open-road objective             |
| 394–402        | 1     | Gate parley, Bo choice and custody assertion                          |
| 403–409        | 2     | Cutting route and escort-only ambush                                  |
| 410–415        | 2     | Quarry-floor journal, descent and Driller victory/Continue            |
| 417–423        | 2     | Read summary, Continue exploring, completion/objective/journal        |
| 425–428        | 3     | Original quarry save/reload and checkpoint equality                   |
| 430–443        | 3     | Return routes, Sen/Dema dialogue and journals                         |
| 444–461        | 3     | Village arrival and returning/resting profiles                        |
| 464–470        | 3     | Dorin handover and speaker pin                                        |
| 471–479        | 3     | Mira node, Next and custody response                                  |
| 481–495        | 3     | Gao route-specific text and trade-only Ruon line                      |
| 497–503        | 3     | Second original save/reload and repeated Mira response                |
| 505–529        | 3     | XP snapshot, resolved Driller revisit, no repeat fight/reward, return |

The gate cut is new. Neither starting fixture replaces an original save/reload
assertion. Stages are regular required-suite tests; no coverage moves to nightly.

## Validation and ownership

- All 12 focused checkpoint drift/replay/load tests passed. Scoped TypeScript,
  ESLint, Prettier and diff checks passed.
- All six production Chromium stages passed in one run, one worker, zero retries,
  Canvas, touch, 1194×834 at DPR 2. Case times were trade **43.053 / 39.856 /
  62.108 s**, escort **52.473 / 103.975 / 71.455 s**. Wrapper duration was
  408.259 s including the production build. The original 600 s case and 10 s
  expectation limits were retained. Source SHA-256 values matched before/after.
  Receipt, log, JSON report and four complete live boundary attachments are under
  `/workspace/avatarrpg-env/376-staged/`. This is Chromium evidence, not WebKit.
- The preservation audit in that evidence directory confirms identical TypeScript
  tokens for all **106 original campaign statements** (excluding the repeated
  per-case timeout setup) and all **nine original function helpers**. Added
  fixture loading, boundary assertions and JSON evidence are separate from that
  unchanged original coverage.
- Independent SOL High review (`/root/staged_review`) found no source blocker.
  The checkpoint generator was implemented by the separate SOL High
  `/root/checkpoint_generator` assignment; final acceptance stayed with root.
- The source gate is `npm run ci:local`, all nine stages, on the final committed
  candidate with no concurrent browser job. Its exact-head/result receipt is
  `/workspace/avatarrpg-env/376-staged/ci-local.receipt.json`; check that receipt
  and the matching `ci-local.log` before publication. No pass is inferred from
  an earlier commit or a focused check.

The local candidate does not change product, assets, dependencies or workflow
configuration. A generator comment clarification after the browser run changes
no executable tokens. Browser/source evidence is retained locally for the
integration owner; this candidate is not a delivered playable release.

Fresh repository coordination still reserves publication of #373 to the existing
#370 root. The accessible claim, latest #376 audit and handoff name that root but
provide no current session/task identifier. No separate published #376 branch/PR
or implementation worktree appeared in this environment. Unpublished work in
another environment cannot be excluded. This isolated candidate takes no remote
branch ownership and does not supersede the integration owner.

The integration owner can merge this local branch with a merge commit, preserving
its authored commits, after checking for newer work. Then run the exact integrated
head's local gate and the required hosted full dispatch under the existing cost
and ownership rules. Hosted WebKit and gallery success remain unproved. No push,
dispatch, merge, deployment or portrait work is authorized by this preparation
checkpoint; #310 stays held. No duplicate PR has been created.
