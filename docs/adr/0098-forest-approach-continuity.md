# ADR 0098: Authored formation at the forest crossing

**Status:** Accepted, 2026-10-29

## Context

The party reaches the Forest Road ambush at the full-height x8 crossing, but
combat used the map's fixed x1/3 spawns. After the fight, exploration reused
the crossing tile even when its painted surroundings made the party appear to
stand on rubble. Moving every static spawn east by six cells previously made
small and full parties take substantially more casualties in a paired combat
screen. The exploration follower trail is presentation state and is not saved.

## Decision

A battle story node may declare an optional `approach`: its explore map ID and
one entry for each crossing tile, with six preferred combat positions and an
aftermath return position. Only a matching entry from exploration supplies
positions to `createBattle`; direct battles and the simulator retain the map's
fixed spawns. The first combat position is the crossing tile where it is safe;
the rubble crossing shifts its leader one tile. The remaining positions form
an authored, dry spread on the near side of the encounter.

The finished battle changes both the existing `world.returnPos` and
`location.pos` only when the battle node, encounter, map, and recorded crossing
tile still match. The location update seats the party correctly during the
immediate aftermath conversation. Victory and defeat use the same return seat,
and dialogue save/load needs no new state.
The forest return positions provide six consecutive clear eastward seats,
matching the explore scene's normal party seating. Content validation checks
crossing coverage, legal and distinct positions, props and every encounter
variant, and the return lane. No enemy, hazard, global movement rule, or
exploration route changes.

## Consequences

The initial battle formation follows the actual approach without promising an
exact copy of the unsaved follower trail. Forest encounter balance is assessed
with matched legal-command seeds across all three variants and party sizes
1/2/3/6; the measured results and real browser transition are in
`docs/coordination/handoffs/ambush-continuity-334.md`.
