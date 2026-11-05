# Ba Dan Lane — top-down PixelLab test

## v13 / tutorial pass: both areas polished, and the whole tutorial from Ba Dan to the Driller (2026-11-05)

Jared: "This is great. Write all this work to GitHub. Let's polish both these areas. Then run the demo from Ba Dan to the
Driller. Do this tutorial area and see how good we can make it. Remember to write failures in the project so we learn from
them. It's important we maintain consistency."

**Files (this folder)**
- `tutorial-demo.html` (6.3 MiB, self-contained): the whole tutorial, playable on a phone and on desktop. `?auto=1` plays itself;
  `?gate=bluff|kin` and `?ruon=trade` pick the other branches for the self-playing run.
- `tutorial-run.mp4`: the self-playing run, about 4:00 at 1280×720, Ba Dan to the Driller's defeat and the walk home (fights
  are stepped at 3.5× game time and walks at 2.5×, then the whole video re-timed 1.16×; Ba Dan, the forest fire and the Driller
  floor at 3× zoom, the other boards at 2×). Route: knock at the gate, escort Ruon.
- `badan-topdown.html` (v13), `badan-tour.mp4` (v13, the v12 route; v12's kept as `badan-tour-v12.mp4`).
- `forest-combat.html` (v3), `forest-combat.mp4` (v3).
- `polish-before-after.png`: the bridge (4×), the houses (2×) and the burning ground (3×, game zoom), before and after.
- `quarry-overview.png` (the switchbacks, the gate, the cutting and the floor at 1×), `driller-floor-overview.png`.
- `cast-sheet.png`: the new cast and the old cast's new headings and poses, every heading as a row, and the Driller's eight views.
- Sources: `src/b3/` (the board engine v3: `levels.js` the boards from the content, `world_forest.js` v2's forest verbatim,
  `world_quarry.js` the quarry terrain and checks, `units.js`, `rules.js`, `surfvis.js`, `fx.js`, `combat.js`, `auto.js`,
  `draw.js`), `src/v13/` (Ba Dan; `tutorial.js` is the tutorial's hooks), `src/tut/` (the tutorial shell).
- Build: `sh tools/v13build.sh` (Ba Dan), `python3 tools/build_b3.py forest` (forest-combat.html),
  `python3 tools/build_b3.py tutorial` (t13/board.html), `python3 tools/build_tut.py` (tutorial-demo.html).
- Generators (all log to `ledger.json`): `tools/t13chars.py` (characters, clips, merge-download), `tools/t13obj.py` and
  `tools/t13objproc.py` (objects, cleanup), `tools/t13driller.py` (the Driller's views and animations), `tools/t13tiles.py`
  (quarry terrain), `tools/t13vfx.py` (effects), `tools/t13fixcredits.py` (books object-animation jobs).
- Checks: `tools/t13checks.js` (shadow contrast and straight edges per board, writes `t13/checks.json`), `tools/t13halo.py`,
  `tools/tutrec.js` (drives the whole run; `dry` checks it end to end without frames), `tools/t13smoke.js`, `tools/t13shots.js`,
  `tools/t13ov.js`, `tools/t13castsheet.py`.

### Filename hygiene
3,794 files (not only the 1,536 with `:`) had characters outside `[A-Za-z0-9._-]` (spaces, `:`, `,`, `@`), all frames under
`assets/chars/`. `tools/safenames.py` renames every one (runs of bad characters become `_`), rewrites every `meta.json` to the new
names and keeps the animation keys (the builds look clips up by key prefix), and writes `hyg/rename-map.json`. `tools/dl.py`
and `tools/t13chars.py` now write safe names. **Proof:** `badan-topdown.html` (v12) and `forest-combat.html` (v2) were rebuilt
before and after the rename and are byte-identical (md5 `6a2766ca…` and `32b92919…`, copies in `hyg/`). No file in the folder
has an unsafe name now.

### Part A: Ba Dan v13
- **The bridge's shadow** (`bridgeShadow` in `src/v13/ground.js`): the flat grey rectangles are gone. The bridge sprite's own
  silhouette, row by row inside the canal, is cast 8 px right and 4 px down (light from the upper left), each row nudged a pixel
  by the ripples, laid only on water pixels, deeper next to the deck and dithered at its far edge. The rails and posts cast too.
- **Houses** (`tools/v13houses.py`, objects in `assets/objects_bd13/`, v12's untouched): the eave shadow is 6 px deep, the facade
  darkens toward its shaded right and toward the ground, a 7 px strip of the right side wall recedes up the picture under the
  roof's overhang (in the wall's own plaster and plinth colours, outlined in their dark tone), the dark openings get a left
  jamb shadow (v12 had the lintel), the plinth's top edge catches the light. On the ground (`houseSideShadow`), the shaded side
  throws a hard band back along the house, never past one tile. **Partly:** better at 2×, still quiet at 1×; the houses are
  front-on art and the strongest cue would be a redraw.
- `badan-tour.mp4` re-recorded on v13 (the old one showed the code-composed bridge).

### Part A: the forest fight v3
- **Fire** (`src/b3/surfvis.js`): no carpet. The burning ground is charred earth with glowing embers; on it stand PixelLab's
  looping ground flames (`/vfx`: three sizes, the tallest a roaring tongue 48 px canvas) on a loose jittered lattice, thinned
  by a slow noise so they burn in clumps, tall ones in the core, small licks at the rim. A cell that has just caught shows only
  small licks for half a second, so the fire visibly creeps cell to cell. Flames are y-sorted with the figures. The square
  additive "flash" boxes are now stepped pixel ellipses; the surfaces use a slower, wider noise so a 3×3 pool never reads square.
- **Poses:** Kaya's Fire Blast has its own skeleton-v3 clip (both palms driven forward). Sura: Water Whip (her strike), Ice Path
  (a low sweep), Healing Stream (palms rising). Bo: Rock Throw (stamp and punch), Earth Wall (horse stance, forearms up), Stone
  Stance (forearms crossed, braced). All eight headings.
- **Eight headings** for the bandits, Sura and Bo: PixelLab's own four diagonals added to the same animation groups; v2's
  mirrored west rows are dropped, so no club, sling or braid swaps sides (the bruiser's west idle is PixelLab's and clean now).
- **Painted effects** (`/vfx`, lite artist, 1 credit each): water lash and splash, ice burst, healing light, rock hit, dust ring,
  club hit, sword slash, bolt hit, ground slam, oil splash, tumbling torch, debris, mud churn, fire punch. **Hit-stop:** 50–170 ms
  on the heavy blows (club, blade, sabre, rock, the Driller's slam and debris).
- **Reach tint:** a slower, wider noise on its edge, so the reachable area no longer runs straight along cell rows.
- **The auto-player's odd picks:** an Earth Wall only goes up between a party member and a foe 1–2 tiles off; Ice Path only
  under a foe or onto water; nobody chooses to stand on ice, oil or mud; Healing Stream only when someone is below 75%; Stone
  Stance only when hurt and threatened; the party keeps more than two tiles from the Driller (the encounter's own tip).
- The board is the content's `enc_forest_road` **'thugs' variant** now (two thugs and a slinger), not v2's one-of-each.

### Part B: the tutorial, Ba Dan → the Driller (`tutorial-demo.html`)
Faithful to `story/act1.ts`, `encounters.ts`, `enemies.ts`, `abilities/enemy.ts`, `props.ts` and `maps/combat.ts` (read-only):
1. **Ba Dan** (v13 in tutorial mode): `act1_open` narration; the objective ("Talk to Elder Mira, then take the east road" and its
   variant after Mira); Mira's, Gao's, Pella's and Dorin's talk nodes, short; Pella sets `pella_asked`. Sura and Bo walk Kaya's
   trail. The east road leaves over the rim; before Mira, Kaya is turned back with a nudge, not a wall.
2. **The Forest Road**: `road_depart`, the ambush on `FOREST_GROUND_ROWS`, `after_forest` in Kaya's voice (or the defeat lines).
3. **The Switchbacks**: a short explore beat on a board drawn for the demo (the content walks this in free-roam): three legs
   climbing out of the pines onto pale rock; tap to walk, the party follows.
4. **The Quarry Gate** (`QUARRY_GATE` rows, props and `enc_quarry_gate`): the speaker choice `gate_parley`, all three options:
   knock (deserter, thug, bruiser), the firebender's bluff (the `bluffed` variant: bruiser, quarry bender, bruiser), or the
   earthbender's kinship (no fight, Ruon's lines). Then `ruon_surrender` and `ruon_choice`.
5. **Escort**: `escort_chosen`, **The Cutting** (`AMBUSH_ROAD`, `enc_ambush`: two mercenaries and a crossbow, with Ruon fighting
   beside you), `after_ambush`. **Trade**: `trade_chosen` (Jin's lines; no fight), and the floor's `jins_people` variant.
6. **The Quarry Floor** (`QUARRY_FLOOR`, `enc_grumbler`): `quarry_descent`, then Grumbler in the Driller (2×2, 130 HP) with the
   quarry bender (or Jin's crossbow). Bo-shan's **cabbage cart is parked at (9,6) only if Pella was asked**.
7. **Victory**: the `act1_epilogue` card, **the walk home** (Ba Dan at dusk, the party in along the east road to Mira's
   `mira_epilogue`), and the end card with the teaser. Defeats follow the content's defeat nodes and carry on.
Moving between areas: a fade and the area's name. A dialogue box (tap to advance) and a choice panel that shows every option.

**New quarry terrain (one family):** three 32 px Wang sets in pro mode on the village palette: the quarry floor (fine pale
crushed limestone; the first take was cracked paving and tiled into a grid, see lessons), with Ba Dan's dirt as its haul road's
reference; the terrace (rock shelf top, a cut limestone face, its foot); the rim (the cut face over the void). Everything is
classed per pixel from the authored rows with cell values blended between centres and two to three octaves of noise, so no
edge follows the grid. Raised rock (the legend's elevation 1 and 2) shows its top, its cut face hanging 13 px a tier below the
shelf edge (sampled from the set's own face strip, ending on its own foot line), a lit lip, a dark foot, a short cast to the
lower right, a shaded right side and a lit left side. The road mouths run off the rim.

**New objects** (`create-object-pro-flash`, low top-down, the oven as the one angle reference, size in px against Kaya):
gatehouse, two curtain-wall sections, brazier, oil barrels, cabbage cart, scaffold, rails, mine cart, cut stone blocks, drill
junk, headframe, barred gallery door, tool rack, limestone rubble and boulder, lean-to. Cleaned by `t13objproc.py` (1-bit alpha,
plate peel, specks). All front-on with a shallow top (the angle table below).

**The cast:** five new characters with Kaya's settings (create-character-v3, 48 px, 8 rotations, mannequin, seed 11): the Fire
Nation deserter, the quarry bender, the mercenary, the crossbow, Captain Ruon; each an idle, a walk (`walking-8-frames`) and a
strike in skeleton-v3, eight headings (the deserter also a throw). **The Driller:** a 128 px pro-flash object (Grumbler in the
cabin), turned to eight views from that image (only the rotations charged), with a v3 object idle (shudder, smoke) and slam in
the three west headings; its slam's frame 4 has a white smear and is dropped. It sits on its 2×2 cells, jams instead of fading.

**The rules, ported (on top of v2's port):** `enc_*` rosters and variants; the enemies' real stats and kits: Rush (dash), Oil
Flask, Torch Toss, Fire Blast, Raise Rubble, Mercenary Blade (Slowed 30%), Crossbow (range 8), Ruon's Sabre and Bark an Order
(Inspired), the Driller's Slam (cone 2, knock-back), Debris Throw (3×3, rubble at the centre), Oil Spray (line 4), Churn the
Ground (5×5 mud, Rooted 50%), Raise Rubble. Props from `props.ts`: brazier (fire and coals), loose rubble (collapses), cabbage
cart ("MY CABBAGES!": Blinded 90% and a push), with vulnerable (×2) and immune types. Elevation: a step of one tier costs one
more Move, two tiers is a wall, and high ground is +10 to hit (−10 shooting up). Size-2 units occupy and are hit on all four
cells (a blast over two of them hits once). AI: one planner for every foe and Ruon, forecasting each stand × ability × target on
a copy with the real `resolve()` and scoring by role (aggressive, cautious, boss).
**Simplified (honest):** the party's growth is a stand-in (+5 HP, +1 Power a level above 1), no XP; no shove for the party;
push stops at an obstacle (no collision damage); Ruon's order is not limited to heroes; reinforcements (above three players)
are not spawned; the Driller's turn uses the same planner rather than `ai.ts`'s boss script; hit chance has the elevation term
but no plunging cover.

### The measurable checks
- **Shadow contrast** (`t13/checks.json`, every object with at least 20 visible shadow px): gate 35 objects, all ≥ 25% darker
  (min 44%, mean 63%); floor 20, all pass (min 29%, mean 56%); cutting 9, one fails (a rubble heap on a shelf lip, 7%); the
  switchbacks 99, 67 pass, 32 fail: every failure is a pine in the dense margin forest or a prop on the dark moss, where the
  ground is already about lum 48 and the one shadow colour `#322125` is lum 37 (the 25% bar is not reachable on that ground with
  the house shadow colour; the moss takes the mask ×1.45 already). Mean 37%.
- **Halo** (`tools/t13halo.py` over `assets/objects13`): zero soft-alpha pixels; zero light edge pixels in the plate zone (the
  bottom 35%) on every object except the headframe (1 px, a lit chain link). The Driller's light edge pixels are its exhaust smoke.
- **Straight terrain edges** (`edgeRunsQ`): the longest boundary run that stays on one pixel row or column is 17–23 px
  (0.5–0.7 of a tile) on every quarry board.
- **Angle table (new assets):** every object came back front-on low top-down with a shallow top: gatehouse, walls, brazier,
  barrels, cart, scaffold, mine cart, blocks, junk, headframe, gallery door, rack, rubble, boulder, lean-to. The rails lie flat
  as ground. The Driller's south view is front-on; its other seven views are PixelLab's rotations of it at the same camera.
  The characters are v3 rotations at Kaya's camera.
- **Playwright** (preinstalled Chromium): `node tools/tutrec.js file://…/tutorial-demo.html dry` plays the whole run end to end
  with no page errors and no errors inside the areas; `t13smoke.js` on forest-combat.html: victory in 3 rounds, no errors.

### Credits (this pass, by each job's own usage in `ledger.json`, entries after index 283)
**902** over 90 jobs, against the 2,500 cap: character clips 684 (37 skeleton-v3 jobs: the five new characters' idle, walk and
strike in 8 headings, the deserter's throw, the old cast's 4 missing headings ×3 clips ×5, and the five per-ability poses),
objects 102 (21 pro-flash, including the Driller twice), terrain 70 (four Wang sets, one tiles-pro), effects 21 (20 `/vfx`),
the Driller's object animations 15, characters 10. Totals: 1,870 before this pass, 2,772 after.

### Still off (honest)
- **Houses:** deeper than v12 at 2×, still quiet at 1×. A front-on redraw with a visible side would do more than code cues.
- **The Driller's slam** is PixelLab's object animation: the machine lurches and dust flies, but the drill arm barely rears.
- **Effects inside poses:** "no effects" did not hold for every clip: Kaya's Fire Blast and the deserter's punch have fire
  painted in their hands, Bo's Earth Wall shows a small earth pillar in two headings, the crossbow a blue flash in one; the
  painted `/vfx` then doubles them a little.
- **The quarry bender's strike** loses her headcloth for its middle frames (identity drift in that one clip).
- **Oil** on the floor and gate still reads a little blocky (2×2 and 2×6 authored cells), and its sheen is a texture, not a gloss.
- **Shadow contrast on dark moss** (the switchbacks' margin forest) is under 25% for 32 objects (pines and props); the bar is out of reach there.
- **Fights are long-ish** at real HP (the Driller has 130); the video steps them at 3.5×. The party's levels are a stand-in.
- **Dialogue** shows the shipped game's painted busts (tools/portraits.py, assets/portraits/; Kaya left, others right; narrators, Hanru: none); Ruon's bust does not match his sprite. Ba Dan's dusk is a tint over the day village and barely reads on video.
- The switchbacks board is the demo's own (the content walks it in free-roam).

### Lessons (this pass)
1. **Count every unsafe filename character, not one.** The brief said 1,536 files with `:`; 3,794 had spaces, commas or `@`.
   Rename with a map, keep the lookup keys, and prove the build is byte-identical before and after.
2. **A floor tileset can come back as paving.** The first quarry floor was cracked slabs and tiled into a visible grid; its
   tiles-pro variants, swapped per tile, read as square patches. Ask for "fine gravel… no cracks, no slabs, no tiles, no
   pattern", and never swap whole variant tiles on a flat floor (break it up with grit and a slow tone instead).
3. **The angle reference also fixes the pixel size.** The first Driller came back 58 px wide although the prompt said 88: with
   the oven as reference, size words lose. A boss needs a bigger canvas and a relative size ("more than twice as tall as a
   person"); the 128 px take came back 80×91.
4. **Low top-down with the oven gives the south view.** For a vehicle that must face the party, accept the south image and let
   `create-object-pro-flash` turn it (first_frame, n_directions 8): only the rotations are charged (2 credits).
5. **Object animations queue one job per direction and return at once**, so the ledger logged 0 credits. Poll each submission
   and book its own usage (`tools/t13fixcredits.py`). Their v3 motion is small, and one slam frame had a white smear.
6. **"No effects" in a skeleton-v3 prompt is a hint, not a rule.** Fire, an earth pillar and a muzzle flash were painted into
   some strike frames. Check every strike heading before adding a painted effect on top.
7. **A custom strike can drift identity** (the quarry bender's headcloth). Look at the middle frames, not only frame 0.
8. **Flames are clumps, not wallpaper.** Evenly spaced small flames read as a patterned carpet; three sizes, clumped by a slow
   noise, taller in the core, small licks at the rim, read as fire.
9. **A box hides until the ground goes dark.** The additive "flash" rectangles were invisible on v2's orange carpet and obvious
   on charred ground; the steam puffs were rectangles too. Draw stepped pixel ellipses.
10. **Blocks of authored cells stay square** unless the edge noise is slow and wide (periods 17 and 7 px, not 9 and 2.5).
11. **A fallback class makes a halo.** Classing road, then grass, else floor drew a cream band between road and grass; the
    strongest field must win (argmax).
12. **Noise alone opens specks.** Water and pits appeared as isolated pixels where the field was zero; require the field first.
13. **Check the timestamps of your own stills.** The still tool took "before" and "after" at the same moment (absolute vs
    relative time) and made the flames look unchanged.
14. **The one shadow colour has a floor.** On moss of lum about 48, `#322125` (lum 37) cannot be 25% darker; say so rather
    than inventing a second shadow colour.
15. **Sample the material, not its outline.** The houses' side-wall strip first took the corner post's outline colour and read
    as a thicker outline (the old thick-black-outline failure).
16. **Mirroring swaps hands.** v2's west rows were mirrored east rows; a club or a braid changed sides. PixelLab's own headings,
    added to the same animation group, keep identity and handedness.
17. **An iframe from a blob URL is cross-origin under `file://`**; `srcdoc` inherits the page's origin, so the shell can drive
    each area frame by frame.
18. **Look at the end of the video too.** The epilogue card first faded the board back in behind its text, over the VICTORY
    banner; a dry run reports no errors for that. Only frames show it.
19. **Jobs in parallel inflate the balance difference.** With three queues running, only the per-job usage is a credit count.


## Forest combat v2: no grid, the real elemental rules (v1 kept as `forest-combat-v1.html`, `forest-combat-v1.mp4`)

Jared: "It's not bad. I don't want the grid overview; I think it pulls from the visuals. I want the elemental play we
determined in the earlier builds to still be here as well."

**Files**
- `forest-combat.html` (v2): playable on a phone and on desktop.
  - On your unit's turn, tap the ground to walk; the reachable area is shown as a tint.
  - Pick an ability in the bar. Tap a target once to see the forecast, and again to use it. End Turn passes.
- `forest-combat.mp4`: about 82 s, the demo playing itself through the same calls.
- `forest-overview.png`: the whole board at 1×.
- Source: `src/fc/rules.js` (the ported rules), `src/fc/surfvis.js` (surfaces, previews, pixel font, tooltip),
  `src/fc/combat.js` (turns, movement, resolution and playback, the bandit AI), `src/fc/auto.js` (the recorded
  demo's chooser).

### 1. No grid
- The dotted grid, cell outlines and per-cell squares are gone everywhere. Movement is still tile-based underneath.
- **Where a character can walk:** a low-alpha warm wash with a dithered rim. It is the union of reachable cells,
  blended between cell centres and broken up with value noise, so it follows the ground, not squares.
- **The walk:** a dotted trail of paired footprints, then a gold ring at the destination.
- **Targets:** a thin ring on the ground under each figure the blow will hit (red for foes, gold for friends). An
  area move shows its shape as an organic ember-red wash.

### 2. The real rules, ported (read-only sources, `Avatarrpg/src`)
- **Surfaces:** `content/surfaces.ts`, verbatim: water, ice, fire, mud, steam, oil and rubble, with their move cost,
  enter damage and status, and default durations. Steam's obscurement is −25 to hit a target inside and −15
  through it.
- **Combos:** `content/combos.ts`, the whole table. Fire on oil becomes fire (3 rounds, spread 1, Burning). Fire on
  water makes steam. Water on fire douses it. Fire on ice melts it to water. Cold or ice on water freezes it (Frozen
  60–75%). Earth on water makes mud, earth on fire smothers it, earth on ice leaves rubble. Water on rubble makes mud.
  Lightning chains through water. Air fans fire and scatters steam. Water on oil floats.
- **The engine:** `core/rules/surfaces.ts`, ported function for function.
  - `applyImpact`: first matching rule wins; chain rules resolve before the tile changes.
  - `paintSurface`: combos get first refusal, the same surface refreshes.
  - `tickSurfaces`: durations fall, expired surfaces fade, and fire with spread crawls one ring a round against a
    snapshot, onto bare ground and eagerly onto oil.
  - `contactEffects`: applied on each step a unit takes, so walking through fire burns.
- **Statuses:** `content/statuses.ts` and `core/rules/status.ts`.
  - Burning: 3 fire damage at the owner's turn start, −1 Defence, 3 rounds.
  - Wet: ×0.5 fire, ×2 lightning, ×1.5 cold, and it clears Burning.
  - Chilled, and Frozen (skips the turn, Chilled again upgrades to Frozen).
  - Shocked, Rooted, Slowed, and Guarded (+3 Defence, ×0.75 fire and physical).
  - Statuses tick at the owner's turn start, before the turn's AP and Move are refreshed (`turnStart.ts`).
- **Damage and hits:** `core/rules/damage.ts`.
  - Damage is (base + scale × Power) × variance (0.9–1.1) × the incoming multiplier, minus Defence, at least 1.
  - Hit chance is 90, −20 for cover when not adjacent, plus status accuracy and steam, clamped to 5–99.
- **Resolution order:** `core/rules/abilities.ts`: units on the tiles are hit, then props on those tiles take damage
  (and break), then the damage type's impact lands on the ground. A Fire Blast on the oil flask cracks it, spills
  oil over its 3×3 and then lights it (CLAUDE.md: prop damage resolves before the impact).
- **Props:** `content/props.ts`.
  - Oil flask: HP 4, breaks into oil, radius 1, permanent.
  - Water barrel: HP 6, blocks, cover; breaks into water, radius 1, 4 rounds.
  - Hay bale: HP 5, blocks, cover; fire lights it, and it bursts into fire, radius 1.
  - The puddle is the authored permanent water surface; the rubble heaps are rubble surfaces (cover, cost 1).
- **Shapes:** `core/rules/grid.ts` `lineTiles`, `coneTiles`, `blastTiles`, and Chebyshev distance for range.
- **Kits:** `content/characters.ts` ladders, levels 1 and 2 plus the level-3 choice, with the real ranges, AP,
  cooldowns, areas and chances from `content/abilities/`.
  - **Kaya:** Fire Jab (1 AP, range 5), Flame Arc (2 AP, cone 3, Burning 50%), Fire Blast (2 AP, range 6, 3×3,
    Burning 40%).
  - **Sura:** Water Whip (1 AP, range 5, Wet 75%), Ice Path (2 AP, line 4, ice for 3 rounds, cooldown 2), Healing
    Stream (2 AP, heal 8 + 0.8 × Power, cleanses Burning).
  - **Bo:** Rock Throw (1 AP, range 5, earth: smothers fire, makes mud), Earth Wall (2 AP, line 3, a wall for
    3 rounds that blocks move and sight and won't rise under anyone), Stone Stance (1 AP, Guarded).
  - **Bandits:** Club Swing (2 AP, adjacent) and Sling Stone (2 AP, range 6).
- **Stats:** element bases (`content/elements.ts`) plus each character's statMods. The enemies use `enemies.ts`
  (thug 28 HP, slinger 22, bruiser 42).
- **Turns:** initiative by Speed each round, 4 AP plus a separate Move pool. Moving through water, mud, oil or
  rubble costs one more. Surfaces tick at the end of the round.
- **Forecast:** before you confirm, `forecast()` deep-copies the board and runs the very same `resolve()` on the copy
  (every hit assumed, expected damage, chances reported). The plaque lists, for example, "Bandit −11 70%" (the hay
  gives him cover), "Bandit Burning 100%", "Breaks Oil Flask", "Leaves Oil", "Ignites Oil", "Makes Steam",
  "Douses Fire". The text comes from the combo rules that would fire, not from a hand-written description.
- **Bandit AI** (in the spirit of `core/rules/ai.ts`):
  - every reachable tile is scored on whether it can strike from there and how close its prey is;
  - fire costs heavily, both standing in it and walking through it; oil and steam less;
  - the slinger prefers cover and keeps out of melee;
  - it then spends its AP on the weakest target in reach (two club swings when adjacent, as the real 2-AP costs
    allow).

### Surface visuals (the pixel family, code-animated)
- Each surface's cells are blended into one organic shape with noise-broken edges (`organicMask`), never squares.
- **Oil:** a dark film with violet and green sheen.
- **Fire:** scorched glowing ground with small looping flame tongues (ember red, orange, a yellow tip) and a
  flickering warm glow.
- **Steam:** grey puffs drawn over the figures, drifting up and right.
- **Water** (barrels, melted ice): blue pools with a dark rim.
- **Ice:** pale blue with white cracks.
- **Mud:** dark wet brown.
- **Earth Wall:** a PixelLab sprite rising out of the road.
- **Figures:** Wet figures are tinted on their own pixels and drip. Chilled and Frozen get a frost tint (Frozen
  also an ice outline). Burning figures carry Kaya's ember VFX. Each status shows as a small coloured pip by the HP
  bar.

### 3. Fixes from v1
- HP bars now sit under the feet and show only when hurt, acting or targeted, so nothing draws over a head. Figures
  y-sort by their feet.
- The creek's alders and bushes are Ba Dan's own sprites darkened and cooled for the pine forest.
- The bruiser's west-facing frames had a PixelLab artifact (a second head). Every bandit's west row is now its east
  row mirrored.

### What the recording shows (82 s)
1. The ambush. The move preview tint, then footprints to the ring.
2. Kaya's forecast over the flask: "Bandit −11 70%, Bruiser −9 90%, Burning, Breaks Hay Bale, Breaks Oil Flask,
   Leaves Oil, Leaves Fire, Ignites Oil". Fire Blast then lights a burning pool across the oil, hay and grass.
3. Her second Blast breaks a water barrel into the flames: "Douses Fire" and "Makes Steam" (water on fire).
4. The slinger's stones from cover. Sura's Water Whip douses the fire under the bruiser and leaves him Wet; her
   Healing Stream restores Kaya.
5. "The fire spreads!" at the round's end.
6. Bo's Rock Throws and his Earth Wall rising.
7. The bandits pathing around the flames where they can, the knockouts, and victory.

### Simplified or missing compared with the real rules (honest)
- **Turns:** no AP banking, no carried-over or pending AP, no Rush (the bandits' dash) and no shove or pull effects.
  Initiative is a plain Speed sort each round, not `turnOrder.ts`'s timeline.
- **Hit chance:** no elevation terms (the rocky bank is flat here), no plunging cover, no weather. Cover is the
  nearest cover piece on the defender's side toward the attacker, not `hasCover`'s exact geometry. No crits.
- **Props:** shoving, burning-prop spread (`ignites` and `burnsInto`) and the per-round exposure of props to fire are
  left out. The hay is lit by any fire damage on its tile and bursts at once.
- **Statuses:** the Rooted chance from mud is in, but Rooted only stops movement. Blinded, Inspired and the other
  statuses of kits not used here are not ported. Status chances roll on the demo's own seeded RNG, not the game's
  RNG cursor.
- **AI:** the bandit AI is a scored-tile heuristic in the spirit of `ai.ts`. It does not reproduce its terms
  (threat maps, obscurement, ledges, heights).
- **Kits:** only the level 1–3 abilities named above. Kaya's Fire Blast reuses her jab pose and fire VFX (no Blast
  clip exists). Sura's and Bo's abilities share their one attack pose.
- **Picks:** the recorded demo chooses with its own forecast-scored policy, so some picks are odd. Bo raises a wall
  after the threat has passed, and an early Ice Path left ice that Bo later stood on.

**Credits for v2:** 5 (the Earth Wall sprite). Everything else is code.

## Forest Road ambush: combat in the Ba Dan style (`forest-combat.html`)

Jared: "work on the combat zone and see how it looks." This is a look-and-feel test of combat in the top-down style.
It uses the same family, anchors and grounding as Ba Dan; the rules are a demo's, not the game's.

**Files**
- `forest-combat.html` (1.4 MiB): playable on a phone and on desktop.
  - Tap one of the party, tap a lit (blue) tile to move.
  - Pick a blow in the bar, then tap a red-outlined target. End Turn hands over to the bandits.
- `forest-combat.mp4`: 56 s at 1280×720, 2× zoom, the demo playing itself with the same calls a tap makes.
  - The ambush banner, then the bandits step out of the pines.
  - Round 1: Kaya's Fire Jab hits the oil flask beside the thug, and the grass island bursts into an oil fire.
  - Sura's Water Lash, Bo's Stone Fist; the club swing, the heavy slam and the sling stones.
  - Fire Stomp, Flame Whip, the knockouts, then the victory banner.
- `forest-overview.png`: the whole board at 1×.
- `forest-bandits-sheet.png`: the cast's idle, walk and attack, south and east rows.
- Source: `src/fc/` (`head`, `world`, `units`, `fx`, `combat`, `draw`), `tools/build_fc.py`, `tools/fcgen.py`,
  `tools/fcchars.py`, `tools/fcanim.py`, `tools/fcrec.js`.

**From the real encounter** (read-only):
- **Board:** `FOREST_GROUND_ROWS` from `src/content/maps/combat.ts`, 20×12. The pine wall (T), the through-road (=),
  the nine-cell puddle (~), the two rubble heaps (r) as cover, the rocky bank (^, A) under the slinger's perch, and
  the creek (W) between alders.
- **Props:** `FOREST_ROAD.props`: the two water barrels, the oil flask at (13, 6) on the grass island and the hay bale.
- **Roadside dressing:** `scenes/forestRoad.ts`: the signpost, three split-rail fences, the woodpile stump, the
  broken cart wheel, the milestone and the lantern post.
- **Spawns:** the party at `COMBAT_PARTY_SPAWNS` (Kaya (3, 6), Sura (3, 4), Bo (1, 5)). The enemies at
  `enc_forest_road`'s positions, as one of each: thug (17, 5), bruiser (17, 7), slinger (18, 3).
- **Stats:** from `enemies.ts` (HP 28 / 22 / 42, move 4 / 4 / 3). The party's HP and damage are raised for the demo.

**Look**
- **Terrain:** drawn per pixel from pure PixelLab tiles, so every edge wanders:
  - a forest-floor and dirt-road set (anchored on Ba Dan's grass and dirt);
  - creek water;
  - dark moss, fern and root variants;
  - sunlit grass only in dapples.
  The road's verge darkens and tufts creep onto it. A mud bank runs along the creek. The puddle is the creek's
  water, silted, with a dark wet rim.
- **Objects:** pines (3), boulders, rubble, the oil flask, hay bale, stump, cart wheel, milestone, a log and the
  puddle are new. They were made with `create-object-pro-flash`, low top-down, with the same oven as the one angle
  reference. Barrels, signpost, fences, lamp and bushes are Ba Dan's own.
- **Shadows:** every object, tree and figure is grounded by the ported Imagination `grounding.js` (trees with
  TREE_SUN2), with grass kits on the floor and the hard-floor notch on the road.
- **Edges:** the frame darkens in hard steps where the forest closes in.
- **Grid:** faint dotted corners and ticks over walkable ground, so the art still reads. Move range is a soft blue
  wash, targets a red outline, the selected unit has gold corner ticks.
- **UI:** HP bars, white hit flashes with a small knock-back, damage numbers in pixel digits. A KO sinks and fades;
  "AMBUSH!" and "VICTORY" banners.

**Cast (PixelLab, Kaya's v7 settings: `create-character-v3`, 48 px, 8 rotations, mannequin)**
- **The thug:** a club and a rust headscarf.
- **The slinger:** hooded, masked, with a sling.
- **The bruiser:** a 56 px canvas, so bigger, with a cudgel.
- **Sura and Bo:** from their G1 design descriptions in `art/source/party-g1`.

Each has an idle, a walk (`walking-8-frames`, skeleton-v3) and an attack (custom skeleton-v3: club swing, sling
throw, heavy slam, water push, stomp and punch), in four headings. Kaya is v2 with the v4 bends and their fire VFX,
untouched.

**Abilities (demo):**
- **Fire Jab:** a fireball along a line, up to 6 tiles. It can be aimed at the oil flask.
- **Flame Whip:** the three tiles in front.
- **Fire Stomp:** all eight around Kaya. It ignites the flask if adjacent.
- **Oil + fire:** a burning 3×3 for three rounds, 4 a round to anyone standing in it. The burning surface is a
  noise-shaped pool of glow with Kaya's ember VFX as flames.
- **Water Lash (Sura, range 1–3) and Stone Fist (Bo, adjacent):** pixel water and dust effects.
- **Bandit AI:** each walks to the reachable cell nearest a target, avoiding fire, and strikes the weakest in range.

**Credits:** 293 over 35 jobs:
- five characters, 10;
- fifteen four-direction animations, 180;
- two tilesets and variants, 40;
- twelve objects, 63.

**What is off (honest)**
- **Overlapping figures:** a 40 px cell is shorter than a 44 px figure. Units on vertically adjacent cells overlap
  (Sura's feet over Bo's head when they stand in a column).
- **The oil fire's footprint is the grass island's 3×3 square.** The glow is noise-shaped per cell, but the pool
  still reads squarish.
- **Bandit and ally attacks show only their PixelLab pose plus a small code effect** (flash, dust, a water ribbon,
  a stone). Only Kaya has painted VFX.
- **The creek-row alders and bushes are Ba Dan's round trees**, a little bright for the pine forest.
- **The bruiser's slam and Bo's punch have no hit-stop.** Hits read by flash, number and knock-back.
- **Four headings only for the new cast** (Kaya has eight). Diagonal moves snap to the nearest side.

## v12: Jared's eight points on v11 (v11 kept as `badan-topdown-v11.html`, `badan-overview-v11.png`, `badan-tour-v11.mp4`)

**Files:** `badan-topdown.html` (v12), `badan-overview.png`, `badan-tour.mp4` (43.8 s, 1280x720), `badan-fixes-v11-v12.png` (items 1-8 at 3x, v11 left, v12 right).
**Build:** `sh tools/v12build.sh` (outline fix, house cues, bridge, `assemble12.py` -> `src/game12.js` from `src/v12/`, `build12.py`; sprites in `assets/objects12/`, v8 sprites untouched).
**Checks:** `tools/v12scan.py` (outline thickness), `tools/v12rim.js` (trunk margin and canopy over the void), `tools/v12cat.js` (cat route vs sprites and solids), `tools/v12play.js` (page errors, walking over the bridge, talk), `tools/v12zshot.js`, `tools/record12.js`.
**Credits: 0** (no PixelLab job; the bridge is composed in code from the village's wood and stone ramps, `tools/v12bridge.py`).

1. **Waterfall.** The canal's water and kerbs now run to the west lip (the two tiles under the grass lip take the canal's own columns), so the end lines up with the cliff edge at the canal's rows (y 438-463, lip x 50). `drawSpill` pours it over: speed streaks that lengthen toward the lip, a light crest with flickering foam, a 12 px stream down the face that scrolls bright streaks and fades over 190 px, spray off the lip, droplets and mist in the void. All of it is a function of `clock`.
2. **Bridge (v12b, replaces the code-composed one; that v12 is kept as `badan-topdown-v12.html`).** PixelLab `create-object-pro-flash`, view low top-down, the oven as the one angle/style reference, 64x64 canvas, three seeds (11, 22, 33; 5 credits each, 15 total); seed 33 chosen by eye at 3x (both abutments visible, deck, posts and rails), cropped to 43x48 and sat on both kerbs, deck walkable 20 px, shadow from the ported mask with its base at the deck front plus a strip on the water. `bridge-v11-v12-v12b.png` shows all three. (v12's code-composed sprite, rejected: a flat ladder from straight above, plain abutments.) The paragraph below describes that rejected one.
   New composed sprite (60x72): stone abutments on both banks (lit top, coursed south face, outlined in the stone's dark tone), a plank deck across the whole canal, front beam visible, posts and rails, shadow on the water to the lower right. Deck walkable 24 px; the wings are solid.
3. **Houses.** Sprites: eave shadow band (3 px) under every roof edge, lintel shadow on dark openings, plinth foot darkened over 3 rows. Ground: a doorstep slab that runs 6 px onto the lane (not the merchant house, which has broad steps in its art), wall-foot band, and a skirt (worn-earth spills, pebbles, grass and moss) drawn over the plinth's bottom rows so the base is no clean line, on cobble as well as grass. **Partly:** houses are front-on, so no side wall is visible; the gain is real but subtle at 1x.
4. **Outlines.** `tools/v12scan.py` measures the run of near-black (max channel < 64) pixels inward from every boundary pixel. 43 sprites had at least 15% of their boundary 2+ px thick (list below); each was recoloured: layer 1 is a 1 px outline in material x 0.52 pulled toward #322125, deeper layers take the material tone, and foliage pockets become dark leaf instead of black. The lamp is now iron grey, not black. Table: share of boundary 2+ px / 3+ px, before then after (the remainder are dark materials such as the lamp, rain barrel and stone lantern, whose own 1 px outline is under the scan's 64 threshold).

| asset | before | after |
|---|---|---|
| barrel | 73% / 55% | 12% / 6% |
| barrels | 38% / 20% | 11% / 7% |
| beehive | 17% / 9% | 6% / 3% |
| bench | 15% / 11% | 2% / 2% |
| bridge | 17% / 7% | 4% / 3% |
| bucket_broom | 43% / 23% | 2% / 1% |
| bush | 44% / 33% | 12% / 3% |
| cookpot | 26% / 13% | 6% / 2% |
| crates | 21% / 9% | 5% / 4% |
| crates_barrel | 22% / 13% | 8% / 4% |
| drain | 35% / 3% | 0% / 0% |
| dummy | 35% / 13% | 6% / 2% |
| firewood | 33% / 22% | 1% / 0% |
| flower_pots | 50% / 27% | 9% / 3% |
| handcart | 22% / 13% | 7% / 5% |
| haystack | 45% / 21% | 0% / 0% |
| house_gao | 50% / 21% | 4% / 2% |
| house_merchant | 42% / 29% | 6% / 3% |
| house_mira | 18% / 15% | 4% / 2% |
| house_ne | 19% / 14% | 8% / 4% |
| house_pella | 40% / 11% | 5% / 2% |
| house_se | 21% / 8% | 4% / 2% |
| lamp | 88% / 28% | 31% / 11% |
| market_veg | 18% / 9% | 8% / 1% |
| mira_table | 15% / 7% | 6% / 3% |
| notice_board | 17% / 9% | 3% / 3% |
| oven | 25% / 12% | 8% / 4% |
| planter | 25% / 12% | 4% / 2% |
| pots | 36% / 24% | 14% / 7% |
| produce | 29% / 3% | 3% / 0% |
| rain_barrel | 71% / 51% | 20% / 8% |
| sack | 53% / 24% | 8% / 5% |
| sacks | 28% / 14% | 7% / 4% |
| shrine | 89% / 21% | 14% / 1% |
| signpost | 29% / 21% | 8% / 7% |
| stall | 18% / 13% | 7% / 5% |
| stone_lantern | 38% / 10% | 20% / 3% |
| target | 43% / 32% | 5% / 2% |
| tree | 53% / 41% | 14% / 6% |
| tree_blossom | 42% / 17% | 10% / 3% |
| tuft | 45% / 23% | 9% / 3% |
| well | 18% / 9% | 5% / 2% |
| wheelbarrow | 52% / 30% | 10% / 4% |
| woodshed | 24% / 18% | 4% / 3% |

5. **Lamp glow.** The glow was centred on the sprite's width/2 and a fixed y of 12; the lantern is about 10 px right and 17 px lower. The glow is now centred on the centroid of the lit glass pixels measured from the sprite (28, 29), with the same world coordinates as the sprite in game and overview.
6. **Cat.** The old route (200-356, y 836) ran behind a tree trunk and over the planter (the check found 2,638 sprite-overlap samples in front of it). New route: the south lawn at y 884 from x 335 to 455; 3,637 samples, zero overlaps, zero solids.
7. **Rim trees.** A trunk now roots at least 22 px inside the grass lip and a crown may overhang by at most 14 px (fixed point over the rim's bites). The north-rim trees moved down and in; the right-rim bushes moved in. `tools/v12rim.js`: smallest trunk margin 17 px to the cliff face's void; the one crown with real overhang is the blossom tree at the north-east (6%).
8. **Laundry line.** Moved to bare grass in the yard east of the north-east house (1066, 252), posts grounded, nothing overlapping. The flowers beside the old spot and the ones under the woodshed are gone, with a tuft.

**Still off:** the waterfall is a code-drawn stream, not painted art, and the camera clamps at the world's west edge so it always sits at the screen's left edge. The house cues are quiet at 1x. There is no night in the demo, so the lamps are shown in the day.

## v11: a polish pass (v10 kept as `badan-topdown-v10.html`, `badan-overview-v10.png`, `badan-tour-v10.mp4`)

Jared on v10: "V10 is way better. Let's get another pass."

**Files**
- `badan-topdown.html`, `badan-overview.png`, `badan-tour.mp4` (50 s).
- `badan-crops-v10-v11.png`: north, south and east at 3×, plus the market tables, the canal bridge, the riverside
  steps and the east bridge, each with v10 above v11.

**What changed**
- **Shadows on paving read at 1×.** On hard floors the same ported mask is laid a notch darker: ×1.3, so seam 228,
  band 182, cast 162 of 255. This is the floor reaction ART_DIRECTION §3 allows. The grout and grit reaction stays.
  Figures' pools are alpha 170 on soft ground and 205 on cobble, against 153 before. They are still Imagination's
  60%-of-body ellipse.
- **The tea table** was retaken: one small teapot and three bowls.
- **The handcart** became a front-on wheelbarrow: the wheel faces the camera and the handles run back.
- **The canal bridge, the east bridge and the riverside steps are now low top-down 3/4 like the props.**
  - The canal bridge's deck recedes up the picture between its rails and stands on two stone abutments on the south
    bank, with its shadow on the water.
  - The east bridge shows its long front beam, its rails and a stone abutment on the rim.
  - The steps show each tread and riser.
- **House texture: skipped.** A whole-house edit risks the look Jared liked, so the v9 houses are unchanged.

**Credits:** v11 used 26 over 5 jobs (pro flash retakes).

**Still off:**
- The canal bridge's north end meets the north bank without an abutment of its own.
- The east bridge is short (87 px) and ends in the dark a little before the frame's edge.

## v10: Jared's own shadows, one camera (v9 kept as `badan-topdown-v9.html`, `badan-overview-v9.png`, `badan-tour-v9.mp4`)

Jared on v9: "Better. But still off. Focus on angles and shadows."

**Files**
- `badan-topdown.html`: v10, playable on a phone and on desktop.
- `badan-overview.png`: the whole map at 1×.
- `badan-crops-v9-v10.png`: the three crops at 3× (north, south, east), plus the market tables and the market stall,
  each with v9 above v10.
- `badan-tour.mp4`: 50 s at 1280×720, the v9 route.
- Tools:
  - `tools/v10obj.py` and `v10/items.json`: the retakes.
  - `tools/v10specks.py`: drops detached chips from sprites (a stray stick beside the shrine, loose wood chips under
    stacks).

### Shadows: a straight port of Imagination's `grounding.js`
`hardShadowMask`, `closeHoles` and `crownShadowMask` are copied verbatim from `imagination/src/game/grounding.js`.
Only `export` is dropped, and its `put` is renamed `gput`, because the demo's `put` places objects. My v9 silhouette
projection is gone.

The options are Imagination's own, from `island2/dress2.js` `shadowOpts2`:
- **Props, bushes, the well and the tables:** `{ overhang: max(8, 15% of the width) }`.
  - Every column stands on its own foot.
  - The 175/150 seam and the 140 contact band run under each foot.
  - The 125 cast runs to the lower right, squashed to 0.35 and capped by `reach` (12–24 px).
  - A wide round base (the well) follows its curve.
  - A tabletop between its legs casts from the image base, so its shadow sits under the top, between the legs.
  - Nothing here needed `base` or `hitch`; the defaults handled the tables.
- **Trees:** `TREE_SUN2` = `{ dir: {x: 0.42, y: 0.3}, foot: 8, sweep: 1 }`, reach a third of the height, at most 52.
  The crown and trunk cast one joined shadow from the roots.
- **Houses:** the same function with `{ overhang, band: 6 }`: the default short cast (at most 24 px) and the heavy
  contact band (ART_DIRECTION §5). The trodden-earth wall-foot strip along each plinth is kept.
- **Figures:** Imagination's character rule (ART_DIRECTION §2, `bodyblob2.bodyBlob` → `feetBlobMask`). A flat hard
  ellipse 60% of the figure's opaque width, a third as tall, `#322125` at alpha 153, centred under the feet. v9's
  lean is removed.
- **Floor reaction:** on paving, the floor still reacts 2–5 px under the seam (grout darkened, a little grit), now read
  from the mask's own seam row.

**Shadow check.** The (A) shadow table below is re-measured with the ported masks. All 77 objects' visible
shadows are at least 27% darker than the ground beside them (mean 40%). They are shorter
than v9's, so the numbers are lower, but there are no smudges.

### Angle table (v10)
The target, matching the houses, is front-on low top-down: front faces square to the camera, top surfaces visible as
a shallow slanted band.

| asset | view before v10 | top surface | v10 |
|---|---|---|---|
| house_gao, house_mira, house_pella, house_ne, house_se, house_merchant | front-on low top-down | roof slope and plinth top, shallow | kept (the angle reference set) |
| barrel, rain_barrel, barrels | front-on low top-down | lid ellipse, shallow | kept |
| pots, flower_pots, sack, sacks, bucket_broom | front-on low top-down | rims, shallow | kept |
| stone_lantern, well, woodshed, stall | front-on low top-down | roof caps, shallow | kept (v9 front retakes) |
| oven, cookpot, haystack, dummy, target, signpost, lamp, shrine, fence, banner_pole, laundry_line | front-on low top-down | small tops, shallow | kept |
| mira_table, market_veg, market_jars | 3/4 corner (v8/v9) | tabletop seen corner-on, steep | v10 retake (oven reference, low top-down) |
| crate, crates, crates_barrel, produce, planter, beehive | 3/4 corner | two faces showing, corner on | v10 retake (oven reference, low top-down) |
| firewood | 3/4 diagonal stack | log ends turned to the side | v10 retake (oven reference, low top-down) |
| bench, handcart, trough, herb_shelf, notice_board | 3/4 corner | corner on | v10 retake (oven reference, low top-down) |
| garden | high top-down (near plan) | bed seen almost from above | v10 retake (oven reference, low top-down) |
| tree, tree_blossom, bush, flowers, tuft | front-on low top-down | crowns, n/a | kept |
| bridge, walkway, steps | flat ground pieces (decks lie on the floor) | deck seen from above as part of the floor | kept: they are ground, drawn on the floor layer |

**How the retakes were made.**
- **Recipe:** 16 retakes, following Imagination's recipe in `PIXELLAB_CONSISTENCY.md`: `create-object-pro-flash`,
  `view: "low top-down"`, one direction.
- **Angle reference:** ONE reference image in every prompt, the front-on oven, with a usage description that
  spells out the camera.
- **Size:** each item's size is stated in pixels against Kaya (44 px tall), on a canvas at least 44×48 so the
  reference fits.
- **Results:** every retake came back front-on, at 20–53 px wide, the same size as the pieces they replace. They
  were cropped, hardened to 1-bit alpha, de-speckled and outline-closed.
- **Halo scan (B):** still zero on every object.

### (A) Shadow table (v10, ported masks)
| object | at (x, base) | visible shadow px | shadow lum | ground lum | darker |
|---|---|---|---|---|---|
| tree_blossom | (1150, 190) | 892 | 68 | 93.6 | **27%** |
| lamp | (330, 412) | 185 | 74 | 109.2 | **32%** |
| bench | (118, 428) | 277 | 73.6 | 109.2 | **33%** |
| lamp | (1028, 486) | 185 | 83.8 | 124.8 | **33%** |
| banner_pole | (564, 340) | 255 | 68.7 | 102.6 | **33%** |
| signpost | (1056, 500) | 108 | 73 | 108.9 | **33%** |
| tree | (150, 160) | 2327 | 84.7 | 126.7 | **33%** |
| bush | (1138, 870) | 208 | 43.5 | 65.1 | **33%** |
| tree_blossom | (790, 236) | 855 | 83.4 | 126.3 | **34%** |
| lamp | (948, 486) | 185 | 82.3 | 125.1 | **34%** |
| tree | (300, 850) | 2351 | 83.9 | 128.7 | **35%** |
| tree | (1080, 150) | 2344 | 85.4 | 132 | **35%** |
| tree | (110, 300) | 1866 | 85.1 | 131.9 | **36%** |
| house_mira | (688, 336) | 1312 | 66.6 | 103.5 | **36%** |
| bush | (520, 300) | 133 | 71.3 | 111 | **36%** |
| dummy | (214, 384) | 119 | 74.7 | 116.5 | **36%** |
| tree | (104, 620) | 2351 | 84.9 | 133.2 | **36%** |
| tree_blossom | (270, 140) | 892 | 85.9 | 135 | **36%** |
| tree | (700, 132) | 113 | 87 | 137.2 | **37%** |
| tree_blossom | (556, 880) | 892 | 87 | 137.4 | **37%** |
| bush | (1170, 250) | 208 | 42.8 | 67.8 | **37%** |
| tree_blossom | (884, 652) | 798 | 84.7 | 134.1 | **37%** |
| planter | (380, 830) | 223 | 64.1 | 101.6 | **37%** |
| haystack | (1112, 414) | 244 | 71.6 | 113.7 | **37%** |
| target | (150, 372) | 384 | 84.5 | 134.4 | **37%** |
| bush | (1150, 700) | 208 | 71.8 | 114.3 | **37%** |
| tree_blossom | (120, 760) | 646 | 85.2 | 136.1 | **37%** |
| tree | (180, 860) | 2351 | 85.1 | 135.9 | **37%** |
| bush | (1170, 640) | 208 | 42.3 | 67.8 | **38%** |
| signpost | (818, 866) | 108 | 70 | 112.3 | **38%** |
| tree | (400, 150) | 695 | 85.6 | 137.7 | **38%** |
| bush | (480, 852) | 208 | 71.4 | 115.3 | **38%** |
| fence | (330, 340) | 222 | 66.8 | 107.9 | **38%** |
| well | (600, 640) | 333 | 68.8 | 111.3 | **38%** |
| sacks | (352, 318) | 80 | 67.9 | 110.5 | **38%** |
| notice_board | (872, 474) | 205 | 70 | 113.9 | **39%** |
| bush | (700, 880) | 208 | 65.8 | 107.4 | **39%** |
| woodshed | (1080, 340) | 549 | 81.3 | 133.8 | **39%** |
| fence | (196, 300) | 357 | 76.4 | 126.2 | **39%** |
| lamp | (948, 604) | 182 | 82 | 135.4 | **40%** |
| stall | (262, 650) | 580 | 80.6 | 133.6 | **40%** |
| oven | (318, 324) | 94 | 67.6 | 112.6 | **40%** |
| house_ne | (912, 336) | 1060 | 61.4 | 103.1 | **40%** |
| cookpot | (646, 392) | 215 | 74.4 | 125.2 | **41%** |
| house_pella | (448, 812) | 851 | 51.9 | 87.6 | **41%** |
| beehive | (150, 700) | 155 | 58 | 98.7 | **41%** |
| shrine | (716, 456) | 389 | 64.1 | 109.5 | **41%** |
| mira_table | (560, 402) | 231 | 63.3 | 108.3 | **42%** |
| flower_pots | (520, 828) | 93 | 62.5 | 106.7 | **42%** |
| flower_pots | (958, 346) | 106 | 62.8 | 107.5 | **42%** |
| bush | (860, 130) | 127 | 80.4 | 137.7 | **42%** |
| fence | (330, 296) | 81 | 75.6 | 129.6 | **42%** |
| market_jars | (412, 404) | 325 | 63.1 | 108.5 | **42%** |
| house_gao | (448, 336) | 953 | 61.5 | 106 | **42%** |
| house_se | (1002, 812) | 1291 | 70.5 | 121.5 | **42%** |
| trough | (1090, 650) | 209 | 72.2 | 125.8 | **43%** |
| market_veg | (776, 402) | 272 | 64.1 | 112.5 | **43%** |
| sack | (860, 376) | 105 | 61.9 | 109.2 | **43%** |
| house_merchant | (735, 812) | 1656 | 54.6 | 97.4 | **44%** |
| barrel | (505, 344) | 138 | 64.3 | 115.1 | **44%** |
| bush | (968, 852) | 208 | 74.8 | 134.5 | **44%** |
| stone_lantern | (330, 736) | 194 | 76.7 | 138.2 | **44%** |
| pots | (212, 650) | 133 | 72.2 | 130.7 | **45%** |
| firewood | (1092, 838) | 210 | 74.7 | 135.2 | **45%** |
| handcart | (968, 392) | 232 | 66.8 | 121.3 | **45%** |
| bush | (96, 360) | 208 | 74.6 | 135.4 | **45%** |
| rain_barrel | (801, 344) | 135 | 61.1 | 111 | **45%** |
| bucket_broom | (744, 344) | 138 | 60.4 | 109.7 | **45%** |
| produce | (322, 652) | 196 | 73.6 | 133.6 | **45%** |
| bush | (560, 140) | 208 | 75 | 136.6 | **45%** |
| herb_shelf | (388, 346) | 254 | 61.8 | 113.1 | **45%** |
| garden | (248, 730) | 340 | 74.1 | 136.6 | **46%** |
| laundry_line | (250, 226) | 333 | 63 | 117.9 | **47%** |
| crates_barrel | (628, 826) | 252 | 67 | 128.9 | **48%** |
| lamp | (788, 604) | 44 | 69.7 | 135.5 | **49%** |
| crates | (990, 358) | 186 | 67.7 | 135.4 | **50%** |
| bush | (78, 860) | 208 | 66.1 | 137 | **52%** |

### Credits
- v10 used **81 credits** over 16 jobs (16 retakes at 5–6 each), against your ~400 budget.
- Balance afterwards: about 14626.

### Still off (honest)
- **Shadows on cobble are subtle by design.** Imagination's short shadow (seam, contact band, cast of 12–24 px
  squashed to a third) is a dark line and a short band. On the busy grey cobble it reads at 3× as standing on its
  shadow, but at 1× it is quiet.
- **Figures' pools are small (60% of the body width).** That is Jared's character rule, so at 1× the residents' feet
  read lightly.
- **The new tea table's teapot is large for the table.**
- **The handcart is seen from its front,** with the wheel in profile at the right. It is the one retake where the
  object's front is ambiguous.
- **The bridge, the east bridge and the riverside steps are flat floor pieces seen from above.** They lie on the
  ground, so they are classified as floor, not props.
- **The redrawn houses (v9) are still a little flatter in texture than the props.**

## v9: Ba Dan redone after "Shit's floating and looks terrible" (v8 kept as `badan-topdown-v8.html`, `badan-overview-v8.png`, `badan-tour-v8.mp4`)

Jared rejected v8. The coordinator inspected it at 3× and listed seven faults:
1. invisible shadows;
2. pale backdrop plates under tables and boards;
3. houses with no cast and no wall foot;
4. rectangular terrain and a flagstone "spreadsheet";
5. a broken east exit;
6. inconsistent scale;
7. mixed angles.

v9 fixes the engine first (code, no credits), then the assets.

**Files**
- `badan-topdown.html`: v9, playable on a phone and on desktop. Controls are unchanged.
- `badan-overview.png`: the whole map at 1×, now 1248×992 (one more row of ground to the south).
- `badan-crops-v8-v9.png`: the coordinator's three crops at 3×: north (280,140,780,420), south (180,560,700,840) and
  east (840,330,1200,640). Each shows v8 above v9.
- `badan-tour.mp4`: 50 s at 1280×720.
  - From the ford over the bridge to Mira, then to Dorin's dummy for a Fire Jab and a Flame Whip (5×).
  - Along the north houses and past the watch post, out the east road and onto the bridge over the edge.
  - Down the riverside path to the steps over the south edge (5×).
- Tools: `tools/v9strip.py` (plate peel), `tools/v9trim.py` and `tools/v9outline.py` (house aprons, outline close),
  `tools/v9halo.py` (the halo scan), `tools/v9house.py`, `tools/v9props.py`, `tools/v9small.py` (generation),
  `tools/record9.js`, `v9/shadows.js` (the shadow table), `v9/overlap.js` (the sprite-overlap check),
  `v9/crops.py`.

### What changed
- **(A) Shadows you can see.** In v8 the "cast" was a band a few pixels deep that the sprite itself mostly covered.
  - Now every object's silhouette is projected onto its own ground line toward the lower right: 0.75 px right and
    0.42 px down per px of height, with the length capped by kind (props about 0.55 × height up to 34 px, trees 38,
    houses 44).
  - It is painted in #322125 at 65% over a 215/185 occlusion seam and a 170 contact band.
  - Flat dressing (flowers, tufts, the garden plot) is now drawn before any shadow, so shadows land on top of it.
  - Figures' pools are larger (80% of the width, alpha 175) and lean 3 px right and 1 px down.
  - The shadow is baked into the ground layer, which both the game and the overview render draw.
- **(B) No plates.**
  - PixelLab had baked a flat grey ground shadow (RGB 174,168,156) under 17 objects. It is peeled from the outside in,
    to true transparency, and soft alpha is hardened.
  - The enlarged houses' pale paving aprons were cut away; only the doorstep stays.
  - Any light pixel left on an object's alpha edge (plinth stones, bridge abutments) takes the dark outline tone.
- **(C) Houses.**
  - All six were redrawn 1.35× larger with `edit-image-pro-flash`, as crisp pixel art (Mira's at 1.4×). A door is now
    about 60–64 px against Kaya's 44 px figure, 1.4–1.45× her height.
  - Each house casts a 44 px shadow to the lower right and stands on a trodden-earth wall-foot band 7 px wider than
    the house each side.
  - The occlusion seam and contact band run along the whole plinth, and the plinth stands on the lane.
- **(D) Organic terrain.**
  - Roads are polylines with a width and courts are blobs (`geo.js`). Their edges wander by two octaves of value noise,
    and lone vertices are tidied away.
  - The grass↔cobble and grass↔dirt edges are then drawn per pixel (`ground.js` 1b): the corners' paving is
    interpolated across each cell and wobbled by noise, so no edge follows the tile grid.
  - The verge pass darkens the cobbles along every edge, and grass tufts creep onto them. Cobbles by a house's
    plinth get the wall-dirt tile. The flagstone grid is gone (worn cobble instead).
- **(E) Continuous exits.**
  - The east road's cobbles run over the rim's lip onto a bridge carried east over the drop. It is the canal bridge's
    own art, turned 90°, so it is the same family. The bridge leaves the map in the road's direction, with its shadow
    on the dark and its far end fading out.
  - The riverside path runs to the rim, its dirt continues over the lip, and the steps start where it ends.
- **(F) Scale.**
  - The well was regenerated at 44×57 (about 1.4 tiles wide). The stone lantern is 29×47 (Kaya is 44 tall).
  - The house rows were re-spaced. The north rim moved up a tile and the south rim down a tile, so roofs stay on the
    ground and off the road.
  - A sprite-overlap check (`v9/overlap.js`) cleared the tree through the lamp, a tree inside the north-east house,
    and the clutter by the woodshed. Bushes and trees no longer stand in fences or crates.
- **(G) One angle.** The woodshed, stall, well and stone lantern were retaken straight-on, in the same low 3/4 front
  view as the oven, herb shelf, trough and bench they were anchored on. A front-facing retake of the tables came out
  1.5× too big, so the v8 tables were kept, with their plates stripped.
- **Pathing:** the gao, pella and household routes follow the new house lines.

### (A) Shadow table
For each object, the mean luminance (0.299R + 0.587G + 0.114B) of its visible shadow, meaning mask pixels not under
any sprite, is compared with the open ground in a ring 5–6 px outside the shadow. Both are read from the finished
ground layer (`window.__shadowTable()`).
- **Result:** all 77 objects are at least 26% darker. The mean is 46%.
- **Figures:** the pools are alpha 175 of #322125, about 44% darker on this grass. They are drawn live, so they are
  not in the table.

| object | at (x, base) | visible shadow px | shadow lum | ground lum | darker |
|---|---|---|---|---|---|
| bush | (1138, 870) | 588 | 38.8 | 52.6 | **26%** |
| bush | (1170, 250) | 588 | 38.9 | 53.8 | **28%** |
| bush | (1170, 640) | 588 | 38.6 | 53.9 | **28%** |
| bush | (1150, 700) | 588 | 57.2 | 80.3 | **29%** |
| beehive | (150, 700) | 330 | 58.8 | 92.4 | **36%** |
| laundry_line | (250, 226) | 719 | 66 | 104.5 | **37%** |
| tree_blossom | (1150, 190) | 615 | 55 | 87.5 | **37%** |
| notice_board | (872, 474) | 429 | 67.2 | 112.1 | **40%** |
| haystack | (1112, 414) | 471 | 64 | 108.3 | **41%** |
| lamp | (330, 412) | 331 | 63.4 | 108.1 | **41%** |
| dummy | (214, 384) | 246 | 63.9 | 109.8 | **42%** |
| mira_table | (560, 402) | 376 | 62.7 | 109.2 | **43%** |
| planter | (380, 830) | 356 | 58.1 | 101.6 | **43%** |
| bush | (520, 300) | 408 | 62.4 | 109.3 | **43%** |
| handcart | (968, 392) | 502 | 63.3 | 111.1 | **43%** |
| market_veg | (776, 402) | 423 | 65.7 | 116 | **43%** |
| signpost | (818, 866) | 260 | 58.3 | 103.2 | **44%** |
| house_mira | (688, 336) | 3273 | 59.5 | 106.8 | **44%** |
| bench | (118, 428) | 428 | 60.1 | 108.2 | **44%** |
| market_jars | (412, 404) | 407 | 59.6 | 108.3 | **45%** |
| woodshed | (1080, 340) | 1092 | 70.9 | 129.9 | **46%** |
| signpost | (1056, 500) | 260 | 61.8 | 113.5 | **46%** |
| banner_pole | (564, 340) | 484 | 60.5 | 111.3 | **46%** |
| sacks | (352, 318) | 108 | 61.4 | 113.1 | **46%** |
| cookpot | (646, 392) | 387 | 69 | 127.9 | **46%** |
| tree | (1080, 150) | 1307 | 70.7 | 130.8 | **46%** |
| tree | (104, 620) | 1310 | 70 | 130.6 | **46%** |
| house_merchant | (735, 812) | 4103 | 55.6 | 104.1 | **46%** |
| tree_blossom | (790, 236) | 608 | 67.8 | 127.3 | **47%** |
| shrine | (716, 456) | 672 | 58.5 | 110 | **47%** |
| trough | (1090, 650) | 398 | 67.1 | 126.1 | **47%** |
| firewood | (1092, 838) | 332 | 70.9 | 133.6 | **47%** |
| tree | (150, 160) | 1302 | 69.6 | 131.1 | **47%** |
| well | (600, 640) | 593 | 58.2 | 109.9 | **47%** |
| bush | (700, 880) | 588 | 64.2 | 121.2 | **47%** |
| tree | (180, 860) | 1310 | 70.3 | 133.2 | **47%** |
| bush | (480, 852) | 588 | 67.8 | 128.7 | **47%** |
| lamp | (1028, 486) | 298 | 64.1 | 122.5 | **48%** |
| target | (150, 372) | 587 | 71.2 | 136.1 | **48%** |
| stall | (262, 650) | 1158 | 68.9 | 131.7 | **48%** |
| tree | (110, 300) | 1121 | 69.8 | 133.5 | **48%** |
| house_pella | (448, 812) | 1831 | 53.9 | 103.5 | **48%** |
| tree | (700, 132) | 58 | 71.1 | 136.6 | **48%** |
| tree_blossom | (884, 652) | 482 | 69 | 132.3 | **48%** |
| house_ne | (912, 336) | 2596 | 58.9 | 113.2 | **48%** |
| herb_shelf | (388, 346) | 627 | 57.7 | 111 | **48%** |
| bush | (560, 140) | 588 | 69.9 | 134.4 | **48%** |
| oven | (318, 324) | 132 | 60.2 | 116 | **48%** |
| lamp | (788, 604) | 173 | 70.7 | 136.3 | **48%** |
| house_gao | (448, 336) | 2762 | 57.9 | 111.7 | **48%** |
| house_se | (1002, 812) | 2785 | 66.6 | 128.8 | **48%** |
| tree_blossom | (270, 140) | 615 | 70 | 135.3 | **48%** |
| tree | (400, 150) | 359 | 70.2 | 136.4 | **48%** |
| lamp | (948, 486) | 331 | 62.5 | 121.6 | **49%** |
| fence | (196, 300) | 659 | 66.8 | 129.9 | **49%** |
| tree_blossom | (120, 760) | 356 | 69.2 | 134.6 | **49%** |
| tree_blossom | (556, 880) | 615 | 71.1 | 138.4 | **49%** |
| bush | (968, 852) | 588 | 69.8 | 135.7 | **49%** |
| bush | (860, 130) | 239 | 70.7 | 138.5 | **49%** |
| tree | (300, 850) | 1310 | 67.4 | 132.3 | **49%** |
| bush | (96, 360) | 588 | 69.7 | 137.1 | **49%** |
| flower_pots | (520, 828) | 147 | 54.3 | 107.1 | **49%** |
| fence | (330, 340) | 443 | 57.3 | 113 | **49%** |
| stone_lantern | (330, 736) | 385 | 69.6 | 137.5 | **49%** |
| crates_barrel | (628, 826) | 699 | 63.4 | 125.9 | **50%** |
| produce | (322, 652) | 384 | 67.1 | 134.3 | **50%** |
| garden | (248, 730) | 971 | 68 | 135.9 | **50%** |
| pots | (212, 650) | 176 | 63.9 | 128.8 | **50%** |
| rain_barrel | (801, 344) | 180 | 53.8 | 108.6 | **50%** |
| bush | (78, 860) | 588 | 68 | 137.7 | **51%** |
| lamp | (948, 604) | 174 | 68.4 | 138.8 | **51%** |
| fence | (330, 296) | 72 | 61.5 | 126.7 | **51%** |
| sack | (860, 376) | 158 | 53.5 | 111.6 | **52%** |
| crates | (990, 358) | 308 | 65 | 135.8 | **52%** |
| flower_pots | (958, 346) | 145 | 45.5 | 101.6 | **55%** |
| barrel | (505, 344) | 177 | 44.8 | 106.3 | **58%** |
| bucket_broom | (744, 344) | 186 | 45.1 | 110.2 | **59%** |

### (B) Halo scan
Every object's alpha edge was scanned for light, near-grey pixels (luminance over 150, spread under 30).
- **Result:** zero on every object, both in the lowest 35% (where a plate sits) and over the whole outline. No
  object has soft-alpha pixels either.

| object | size | soft-alpha px | light edge px, lowest 35% | light edge px, whole outline |
|---|---|---|---|---|
| house_gao | 182x242 | 0 | 0 | 0 |
| house_mira | 200x239 | 0 | 0 | 0 |
| house_pella | 195x235 | 0 | 0 | 0 |
| house_merchant | 246x209 | 0 | 0 | 0 |
| house_ne | 193x232 | 0 | 0 | 0 |
| house_se | 194x234 | 0 | 0 | 0 |
| barrel | 22x28 | 0 | 0 | 0 |
| rain_barrel | 22x28 | 0 | 0 | 0 |
| pots | 26x19 | 0 | 0 | 0 |
| bucket_broom | 25x29 | 0 | 0 | 0 |
| flower_pots | 26x27 | 0 | 0 | 0 |
| sack | 22x28 | 0 | 0 | 0 |
| stone_lantern | 29x47 | 0 | 0 | 0 |
| crate | 22x26 | 0 | 0 | 0 |
| barrels | 41x44 | 0 | 0 | 0 |
| crates | 40x39 | 0 | 0 | 0 |
| produce | 39x33 | 0 | 0 | 0 |
| firewood | 40x43 | 0 | 0 | 0 |
| sacks | 40x48 | 0 | 0 | 0 |
| planter | 42x33 | 0 | 0 | 0 |
| wheelbarrow | 42x34 | 0 | 0 | 0 |
| cookpot | 41x48 | 0 | 0 | 0 |
| oven | 42x47 | 0 | 0 | 0 |
| haystack | 44x44 | 0 | 0 | 0 |
| beehive | 37x41 | 0 | 0 | 0 |
| market_veg | 55x43 | 0 | 0 | 0 |
| market_jars | 53x44 | 0 | 0 | 0 |
| mira_table | 54x39 | 0 | 0 | 0 |
| bench | 48x45 | 0 | 0 | 0 |
| handcart | 52x40 | 0 | 0 | 0 |
| herb_shelf | 44x55 | 0 | 0 | 0 |
| trough | 52x41 | 0 | 0 | 0 |
| dummy | 34x47 | 0 | 0 | 0 |
| well | 44x57 | 0 | 0 | 0 |
| crates_barrel | 54x48 | 0 | 0 | 0 |
| signpost | 29x51 | 0 | 0 | 0 |
| notice_board | 43x56 | 0 | 0 | 0 |
| lamp | 37x81 | 0 | 0 | 0 |
| shrine | 74x77 | 0 | 0 | 0 |
| woodshed | 81x80 | 0 | 0 | 0 |
| stall | 77x83 | 0 | 0 | 0 |
| fence | 76x40 | 0 | 0 | 0 |
| banner_pole | 39x80 | 0 | 0 | 0 |
| laundry_line | 79x56 | 0 | 0 | 0 |
| target | 53x72 | 0 | 0 | 0 |
| drain | 51x34 | 0 | 0 | 0 |
| bridge | 112x101 | 0 | 0 | 0 |
| walkway | 101x51 | 0 | 0 | 0 |
| garden | 96x53 | 0 | 0 | 0 |
| tree | 101x121 | 0 | 0 | 0 |
| tree_blossom | 56x89 | 0 | 0 | 0 |
| bush | 36x42 | 0 | 0 | 0 |
| flowers | 70x43 | 0 | 0 | 0 |
| tuft | 39x20 | 0 | 0 | 0 |
| steps | 27x57 | 0 | 0 | 0 |

### Credits
- v9 used **89 credits** over 9 jobs: 6 house redraws at 9 each, a front-view prop batch at 15, and two
  small batches (well, lantern) at 10 each.
- Balance after: 14707. Total for v8 and v9 together: 199 + 89.

### Still not right (honest)
- **The redrawn houses are cleaner and flatter than v8's** (same-2×2 0.33–0.48 against 0.3 for the props). The edit
  smoothed some plaster and roof texture.
- **The canal's stone kerbs are still straight lines.** It is a dug channel, so I left it. Every other grass/paving
  edge wanders.
- **The cliff's south face is one straight run, and the side rims still step in right angles.** That is the PixelLab
  cliff set; the coordinator's straight-line rule was about grass and cobble.
- **The east bridge is the canal bridge rotated.** Its rails sit on its north and south edges, which reads fine at
  game zoom, but it is not a drawn-for-purpose asset.
- **The market tables are the v8 ones**, slightly corner-on, because the straight-on retake came out 1.5× too big.
- **Shadows on dark cobble are quieter than on grass.** The table measures each shadow against the ground right beside
  it. On dark cobble a 26–30% shadow is visible, but less strongly.

## v8: Ba Dan polished as a grounded diorama (v7 kept as `badan-topdown-v7.html`, `badan-overview-v7.png`, `badan-tour-v7.mp4`)

Jared: "Houses are off… give this a few passes to polish it… look at the Imagination project… ensure items don't float."
Then: "Take your time and polish this area. It needs to be good." Kaya is still v2 exactly plus the v4 bends, with no
motion layer and the bend effects untouched.

**Files**
- `badan-topdown.html`: v8, self-contained (1.6 MiB), playable on a phone and on desktop. Controls are unchanged.
- `badan-overview.png`: the final map at 1×. `badan-overview-pass1..5.png` show each pass.
- `badan-before-after.png`: v7 next to v8 on the same crops. It covers the north houses with Mira's table and the
  teapot table (his screenshot area), the canal ("pond") and bridge, the south street with the old teahouse, the
  market stall, and an edge close-up.
- `badan-tour.mp4`: 57 s at 1280×720, 3× zoom.
  - Kaya starts at the ford, crosses the bridge and talks to Mira.
  - At Dorin's dummy she does a Fire Jab and a Flame Whip (5×).
  - She goes along the north lane to Hanru, then out the east road to where it runs off the edge.
  - She takes the riverside path to the south edge and its steps into the void (5×). The tour shows the edge once.
- Sources: `src/v8/` (shadow, geo, objects, ground, residents, talk, render), `tools/assemble8.py`, `tools/build8.py`,
  `tools/record8.js`, `tools/overview8.js`; generation scripts `tools/v8*.py`; assets in `assets/objects8/`
  (manifest records each source).

### The Imagination rules, by code (`src/v8/shadow.js`)
- **One shadow colour, `#322125`, hard-edged, light from the upper left.** Every object gets:
  - an occlusion seam;
  - a contact band offset lower-right;
  - a short squashed cast to the lower right, at most about one tile.

  These are baked into a single shadow layer under all sprites.
- **On hard floors** (cobble, flagstone, paving), the object's mask also darkens the grout and adds grit at its base
  (the floor reacts).
- **On grass and dirt**, the base sinks into a soil stain with contact shading, and a fringe of tufts is drawn in
  front of the base, over the sprite.
- **Figures** (Kaya, residents, the cat) get the same colour as a calm ellipse under the feet.
- **Nothing is exempt**: houses, props, trees, bushes, the bridge (its deck shadow falls on the water) and the steps.

### Pass by pass
1. **Pass 1: grounding, plinth houses, the diorama.**
   - Houses re-edited onto stone plinths with a wall-foot band and a doorstep, standing on the lane.
   - The teahouse was restyled as a half-timbered merchant house, and two neighbour houses were added so each row
     reads as a street.
   - The ground mass ends in PixelLab cliff tiles (a 25-tile grass-to-void set) over a warm dark void with a stepped
     vignette.
   - The props were regenerated in anchor batches.
   - Found: blocky rim notches, a wide pond-like canal, flat flagstone, oversized drains, blue puddle glitter, one
     huge cobble field, and a tree on cobble.
2. **Pass 2: the canal and the floor.**
   - The canal narrowed to one channel between stone banks. The bridge and the dry crossing are the only ways over.
   - The rim bites became runs of 4 or more, one tile deep.
   - Flagstone variants added, drains removed, puddles thinned, the east plaza shrunk.
   - The court tree moved into a grass pocket, and props moved and added.
3. **Pass 3: the exits.**
   - A separate flooded ford closes the west end of the road.
   - The canal spills off the west rim as a falling sheet.
   - The stall moved below the spawn, and crates moved off the walking line.
   - More rim trees overhang the edge. The garden and lantern moved down.
4. **Pass 4: the edge and the floor, by eye at 2×.**
   - Black notch squares fixed: cliff corners that PixelLab never drew now fall back to the nearest pattern.
   - The south face is straight. The bites stay on the thin sides, because the south face is the one the eye reads.
   - Trees, bushes, tufts and flowers are clamped so they root on the ground, never on the cliff face. Their crowns
     still overhang the edge.
   - The riverside path runs to the rim and goes over as a flight of dirt steps fading into the dark. In v7 it was a
     translucent smear.
   - The north lane gets grass verges either side of the bridge approach, which breaks up the cobble field.
   - Removed the moss and puddle cobble variants and the cracked or mossy flagstones. They read as vines, broken
     glass and twigs.
   - The dark-band cobble is only placed where a plinth actually sits on it.
   - Rim trees that were clamped in front of house doors were moved. The court tree that hid Kaya at the dummy was
     removed, and the bench moved to the canal bank.
   - Two pathing fixes:
     - Talk spots must be reachable on the path grid.
     - The grid keeps clearance from corners, and Kaya re-plans if she stalls. She used to get pinned on Mira's
       table corner.
5. **Pass 5: the market stall.** It was the last off-density asset (same2×2 0.64). It was regenerated against
   v8's own market tables as the anchor (0.27), and its baked grey shadow was peeled off so the one shadow rule
   draws it.

### Jared's notes, checked off
- [x] **(1) Idle too strong ("gasping").** Each heading plays only the idle frames whose head stays within 1 px of
  the rest pose, ping-ponged slowly (420 ms a frame). The same code drives every resident's idle.
- [x] **(2) Canal bank and bridge match.** The bridge was generated with the canal's own bank tiles as the style
  anchor, so they share the stone and wood palette. Its abutments sit on the bank stones, it has an occlusion line,
  and its deck shadow falls on the water.
- [x] **(3) Ground every placed object.** No exceptions (see above).
- [x] **(4) One pixel density.** Offenders regenerated: the low-res barrels, the high-res fruit and sign, the
  mismatched tables, the stall. See the log below.
- [x] **(5) Same low top-down 3/4 angle.** All props come from anchor batches with the same view prompt. The stall
  is the closest to an oblique corner view (see below).
- [x] **(6) Water, lights, birds and bugs kept as they were.**
- [x] **(7) Trees and grass don't float.** Each has a sunk base, a soil stain, contact shading, front tufts and the
  shadow rule, and is clamped onto the ground at the rim.

### Pixel density log (effective size and same-2×2 fraction; higher means chunkier, upscaled art)
| asset | v7 size | v7 same2×2 | v8 size | v8 same2×2 | v8 source |
|---|---|---|---|---|---|
| house_gao | 149x185 | 0.47 | 150x185 | 0.38 | house_ochre_plinth.png |
| house_mira | 151x178 | 0.4 | 153x180 | 0.35 | house_cream_plinth.png |
| house_pella | 151x178 | 0.35 | 159x178 | 0.37 | house_green_plinth.png |
| house_merchant | 183x160 | 0.46 | 186x163 | 0.27 | v8_merchant.png |
| house_ne | - | - | 153x180 | 0.36 | v8_neighbour_b.png |
| house_se | - | - | 159x178 | 0.27 | v8_neighbour_a.png |
| barrel | 32x21 | 0.23 | 22x28 | 0.12 | v8_scale_A_frame_0.png |
| rain_barrel | - | - | 22x28 | 0.13 | v8_scale_A_frame_1.png |
| pots | 26x16 | 0.04 | 26x19 | 0.1 | v8_scale_A_frame_2.png |
| bucket_broom | - | - | 25x29 | 0.1 | v8_scale_A_frame_3.png |
| flower_pots | - | - | 26x27 | 0.1 | v8_scale_A_frame_4.png |
| sack | - | - | 22x28 | 0.18 | v8_scale_A_frame_5.png |
| stone_lantern | 24x42 | 0.03 | 19x28 | 0.14 | v8_scale_A_frame_6.png |
| crate | - | - | 22x26 | 0.03 | v8_scale_A_frame_7.png |
| barrels | 32x21 | 0.23 | 41x44 | 0.13 | v8_scale_B_frame_0.png |
| crates | 34x24 | 0.24 | 40x39 | 0.08 | v8_scale_B_frame_1.png |
| produce | - | - | 39x33 | 0.1 | v8_scale_B_frame_2.png |
| firewood | - | - | 40x43 | 0.02 | v8_scale_B_frame_3.png |
| sacks | - | - | 40x48 | 0.07 | v8_scale_B_frame_4.png |
| planter | 56x32 | 0.02 | 42x33 | 0.04 | v8_scale_B_frame_5.png |
| wheelbarrow | - | - | 42x34 | 0.04 | v8_scale_B_frame_6.png |
| cookpot | - | - | 41x48 | 0.03 | v8_scale_B_frame_7.png |
| oven | - | - | 42x47 | 0.16 | v8_scale_B_frame_12.png |
| haystack | - | - | 44x44 | 0.13 | v8_scale_B_frame_14.png |
| beehive | - | - | 37x41 | 0.2 | v8_scale_B_frame_15.png |
| market_veg | 64x37 | 0.1 | 55x44 | 0.24 | v8_scale_C_frame_0.png |
| market_jars | 57x44 | 0.09 | 53x45 | 0.3 | v8_scale_C_frame_1.png |
| mira_table | 73x30 | 0.21 | 54x39 | 0.3 | v8_scale_C_frame_2.png |
| bench | 36x26 | 0.25 | 48x46 | 0.29 | v8_scale_C_frame_3.png |
| handcart | 74x48 | 0.27 | 52x40 | 0.15 | v8_scale_C_frame_4.png |
| herb_shelf | - | - | 44x55 | 0.14 | v8_scale_C_frame_5.png |
| trough | 54x36 | 0.21 | 52x41 | 0.21 | v8_scale_C_frame_6.png |
| dummy | 34x70 | 0.16 | 34x51 | 0.18 | v8_scale_C_frame_7.png |
| well | 74x93 | 0.38 | 40x56 | 0.17 | v8_scale_C_frame_8.png |
| crates_barrel | - | - | 54x48 | 0.12 | v8_scale_C_frame_13.png |
| signpost | 27x56 | 0.21 | 29x51 | 0.2 | v8_scale_C_frame_14.png |
| notice_board | 36x56 | 0.02 | 43x57 | 0.26 | v8_scale_C_frame_15.png |
| lamp | 15x81 | 0.36 | 37x81 | 0.29 | v8_b2_frame_0.png |
| shrine | - | - | 74x77 | 0.34 | v8_b2_frame_13.png |
| woodshed | - | - | 70x74 | 0.33 | v8_b2_frame_10.png |
| stall | 125x104 | 0.58 | 81x81 | 0.27 | v8_stall_frame_1.png |
| fence | 56x18 | 0.23 | 76x40 | 0.23 | v8_b3_frame_1.png |
| banner_pole | 21x92 | 0.48 | 39x80 | 0.42 | v8_b3_frame_2.png |
| laundry_line | 67x46 | 0.25 | 79x56 | 0.42 | v8_b3_frame_3.png |
| target | - | - | 53x72 | 0.19 | v8_b3_frame_15.png |
| drain | - | - | 53x35 | 0.33 | props_frame_5.png |
| bridge | 42x107 | 0.41 | 112x101 | 0.12 | v8_bridge_frame_3.png |
| walkway | - | - | 110x25 | 0.02 | 00.png |
| garden | - | - | 96x53 | 0.18 | garden.png |
| tree | - | - | 101x121 | 0.63 | tree.png |
| tree_blossom | - | - | 56x89 | 0.42 | tree_blossom.png |
| bush | - | - | 36x42 | 0.29 | bush.png |
| flowers | - | - | 70x43 | 0.16 | flowers.png |
| tuft | - | - | 39x20 | 0.18 | tuft.png |

The trees, bushes, flowers and tufts are still the v2 family (`objects2`), because Jared said they were good
enough. The big tree measures chunky (0.63) and is the main remaining density mismatch.

### Credits
- v8 jobs by API usage: **199 credits** over 26 jobs. Itemised in `ledger.json`, from `v8_plinth_house_green` to
  `v8_stall`.
- The account balance went from 15,221 to 14,796 (−425) over the same period. The extra may be other usage on the
  account. The ledger figure is the per-job count. Both are well under the ~1,500 allowance.

### What still looks off (honest)
- **The big round tree is chunkier than everything else (v2 asset, 0.63).** It reads fine at game zoom, but it is
  the one density outlier left.
- **The stall is drawn from a slight corner angle**, like most PixelLab market stalls. The tables are more frontal.
- **The side rims still step in hard right angles.** The PixelLab cliff set has no inner-corner tile, so the
  fallback shows a narrow dark crevice where a bite meets the face. The south face is straight and clean.
- **The east-road walkway out over the void is a thin plank bridge.** It reads more like a jetty than a road going
  on.
- **The riverside steps are small** (27×57 px) next to a 2-tile path.
- **The road and the canal's south bank still form one wide quay of cobble.** It is broken up by worn tiles, not by
  verges.
- **The Flame Whip's impact glow is a soft square.** It is the v4 effect, untouched as instructed.

## v7: the whole of Ba Dan, top-down, in the v2 style

Jared: "Let's just use V2 for now. Let's build out Ba Dan in this style for further testing." Kaya is v2 exactly:
v2 base, v2 walk, v2 idle and look-around, plus the v4 bends, with no motion layer and the bend effects untouched.
The village is laid out from the game's own Ba Dan.

**Files**
- `badan-topdown.html`: self-contained (1.4 MiB) and playable on a phone. Controls are the same as v4: tap to walk,
  the d-pad, JAB/WHIP/STOMP or J/K/L, and E/Enter or TALK.
- `badan-tour.mp4`: about 85 s at 1280×720. Kaya crosses the bridge, talks to Mira and Gao, crosses the court and
  goes down the dry crossing to Hanru, then visits Pella in the south court (with a 5× close-up of the residents
  at work). She goes back over the bridge to Dorin's dummy for a Fire Jab and a Flame Whip (5×), and ends at the
  forest-road marker.
- `badan-overview.png`: the whole map at 1×, no UI.

### Layout: the game's village, reinterpreted top-down
Each cell (cx, cy) of the 24×16 village (`src/content/maps/village.ts`, `scenes/baDan.ts`) sits at world px
(32 + 40·cx, 32 + 40·cy), so every landmark lands where a player of the current game expects it. The world is
1024×704 px.
- **North of the canal:**
  - Gao's merchant house (6..9, 1..3), with the yard fence on its west tiles, the barrel at his door and the shop
    stack.
  - Mira's north house (12..15, 1..3).
  - The market court: Gao's display at (6,5), Mira's table at (10..11,5), the north display at (14,5).
  - The laundry line, the handcart, the north garden planter, and the banner.
- **The canal and the road:**
  - The canal along row 6, with the **bridge at (9,6)** and the **dry crossing at (13,6)** where the canal ends.
  - The flooded ford closing the west road.
  - The road along rows 7–8, running out east, with Dorin's watch post at (17,6), its notice board and the lamp
    that "stays lit".
- **South of the road:**
  - Pella's south-west house (6..9, 10..13) and the south-east merchant house (13..16, 10..13).
  - The south court (Pella), the school notice, the planter, and the well (12,13).
  - The garden plot (2,10), the south stall (3,9), the stone lantern, the hay trough, and the riverside sign and
    path heading south.
- **Rim and way-marks:**
  - The rim trees, and the court trees at (5,5) and (21,2).
  - A **"TO THE FOREST ROAD"** marker at the east edge.

### Residents (create-character-v3, 48 px, 8 rotations, v2 Kaya's settings; Pella at 36 px as a child)
| Resident | Where (content) | Routine in the demo | Clips | Opening lines |
|---|---|---|---|---|
| Elder Mira | BD01 table (11,5) | stays at her table | idle ×8 | `mira_intro` |
| Gao the Shopkeeper | BD02 shopfront (9,4) | display → lane → door step → lane (his `routines.ts` loop) | idle ×8, walk ×8 | `gao_friendly` |
| Pella | BD04 court (11,12) | plays between the planter, the notice and the well | idle ×8, walk ×8 | `pella_tips` |
| Gate Guard Dorin | BD03 post (17,6) | post ↔ footing drill at the practice dummy on the canal bank | idle ×8, walk ×8 | `dorin_directions` |
| Hanru | BD03 handover (16,6) | stands watch | idle ×4 | `hanru_watch` |
| Pella's household | BD04 yard (11,13) | `bg.pella_household`: carries a basket along the south lane, up the west road and over the bridge to Mira's table, and back | idle ×4, walk ×8 | (background role, no talk) |

The walks use the stock walking template in skeleton mode (take c from v6); the idles are custom 12-frame
skeleton-v3. The v2 cat walks the south lawn.

**Ambience:** smoke from both chimneys (Gao's and Mira's houses), canal glints, lamp flicker, birds, the cat, plus
two new touches: blossom petals drifting down from the blossom trees, and two butterflies over the garden plot.

### Assets
- **Reused from the approved v2 family:**
  - the four houses: ochre for Gao, cream for Mira, green for Pella, teahouse for the south-east merchant house;
  - stall, well, lamps, barrels, crates, trees, blossom trees, bushes, flowers, tufts, bench, signposts, pots;
  - the bridge, and the training dummy from v3;
  - all 32 px terrain with its variants, extended with the flooded ford and the riverside dirt path.
- **New** (`/map-objects`, v2 settings and palette, two seeds each, the better one shipped): Mira's table, two
  market tables, the garden plot, the notice board, the handcart, the laundry line, the fence, the stone lantern,
  the hay trough, the planter, and the banner pole.
- **Retaken:** the garden plot. Both first seeds came back as **isometric diamonds** (off-family). Three more takes
  worded "straight from the front, a flat rectangle, not a diamond"; the third matches.
- **Still a little off:**
  - The new props are slightly plainer and smaller in detail than the v2-family props regenerated from sketches
    (handcart, market tables).
  - The trough was picked as the round-tub seed because the box seed was drawn at an iso angle.
  - The teahouse's upturned eaves mix with three half-timbered houses, as in v2.

### Where the demo departs from the content
- Dorin's practice is placed on the canal's north bank (the brief), not on the riverside map.
- Hanru stands his watch by day.
- The five returnees (Bo-shan, Leto, Amri, Hesra, Senn) are left out.
- Dorin's and Hanru's homes and the north tea terrace have no buildings in the content, so none are drawn.
- Everyone runs a single daytime loop.

### Credits
v7: **255 credits** by job usage: 6 characters (12), 12 animation jobs (216: six idles and four walks across 8 or
4 directions), and 27 map objects (27, including three garden retakes). The balance went from 15,476 to 15,221,
exactly 255, so nothing else used the key during v7. Total across v1–v7: 1,162.

## v6: v2 Kaya, a relaxed walk, a narrower track (kept as `topdown-demo-v6.html`, `spritesheet-v6-4x.png`)

Jared on v5: "V2 is still best, just wish she didn't look like she had something stuck up her butt", and then, "She
walks so wide." v6 keeps **v2 Kaya's base character and coat unchanged**, poses her with skeleton-v3 (no motion
layer), uses v2's pace, and keeps the v4 bends (they are already her).

**Files**
- `compare-walk-v6.mp4`: v2 and takes a, b, c and d walking S, E, NE and N side by side at 4×, labelled (9.5 s).
- `topdown-demo.html`: v6 with take **c**.
- `spritesheet-4x.png`: every v6 clip.

### The takes
"Upright posture" is gone from every wording. All the custom takes keep v2's non-posture line about the coat hem
and ponytail swaying.

| Take | How | Foot span S / N (mean px) | Max foot gap S / N (px) | Motion S / E / NE / N (px changed per frame) |
|---|---|---|---|---|
| v2 | custom "relaxed natural walking cycle …", 12 frames | 18.0 / 15.6 | 8 / 6 | 142 / 168 / 83 / 96 |
| a | casual, easy: loose shoulders, slight forward lean, loose arms, soft knees | 18.0 / 15.6 | 8 / 6 | about v2 |
| b | light, confident stroll: counter-rotation, head bob, loose wrists | 18.0 / 15.7 | 8 / 6 | about v2 |
| **c** | **PixelLab's stock `walking-8-frames` template, skeleton-v3 mode**, 8 frames | **14.6 / 11.2** | **5 / 5** | 89 / 209 / 164 / 98 |
| d | relaxed + explicit narrow track ("feet step almost in front of each other … legs close together") | 16.1 / 13.5 | 5 / 4 | 45 / 96 / 96 / 39 |

- **Text barely moves skeleton-v3.** Takes a and b came back with exactly v2's stance: the 18 px straddle is baked
  into the base pose, and wording does not change it.
- **Take d** narrows the track (gap 8 → 5 px), but it moves less than half as much as v2, so it reads stiffer.
- **Take c**, the stock template on the same sprite, has the narrowest track (about 3–4 px narrower than v2), a real
  heel-to-toe stride, a slight easy forward lean, and loose arms. Its planted foot travels about 12 px per cycle
  against v2's 5, so its feet stay planted better at the same pace.

### Pick: c
- **Why.** It reads the most relaxed and natural, and it has the narrowest feet.
- **Caveats.**
  - It has 8 frames, not 12.
  - In south-east and north-west, frames 5–6 swing an arm out wide. A retake gave the identical motion, so it is
    part of the template; at game speed it lasts two frames and reads as a broad arm swing.
  - The front view (south) moves less than v2's.

### Credits
v6: **102 credits**: takes a, b, c and d at 24 each, plus a 6-credit retake of c's south-east and north-west. The
balance went from 15,792 to 15,476 (316), so about 214 went to the other consumer on the key. Total across v1–v6:
907.

## v5: a slimmer Kaya, walked the v2 way (kept as `topdown-demo-v5.html`, `spritesheet-v5-4x.png`)

Jared on v4: the bending is great; the walk is "too boxy … her hips are WAY out there". The cause was her
**base silhouette**. The flared long coat made her wide and rectangular at the hips, and skeleton-v3 posing keeps
whatever silhouette the base has. v5 fixes the base and walks it exactly the v2 way: v2's action wording, 12
frames, 8 directions, v2's pace (66 px/s, 30 px per cycle), and **no motion layer**.

**Files**
- `kaya-candidates-lineup.png`: v2 Kaya and candidates A, B and C, 8 rotations each, at 4×.
- `compare-walk-v2-v5.mp4`: v2, A, B and C walking S, E, NE and N side by side at 4×, labelled (9.5 s).
- `topdown-demo.html`: v5 with candidate C. Idle, look-around and all three bends are re-posed from her new base.
- `spritesheet-4x.png`: every v5 clip.

### How the candidates were made, keeping her identity
1. v2 Kaya's south rotation, on a 64 px canvas, went through `/edit-image-pro-flash` (text method, 5 credits each).
   The instruction: "redraw this exact character … same face, ponytail, colours … slimmer, more feminine teen
   silhouette: narrower waist and hips, softer shoulders, slimmer legs, narrower stance, no wider than the
   original", plus one outfit line per candidate.
2. The edited south sprite, cropped back to 48 px, was the `reference_image` for `/create-character-v3` in
   reference mode (1 credit), which rotates it into 8 directions.
3. Each candidate was walked with skeleton-v3 using v2's exact walk description, plus "a narrow graceful gait,
   feet landing close to one line, a soft arm swing close to the body, an upright posture". There is no hip-sway
   wording.

| | Coat | Width at the hips (south) | Walk motion S / E / NE / N (px changed per frame; v2 = 142 / 168 / 83 / 96) | Read |
|---|---|---|---|---|
| A | fitted, short back tails | 21 px (v2: 24) | 137 / 150 / 106 / 94 | the tails flare into a short skirt in the side and back views, bringing the flare back |
| B | knee-length, front slits | 21 px | 133 / 137 / 91 / **33** | slim and closest to her original long coat, but the north walk barely moves (the same failure as v4's north) |
| **C** | cropped jacket over a slim tunic | 21 px | 138 / 174 / 91 / 87 | the slimmest, least boxy silhouette; motion matches v2 in every direction |

### Bends on C
The three bends were re-posed from C's base with the same wording as v4 (8 directions each) and use the same,
untouched VFX. The first re-posed whip came back with the model's own fire arcs painted into the body frames,
which doubled the crescent. A re-roll asking for "body movement only, no fire" (24 credits) matches v4's approved
look. The whip strike frame is now measured from the east arm's reach.

### Credits
v5: **222 credits** by job usage: edits 15, characters 3, animations 204. The animations were three candidate walks
(72), C's idle, look-around, jab, whip and stomp (105), and the whip re-roll (24). The balance went from 16,026 to
15,792 (234); about 12 went to the other consumer. Total across v1–v5: 805.

### Honest read
- **Pick: C.** It fixes the boxiness and the wide hips most completely, and walks as consistently as v2 in all 8
  directions. B is the alternative if the long coat is essential to Kaya: it is just as slim in front, but its
  north walk would need a retake.
- **Fixed?** Mostly. The hip line is 3 px narrower (21 against 24 at the widest) and the coat no longer flares into
  a block, so she reads as a slim teen rather than a rectangle. The walk itself is still v2's posed motion, so it
  is calm rather than expressive.
- **Identity drift.**
  - C changes her signature **long red coat** to a cropped jacket over a mid-thigh tunic. That is the real cost.
  - Face, ponytail and tie, palette, sash, trousers and boots all held.
  - Her shoulders read a touch narrower and younger.

## v4: v2's walk, made a little lighter, and three bending styles (kept as `topdown-demo-v4.html`, `demo-walk-v4.mp4`, `spritesheet-v4-4x.png`)

Jared on v3: the motion layer made her walk "almost too fluid … overcompensating"; v2 had the better walk. v4 starts
from v2: **v3's motion layer is gone entirely** (no part split, no bob or stride offsets, no lean, no coat or
ponytail springs). Kaya is drawn exactly as PixelLab posed her, as in v2.

**Files**
- `topdown-demo.html`: v4 (1 MiB, self-contained).
  - Phone: JAB, WHIP and STOMP buttons; the move's name flashes on screen.
  - Desktop: J, K and L for the three moves (Space repeats the last one); E or Enter talks.
- `compare-walk-v2-v4.mp4`: v2 and v4 Kaya at the same 4× scale, walking S, E, NE and N with stops.
- `bending-moves.mp4`: each move at 6× in E, S and N, twice, captioned.
- `demo-walk.mp4`: the full tour, ending with the three moves at the dummy.
- `spritesheet-4x.png`: the v4 walk, idle, look-around and the three moves, every direction and frame.

### The walk
- **Generation.** skeleton-v3 posing the same 48 px sprite, 12 frames, 8 directions.
- **First try.** "Light, graceful, narrow steps, subtle hip sway, soft close arm swing, upright": it came back
  almost identical to v2, as the v2 south retake had. The written action barely moves skeleton-v3's motion.
- **Second try (shipped).** More concrete wording: "feet landing on one line, each foot crossing slightly in front,
  hips rock over the standing leg, arms close, swinging only a little from the elbows, light heel-to-toe steps".
  It does change the side views: a pointed, lighter heel-to-toe step, steps closer to one line, and a softer arm
  swing. Front and back views change very little.
- **North keeps v2's frames.** The new north barely moved: about 27 px change per frame against v2's 96, and it
  read as a shuffle.
- **Cadence.** 56 px/s at 28 px per 12-frame cycle (v2: 66 at 30), slightly slower for a lighter, unhurried pace.
  PixelLab's in-place walk only moves the planted sole 4–6 px per cycle, so some foot slide is unavoidable at any
  believable pace; this is the same compromise as v2.
- **Verdict.** It is not clearly better than v2. It is a small change: a little lighter and more poised in the side
  and diagonal views, and the same elsewhere. If Jared prefers v2's stride, putting the v2 frames back is a
  one-line change (`WALK_MIX` in `tools/build4.py`).

### Three bending styles (all with skeleton-v3 posing the same sprite, 8 directions)
| Move | Key | Body (PixelLab) | Fire (PixelLab `/vfx`) | Reach | Dummy |
|---|---|---|---|---|---|
| **Fire Jab**: a straight punch, projectile | J | 11 frames: guard, wind-up, strike (4), hold, recover | lite burst at the fist + looping fireball (45° variant for diagonals) + embers | travels 3.5 tiles | hit by the fireball |
| **Flame Whip**: an arm sweep, arc | K | 14 frames: draw back, wide horizontal sweep (strike 7), follow-through | **pro** 96 px crescent of ragged flame drawn on top to bottom, then sparks and smoke | about 2–3 tiles in front, across a 60° cone | recoils if in front and within 110 px |
| **Fire Stomp**: a stance drop, area | L | 14 frames: knee lift, drop into a horse stance with a stamp and a two-fist down-punch (strike 6), hold, rise | **pro** 128 px ground ring of licking flames racing outward, then embers | a ring about 2 tiles out, all around her | recoils away from her, delayed by distance |

- **Polish is light.** A 1 px screen shake for the jab and whip, 2 px for the stomp; warm stepped ground flashes;
  the dummy flashes white and wobbles back along the hit. There are no body offsets.
- **Effects.** The first lite whip and ring were a flat, thin crescent and a solid orange donut. Pro (8 credits
  each) gave real flame texture. Every heading comes from exact 90° turns and flips; diagonals use the horizontal
  version.
- **Model additions.** The model painted extra fire into some poses: the jab's fist flame, and ground flames at the
  stomp's landing in E and S. Both fit. The idle and stomp cleanup removed small grey detached blobs (stray vapour
  or smoke).
- **Server limit.** Stomp, like v2's shopkeeper idle, was accepted for only 3 directions per request; the other 5
  were added to the same motion group.

### Credits
v4: **114 credits** by job usage. That covers walk 24 + 6 + 18 (the first try was not used), whip 24, stomp 24, and
VFX 18. The balance went from 16,368 to 16,026 (342) over the same period, so about 228 went to another consumer on
the shared key. Total across v1–v4: 583.

### Honest read
- **Is the v4 walk better than v2?** Marginally, and only in the side and diagonal views (lighter, more poised steps).
  It is not a clear improvement, and front, back and north are effectively v2.
- **Do the bends read as distinct styles?** Yes. The jab is a projectile, the whip a sweeping arc of flame in front,
  and the stomp a ground ring around her. They have different poses, shapes, reaches and dummy reactions.
- **Weakest move: the whip in north and south.** The sweep pose is clear from the side. From the front and back the
  arm mostly moves sideways, so the crescent carries it; the turned crescent also looks less natural than the side
  one. The jab in north is the other weak one (the punch is hidden behind her).

## v3: motion layer and the Fire Jab (kept as `topdown-demo-v3.html`, `demo-walk-v3.mp4`, `firejab-loop-v3.*`, `spritesheet-v3-4x.png`)

Jared chose option 2: keep PixelLab's consistent posed sprites and add hand-tuned motion in code by moving parts of
the same drawing a whole pixel at a time. Nothing is rotated or resampled; every part is drawn with nearest
sampling at integer offsets.

**Files**
- `topdown-demo.html`: v3 (664 KiB, self-contained). The BEND button is on the phone; Space or J on desktop.
  E or Enter talks.
- `demo-walk.mp4`: the tour; the Fire Jab at the dummy; a 6× close-up with idle, look-around, walks, stops and
  turns; then the Fire Jab in all 8 directions.
- `compare-v2-v3.mp4` / `.gif`: v2 and v3 Kaya at the same 4× screen scale, walking south, east and north-east,
  with stops.
- `firejab-loop.mp4` / `.gif`: the east Fire Jab into the dummy at 6×, looping.
- `spritesheet-4x.png`: adds the Fire Jab block and a tinted part-split diagram for every direction.

### The part split (authored once, from the rotations)
Rows are measured from the foot line, so they hold for every clip and direction once each frame is re-anchored.

| Part | Rows (from the feet) | Notes |
|---|---|---|
| head + ponytail | top … −28 | E, W, SE and SW: the back 35% of the head band is the **ponytail**, a separate part. N, S, NE and NW keep it on the head. |
| torso + arms | −28 … −19 | |
| coat hem | −19 … −8 | |
| legs + feet | −8 … 0 | On E, W and the diagonals it is split at the hip into back and front legs. |

Parts are drawn bottom-up. Each upper part also covers the 2 rows under its cut, and the ponytail and back leg run
2 px under their neighbour. Moving a part up or apart therefore shows duplicated edge rows, never a transparent
slit. Neighbouring parts are clamped to within 2 px of each other.

### Motion-layer numbers (`MOTION` in the game code)
- **Walk phase.** It is fitted to PixelLab's own head dip, which is lowest at frames 1 and 7 of 12, so the layer
  reinforces the drawn bob rather than fighting it. The phase is read from distance travelled, so it is
  cadence-locked.
- **Body bob.** +1 px on contact and −2 px on passing: 3 px of travel, scaled by speed so it fades in and out. It
  applies to the torso, hem and head; the legs stay planted.
- **Head counter-bob.** The head takes half the bob (0 / −1 px), so it stays steadier than the hips.
- **Weight shift.** 1 px sideways toward the planted foot, alternating each step, on S, N and the four diagonals.
  On E and W the shift would be in depth, so it is off.
- **Longer stride.** At contact the legs are pushed apart by up to 2 px each way on E and W and 1 px on the
  diagonals; off on S and N. The cadence was retuned to match: **38 px per 12-frame cycle at 60 px/s** (v2: 30 at 66).
- **Coat hem and ponytail.** Underdamped springs (k 90, c 5, ζ ≈ 0.26). The hem trails 1 px at full speed and the
  ponytail 2 px. A walk-cycle sway lags the bob by 1.5 frames (hem) and 2 frames (ponytail). On a stop the ponytail
  swings past centre by 1 px and settles; a turn kicks both sideways.
- **Start and stop.** The torso and head lean against acceleration (1 px per 300 px/s², clamped to ±1 px): about
  4 frames leaning back on a start (anticipation) and about 5 frames leaning forward on a stop (settle).
- **Idle.** A breath every 3.4 s raises the chest, arms and head 1 px together while the coat stays put, on top of
  PixelLab's 12-frame idle. The look-around still plays after about 5 s standing still.

### Fire Jab
- **Body.** `/characters/animations`, skeleton-v3 custom action, 14 frames × 8 directions (24 credits). Frames
  0–10 are used: guard 0–2, wind-up 3, **strike 4**, then hold and recover. The strike frame is measured as the
  frame where the east arm reaches furthest. The model also painted a small flame on the fist; its yellow pixels
  locate the fist for the projectile in 7 of 8 directions. North (seen from behind) falls back to the arm's reach.
- **Timing** (ms per frame): 70, 70, 70, 80, 50, **140 (the hold)**, 90, 70, 70, 70, 80.
- **Push** along the heading (px per frame): 0, 0, −1, −2 (pull-back), **+3 (lunge)**, +3, +2, +2, +1, 0, 0. Torso
  and head take all of it, the hem two-thirds, the legs one-third.
- **On the strike.** The coat and ponytail springs are kicked backward, so they whip and then settle. A 1–2 px
  whole-pixel screen shake lasts 170 ms. A stepped warm light disc flashes on the ground and follows the fireball.
- **Fire.** All three effects come from PixelLab's `/vfx` (lite artist, 1 credit each): a 6-frame burst at the
  fist, a 6-frame looping fireball travelling 112 px (3.5 tiles) at 300 px/s, and an 8-frame ember-and-smoke
  dissipation. A 45° fireball variant came from a 1-credit change to the same effect. Every heading is made with
  exact 90° turns and flips, never resampled.
- **Target.** A straw training dummy (`/map-objects`). A hit makes it flash and recoil along the hit direction
  (4 px, decaying wobble); then embers puff off.

### Credits
v3: **31 credits** by job usage (Fire Jab 24, VFX 5, dummy 2). The balance went from 16,407 to 16,368 (39); the
other consumer on the shared key took the rest. Total across v1–v3: 469.

### Honest read
- **Fluid or puppety?** It reads as a living walk at 3×: the body visibly rises and falls, the head floats, the coat
  and ponytail trail and settle, and stops have weight. It is not puppety at these sizes, because every move is
  1–2 px and the overlap rows hide every seam. At 6× you can see the parts move in whole-pixel steps; the hem in
  particular jumps a pixel rather than flowing, and that is the limit of whole-pixel motion on a 46 px figure. It
  is still not Children of Morta, whose fluidity comes from many hand-drawn frames with real squash and arcs.
- **Best direction:** east and west. The stride split, ponytail and hem all show. Diagonals are close behind.
- **Worst direction:** north. The coat hides the legs and the ponytail can't be separated, so only the bob and the
  breath show. South is next, where only bob and weight shift apply.
- **Does the Fire Jab land?** Yes for east, west and the diagonals: there is a clear wind-up, lunge, burst and hit
  on the dummy. South works through the burst more than the pose. North is the weakest, because the punch is
  hidden behind her and only the burst and fireball sell it. The burst is large next to a 46 px girl; that is
  dramatic, but it could be scaled down by using a smaller effect canvas.

## v2: bigger cast, fluid motion (kept as `topdown-demo-v2.html`, `demo-walk-v2.mp4`, `spritesheet-v2-4x.png`)

Jared's v1 note: "It's too stiff. Needs to be fluid. Can we make them a bit larger to give them more grace."

- `topdown-demo.html` (541 KiB, self-contained): 26×21 tiles of **32 px**. 24 px was not an option, because the
  tileset endpoint only takes 16, 32 or 64. Zoom is 2× CSS on a phone (6 device px per art px) and 3× on desktop.
  `?zoom=N` forces a zoom.
- `demo-walk.mp4`: 56 s, 1280×720, libx264 yuv420p. It covers the tour in all 8 headings, eased stops, a full
  reversal, the bridge, the cat, the villager, TALK and the dialogue, then an 11 s **6× close-up** (breathing,
  look-around, walking in four headings).
- `compare-v1-v2.mp4` and `compare-v1-v2.gif`: v1 and v2 Kaya side by side at the same 4× screen scale, walking
  south, east and north-east, with idles and stops between.
- `spritesheet-4x.png`: every v2 clip, direction and frame on its anchored foot line (the v1 sheet is `spritesheet-v1-4x.png`).

### What changed
| | v1 | v2 |
|---|---|---|
| Characters | v3 at 32 px (31 px tall) | v3 at 48 px (46 px tall), same descriptions and seed; Kaya reuses the 48 px test from v1 |
| Walk | template `walking-8-frames`, 8 frames | `skeleton-v3` **custom action, 12 frames**, one 3D motion shared by all 8 directions |
| Idle | template `breathing-idle`, 4 frames, invisible | custom 12-frame breathing idle with weight shift; plus a **15-frame look-around** (S, SE, SW) that plays after ~5 s still |
| Cat | template-mode quadruped (different family) | `create-character-v3` with the cat template, the same endpoint as the people; skeleton-v3 `walk-8-frames` and `seated-on-belly-idle` |
| World | 16 px tiles, door ≈ 0.85× character | 32 px tiles; buildings ×2.1 (door ≈ 64 px ≈ 1.4× Kaya), props ×1.5–1.75 |
| Terrain | one base tile per terrain | 16 `create-tiles-pro` variants each of grass and cobble, made with the base tile as style image (they are edits of it, so edges still meet), scattered; dirt set with `roundness: 1` and a meandering edge; the road runs diagonally |
| Movement | tile-to-tile steps, walk frame by time | continuous, eased acceleration and deceleration, walk frame advanced **by distance** (cadence locked to ground speed), facing sweeps through the in-between headings at a fixed turn rate, A* with string-pulled paths, smoothed whole-pixel camera with look-ahead |

**World rescale.** Every building and prop was regenerated through `/map-objects` with its v1 sprite as
`init_image`. The v1 sprite was first nearest-upscaled to the new size, and the job ran at
`init_image_strength: 300`. That keeps each design while the model redraws real 1 px detail; at 600 it stays a
chunky upscale. The stall and the bridge shrank at 300 and were redone at 430, which is a little chunkier.

**Cleanup.** The idle prompt said "breathing", and in the south-east and west idles the model drew grey breath
vapour. `tools/build2.py` drops small, detached, low-saturation blobs (81 px in total). Every frame is also
re-anchored on its measured foot line, because the north-facing clips come back on 64 px canvases and the rest on
80 px.

### Credits
v2: **221 credits** by job usage: 129 animations, 45 tilesets, 21 map objects, 20 tile variants, 6 characters.
Three map-object jobs failed on a canvas-size rule and were not billed (`usd 0.0`). The balance went from 16,638
to 16,407 (231) over the same period. **Another consumer was using the same key during this run**: arcade-cabinet
objects from 14:10 onward are in the account listing. That is why v2 ledger rows take credits from each job's
reported usage, not from balance differences. Running total, v1 + v2: 438.

### Is it fluid now?
It is clearly better: bigger, 12 frames instead of 8, eased, no snapping, and the cadence tracks speed. It is
still not Children of Morta.
- **Short stride.** The skeleton walk keeps the feet only 6–8 px apart, because the coat hides the legs in
  low top-down. A cadence that kept the feet perfectly planted would be a 5-steps-a-second shuffle. The engine uses
  30 px per cycle at 66 px/s instead (about 2.2 cycles a second), which leaves a small slide.
- **Small bob.** Body bob is 1 px. A retake of south with a much stronger motion description came back almost
  identical, so the text barely moves skeleton-v3's motion. Its posing is what keeps the identity, and it is also
  what keeps the motion small.
- **Idle is subtle.** Breathing is a 1 px rise of the shoulders and a slight sway. The look-around is the most
  alive clip.
- **Within the rules, there is no longer walk.** Only the per-frame redraw modes (`v3`, `pixminimax`) could give
  more exaggerated motion, and those are the route that broke consistency before. A `running-8-frames` template
  exists but was not used.

### The ~1,300-credit gap before this demo (18,242 → 16,945)
The API has no balance history; `GET /balance` is the only account endpoint. What the listings show:
- The last repo ledger (`art/source/party-world/ledger.json`) ends at 18,266, written at 05:18 UTC.
- Between 05:18 and this demo's first job at 12:44, the account created only two library items: **"Mud crab 48"
  (09:44)** and **"Mud crab 32" (09:53)**. Both use `pro_flash` with a "Harbour Paint" palette. The 32 px crab has
  four custom animations × 8 directions (flip over, knock-back, rear up, scuttle), 32 direction-animations in all.
  Custom or pro animation bills 3 to 25 credits per direction, so the crab plausibly accounts for a few hundred.
- Endpoints that leave no library item (edit, inpaint, generate-image, image-to-pixelart, standalone
  animate-with-skeleton) would not show up anywhere. The rest of the gap is most likely there.
- Earlier the same day (00:35–03:06) there was a harbour set: Pell, Drowned fisherman, Barnacle, a farm dog, 224 px
  harbour houses and seabed-mud tilesets. That is before the 18,266 reading, so it is not part of this gap.
- The key is shared live: about 90 credits went between this demo's v1 and v2 (the arcade cabinets), and about 10
  more during v2.

## v1 (kept as `topdown-demo-v1.html`, `demo-walk-v1.mp4`, `spritesheet-v1-4x.png`)

A small playable village corner (30×22 tiles of 16 px) built only from PixelLab output, to test whether a
traditional top-down pixel style gives the consistency the isometric attempts did not.

- `topdown-demo.html` — self-contained (192 KiB, every image inlined). Tap a tile to walk, use the d-pad or arrows/WASD,
  and press E, Space, Enter or TALK beside the stall. Integer zoom: 3× on a phone, 4× on desktop, at device pixels.
- `demo-walk.mp4` — 36.6 s, 1280×720, libx264 yuv420p. Recorded frame-by-frame (`?record=1` steps the game 1/30 s
  per screenshot) with Playwright's preinstalled Chromium.
- `spritesheet-4x.png` — every character, every direction, every frame, 4× nearest.
- `assets/` — the raw tiles, characters (per-frame PNGs plus atlases) and objects; `raw/` has every job's response.
- `style.json` — the one style; `ledger.json` — every job with credits; `tools/` — client, build and record scripts.

### Endpoints and settings

One style for everything: view `low top-down`, `single color outline` (`single color black outline` for characters,
where that is the option), `basic shading`, `medium detail`, and a 34-colour earthy palette (`assets/palette.png`),
passed as `color_image` or `target_palette`, depending on what the endpoint takes.

| What | Endpoint | Notes | Credits |
|---|---|---|---|
| Kaya, shopkeeper, villager | `POST /create-character-v3` (from scratch, 32×32, 8 rotations) | pixen sprite, then v3 rotation | 2 each |
| Cat | `POST /create-character-with-8-directions` (standard, `template_id: cat`) | | 1 |
| Walk / idle | `POST /characters/animations` `mode: skeleton-v3`, templates `walking-8-frames`, `breathing-idle` | 3 per direction | 93 |
| Cat walk / sit | same, `mode: template`, `walk-8-frames` (E, W), `seated-on-belly-idle` (SW) | 1 per direction | 3 |
| Terrain | `POST /create-tileset` 16 px Wang sets: grass↔cobble, water↔cobble (0.25 bank), dirt↔grass | `mode: pro` + `target_palette`; later sets take the earlier set's tile as `*_reference_image` so shared terrain matches | 15 each |
| Style anchor house | `POST /map-objects` 80×96 | | 1 |
| 3 houses + stall | `POST /create-1-direction-object` with the anchor as `style_images`, `item_descriptions` | 4 objects in one job | 10 |
| Props | `POST /map-objects` (lamp, barrels, crates, well, trees, bush, flowers, bridge, bench, sign, pots, tuft) | | 1 each |

**Spent: 217 credits** (balance 16,945 → 16,728, which matches the ledger). Of those, about 60 went on rejected
tests: 6 tilesets, a template-mode walk, the standard-mode Kaya and about 20 prop retries.

Clips: Kaya has the rotation, an 8-frame walk and a 4-frame idle, each in 8 directions. The villager has an 8-frame
walk in 8 directions. The shopkeeper has a 4-frame idle in 8 directions, and turns to face Kaya. The cat has an
8-frame walk (E and W) and a 10-frame seated idle (SW). Every animation frame stands on the same foot row (39 of the
48 px canvas), so the clips needed no re-anchoring.

Code-drawn, not PixelLab: chimney smoke, canal glints, the lamp flicker halo, two birds, the 3-row foot shadows,
the TALK bubble (a 3×5 pixel font) and the dialogue box. Cleanup was limited to alpha thresholding and trimming.

### What worked
- **Characters are the win.** v3 from scratch at 32 px produced a 31 px Kaya (coat, sash, boots, red-tied ponytail)
  whose 8 rotations hold her identity, and the two townsfolk made with the same settings sit beside her as one cast.
  `skeleton-v3` poses the rotation instead of redrawing it, so walk and idle frames keep her colours and face
  exactly. Template mode redrew each frame: the face drifted and the eyes turned blue.
- **Buildings via a style anchor.** One cheap `map-objects` house was passed as `style_images` to the
  1-direction-object endpoint, and the three houses and stall that came back share its outline, light, plinth and
  palette. They are the most consistent assets in the set.
- **Wang tilesets join cleanly.** Pro mode honours `target_palette`, and feeding one set's base tile into the next as a
  reference kept grass and cobble identical across all three sets.

### What fell short
- **Walk motion is small.** At 31 px the legs and coat move, but the south walk is subtle and has no body bob. The
  north-west frames 6–7 fling the arms out. The breathing idle is almost invisible.
- **Terrain is the weakest part.** Each terrain has one base tile, so the cobble reads as a regular grid and the grass
  repeats. Standard mode ignores the palette (lime grass, and one run put flowers on a perfect grid). Pro cobble at
  16 px either turns to noise or becomes a grid. Corners are square, so the dirt road has a blocky elbow.
- **Small props from `map-objects` are a lottery.** Roughly half needed a retry: a near-black tree, an isometric
  base under a tree, an iso bridge, flowers drawn as a house. A shared style suffix that named roofs and plaster
  leaked into the props, so it was cut back to style words only (`style.json` records both).
- **The quadruped template is a different family**: the cat is flatter and has a thicker outline than the v3 people.
  It also offers walk only for the directions asked and a single-direction sit.
- **Scale.** Doors are about 26 px and the characters 31 px, so the cast reads slightly chibi against the houses.
  v3 cannot go below a 32 px canvas.

### Rebuild
`python3 tools/build.py` → `topdown-demo.html`; `node tools/record.js file://$PWD/topdown-demo.html work/frames`, then
ffmpeg (command in this folder's history: `-framerate 30 -c:v libx264 -crf 14 -pix_fmt yuv420p`).

## Repository note (2026-11-05)

Committed to the game repo as the approved art-direction prototype (ADR 0103). All asset filenames are filename-safe
(`tools/safenames.py`; rebuilds before and after the rename are byte-identical). Not committed: frame dumps (`work/`,
`fc/`, `v8/`, `v9/`), the built `t13/board.html`, and all videos and screenshots, which stay out of git (#348).
