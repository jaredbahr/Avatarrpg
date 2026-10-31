# Village ambience #368: partial draft handoff

Updated 2026-10-30 (America/Chicago). Root is integration/verification owner;
bounded SOL High workers implemented, reviewed source and prepared browser proof.
Claim: <https://github.com/jaredbahr/Avatarrpg/issues/368#issuecomment-6536742481>.

## Outcome and ownership

Four discrete additions use existing pixel primitives: slow canal glints,
floating canal leaves, market-vessel steam and evening/night lantern flicker.
Reduce motion omits new water movement and freezes steam/lantern samples.
This covers three suggested categories and **does not close #368**. Birds,
cloth, animals, additional chimney calibration and full acceptance remain open.

Worktree `/workspace/avatarrpg-368`, branch `codex/village-ambience-368`, base
`bc77ae2eceb6740dd4c143cae61595a1f4884bc2`. Implementation checkpoints are
`c2f90b21` and `f8ef42c7`; current native-proof source is `8f7dd4ab`.
Consult the PR/claim for the final publication SHA and actual CI results.

Only the existing ambience system, optional scene anchors/types/schema, recipes,
and one coordinated ExploreScene call changed. PR354/374 received scope notices.
Existing backend files, overlays, texture caches, resident/trail logic,
`baDan.test.ts`, generated art, public assets and #370 sources are untouched.
No paid request, generation, merge, deployment or release-version bump occurred.
ADR0101 records the presentation contract.

## Source and runtime evidence

Independent source review found an integer-grid schema applied to fractional
presentation anchors. `f8ef42c7` adds a finite fractional/negative world-point
schema while retaining logical grid restrictions, with direct regression cases.
No remaining source blocker was found in the sampler, world-pixel transforms,
actual 2/4/6-pixel rungs, water corridor, phase/frozen paths or state boundaries.

- Initial five-file focus: 60/60 passed. Corrected dedicated cases: 9/9 passed;
  existing content validation: 48/48 passed.
- Unchanged `e2e/renderer.spec.ts`: 12/12 passed in 7.5 minutes against production
  `07fe7d0e`. Application and public inputs match the later native-proof build.
- Dedicated `playwright.village-ambience.config.ts`: 10/10 phases passed in
  6.1 minutes at `8f7dd4ab`, one worker, zero retries, both backends, zoom 1/DPR1.
  Real Wait UI proves day/night gating; repeated samples prove frozen new inputs.
  Both final provenance summaries are complete with no runtime errors.
- Native source `src` tree: `4da9a8ac06cb060dff8433f074637dbb96d7740f`;
  unchanged `public` tree: `8e267fed53781d8d53546b888f0d48572b19682f`.
- [Evidence and sampled clips](../evidence/368/README.md) retain the source
  identity, bounded visual findings and all earlier failed harness results.
  Changing inputs do not alone prove visible pixels; sustained 60fps and owner
  aesthetics are not established. Clips are sparse samples, not continuous play.

## Publication and remaining gates

Before publication, root must run `npm run ci:local` on the final clean commit
and require all nine stages. The exact before/after SHA/tree/status and actual
exit belong in `/workspace/avatarrpg-env/368-ci-final.receipt.json`; the PR and
same issue claim record its actual result. No further tracked edits may be
represented as covered by that receipt. Verify the remote tree/head and actual
hosted jobs, including browser/gallery skips, after publication.

Publish only a draft under Jared's current instruction. If connected publication
recreates commit metadata, preserve individual concerns, verify the complete
tree identity, and distinguish the tested local SHA from the published SHA.
Do not present skipped PR matrices as executed suites. #370 remains the CI
integration owner's assignment and its source PRs stay preserved.

Open gates include full issue category coverage, uninterrupted motion review,
WebKit (the pinned binary is absent locally), physical iPad/Surface and Safari/PWA
checks, sustained Canvas 60fps and owner visual acceptance. The existing public
PR verification workflow may run normally; no manual fan-out or auto-merge is
requested. Keep corrections on this one PR and update this ownership record.
