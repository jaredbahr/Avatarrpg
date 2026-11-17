# Place brief: `ba_dan_village`

**Status (2026-11-17):** stages 0 to 2 of `docs/level-design.md`, waiting for the owner's yes. No rows, layout or
art are changed by this brief. Story facts are the writing pass's; every gap is a marked placeholder or a question.

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
  past the canal": the blue door and the house with the bent shutter (`sq03GaosLedger.ts:50`).
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

| Who                     | Lives                                           | Works / stands                        | Why talk to them                                 |
| ----------------------- | ----------------------------------------------- | ------------------------------------- | ------------------------------------------------ |
| Mira (`elder_mira`)     | Her house on the square                         | The table under the awning            | Mira's table; the epilogue; the rubbing          |
| Gao (`shopkeeper_gao`)  | Behind his shop                                 | Shop front, the trough, the storeroom | Supplies; the plant chair; SQ-03                 |
| Pella (`kid_pella`)     | Her house past the canal (with Bo-shan)         | The court; the table bench            | Tips; SQ-01; the reunion                         |
| Dorin (`guard_dorin`)   | `PLACEHOLDER (story)`: which house              | The gate post; the handover           | Directions; SQ-02; the watch book                |
| Hanru (`guard_hanru`)   | `PLACEHOLDER (story)`: which house              | The gate at night; the hut            | The night watch; the fish prints                 |
| Bo-shan, Leto, Amri     | Past the canal (`home.*` anchors)               | The welcome crowd; recovery spots     | The return                                       |
| Hesra                   | **The mason's yard** (story) - today a rim door | The yard                              | The boot (C-30)                                  |
| Pella's household adult | With Pella                                      | The court and yard                    | `PLACEHOLDER (story)`: stand-in until Nala comes |
| Relief watch            | -                                               | The gate at midday                    | Colour                                           |

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
  5. _Past the canal:_ the quarry houses' doorsteps, the blue door, the bent shutter.
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
- **Size:** eleven views, about **32 by 20** cells, up from 24 by 16. Ba Dan is the hub players return to across the
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

## Open questions for the owner

1. Is "the table at the crossing" (plan 2) right?
2. Is a bigger Ba Dan (about 32 by 20, eleven views) fine?
3. May the awning's patched cloths be the village's one strong colour?
4. Should the hillside to the quarry show above the village (the north rim), so the quarry is always "up there"?

## Questions for the writing pass

1. Whose are the vegetable gardens, the tea terrace, the wash steps, and the south-east and north-east houses?
2. Hesra lodges at the mason's yard (`return.ts:255`) but her anchor is a south rim door: move her to the yard?
3. Which houses are Dorin's and Hanru's? Is "the gate" a real gate across the road or a post beside it?
4. Where is the school, if Ba Dan has one, and where does the village's one bell hang?
5. What lies past the west ford, and when does it open?
