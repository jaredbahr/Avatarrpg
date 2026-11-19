# ADR 0122: Sparring bouts: out of the bout, and a platform that tips

**Status:** proposed, 2026-11-19. The rules are the owner's (2026-11-19, answering two questions in the build
session): "Knocked down or shoved out" and "At each round's end". Builds on ADR 0118 (help-up), ADR 0011 (the
region graph) and the `holdAtRoundEnd` objective (Scene 2.5's winch).

## Context

The scripts give every region optional side fights, and two of them are not fights at all but friendly
bouts: SF-2.2, "The tipping platform" (Saltstep, `docs/story/scripts/act2-sparks.md`), and SF-3.3, "Three
flags" (Bellweather, `act3-currents.md`). Nobody is angry in either, nobody is hurt, and the losers wash bowls.

SF-2.2 needs two things the engine does not have:

- **Going in the water counts as out.** Today deep water is a blocked tile: a shove that would carry a unit
  into it stops at the edge (`BattleDraft.slideFrom`), and a unit at 0 HP is downed and can be helped up
  (ADR 0118).
- **The platform tips toward whichever side has more people on it.**

SF-3.3 needs a hold objective that counts: "take two [flags] and hold them through a gust".

## Decision

### 1. A bout is an encounter setting, not a new mode

`EncounterDef.bout?: { outOn: readonly TerrainId[]; tipping?: Tipping }`. Everything else about the fight
(the roster, reinforcements, the difficulty levers, victory when one side is all out, "Try again" or "Carry on"
on a loss) is the ordinary encounter. A bout is data, so a later sparring match anywhere needs no change in
`src/core/`.

### 2. Out of the bout (owner: "Knocked down or shoved out")

- **0 HP is out.** In a bout nobody is helped up: `help_up` has no valid target, and the preview never offers
  it. Out stays out until the fight ends; the party is restored after it as after any fight.
- **A forced move into an `outOn` terrain puts the unit out at once, whatever its HP.** A shove, a knockback or
  a tip (§3) that would carry a unit onto such a cell (SF-2.2: `water_deep`, which is every cell off the
  platform) moves it there and puts it out. Walking never can: those cells stay blocked for movement.
- Out is recorded on the battle (`BattleState.boutOut`, a list of unit ids), not as a status, so no status
  rule, tick or cleanse can touch it. It is a new `BattleState` field, so it goes into the save schema in
  `src/core/save/serialize.ts` with the mid-battle round-trip test.
- The unit keeps its cell for the drawing (the splash, the figure sitting in the water) but, like a downed
  unit, blocks nothing and is never targeted.

### 3. The tipping platform (owner: "At each round's end")

`Tipping = { axis: 'x' | 'y'; pivot: number }`: the line between the platform's two halves.

- **When a round ends**, count the fighters still in on each half (both sides; a unit standing on the pivot
  line counts for neither). If one half holds more, every fighter on that half slides **one cell** away from
  the pivot, toward its edge. Equal halves do not tip.
- The slide is a forced move like a shove: a unit whose next cell is blocked by a wall or a fighter stays
  where it is (units nearest the edge move first, so a line of fighters moves together), and a slide onto an
  `outOn` cell puts the unit out (§2).
- It runs after round-end objectives and before the next round's first turn, and it uses no RNG.
- **It is shown before it happens.** While a round is in progress the board marks the heavier half and the
  fighters who would slide, recomputed after every action, from the same function the round end calls
  (`forecastTip`). The rule "anything that tells the player what an action will do runs the real rule"
  applies: the forecast is never written in parallel.

### 4. The forecast says "Out of the bout"

`previewAbility` and the reaction forecast already replay forced moves on a copy of the board. In a bout, a
forced move that ends on an `outOn` cell forecasts **"Out of the bout"** on that unit, in the place a
knockout would show. The AI's `scoreAbility` reads the same forecast, so shoving someone in scores as a
knockout, and it still consumes no RNG.

### 5. Holding a number of cells (SF-3.3)

`holdAtRoundEnd` gains `minHeld?: number` (default 1, today's behaviour): the fight is won when a round ends
with living party members or guests standing on at least `minHeld` distinct cells of `cells`. SF-3.3 is three
flag cells with `minHeld: 2`.

## What is not decided here

- **The words.** The forecast chip "Out of the bout" is interface wording; every other line in these fights
  is the writing pass's.
- **Art.** A splash for going in, and a tilt cue on the platform, are presentation, built with SF-2.2.
- **SF-2.2's board.** Saltstep's maps are being rebuilt (#869); the bout waits for its platform to exist.
- **Difficulty.** Bouts sit inside their region's band like any fight, and the balance tripwire (ADR 0114)
  adds their rows when they ship.

## Consequences

- `src/core/` gains one encounter field, one battle field, one round-end step and one forecast outcome.
  Nothing outside a bout behaves differently: with no `bout`, `boutOut` stays empty and no round end tips.
- A saved mid-bout battle loads with who is out and where the platform will tip.
- Tests: a shove into `outOn` is out at full HP; 0 HP in a bout cannot be helped up; tipping at round end
  with heavier, equal and pivot-line cases; a line of three slides together; the preview and the round end
  agree; a mid-bout save round trip; the AI prefers a shove that puts a fighter out.
