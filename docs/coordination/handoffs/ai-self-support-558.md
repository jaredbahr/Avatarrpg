# AI self-support and public movement parity (#558, #569)

Owner: continuous gameplay-quality goal, root/session
`ai-self-support558-20261110`. Branch `codex/ai-self-support-558`, based on
`e75667a69b3649005e5dcdf3ab15a32feedfe734`.
[Verified pre-edit claim and milestones](https://github.com/jaredbahr/Avatarrpg/issues/558#issuecomment-6759636348).

The scorer discarded its caster even when the existing targeting rule allowed
self-support. A lone Mercenary Sergeant could legally Rally itself, and the
preview and real command applied Inspired, but its AI plan was null. Wounded
Healing Stream and self-shaped Stone Stance exposed the same mismatch.

The recipient correction imports `allowsCasterTarget`, keeps the stored caster
out of the recipient list, then includes the actual hypothetical caster when
that existing rule permits it. This uses the prospective footprint rather than
stale occupancy. Area attacks still exclude their caster; empty area attacks
remain rejected. Existing `to:self` scoring counts once, and full-HP heal-only
actions remain nonpositive. No weight, chance arithmetic, repeated-buff policy,
resolution, roster, content, progression, schema, renderer, art or budget changes.

Exact amended scope: `src/core/rules/ai.ts`, new `aiSelfSupport.test.ts`, new
`aiWalkCost.test.ts`, new `e2e/ai-self-support.spec.ts`, this handoff, and only
derived save/transcript identity pins in `scripts/e2e/quarry-checkpoints.test.ts`
and `src/app/scenes/combatAim.test.ts`. Open PR file scopes were fully paginated;
no existing owner was displaced. The latter aiming work was explicitly split
from #357 into merged #556 by its owner. The quarry helper, returning-objective
test and all behavioral acceptance assertions remain unchanged.
Original #519/#520 failures remain authoritative; this is not their acceptance
fix or permission to relax their corpus, statistics or elapsed limits.

## Preserved evidence

- External clean-main discovery on `fe38ca21`, tree
  `bee8cabe84b30d33809b85bd035ea922a174d7b1`: legal preview/direct self-support
  versus `-Infinity`, null AI plan and no cast. Corrected probe 1.232s, log
  `b7d1285f699c225188784eb55d6a08911c6b303106402ac95022ef2d582650a9`.
  Initial invalid `linmei` fixture ID failed before a battle; that setup error
  stays separate. AI/targeting/content sources are identical on the newer base.
- Ten new unit cases on untouched `e75667a6` scorer: **5 failed / 5 passed**,
  2.060s wrapper, log
  `15da689f47a055c813b10194d844d3864ddf1d5874ca3de02ed78fe5028cec89`.
  Correction: **10 passed**, 2.022s, log
  `773c7335dd1dbdd0abca27929eedb441a3a2ce0531053cc7537d4633b3a3dc2a`.
  Cases cover actual self-heal/buff/Rally effects and planner-command parity,
  hypothetical square/legacy casters, ally support, area/empty/full-HP controls,
  unchanged inputs and RNG. Related AI/aim/footprint suites: **11 files / 77
  passed**, log `8255e3c5d1c31c61539504cf1bdb476e1d9aec32b8c75cfa551fcbe24fea2b1a`.
- Native baseline: **2 intended AI failures / 2 manual-control passes**,
  41.152s, log
  `8e83ef9afce37871599edde9e40c7fb9858747cdca975418129daddaf9ecaa42`.
  Actual runtime is retained own-CI producer
  `345610f72a53ec949393bfd64fa9d9948e71399e`, complete tree
  `03c1c6d8278395ccbafe88705d5737b3335b455f`; all353 build files stayed identical.
  New runner source and old runtime are recorded separately. Its rules/content
  match the base; unrelated UI revisions are not relabelled as current runtime.
- Preliminary own build passed. First candidate native run: **1 failed / 3
  passed** because a host poll missed the brief pose after Rally had succeeded;
  original report, trace and source retained. Exact event expectation was also
  corrected to include its required `tiles`, preserving assertion strength.
  The test now forwards unchanged real renderer frames and records actual cast
  draws, with a canvas capture after drawing. No timing/RNG/view mutation.
- Earlier actual spawn captures put the actor near the phone canvas edge.
  They remain retained, not visual acceptance. Final fixture stages the authored
  Sergeant and kit at clear interior `(14,6)` on the authored board, removes
  other AI actors, and sets its movement to zero. Presentation holds AI while
  the real Focus control brings it into view, then releases the actual turn.
  This explicitly tests focused presentation, not automatic camera framing.
  Consistent level2/100XP save fixtures pass normal serialization; no campaign
  or full-encounter-balance claim follows from their isolated setup.
- Final preliminary phone390x844/tablet1194x834 Canvas: **4/4 passed**, no
  skips/retries/flaky results, 26.194s, log
  `6da22a77c63d18baf52fcd5a7b7bc328889ae149f3428f2513b574476f5c8843`.
  Actual AI cast/state and real player self-heal controls passed; root inspected
  both focused cast captures with the whole actor visible. Existing simulation
  assertions: **24/24 passed**, 108.318s wrapper /43.388s tests, log
  `aec993fe147977b86813110aa52d26ae6a1226935d0dc46e603377e280061daf`.

## Failed full gate and movement repair

The first exact clean candidate `ee0dda4e2eb6a639bf19a6172ba0c8560fdc53f9`,
tree `a50d151788bd9a3848c3d14f67ea89699551f3e4`, **failed** full `ci:local`
at stage6/12, tests: 312 files passed, three failed; 4042 tests passed, one
failed plus two collection errors. Duration 412.975s, log
`c6e62d4ffc11af5704f7077a138be22558c5ade4bd0dc3af3504ade5ea8f1917`.
Later build/budget/art/balance stages did not run. The untouched exact parent
passed all three affected files, **34/34**, log
`8476e60dd8fc45a8f8a25b1a25e91b8ccfd8d264637292e1645f23eb4799bc18`.
These were new-route regressions, not waived baseline failures.

Read-only command forwarding isolated a pre-existing AI walker defect: Lin Mei
had four movement points and planned `(7,9)→(6,9)→(5,9)→(5,10)`, charged as
three despite the public uphill cost of four. Her next move used the phantom
point; strict public replay correctly refused it. Self-support changed the route
that exposed this defect, without changing movement modifiers.
[Narrow issue #569 and verified pre-edit claim](https://github.com/jaredbahr/Avatarrpg/issues/569#issuecomment-6760335491)
remain under the same integration owner and branch.

The private walker now validates the entire path with existing `pathCost`,
places each step while alive, debits the full upfront cost and emits the actual
walked prefix, matching public movement. The unused anchor-only cost helper is
removed. No new movement rule, status interruption policy or heuristic is added.

- Four independent public-command/cost oracles **all failed before**, log
  `e94ae7011993cdbd43cc87f86145217c587d4567272da21e676956ace763c995`:
  uphill debit, square/legacy whole-footprint oil costs, and lethal fire's
  actual prefix/full upfront debit. With the repair, these plus the ten
  self-support cases **14/14 passed**, log
  `98541e0f9f4b5dc9f15afa55d76bab5aed607816c344e382661b7cb808e0fa99`.
- New actual rendered baseline: **two intended failures**, tablet and phone,
  log `9c1ea56d46b1eca0a0f691985093c05fed252546a3272a4d4ed7bd2ec78acd24`.
  The authored Sergeant at `(4,9)` walks uphill to `(3,10)` beside an isolated
  Nilak. Actual runtime events report cost1 versus the public cost2. Its walk
  frames are captured from unchanged renderer draws; `App.dispatch` forwards
  commands once and records its returned events. Turn-end zeros movement, so
  the native oracle compares actual events and the public move/end-turn actor;
  unit tests inspect the pre-end-turn budget. All353 retained build files
  stayed unchanged. This is an isolated authored-board fixture, not a campaign.
- The repaired helper completes both legal routes. Before refreshing identity
  pins, the three affected files reached **31 passed / three pin failures**;
  all collection errors were gone. A separate baseline/candidate comparison
  generated each route checkpoint twice, verified determinism and exact equality of
  every route-boundary projection plus the aiming actors, geometry and battle
  fields. Log `92a23d46ea1b133d478e001bc896b57379579f7e524c2c628b2ee4563683ebfa`.
  Only derived after-Driller saves/transcripts/counts and aiming save/count
  changed. Gate-entry pins, story/custody/party/XP/level, legality, objective,
  bounds, HP/AP and aiming assertions are preserved. Both legal replay loops
  and load reconciliation still execute every command. All five focused
  files now **48/48 pass**, log
  `f214b26cb54d5270926612218c138a4f035a5bd66868e9d3052a541c7c1d86c0`.
- Corrected build passed after preserving/fixing one native-driver TypeScript
  unchecked-index error. The first repaired native run passed four cases and
  failed the two walking full-state checks because App load reconciliation
  snapped the fixture's Nilak from `(2,10)` to `(2,9)`. Actual uphill cost/path
  assertions had passed. Report/source/trace/log
  `e2ecae55555fefd3285ac9170e550283132102ecd9fa58c8a2007099b77f5162`
  remain intact. The fixture now uses clear `(2,9)` and additionally requires
  unchanged state through App's reconciliation chain and actual adopted state
  before releasing AI. No assertion is weakened. Corrected preliminary native
  **6/6 passed**, no skips/retries/flaky results, 33.461s, log
  `9e99d723b8ddef4dc7628281e94d68035beca3b761bb64bcf88b72243fd82fbb`.
  Root viewed both cast and uphill-walk captures at both viewports, with actors
  fully visible. Independent SOL High review found no blocking correctness
  issue in the seven-file change; final exact clean-head CI/native remain due.

Unless explicitly identified as the failed clean head, these are dirty-source
preflight results. Exact corrected clean final-head `ci:local`,
own-CI-build native results, complete source/build identity, final root capture
review, remote head/tree/blob checks and actual hosted jobs/skips are recorded
separately in the PR and publication receipt. No earlier result substitutes for
those gates. Independent SOL High source/evidence review is retained locally.

Evidence: `/workspace/avatarrpg-env/ai-self-support558/` and sibling
`ai-support-discovery/`. Keep DRAFT; physical input/device, WebKit/PWA, WebGL,
automatic camera framing, hardware performance and broad visual/art acceptance
remain open. Corrections stay on the same branch/PR with expected-head checks.
No merge/deploy/dispatch/rerun/install/security/art/paid actions. No DeepSeek
request: approved executor/shared cumulative ledger remains unverified.
Protected #423/#443/#479 ownership and retained-candidate workflow stay separate.
