# Liquid ground material correction

- **Updated:** 20 September 2026, later scheduled DeepSeek Flash continuation run.
  This session verified the rebased head, opened the landing PR and handed the
  branch to the next scheduled session for the same goal.
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
  branch `codex/route-visual-pass`, rebased onto `origin/main` at the v0.2.2
  merge `5403473` (PR #64). The rebase was clean: `git merge-tree --write-tree
origin/main origin/codex/route-visual-pass` reported no conflict, so the
  gallery spec layout that changed under this branch (`gallery.spec.ts` into
  `suite.ts` plus three slice files) needs no manual resolution. The landing PR
  into `main` was opened from this head by the run above; nothing here is pushed
  to `codex/quarry-gate-integration`.
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
- **Verification:** re-confirmed on the rebased product head `bcf3fc1`; the
  commit that carries this handoff changes only this file and the changelog
  heading. `npm run verify` passes typecheck, lint,
  formatting and 876 tests in 106 files (873 from merged `main` plus three new
  painter tests); `node scripts/check-bundle-size.mjs` reports total JavaScript
  299.8 KB gzipped of the unchanged 300 KB budget (this change adds ~0.2 KB),
  with the PWA output present and the art/asset budgets untouched. The
  pre-rebase head `418fd3d` reported the same figures, and the rebase changed
  only this branch's base, not its product diffs.
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
- **Live release state:** v0.2.2 shipped. PR #64 merged as `5403473` on 20
  September 2026, its Pages deployment succeeded and the live game shows
  `v0.2.2 · build 5403473`. The gallery blocker recorded at the last handoff
  was real and is repaired: the capture is now seven parallel shards behind the
  same required `Screenshot gallery` aggregate, which assembled 395 pictures
  across five projects, and that first sharded run exposed two inspector beats
  (`38-crossbow-portrait`, `36-grumbler-portrait`) that projected a tile
  without the camera owning the actor, so the right-click missed and the case
  burned its whole 720-second budget. Both now focus the unit first, as the
  bandit portrait beat has since `b0fbc8b`. The detail is in
  `pr64-gallery-budget.md` in `main`'s history.
- **Next actions:**
  1. Done: PR #64 merged as `5403473`, deployed, live version confirmed, and
     this branch rebased onto it.
  2. Done on the rebased head: `npm run verify` passes typecheck, lint,
     formatting and 876 tests in 106 files; `node scripts/check-bundle-size.mjs`
     reports 299.8 KB gzipped of the 300 KB budget.
  3. Done by this run: local verification on `bcf3fc1`, then a PR into `main`
     with a merge commit and auto-merge enabled. The visible version is already
     bumped to `0.2.3` and the changelog records it, so no further release edit
     is needed before checks.
  4. Re-run the review harness on the deployed build (`FNT_ROUTE_REVIEW_DIR`
     keeps captures per head) and compare it with the three approved
     references. The comparison made here says the remaining water gap is art,
     not painter code: the references show a shallow bed with submerged stones
     and plants under an irregular bank, and our pond bed plate is a uniform
     teal field. An image-generation session should re-author the pond and canal
     beds and banks; the quarry floor's pale stain needs the same pass. Audio
     and physical-device checks also remain open.
     The [20 September route review](route-visual-review-2026-09-20.md) puts
     that pass in a wider order: the junction edges and water outline first,
     then the bed/bank art, then prop contact shadows.
  5. Keep the JS budget in mind: 299.8 KB of 300 means the next product change
     needs an offsetting trim.
- **Completion/transfer:** not merged at handoff; exact-head CI and the Pages
  deployment for `0.2.3` are the next session's first check. The outgoing owner
  has relinquished editing ownership of the files above beyond this commit.
  Nothing else is claiming `src/render/painters/tiles.ts`, `palettes.ts` or the
  review harness, and the JS budget has 0.2 KB of headroom, so the next product
  change needs an offsetting trim before this branch can absorb it.
