# Forest opening pacing review

Owner: root. Read-only product audit against `9e005b1`; normal UI observations
on preserved production build `798bee8`, WebGL, 1280×720, Sura/Riko level 1.
The party was created through setup and walked through the opening, village,
Dema conversation and forest crossing. The generated seed was not recorded.
No combat outcome or party state was injected.

## Observed choices

Riko spent her first four movement points approaching, then ended with five
unused AP. The slingers responded and Riko dropped from 28 to 24 HP. Sura
also spent four movement points approaching, but Water Whip reported no target
within five tiles. On round 2 Riko advanced another four cells; Strike still
reported no target within one tile. This single route is evidence of two
approach-only turns, not a claim about every roster or optimal play.

Movement forecasts correctly warned that slingers could attack after their
own movement. Both Sura and Riko destination previews could disappear below
the expanded confirmation dock; a separate camera owner is fixing that.

## Source causes to measure

- `forest_road.partySpawns` still uses the old two-column pattern at x=1/3.
  The exploration battle crossing is x=8. `createBattle` always uses authored
  spawns, even when the party has already walked halfway through the map.
- Forest opponents start at x=17/18. Chebyshev distance from Riko's second
  party slot (3,4) to the nearest slinger (17,5) is 14. With four movement and
  one reach, a stationary opponent needs at least four Riko turns to reach;
  actual cautious enemy movement changes this bound. This is a geometric lower
  bound under a stated stationary assumption, not a simulation result.
- Sling Stone has reach 6; Sura's Water Whip has reach 5 and Strike reach 1.
  The all-slinger variant therefore makes the long approach particularly costly.
- CombatScene's Tip and storyEngine's initial message use the base encounter
  text, ignoring the selected variant's authored tip/intro. The actual slinger
  party saw the generic puddle advice. `battle.variantId` already preserves the
  selected variant, so presentation can use it without adding save state.

## Next bounded decisions

First restore variant-specific introductory information with base-text fallback.
Coordinate CombatScene ownership after the movement-preview repair. Test both
variant override and base fallback through the real battle state.

Then compare a forest-only deployment near the actual crossing with the current
deployment. Preserve dispersed six-person placement and keep the pond accessible;
do not simply move all six spawns onto water. Measure first meaningful action,
approach-only turns, incoming damage, victory rates and lost party members across
all three variants and solo/three/six-person rosters using legal commands. Review
real paired play before accepting a tuning change. Do not increase global move,
weaken slingers, change XP or expand the ability system to hide a layout problem.

No pacing or balance change is included in PR64's frozen v0.2.1 revision.
