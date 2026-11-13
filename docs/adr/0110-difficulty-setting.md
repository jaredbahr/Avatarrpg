# ADR 0110: A difficulty setting, and a boss a lone hero can answer

**Status:** accepted, 2026-11-12 (#661). Amends the rule in `src/core/rules/difficulty.ts` that table
scaling moves only HP.

## Context

The demo's direction is "forgiving by default (most first-time players win if they try), plus a harder
option". #659 made the default forgiving (every encounter wins every simulated trial at every table
size) and left two gaps:

1. There was no harder option, so a table of tactics fans had nothing to pick.
2. A one-hero table could not beat the Driller with most heroes. The table scaling already halves the
   boss's health and removes the quarry bender, but a lone Kaya still lost every trial: the Driller acts
   with a whole table's worth of AP, and with its earth armour and the mud it churns, fire and air
   heroes did 1 to 4 damage a hit.

## Decision

**A difficulty on `GameState`.** `difficulty: 'story' | 'hard'`, Story by default. It is chosen at party
setup, changed in Settings while a game is running (a `setDifficulty` command; the next fight is built at
the new setting, a fight already on the field keeps its enemies), and saved with the game. The save schema
defaults a missing value to Story, the tuning every older save was played at, so there is no format bump.

**Applied only in `rules/difficulty.ts`.** `DIFFICULTY_PROFILES` holds one profile per difficulty; nothing
is per enemy (an encounter may override the Hard profile; see the 2026-11-13 amendment). Story is the authored tuning. Hard:

| Stat         | Story | Hard |
| ------------ | ----- | ---- |
| Enemy max HP | x1    | x1.1 |
| Boss max HP  | x1    | x1.2 |
| Enemy power  | +0    | +5   |
| Enemy max AP | +0    | +2   |

Damage and actions rather than health, because the fights must stay short. Health alone (1.25x, boss
1.4x) still won 99.6% at three heroes and put the Driller back at 8.6 rounds; building the roster for one
more player was 100% and up to 35 turns. At three heroes (every real party) Hard measures 78–100% per
fight and about 91% overall in the balance sim, with one to two heroes down a fight instead of none, and
the Driller at about 8 rounds.

It layers on the table scaling: a Hard boss still grows with the table and a small Hard table is still
thinned, so Hard means the same thing at every size. XP does not change: `xpRoster` still pays from the
authored roster.

**A boss below the baseline loses AP and armour, not just health.** Per missing party member it loses
1 AP (never below 3, enough for one real attack) and 3 defense (never below 0). Trash is unchanged: it
already leaves the field one for one. The baseline and larger tables are unchanged.

## Consequences

- The "only HP moves" rule becomes "HP moves for everyone; a boss below the baseline also loses AP and
  defense; the difficulty adds its profile". `difficulty.test.ts` and `difficultyLevels.test.ts` hold it.
- `BALANCE_DIFFICULTY=hard npm run balance` measures Hard. Story's numbers above one hero are unchanged.
- Real play always fields three heroes since the shared-ownership setup, so the one-hero table is the
  balance sim's (and an older save's) case; the rule keeps that table winnable without touching any other.
- Hard is tuned for three heroes, the only party real play builds. In the sim's larger tables it is
  harsh (the Driller wins about a third to a half at four to six heroes, gate fights drop as low as
  31% at five), and at one or two heroes the Cutting falls to 10–74%. Revisit if parties other than
  three come back.

## Amendment, 2026-11-13: an encounter may name its own Hard fields

#709 cut the Cutting's blade from 50 to 32 HP so the Story fight finishes sooner. The blade is the
Cutting's own enemy, so Hard lost its bite there: at three heroes it went from 84% to 100%, at two from
11% to 84% (owner: Hard keeps its bite at the Cutting, Story stays as #709 left it).

`EncounterDef.hard` is a partial Hard profile that replaces the shared one's fields for that fight only.
It is content, so the encounter says what Hard changes, and `rules/difficulty.ts` stays the one place a
fight's numbers move; Story never reads it, and nothing changes the roster, so the two levers stay two.
A Hard-gated reinforcement was the other option, but reinforcements are counted by table size and
carry no condition, and an extra body changes the roster the tests hold identical across difficulties.

The Cutting sets `hard: { hp: 1.5 }` (the shared Hard has 1.1), which lands back on the pre-#709 Hard
numbers: 84% at three heroes, 11% at two, Kaya, Sura and Bo 94%, in 5.4 rounds. Extra power or AP barely
moved it (+4 power still won 100% at three).
