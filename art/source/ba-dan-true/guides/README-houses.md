# Ba Dan houses (guides)

Four whole buildings, each with a plinth all round and a yard of its own, in the same projection as every other piece
(`screen X = 64 (x - y)`, `Y = 32 (x + y) - z`, 1.5 image px per world px). They are the village's houses: the painted
sources (`../painted/<id>.png`, notes in `../painted/NOTES-houses.md`) were painted over these guides and are packed by
`scripts/art/ba-dan-true-pieces.ts`. Round 3's houses (a 26 px plinth on a low rear terrace under a thin roof sheet) and
the yard paintings made for them are gone.

| file                                | what                                                                                                             |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `<id>-guide.png`                    | flat-shaded guide, 1.5 px per world px                                                                           |
| `<id>-mask.png`                     | silhouette grey, plinth blue, **yard olive**, footprint red                                                      |
| `<id>-footprint.png`                | the footprint quad                                                                                               |
| `pieces.json`                       | per house: canvas, anchor, foot polygon, door and steps, proportions, yard, walkable cells, light volumes, audit |
| `../planes/<id>.png`                | plane map (R 1 horizontal, 2 east face, 3 south face; G, B coordinate)                                           |
| `scripts/art/ba-dan-houses.ts`      | the light volumes with `density` (`houseVolumes`), read by `ba-dan-village-light.ts`                             |
| `scripts/art/ba-dan-houses.test.ts` | the numbers, the footprints and blocked tiles, the yard's bounds, the volumes                                    |

Regenerate: `python scripts/art/ba-dan-guides/build.py` (guides, masks, footprints, `pieces.json`), then `planes.py`, `edge.py`, and
`sh scripts/art/ba-dan-guides/regen.sh` (see `../README.md`). The review sheets (each guide, with the tile grid, with the game's
figure at the door, the one-tile-wider alternative, the painter's sheets) are `python scripts/art/ba-dan-guides/houses_review.py [--review DIR] [--sheets DIR]`.

## What changed against round 3 and why

1. **Whole roof.** The ridge and the far eave both run along y, so on screen they are parallel lines of slope -0.5 and the far
   slope's band above the ridge is the difference of their intercepts: `64 (half span + overhang) - rise - pitch * overhang`
   (`houses.band_px`). Round 3: half span 0.85, rise 46 gives 10 px, a sliver the ridge beam covered. Round 4: half span 1.0
   to 1.1, rise 26 to 30 (pitch 26 to 27 px per tile), a band of **41 to 46 world px, 63 to 70 guide px** (measured on the render
   at the column through the middle of the ridge: 63, 70, 66, 67). Both gable ends are complete and symmetric about the ridge
   (verge boards, centre post, braces), the eaves overhang 0.15 east and west and 0.2 on the gable ends, and the ridge cap
   (a beam, a row of tiles, a stepped ornament at the south end) sits on top of two slopes. The far eave and the east eave kick
   up 4 px at the corners.
2. **Plinth all round, lower.** 18 px on every side (round 3: 26 px, a terrace at 8 and a 3 px threshold stone). The stair is
   two risers of 9: ground to a 0.25 tile tread, tread to the landing at 18. The game's figure is 86 px tall (a 128 x 192 frame
   drawn at 1.45 tiles per 128 px, 64 px a tile: 118 px of figure x 0.725), so the plinth is 0.21 of a person, shin to
   knee. Door 88 px clear (1.02 of a person; round 3's was 62), window sills 32 above the floor, tops at 70.
3. **The yard is its own area.** It fills the west tiles of the footprint, x from 0 to the plinth's west edge (1.1 to 1.3
   tiles wide), over the whole depth of the footprint. Its own kerb, wattle fence or rail fence stands on the west, north and
   south sides, one gate gap onto the lawn or path, a 3 px earth floor, and the house's plinth is its east side, complete.
   Nothing of the yard is under a roof (the roof's west eave is 0.05 tile clear of the plinth) and nothing runs into a wall.
4. **Four buildings.** See the table.

| piece                | household / roof       | depth x length (body)                   | rise    | wall above plinth | what is its own                                                                                                                                  |
| -------------------- | ---------------------- | --------------------------------------- | ------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dwelling-4x3`       | potter, terracotta     | 2.0 x 2.6                               | 28      | 108               | plain whole gable house, two east windows, brick chimney through the ridge; wattle yard, gate south                                              |
| `merchant-house-4x3` | Gao, green tile        | 2.2 x 2.6                               | 30      | 112               | shop bay under a cloth awning, a roof lantern (vent) on the ridge, bench and rain barrel on the ledges                                           |
| `dwelling-4x4`       | woodcutter, terracotta | 2.0 x 3.6                               | 26      | 102               | long low house, three east windows, a tiled lean-to porch on two posts over the door; rail-fenced yard                                           |
| `merchant-house-4x4` | shop, green tile       | 2.2 x 3.6 (main 2.05 + lower wing 1.55) | 30 / 22 | 116 / 102         | two roofs: a tall main block with the shop bay, a lower south wing holding the door, a chimney stack between them; stone-kerbed yard, gate north |

No hips and no dormers: their ridges and valleys run diagonal on the ground, against the axis rule. The second lower roof is a
wing with its own ridge along y; the chimney, the vent and the porch roof are axis-aligned boxes and planes.

## Yards (all on blocked tiles)

Every footprint tile is blocked: the plinth runs the whole footprint and the yard fills its west tiles, so the `walkable_cells_in_footprint`
that `pieces.json` still lists (the earlier design's doorstep and gate notches: (9,3), (12,3), (9,10), (9,11), (13,10), (13,11)) were closed in `village.ts`;
a figure stands at the foot of the steps, the door's `faces_tile`, and `baDan.test.ts` holds both. The gates below are painted openings onto the lane, not walkable tiles.

| house                  | yard (tiles, x by y) | contents                                                                                       | gate                                                                         |
| ---------------------- | -------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| potter (north-house)   | 1.3 x 3.0            | kiln with a dark firing mouth and a flue, drying bench with four pots, stone basin, spare pots | south wall at x 0.5: on the walkable cell (12,3), whose lane is (12,4)       |
| Gao (gao-house)        | 1.1 x 3.0            | handcart with sacks and two wheels, three barrels, stacked stock crates                        | south wall at x 0.6                                                          |
| woodcutter (southwest) | 1.3 x 4.0            | log stack, sawhorse with a log, chopping block with an axe, split logs on the ground           | south wall at x 0.5, onto row 14 (the parked household route uses (6..9,14)) |
| shop (southeast)       | 1.1 x 4.0            | hay cart, crate stacks, barrel, sacks                                                          | north wall at x 0.5: on the walkable cells (13,10) and (13,11), lane (13,9)  |

The yard sits behind the house's west gable, so the house hides part of it. Share of the yard's ground that shows on screen:
**32.5%, 28.7%, 24.4%, 21.6%** (`yard.visible_fraction`): what you see is the half nearest the south wall, left of the gable,
plus the gate, the kerb and whatever stands there; the rest is for the painter's continuity, not the player's eye.

### Crowding, and the smallest footprint change

The 4x3 and 4x4 footprints hold a whole house and a bounded yard, but the yard is narrow (1.1 to 1.3 tiles) and mostly
behind the house. Moving it to the north or the south of the house fails for a stronger reason: anything north of a house
is hidden by the wall, and the south end of the east wall is where the door tile, Gao's `(10,3)` and Mira's `(16,3)` and
Pella's `(10,13)` stand points, and the lanes are. So the yard stays west. The smallest change that gives it room is
**one more blocked column west of each house** (a fifth tile of footprint): `north-house` (11,1), (11,2), (11,3);
`gao-house` (5,1), (5,2), (5,3); `southwest-house` (5,10) to (5,13); `southeast-house` (12,10) to (12,13). It would raise the
visible share to 53%, 48%, 47%, 41% (`houses_review.py` writes `*-w5-guide.png` and `-grid.png` to the review folder for
this) and costs three or four lawn cells a house. It was **not** made: those cells are open lawn today, (11,3) sits between
Gao's stand point and the north house's lane, and the south-east column narrows the south court by a third. The yards stay on the four footprints as they are.
