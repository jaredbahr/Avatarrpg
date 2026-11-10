# Encounter spawn validity (#563)

Owner: continuous gameplay-quality goal, root/session
`encounter-spawns563-20261110`. Branch `codex/encounter-spawn-validity-563`,
based on live main `30815ebb817a410bae375df3c0f7ebc5473f53ce`, complete tree
`671a37cd2bf25a38edb1bc1b6884c846735ee771`.
[Verified pre-edit claim](https://github.com/jaredbahr/Avatarrpg/issues/563#issuecomment-6760968798).

The new test exercises real encounter assembly across table sizes1–6, each
eligible pinned variant and the shipped spatial flag states. It checks complete
unit footprints against bounds, blocked terrain, props, other units and flat
size-2 footing. Every enemy must reach a position adjacent to a party footprint
without overlapping it, using the actual prop-baked grid, surface and climb
costs, and large-unit movement rules. Unit blocking is removed for this
multi-turn reachability check; standing props and terrain retain their rules.

Roster identities/counts and immediate reinforcement suffixes are checked.
The current schema/runtime has no delayed waves. The Grumbler's conditional
cabbage cart is exercised in both flag states. Existing documented nearby
relocation remains valid; this does not impose a new preferred-coordinate
contract. Real creation on adversarial maps provides collision, blocked,
out-of-bounds and disconnected-island controls plus a successful nearby repair.

Exact scope is two new files: `src/core/state/encounterSpawns.test.ts` and this
handoff. Existing runtime/content, encounter balance, maps, existing tests,
schemas, rendering and assets remain unchanged. Existing SOL High Standard
`ai520_review` authored only the new test file; root owns integration and
validation. Independent review precedes draft publication. This task is disjoint
from delivered #558/#569 draft PR570 and protected #423/#443/#479 ownership.

## Verification before the clean-head gate

The new file contains 60 shipped assemblies: forest18, gate12, cutting6 and
floor24, plus one coverage case and five adversarial/repair controls. No shipped
spawn defect was found, and no data or gameplay change is included.

First focused run: new66 cases and existing square-footprint/variant/difficulty
tests, **4 files /92 passed**, 3.763s wrapper; stable source, log
`abf5f94964277a56014e9faa1dba761b9e12f778227587f780702ed21a5e1529`.
The environment restarted after this run completed; its original receipt, log
and unchanged source were recovered, without repeating an interrupted job.

Root then strengthened enumeration to include eligible zero-weight explicit
pins, which the schema and setup API support, while retaining the genuine base
roster when random selection has no eligible positive-weight variant. Coverage
requires every listed variant. The current 60 shipped scenarios are unchanged.
Updated focused run: **4 files /92 passed**, 3.782s wrapper; new66 cases229ms,
log `6d974923e651bd023d16a4513cd5e138912cc5db5ec113dcf286d00d6c8617ea`.
Final test SHA256:
`183c7e27691220a48a11aca77d8999b32ea40c14d9db7ebe32f9de861146eddf`.

Independent SOL High review and recheck found no blocking correctness issue.
Roster expectations reuse `encounterRoster`; the independent spatial checks
inspect the actual assembled cells. New negative controls use size1 units;
existing square-footprint tests supply complementary adverse 2x2 footing,
corridor and cliff coverage. This does not claim new adversarial geometry cases
for every enemy size.

Full typecheck plus scoped lint/format preflight passed, 16.922s wrapper,
stable source; log
`cb6f482328e019c36c78f2883c52f4cae4adbddea14efe3ccb3d77b279b0d6aa`.

Full exact clean-head `ci:local` and publication are **not run** at this source
checkpoint. Final results, clean commit/tree and actual hosted jobs/skips are
recorded separately in the PR and publication receipt. No result is inferred
from another branch's checks.

Evidence and original failures: `/workspace/avatarrpg-env/encounter-spawns563/`.
Next: freeze a canonical clean commit and pass full `npm run ci:local` before
pushing a DRAFT. Tests-only coverage makes no new
native, physical-device, visual or full campaign acceptance claim. No merge,
deployment, dispatch/rerun, installation, paid request, art generation or
security/access change. No DeepSeek request; executor/shared ledger unverified.
