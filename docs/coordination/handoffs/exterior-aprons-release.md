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

- `npm run verify` on the batch head `935a119`: typecheck, lint, format and the
  full vitest run, **903 tests in 111 files** (899 before this batch).
- Per-scene art tests, unchanged by the batch: byte-identical repack, no alpha
  inside the board or past the fade, closed rim seam, material continuation.
- Frames on this head, installed Chrome at 1368x912, Canvas and WebGL:
  - `.shots/forest-apron/{canvas,webgl}` — `fit.png`, six rim/exit views, plus
    the new `combat-fit.png` and `combat-rim-{0-4,9-0}.png` from
    `FNT_REVIEW_BROWSER_CHANNEL=chrome npx playwright test -c
playwright.forest-apron.config.ts` (4 passed).
  - `.shots/rim-probe/{canvas,webgl}` — the village rim probe, now actually
    running: `npx playwright test -c playwright.ba-dan-apron.config.ts`
    (2 passed) after the `testMatch` repair.
  - `.shots/route-review/{canvas,webgl}` — the whole-route framing,
    `battle_quarry_gate-fit.png` shows the gatehouse terrace continuing on both
    backends (2 passed).
  - Read against the references, the three hard diagonals are gone; the ground
    leaves each board as its own material and dissolves.

## Open gaps (not closed by this release)

- Frames are review fixtures at one viewport, not a playthrough; the forest
  road's combat framing is now captured but not walked with real input, and the
  quarry-side transition and the return still need reviewing in the deployed
  build.
- Nothing here was checked on a physical device, at Large text, or by listening.

## Reference comparison taken from this head's frames

The rim work is the change under review, but the same frames make one
independent gap concrete. `assets/reference/player-view-2026-09-17/ba-dan-exploration.png`
is a village that is almost entirely built surface: paving, low stone walls with
planting behind them, market tables under fabric awnings, hanging banners and
lanterns, a pond with ducks and lily pads, a stone bridge, and figures filling
every court. This build's `village_explore-fit.png` at the player's own camera
shows the same court as a plaza path across a large flat green field with one
market table. Two causes, both real:

- the default follow camera shows roughly a quarter of the reference's field of
  view, so the reference's density comes partly from showing most of the village
  at once; and
- the western half of Ba Dan genuinely has few props and no water, where the
  reference has its pond, bridge and garden walls.

Density and framing are listed as open acceptance gaps; this narrows them to the
village's western field and the market court. That is a separate change from the
aprons and is not attempted here.

## Next action

Open the release PR into `main`, arm merge-commit auto-merge, confirm the
exact-head required checks, merge, confirm Pages serves 0.2.8, then walk the
forest road's combat framing and the quarry-side transition in the deployed
build.
