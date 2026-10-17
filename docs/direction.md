# Project direction: end goal, design pillars and the owner's decisions

This is the one place that says what the game is meant to become, what the owner
has decided along the way, and what has been tried and rejected. The phase plan is
[roadmap.md](roadmap.md); the approved look is [player-view-target.md](player-view-target.md);
the art specification is [art-bible.md](art-bible.md); individual technical decisions
are in [adr/](adr/). Where this page and an older document disagree, the dated
decision here is the newer one.

## End goal

A big, beautiful, non-linear tactics RPG world to wander, in the manner of the
best modern isometric party RPGs: houses and caves to enter, places worth walking
to just to look at, and a world that feels lived in. People and animals move
about on routines and make sounds; nobody stands still breathing.

- **Play:** turn-based combat happens in place in the world, never on a separate
  battle map. Combat is environmental: earth walls block shots and movement, water
  pulls reposition, air shoves enemies and props (an oil flask into place), ground
  burns, hay catches fire. Height matters. Hot-seat play on a tablet stays the
  core use; exploration is single-player for now.
- **Look:** 2D and drawn, clean and close to an animated series in feel, never
  generic generated "slop". One elevated oblique camera at the map's 2:1 angle for
  everything. Bending is the differentiator: a water move must feel magical.
  The dream overworld is a hand-drawn world with depth, roaming animals, birds
  and falling leaves. Not a chunky retro pixel game.
- **Scale:** eventually about ten playable characters and many regions in one
  continuous world with offshoots.

## Current goal: finish the demo

The early game is the template for everything after it, so it is finished and
polished end to end before anything else grows:

**Ba Dan → forest road → quarry → the Driller → outcome → back to Ba Dan.**

No new regions until that loop is done. Since 2026-10-08 the narrower working goal
is **Ba Dan only**: polish the village until it proves the art pipeline can make a
finished, convincing map, then carry the method to the other maps.

## Design pillars (owner's words where quoted)

1. **Consistency of style above everything.** "Point is consistency is so
   important." Every new character, animal, prop or map is judged at game scale
   beside the party on a real map, under the game's lighting, never alone.
2. **A lived-in world.** "That lived-in world is crucial." NPCs and animals move;
   gentle ambient motion (water, leaves, smoke) is approved.
3. **Nature-led places.** Ba Dan is greener, with verges, trees, beds and planted
   banks; stone is for paths and courts. Walkable ground stays calm.
4. **No rectangles, no invisible walls.** Every new or rebuilt map gets its own
   non-rectangular shape with physical edges (cliffs, water, trees, buildings).
5. **Things are set into the world.** Objects and buildings have contact
   occlusion all round the foot, shadows from one warm upper-left light, and
   grass or dirt where they meet the ground. Nothing floats.
6. **Lighting and shadows on everything.** Characters, objects and buildings all
   share the same key light and cast shadows.
7. **Motion from real sources.** Character motion comes from motion capture or a
   dedicated tool, never hand-keyed by an agent. Only Mixamo, CMU or authored
   motion ships (no share-alike or non-commercial licences).

## Art route (settled)

- **Maps** are painted. A map is one continuous painting made region by region
  over its true geometry, then split by the geometry into ground plates and
  upright pieces so figures walk behind things
  ([ba-dan-scene.md](art/ba-dan-scene.md), `scripts/art/ba-dan-regions/`).
  Owner, 2026-10-09: "repaint is what I want. lets make the game that with good
  assets that move over it." Polishing isolated pieces on a lawn is abandoned.
- **Everything that moves** (party, NPCs, enemies, animals) comes from the house
  character generator at the high top-down view, with motion-capture walks. Kaya's
  generated model "G" is the standard; the others are toned toward it.
- **Animation** follows the keys-first process: intent and key poses, a timing
  chart with holds and hit-stop, keys approved before in-betweens, effects born
  from the strike, eight review gates, shown at game scale.
- **Bends:** one bend animation per character for all its bending abilities, with
  per-element effects; polish later.

## Current art problem: objects vs characters

Owner, 2026-10-13: "Objects still seem a bit off. Some items feel AI made like the
fruits and tables. Almost like a different style compared to our various characters.
If this fails I'm likely going to pivot to a different style."

Diagnosis: [art/object-style-diagnosis.md](art/object-style-diagnosis.md). The
painted objects are drawn as glossy display pieces and are about twice the size the
figures need (fruit the size of a head); the characters are restrained and functional.

Trials on one market corner (the fruit table by the canal), all judged at 1x and 4x
beside real figures:

| Route                                                                          | Result                                                                                                                                                                  |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repaint the objects in place with the image tool (pixel restyle; calm restyle) | Calmer rendering possible, but the tool will not change size                                                                                                            |
| Free redesign with smaller goods (two tries)                                   | Better use cues, still oversized and soft                                                                                                                               |
| Deterministic filters                                                          | No useful change                                                                                                                                                        |
| Separate sprites drawn by the image tool (two tries)                           | Unusable                                                                                                                                                                |
| Hybrid: restyled table plus goods shrunk by hand (two tries)                   | Correct-size goods look like specks on furniture that is itself oversized                                                                                               |
| **Objects from the characters' own generator**                                 | **First match in hand and size.** Remaining faults are integration: table rotated off the 2:1 axis, weak contact and shadow, no grass over the feet, small fruit glints |

Next, if the owner accepts the generator objects in game: one integration round on
the same corner, then the whole village (about 14 object families, 60 to 90
sprites), with the baked objects cleaned out of the ground and the new objects
added as separate scene pieces with footprints and depth keys. The plan for the
moving residents is [art/character-lane-plan.md](art/character-lane-plan.md).

## Decisions log (owner)

| Date       | Decision                                                                                                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-09-17 | Three player-view concepts approved as the long-term look ([player-view-target.md](player-view-target.md))                                                                                                                                 |
| 2026-09-22 | Core vision (above); no human artist, so the pipeline is generation plus tools                                                                                                                                                             |
| 2026-09-24 | Kaya's costume and colours locked (turnaround v2)                                                                                                                                                                                          |
| 2026-09-25 | Painted maps plus generated characters; Kaya's model G and its style are the standard                                                                                                                                                      |
| 2026-09-27 | Bend process approved; one bend per character, per-element effects                                                                                                                                                                         |
| 2026-09-28 | Demo first; maps rebuilt as non-rectangular with interactables (shove, oil, fire, cover); consistent style                                                                                                                                 |
| 2026-10-01 | Driller tuned (move 4, HP 130); fire lights fuel props instead of breaking them; dousing rule                                                                                                                                              |
| 2026-10-03 | Focus on art and visuals; roadside props block movement; ship art that clearly beats today in lit in-game captures without per-batch sign-off; The Cutting's enemies +40% HP; title text stays separate from key art (the name may change) |
| 2026-10-06 | One fine grain for all scene art, matching the characters, never chunky pixels                                                                                                                                                             |
| 2026-10-07 | Keep the character style and the 45-degree map angle                                                                                                                                                                                       |
| 2026-10-08 | Ba Dan only until it is polished; budget limits delegated                                                                                                                                                                                  |
| 2026-10-09 | Continuous repainted maps with moving pieces over them                                                                                                                                                                                     |
| 2026-10-10 | Keep the current Ba Dan layout; greener, nature-led balance; character work approved                                                                                                                                                       |
| 2026-10-11 | Gentle village motion approved (shipped 2026-10-13)                                                                                                                                                                                        |
| 2026-10-13 | Objects must match the characters or the style may pivot; generator objects being proven                                                                                                                                                   |

## Rejected approaches

- Building villages from separately generated pieces on a lawn: each piece carried
  its own projection (19 to 25 degrees instead of 26.57), light and grain;
  "slanted weird", "stuffs floating".
- Chunky pixel-art restyles of props next to fine painted characters.
- A whole map from the character generator's tile tools: clean but generic, no
  match to the painted look.
- The generator's low top-down view (reads as eye level on our maps) and its own
  walk templates (stride off-axis).
- A denser, heavily paved Ba Dan centre (94 percent paving).
- Agent-keyed character motion.
- Turning shadows off: the owner wants lighting and shadows everywhere.

## Open questions for the owner

- Do the generator-made objects look right in game? If not, the art style may pivot.
- How to show a character fully hidden behind a house (outline or not).
- Hanru's look, and whether followers keep a tile away from house walls.
- The game's final name.
