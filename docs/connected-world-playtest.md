# Connected Act 1 playtest

For a quick test without affecting your campaign, choose **Explore the riverside**.
Meet Pebble, open **Travel journal**, then choose **Walk to Ba Dan**. From the
village use **East road → Forest Road** to explore the connected region, or
**River path → Riverside** to return. The journal remembers your discoveries
and visited places during the preview. **Pause → Leave preview** restores your
campaign; preview progress is intentionally temporary. Normal campaign saves
retain discoveries and visited places across sessions.

Compare short walks, long walks and diagonal paths: the middle pace should be
consistent, starts/stops brief, and feet should settle onto the path at rest.
Try the painted lane west of the banyan and tap Mira's visible body. Directional
north/south artwork is a separate asset delivery.

Start a new game and finish the opening. From Ba Dan, walk to the east gate or
use **East road → Forest Road**. The party walks to the exit before changing maps.

- Return west immediately, then re-enter the forest. Arrivals stand beside their
  gates; characters should not slide across the new map using the previous walk.
- Visit Dema on the northwestern verge. Finish the conversation and talk again:
  she remembers the turtle-ducks. Your party keeps its place and XP.
- Walk east. The road introduction interrupts the first crossing; continuing
  encounters the quarry workers. A long tap beyond them cannot skip the fight.
- After the encounter and dialogue, explore the road again. Both exits are open.
  You can return to Ba Dan, speak with villagers or visit the riverside.
- Enter the quarry gate and approach the watch. All existing parley options and
  Ruon's decision still work. After deciding, walk east into The Cutting.
- Find Sen on the southern verge. The tea conversation is optional and remembered.
  Escorting Ruon encounters Jin's people; trading him leaves the route open.
- Continue east to the quarry floor. Before approaching the driller, try a full
  return trip to Ba Dan and back. No resolved encounter or XP payment repeats.
- Save on a cleared road, reload, and repeat the return trip. Old format-2 saves
  also load; their visited story nodes prevent replaying encounters.
- Approach the driller to continue the quarry story and its existing ending.

Check touch and mouse, portrait and landscape, reduced motion, large text, and
Canvas/WebGL. Routes should remain named and tappable. Locked forward routes
show their reason when approached (also in the button tooltip). The first slice
uses visible encounter groups; moving patrols and additional regions are future work.

## Quarry victory and the walk home

Run both custody routes across suitable parties. After winning at the quarry,
finish the summary and choose its continuation. The party should remain at the
quarry with a westward objective. Save here, reload, and walk west through the
cutting, gate and forest into Ba Dan using the ordinary route controls.

- Speak to Sen and Dema on the return. They should know the crews have passed;
  they should not repeat the original missing-worker setup.
- Visit the roadside discoveries on the way home, including one not visited
  before the rescue. Repeat a discovery and check the homeward objective remains.
- In Ba Dan, visit Mira, Pella, Gao and Dorin. Mira's account must match Ruon's
  custody. Gao still objects to the trade route while acknowledging the rescue.
  Pella should remember an earlier conversation only if it happened.
- Save in Ba Dan, reload, revisit the villagers and walk back towards the quarry.
  Resolved fights, rewards and payments must not repeat. The party, discoveries
  and rescue/custody state must survive.
- Check the defeat ending separately: it remains terminal and must not offer a
  successful homecoming or claim the workers have been freed.

For the ten hero contributions, use the node/location table in
[the writing guide](writing-guide.md). Cover them across multiple parties, with
same-element companions together where practical. Reach each through ordinary
movement and optional interactions; direct debug entry is only a diagnostic,
not route acceptance. Include the riverside before departure, Dema and both
forest discoveries, the earthbender gate approach, Sen's rest stop, the escort
choice and the quarry approach. Record the actual speaker and whether a present
hero is conscious. Absent or unconscious heroes must use the authored fallback.

Record commit, party, seed, custody route, save checkpoints, renderer, viewport
and observed results with the integration review. These instructions are a test
plan, not a claim that the full playthrough has passed.
