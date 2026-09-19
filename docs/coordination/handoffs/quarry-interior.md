# Driller quarry interior checkpoint

- **Updated:** 2026-09-19; outgoing owner `combat_preview`; integration owner is
  the root gameplay task. This is a local handoff with no push or PR.
- **Outcome:** The Driller floor now has two permanent one-cell masonry stacks at
  `(8,4)` and `(11,7)`, reusing the gate's isolated `wall-end.webp` art, plus
  live `rubble_pile` at `(6,7)` and `(13,4)`, `water_barrel` at `(12,6)` and
  `brazier` at `(10,3)`. Pella's conditional `(9,6)` cabbage cart is retained.
  The six authored party spawns and all enemy placements are unchanged.
- **Acceptance:** Map and scene tests assert the exact wall cells, projection
  rectangles, footprints, depth and renderer scene registration. The quarry
  tests exercise six-party spawning, size-2 boss routing around both stacks,
  line-of-sight through static and dynamic cover, rubble removal, barrel water,
  brazier shove onto oil and fire, conditional cart instantiation, and save
  round-trip preservation of props and the baked grid. The rear loading strip
  is reserved at logical x14..19, y=-1, outside the playable board; its art and
  final registration remain with the separate art handoff.
- **Location:** `C:/Users/Jared/.codex/worktrees/quarry-interior`, branch
  `codex/quarry-interior`, based on `c8f8b06fc8c2c1a45a345b7370d91fae61e00444`.
  Final commit is recorded below. No PR or remote push was made.
- **Completed:** `src/content/maps/combat.ts` adds the permanent wall rows,
  live props and compact shared authored data. `src/content/scenes/quarryProjected.ts`
  registers the two reused masonry sprites and exports the rear-strip anchor
  contract. `src/content/maps/quarryFloor.test.ts` and
  `src/content/scenes/quarryProjected.test.ts` hold focused geometry, rules and
  save coverage. `docs/art/prompts/maps/quarry_floor.md` and its 32 px layout
  were regenerated from the authoritative map rows.
- **Decisions:** The isolated stacks use `wall-end.webp` in both positions, as
  the existing gate variant resolver assigns `end` to a wall with no orthogonal
  neighbor. No core rules, combat stats, XP, save schema, renderer or camera
  code changed. The separate rear-loading asset is commit `505941c` from the
  art owner; the reviewed starting registration is approximately
  `x:1652, y:382, width:370, height:249`, with an exterior footprint on
  x14..19/y=-1, fixed rear depth around `{x:16.5,y:-0.5}`, and no playable
  collision cells. It is intentionally not copied into this branch.
- **Verification:** `npm run verify` passed on the final source (103 test files,
  849 tests, plus typecheck, lint and format). `npm run build` passed. The
  bundle check reports 299.8 KB gzipped JavaScript against the 300 KB budget.
  `npm run art:validate` and `npm run check:assets` pass; maps are 3.83 MiB of
  4 MiB and precache is 17.43 MiB of 25 MiB. `npm run balance` completed with
  Grumbler win rates of 100.0%/97.5%/87.5% for one/three/six-player AI tables;
  no balance values were changed. No browser or physical-device visual check
  was run in this isolated map-only slice.
- **Coordination:** Ownership is limited to the map, projected scene
  registration hook and focused tests. Root should integrate this commit with
  art commit `505941c`, then add the rail scenery entry after checking its
  Canvas/WebGL depth and occlusion. Camera, renderer, core rules and art source
  remain owned by their existing tasks.
- **Next actions:** Cherry-pick this commit, cherry-pick `505941c`, register
  the approved rear strip using the contract above, and perform the combined
  visual route check. Keep the generated art prompt/layout synchronized if
  future map rows change.
- **Completion/transfer:** This checkpoint is complete and editing ownership is
  relinquished after the commit; combined release checks and versioning remain
  with the integration owner.
