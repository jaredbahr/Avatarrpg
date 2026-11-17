# Level design in Four Nations Tactics

How to design and build a map here, from a story beat to a finished, dressed, playable board.

Read `docs/level-design-core.md` first: it holds the method (the eight stages, the place brief, and the layout,
ground, placement, cohesion, life and fight rules). This file is the addendum for this game: its numbers, its
files, its checks, and an honest account of where the current pipeline falls short. Where the two disagree, this
file wins.

**Status (2026-11-17):** proposed, waiting for the owner's yes. Nothing in the pipeline has been changed to match
it yet. The validators in section 9 are specifications, not code.

Also required before map work: `docs/art-lessons.md`, `docs/player-view-target.md`, ADR 0103 and ADR 0104.

## 1. What is wrong today, plainly

- **The order is backwards.** Objects are generated, then cells are found for them. No map has a written
  statement of what the place is.
- **Rows are drawn as rectangles for gameplay, then decorated.** Ba Dan is two rows of 4x3 and 4x4 house blocks,
  a straight canal and a straight two-cell road across a 24x16 box.
- **Dressing has started to change the rules.** The RG-02 boards in pull request #844 add blocked cells (`n`, `u`)
  across the market so scatter has somewhere to stand, because a solid piece must stand on a blocked cell. That is
  the backwards order written into collision. Core rule: blocked cells are decided at the blockout.
- **"Ba Dan-level density" was read as a count.** The market went from 19 to about 77 standing pieces over six
  density passes. The owner's complaint that day was object placement. Density here now means: detail at edges and
  around work, with resting ground between (core section 7).
- **Every object is generated alone,** so palette, detail and scale differ piece to piece.
- **The ground reacts to houses only.** The baker gives a house an apron, a doorstep and a skirt, and gives objects
  a foot kit of tufts and pebbles. Nothing else changes the ground: no path to a well, no wear at a stall, no wet
  at a trough. Aprons and wear are code inside each board script, not data.
- **A board is a hand-written script of 400 to 1,150 lines.** The trial log calls this the biggest art-pipeline
  cost in hours. It also means every ground idea is re-coded per board.
- **A baked plate cannot change with the story,** and an exit cannot be added without a re-bake. Later states
  have to be planned before the bake.

**Keep:** rows as the rules authority; `validateTopDownLayout`; the baked ground with static shadows; the house
apron and the foot kit; residents and routines; the measured art rules; the credit ledger; the owner judging in
motion.

**Missing entirely:** a place brief; desire lines as data; set pieces as data; a ground-change (apron) layer as
data; a top-down scale chart; a way to see a region's whole kit together; a documented view size; a general
answer for later states on a baked board.

## 2. This game's numbers

| Thing                        | Value                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| Cell                         | 40 world px                                                                        |
| Character                    | 48 px canvas, 8 directions                                                         |
| Terrain                      | 32 px Wang tiles, per-pixel edges                                                  |
| Explore zoom                 | 120 CSS px a cell (80 on a viewport under 540 px wide), snapped to integer zoom    |
| **One explore view (iPad)**  | about 8.5 to 11.5 cells wide by 6.5 to 8.5 high, before the header and dock        |
| Combat zoom                  | 80 CSS px a cell: about 13 to 17 by 10 to 13 cells, so a 20x12 board scrolls a bit |
| Map size allowed             | 4 to 64 cells a side                                                               |
| Today's maps                 | explore 24x16 (the riverside 36x24); combat 20x12 or 19x12                         |
| Light                        | upper left; shadow `#322125`; cast to the lower right, 12 to 24 px                 |
| Per-region limits (ADR 0111) | boards 1.5 MiB, JS chunk 40 KB gz; size budgets may be raised with an ADR note     |

**Use 10 by 7 cells as "one view"** for every rule in the core that says "per view". A 24x16 map is therefore
about five views, and each needs its own idea and landmark.

The view size is computed from `exploreTilePx` (`src/render/projection.ts`) and typical iPad viewports; it is not
yet written down or tested anywhere. Measure it on the device before relying on it.

**Going bigger.** The owner is fine with bigger places. Do it by adding views that each have an idea (core L16,
L17), not by stretching a plan. A town of six to nine views (about 30x21 to 40x28) is a reasonable step. Past
that, split into districts joined by a pinch point (a gate, a bridge, a stair) or into two maps. Before growing a
board: run the perf bench (`scripts/perf/core-bench.test.ts`, pinned to the largest board), check the region's
board budget, and remember the local map (`LocalMapDialog`) is opened by a button, so orientation must come from
landmarks first.

## 3. The stages in this repository

| Stage            | Where it lives                                                                                               | Checked by                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| 0 Intake         | `docs/story-bible.md`, `docs/story-outline.md`, the region's story file                                      | The writing pass owns the words; leave marked placeholders              |
| 1 Brief          | `docs/places/<map id>.md` (new folder), from the core's template                                             | Owner's yes                                                             |
| 2 Plan           | In the brief: three plans, the chosen one, desire lines, views                                               | Core section 5                                                          |
| 3 Blockout       | Rows and legend: `src/content/maps/*.ts` or `src/content/regions/<region>/maps.ts`; spawns, exits, edges     | `content.test`, `edgeContract.test`, the region's `reach.test`          |
| 4 Ground         | `src/content/scenes/<map>.topdown.terrain.ts` (roads, courts, beds, tracks, mouths)                          | `pack-ground.test` (straight edges, halo, shade)                        |
| 5 Set-piece plan | `src/content/scenes/<map>.topdown.ts` or `regions/<region>/layouts.ts`, pieces as plain boxes first          | `topdownLayout.test`; the owner's second look                           |
| 6 Art            | `prototypes/topdown/tools/*.py`, `scripts/art/topdown/boards/*.ts`, `pack-ground.ts`                         | `art:validate`, `props-seating.test`, the ledger audit, the kit picture |
| 7 Life           | `src/content/residents/`, `maps/discoveries.ts`, map `npcs`, `props`, `triggers`, `ambience`, scene emitters | `routines.test`, `discoveries.test`, `topdownAmbience.test`             |
| 8 Review         | `npm run ci:local`; the screenshot gallery; clips and crops outside the repository                           | Core section 11; owner's yes                                            |

**The blockout already has a home.** A top-down map with no scene draws its bare board from the legend, which is
exactly a grey blockout. Walk that with the real camera before anything else exists.

**Decide at the blockout, because the bake fixes them:** every exit and its rim mouth, every blocked cell, every
spot a later state will need, and where each resident stands at each phase of the day.

**Content ids are forever.** A reworked map keeps its id and the ids of its NPCs, triggers and exits. Run
`npm run ids:ledger` after adding content; rename only through `src/content/idAliases.ts`. Before changing the
rows of a shipped explore map, check what a save holds for the party's position on it; I have not verified this.

**Who does what** (the routing in `CLAUDE.md`):

- **Claude:** stages 0, 1, 2 and 5, art judgment in 6, and the review in 8.
- **Codex** (a `codex-ready` issue with the brief attached): turning an approved plan into rows that pass the
  contracts; validators from section 9; terrain-classifier wiring.
- **DeepSeek:** measuring reports, test scaffolds, data edits from a table in the brief. Never art, never
  player-facing words.

## 4. Layout rules for this game

These add to core section 5.

- **No box.** The map's outline is the land's outline. The rim is a cliff over the void with trees inside the lip
  (ADR 0103); let it bite in and bulge out so no side is a straight run. The `T` border one cell thick on all four
  sides, as in Ba Dan's rows, is the box showing through.
- **No house blocks in rows.** Vary building footprints (3x2, 4x3, 5x3, an L), set them back by different amounts,
  and turn them to face what they serve. Two buildings never share both a row and a size.
- **Roads bend.** A road is drawn as a polyline in the terrain classifier, not as a straight run of `=`. Mark the
  walkable road cells in the rows after the bend is chosen; a two-cell main route is the minimum (a 48 px figure
  on 40 px cells needs it).
- **Water wanders.** A canal may be straight because people dug it; then it has a made edge, a kerb and steps. A
  stream is never straight.
- **Every party has a route.** No path is gated on one element without another way (non-benders are first-class).
- **Exits** already must be rim mouths with road running out (the layout validator). Add the third cue from core
  L14: the mouth is the emptiest, lightest patch on that side.
- **The arrival.** Use `arrivalShot` to frame the entry view the brief describes.
- **Rest spots, anchors and slots are layout.** A resident's work anchor is chosen with the set piece it belongs
  to, not afterwards.

## 5. Ground rules for this game

These add to core section 6.

- **One shared map** (core G1) is the terrain classifier. Put desire lines there as named tracks, as Ba Dan's
  `RIVER_TRACK` already does for one path, so the baker wears them and the placement checks keep objects off them.
- **Every anchor gets an apron,** not only houses. Until aprons are data (section 9), add them per board in the
  bake beside `houseApron`: a wet stone ring at a well, trampled earth before a stall, chips at a woodpile, a dark
  damp strip under a trough or along a quay edge.
- **Calm the ground.** Speckled sand and gravel compete with objects. Plain ground uses few tones at low contrast;
  detail (pebbles, tufts) gathers at the feet of things and at edges. No per-tile variant swaps on flat floors
  (`art-lessons.md`).
- **Soil for roots.** Trees and bushes stand in a soil bed (`BEDS`), never on paving, a kerb or a cliff edge. The
  validator holds part of this already.
- **Do not notch the ground for an object.** Let it stand on a patch (`art-lessons.md`).

## 6. Dressing rules for this game

These add to core section 7.

- **Set pieces are named in the brief and built as one helper** in the scene layout: one function that places the
  anchor, its members and its apron from one position. Place the function, not the members.
- **Solid members stand on cells the blockout already blocked** (the anchor's own cells or a wall's). Anything
  that would need a new blocked cell is a non-solid member tucked against the anchor, or it is dropped.
- **Kinds matter for what hides what.** `house` and `tree` fade or reveal when a figure walks behind; `prop` does
  not. So a tall `prop` never stands in the row directly below a walkable cell or an NPC slot.
- **Lights.** A glow is centred on its lantern sprite. `ambienceSources` allows four lanterns and two steam
  sources a map; choose them in the brief.
- **Moving things.** Check every routine leg, flock and animal path against the finished layout
  (`routines.test` covers residents; the others are by eye).
- **Scale** (proposed until measured against the approved Ba Dan houses and Kaya):

| Kind of object                              | Height against a standing adult |
| ------------------------------------------- | ------------------------------- |
| Carried things: basket, bucket, sack, pot   | knee to hip (up to about half)  |
| Barrel, crate stack, handcart, trough       | hip to chest (up to two thirds) |
| Stall, rack, well with its frame, lamp post | head height to one and a half   |
| Door                                        | about one and a fifth           |
| Single-storey eave                          | at least one and a half         |

State every object's size in px in its prompt and check it beside Kaya. Barrels and crates have been coming back
too large.

## 7. Cohesion and art production for this game

These add to core section 8.

- **Lore sets the architecture** (owner). Every prompt names the nation's style "as in the Avatar animated style"
  and says what the piece is not.

| Nation        | Decided look                                 | Never                                                         |
| ------------- | -------------------------------------------- | ------------------------------------------------------------- |
| Earth Kingdom | Green glazed upturned roofs on stone bases   | European looks: half-timbering, chimneys, colonial lighthouse |
| Fire Nation   | Red and black with gold                      | The same                                                      |
| Water Tribes  | Not yet decided for this game: ask the owner |                                                               |
| Air Nomads    | Not yet decided for this game: ask the owner |                                                               |

- **Region identity.** Each board has one identity line from the owner (RG-02: a noisy fish quay, a working
  freight dock, a Fire Nation outpost, an industrial power yard) and one landmark. Put both at the top of the
  brief.
- **Make art as a kit per area,** from the kit list written at stage 5, against one angle reference and one style
  reference. Order: tilesets, then anchors (buildings, the landmark), then set-piece members, then people.
- **The kit picture** (core C9): every object of the region on the region's ground beside Kaya, at 3x, before any
  of it is placed. Remake what looks borrowed. It stays out of the repository, like all evidence.
- **Palette: an open question, not a rule yet.** The handoff proposed remapping every object and tile to one
  region palette of 40 to 48 colours at bake time. ADR 0104 dropped the single game palette, and `art-lessons.md`
  records palette locks on generated animation frames as a failure. A remap of static objects at bake time is a
  different thing and may work, but it is unproven here. Try it on one region's kit picture, remapped and not, and
  let the owner choose by eye. Until then: build the region's ramps from its tilesets, measure how far each object
  strays, and remake the worst.
- **Cost.** An object is about 5 credits, a house about 9, a tileset 15, an NPC with idle and walk about 50, an
  enemy with five clips about 122, a portrait about 18. RG-02's four boards were about 1,520 credits, of which
  about 340 went on six density passes after the fact. Working from a kit list should remove most of that. Every
  credit budget goes to the owner first; book spend in the ledger.
- **Retakes.** One retake with a corrected prompt; if the second fails, change the approach (a different
  reference, a smaller piece, a code-drawn part) and record it in `docs/art-lessons.md`. Prefer code-drawn ground
  and reused set pieces to new generations.

## 8. Fight boards

These add to core section 10. The numbers marked proposed are starting points to check with `npm run balance`.

- **A fight board is the same place as its story says,** built from the same brief. The quarry's lanes are its
  cart track, spoil heaps and cut faces.
- **Battle intention first** (core F1), then shape. Today's four boards are 20x12 boxes with a road through the
  middle; start from the outline of the place instead.
- **Blocked and rough ground:** about a quarter to a third of cells, in irregular clumps (proposed).
- **Cover** costs the attacker 20 (`coverPenalty`); a height tier is worth 10 (`elevationStep`). Use fences (`F`),
  wood cover (`c`), rubble and cover props to gather the fight into two or three zones, not to line the board.
- **Height:** tiers through `^`, `A`, the ramp `S`, `R` and `X`. No walkable neighbours two tiers apart (the step
  contract). High ground has few ways up.
- **Reactive props:** two to four a board (proposed), from `src/content/props.ts` (water barrel, oil flask,
  brazier, hay bale, rubble pile, cabbage cart), each a member of a set piece that explains it (the flask at the
  lamp store, the bale at the cart). Each should have a use for more than one element in `combos.ts`.
- **Placement changes balance a lot.** An oil flask on the party's approach lane dropped the full-table win rate
  to 40%; one group of tiles east it read 95% (the comment in `src/content/maps/combat.ts`). Keep hazards off the
  spawn lanes, and run `npm run balance:check` after moving one.
- **Authored surfaces** (`~` water, `o` oil, `m` mud) are ground storytelling too: oil is under something that
  leaks, mud is where water stands.
- **No grid shows,** so the ground must say where the rules change: a change of material at a change of rule, and
  blocked cells drawn as solid things with a base shadow.
- **Any party works:** one to six heroes, any hero absent. Check the board at 1, 3 and 6.
- **Length:** trim anything past about six minutes. Start the sides close enough that contact comes by the second
  round.
- **Dress quietly** (core F10). A fight board carries less dressing than a town, pulled to the rim.

**What the board owes the hit feedback.** Feedback itself (forecasts, numbers, flashes, hit-stop) is combat
presentation, not level design, and has its own rules in `CLAUDE.md`. The board's part is to stay out of its way:
nothing tall over a cell a fighter can stand on; ground darker and calmer than the fighters; no moving ambience
that could be mistaken for an effect; reactive props that look the same on every board.

## 9. Validators and tools worth building

Each is a specification. Build them report-only first, measure Ba Dan and the best RG-02 board, set the numbers
from what the owner likes, then turn them into failing tests. Changes to the map or layout schema need an ADR
(next free number: 0119).

| #   | Name               | Rule it checks                                                                                                   | Needs                                              |
| --- | ------------------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | `placeBrief`       | Every top-down map has `docs/places/<id>.md` with the template's headings filled or marked as questions          | Nothing new                                        |
| 2   | `blockoutFrozen`   | The brief records a hash of the approved rows; rows that differ fail until the brief is re-approved              | A hash line in the brief                           |
| 3   | `setPieceParent`   | Every standing object names its set piece; every set piece has one anchor and two to five members                | A `group` field on layout objects (schema, ADR)    |
| 4   | `anchored`         | Share of standing objects within one cell of a blocked cell, a rim, or a member of their set piece (default 80%) | Validator 3                                        |
| 5   | `looseSingles`     | No standing object without a neighbour within two cells unless marked as a marker                                | A `marker` flag                                    |
| 6   | `desireLinesClear` | No object footprint or solid cell on a named track; every door, anchor, slot and exit touches the track network  | Named tracks in every terrain classifier           |
| 7   | `restingGround`    | In every 10x7 window, the share of walkable cells with nothing on them is in range (default 60 to 80%)           | Nothing new                                        |
| 8   | `landmarkPerView`  | Every 10x7 window holds a piece marked as a landmark; each landmark sprite is used once per map                  | A `landmark` flag                                  |
| 9   | `footprintRhythm`  | No two buildings share both size and row; no three at equal spacing; no straight rim run over two cells          | Nothing new                                        |
| 10  | `aprons`           | Every anchor has changed ground under it                                                                         | Aprons as data in the layout, baked by one routine |
| 11  | `scaleChart`       | Each object's opaque height is inside the chart's range for its class                                            | A class per object; the measured chart             |
| 12  | `regionColours`    | Report: colours per object, and distance of each from the region's ramps                                         | Region ramps taken from its tilesets               |
| 13  | `overlayAlignment` | Each glow is centred on a lantern object; no animal or flock path crosses an object footprint                    | Sources linked to object ids                       |
| 14  | `tallPropSouth`    | No `prop` taller than a figure stands in the row below a walkable cell or slot                                   | Nothing new                                        |
| 15  | `laterStates`      | Every later state in the brief names the runtime props, NPCs or conditions that build it, and each is reachable  | A state list in the brief                          |
| T1  | Kit picture tool   | Renders every object of a region on its ground beside Kaya at 3x                                                 | A script beside `pack-ground.ts`                   |
| T2  | View shots tool    | Fixed camera spots per map (one per view) for before and after at the explore zoom                               | The screenshot gallery                             |
| T3  | Set-piece helper   | One function per set piece: anchor, members and apron from one position; shared across boards                    | Validators 3 and 10                                |

Validators 3, 6 and 10 with tool T3 are the ones that change the work: they turn a board from a long script of
single objects into a short list of set pieces on a ground that knows about them. The others measure.

**Later states on a baked board.** Today only runtime props, NPCs and conditions can change a place. That is
enough for people, goods, lights and small objects. It is not enough for a burnt house or a repaired bridge. If a
story beat needs that, raise it before the bake: the choices are a second baked board or an overlay layer, and
both are engine decisions that need an ADR.

## 10. Worked example: the Ba Dan square, as a method demonstration

This shows the stages on a real map. It is **illustrative, not approved**: the story facts are placeholders for
the writing pass, and no rows have been changed.

**Stage 0, intake.** Known: Ba Dan is the starting village on the western uplands; an Earth Kingdom village; it
has a canal, a road east to the Forest Road, a day cycle with residents on errands, and it is where the walk home
ends. Not found in what I read: which resident keeps which house, and what the village makes or trades. Those are
questions, not things to invent.

**Stage 1, brief (extract).**

- **One line:** a small upland village where everyone crosses the same square several times a day.
- **Feeling:** safe and busy on arrival; missed on leaving; changed on the walk home.
- **Ordinary day:** water is fetched; goods are carried to and from the road; washing is done at the canal;
  people stop and talk where the routes cross. `PLACEHOLDER (story): the village's trade and who does what.`
- **Focal point:** the place where the routes cross, with the well. Seen on arrival and from every lane.
- **Quiet space:** the green beyond the last house, kept empty, where the eye rests.
- **Later states:** the walk home after a win and after a loss. Reserve the spots where people gather for the
  welcome.

**Stage 2, three plans.**

1. _Street village:_ houses along one road. Simple, but it is today's layout, and every view is the same.
2. _Square:_ houses ring a crossing; the canal passes one corner; the road leaves east. One clear focal point;
   every door faces it; lanes between houses tease what is behind.
3. _Two banks:_ the canal splits the village; a bridge is the focal point. Stronger picture, but it puts the
   start of the game on a choke point.

Chosen: plan 2, with plan 3's bridge kept as a second landmark on the way out.

**What today's rows show against the rules.**

- Four house blocks of the same width in two facing rows (core L15).
- A canal dead straight across the full width and a road dead straight under it (core L4, L13).
- A one-cell tree border on every side (core L12, section 4 here).
- Blocked `l` cells, each there for a prop to stand on, spread evenly over the grass (core P6, P12, and the
  blockout rule in core stage 3).
- No worn ground from any door to the road (core L6, G3).

**Stage 3, blockout.** Five houses of three different sizes around an uneven crossing; doors face it; the road
enters at the east mouth, bends round the well and leaves by the bridge; the canal clips the south-west corner
with steps down to it; the rim bites in at the north-west. Walk it grey. Check each of the five views for its one
idea: the crossing, the canal steps, the bridge, the back lane, the green.

**Stage 4, ground.** Tracks from every door to the crossing, worn most at the crossing and round the well; a
footpath to the canal steps; damp round the well and along the canal kerb; weeds along the back walls and at the
rim; soil beds where trees will stand.

**Stage 5, set pieces** (roles, not names).

| Set piece      | Anchor          | Belongs with it                          | Ground                         |
| -------------- | --------------- | ---------------------------------------- | ------------------------------ |
| The well       | Well with frame | Two buckets, a yoke, a wet cloth         | Wet stone ring, worn approach  |
| A house front  | House door      | Doorstep, a pot, a bench or a woodpile   | Packed-earth apron to the path |
| The wash place | Canal steps     | A basket, a board, a line with one cloth | Damp kerb, trodden bank        |
| The road side  | A handcart      | Two sacks, a crate, a wheel chock        | Rutted ground, a turning patch |
| The back wall  | A lean-to       | Tools, a ladder, a heap                  | Weeds, bare patch at the door  |

Kit list: only what this table names, with sizes. Five set pieces, reused with variation for five houses, is
about twenty pieces of art; the current board has 36 props and 34 trees.

**Stage 7, life.** Residents stand at the well, the wash place and the cart, not in the open square. The
crossing is where their errands pass each other.

**Stage 8, the questions for the owner.** One at a time: is the square the right size? Does the bridge read as
the way out? Is the green too empty?
