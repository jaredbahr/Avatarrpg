# AI self-support recipient parity (#558)

Owner: continuous gameplay-quality goal, root/session
`ai-self-support558-20261110`. Branch `codex/ai-self-support-558`, based on
`e75667a69b3649005e5dcdf3ab15a32feedfe734`.
[Verified pre-edit claim and milestones](https://github.com/jaredbahr/Avatarrpg/issues/558#issuecomment-6759636348).

The scorer discarded its caster even when the existing targeting rule allowed
self-support. A lone Mercenary Sergeant could legally Rally itself, and the
preview and real command applied Inspired, but its AI plan was null. Wounded
Healing Stream and self-shaped Stone Stance exposed the same mismatch.

The only runtime change imports `allowsCasterTarget`, keeps the stored caster
out of the recipient list, then includes the actual hypothetical caster when
that existing rule permits it. This uses the prospective footprint rather than
stale occupancy. Area attacks still exclude their caster; empty area attacks
remain rejected. Existing `to:self` scoring counts once, and full-HP heal-only
actions remain nonpositive. No weight, chance arithmetic, repeated-buff policy,
resolution, roster, content, progression, schema, renderer, art or budget changes.

Exact scope: `src/core/rules/ai.ts`, new `aiSelfSupport.test.ts`, new
`e2e/ai-self-support.spec.ts`, and this handoff. Open PR file scopes were fully
paginated before claiming; no existing owner of these paths was displaced.
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

These are dirty-source preflight results. Exact clean final-head `ci:local`,
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
