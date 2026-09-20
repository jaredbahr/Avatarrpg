# Ba Dan market-court tree wings

- **Updated:** 2026-09-19. Art owner transfers to the root integration owner.
- **Outcome:** Two existing painted trees frame the northern merchant/Mira court.
  This is a bounded composition improvement, not added village life or whole-route
  presentation acceptance. No generated art, new textures, character changes,
  camera/UI changes or release-version bump.
- **Location:** `C:/Users/Jared/Documents/ChatGPT/Avatar RPG-ba-dan-tree-wings`,
  branch `codex/ba-dan-tree-wings`, base `82bcc78`, runtime commit `18c0dde`.
  The subsequent handoff commit changes documentation only. No push, PR or CI.
- **Implementation:** `BA_DAN_COURT_TREES` defines `(5,5)` and `(17,5)` once for
  scene placement and collision. Each uses the existing tree asset, width 320,
  one-cell trunk footprint, ground-depth sorting and `fadeWhenOccluding`.
  Both previously grassy cells become blocked tree cells. The Ba Dan prompt pack
  and layout image were regenerated; no other map outputs changed.
- **Size and budget:** Width 320 means 320 screen pixels at tile zoom 64 and 480
  at zoom 96. The earlier planning estimate of 160 at zoom 64 was incorrect.
  Existing scene asset bytes remain 1,172,736 across nine unique URLs. Two extra
  draw instances reuse the same decoded tree image. Build asset check passes:
  maps 3.84 MiB, total precache 17.20 MiB of 25 MiB. No budget change.
- **Verification:** `npm run verify` passes 809 tests in 90 files; focused Ba Dan
  reachability and generated-map-reference checks pass 22 tests. Production build
  and `npm run check:assets` pass. Existing large-chunk build warning remains.
  The budget command was first attempted before a build and correctly reported
  missing `dist`; after building it passed. No physical-device checks or new CI.
- **Actual runtime evidence:** The local review harness asserts the visible
  source build stamp and actual backend, with strict port 4241, no existing-server
  reuse, service workers blocked, Edge Chromium and a 1672 by 944 viewport.
  Before build `82bcc78`: `.shots/tree-wings-before/{canvas,webgl}/`.
  After build `18c0dde`: `.shots/tree-wings-after/{canvas,webgl}/`.
  These paths are relative to the worktree above. Each contains `source-build.png`,
  `provenance.json`, `court-64.png`, `court-96.png`, `east-garden-64.png`,
  `east-garden-96.png`, both door approaches, road approach and return captures.
  All eight recorded camera states match exactly between before and after on
  both backends; no browser errors. The seeded setup uses the established
  `newGame`/`enterNode` fixture. All subsequent movement uses ordinary map clicks,
  wheel zoom and the visible Follow party button, with motion enabled.
- **Walkthrough:** Both backends complete `(10,7)` to `(10,4)` to `(9,3)` to
  `(11,3)` to `(16,5)` and back to `(10,7)`. Door approaches remain usable and
  NPCs remain readable. Unit tests additionally preserve both exits, every NPC,
  tree-adjacent cells and the full two-row main road; trunk cells are inaccessible.
- **Visual findings:** Court captures show stronger framing with the existing
  buildings and garden. The eastern canopy partly covers the distant display
  and house; normal approach fades the whole tree and reveals the display,
  garden and party. That large faded trunk is existing behavior, not a new
  occlusion technique. Root reviewed Canvas court 64/96 and garden 96 and
  accepted this bounded tradeoff. Art reviewed matching WebGL court 64/96,
  garden 64 and north-door captures; the same composition/fade behavior holds.
- **Reproduce:** Set `FNT_TREE_REVIEW_DIR` to a fresh ignored evidence directory,
  then run `npx playwright test -c playwright.tree-wings.config.ts` from this
  worktree. Both cases pass (after: 43.4 seconds). Runtime source must remain
  unchanged during capture. `verify-tree-wings.local` and `build-tree-wings.local`
  retain local command output.
- **Transfer:** Work is committed locally and ready for root integration; no
  ownership overlaps with ExploreScene/guidance or combat choreography. Port 4241
  was automatically stopped after the review and has no listener. No further
  edits planned. This work does not address the remaining smaller mercenary
  variants recorded in the art backlog.
