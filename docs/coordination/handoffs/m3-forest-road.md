# M3: Forest Road footprint (rows, edge contract, exit mouth)

- **Updated:** 2026-09-28, this session (offline export workspace, no remote).
- **Outcome:** the Forest Road is reshaped inside its unchanged 20x12 grid to the
  approved demo-maps §1.3 footprint: a pine wall with three clearings on the
  north rim, a deep-water creek (`W`) with alders along the south, the road's two
  exits narrowed to the one road tile at each end, and the NE bank built into a
  real tier-1 slope with `A` at (19,2) as the tier-2 perch. The map now declares
  its borders and opts into `edgeContract: 'enforce'`. No prop was added or
  removed, and the walkable cell count is exactly the plan's 225 -> 190.
- **Acceptance:** `validateMapContracts` reports no error for `forest_road` with
  enforcement on (every walkable border cell is an exit or a declared edge, no
  two-tier step between walkable neighbours, one connected footprint); the
  encounter's authored, variant and reinforcement spawns are all walkable; the
  two exits trigger from the road tile at the rim only; the interactables the
  plan places are still on the board.
- **Location:** this export checkout, `master`, HEAD `c7220e3`. No branch, no PR
  and no CI run: the worker constraints for this task forbid pushes and `gh`, and
  the environment has no network and no `node_modules`.
- **Worktree state:** source changes only; no generated assets were written. See
  "Next actions" for the four ground plates that still need repacking.

## Completed

- `src/content/maps/combat.ts` - `FOREST_ROAD.rows` replaced with the approved
  §1.3 grid, plus `edges` (north [0,19] band, south [0,19] barrier, west [3,3]
  and [5,9] band, east [0,3] and [5,9] band) and `edgeContract: 'enforce'`.
- `src/content/maps/world.ts` - the Forest Road's two exits are the road mouth
  alone: `mouth(0, [4])` west and `mouth(19, [4])` east. Rows 3 and 5-9 at x=0
  and rows 2-3 and 5-9 at x=19 stay walkable but are the declared tree line /
  bank, not way out; the old five-row area would have let the party leave
  through them.
- `src/content/scenes/forestRoad.ts` - `FOREST_WATER_CELLS` is the pond's nine
  cells (it grew by (7,5)), `FOREST_POND_PATCH` widens 352 -> 416 px to keep the
  same 16 px shoreline matte, and `FOREST_PINE_CELLS` is the new tree wall (38
  cells). `FOREST_RAISED_SHELF_CELLS` stays the six authored shelf cells - every
  one of them is still raised, and (19,2) is now the tier-2 perch.
- `src/content/scenes/forestRoad.test.ts` - the shelf assertion now proves the
  painted plate never claims a cell the rules call flat (it may only
  under-claim), and pins (19,2) as the single tier-2 cell. Water, rubble and pine
  lists still match the rows exactly.
- `src/app/world/guidance.test.ts` - the widened-mouth test follows the narrowed
  west mouth: (1,4) reaches Ba Dan, (2,4) and the tree line at (1,7) do not.

## Rows and cells

Rows 4 and 9 are unchanged. Rows and cells are 0-based, as in the plan.

- Row 0: 2,3,6,7,9,10,11,12,13,15,16,17 `,` -> `T`.
- Row 1: 1,7,8,9,18 `,` -> `T`; 14 `T` -> `,`; 16,17 `,` -> `^`.
- Row 2: 0 `,` -> `T`; 15,16,17,18 `,` -> `^`; 19 `^` -> `A`.
- Row 3: 16,17 `,` -> `^`.
- Row 5: 0 `=` -> `,`; 7 `=` -> `~`.
- Row 6: 0,1 `=` -> `,`.
- Row 7: 0,1 `=` -> `,`.
- Row 8: 0,1,18,19 `=` -> `,`.
- Row 10: 4,5 `,` -> `W`; 14 `T` -> `,`; 15 `,` -> `T`.
- Row 11: 2,3,4,5,6,12,13,14,15,16 `,` -> `W`; 7,8,9,10,11,17 `,` -> `T`.

58 cells change a key. 37 of them stop being walkable and two - (14,1) and
(14,10) - become walkable; the walkable count falls 225 -> 190, the plan's -35.

## Interactables (kept where §1.3 puts them)

The Forest Road authors no props and `props` stays empty, because the plan places
no barrels, flasks or braziers here - those are the Quarry Gate's. Its
interactables are the ground itself, and all of them are kept:

- the puddle is now a nine-cell organic pond (`~`) at (4..7, 6) plus (5..7, 5)
  and (5..6, 7): the Wet -> Frozen -> Shocked lesson, and the shove target the
  encounter tip names ("Shove a bandit in first");
- cover is the two live-rubble heaps at (7,3) and (8,9), unchanged
  (`FOREST_RUBBLE_CELLS` still matches `cells('r')`; cover rides the surface, so
  a cleared heap stops giving it);
- the bandits themselves are the pushable targets that make the geometry matter,
  and the reinforcements at (18,6) and (16,2) still stand on walkable ground (the
  second is now on the tier-1 bank, which reads as the slinger picking height).

No oil, fire surface or brazier was added: §1.3 asks for none, and inventing one
would change the tutorial's lesson.

## Decisions

- The exit `area` is the cross-section of the road at the rim (M2's contract),
  not the old five rows. Rows 5-8 at x=0 are the plan's edge-band tree line and
  deadfall; leaving them in the exit area would have made them a back door.
- The NE bank's extra tier-1 cells are left to the relief painter (ADR 0008)
  rather than silently stretched into the shipped shelf plate, whose mask and
  projected bounds are still the six authored cells. Extending the plate is a
  follow-up, below.

## Verification

- **Run, offline:** throwaway Node scripts (no dependencies) that read
  `src/content/maps/combat.ts`, `legend.ts`, `world.ts` and `scenes/forestRoad.ts`
  as text and re-implemented the M1 checks. Result: all rows 20 wide; every key
  in the legend; every walkable border cell is an exit or covered by a declared
  edge; no two adjacent walkable cells differ by two tiers; a flood fill from
  (1,5) reaches all 190 walkable cells; every party spawn, encounter spawn,
  variant spawn, reinforcement, exit, NPC anchor, Dema's cell and both discovery
  markers are walkable; neither exit area contains the tile its partner route
  arrives on. Scene constants matched the rows: `FOREST_WATER_CELLS` is the 9
  water cells, `FOREST_RUBBLE_CELLS` the 2 rubble cells, `FOREST_PINE_CELLS` the
  38 tree cells, and the shelf cells are a subset of the raised cells. The three
  pond reeds keep their placement rules against the new water set (each stays
  0.5 cells off the water, inside the widened patch, at the plate's aspect).
- **Not run:** `npm test`, `npm run typecheck`, `npm run lint`,
  `npm run format:check`, `npm run ci:local`, `npm run balance`, `npm run e2e`
  and every art packer. The checkout has no `node_modules` and `npm ci` cannot
  reach the registry (`ENOTCACHED`), so nothing that imports a dependency can
  execute. No test result is claimed from an exit code.
- **e2e audit:** every Forest Road cell coordinate in `e2e/` was checked against
  the new rows. All of them stay walkable - the route arrivals (1,4)/(18,4), the
  west exit walk from (0,4), the puddle taps (2,5)/(3,6)/(3,7) and gallery fill
  (5,5)/(5,6)/(6,5)/(6,6), the nest at (2,9), the rubble cover at (7,3)/(8,9),
  the elevation probe (19,2) and the road probes (5,4)/(9,4)/(13,5) - so no tap
  needed moving. The `forest-apron.review.ts` rim list still centres on (9,0) and
  (9,11); those are camera centres for rim photographs, not taps, and both are
  still the north and south rim faces (now pine wall and creek-side alders).

## Next actions

1. Repack the plates the new rows feed, in a checkout with dependencies:
   `node --import tsx scripts/art/forest-route-ground.ts`,
   `node --import tsx scripts/art/forest-grass-regions.ts`,
   `node --import tsx scripts/art/forest-shoreline.ts` and
   `node --import tsx scripts/art/forest-rubble.ts`. Until then
   `forest-route-ground.test.ts`, `forest-grass-regions.test.ts` and
   `forest-shoreline.test.ts` compare their packers against stale files; expect a
   visible seam at the new pond cell (7,5), whose bed is still painted as road.
2. Optionally grow the NE bank's painted plate: extend
   `FOREST_RAISED_SHELF_CELLS` to the new `^` cells, widen
   `FOREST_RAISED_SHELF` to cover them (the bank's envelope is x 1536..1920,
   y 544..864 before trim), repack `forest-raised-shelf.ts`, and tighten the
   scene test back to equality.
3. Run `npm run ci:local` on the new head, then `npm run balance` with
   `BALANCE_SIZES=1,3,6` and `BALANCE_VARIANTS=1`. The plan flags the elevation
   change; the balance tripwire is the one check that can still fail on gameplay
   grounds.
4. `npm run e2e` and the `forest-apron` / `forest-pond` / `forest-markers`
   review fixtures, then look at the actual board: the north wall's three
   clearings, the creek's sightline across, and the slinger's bank.

## Completion/transfer

Pending. Source is complete and self-consistent; the generated ground art and
every dependent check above still need a dependency-capable session. No push, PR
or merge was attempted (out of scope for this task).
