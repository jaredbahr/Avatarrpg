# ADR 0010: The party in the world

**Status:** accepted, 2026-09-16 (lands in Milestone 3)

## Context

The owner's far-horizon render of explore mode is a painted world the whole
party walks through, with a roster down the side (portrait, element, health
and action points per member) and a bar of actions along the bottom. The
village before this milestone drew one figure, the leader, and teleported it:
`walkTo` moved `GameState.location` and reported nothing, so there was
nothing for the animator to play. The banner had a Pause button and a hint.

The rules keep **one** position for the party out of combat, and that is
right: saves, the story graph, NPC approach and the exit all key off it, and
nothing in the game asks where the third member is standing. Drawing the
others is a presentation question. So is walking: the route is the rules'
(`findPath`, `findApproach`), and only the playback is the scene's.

## Decision

- **A walk is an event.** `handleWalkTo` reports `partyWalked { unitId, from, path }`
  for the leader, with the route it computed, before any story event the
  walk leads to (an NPC's node, the exit's). A refused walk stays eventless.
  The choreography turns it into the same move track a combat `unitMoved`
  makes. Nothing else in `src/core/` changes: no state shape, no save schema.
- **Followers are a presentation trail, never saved.** `PartyTrail`
  (`src/app/anim/trail.ts`, pure, tested) is the line the party stands in:
  the leader's tile and the tiles it came from, one member each. On a walk
  each follower takes the tiles the line held between its old place and its
  new one, so everyone walks the leader's footsteps and stays a tile apart.
  The scene pushes those routes as synthetic `unitMoved` events, one push per
  follower, laid **alongside** the leader's track (`Animator.push` with
  `alongside: true` starts where the last push started instead of after it),
  so the party moves as one and reduce motion collapses all of it together.
- **The line is seated, not saved.** Wherever the party lands without walking
  (a new map, a loaded save, a story jump) the scene stands the line up again
  behind the leader: a chain of free walkable tiles leading away from the
  map's exit, straight before diagonal, off the villagers' tiles,
  deterministic. A chain, not a cluster, so the first walk plays like every
  other one. A loaded mid-village save therefore shows the party in a line it
  did not walk, which is the trade for keeping the save format untouched.
- **The roster and the hotbar are DOM, on the existing pieces.** One
  `.roster-row` per member, built from the unit panel's parts (the framed
  square portrait with its element badge, the name and player, the level,
  the health bar, the action pips), the leader's row on the gold plate; a
  row opens the member's inspector. The hotbar is an `.action-bar` of real
  actions: Talk (the nearest villager within three tiles, by name; walks the
  party over through the same `walkTo` the reducer already handles), Party
  (the leader's inspector), Save, Pause. No ability buttons: there is nothing
  to cast in a village, and a disabled fake hotbar would be a lie. Every
  control keeps the tap size at Largest text; upright or narrow, the roster
  becomes a strip above the map.
- **The banner tells the gate's name.** The title plate carries the place and
  the objective; beside the exit tile it reads the exit's label instead,
  which is the one thing the map cannot say for itself.
- **No minimap.** The village fits the viewport on every tier-1 device and the
  camera follows the walk. A minimap arrives with the first map that needs
  one, not before.
- **The painting is the village's ground.** The backdrop slot from ADR 0009
  applies unchanged; the owner's village painting drops in through
  `art:map` with no code.

## Consequences

- `GameEvent` gains one kind, switched exhaustively in the log formatter and
  the choreography; the reducer test for the village covers the plain walk,
  the refused walk, the NPC approach and the exit.
- The drawn party is checkable: `App.partyPositions()` reports where the
  village draws each member, and the explore spec compares that with the
  rules after a walk on both backends.
- A save carries no trail. That is deliberate; if a future map makes the
  line matter to the rules (a follower blocking a door), it becomes state,
  goes through the save schema, and this record is amended.
- `Animator.push` has two modes. Combat never uses `alongside`; the village
  uses it only for follower routes, whose tracks are as long as the leader's.
