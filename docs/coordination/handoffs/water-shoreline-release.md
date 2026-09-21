# v0.2.7 — water on its bed, reeds on its bank

- **Updated:** 20 September 2026, sixth scheduled DeepSeek Flash continuation
  run. Incoming owner: the next scheduled session for the same goal.
- **Outcome:** this branch is the v0.2.7 release candidate. It makes standing
  water show what it sits on and plants the forest pond's bank, then carries the
  release bump and changelog on top. No rule, collision, save, preview, camera,
  UI or painter contract changed; the work is plates, placements, the ground
  painter's water treatment and the changelog.
- **Location:** worktree `C:/Users/Jared/.codex/worktrees/water-shoreline`,
  branch `codex/water-shoreline`, based on the v0.2.6 merge
  `87c97b3` (PR #68). Above that base, in order: the pond shore bite, the pond
  bed, the Ba Dan canal bed and kerb, the pond bank reeds, the route review and
  the `release: v0.2.7` bump. The earlier handoffs
  (`pond-shore-bite.md`, `pond-bed.md`, `canal-bed-bank.md`, `pond-reeds.md`)
  describe each art step; `route-visual-review-water.md` reviews the route
  against the three approved references.
- **Evidence on this head.** `npm run verify` passed typecheck, lint, the
  formatting gate and 904 tests in 111 files. `npm run art:validate` reports
  every sheet, image and map painting checks out. `npm run check:assets` reports
  a 17.32 MB precache against a 25 MB budget. The route harness
  (`FNT_REVIEW_BROWSER_CHANNEL=chrome`,
  `FNT_ROUTE_REVIEW_DIR=.shots/water/v027f`,
  `npx playwright test -c playwright.route-visual.config.ts`) passed 2/2 in 34 s
  on installed Chrome, Canvas and WebGL, 1368x912, seeded fixtures entered with
  `enterNode`. These captures are the first on this branch taken with PR #68's
  feathered prop contact merged, so the pond, canal, reeds and props can be read
  together in `.shots/water/v027f/{canvas,webgl}/`.
- **Not evidence.** No playthrough, no listening test, no physical
  Surface/iPad check, no Large-text or touch pass. The captures are review
  fixtures on a desktop browser at one viewport.
- **Open gaps carried forward:** density and framing against the Ba Dan
  reference (a large flat mid-ground and the board's polygon edge showing
  against bare paper); field dressing for large flat fields, including the
  quarry floor's flat stain and the village's mid-ground field, which want
  generated art this environment does not have; movement, animation, sound and
  contact across the roster and the Driller; meaningful legal environmental
  tactics; story and portrait quality; touch and Large text; both custody
  outcomes with save reload. `route-visual-review-water.md` ranks the four
  largest visual gaps.
- **Next action:** deliver this PR through its exact-head required checks and a
  merge commit, confirm the Pages deployment and a fresh visible version check,
  then start the next product change from fetched `main` in a new isolated
  worktree. If a check fails, repair it on this branch rather than opening a
  second PR for the same change.
