# Driller quarry interior checkpoint

- **Updated:** 2026-09-19; outgoing owner `combat_preview`; integration owner is
  the root gameplay task. This is a local handoff with no push or PR.
- **Outcome:** The Driller floor now has two permanent one-cell masonry stacks at
  `(8,4)` and `(11,7)`, reusing the gate's isolated `wall-end.webp` art, plus
  live `rubble_pile` at `(6,7)` and `(13,4)`, `water_barrel` at `(12,6)` and
  `brazier` at `(10,3)`. Pella's conditional `(9,6)` cabbage cart is retained.
  The six authored party spawns and all enemy placements are unchanged. The
  approved shallow rear loading strip is registered as exterior scenery behind
  x14..19/y=-1.
- **Acceptance:** Map and scene tests assert the exact wall cells, projection
  rectangles, footprints, depth and renderer scene registration. The quarry
  tests exercise six-party spawning, size-2 boss routing around both stacks,
  line-of-sight through static and dynamic cover, rubble removal, barrel water,
  brazier shove onto oil and fire, conditional cart instantiation, and save
  round-trip preservation of props and the baked grid. Scene tests also assert
  the rear loading strip's exterior footprint, fixed depth and exact image
  rectangle.
- **Location:** `C:/Users/Jared/.codex/worktrees/quarry-interior`, branch
  `codex/quarry-interior`, based on `c8f8b06fc8c2c1a45a345b7370d91fae61e00444`.
  The interior implementation is `d266abb8d99892523f71387b450253b9617a85ce`;
  the art dependency is `b4285db`. The registration follow-up is the final
  local commit on this branch. No PR or remote push was made.
- **Completed:** `src/content/maps/combat.ts` adds the permanent wall rows,
  live props and compact shared authored data. `src/content/scenes/quarryProjected.ts`
  registers the two reused masonry sprites and the exterior rear-loading strip.
  `src/content/maps/quarryFloor.test.ts` and
  `src/content/scenes/quarryProjected.test.ts` hold focused geometry, rules and
  save coverage. `docs/art/prompts/maps/quarry_floor.md` and its 32 px layout
  were regenerated from the authoritative map rows.
- **Decisions:** The isolated stacks use `wall-end.webp` in both positions, as
  the existing gate variant resolver assigns `end` to a wall with no orthogonal
  neighbor. No core rules, combat stats, XP, save schema, renderer or camera
  code changed. The rear-loading asset is commit `505941c` from the art owner,
  cherry-picked here as `b4285db`; registration uses
  `x:1652, y:382, width:370, height:249`, an exterior footprint on
  x14..19/y=-1, fixed rear depth `{x:16.5,y:-0.5}`, and no playable collision
  cells.
- **Verification:** `npm run verify` passed after registration (103 test files,
  849 tests, plus typecheck, lint and format). `npm run build` passed. The
  bundle check reports 299.9 KB gzipped JavaScript against the 300 KB budget.
  `npm run art:validate` and `npm run check:assets` pass; maps are 4,058,450
  bytes (3.87 MiB of 4 MiB), units are 4.61 MiB of 4.75 MiB, and precache is
  17.47 MiB of 25 MiB. `BALANCE_VARIANTS=1 npm run balance` reports the seeded
  AI table at 100.0%/97.5%/87.5% for the base Grumbler roster and
  100.0%/100.0%/100.0% for `jins_people`, for one/three/six players. No
  balance values were changed.
- **Runtime evidence:** A throwaway Playwright probe used the installed Chrome
  executable with SwiftShader against the local Vite server on port 4287. It
  exercised the real app on Canvas and WebGL at tile sizes 64 and 96, with a
  six-party seeded `battle_grumbler` encounter. Every capture reported the
  expected two static blocked/sight-blocking wall cells, four live props, no
  page errors, and a stable oblique camera. Actual reducer actions removed the
  brazier and one rubble pile while the walls remained, and accepted Riko's
  move from `(12,4)` to `(12,5)`. The paired Sura/Riko probe used real
  `water_whip`: Grumbler HP changed 64 to 61 and the log recorded `Wet` on both
  renderers. A seeded `jins_people` smoke loaded the mercenary crossbow roster
  on both renderers. These are automated seeded encounter probes, not a claim
  of a complete village-to-quarry campaign route or physical-device acceptance;
  root's campaign playthrough remains the route evidence.
- **Capture paths:** Durable artifacts are under
  `C:/Users/Jared/.codex/visualizations/2026/09/19/01a0b79f-a1e6-7fd0-a4d5-76e7944406f6/quarry-interior`.
  The unshaded rear Canvas/WebGL review frames after dismissing the hot-seat
  card are `canvas-64-rear-ready.png` and `webgl-64-rear-ready.png`; both are
  1280x720 at tilePx 64 and show the closed rail stub behind the stepped rear
  rim, with walls and props still visible. The folder also contains the 64/96
  initial, ready, rear and removal frames plus JSON state traces for both
  backends, the Sura/Riko probe and the `jins_people` smoke.
- **Coordination:** Ownership remains limited to the map, projected scene
  registration and focused tests. Camera, renderer and core rules remain owned
  by their existing tasks. The rear strip is decorative exterior scenery only;
  its logical footprint does not add walkable or collidable cells. The combined
  release owner should cherry-pick this branch's final local commit and retain
  the art source/provenance from `b4285db`.
- **Completion/transfer:** This checkpoint is complete and editing ownership is
  relinquished after the commit; combined release checks and versioning remain
  with the integration owner.
