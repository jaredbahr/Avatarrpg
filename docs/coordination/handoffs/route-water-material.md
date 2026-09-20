# Liquid ground material correction

- **Updated:** 20 September 2026, root (scheduled DeepSeek Flash continuation).
  Incoming owner: next scheduled session for the same goal.
- **Outcome:** water and oil now read as painted ground materials instead of
  flat clipped tiles. Canvas 2D water gains the ripple/mottle/soft-shore
  treatment WebGL already had and loses the bright rim that made a pond look
  like a filled polygon; oil gains a slate-green film whose sheen is visible on
  both backends. Explicitly excluded: any rule, save, map, collision, preview,
  budget, camera or UI change, and any authored art.
- **Acceptance:** focused painter test passes; focused browser water specs
  behave as they do at the untouched base; required exact-head CI green; the
  route review harness captures village, forest, quarry, Driller and return on
  Canvas and WebGL at 64/96px for comparison with the approved references.
- **Location:** worktree `C:/Users/Jared/.codex/worktrees/route-visual-pass`,
  branch `codex/route-visual-pass` pushed to `origin` at head `418fd3d`, based
  on the v0.2.2
  release head `966d33a` (`codex/quarry-gate-integration`, PR #64). PR: none yet
  — opening one now would either duplicate the release diff or land work while
  #64's gallery is still running, so the branch waits for that merge.
- **Worktree state:** clean; no local-only assets; `.shots/route-final/`,
  `.shots/route-v023/` and `.shots/route-v7-portrait/` are ignored capture
  evidence, preview servers stopped.
- **Completed:** version `0.2.3` with its changelog entry;
  `src/render/painters/tiles.ts` (two-coat water film, shore inset, one wide
  drift patch built from five steps, one flow line, water rim removed),
  `src/render/palettes.ts` (oil fill/alpha/edge/detail), new
  `src/render/painters/tiles.test.ts`, new review harness
  `e2e/route-visual.review.ts` + `playwright.route-visual.config.ts`, and
  `docs/art/liquid-material-treatment.md`.
- **Decisions:** keep the rules tile authoritative and paint the material
  inside it; treat the Canvas path as a first-class player surface rather than
  accepting lower fidelity than WebGL (ADR 0039 modular illustrated world,
  `docs/player-view-target.md`). Oil keeps the universal surface outline
  because it marks real hazard cells; water follows the painted-shore treatment
  WebGL already used.
- **Verification:** at head `418fd3d`, `npm run verify` passes typecheck, lint,
  formatting and 876 tests in 106 files (three new painter tests); production
  build passes with total JavaScript 299.8 KB gzipped of the unchanged 300 KB
  budget (this change adds ~0.2 KB) and the art/asset budgets untouched.
  `e2e/route-visual.review.ts` passed 2/2 (Canvas + WebGL) on the production dev
  server in installed Chrome at 1368x912 and again at 834x1194 with Huge text;
  captures and provenance are in `.shots/route-final/`, `.shots/route-v023/`
  and `.shots/route-v7-portrait/`. Focused
  `renderer.spec.ts`, `partial-ground.spec.ts`, `painted-rubble.spec.ts`,
  `reactions.spec.ts` and `combat-preview.spec.ts` pass their water assertions;
  the same focused run fails the canvas patch-restore tolerance (13 vs 12) and
  a WebGL elevation green-shift case **at untouched base `966d33a` as well**,
  so those two are recorded as local-environment flakes, not regressions.
  Required Linux exact-head CI has not run for this branch.
- **Coordination:** PR #64 still owns the v0.2.2 release branch; this branch
  must not be pushed to `codex/quarry-gate-integration` and no competing PR into
  `main` may be opened while #64 is open. Files touched are otherwise upstream
  of nothing in the release batch. No other owner holds these files.
- **Next actions:**
  1. Confirm PR #64 merged (`gh pr view 64 --json state,mergedAt,mergeCommit`).
  2. `git fetch origin`, then rebase `codex/route-visual-pass` onto the new
     `origin/main` and re-run `npm run verify` plus
     `node scripts/check-bundle-size.mjs`.
  3. Push the rebased branch and open a PR into `main` with a merge commit, then
     enable auto-merge. The visible version is already bumped to `0.2.3`, so no
     further release edit is needed before the checks run.
  4. Re-run the review harness on the deployed build (`FNT_ROUTE_REVIEW_DIR`
     keeps captures per head) and compare it with the three approved
     references. The comparison made here says the remaining water gap is art,
     not painter code: the references show a shallow bed with submerged stones
     and plants under an irregular bank, and our pond bed plate is a uniform
     teal field. An image-generation session should re-author the pond and canal
     beds and banks; the quarry floor's pale stain needs the same pass. Audio
     and physical-device checks also remain open.
  5. Keep the JS budget in mind: 299.8 KB of 300 means the next product change
     needs an offsetting trim.
- **Completion/transfer:** not merged; the outgoing owner has relinquished
  editing ownership of the files above beyond this commit.
