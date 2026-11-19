# Place brief: `ba_dan_village`

**Status (2026-11-18):** stages 0 to 8 of `docs/level-design.md` are done (PR #875). The owner approved the brief and
plan on 2026-11-17: plan 2 (the table at the crossing), 32 by 20 cells, the awning as the one strong colour, and the
quarry hillside along the north rim. On 2026-11-18 the owner approved the blockout ("looks right, go on"), the ground
("looks right, go on"), the kit at the scale chart's size (162 credits, then about 18 for trees and 30 for the stage 7
props; 197 spent of the 210 cap), and the dressed board ("love it, finish it"). Story facts are the writing
pass's; every gap is a marked placeholder or a question.

**Back row (2026-11-19):** the owner settled a clash with SQ-03: the house with the blue door and the house with the
bent shutter are the two households on Gao's ledger, unnamed on purpose, so Amri and Senn move to two new houses in a
back row and the board grows to **32 by 23** (section "Back row" at the end).

**One line:** a quarry village built from its own hill's pale stone, where everyone eats at one table in the square
and every road ends at the east gate.

**Identity:** the people's table. **Landmark:** Mira's patched awning over the table in the square.

## Stage 0: what the story says

Quoted or summarised from the story and content files; nothing here is new. **(data)** marks a fact only the map,
resident or dressing data states.

- "Ba Dan lies below a limestone quarry, its houses built from the same pale stone as the hill." "By noon, the whole
  square is white with dust." (`act1_open`, `src/content/story/act1.ts`)
- It lies "on the western uplands above a sheltered bay"; Saltstep is south-west at the river mouth
  (`docs/story/the-common-current-bible.md:209`). The quarry's stone came "down the east road" for sixty years
  (`:231`); the quarry is "East road, then the switchbacks. About two hours." (`act1.ts`, `dorin_directions`)
- **Mira's table:** "a public table under a patched awning. It is where requests are heard, food is shared, and
  people argue over whose bucket belongs to whom. It is not a throne." (`the-common-current-bible.md:248`); repaired
  chairs, a bench, a bowl kept covered under it (`act1.ts`, `mira_table_bowl`; `return.ts:254`).
- **The gate:** "cooking smoke, the canal, the gate with someone sitting beside it" from the bend on the way home
  (`return.ts:105`); a gate bell and a stool (`return.ts:106`, `:130`); "the hut" with the notice board and Hanru's
  fish prints, a cupboard behind the post, the lamp by the east road (`baDanDay.ts`). Canon: "laundry tied between
  a shrine and the guard hut"; "a gate almost everyone walks around" (`the-common-current-bible.md:246-248`).
- **Gao's shop:** water skins by the door, a counter, a scale, a potted plant on the only spare chair, a storeroom
  behind, "my trough" where the stone carts water their animals (`act1.ts`; `baDanDay.ts`; `sq03GaosLedger.ts`;
  `lost.ts:187`).
- **The canal:** "lamps come on along the canal" (`return.ts:253`; `lost.ts:47`). Gao's parcels go to "the houses
  past the canal": the blue door and the house with the bent shutter (`sq03GaosLedger.ts:50`). Both households are
  left unnamed on purpose (SQ-03; owner, 2026-11-19).
- **The side gate:** a path "behind the houses to the vegetable gardens. It is quicker than going round by the
  square." "The map has no side gate yet." (`sq02OfficialGate.ts:13-14`, `:187`)
- **Named with no place yet:** the mason's yard where Hesra lodges, with a step and a windowsill (`return.ts:255`);
  Pella's shutter (`return.ts:281`); "the quarry houses" (`lost.ts:48`); Ba Dan's workshop (`story-outline.md:81`).
- **Who makes what:** quarry stone; Gao's shop; Leto drives the cart; Hesra is a mason's apprentice; Bo-shan took
  vegetables up to the quarry cookhouse (`story-bible.md:387`, `:702-705`).
- **(data)** Exits: the east road to the Forest Road and the river path to the riverside; the coast road to
  Saltstep is a sign at the south edge after Act I; the west road ends at a flooded ford (`village.ts`, `world.ts`).
- **Time:** six day phases, a new game starts at midday; the walk home sets evening (ADR 0047). Music: `ba-dan`.
- **Not in the story** (so not decided here): what else Ba Dan makes or trades; whose the vegetable gardens are;
  which family lives in the south-east and north-east houses; where the school is; what lies past the west ford.

## What today's board is

Four 4x3 and 4x4 house blocks in two facing rows, a canal dead straight across the top half, a two-cell road dead
straight across the middle, and a one-cell tree border on every side of a 24x16 box. Blocked `l` cells are spread
over the grass for props to stand on. The story's own places (the gate with its stool and bell, the trough, the
mason's yard, the side gate, the houses past the canal) are either missing or a prop standing on the lawn. It is a
**road with houses beside it**, not a village with a square.

## Story

- **Why the player comes here:** the first hour of the game (the prologue cuts to "an outdoor table" with bowls;
  Mira's table; Pella, Gao, Dorin; SQ-01 to SQ-03), the walk home and welcome (DLG-07), the end card and free roam,
  the occupied village after a loss, and later returns (MQ-05, MQ-11).
- **Feeling on arrival:** safe, dusty, busy. **On leaving by the east road:** missed. **On the walk home:** lamps
  coming on.
- **Later states** (runtime props, NPCs and conditions only; the bake stays the same):
  - before Mira's table -> Mira and Pella held at the table;
  - occupied, rescue pending -> nobody hurries; a shared supper;
  - walk home -> the welcome crowd inside the east gate; Ruon on the escort road;
  - homecoming night -> extra bowls; lamps on along the canal;
  - after a loss -> tables pushed together and crowded; the cart on blocks outside Gao's shop; Hanru on the gate by
    day;
  - SQ-02 done -> the side gate hung the right way round, a hen on its post (lines only today; wants a prop);
  - SQ-03 done -> the jar "for whoever needs it" on Gao's counter (lines only today; wants a prop);
  - C-30 -> a worker's boot with a shell on a doorstep (bible asks for it; not built);
  - canon return -> boots outside the quarry houses' doors; a notice board in more than one hand.
  - **Reserve:** room in the square for tables pushed together; room inside the east gate for a crowd of six to
    ten; a free doorstep at each quarry house.

## People

Roles and story names only; lines belong to the writing pass. Anchor ids stay; their cells move with the plan.

| Who                     | Lives                                                              | Works / stands                        | Why talk to them                                 |
| ----------------------- | ------------------------------------------------------------------ | ------------------------------------- | ------------------------------------------------ |
| Mira (`elder_mira`)     | Her house on the square                                            | The table under the awning            | Mira's table; the epilogue; the rubbing          |
| Gao (`shopkeeper_gao`)  | Behind his shop                                                    | Shop front, the trough, the storeroom | Supplies; the plant chair; SQ-03                 |
| Pella (`kid_pella`)     | Her house past the canal (with Bo-shan)                            | The court; the table bench            | Tips; SQ-01; the reunion                         |
| Dorin (`guard_dorin`)   | `PLACEHOLDER (story)`: which house                                 | The gate post; the handover           | Directions; SQ-02; the watch book                |
| Hanru (`guard_hanru`)   | `PLACEHOLDER (story)`: which house                                 | The gate at night; the hut            | The night watch; the fish prints                 |
| Bo-shan, Leto, Amri     | Past the canal (`home.*` anchors); Amri's house is in the back row | The welcome crowd; recovery spots     | The return                                       |
| Hesra                   | **The mason's yard** (story) - today a rim door                    | The yard                              | The boot (C-30)                                  |
| Pella's household adult | With Pella                                                         | The court and yard                    | `PLACEHOLDER (story)`: stand-in until Nala comes |
| Relief watch            | -                                                                  | The gate at midday                    | Colour                                           |

## Daily life

- **An ordinary day:** bowls are set out at dawn and the village eats at the table three times a day; the watch
  changes at the gate at dawn and evening; carts stop at Gao's trough on the way through; people cross the bridge
  to the houses past the canal; someone takes the back path to the vegetable gardens; the mason's yard works stone;
  in the afternoon Mira, Pella and Dorin go down the river path.
- **Desire lines:** every door -> the table (the most-worn ground in the village); the east gate -> the trough ->
  the square (carts); the square -> the bridge -> the houses past the canal; the house backs -> the side gate -> the
  gardens (the short cut the story names); the mason's yard -> the east road (stone to the quarry); the square ->
  the river path (afternoons); the gate post -> the hut.
- **Stored, made, sold, thrown away:** sold at Gao's (storeroom behind); stone cut at the mason's yard (chips and
  offcuts); vegetables grown in the gardens and carted to the quarry; washing at the canal steps and on the line by
  the guard hut; `PLACEHOLDER (story)`: where rubbish goes.

## Shape

### Three plans

1. **Street village** (today). Houses on both sides of one road. Easy to walk, but every view is the same and the
   square, the gate and the story's other places have nowhere to be.
2. **The table at the crossing.** The east road comes in through the gate, passes Gao's shop and the trough, and
   opens into a square where Mira's table stands under its awning. Lanes leave the square west to the mason's yard,
   north-east behind the houses to the side gate and the gardens, and south over the bridge to the houses past the
   canal and on to the river path. The canal runs along the south of the square with lamps on its kerb.
3. **Canal street.** The canal is the spine with houses facing it on both banks and the bridge as the focal point.
   It suits "lamps along the canal", but it splits the first hour across a choke point and puts the table in a
   corner.

**Chosen: plan 2.** The story already says the village is "the table" and that every way home ends "at the east
gate". Plan 2 makes the table the place the routes cross, makes the gate a place rather than a post, and gives each
place the story names (the trough, the mason's yard, the side gate, the houses past the canal) its own corner. It
keeps plan 3's lamps along the canal.

### The plan

```
              hillside rising to the quarry (cliff rim; pale stone shows through)
   [TEA TERRACE]                 [GAO'S SHOP + storeroom]   [BACK PATH]--side gate--[GARDENS]
   quiet, looks down                 trough on the road          behind the house backs
        |                                   |
 [MASON'S YARD] --lane-- [ THE SQUARE: Mira's table, awning ] ---- road ---- [EAST GATE] ==> east road
   stone, chips            (focal point; white dust)             post, stool, bell, hut,
        |                            |                           notice board, lamp, shrine
 [WEST FORD] ~~~ canal, lamps on the kerb ~~~ [BRIDGE + wash steps] ~~~~~~~~~~~~~~~ (canal leaves east)
   flooded road                          |
                       [PAST THE CANAL: the quarry houses, blue door, bent shutter, Pella's house]
                                         |
                       [BACK LANE + BACK ROW: Amri's and Senn's houses]  --  river path runs on south
                                         |
                         [RIVER PATH mouth, south]   [coast road sign, after Act I]
```

- **Focal point:** Mira's table under the patched awning, in the square where the routes cross. Seen from the east
  gate down the road, from the bridge, and from the tea terrace above.
- **Entry view (new game):** the square at midday with the bowls out and Mira at the table; the awning is the first
  thing the eye lands on. **Entry view (walk home):** the east gate with someone on the stool, the road running on to
  the square, lamps coming on. The two entries are the two halves of the demo.
- **Views** (10 by 5 cells each) and their one idea:
  1. _The east gate:_ you are home (post, stool, bell, hut, notice board, the east-road lamp, the shrine).
  2. _The road in:_ Gao's shop and the trough where carts stop.
  3. _The square:_ the table.
  4. _The bridge:_ the wash steps and the lamps on the canal.
  5. _Past the canal:_ the quarry houses' doorsteps, the blue door, the bent shutter, and behind them the back lane
     with Amri's and Senn's doors.
  6. _The mason's yard:_ pale stone being cut.
  7. _The back path:_ the side gate in a wall behind the house backs.
  8. _The gardens:_ the vegetable beds (whose: `PLACEHOLDER (story)`).
  9. _The river path:_ the way down to the riverside (and later the coast road sign).
  10. _The west ford:_ the old road under water (quiet).
  11. _The tea terrace:_ the view down over the square (quiet).
- **Quiet spaces:** the flooded ford and the tea terrace; both stay nearly empty so the eye rests between the gate
  and the square.
- **Main route:** east gate, the road in, the square (the hub); every other route leaves the square and comes back.
- **Side paths:** the back path -> the side gate and the gardens (SQ-02's short cut; a loop back to the gate road);
  the lane west -> the mason's yard and the ford (a find); the steps up -> the tea terrace (a view of the whole
  village and the quarry road).
- **Edges:** north, the hillside rising toward the quarry (cliff and trees in the lip, pale stone showing); west,
  the flooded ford; south, the meadow falling to the river; east, the gate in a low wall with the road through it.
  No side is a straight run.
- **Exits:** the east gate (all three cues: the gate is the break, the road runs through it, and the road beyond is
  the lightest ground); the river path mouth (south); the coast road sign (south, after Act I).
- **Size:** eleven views, about **32 by 20** cells, up from 24 by 16 (32 by 23 since the back row, 2026-11-19). Ba Dan is the hub players return to across the
  whole saga, so it earns the room; it would be the largest top-down board, so the perf bench and the region's
  board budget need checking before the blockout lands.

## Look and sound

- **Culture and materials:** an Earth Kingdom upland village as in the Avatar animated style: green glazed upturned
  roofs on pale limestone bases. Never half-timbering, chimneys or European cottages. Four materials: pale
  limestone, green glazed tile, weathered timber, packed earth.
- **Signature:** the patched awning's cloths, the one place warm saturated colour is allowed. Everything else is
  pale stone, green roofs and dust, so the table reads from every view.
- **Ground:** pale and dusty in the square (white by noon), worn to bare earth from every door to the table; damp
  at the canal steps and the trough; chips and offcuts at the mason's yard; tilled soil in the gardens.
- **Time and weather:** the six day phases; the walk home at evening with lamps lit along the canal and at the gate.
- **Music and sound:** the `ba-dan` track. Canon: "a square that sounds wrong without cart wheels". Sound sources:
  cart wheels on the road in, the canal, the gate bell, chisels at the mason's yard, bowls at the table.

## Set pieces

All from the story or the canon above; the kit list comes after the blockout. Pieces marked _have_ exist in today's
art and may be reused if they pass the scale chart.

| Name             | Anchor                     | Belongs with it                                          | Ground under it                     | Whose / why here              |
| ---------------- | -------------------------- | -------------------------------------------------------- | ----------------------------------- | ----------------------------- |
| Mira's table     | Table (_have_), awning     | Bench (_have_), repaired chairs, bowls, the covered bowl | The most worn ground in the village | Mira; the village eats here   |
| Gao's shop front | Shop door                  | Water skins, the plant on the chair, stools, sacks       | Packed apron to the road            | Gao                           |
| The trough       | Trough (_have_)            | A bucket, a cart's turning patch                         | Wet ruts, hoofprints                | Gao's; carts stop on the road |
| The east gate    | Gate post in a low wall    | Stool, bell, lamp (_have_), notice board (_have_)        | Worn round the gate, not through it | The watch; "walked around"    |
| The guard hut    | Hut                        | Cupboard, washing line to the shrine (_have_ shrine)     | Trodden yard                        | Dorin and Hanru               |
| The wash steps   | Steps down to the canal    | A basket, a board, a cloth                               | Damp kerb                           | `PLACEHOLDER (story)`: whose  |
| The canal lamps  | Lamp posts on the kerb     | -                                                        | Lamp pools at evening               | The walk home                 |
| The mason's yard | Stone blocks, a work bench | Chisels, offcuts, the step and windowsill                | Chips and white dust                | The mason; Hesra lodges here  |
| The side gate    | Gate in a back wall        | Key hook, later the hen on its post                      | A trodden short cut                 | Dorin's key register (SQ-02)  |
| The gardens      | Vegetable beds             | Tools, a basket, a handcart (_have_)                     | Tilled soil                         | `PLACEHOLDER (story)`: whose  |
| A quarry house   | House door                 | Doorstep, a pot, a bench; later boots                    | Packed earth to the lane            | The families past the canal   |

## Finds

| What draws the eye                 | Where             | What the player gets           | What it should reveal (a need for the writing pass) |
| ---------------------------------- | ----------------- | ------------------------------ | --------------------------------------------------- |
| The terrace steps above the square | North of the shop | A view of the village and road | `PLACEHOLDER (story)`: whose terrace it is          |
| A worked stone left in the yard    | The mason's yard  | A discovery spot               | `PLACEHOLDER (story)`: something of the quarry      |
| The flooded road going under       | The west ford     | A discovery spot               | `PLACEHOLDER (story)`: what lies west               |

## Things the blockout must settle

- **Ids stay.** The map id, every NPC, trigger, exit, rest spot, anchor, scene and dressing id keeps its id; only
  positions move. The east exit's `toPos` pair with the Forest Road, the river path with the riverside, and
  Saltstep's arrival (16,14) move together.
- **The welcome trigger** covers a whole column inside the east gate so no way home slips past it; the new shape
  needs the same guarantee.
- **Saves.** Before the rows change, check what a save holds for the party's position on this map
  (`world.returnPos` is (23,7)) and how it recovers if that cell moves. Not verified.
- **Tests pin cells.** About fifteen e2e specs and several unit tests hard-code village cells (the intake lists them);
  the blockout PR moves them with the data, ideally by reading named anchors instead of numbers.
- **Doors.** Today's comment in `village.ts` and the resident anchors disagree on door cells; the blockout decides
  one set from this plan and fixes both.
- **Bo-shan and Pella share a door** (8,14): the plan treats it as their family home.
- **Practice:** the bending practice spot moves to the wash steps, bending out over the canal as it does now.
- **Blocked cells come from this plan only:** houses, walls, the canal, the table, the trough, the gate post, the
  stone blocks. No scatter cells; the `l` lawn cells go.

## Owner's answers (2026-11-17)

1. Plan 2, the table at the crossing: yes.
2. A bigger Ba Dan, about 32 by 20 and eleven views: yes.
3. The awning's patched cloths as the village's one strong colour: yes.
4. The hillside to the quarry along the north rim: yes.

## Questions for the writing pass

1. Whose are the vegetable gardens, the tea terrace, the wash steps, and the south-east and north-east houses?
2. Hesra lodges at the mason's yard (`return.ts:255`) but her anchor is a south rim door: move her to the yard?
3. Which houses are Dorin's and Hanru's? Is "the gate" a real gate across the road or a post beside it?
4. Where is the school, if Ba Dan has one, and where does the village's one bell hang?
5. What lies past the west ford, and when does it open?

## Kit list (stage 5)

The set pieces are placed as labelled boxes: `src/content/scenes/baDan.setpieces.ts` (19 set pieces, 71 members besides
the rim's 98 trees), checked by `src/content/setPieces.test.ts` and drawn in the game with `?boxes` on a dev build.
This is every piece of art that plan needs, and nothing it does not. **Sizes are the plan's, in px**: width is the
footprint (40 px a cell), height is the plan's height in figures (1 figure = 45 px); a sprite's drawn box is a little
deeper than that where a roof or a cloth shows its top. Credits are the guide's costs (object about 5, house about 9,
tileset 15, `docs/level-design.md` section 7) for a first take, and 0 where existing art serves. No art is generated yet.

| #   | Art                                              | Used by (members)                            | Size px (w x h) | Existing art (native px)                                                                                   | Credits |
| --- | ------------------------------------------------ | -------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------- | ------: |
| 1   | Mira's house, one storey                         | `mira_house`                                 | 200 x 76        | EK `house_mira` 256 x 238 (#865): 5.3 figures tall and 56 px wider than the footprint, so not at this plan |       9 |
| 2   | Gao's shop front                                 | `gao_shop`                                   | 160 x 76        | EK `house_gao` 216 x 167 (#865), `house_merchant` 216 x 164: taller and wider than the plan                |       9 |
| 3   | Gao's storeroom, the L's short arm               | `gao_shop`                                   | 80 x 76         | none                                                                                                       |       5 |
| 4   | Mason's house (Hesra lodges here)                | `mason_yard`                                 | 120 x 72        | none (the old cream/green/ochre houses are the European drift)                                             |       9 |
| 5   | Pella's house                                    | `pella_house`                                | 160 x 72        | EK `house_pella` 242 x 216 (#865): taller and wider than the plan                                          |       9 |
| 6   | Guard hut                                        | `guard_hut`                                  | 80 x 63         | quarry `gatehouse` 85 x 55 (objects13): reuse if it reads on Ba Dan's palette                              |   0 (5) |
| 7   | Quarry row house, base style (Leto's)            | `quarry_leto`                                | 120 x 68        | none                                                                                                       |       9 |
| 8   | Quarry row house, blue door (unnamed, SQ-03)     | `quarry_blue_door`                           | 120 x 68        | an edit of #7 (door colour)                                                                                |       5 |
| 9   | Quarry row house, long with the bent shutter     | `quarry_bent_shutter`                        | 160 x 68        | none                                                                                                       |       9 |
| 10  | The bent-shutter house's annex, the L's corner   | `quarry_bent_shutter`                        | 40 x 68         | an edit of #9                                                                                              |       5 |
| 11  | Quarry row house, shutters closed (Hanru's)      | `hanru_house`                                | 80 x 68         | an edit of #7 (shutters)                                                                                   |       5 |
| 12  | Mira's table, with bowls and the covered bowl    | `mira_table`                                 | 80 x 30         | `mira_table` 73 x 30 (objects7), the old board's table                                                     |       0 |
| 13  | The patched awning: cloth over four posts        | `mira_table` (cloth and 4 posts)             | 128 x 96        | none; the one strong colour in Ba Dan                                                                      |       5 |
| 14  | Crew bench                                       | `mira_table`                                 | 80 x 18         | `bench` 51 x 37 (objects12), the old crew bench                                                            |       0 |
| 15  | Repaired chair (flipped for the second)          | `mira_table` x2                              | 24 x 22         | none                                                                                                       |       5 |
| 16  | Water jar                                        | `mira_house`                                 | 24 x 32         | `rain_barrel` 22 x 28 (props)                                                                              |       0 |
| 17  | Potted shrub                                     | `mira_house`                                 | 24 x 27         | `flower_pots` 26 x 27 (objects12)                                                                          |       0 |
| 18  | Plant on the spare chair                         | `gao_shop`                                   | 24 x 36         | none                                                                                                       |       5 |
| 19  | Stool (one sprite; the small one is a scale)     | `gao_shop` x2, `east_gate`, `tea_terrace` x2 | 14 x 18         | none                                                                                                       |       5 |
| 20  | Sacks                                            | `gao_shop`                                   | 24 x 27         | `sack` 22 x 28 (objects12)                                                                                 |       0 |
| 21  | Trough                                           | `trough`                                     | 40 x 27         | `trough` 44 x 26 (objects12)                                                                               |       0 |
| 22  | Bucket                                           | `trough`                                     | 16 x 18         | `bucket_broom` 25 x 29 (objects12) has a broom with it, so not as is                                       |       5 |
| 23  | Gate post with the old shift bell                | `east_gate`                                  | 40 x 72         | none; the gate's landmark                                                                                  |       5 |
| 24  | Low stone wall, one cell (11 cells in the run)   | `east_gate`                                  | 40 x 32         | `earth_wall` 44 x 34 (props), or bake it into the plate as the ground's `#` link                           |       0 |
| 25  | The mended wall section                          | `east_gate`                                  | 40 x 25         | an edit of #24                                                                                             |       5 |
| 26  | Lamp (gate lamp on the wall, three on the canal) | `east_gate`, `canal_lamps` x3                | 40 x 72         | `lamp` 34 x 82 (objects_t3, #865); 4 glows, the map's lantern limit                                        |       0 |
| 27  | Washing line, hut to shrine                      | `guard_hut`                                  | 40 x 58         | `laundry_line` 79 x 56 (objects12)                                                                         |       0 |
| 28  | Notice board, a decal on the hut's west wall     | `guard_hut` (not a member)                   | 38 x 47         | `notice_board` 38 x 47 (objects12)                                                                         |       0 |
| 29  | Wayside shrine, with offering bowl               | `shrine`                                     | 40 x 76         | `shrine` 56 x 76 (objects_t3, #865): kept at its real 1.7 figures, a `fades`                               |       0 |
| 30  | Basket (wash steps, gardens)                     | `wash_steps`, `gardens`                      | 16 x 18         | none                                                                                                       |       5 |
| 31  | Washboard on the kerb                            | `wash_steps`                                 | 16 x 18         | none                                                                                                       |       5 |
| 32  | Worked stone block (three, flipped)              | `mason_yard` x3                              | 40 x 36         | `stone_blocks` 28 x 30 (objects13)                                                                         |       0 |
| 33  | Mason's work bench                               | `mason_yard`                                 | 32 x 27         | `workshop_bench` 50 x 38 (Saltstep objects_rg02): wider than the plan                                      |       5 |
| 34  | Offcut heap                                      | `mason_yard`                                 | 24 x 18         | `rubble` 42 x 24 (props)                                                                                   |       0 |
| 35  | Side gate, hung open on its post                 | `side_gate`                                  | 40 x 40         | none                                                                                                       |       5 |
| 36  | Tool lean-to                                     | `gardens`                                    | 40 x 50         | `lean_to` 48 x 38 (objects13)                                                                              |       0 |
| 37  | Carved stone peg (three, one sprite)             | `gardens` x3                                 | 12 x 14         | none                                                                                                       |       5 |
| 38  | Tea tray                                         | `tea_terrace`                                | 12 x 14         | `teapot` 27 x 26 (objects_rg02)                                                                            |       0 |
| 39  | Bo-shan's handcart                               | `pella_house`                                | 32 x 40         | `handcart` 32 x 41 (objects12)                                                                             |       0 |
| 40  | Bench by Leto's door                             | `quarry_leto`                                | 32 x 18         | `bench` 36 x 26 (objects7)                                                                                 |       0 |
| 41  | Pot by Amri's door (back row)                    | `quarry_amri`                                | 20 x 22         | `pots` 26 x 19 (objects12)                                                                                 |       0 |
| 42  | Log pile by Senn's door (back row)               | `quarry_senn`                                | 28 x 22         | `firewood` 39 x 29 (objects12)                                                                             |       0 |
| 43  | Drying rack                                      | `hanru_house`                                | 40 x 50         | `drying_rack` 35 x 41 (objects_rg02)                                                                       |       0 |
| 44  | Rim trees: tree, blossom tree, bush              | `rim_trees` x98                              | 40 x 85         | `tree` 101 x 121, `tree_blossom` 56 x 89, `bush` 36 x 42 (the old board's)                                 |       0 |
| 45  | Doorsteps and free doorsteps (10), treads        | house pieces, `wash_steps`, `mason_yard`     | 40 x 40         | none needed: baked into the plate as ground (aprons)                                                       |       0 |
| 46  | Tilesets                                         | the ground                                   | 32 px           | the ground spec's own: `gc32`, `q_floor32b`, `canal32`, `cliff32`, `flag32`                                |       0 |

**Total, first takes: 134 credits** (houses and buildings 74, objects 60). Reserve one retake on the four focal anchors
(the awning 5, the gate post 5, Mira's house 9, the mason's house 9): **28 more, 162 in all**. If the owner accepts the
EK houses of #865 as they are, lines 1, 2 and 5 drop out and the total falls by 27 (a design call: those houses are
3.6 to 5.3 figures tall and wider than this plan's footprints, so the footprints and rows would change with them).
Lines marked "a variant" are edits of a first take (`edit-image-pro-flash`) and are priced as one object. Book the spend
in `prototypes/topdown/ledger.json` and send the credit total to the owner first (credit budgets are his).

**Where the rules moved the plan** (stage 5, each by the smallest step; the rest stands as written):

- Mira's water jar (14,7) to (16,7): (14,7) lies on the table's own disk, which only the table piece may use.
- Gao's plant on the chair (18,7) to (18,6): (18,7) lies on the `shop_front` track.
- Mira's bench from the table's north side (13-14,8) to its south side (13-14,10), where Pella's `bd01.bench` and the rest spot are, so the `mira_door` track stays clear.
- The ground's `gate_post` ring is re-centred on the real bell post: (28.6,8.5), r 0.5, so it no longer grazes the hut. The watch's stool stays at (28,8) and `east_gate` stands on that ring as the table stands on its disk. The gate gap stays open.
- The east wall's south run is split to (29,11-12) and (29,15-18), with a flat culvert grate on (29,13-14), where the canal passes under.
- The awning is shrunk to the table plus half a cell each side: cloth (12.5-15.5, 8.5-10.0), posts at its corners.
- The shrine keeps its art at 1.7 figures and becomes a `fades`.
- The garden's north-west stone peg (26,2) to (27,2), so that it touches the lean-to (anchored rule).
- The side gate hangs on the fence cell (25,2), against the post, because its gap (25,3) is the `side_gate` track.
- The east wall's rows 3-8 are rows 3-7 and the bell post on row 8, which the post's own cell already is.

## Kit placed (stage 6, part 2)

The kit stands in the game: `src/content/scenes/baDan.layout.ts` turns every member of the set-piece plan into an object
(the plan stays the one source of placement; a table says which sprite stands for each member), the ground board bakes
their static shadows and contacts (`boards/ground.ts`, ADR 0104 section 2 and ADR 0093) with no plinths, and `?boxes` still
draws the plan on top. Changes to the plan: the carved stone pegs and the tea tray are cut (strip edges will be marked another
way later); heights are the drawn sprites' real heights (the houses keep their drawn sizes, no resampling); the ford's
quiet box ends at row 10 so the rim tree on (0,11) can stand; the garden basket hugs the lean-to. The rim mixes the pine,
the broadleaf, the bamboo and the bush with a varied rhythm; the old oak and blossom tree are not used in Ba Dan.

## Life (stage 7)

The later states that need a prop now have one, shown by a condition and drawn at its native size as a tappable marker
(`src/content/maps/village.ts`; `villageLaterProps.test.ts`). The bake does not change.

| State                  | Prop                                                            | Cell   | Condition                     |
| ---------------------- | --------------------------------------------------------------- | ------ | ----------------------------- |
| SQ-02 done             | The side gate hung the right way round, shut, a hen on its roof | (25,3) | `SQ02_RESOLVED`               |
| SQ-03 done             | The jar "for whoever needs it", by Gao's counter                | (18,7) | `SQ03_RESOLVED`               |
| C-30, after the supper | Hesra's boot with the river shell, by her door                  | (6,8)  | `welcome_home_supper` visited |

- The cells differ from the plan where the plan's cell was taken: (25,2) is the gate's blocked post, (5,7) is Hesra's door
  anchor and (6,7) her recovery spot, and (19,7) to (21,7) are Gao's restock steps, his shop-front anchor and the trough.
- The shut gate closes the small pocket east of it (26..28, 3..4), which holds nothing; SQ-02 resolves at the east gate, so
  nobody is standing in it when it shuts.
- Each prop has a look-at node (`look_side_gate_hung`, `look_gao_jar`, `look_hesra_boot`) with a marked placeholder line;
  the writing pass writes them.
- Not built yet: the canon return's boots at the quarry houses' free doorsteps, and the notice board in more than one
  hand (the doorsteps are kept free for them).
- Residents: every anchor, routine stop and slot is on an open cell of the dressed board (`residents/baDan.test.ts`,
  `ba-dan-day-matrix.spec.ts`).

## Review (stage 8, 2026-11-18)

- **Measured:** the layout validates; set-piece, resident and later-prop tests pass. The ground report still lists what
  the owner saw at the ground stage: the square's table track crosses the table (13,9)-(14,9) by design, the gate-post
  track crosses the post (29,8), and seven welcome and recovery spots stand on unchanged ground.
- **Evening:** the lamps light as the ambience designs them, two warm pixels in each lantern's glass, on both
  renderers. The board takes no evening tint, so "lamps coming on" on the walk home reads only faintly. That is the
  existing exploration ambience, not this board; making it stronger is a follow-up.
- **Known weak spots kept for later:** the old trough, sacks and crew-bench props; the lamps stand about 1.8 figures
  tall; the gate corner is busy; the houses run a little short of the scale chart; the notice-board decal is not placed.

## Back row (2026-11-19)

**Why:** SQ-03 (`sq03GaosLedger.ts`) says the house with the blue door and the house with the bent shutter belong to
two households left unnamed on purpose, but the board labelled them Amri's and Senn's. The owner chose to keep both
houses where they stand, art untouched, as the unnamed households (a plain doorstep each, no `home.*` anchor, no name
in the label), and to give Amri and Senn two new plain houses in Leto's art (`quarry_row`, 0 credits) in a back row.

**Blockout:** the board grows three rows south, from 20 to 23. Row 18, the grass behind the front row, becomes the
back lane; the new houses stand on rows 19-20 facing north onto it; row 21 is grass; row 22 is the tree border. The
river path carries on south between the rows to its mouth at (18..19, 22). The east wall runs on to row 20.

```
   0         1         2         3
   01234567890123456789012345678901
15 TT,,,,,,BBBB,................#TT
16 TT,BBB,,BBBB,,,BBB..BBBB,,BB,#TT   Leto, Pella, blue door, bent shutter, Hanru
17 TT,BBB,,BBBB,,,BBB..BBBB,,BB,#TT
18 TT,,,,,,,,,,,,,,,,..,,,B,,,,T#TT   the back lane and the doorsteps; the annex at (23,18)
19 TT,,,,,,BBB,,BBB,,..,,,,,,,,T#TT   Amri (8..10), Senn (13..15)
20 TT,,,,,,BBB,,BBB,,..,,,,,,,,T#TT
21 TTTT,,,,,,,,,,,,,,..,,,,,,,TTTTT
22 TTTTTTTTTTTTTTTTTT..TTTTTTTTTTTT   the river path's mouth (18..19, 22)
```

**What moved:**

- `home.amri` (16,15) -> (9,18) and `home.senn` (24,17) -> (14,18), on the back lane; their aprons `amri_door` and
  `senn_door` move with them. Amri's free doorstep is (10,18) and her pot stands against the west wall; Senn's free
  doorstep is (15,18) and his log pile stands against the east end wall.
- The unnamed houses keep a plain doorstep apron: `blue_door` at (16,15), `bent_shutter_door` at (24,17), with the old
  door stub track as `bent_shutter_door`. The `senn_door` track is now Senn's door east along the back lane to the
  river path; a short `back_lane` track takes Amri's door to the coast path.
- The riverside exit and its mouth move to (18..19, 22); the riverside's arrival is (18,21). The riverside sign
  stands at (20,21), beside the path one cell short of the mouth.
- The coast road sign moves from (13,18) to the new south rim at (12,21), between the two new houses, with its
  `coast_sign` track running on down from the bridge; Saltstep's coast-road arrival is (12,20), north of it.
- The `past_canal` zone runs to row 22; Pella's house stays its one focal piece.

**Not settled:** Amri's and Senn's houses share a row and a size, which the layout rules ask against; the owner's
sketch puts them so.
