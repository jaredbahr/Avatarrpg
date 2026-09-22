# Handoff — the quarry floor's spilled ground, painted from the same material

Owner: DeepSeek Flash interim run, 2026-09-21. Branch `codex/quarry-ledge-stone`,
worktree `C:/Users/Jared/.codex/worktrees/quarry-ledge-stone`, based on the
release head `5a2ee58` (PR #74, v0.2.10) because this closes a ground gap that
release opened and the branch must merge after it.

This is `docs/coordination/handoffs/surface-banks.md`'s recorded follow-up: the
ground generator left every **dynamic** cell transparent, so the quarry floor's
four oil pools and one mud patch were the only cells still painted flat — a
slick of procedural slate standing beside illustrated stone (the "flat slate
plates"), with the tile square for an outline.

## What changed

1. `scripts/art/quarry-route-ground.ts` maps a cell to the ground its material
   stands on: `o` now packs into the **stone** page and `m` into **dirt**,
   exactly as `r` (rubble on stone) already did. Water (`~`) alone keeps its
   transparent hole, because its bed is authored with the liquid. Neighbouring
   dirt joins an oil pool through the existing painted dirt↔stone transition.
2. Repacked the Driller floor from the recorded source
   (`exec-8dcfcdb5-…png`, SHA-256 `d15b808a…`) with
   `node --import tsx scripts/art/quarry-route-ground.ts driller <source>`:
   `stone.webp` 39,100 → 50,252 B, `dirt-east.webp` 28,026 → 33,068 B,
   `dirt-west.webp` 31,990 → 33,922 B (the west page gains the transition band
   along the pools it borders). `src/content/scenes/quarryRouteGround.ts` is
   the packer's registration and matches the three files byte-for-byte.
3. The Cutting was **not** repacked and is untouched: it has no oil or mud cell,
   so its four regions and the shipped east page keep their bytes.
4. `src/content/scenes/quarryProjected.test.ts` states the new contract: water
   interiors stay transparent, oil and mud centres are opaque, every boundary
   between dry cells and a spill is opaque, and every `o`/`m` cell resolves to
   an opaque centre on the stone/dirt page. Six tests pass.
5. `docs/art/cutting-driller-ground-registration.md` describes the rule.

## Evidence on this head

- **Frames, same fixture, both backends**
  (`FNT_REVIEW_BROWSER_CHANNEL=chrome npx playwright test -c
playwright.route-visual.config.ts`, 1368×912, canvas and WebGL, the whole route
  at 64 and 96 px tiles). Against the same fixture captured from `5a2ee58`:
  the quarry floor moves **4.572%** of pixels (canvas `battle_grumbler-fit`),
  **5.128%** (`-64`), **4.912%** (WebGL `-fit`) and **4.665%** (WebGL `-64`),
  and the moved pixels are overwhelmingly **lighter** (52,916 up / 4,119 down
  on canvas `-fit`) — flat slate replaced by the illustrated stone the rest of
  the board already uses.
- **Nothing else moved.** The same capture moves 0.000% of
  `battle_forest_road-fit` (canvas), 0.003–0.021% elsewhere, all of it
  animation-timing noise below the 6-level threshold: the village, road, gate
  and cutting frames are unchanged.
- **Tradeoff recorded honestly.** The oil wash is a translucent coat over the
  ground, so over light illustrated stone it reads as a damp grey apron rather
  than the previous near-black quad. The hazard cell is still outlined and
  still a different material from the surrounding dirt, but if a _darker_ slick
  is wanted that is a liquid-material decision belonging with the reviewed
  v0.2.3 surface treatment, not a ground-registration one. Crop pairs:
  `.shots/oil-before.png` / `oil-after.png` in this worktree.
- **Checks.** `npm run verify` green on the final tree, `npm run art:validate`
  and `npm run check:assets` green, bundle budget unchanged (no product code).

## Open, recorded honestly

- The quarry floor still has no working furniture (crane, rails, carts, dressed
  stone) and the raised `^`/`A` ledges are still reached by the procedural
  elevation base; neither is claimed fixed here. The ledges sit outside the
  combat camera's clamped frame, so a party-walk capture at play zoom is the
  honest way to review them.
- `scripts/art/soften-quarry-dirt-join.ts` is now documented as a historical
  rescue: it ramps the east page again on every run, drifting it from the
  packer's registration. Use the packer alone for future packs.
- Not claimed: no playthrough, no listening, no physical device, no Large-text
  check, no WebKit run, and no comparison against the approved reference beyond
  the frames above.

## Next action

Do **not** open this branch's PR while PR #74's exact-head CI is running. Once
#74 has merged, rebase `codex/quarry-ledge-stone` onto the merge commit, run
`npm run verify` on the rebased head, and open one PR (the packer rule, the
three repacked pages, the registration, the test and the two docs).

## CI cost

No push to `main`, no pull request, no workflow run, no dispatch, no re-run. The
branch push triggers nothing (`push` is limited to `main`). Local only: three
route-review captures (35 s each) and one `npm run verify`.
