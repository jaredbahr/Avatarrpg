# Village ambience #368: partial draft handoff

- **Updated:** 2026-10-31 UTC; bounded implementation owner `ambience_scope`;
  integration and verification owner is the parent orchestrator.
- **Outcome:** Four discrete ambience additions: slow canal glints, floating
  canal leaves, market-vessel steam and evening/night lantern flicker. This
  covers three suggested categories and does not close #368. Birds, cloth,
  animals and complete visual acceptance remain open.
- **Location:** `/workspace/avatarrpg-368`, branch
  `codex/village-ambience-368`, based on `bc77ae2eceb6740dd4c143cae61595a1f4884bc2`.
  Implementation commit is the commit containing this handoff; no PR yet.
  Claim: <https://github.com/jaredbahr/Avatarrpg/issues/368#issuecomment-6536742481>.
- **Worktree state:** Source checkpoint committed locally; no push, generated
  assets, binary changes or preview process created by this owner. Parent
  supplies the shared `node_modules` link and owns all executable checks.
- **Completed:** Optional recipe fields in `src/content/fx.ts`, authored-source
  schema/types and Ba Dan anchors, local deterministic placement in
  `src/app/anim/ambience.ts`, one coordinated call-site argument in ExploreScene,
  dedicated `src/app/anim/baDanAmbience.test.ts`, and ADR 0101.
- **Decisions:** Existing emitters draw all four effects on both backends.
  New particle centres snap through the oblique world-pixel projection, with
  fixed 2/4/6-pixel existing cells. No shared simulator/backend change. Reduce
  motion omits water movement and freezes steam/lantern marks. See
  [ADR 0101](../../adr/0101-authored-village-ambience.md).
- **Anchor evidence:** Existing upright pages inspected, RGBA values read
  locally for calibration. Vessel: page 1 `(550,773)`, projected world
  `(659,384)`. Lantern glass: page 0 `(1536,391)`, `(1573,391)`, `(1536,498)`,
  projected world `(1476,768)`, `(1924,800)`, `(1732,896)`. Dedicated tests
  verify registration, painted alpha and amber glass colour. Visual integration
  is still pending.
- **Verification:** Formatter and whitespace diff check only. No typecheck,
  lint, unit tests, build, budgets, browser checks or `ci:local` run by this
  owner. The new tests cover deterministic output, phase gating, frozen samples,
  actual sampled particle centres/sizes, complete water footprints and aggregate
  population below the existing Canvas cap. Their pass status is unknown.
- **Coordination:** Existing `baDan.test.ts`, both backend files, generated
  `baDan.art.ts`, plates, uprights and other worker files untouched. Parent
  coordinated the single ExploreScene call hunk with PR354/374 owners. ADR 0101
  is unused in this checkout; parent must confirm against live unpublished work.
- **Next actions:** Parent independently reviews source and executes focused
  checks. Capture zoom-1 motion and Reduce motion on Canvas and WebGL, including
  waiting into evening/night; inspect vessel source, glass containment, water
  confinement, footprint/grid appearance and motion at runtime. Run
  `e2e/renderer.spec.ts` and `npm run ci:local` before any push. Publish only a
  draft under the user's current instruction; retain all issue acceptance gates.
- **Completion/transfer:** Source checkpoint only, not merged or ready for final
  acceptance. Parent owns verification/publication; this owner is available for
  bounded fixes after review.
