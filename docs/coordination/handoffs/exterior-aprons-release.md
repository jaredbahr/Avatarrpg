# Handoff — v0.2.8 exterior aprons (three scenes, one release)

Owner: DeepSeek Flash scheduled continuation, 20 September 2026, eleventh run.
Branch `codex/exterior-aprons`, worktree
`C:/Users/Jared/.codex/worktrees/exterior-aprons`, based on `main` `89a65df`
(v0.2.6 + the tea-settle fix) and rebased onto the v0.2.7 merge before its PR
opens.

## Why three branches became one release

`codex/frame-surround-coverage` (quarry gate), `codex/village-outer-apron`
(Ba Dan) and `codex/forest-road-apron` (forest road) were three separate
checkpointed branches, each waiting its own release number (0.2.8, 0.2.9,
0.2.10 by land order). They are one change: every `partial`-ground scene carries
its own material past the rim instead of ending on the board's diagonal. They
share one schema hunk and touch three different scenes, and none had a PR yet.

Shipping them as three releases would have spent three full exact-head CI runs
(three typecheck/E2E runs and three seven-shard galleries, roughly 40 jobs) on
one technique, where one release spends about 14. Under the standing Actions
cost rule the batch is the smaller, more reviewable change: three preserved
source commits plus a release commit, and Jared can judge the whole route's
new edge continuity in a single play session rather than three.

No competing PR existed and nothing was superseded: the three source branches
remain pushed as provenance and their handoffs stay as written, each with a
pointer here.

## What is in this release

- `art: carry the village ground outside the Ba Dan rim` — the Ba Dan apron
  (`scripts/art/ba-dan-exterior-apron.ts`,
  `public/art/maps/ba-dan-scene/exterior-apron.webp`), painted last in
  `BA_DAN_SCENE.ground`.
- `content: dress the quarry gate with the shared exterior surround` — the gate
  scene paints the reviewed `QUARRY_SURROUND` plates it shares with The Cutting
  and the Driller floor.
- `art: carry the forest road's own ground outside its rim` — the forest apron
  (`scripts/art/forest-exterior-apron.ts`,
  `public/art/maps/forest-scene/exterior-apron.webp`), which mirrors the route's
  own authored pixels outward rather than inventing colour.
- `src/content/schemas.ts` raises the `scene.ground` bound 8 → 12 once, with a
  comment covering all three scenes.
- Release commit: version 0.2.8 in `package.json` and the lockfile, the
  changelog entry, and the fix to
  `playwright.ba-dan-apron.config.ts`, whose `testMatch` named
  `apron-probe.review.ts` instead of the committed
  `e2e/ba-dan-apron.review.ts`, so the documented re-capture found no tests.

## Evidence

- `npm run verify` on the release head (typecheck, lint, format, full vitest).
- Per-scene art tests, unchanged by the batch: byte-identical repack, no alpha
  inside the board or past the fade, closed rim seam, material continuation.
- Review frames per scene, both backends (see each source handoff for its views
  and the `.shots/` paths it re-captures into).

## Open gaps (not closed by this release)

- Frames are review fixtures at one viewport, not a playthrough; the forest
  road's combat framing with the apron in place still needs its own walk.
- Nothing here was checked on a physical device, at Large text, or by listening.

## Next action

Open the release PR into `main`, arm merge-commit auto-merge, confirm the
exact-head required checks, merge, confirm Pages serves 0.2.8, then walk the
forest road's combat framing and the quarry-side transition in the deployed
build.
