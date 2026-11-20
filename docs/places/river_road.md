# Place brief: `river_road`

**Status (2026-11-20):** stages 0 to 5 of `docs/level-design.md`. The owner answered the brief, approved the blockout
(#922, "layout's right") and the ground (#923, its own countryside tiles), and left the plan to the designer: "I would
rather take time to do it correctly and well than rush something easy and poor looking." Plan 1 is taken. Stage 5 places
the set pieces as boxes (`src/content/scenes/riverRoad.setpieces.ts`, `?boxes` on a dev build); the kit list it implies
is at the end. No set-piece art exists yet.

**One line:** the cart's day-long road up the river from the coast to Causeway, with a plank bridge someone has put a
pole across, and at the far end a place to pull off and see three valleys at once.

## Stage 0: what the story says

Quoted or summarised from the story documents. Nothing here is new.

- **Where it runs:** "Upriver, Causeway City stands where the inland roads and river meet." "A day from coast to
  Causeway." (`docs/story/the-common-current-bible.md`, Geographic premise.) Saltstep is at the river mouth,
  Emberwatch on the bay's eastern shore.
- **When it is walked:** the end of MQ-03. Bo-shan: "Causeway's a day up the river road, if Parcel agrees it is."
  (Scene 3.9, `docs/story/scripts/act2-sparks.md`.) MQ-04 opens in Causeway (Scene 4.1). PQ: "The cart leaves in
  the morning. We're a day up the river road by Thursday." (`personal-quests-1.md`.)
- **SF-2.3, the bridge toll:** "six guards from another quarry on the supply-control list, with a corporal. **Where:**
  a plank bridge on the river road. **Why:** unpaid for two months, like Ruon's were. They have put a pole across the
  bridge and are asking a 'toll' in food." Win: the pole comes up, and they walk to the kitchen with the late shelf.
  Carry on: they take one sack of cabbages and wave the cart through.
- **Scene 5.6, Act II's close:** "The cart is pulled off the river road where you can see all three valleys at once:
  rust-red hills to the left, a silver flatness of marsh to the right, and straight ahead, the heights, with their
  heads in cloud." A meal on the tailgate, and the table's vote on which road first. "Outside Causeway."
- **Act III (Scene 9.8):** "At the river road, six of the Marshal's people are standing round the cart." Parcel sits
  down in the road; Bo-shan says Parcel likes his feed "at the third stop of the day, in the shade".
- **The echo cutscene** counts four rings on water in every game: "the harbour, the cistern, the canal, the river
  road" (`cutscenes.md`). The river road has a place where a ring is made on the water.
- **Act IV:** "Veyra's mother, Meren Sen, is on the road to Causeway" (`docs/story-outline.md`). Not necessarily this
  map.

**Not in the story, so asked, not decided:** who lives along the road; what the river is called; whether there is a
village, an inn or a waystation; which side of the river the road runs; where exactly the Act III stop happens (it
may be Causeway's own end of the road). See open questions.

## Story

- **Why the player comes here:** the journey between Act II's coast and its city. The cart leaves the places the
  party knows. The first half of the road is still the coast's; the far end looks into the rest of the game.
- **What it was before:** a carters' road beside a river, older than the new works. PLACEHOLDER (story): anything
  else about its past.
- **Feeling on arrival:** open, a long way to go. **On leaving (the lookout):** the world is bigger than the bay.
- **Later states:**
  - before SF-2.3 -> the pole across the bridge and the guards' camp; after a win -> pole up, camp gone; after Carry
    on -> pole up, one cabbage sack by the cold fire.
  - Act II's close (Scene 5.6) -> the cart pulled off at the lookout, the meal laid on the tailgate, evening light.
  - Act III (Scene 9.8) -> the Marshal's people round the cart, Parcel sitting in the road (if it is set here).

## People

Roles only. Names and lines belong to the writing pass.

| Who (role)                    | Lives / works where      | What they do in a day                       | Why the player would talk to them |
| ----------------------------- | ------------------------ | ------------------------------------------- | --------------------------------- |
| Bo-shan (or Dorin) and Parcel | The cart, on the road    | Drive; stop at the third stop for the shade | The trip's company; Parcel's stop |
| The corporal and six guards   | A camp at the bridge     | Hold the pole, wait, go hungry              | SF-2.3                            |
| Travellers on the road        | Passing both ways        | Carry, herd, cart goods to Causeway         | `PLACEHOLDER (story)`: any lines  |
| Someone who works the river   | A landing below the road | Fish, ferry, or tend a weir                 | `PLACEHOLDER (story)`: who        |

## Daily life

- **An ordinary day:** carts pass toward Causeway in the morning and back in the evening; animals are watered at the
  river; carters stop in the shade at the same places every trip; someone works the river from a landing.
- **Desire lines:**
  - road west (Emberwatch side) -> the bridge -> road east (Causeway side): the main route, rutted and wide;
  - road -> the shade stop -> road (carts pull off and back; a worn loop);
  - road -> the river landing (a narrow footpath down the bank);
  - road -> the lookout (a short side track off the road near the east end).
- **Stored, made, thrown away:** the guards' camp by the bridge (a cold fire, bedrolls, the toll pole); a
  water trough or a watering place at the stop; rubbish nobody collects at the camp.

## Shape

### Three plans

1. **The river road straight.** West to east along the river's north bank, the river along the south edge. A side
   stream comes down from the hills and joins the river; the plank bridge carries the road over it in the middle. A
   ford a little downstream is the way round (layout rule F4: a choke with a way round). The lookout is a rise at the
   east end where the road bends into Causeway. One clear route, readable at once, but long and even.
2. **Down to the river and up again.** The road drops from the coast hills to the river, crosses on the bridge, and
   climbs a switchback to the lookout ridge. A strong shape with a real climb and a reveal at the top, but the climb
   needs elevation tiers across most of the board, and the bridge would be the only crossing.
3. **Road and towpath.** The road runs above the river on a bank; a towpath runs along the water below it, joined by
   two ramps. The bridge is on the road; the towpath fords the side stream. Two routes and a loop, but two parallel
   strips read like a corridor twice, and the towpath has no story.

**Chosen: plan 1, with one bend.** It is the story's sentence: a road beside a river, a bridge with a pole on it,
a place to look out at the end. The ford gives the fight its way round. A single bend before the lookout keeps the far
end hidden until you reach it, so the three valleys are a reveal (the one thing plan 2 did better).

### The plan

```
   hills, trees, rocks (north edge)                               the heights (far, in cloud)
  ==> [1 FROM THE COAST] --- [2 THE SHADE STOP] --- [3 THE BRIDGE] --- [4 THE BEND] --> [5 THE LOOKOUT] ==> Causeway
       road leaves the bay     trough, big tree,     pole, guards'       road turns       rise off the road:
                               Parcel's stop          camp; side stream   north            three valleys
                                      |               comes down               \
                               [river landing]        [ford, downstream]      [the river widens]
   ======================== the river (south edge), wide and slow ========================================
```

- **Focal point:** the bridge with the pole across it, seen from the shade stop as you come over a slight rise.
- **Entry view:** the road coming in from the bay side, the river opening out to the south, the shade stop's big
  tree ahead. One living thing: a traveller or an animal at the trough.
- **Views** (about 10 by 7 cells each) and their one idea:
  1. _From the coast:_ the bay is behind you.
  2. _The shade stop:_ Parcel's tree, the trough, the path down to the river landing.
  3. _The bridge:_ the pole, the camp, the side stream, the ford downstream.
  4. _The bend:_ the road turns away from the river; the far end is hidden.
  5. _The lookout:_ the land opens: rust hills, silver marsh, the heights in cloud.
- **Quiet space:** the river itself, wide and empty along the whole south edge; and the open sky at the lookout.
- **Main route:** west mouth, shade stop, bridge, bend, east mouth (Causeway).
- **Side paths:** the river landing (hook: a figure on a landing; reward: a find and the river ring); the ford (hook:
  stepping stones in the side stream; reward: the way round the bridge, and a find on the far bank); the lookout
  (hook: a worn track off the bend; reward: the view, and Scene 5.6's spot).
- **Edges:** north, wooded hills rising off the map (trees and rocks, a cliff face where the road bends); south, the
  river, deep and wide; west, the road mouth back toward the coast; east, the road mouth into Causeway.
- **Exits:** west to Emberwatch or the coast (which map is an open question), east to Causeway (not built yet). Both
  keep the three exit cues.
- **Size:** five views in a row, about **40 by 14** cells. The widest board yet, though not the largest by area
  (Saltstep's plan is 32 by 18). The perf bench needs a measurement (ADR 0106), as Saltstep's plan does.

## Look and sound

- **Culture and materials:** outer Earth Kingdom countryside between the coast and the city. Packed earth road,
  grey river stone, weathered plank, green tile on any roof. Four materials: earth, stone, plank, green tile.
- **Signature:** the pole across the bridge (red-and-white, a borrowed road barrier?) while it is there; after, the
  lookout's view. `PLACEHOLDER (owner)`: the road's own lasting mark, for example milestone posts with Causeway's
  distance.
- **Time and weather:** bright morning at the west end; Scene 5.6 is evening at the lookout.
- **Music and sound:** the road track (Act I's Forest Road track belongs to RG-01, ADR 0111 §4, so not borrowed).
  Local sounds: the river, cart wheels, the stream under the bridge, birds in the trees.

## Fight needs (SF-2.3)

- **Battle intention in one line:** get the pole up: the guards hold the bridge, and the ford is the way round.
- **What the terrain offers each side:** the guards have the bridge (a choke) and the camp's crates as cover; the
  party has the ford to flank, and the far bank's rocks. Deep river on one side bounds the fight.
- **What reacts:** the side stream's water (lightning, ice); the camp's cold fire (fire relights it).
- **Board:** a combat crop of view 3 (the bridge, the stream, the ford, the camp), about 19 by 12, as the freight
  pontoon is its own board. Open question: a crop board, or fight on the explore map itself.

## Set pieces

| Name              | Anchor                 | Belongs with it                         | Ground under it                     | Whose / why here               |
| ----------------- | ---------------------- | --------------------------------------- | ----------------------------------- | ------------------------------ |
| The plank bridge  | Bridge over the stream | Rails, the pole across it               | Ruts on the planks, worn approaches | The road's; the toll is on it  |
| The guards' camp  | Cold fire              | Bedrolls, a pot, crates, the toll sign? | Trampled grass, ash                 | The corporal's six             |
| The shade stop    | A big old tree         | Trough, a bench or log, a hitching post | A worn pull-off loop, hoofprints    | Carters; Parcel's third stop   |
| The river landing | A small jetty          | A boat, a net or a weir post            | Wet mud, a footpath down the bank   | `PLACEHOLDER (story)`: whose   |
| The ford          | Stepping stones        | Shallow water, a fallen log             | Gravel bars                         | The way round                  |
| The lookout       | A flat rock or a bench | A milestone, a wind-bent tree           | A worn patch where carts pull off   | Everyone stops here; Scene 5.6 |

## Finds

| What draws the eye              | Where             | What the player gets     | What it should reveal (a need for the writing pass) |
| ------------------------------- | ----------------- | ------------------------ | --------------------------------------------------- |
| A ring spreading on still water | The river landing | The echo cutscene's ring | `PLACEHOLDER (story)`: what makes it                |
| Something left on the far bank  | Past the ford     | A discovery spot         | `PLACEHOLDER (story)`: the guards' quarry, or home  |
| The view from the rock          | The lookout       | The three valleys, named | The three spokes, before the vote                   |

## Decisions (owner, 2026-11-20)

1. **Plan:** left to the designer, with the rule that quality comes before speed. Plan 1 (straight, one bend).
2. **Size:** about 40 by 14, five views.
3. **SF-2.3:** a 19 by 12 crop board of the bridge section.
4. **Region:** RG-02 for now; its east exit waits for Causeway (RG-03).
5. **The west end** (the designer's call, not asked): Scene 3.9 puts the cart on the road's west end, and the west
   mouth walks back to Emberwatch's parade ground. Emberwatch's rows do not change for it.
6. **Layout (#922)** and **ground (#923):** approved as built.
7. **Set pieces (stage 5):** the placement is approved as boxed ("placement's right").
8. **Art (stage 6):** the whole kit, in batches; RG-02's credit cap rises from 1,700 to 1,850 for it. Each batch is
   checked at 3x and the kit is shown beside Kaya before anything ships.
9. **The bend's cliff:** a rock face baked into the plate, not a sprite. One face system in the RG-02 baker raises
   both the cliff and the lookout rise (and serves later terraced maps); the kit list's cliff sprite (#19) is dropped.

## Open questions (stage 5)

1. ~~The bend's cliff~~: answered, decision 9.
2. **The landing's owner:** the boat and the drying net say someone fishes or ferries from the landing.
   `PLACEHOLDER (story)`: who, and whether they are there by day (stage 7, life).
3. **The toll pole's look:** red-and-white, a borrowed road barrier (the brief's signature), or a plain peeled pole? The
   kit list prices one pole in two states.

## Kit list (stage 5)

The set pieces are placed as labelled boxes: `src/content/scenes/riverRoad.setpieces.ts` (8 set pieces, 33 members
besides the rim's 48 trees, five zones with one focus each), checked by `src/content/setPieces.test.ts` and drawn in the
game with `?boxes` on a dev build. This is every piece of art that plan needs, and nothing it does not. **Sizes are the
plan's, in px**: width is the footprint (40 px a cell), height is the plan's height in figures (1 figure = 45 px).
Credits are the guide's costs (object about 5, house-sized about 9; `docs/level-design.md` section 7) for a first take,
and 0 where existing art serves. No art is generated yet.

| #   | Art                                              | Used by (members)                            | Size px (w x h) | Existing art (native px)                                                                   | Credits |
| --- | ------------------------------------------------ | -------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------ | ------: |
| 1   | Hill tree, pine and broadleaf                    | `rim_trees` (48)                             | 40 x 99         | Ba Dan valley `tree_pine` 38 x 81, `tree_broadleaf` 38 x 54 (`objects_bd20`): same country |       0 |
| 2   | Big old shade tree, wide canopy                  | `shade-tree`                                 | 80 x 117        | none (Ba Dan's trees are a third of its size)                                              |       5 |
| 3   | Water trough                                     | `shade-trough`                               | 40 x 27         | `trough_ek` 46 x 23 (`objects_bd20`), `water_trough` 55 x 26 (`objects_rg02`)              |       0 |
| 4   | Log to sit on                                    | `shade-log-bench`                            | 64 x 20         | `crew_bench` 46 x 21 (`objects_bd20`) is a plank bench, not a log                          |       5 |
| 5   | Hitching post                                    | `shade-hitching-post`                        | 10 x 40         | none (`gate_post` 30 x 69 is twice too big)                                                |       5 |
| 6   | Plank bridge with both rails                     | `bridge-deck`, `bridge-rail-north`, `-south` | 80 x 96         | none                                                                                       |       9 |
| 7   | Toll pole, lowered across the deck               | `bridge-toll-pole`                           | 12 x 72         | none                                                                                       |       5 |
| 8   | Toll pole's post, with the pole raised (edit #7) | `bridge-pole-post`; the after-SF-2.3 state   | 16 x 45         | none                                                                                       |       5 |
| 9   | Cold fire: a ring of stones and ash              | `camp-cold-fire`                             | 40 x 20         | `firewood` 39 x 29 (`objects8`) is a woodpile, not a fire                                  |       5 |
| 10  | Crate stack                                      | `camp-crates-west`, `camp-crates-east`       | 40 x 40         | `crate_stack` 26 x 50 (`objects_rg02`)                                                     |       0 |
| 11  | Bedroll (one sprite, flipped)                    | `camp-bedroll-1` to `-3`                     | 40 x 20         | none                                                                                       |       5 |
| 12  | Rubbish heap                                     | `camp-rubbish`                               | 40 x 20         | none                                                                                       |       5 |
| 13  | Cooking pot                                      | `camp-pot`                                   | 16 x 16         | `cookpot` 41 x 36 (`objects8`) is two and a half times too big                             |       5 |
| 14  | Hand-lettered toll sign on a stake               | `camp-toll-sign`                             | 24 x 40         | `warning_sign` 16 x 34 (`objects_rg02`), if it reads as hand-lettered                      |   0 (5) |
| 15  | Stepping stones across the stream                | `ford-stones`                                | 80 x 40         | none                                                                                       |       5 |
| 16  | Fallen log in the stream                         | `ford-log`                                   | 80 x 24         | none                                                                                       |       5 |
| 17  | Boulder                                          | `ford-boulder`, `far-bank-boulder`           | 40 x 36         | `boulders` 42 x 25 (`objects_rg02`), `lime_boulder` 40 x 36 (`objects13`)                  |       0 |
| 18  | Driftwood                                        | `far-bank-driftwood`                         | 40 x 16         | none                                                                                       |       5 |
| 19  | The bend's cliff (see open question 1)           | `bend-cliff`                                 | 200 x 72        | `rock_spur` 67 x 48 (`objects_rg02`) stands in today                                       |       9 |
| 20  | Fallen rock at the cliff's foot                  | `bend-cliff-foot`                            | 120 x 45        | `rock_spur` 67 x 48, `shore_rocks` 42 x 23 (`objects_rg02`)                                |       5 |
| 21  | Small country jetty, with its mooring post       | `landing-jetty`, `landing-mooring-post`      | 120 x 40        | `jetty` 46 x 41 (`objects_rg02`) is a harbour jetty a third the length                     |       5 |
| 22  | Rowboat, side-on                                 | `landing-boat`                               | 88 x 18         | `rowboat` 38 x 40 (`objects_rg02`), if it reads lying along the bank                       |   0 (5) |
| 23  | Net drying on two poles                          | `landing-net-rack`                           | 64 x 40         | `net_pile` 47 x 30 (`objects_rg02`) is a heap, not a rack                                  |       5 |
| 24  | Flat rock to sit on                              | `lookout-rock`                               | 56 x 20         | none                                                                                       |       5 |
| 25  | Milestone                                        | `lookout-milestone`                          | 16 x 27         | none                                                                                       |       5 |
| 26  | Wind-bent tree                                   | `lookout-tree`                               | 40 x 90         | none                                                                                       |       5 |

**Later states** (the brief's): after SF-2.3's Carry on, one sack of cabbages by the cold fire (40 x 30, new, 5); after a
win, the camp's crates, bedrolls, fire and rubbish are gone (no art); Scene 5.6 stands Parcel's cart at the lookout
(`parcel_cart`, existing, 0).

**Total:** 26 pieces for the plan, 20 of them new at about 108 credits for a first take (113 with the cabbage sack, and
up to 123 if the sign and the boat do not serve). RG-02's cap stands at 1,700 with 1,599 spent, so the kit needs the
owner's credit OK before stage 6.

## The kit as made (stage 6)

The owner raised RG-02's cap to 1,850 on 2026-11-20. Every new piece was made once with `create-object-pro-flash`
(`prototypes/topdown/tools/rrobj.py`, seed 3), with a second take at seed 11 for the jetty, the bent tree and the bedroll (seed 3's read as a barrel or a chest); the
takes are cleaned by `tools/rrproc.py` into `prototypes/topdown/assets/objects_rr/` (alpha cut at 128, trimmed,
`manifest.json` naming each piece's job, seed and credits), and the RG-02 baker looks there after the region's own
folder. **Spent: 130 credits over 25 jobs** (the ledger's `rg02_obj_rr_*`), against about 113 planned.

| Art (# above)               | Shipped as                              | Take chosen | Native px |      Credits |
| --------------------------- | --------------------------------------- | ----------- | --------- | -----------: |
| Hill trees (1)              | `tree_pine`, `tree_broadleaf` (bd20)    | existing    |           |            0 |
| Shade tree (2)              | `shade_tree`                            | seed 3      | 80 x 106  |            6 |
| Water trough (3)            | `trough_ek` (bd20)                      | existing    |           |            0 |
| Log bench (4)               | `log_bench`                             | seed 3      | 60 x 29   |            5 |
| Hitching post (5)           | `hitching_post`                         | seed 3      | 15 x 35   |            5 |
| Plank bridge (6)            | `plank_bridge`, over water on the plate | seed 3      | 80 x 65   |            6 |
| Toll pole, lowered (7)      | `toll_bar_down`; `toll_bar_across`      | seed 3      | 71 x 27   |            5 |
| Toll pole, raised (8)       | `toll_bar_up` (not placed: SF-2.3)      | seed 3      | 22 x 74   |            5 |
| Cold fire (9)               | `cold_fire`                             | seed 3      | 42 x 30   |            5 |
| Crate stack (10)            | `crate_stack` (rg02)                    | existing    |           |            0 |
| Bedroll (11)                | `bedroll`, one flipped                  | seed 11     | 43 x 21   | 10 (2 takes) |
| Rubbish heap (12)           | `rubbish_heap`                          | seed 3      | 37 x 30   |            5 |
| Cooking pot (13)            | `cook_pot`                              | seed 3      | 26 x 29   |            5 |
| Toll sign (14)              | `toll_sign` (new: hand-lettered)        | seed 3      | 24 x 41   |            5 |
| Stepping stones (15)        | `stepping_stones`                       | seed 3      | 82 x 12   |            5 |
| Fallen log (16)             | `fallen_log`                            | seed 3      | 79 x 37   |            5 |
| Boulder (17)                | `boulders` (rg02)                       | existing    |           |            0 |
| Driftwood (18)              | `driftwood`                             | seed 3      | 33 x 17   |            5 |
| Cliff (19)                  | dropped: a baked rock face, later       |             |           |            0 |
| Rock at the cliff foot (20) | `rockfall`                              | seed 3      | 58 x 34   |            6 |
| Country jetty (21)          | `country_jetty`, over water             | seed 11     | 115 x 32  | 12 (2 takes) |
| Rowboat (22)                | `river_rowboat` (new: lies along bank)  | seed 3      | 72 x 31   |            5 |
| Net rack (23)               | `net_rack`                              | seed 3      | 60 x 42   |            5 |
| Flat rock (24)              | `flat_rock`                             | seed 3      | 48 x 22   |            5 |
| Milestone (25)              | `milestone`                             | seed 3      | 19 x 28   |            5 |
| Bent tree (26)              | `bent_tree`                             | seed 11     | 39 x 95   | 10 (2 takes) |
| Cabbage sack (later state)  | `cabbage_sack` (not placed: SF-2.3)     | seed 3      | 37 x 44   |            5 |

- **The lowered pole** runs along the deck, top to bottom of the picture, which the take (`toll_bar_down`, the arm
  running sideways) does not draw; `toll_bar_across` is cut from it in code (the arm turned a quarter and stood on its
  crate) as a stand-in until a retake.
- **The bridge and the jetty** lie over water: the plate paints the `w` cells as water and the pieces carry the planks,
  while the map still reads them as deck, so the party walks across.
- **The lookout's bent tree** grows from the last grass at the rise's west foot (34, 0), since no tree roots on the
  rise's rock where the plan's box put it.
- The cliff's rows keep `rock_spur` stand-ins until the baked rock face replaces them; `rockfall` is one piece along
  the cliff's foot.
