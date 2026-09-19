# Forest opening pacing review

Owner: root. Read-only product audit against `9e005b1`; normal UI observations
on preserved production build `798bee8`, WebGL, 1280×720, Sura/Riko level 1.
The party was created through setup and walked through the opening, village,
Dema conversation and forest crossing. The generated seed was not recorded.
No combat outcome or party state was injected.

The normal UI fight subsequently ended in victory on Sura's round-2 turn.
Riko remained at 24/28 HP; Sura had fallen to 11/26 before her first attack.
Sura moved into range and used five Water Whips, defeating both 19-HP slingers.
The first hit dealt 13 (critical), then the wounded target fell; the other
target went 19 → 12 → 5 → defeated. Riko used no attack or utility ability
before victory. This is a clear pacing/participation concern for this observed
pair and sequence, even though the fight was winnable. The browser remains on
the victory Continue screen, preserving the campaign for level-2 review.

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

## Paired local screen of a closer deployment

An in-memory candidate shifted only forest party spawns six cells east, retaining
the row pattern. Source content was not edited. The existing legal-command
`runCombat` simulator compared current/candidate layouts for all three variants,
solo Riko, Sura/Riko, and the standard three/six-character parties: 20 paired
seeds per row (`pacing-paired-0` through `19`), 480 fights total. No anomalies.
All sampled fights won; this small selected sample is not all-party balance proof.

| Roster / variant          | First party ability round, current → candidate | Party deaths, current → candidate |
| ------------------------- | ---------------------------------------------- | --------------------------------- |
| Solo Riko / slingers      | 3 → 2                                          | 0 → 0                             |
| Sura/Riko / slingers      | 2 → 1                                          | 0 → 0                             |
| Standard three / slingers | 2 → 1                                          | 0 → 0.45                          |
| Standard six / thugs      | 1.25 → 1                                       | 0.8 → 1.5                         |
| Standard six / bruisers   | 1 → 1                                          | 0.15 → 0.6                        |

Values are means. “First party ability” includes any ability, so this is only
an approach proxy, not a measure of interesting decisions or individual Riko
turns. Earlier engagement can increase casualties even when every fight wins.
Do not accept the naive six-cell shift. Review cover, spread and the actual
exploration-to-combat transition before proposing an authored placement.
The local probe and full results remain in `.shots/pacing/probe.ts` and
`.shots/pacing/paired-results.json` in the pacing-review worktree.

Variant introduction helper `1561cf9` has 29 focused story/variant tests passing.
CombatScene tip integration is complete in root commit `d42947c`; the selected
variant's tip survives save/reload without rerolling the encounter.

## Combined local checkpoint, 19 September

Root integration `103870e` includes the selected encounter introduction/tip,
forest aftermath retained over the explored world, movement-preview camera
reveal, and the bounded pond shoreline correction. `npm run verify` passed
822 tests in 94 files plus typecheck, lint and formatting. Production build,
art validation and asset budgets passed; JavaScript is 298.7 KiB / 300 KiB.

Nine focused production-browser checks passed in installed touch Chrome at
1280 × 720: Canvas/WebGL normal/Huge legal movement confirmation, the selected
slinger tip across reload, both backends' aftermath conversation save/reload,
and complete new-campaign trade and escort routes through the quarry and home.
Strict preview port 4267 stopped after the batch. Configuration and evidence
remain under `.shots/aftermath`; this is not physical tablet or audio acceptance.

The separate manual Sura/Riko campaign remains on older runtime `798bee8` at
localhost:4210. It reached level 2 and the Quarry Gate by normal exploration,
chose the direct approach, and is at Riko's first turn: Sura 23/30 HP, Riko
32/32 HP, facing a 32-HP deserter and 27-HP bandit. Chi Block is available at
2 AP. The forest save remains in slot 1. This older runtime is not evidence
for the combined corrections above.

The compact HUD correction and Riko directional contact art remain isolated
assignments pending integration review. PR64 stays frozen at `9e005b1` while
its existing required CI runs; no duplicate run or intermediate push was made.

## Quarry Gate follow-through: an actual failed approach

On the same manual `798bee8` Sura/Riko campaign, both characters advanced four
movement points on round 1. Both previews warned that the deserter could hit
the destination. Riko had no adjacent target and ended with all five AP unused.
Sura spent two AP on Ice Path (the real preview reported ice on three tiles),
then ended without an attack. This kept both characters close enough for the
deserter's two Fire Blasts to hit both: Sura took 11 + 11; Riko took 9 + a
15-point critical. Ice melted, then water became steam. Both acquired Burning.

Round 2 began with Riko at 5/32 and Sura at 1/30. Riko's attempted direct step
through oil was unaffordable; a legal dry flank consumed his four movement
points but still left Chi Block without a target. He ended without an ability.
Sura fell to Burning before acting. The encounter ended in defeat at round 3,
and Continue correctly opened the three-line retreat aftermath. The forest
manual save remains available. This is a poor, exposed approach, not proof that
the party cannot win, nor acceptance of the encounter's teaching quality.

A follow-up local legal-AI probe used current `db72f0b` content with 40 paired
seeds (`gate-pair-0` through `39`), level-2 Sura/Riko and the normal gate roster.
Full-health starts won 7/40; starts with Sura at the observed 23 HP won 2/40.
Riko used an ability in round 2 in every sample, but the AI never chose Chi
Block. The only injury fixture changed initial Sura HP; every combat command
was `runAiTurn`. No turn cap was reached. Probe and results are retained in
`.shots/pacing/gate-pair.ts` and `gate-pair-results.json`.

This sample identifies a specific party/encounter review gap; it is neither an
all-party balance report nor a human strategy evaluation. Before tuning, compare
a spread-out or defensive manual approach and inspect the AI's control valuation.
Keep the fire/oil lesson, route progression and existing party-size evidence.
Do not solve the observed loss by blindly moving spawns closer or weakening all
opposition. No balance or AI changes are included in this checkpoint.

The manual defeat branch subsequently recovered both characters to full health
at level 3. Sura learned Water Pull and Riko learned Bolas through the normal
level-up choices. The party chose escort, heard Riko's three-line response and
returned to gate exploration with the cutting objective. Manual slot 2 now holds
this checkpoint (19 September, 04:26:48 local); slot 1 still holds the pre-gate
level-2 forest state. This preserves both the failed approach and a route onward.

Combined `2f17e49` adds the reviewed Ruon watch and compact confirmation dock.
Verify remains 822/94; production build and 298.7-KiB bundle gate pass. Twelve
of thirteen focused production touch-Chrome UI checks passed immediately. The
remaining Huge movement-warning test sampled the camera before Cancel's canvas
resize had settled, tapping a different, unreachable cell. Its helper now awaits
the existing layout-settle hook and reads fresh bounds for each tap; the same
warning and no-immediate-threat assertions pass without changing product rules
or expectations. Strict port 4267 stopped after both runs.
