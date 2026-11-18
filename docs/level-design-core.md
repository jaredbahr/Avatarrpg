# Level design: the shared method

This file is the same in all three of Jared's game repositories (Imagination, Tidewrack, Four Nations Tactics). It
holds the method and the rules that do not depend on a game's style. Each repository has a second file, its
**addendum**, with that game's numbers, file names, checks and tone. Read both before you build or change a scene.
Where they disagree, the addendum wins for its game.

Change this file in all three repositories at once, or not at all.

**Who it is for:** any agent that designs, builds, dresses or reviews a place: a town, a road, a room, a fight
board, a run area.

**What it fixes:** scenes that look like objects were made first and then dropped on a map to see what fits (Jared,
2026-11-17). The cure is an order of work, written down, with a check at each step.

## 1. Why scenes look thrown together

Six causes, found in our own maps. Each rule below answers one of them.

1. **Nobody wrote down what the place is.** With no purpose, residents or history, there is no way to say an object
   is wrong, so everything is allowed.
2. **Objects are placed one by one.** A barrel alone on open ground has no owner. In a real place things collect
   around the people who use them.
3. **The ground does not know what stands on it.** No worn earth at a door, no path to the well, no weeds at a post.
   Shadows alone do not fix this.
4. **Each asset was made alone.** Its colours, detail and scale are its own, so pieces look like they come from
   different games.
5. **The grid shows.** Rectangular footprints, straight runs and even spacing read as a board, not a place.
6. **"Dense" was read as "more".** Adding props to open ground makes scatter. Detail belongs at edges and around
   work; open ground is part of the design.

## 2. Ten principles

Each has a test you can apply to a scene.

1. **The place exists before the player arrives.** It has a job, people and a past. _Test:_ you can say in one
   sentence what happens here on an ordinary day.
2. **One idea per view.** A view is one camera screen. Each view has one thing the eye lands on first and nothing
   that competes with it. _Test:_ every view can be named ("the well", "the split oak", "the net racks").
3. **The ground tells the story first.** Paths, wear, wet and growth are drawn from where people walk and work, and
   the ground and the objects are planned from one shared map. _Test:_ hide every object; the ground alone still shows
   where the doors, the work and the routes are.
4. **Things come in households, not items.** Place set pieces: an anchor, the smaller things that belong to it, and
   the ground under them, as one unit. _Test:_ every object has a parent.
5. **Edges hold the detail; the middle rests.** Detail is thickest against walls, fences, banks and at junctions,
   and thins to calm open ground. _Test:_ squint; you see a few dense clumps and clear space between them.
6. **Walkable reads at a glance.** Open ground and blocking mass differ in brightness, every blocker is a real thing
   (a cliff, trees, water, a wall), and an exit is unmistakable. _Test:_ a new player points to every exit in a
   still picture.
7. **Curiosity is paid.** A side path shows a hook from the main route and ends in something: a view, a find, a
   person, a short cut. _Test:_ no dead end is empty.
8. **One world.** One scale, one light direction, one outline and shadow rule, one level of detail, and colours
   that belong to the area. _Test:_ put every asset of the area side by side on its ground; nothing looks borrowed.
9. **Places change.** What differs on a return visit is planned with the first version, and room is left for it.
   _Test:_ the brief lists each later state and what moves.
10. **Take things away.** After every pass remove what has no reason. _Test:_ each object left answers "who put
    this here, and why?" from the brief.

## 3. The order of work

Eight stages. Each produces one thing and has one gate. Do not start a stage before the gate of the one before it
is passed. Art is made at stage 6, never earlier.

| #   | Stage             | Produces                                                        | Gate                                                   | Needs taste?   |
| --- | ----------------- | --------------------------------------------------------------- | ------------------------------------------------------ | -------------- |
| 0   | Intake            | The story facts for the place, with gaps marked                 | Every gap is a marked placeholder or an owner question | Yes            |
| 1   | Place brief       | The filled template (section 4)                                 | Owner reads it and says yes                            | Yes            |
| 2   | Plan              | Three rough plans, one chosen; zones, routes, focal point       | The chosen plan passes the layout rules (section 5)    | Yes            |
| 3   | Blockout          | The collision layout in the game, with no art                   | Walked in the game; layout checks pass                 | Partly         |
| 4   | Ground            | Paths, wear, aprons, wet and growth on the shared map           | Hide-the-objects test (principle 3)                    | Partly         |
| 5   | Set-piece plan    | Every set piece as labelled boxes on the blockout; the kit list | Placement rules (section 7); owner sees it in motion   | Yes            |
| 6   | Art               | The kit, made together and checked side by side                 | Cohesion rules (section 8)                             | Yes (judgment) |
| 7   | Life              | People, animals, motion, sound, time of day, later states       | Section 9 checklist                                    | Partly         |
| 8   | Review and polish | Measured report, before and after from fixed spots              | Section 11; owner says yes                             | Yes            |

**Why this order.** The owner's two cheapest decisions (the brief and the grey blockout) come before any art is
paid for. A wrong place costs a paragraph to fix at stage 1 and a re-bake, new art and a re-review at stage 8.

**Small jobs.** Changing an existing scene still starts at the brief: write or update it, then enter at the first
stage your change touches. A scene with no brief gets one before anything else is added to it.

**Who does what.** Stages 0, 1, 2, 5 and the judgment in 6 and 8 need taste and stay with the strongest model.
Stage 3, the mechanical part of 4, wiring in 7 and the measuring in 8 can be delegated with this file and the brief
as the specification. Each addendum names the tiers.

### Stage 0: intake from the story

Story, names and lore belong to the writing pass. A level designer does not invent them.

- **Take from the story documents:** what happens here, who is here and why, what the place was before, what
  changes after the player's choices, the mood.
- **Ask for what is missing.** If the story does not say who lives in a house or why a cart is abandoned, do not
  make it up. Write a placeholder in the form the repository uses and list it in the pull request.
- **Hand back to the writing pass:** the brief's list of residents and work spots, the finds and what each should
  reveal (as a need, not as text), and the list of later states. These are requests, not drafts.
- Roles are not story. "A net mender works here" is a design need you may state. Her name, history and lines are
  not yours.

### Stage 2: the plan

Before any grid, sketch **three** different rough plans, a few lines each: where the entrance is, where the focal
point is, how the main route runs, where the quiet space is, where the side path goes. Choose one and say why the
other two lost. One plan is a habit; three is a choice.

Then mark on the chosen plan:

- **Zones** as blobs, not boxes: where people live, work, trade, store, rest.
- **Desire lines:** straight lines between every pair of places people go between (door to well, door to work,
  entrance to exits). Where many lines run together is the main route. Where few run is a footpath. Where none run
  is quiet ground.
- **The focal point** and the **entry view** (what the first screen shows).
- **The critical path** and each **side path** with its hook and its reward.
- **Reserved spots** for later states.

### Stage 3: blockout

Build the collision layout and nothing else: plain ground, plain blocks, the exits, the spawn. Walk it in the game
at real speed with the real camera. Ask:

- Is the entry view right? Does the focal point pull you?
- Does each view have its one idea, or is one view empty and the next crowded?
- Is any route a squeeze, a straight corridor, or longer than it is worth?
- Do you always know where you are?

Expect the first blockout to fail. Changing it is nearly free now and expensive later.

**Measure the view before you plan with it.** Take a screenshot in the game and count what is visible once the
interface is drawn. A view size worked out from the zoom alone will be too large.

**The rule that keeps the order honest:** blocked cells are decided here, from the plan. A dressing pass may not
add or move a blocked cell to make room for a prop. If dressing needs the collision changed, go back to this stage.

### Stage 5: set pieces as boxes

Place every set piece on the blockout as a labelled box before any art exists, and view it in the game. This is
when you find that the stall blocks the lamp, the cart sits on the path, or the square is full. Then write the
**kit list**: every piece of art the plan needs, with its size, and nothing the plan does not need.

## 4. The place brief

Copy this, fill it, and keep it with the scene (each addendum says where). A line you cannot fill is a question
for the story or the owner, not a blank to guess.

```markdown
# Place brief: <scene id>

**One line:** <what this place is, in a sentence a child would understand>

## Story

- **Why the player comes here:** <the beat it serves>
- **What it was before / how it got this way:** <from the story, or PLACEHOLDER>
- **Feeling on arrival:** <one or two words>, and on leaving: <one or two words>
- **Later states:** <state> -> <what visibly changes>; <state> -> <...>

## People

| Who (role) | Lives / works where | What they do in a day | Why the player would talk to them |
| ---------- | ------------------- | --------------------- | --------------------------------- |

## Daily life

- **What happens here on an ordinary day:** <three to five things, each of which will leave marks on the ground>
- **Where people walk (desire lines):** <from -> to>, ...
- **Where things are stored, made, sold, mended, thrown away:** <...>

## Shape

- **Focal point:** <the one thing>, seen from <where>
- **Entry view:** <what the first screen shows>
- **Views:** <name of each screen-sized part and its one idea>
- **Quiet space:** <where the eye rests, and why it is empty>
- **Main route:** <...> **Side paths:** <hook -> reward>, ...
- **Edges:** <what bounds each side: cliff, water, trees, wall>; **exits:** <to where, and how each reads>
- **Size:** <in views>, because <reason>

## Look and sound

- **Culture and materials:** <building style, the three or four materials allowed here>
- **Signature:** <the colour, object or shape that belongs only to this place>
- **Time of day and weather:** <...>
- **Music and sound:** <the track; what its mood asks of the place; local sounds and their sources>

## Fight needs (only for a fight space)

- **Battle intention in one line:** <e.g. "hold the bridge", "ambush from above">
- **What the terrain offers each side:** <...>
- **What reacts to the player:** <objects and how>

## Set pieces

| Name | Anchor | Belongs with it | Ground under it | Whose is it / why here |
| ---- | ------ | --------------- | --------------- | ---------------------- |

## Finds

| What draws the eye | Where | What the player gets | What it should reveal (a need for the writing pass) |
| ------------------ | ----- | -------------------- | --------------------------------------------------- |

## Open questions

- <taste or story questions for the owner, one line each>
```

## 5. Layout rules

**Composition**

- L1. Each view has **one dominant**: the brightest, least obstructed thing, with space around it. A second
  feature may answer it; a third competes.
- L2. The **entry view** shows the focal point or a path that plainly leads to it, one set piece that says what
  kind of place this is, and one living thing.
- L3. The most important building is the biggest, and stands where routes meet. Importance that is not visible is
  not there.
- L4. Do not aim the route straight at the goal. Bend it, and let something partly hide the landmark so it is
  revealed on the approach.
- L5. Every view-sized area has one unique landmark. Use a hero object once per area; a landmark seen twice is no
  longer a landmark.

**Routes**

- L6. Every path leads somewhere people go. No path ends at nothing; no door, well or work spot lacks a path.
- L7. Paths follow desire lines: they curve where people cut corners and widen where people gather. A path's width
  shows its use.
- L8. Keep the main route clear and put surprises on side branches. A side branch shows its hook from the main
  route.
- L9. Prefer loops to dead ends. A dead end must hold a reward.
- L10. Passable gaps look passable and are at least two character-widths wide; closed gaps look closed. No gap
  that reads one way and behaves the other.
- L11. The player arrives somewhere safe with time to read the place.

**Edges and exits**

- L12. Every boundary is a thing in the world: a bank, a cliff, a tree line, water, a wall. Never a bare line.
- L13. Outlines are irregular; collision is simple. Stagger what the eye sees by a tile or two, but keep the edge
  the player slides along smooth.
- L14. An exit has three cues: a break in the boundary, a path that runs through it and off the view, and a
  brighter or emptier patch. Two cues are not enough.
- L15. No building footprints of the same size in a row at the same spacing. Vary size, setback and angle of
  approach, and let buildings face what they serve.

**Size**

- L16. Size the place by its content: one idea per view, so the number of ideas sets the number of views. Start
  smaller than you think; empty views are harder to fill than crowded ones are to thin.
- L17. A bigger place needs districts that differ (in ground, in building type, in density), a landmark visible
  from each, and a hub the routes return to.
- L18. Alternate tight and open. A narrow lane before a square makes the square.

## 6. Ground rules

The ground is the largest thing on the screen. Treat it as the first layer of dressing, not as a backdrop.

- G1. **One shared map.** The ground painter and the object placer read the same data: where paths, aprons and
  kerbs are. Objects then stand on what the ground says, and the ground reacts to what stands on it.
- G2. **Calm.** Ground has few colours and low contrast, so people and objects carry the contrast. Never put two
  busy textures side by side. A flat area next to a textured one is correct. Calm the ground before adding
  shadows or more detail: on busy ground neither reads.
- G3. **Wear follows use.** Bare earth on desire lines, worn most where lines cross and at doors. Wide worn ground
  frays at its edge; a narrow trail stays crisp.
- G4. **Aprons.** Every building and large object sits on ground changed by it: packed earth at a door, a wet ring
  at a well, chips at a chopping block, scorched ground at a fire, trampled ground at a stall.
- G5. **Break the base line.** Where an object meets soft ground, tufts, clods or pebbles overlap its foot. No
  object shows a clean, fully traceable base on clean ground.
- G6. **Growth follows neglect.** Weeds at posts, in corners, along the foot of walls and where nobody walks.
  Nothing grows on a desire line.
- G7. **Wet follows water and shade.** Damp below a spout, a trough, a drain, the shaded side of a wall the player can see.
- G8. **Natural edges are ragged; made edges are clean.** A bank wanders; a paved court has a kerb. Where the two
  meet, the made edge is worn and the natural one creeps over it.
- G9. **Hide the tile.** No visible repeat. No straight natural edge longer than two tiles.
- G10. **Decoration never blocks a route or sits on a desire line.**

## 7. Placement rules

### Set pieces

A **set piece** is the unit of dressing: **an anchor** (a building, a well, a stall, a cart, a tree, a boat),
**two to five things that belong with it**, and **the ground under them** (rule G4). It is designed once, named in
the brief with its owner and its reason, and placed whole.

- P1. **Every object belongs to a set piece.** No object is placed alone. A single object standing by itself is
  allowed only when the brief names it as a marker or a landmark.
- P2. A set piece mixes **sizes**: one large, one or two medium, a few small. Same-sized things in a group read as
  a row of products.
- P3. Things in a set piece **touch or overlap**. Lean them on the anchor and on each other. Gaps between members
  are smaller than the smallest member.
- P4. A set piece shows **use**: something open, half-done, spilled, worn, hung to dry or left where it was last
  put down. Tidy is unoccupied.
- P5. Reuse set pieces with variation (mirror, swap one member, change the ground) before making new art.

### Where things go

- P6. **Against something.** Objects stand at walls, corners, fence ends, bank foots, path edges and junctions.
  The addendum sets the share that must be anchored; the default is at least four in five.
- P7. **On the side people use.** Stores by the door they are carried through, tools by the work, rubbish at the
  back, seats facing the view or the square.
- P8. **Never** on a desire line, in a doorway, in front of a sign, a stall front or a face, under a light it does
  not belong to, or where it hides a walkable cell or an exit.
- P9. A tall object never stands directly south of (in front of) something the player must see or reach, unless
  the game fades or cuts it.
- P10. Things that grow are rooted in soil. Things that hang have something to hang from. Things that glow have a
  source, and the glow is centred on it. Animals keep to ground they could stand on.
- P11. Interactive objects look different from decoration, the same way every time: a consistent shape, and more
  contrast than what surrounds them. Teach each kind once, then reuse it.

### Density and rhythm

- P12. **About two parts rest to one part detail.** The addendum gives the measured figure for its game.
- P13. Vary clump size and the spacing between clumps. Even spacing reads as a pattern.
- P14. Along a run (a fence, a quay, a wall) repeat a plain element with a rhythm, and break the rhythm once with
  a reason: a gap where a cart goes through, a mended rail, a missing post.
- P15. Density rises toward the focal point's surroundings and falls at the focal point itself, which is kept
  clear.
- P16. Repeat plain shapes freely; ration unusual ones to one per view.

### The reason test

For each object ask, and answer from the brief: **Whose is it? What is it for? Why is it exactly here?** If any
answer is "it filled a gap", remove it. An empty patch that passes principle 5 is finished.

## 8. Cohesion rules

- C1. **One pixel size.** Every asset is drawn at the game's art resolution and scaled only with the whole view.
  Never scale one sprite.
- C2. **One scale chart.** Every object's size is fixed against a standing person before it is made, and checked
  beside one after. The addendum holds the chart.
- C3. **One light.** One direction, one shadow colour, shadows short and of one length. Every standing object has
  a contact line and a cast.
- C4. **One outline rule** and **one view angle** for everything in the game.
- C5. **One level of detail.** An object is not more detailed than the place it stands in, and not less.
- C6. **Colours belong to the area.** An object's colours come from the area's ramps, and natural objects share
  hues with the ground they stand on. Save the strongest colour and contrast for the focal point and for things the
  player can use.
- C7. **Few materials per place.** Three or four building materials, set in the brief, from what the place would
  have.
- C8. **Make art as a kit.** Generate or draw an area's pieces together, against one reference, from the kit list.
  Never make one object to fill one gap.
- C9. **Look at the kit together before placing any of it.** Put every piece on the area's ground, next to a
  person, in one picture. Fix or remake what looks borrowed. This is the cheapest art review there is.
- C10. **Distinct areas, one world.** Between areas keep C1 to C5 fixed. Change the ground, the materials, the
  signature colour and one signature object.
- C11. A whole-scene light or colour pass (time of day, mood) is applied to the finished scene, never to single
  assets.

## 9. Life

A dressed place is still empty until something in it is busy.

- V1. People stand **at work**, at the object their job uses, facing it. Nobody waits in open ground for the
  player.
- V2. Homes and work spots match: every resident has a door, and every work spot has someone who uses it at some
  hour.
- V3. A person at a fork or a gate faces the route they are there to point out.
- V4. Small motion in every view: smoke, cloth, water, leaves, an animal. It has a source in the scene and it
  stops or freezes under the game's reduced-motion setting.
- V5. Sound has sources. If the track or the sound bed has water, a forge or gulls in it, the player can find
  them.
- V6. Layout, mood and music agree. A slow, open track wants space and long sight; a busy one wants crossing
  routes and movement. If the place and its track disagree, raise it; do not ignore it.
- V7. Time of day changes who is where and what is lit, not only the tint.
- V8. **Later states** keep the layout and change the occupants, the access, the light and a few objects. Plan
  them in the brief; reserve their spots in the first version; build them from parts the game can swap at run time.
- V9. What people say in passing matches the place's current state.

## 10. Fight spaces

A fight space is a place first. Write the same brief; the terrain that makes the fight comes from what the place
is.

- F1. Write a one-line **battle intention** before drawing, and shape the ground to it.
- F2. Two or more routes to every objective, with different costs.
- F3. No flat open rectangle. Blocking and rough ground come in irregular clumps, with no dead corners.
- F4. At most one single-width choke point, and a way round it.
- F5. High ground is strong and contested: good sight, few ways up.
- F6. Cover gathers the fight into zones. Cover everywhere is the same as cover nowhere.
- F7. Everything that reacts can be used by the player, reacts with more than one thing already in the game, and
  behaves the same way every time. The first one a player meets is set up so its use is obvious.
- F8. Nothing dangerous at the starting position. Contact comes early.
- F9. Nothing tall hides a fighter or a place a fighter can stand.
- F10. Dressing in a fight space is quieter than in a town: lower contrast, pulled to the edges, so fighters and
  effects read first. Clarity beats decoration every time.

## 11. Review

### Before you show anyone

1. **Brief check.** Read the brief, then look at the scene. Does it show the one line? The ordinary day?
2. **Reason test** (section 7) on every object. Remove what fails.
3. **Squint test.** Blur the picture. The main route is the lightest band; the focal point stands out; a few dense
   clumps sit against edges.
4. **Hide-the-objects test** (principle 3).
5. **Still-picture exits test** (principle 6).
6. **Kit picture** (rule C9) still holds after the last art change.
7. **Walk it** at real speed, every route, every state, every time of day. Check every moving thing and every
   glow against what it belongs to.
8. **Measure** (table below) and attach the numbers.
9. **Take one more thing away.**

### What to measure

The numbers are **proposed defaults**, not sourced facts. Each addendum sets its own after measuring that game's
best existing scenes; a rule that the best scene fails is the wrong rule. Until an addendum has measured, these
defaults apply.

| Measure                         | Rule                                                                         | Default             |
| ------------------------------- | ---------------------------------------------------------------------------- | ------------------- |
| Objects with a parent           | Share of standing objects that belong to a named set piece or are a marker   | 100%                |
| Anchored objects                | Share within one tile of a structure, an edge or another member of their set | at least 80%        |
| Loose singles                   | Objects with no neighbour within two tiles, not named as markers             | 0                   |
| Resting ground                  | Share of walkable ground in a view with nothing on it                        | 60 to 80%           |
| Desire lines clear              | Objects standing on a marked desire line                                     | 0                   |
| Path continuity                 | Doors, work spots, wells and exits joined to the path network by worn ground | 100%                |
| Aprons                          | Buildings and anchors with changed ground under them                         | 100%                |
| Landmark per view               | View-sized windows that contain a named landmark                             | 100%                |
| Exit cues                       | Exits with all three cues                                                    | 100%                |
| Route width                     | Narrowest point of the main route, in character widths                       | at least 2          |
| Straight runs                   | Longest straight natural edge                                                | at most 2 tiles     |
| Scale                           | Objects outside the scale chart's range for their kind                       | 0                   |
| Area colours                    | Colours used by objects that are not in the area's set                       | set by the addendum |
| Hero reuse                      | Times a landmark object appears in one area                                  | 1                   |
| Collision unchanged by dressing | Blocked cells added after the blockout was approved                          | 0                   |
| Later states                    | States in the brief that are built and reachable                             | 100%                |

### Showing the owner

The owner judges by eye, in motion. Make that fast.

- **Three looks, not one.** The brief (two minutes to read). The blockout with set pieces as boxes (a short walk).
  The finished scene. Art is not paid for before the second yes.
- **One question at a time.** "Is the square too full?" with two pictures, not ten changes and "thoughts?".
- **Same spot, same camera, same scale, same time of day** for before and after, side by side.
- **A short clip of walking the main route,** and enlarged crops of anything changed.
- **Say what you measured and what you are unsure of.**
- After his answer, record the decision where the repository records lessons, so it is asked once.

## 12. What not to do

Each of these has happened in our games.

- Making art before the brief and the blockout.
- Filling open ground because it is open.
- Adding blocked cells so a prop has somewhere to stand.
- A light whose glow is off its lamp; an animal's route over objects; a tree on a cliff edge or on paving; washing
  hung in a flower bed; a post in front of a stall; a stall under a pile of crates.
- A row of same-sized houses at the same spacing.
- A paved road that stops in a field.
- One generated object dropped in to fix a gap.
- Rescaling one sprite to make it fit.
- Judging a scene from one still picture.
- Inventing who lives somewhere because the story did not say.

## 13. Where the rules come from

The rules are a synthesis of three things: what our own best scenes already do, published craft writing, and
analysis of well-regarded games. Developer statements about how the classic 16-bit role-playing games laid out
their towns are scarce; most of what is written about them is analysis by others. So treat the rules as tested
practice to be checked against our own scenes, not as quotations from those teams.

**Our own scenes.** Imagination's first island and its city are the owner's benchmark (2026-11-17). They share a
ground map between painter and placer, wear the ground where people walk, group objects along a wall or kerb for a
stated reason, and check every size against the hero. Rules G1, G3, G4, G5, P6 and C2 are taken from them.

**Published sources read for this guide** (2026-11-17):

- The Level Design Book: layout, blockout, flow, environment art, storytelling. `book.leveldesignbook.com`
- Dan Taylor, "Ten Principles of Good Level Design". `gamedeveloper.com`
- Mateusz Piaskiewicz, "Composition in Level Design". `gamedeveloper.com`
- Raymond Schlitter (Slynyrd), Pixelblog 1, 20, 21 and 43: palettes, top-down tiles, objects, shadows. `slynyrd.com`
- Pedro Medeiros, "Consistency" (one pixel size, one palette). `saint11.art`
- "Graveyard Keeper: how the graphics effects are made" (whole-scene grading, cheap motion). `gamedeveloper.com`
- Final Fantasy VI developer interview, translated (places as somewhere people live; a region's own colours).
  `shmuplations.com/ff6`
- "Overworld Overload", an analysis of A Link to the Past's world (barriers as real things; goals shown before
  they can be reached). `gamedeveloper.com`
- A Link to the Past development interview, translated (marking secrets). `glitterberri.com`
- Interview with the Tunic team (soft gates, hidden passages). `gamedeveloper.com`
- Notes on Scott Rogers's talk on theme-park design (landmarks that pull, clear routes with side nooks).
- CrossCode developer blog on height readability. `radicalfishgames.com`
- Into the Breach developer interviews (clarity over cleverness; every feature matters). `gamedeveloper.com`
- Ubisoft on Mario + Rabbids battle layouts (battle intention; layers of a fight map). `news.ubisoft.com`
- Community guides on Fire Emblem and Advance Wars map design (routes, choke points, terrain clumps).

**Not sourced; our own reasoning:** the three exit cues, the set-piece unit and its size mix, the reason test,
every number in section 11, and the order of work as a whole (adapted from the blockout-first practice of 3D level
design to 2D pixel scenes).
