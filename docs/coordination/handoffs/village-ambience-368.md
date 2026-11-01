# Village ambience #368: partial draft handoff

Updated 2026-11-01 UTC. Root retains integration/verification and
PR-correction ownership. SOL High workers implemented and independently reviewed
source and native proof. Claim:
<https://github.com/jaredbahr/Avatarrpg/issues/368#issuecomment-6536742481>.

## Outcome and ownership

Four additions use existing pixel primitives: canal glints, floating canal
leaves, market-vessel steam and evening/night lantern flicker. Reduced motion
omits new water movement and freezes steam/lamps. These cover three suggested
categories and **do not close #368**. Birds, cloth, animals, additional chimney
calibration and full acceptance remain open.

Draft PR #380 publishes branch `codex/village-ambience-368`, base
`bc77ae2eceb6740dd4c143cae61595a1f4884bc2`. Initial implementation worktree
`/workspace/avatarrpg-368` retains its separate local commit graph. The current
evidence-only follow-up uses `/workspace/avatarrpg-env/review-368-motion/source`,
branch `codex/village-ambience-368-motion-evidence`, based directly on published
`1d4b7ee53442f6e8569f97438c1271114141e93b`. Consult the PR/claim for the final
publication SHA, exact local verification receipt and actual latest-head jobs.

The implementation changes ambience, optional anchors/types/schema, recipes and
one coordinated ExploreScene call (PR354/374 notified). This follow-up changes
only four MP4s, curated provenance and evidence/handoff documentation. Existing
backends, overlays, texture caches, resident/trail logic, generated art, public
assets, tests, workflows and #370 sources remain untouched. No paid request,
generation, merge, deployment or release-version bump occurred. ADR0101 records
the presentation contract.

## Evidence and validation

Independent review caught the initial integer-grid schema on fractional anchors;
`f8ef42c7` fixed it with finite fractional/negative coordinates while preserving
logical-grid restrictions and adding direct regressions. No source blocker
remained in samplers, transforms, pixel rungs, water corridor, phase/frozen paths
or state boundaries.

- Dedicated source cases: 9/9; existing content validation: 48/48.
- Unchanged renderer suite: 12/12 at `07fe7d0e` in 7.5 minutes.
- Original dedicated phase review: 10/10 at `8f7dd4ab`, 6.1 minutes, both
  backends, zoom1/DPR1, real Wait UI including night/morning, no runtime errors.
- **Continuous recording review: 8/8**, actual exit0/3.5 minutes, exact published
  `1d4b7ee5`, complete tree `a091f1be8f02cf3d995e8d93803121d5207e3d24`.
  Both backend summaries complete; no runtime/probe errors. Clean source,
  fixture/config and complete dist hashes stable before/after. Independent SOL
  checked these receipts and valid uninterrupted native videos.
- Application tree `4da9a8ac06cb060dff8433f074637dbb96d7740f` and public tree
  `8e267fed53781d8d53546b888f0d48572b19682f` match across all native builds.
- [Curated videos and limitations](../evidence/368/README.md) and
  [shot provenance](../evidence/368/motion-provenance.json) preserve source
  identity, hashes, measured spans, encoding cadence and prior failed runs.
  Live videos contain two roughly 15-second continuous shots; reduced videos two roughly 10-second continuous
  shots, with an explicit west/east cut. Old sparse clips remain at their old
  published revision. Raw context video and the executed external fixture are
  retained under `/workspace/avatarrpg-env/review-368-motion/`.
- Recording live draw counts were roughly 27–29/s Canvas, 2.3–2.4/s software
  WebGL. Encoding 25fps is not game FPS. This does not establish smoothness,
  sustained 60fps, physical/native-GPU behavior or owner aesthetic acceptance.

Before the initial publication, clean local `b1d7a8c6` passed ci:local 9/9,
257 files / 3,007 tests; its full tree equals published `1d4b7ee5`. Automatic hosted
run 41156209259 on that published head passed verification; actual browser/gallery
matrices were skipped despite aggregate successes. Those results apply to that
revision. Final evidence-revision verification is recorded separately in the PR
and claim, with receipt `/workspace/avatarrpg-env/review-368-motion/ci-final.receipt.json`.
An earlier receipt never covers later tracked edits.

## Current main integration

PR #373 merged after full run 41220601354 passed verification, all six actual
browser shards and all seven actual gallery shards. Current integration base is
`0d4c2b938f56bd5f8853323b0ea85d13b9a61ff2`. This milestone merges that main into
the existing published #368 history without conflicts or rewritten authorship;
the only additional task-owned edit is this handoff. Main's texture lifetime,
village control and browser-driver corrections remain intact. No new ambience
category or shared renderer correction is included.

The isolated delivery checkout is
`/workspace/avatarrpg-env/resume-368-main/source`, local branch
`codex/village-ambience-368-main-update`, based on published `3fbed108`.
Fresh exact-head full validation and affected native checks are required before
publication. Consult the PR and same ownership claim for final source/tree IDs,
actual exits and hosted jobs, including skipped matrices; earlier receipts do
not cover this merged tree. External receipts stay under
`/workspace/avatarrpg-env/resume-368-main/`. No release version is bumped for
this unshipped integration checkpoint.

The separate unrecorded Canvas audit observed 35.25 / 33.54 / 35.70 draws/s on
the preceding PR tree and 35.00 / 33.11 / 36.50 on unchanged old main, under a
matched three-party, zoom1/DPR1 protocol with no media or traces. Both missed
60fps on that runner. One fixed-order pass proves neither a causal regression
nor equivalence or physical-device behavior. A ten-second attribution diagnostic
identified the shared shadow pipeline as a profiling lead; nested timings
overlap, and no fix is proven. See the
[exact audit and retained failed acceptance](https://github.com/jaredbahr/Avatarrpg/pull/380#issuecomment-6545138354)
and the
[renderer ownership request](https://github.com/jaredbahr/Avatarrpg/issues/341#issuecomment-6545265094).
The request has no scoped handoff as of this integration; do not edit its backend
scope or claim the merged tree passes performance from earlier measurements.

## Next actions and open gates

Follow live #348 direction: #373 has landed, and the feature hold is lifted.
PR #380 still follows #354 and #374 because of the shared ExploreScene call.
Other renderer/feature ownership remains authoritative; do not assume it expired.
A read-only bird feasibility note is retained at
`/workspace/avatarrpg-env/368-bird-followup-handoff.md`: a future fourth category
needs scale review and a coordinated Pixi flock-sampling hunk before backend
edits. No bird implementation, new asset request or ownership transfer occurred.

Full category coverage, owner review of uninterrupted motion/aesthetics, sustained
Canvas60fps, pinned WebKit, physical Surface/iPad and Safari/PWA remain open.
Publish corrections on this same draft only after exact-head ci:local 9/9, verify
remote full-tree identity and inspect actual latest-head jobs including skips.
No manual CI fan-out, readiness or merge is requested by this partial draft.
