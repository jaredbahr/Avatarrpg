# Place brief: `saltstep_market`

**Status (2026-11-17):** stage 3 of `docs/level-design.md`: a grey blockout, waiting for the owner to walk it. The
rows, people and exits are moved; there is no ground art or dressing yet, so the map draws its bare board.

**Owner (2026-11-17):** the open questions are delegated; plan 2, 32 by 18, rise and fall told not shown, no new
track for now.

`blockout: 07c50f3b5b6a9c284b7ce18328ae32471aaf66f988032fc5fc542c68bfc51790` (sha256 of the rows joined by newlines)

**One line:** a market that floats: you walk out over the water on planks to buy your lunch, and the shops move
with the tide.

**Identity (owner):** a noisy fish quay. **Landmark:** the painted tide poles.

## Stage 0: what the story says

Everything in this section is quoted or summarised from the story documents. Nothing here is new.

- "Saltstep is a market on the water. Stalls sit on platforms that rise and drop with the tide. Tall poles show
  the water level in bright paint. Two sellers are arguing from boats that are slowly drifting apart." (Scene 2.2,
  `docs/story/scripts/act2-sparks.md`)
- "A market built around tidal platforms. Bargainers tend to move their boats mid-argument... Every child knows
  the emergency bell pattern." Fishers, dock workers and recently arrived families share the shore. Its "busy
  practicality contrasts with Emberwatch's empty parade ground." (`docs/story/the-common-current-bible.md`)
- **The custom:** a new arrival gets two bowls, one to eat and one to carry to somebody else.
- **The bowl-seller** "stands where the cart stops".
- **Customs** is "a floating stall with a flag, a stool and a brass seal on a chain", moored by a rope that "was
  only looped". It drifts off mid-argument (Scene 2.3) and ends against the freight pontoon.
- **The pole walk:** "the plank walk beside the level poles", with a wedding being argued about and a man selling
  one spoon.
- **Tavi Ren** runs the ferry from the ferry landing; Commonworks "put the lamps in at the Saltstep ferry".
- **A freight office** "with a clean brass plate: Jin. Contracts and Carriage. The shutter is half down."
- **Lantern crates** stacked by the ferry, stamped with a crooked-handle lantern, with a chalked note. The shop
  they belong to is "about forty steps that way".
- **The freight pontoon** is out in the harbour (its own fight map).
- **The ferry leaves at dusk** (Scene 2.9), from a ramp and a mooring post.
- **Return changes:** "fair charter means separate loading lanes and posted rescue priority. Company control means
  faster cargo service and barriers around public landing places. Neither variant erases the market's comedy."

**Not in what I read, so not decided here:** what is sold besides broth; who lives in the houses behind the quay;
where the bell hangs; whether the outreach room (PQ-03) and the courier office are on this map.

## What today's board is

The rows on `main` are a sand quay four cells deep along the top, houses above it, and four jetties into a
harbour that fills the lower half of the map. Of 384 cells, about 150 are open water with nothing on it.

Against the story, that is a **quay with a market on it**, not a market on the water. The tidal platforms, the
pole walk and the boats, which are what make Saltstep itself and not any harbour, are the smallest part of the
board. The dressing passes then filled the quay, the one strip people need to walk, with blocked scatter cells.

## Story

- **Why the player comes here:** the cart's first run out of Ba Dan. First sight of a bigger, louder world; the
  two-bowl custom; the customs stall; the first meeting with Veyra (on the pontoon); the table's first vote.
- **Feeling on arrival:** busy, funny, slightly too much. **On leaving (the ferry, dusk):** quiet, and a little
  uneasy about the lamps across the bay.
- **Later states** (each needs runtime pieces; the baked ground stays the same):
  - customs stall moored -> drifted away (its berth stands empty, the rope left looped on the post);
  - before the vote -> after it (the ferry leaves; the freight clerk's lines change);
  - day -> dusk for the ferry scene (lamps lit at the landing);
  - return, fair charter -> marked loading lanes and a rescue-priority board at the landings;
  - return, company control -> barriers round the public landing places.

## People

Roles only. Names and lines belong to the writing pass.

| Who (role)                           | Lives / works where                  | What they do in a day                  | Why talk to them                  |
| ------------------------------------ | ------------------------------------ | -------------------------------------- | --------------------------------- |
| Bowl-seller (`mq02_bowl_seller`)     | Her stall, where the cart stops      | Cooks, serves, refuses to wash bowls   | Scene 2.2: the custom             |
| Tavi Ren (`mq02_tavi`)               | The ferry landing                    | Waits on the tide, tows drifted stalls | Scene 2.2, 2.3 tow, 2.9 the ferry |
| Freight clerk (`mq02_freight_clerk`) | The freight office on the shore lane | Minds a half-shut office               | Scene 2.2, 2.8                    |
| Customs clerk (`mq02_customs_clerk`) | The floating customs stall           | Counts crates, drifts                  | Scene 2.3                         |
| Two boat sellers                     | Boats in the basin                   | Argue across a widening gap            | Colour; a bark                    |
| Fishers and dock workers             | The racks and the freight side       | Land fish, mend nets, carry            | `PLACEHOLDER (story)`: any lines  |
| Children                             | Under the bell                       | Know the bell pattern                  | `PLACEHOLDER (story)`: any lines  |

## Daily life

- **An ordinary day:** boats come in to the basin and sell from the water; fish is carried from the boats to the
  racks and the stalls; people cross the planks to eat and to argue; freight is carried along the shore lane to the
  freight side; the ferry waits on the tide.
- **Desire lines:**
  - coast road -> the cart stop and the bowl stall (everyone's first stop);
  - cart stop -> the pole walk -> the platforms (the main route);
  - platforms -> the ferry landing -> back along the shore (the loop);
  - boats -> racks -> stalls (short, wet, heavily worn);
  - shore lane -> freight office -> the freight side (carts, so wide and rutted);
  - houses -> the well or pump -> the shore.
- **Stored, made, sold, thrown away:** fish and nets on racks at the water's edge; baskets and crates at the back
  of stalls; rope and floats at mooring posts; fish waste goes in the water at the far end, where the gulls are.

## Shape

### Three plans

1. **Quay street** (today's board). The market runs along the shore and jetties stick out. Easy to walk, but
   every view is the same strip, the water is empty, and it is not the place the story describes.
2. **Out on the water.** The shore is only the way in. A plank walk leads out past the tide poles to a ring of
   platforms round a small basin where the boats trade. The route loops: shore, pole walk, platforms, ferry
   landing, shore. The customs stall floats in the basin where everyone can see it drift.
3. **Two shores.** An inlet splits the market and a bridge joins it. A strong picture, but the bridge is a choke
   point on the party's first big explore map, and it has nothing to do with platforms.

**Chosen: plan 2.** It is the only one where the board is the story's sentence. It turns the dead water into the
middle of the place, gives a loop instead of a strip, and makes the customs stall's drift something you watch
happen across the basin instead of something you are told.

### The plan

```
        coast road                shore lane (carts)             houses run off the top
   ==>  [1 ARRIVAL] ----------- [3 FREIGHT OFFICE] ------------ [well]
            |   cart stop                |                          \
        [2 BOWL STALL]                freight side                [6 FERRY LANDING]
            |                         (pontoon seen                 lamps, crates, ramp
        [4 POLE WALK]  planks          far off, SE)                    |
            |   tide poles, bell                                       |
        [5 THE PLATFORMS] ====== basin: boats, customs stall ==========+
            racks, stalls                 (focal point)
```

- **Focal point:** the basin, with the tide poles standing in it and the customs stall's flag. Seen from the
  arrival view down the pole walk, and from every platform.
- **Entry view:** the coast road levels out; the bowl stall and the cart stop are in front; past them the pole
  walk runs out to the bright poles and the flag. One living thing: the bowl-seller.
- **Views** (about 10 by 5 cells each on an iPad; six named ideas across about eleven screens, the rest being
  open water kept quiet on purpose) and their one idea:
  1. _Arrival:_ the road becomes a town.
  2. _The bowl stall:_ sit down, here is the custom.
  3. _The shore lane:_ the half-shut office with the brass plate.
  4. _The pole walk:_ out over the water, between the poles.
  5. _The platforms:_ the market itself, and the argument across the basin.
  6. _The ferry landing:_ the way onward, under new lamps.
- **Quiet space:** the open basin water in the middle of the ring, and the far harbour beyond the ferry. Both stay
  empty on purpose; the basin is what the platforms look at.
- **Main route:** arrival, bowl stall, pole walk, platforms, ferry landing, shore lane, arrival (a loop).
- **Side paths:**
  - a short jetty off the platforms with a view of the freight pontoon far out -> shows where the second bowl
    goes before the player can get there;
  - a back way between the houses on the shore lane -> a find (see Finds);
  - the far end of the platforms where the waste goes -> gulls, and a find.
- **Edges:** north, the town running off the top (house backs and trees); west, the headland the coast road comes
  down, with the road mouth; south and east, open harbour. No rectangle: the shore curves, and the platforms are
  an uneven ring, not a grid of squares.
- **Exits:** the coast road mouth (west) keeps all three cues. The ferry is a story exit at the landing: the ramp
  and the post make it read as a way out before the story opens it.
- **Size:** **32 by 18** cells, up from 24 by 16: about eleven screens at the real view size, six of them named
  views. When its board is baked it will be the largest top-down board alone, so the perf bench needs new frozen
  limits (ADR 0106) and the region's board budget needs checking.

## Look and sound

- **Culture and materials:** an outer Earth Kingdom harbour town. Stone bases and green glazed roofs on shore;
  weathered plank, rope and painted poles on the water. Four materials: stone, green tile, grey plank, rope.
- **Signature:** the tide poles' bright paint, the only saturated colour on the board. Stalls and boats stay
  muted so the poles and the customs flag carry.
- **Time and weather:** bright day on arrival; dusk for the ferry.
- **Music and sound:** no Saltstep track exists yet (the tracks are Ba Dan, the road and the quarry). A busy
  track suits crossing routes and constant small motion; the ferry at dusk wants it to thin out. Sound sources
  the player can find: water under planks, gulls at the waste end, the bell, the two sellers.

## Set pieces

Pieces marked _have_ are in the art merged with #844; the rest are for the kit list after the blockout.

| Name               | Anchor                  | Belongs with it                                              | Ground under it                        | Whose / why here                      |
| ------------------ | ----------------------- | ------------------------------------------------------------ | -------------------------------------- | ------------------------------------- |
| The bowl stall     | Stall (_have_)          | Bench, stack of bowls, broth pot, an unwashed tub            | Trodden sand, a wet patch by the tub   | The bowl-seller; where the cart stops |
| The cart stop      | Handcart (_have_), post | A sack, a wheel rut                                          | Ruts and a turning patch               | Where the road ends for wheels        |
| A tide pole        | Painted pole (_have_)   | Mooring ring, a looped rope, a ladder                        | Weed line on the pole; ripples         | The town; the landmark, repeated      |
| The customs berth  | Customs stall (_have_)  | Flag, stool, seal on a chain, one crate, mooring post        | Its own floating deck                  | The clerk; it must be able to leave   |
| Fish racks         | Drying rack (_have_)    | Net pile (_have_), baskets (_have_), a gutting board         | Dark wet planks, scales                | The fishers; between boats and stalls |
| A trading boat     | Small boat (_have_)     | Baskets, a pole, an awning                                   | Water, a mooring line                  | The boat sellers; they move           |
| The freight office | Office front            | Brass plate, a half-down shutter, a step                     | Packed apron, cart ruts past the door  | Jin's clerk                           |
| The ferry landing  | Ramp and post           | Dock lamps (_have_), bollards (_have_), coiled rope (_have_) | Worn planks, lamp pools at dusk        | Tavi                                  |
| The lantern crates | Crate stack (_have_)    | The chalked note                                             | Planks; nothing else, so it stands out | Named in the story; by the ferry      |
| The bell           | Bell post               | A rope, a painted board                                      | A worn ring where children stand       | `PLACEHOLDER (story)`: where it hangs |

## Finds

| What draws the eye                      | Where                          | What the player gets             | What it should reveal (a need for the writing pass) |
| --------------------------------------- | ------------------------------ | -------------------------------- | --------------------------------------------------- |
| The pontoon, small and far across water | End of the side jetty          | A view; the second bowl's errand | Nothing new: it points at Scene 2.4                 |
| A gap between houses with washing in it | The shore lane's back way      | A short cut back to the arrival  | `PLACEHOLDER (story)`: who lives here               |
| Gulls on a post                         | The waste end of the platforms | A discovery spot                 | `PLACEHOLDER (story)`: something about the tide     |

## Things the blockout must settle

- **Ids stay.** The map id, the five NPC ids, the arrival trigger and the west exit keep their ids; only positions
  move. Ba Dan's exit points at a cell here (`toPos`), so that pair moves together.
- **Saves.** RG-02 is on `main`. Before the rows change, check what a save holds for the party's position on this
  map and how it recovers if that cell is no longer walkable. I have not verified this.
- **The arrival trigger** covers a whole column so no route slips past it; the new shape needs the same guarantee.
- **The customs stall must be a runtime piece,** not baked, because it leaves.
- **Walkable water.** Platforms and planks are wood cells; the basin is deep water. Boats are scenery on water.
- **Blocked cells come from this plan only:** buildings, stall bodies, racks, posts, boats. No scatter cells. The
  `n` and `u` cells on today's quay go.

## Blockout v1 findings (2026-11-17)

- **The entry view missed the pole walk.** It showed the bowl stall and a house; the walk started at row 8, off the
  bottom of the screen.
- **The quay was too deep.** Four rows of sand across the whole width still read as the main place.
- **The real view is about 10 by 4.7 cells,** not 10 by 7: the header, objective box and dock take about a third of
  the screen height.

Blockout v2 thins the quay to two rows, roots the pole walk at row 7, moves everything below up one row, and adds
an arrival shot that frames the first view lower. The board stays 32 by 18; the two bottom rows are open water.

## What the blockout review should ask

Walk it grey, at the explore zoom, and answer one at a time:

1. From the coast road, does the pole walk pull you out onto the water, or do you drift along the shore?
2. Does each of the six views have its one idea, or is one empty and the next crowded?
3. Is the loop (shore, pole walk, platforms, ferry landing, shore) a good length, or a trudge?
4. Is the basin the right size to watch the customs stall drift across?
5. Is the shore lane worth walking, or should the freight office come closer to the quay?
6. Does the side jetty earn its place before the pontoon can be seen from it?
