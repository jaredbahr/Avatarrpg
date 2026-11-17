# ADR 0118: Downed, not out: a friend can help a fallen hero up

**Status:** proposed, 2026-11-17. Answers playtest issue #846 ("Downed, not out", owner decision of
2026-11-17). Builds on ADR 0110 (difficulty), ADR 0114 (the balance tripwire) and ADR 0116 (guest allies).
Numbered 0118 because 0117 is the branch-when ADR (merged) and 0115 is taken by the input-actions ADR in open PR #803.

## Context

Until now a hero who reached 0 HP sat out the rest of the fight. The party is brought back at full health
after the fight (`reviveParty`), so the loss is only the _time_ the hero spends doing nothing: a child at the
table, watching. The owner's playtest note (#846) is that this feels bad, and that a friend standing next to
a fallen hero should be able to do something about it.

What the engine already had:

- A downed unit stays in `BattleState.units` with `hp <= 0`, keeps its `pos`, and stays in `order`
  ("dead units stay listed but are skipped"). Occupancy, line of sight and `unitsOnTiles` all ignore it.
- Universal abilities (`ContentIndex.universalAbilities`, today only Shove) are granted to the party and
  guests at read time by `unitAbilities()`, so a save made before one existed gains it with no migration.
- Abilities are data: a `Targeting`, a list of `AbilityEffect`s, an AP cost. The preview, the AI scorer and
  the reducer all read the same ability record.

## Decision

### 1. One shared ability, "Help up"

A universal ability, `help_up` (`src/content/abilities/universal.ts`), on every party member and guest:

| Field     | Value                                                |
| --------- | ---------------------------------------------------- |
| AP cost   | **2**                                                |
| Range     | 1 (adjacent, diagonals included, like every range-1) |
| Targeting | `{ shape: 'unit', allow: 'downed' }`                 |
| Effect    | `{ kind: 'revive', fraction: 0.25 }`                 |
| Cap       | once per fighter per fight (`BattleState.helpedUp`)  |

It is data, so a different table can tune the fraction, or a character could carry a better version, with
no change to `src/core/`. What `src/core/` gained is the vocabulary: one `AbilityEffect` kind (`revive`),
one `Targeting` value (`allow: 'downed'`), and the cap.

### 2. What it does

A valid target is a friendly unit at 0 HP on a tile no living unit stands on, who has not been helped up this
fight. Resolving it (`BattleDraft.revive`):

- sets their HP to `max(1, round(maxHp x 0.25))`;
- clears their statuses (a Burning hero must not fall again before they have moved), their move and their
  AP, including banked and pending AP: they have been picked up, not refreshed;
- records them in `BattleState.helpedUp`, and emits `unitRevived` (the log reads "Kaya helps Sura up! (9 HP)").

Their slot in `order` never left, so they act when it next comes round: this round if their turn is still to
come, otherwise the next. It uses no RNG: the same board and command give the same result, which saves, the
AI and the balance simulator all rely on.

Everything that asks "can this be aimed here?" goes through `isValidTarget` and `unitsTouched`, so the
preview, the AI and the reducer cannot disagree: the preview shows the HP they would get as a heal chip.

### 3. The numbers, and why

**2 AP.** Costing in this game is 1 AP basic, 2 AP standard, 3 AP big (`abilities/helpers.ts`), and a hero
has 4 AP a turn. 2 is a standard action: the helper gives up half a turn, and still has a move and a basic
attack or a one-AP action left. 1 AP would make it free enough that standing a hero up becomes the default
answer to a hit, and 3 AP would take most of the turn, which makes it a luxury a child will skip.

**25% of maximum health.** A rescued hero should be able to take a hit, not shrug off the thing that felled
them. A level 1 to 3 hero has 26 to 46 maximum HP (`createGame` at those levels), so a quarter is 7 to 12 HP:
about one enemy hit of margin, and a hero who has to be looked after, or helped through the rest of the fight
by standing behind someone. The helper still chooses between putting a body back on the board and killing
the enemy that fells it, which is a real choice. Half health would make the rescue a full heal and a downed
hero a speed bump.

**Once per hero per fight.** The cap, not the cost, is what stops it trivialising a fight: a fight cannot be
won by endlessly standing the same hero up. It is held in a new `BattleState.helpedUp` list (ids), not in a
status or a cooldown, because neither survives the hero lying at 0 HP and being ticked. The list is
optional in the type and the save schema: absent until somebody has been helped, so a fight where no one
fell, and every save written before this, carry no key.

**No AP and no statuses.** The hero rises without acting this turn. That keeps the effect modest and makes
the AP cost real on both sides: the table spent 2 AP to give back a hero who then has to wait for their
turn.

### 4. The AI

The enemy AI never has it (enemies get a universal only by naming it, and none does). The _party_ AI, which
the balance simulator uses and a guest ally uses, does: `scoreAbility` scores a revive as the HP gained plus
`REVIVE_VALUE` (40, scaled by the profile's `support` weight), and `candidateTargets` includes a downed
friend's tile when the caster has such an ability. A simulated party therefore does stand fighters up when a
rescue beats the other things it could do, which is what the balance tripwire then measures.

### 5. The UI

Help up is a normal action button, with the AP cost under its name. It is not on the bar all the time, which
would add a button to every hero's already-full dock: it appears while a friend lies on the board who has
not been helped up, and is live once the hero is adjacent to them. If a friend is down but out of reach, the
button is disabled and says so ("Stand next to a friend who is down to help them up."). Aiming and
confirming work as for any ability: the downed tile is highlighted, and the confirm bar shows the HP they
would get. The rise plays the heal pulse and a `+HP` floater; the log line is "Kaya helps Sura up!".

### 6. Saves

`BattleState.helpedUp` is in the save schema (`src/core/save/serialize.ts`), optional, so older saves load
unchanged; `serialize.test.ts` and the new `helpUp.test.ts` round-trip a mid-fight state that has it.
`help_up` is a new ability id and is in `ids.ledger.json`.

## Consequences

- **Balance moves, as intended.** The balance simulator's party AI now rescues fallen fighters, so rows with
  deaths (larger tables, Hard) gain HP left and win rate. The tripwire is re-baselined in this PR with the
  before/after table in the description. Story keeps winning every row; the gains are on Hard, where
  deaths cost the most.
- **A new targeting value.** Anything that switches on `Targeting.allow` must know `'downed'`: the ability
  card and the content reference already do; the preview, `isValidTarget`, `allowsCasterTarget` and the AI
  were taught here.
- **Guests.** A guest that falls can be helped up like a hero if the encounter does not end when it falls
  (`loseIfGuestFalls` still loses the fight the moment it does).
- **Not done:** no "bleed out" timer, no revive potion, and no enemy that raises its own dead. If a later
  region wants any of these, `revive` is the effect to build on.
