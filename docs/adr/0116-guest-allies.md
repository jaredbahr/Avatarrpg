# ADR 0116: Guest allies fight beside the party for one battle

**Status:** proposed, 2026-11-15. Answers "Mechanic" in `docs/pipeline-proof-plan.md` §6 (the trial
region's one new mechanic, for Veyra's fight at the Saltstep docks, MQ-02; saga outline decision 15).
Builds on ADR 0011 (regions), ADR 0111 (per-region loading) and ADR 0112 (saves that survive the story
being edited). Numbered 0116 because 0115 is taken by the input-actions ADR in open PR #803.

## Context

The story script (#814, `docs/story/scripts/act2-sparks.md`, Scene 2.5) has Veyra, a non-bender with a
pressure lance and a signal flare, fight beside the party once. The plan's pass bar for the mechanic: one
general, data-driven addition, no Veyra- or MQ-02-specific code, and a second guest needs data only.

What the engine already had, measured on `main` at `46ddb53`:

- **Story allies.** `EncounterDef.allies` (Ruon in the Cutting) spawns enemy stat blocks as faction
  `ally`, `temporary: true`, AI profile `aggressive`, at the encounter's level, ids `a<serial>` after the
  party and before the enemies. `sameSide` already counts `ally` with the party, so the ability rules,
  forecasts and the enemy AI (`opponentsOf`) already treat them as the party's. Initiative ranks them
  with the party. They count as friendly bodies in the roster scaling.
- **XP and persistence.** `handleResolveBattle` pays XP only to `state.party` and `absorbBattleResults`
  copies back only party ids, so a battle unit outside the party earns nothing and nothing about it
  leaves the battle. A battle earns no XP mid-fight.
- **What was missing:** a guest built from a playable character's kit; a level relative to the party;
  a guest the table plays; a way to make a guest's fall lose the fight; and any sign in the HUD that a
  unit is a guest.

## Decision

### 1. The data

An encounter gains two optional fields (`src/core/types.ts`, zod in `src/content/schemas.ts`):

```ts
interface EncounterDef {
  // ...
  readonly guests?: readonly GuestAllyDef[];
  /** True: the fight is lost the moment any guest or story ally falls. Default false. */
  readonly loseIfGuestFalls?: boolean;
}

interface GuestAllyDef {
  readonly characterId?: string; // exactly one of these two
  readonly enemyId?: string;
  readonly level?: number | { readonly partyOffset: number }; // default: the encounter's level
  readonly pos: Vec2;
  readonly control?: 'ai' | 'table'; // default 'ai'
  readonly ai?: 'aggressive' | 'cautious' | 'support'; // ai guests only; default 'aggressive'
  readonly name?: string; // shown instead of the kit's own name
  readonly chosen?: readonly string[]; // character kits only: picks for `choose` entries
  readonly discipline?: string; // character kits only: the path past the gate
}
```

- **What it fights with.** A `characterId` guest is built by `createPartyUnit`, so it has exactly the
  stats, kit and universal abilities a party member of that level would have; open choices take their
  first option unless `chosen`/`discipline` say otherwise. An `enemyId` guest is an enemy stat block on
  the party's side, as a story ally is. A guest with its own art (Veyra) needs a character or an enemy
  record and its sprite like any other unit; that is content, not engine work.
- **Level.** A number is used as written. `{ partyOffset }` is the party's rounded mean level plus the
  offset, so a guest met at different points of a free-roam region keeps pace with whoever arrives
  (ADR 0011's ±2 levels of slop). Both are clamped to 1–10. Absent, the guest fights at the
  encounter's `expectedLevel`, as story allies do.
- **Validation** (`validateContent`): exactly one of `characterId`/`enemyId`, and it exists; `ai` is
  refused on a table guest and `chosen`/`discipline` on an enemy guest; picks must be offered by the
  character's kit or one of its disciplines, and the discipline must be one of its paths; the spawn is
  walkable, shares no cell with any other placement, and is off the party spawns and the map's props;
  `loseIfGuestFalls` is refused on an encounter with no guest or ally. `src/content/guestAllies.test.ts`
  holds each rule.
- **The unit.** A guest is faction `ally`, `temporary: true`, id `a<serial>`, placed after the story
  allies and before the enemies. An encounter without guests therefore builds the same battle, the same
  ids and the same initiative as before (a test holds this), and the shipped content changes nowhere.
  `EncounterDef.allies` stays: it is the shorthand for an `ai` guest built from an enemy at the
  encounter's level, so Ruon is now a guest too and is tagged as one.
- **Scaling.** A guest counts as a friendly body, as story allies always have: the under-strength trim
  and the reinforcements see `party + allies + guests` (`friendlyExtras`). An encounter that adds a
  guest sets its `baselinePartySize` with that in mind. Guests are not scaled against the party; only
  opposition is.

### 2. Control modes, and why `ai` is the default

- **`ai`** (default): the guest takes its own turns through the existing AI with the profile given.
- **`table`**: the guest's profile is `none`, as a party member's is, so the reducer refuses
  `runAiTurn` for it and accepts the same move, ability and end-turn commands a hero takes. The app
  (`Session.guestControllerFor`) gives the turn to **one person a round, in rotation**: the participant
  at `(story.deciderIndex + round - 1 + seat) mod people`, where `seat` is the guest's index among the
  table guests. It starts with whoever holds the story decision and moves one seat on each round; a
  second guest sits one seat further on. It is worked out from the saved round and decider index alone,
  so a loaded save gives the same turn to the same person, and nothing new is stored. The hand-off card
  appears when the controlling person changes, exactly as for heroes.

`ai` is the default because:

1. **Turns stay clear for children.** With `ai`, every child still has exactly their own hero's turns and
   nothing else to track. A table guest adds a unit nobody owns, a hand-off that changes every round,
   and an unfamiliar kit to read for one fight.
2. **It is what the story asks for.** Scene 2.5 says Veyra is AI-controlled, and her barks ("Winch
   first...") read as a character acting on her own.
3. **Solo and small tables.** In solo play a table guest is one more unit for one person; in a two-person
   game it lands on the same person every other round. The AI costs neither.

`table` is there for a fight where playing the guest is the point (a story beat that hands a child the
grown-up's lance), and for an adult table that wants it.

### 3. Turns are always labelled

- **AI guest:** the acting card reads "Guest turn · Veyra is acting" (it read "Ally turn" before) and the
  screen reader hears the same.
- **Table guest:** the hand-off card says "Hand the tablet to Ava" and "Playing Veyra, our guest"; the
  unit panel shows the name, a **Guest** chip and the person playing it; the screen reader hears
  "Veyra, guest (Ava)'s turn."
- **Turn strip:** a guest's chip carries a visible **Guest** tag (kept even where a phone strip hides the
  waiting names) and its accessible name is "Focus Veyra (guest)". The unit inspector's title says
  "(guest)". All sizes are rem and tokens (`--fs-xs`, `--c-ok`, `--hairline`); the chip is still a full
  `--tap` target. The render backends are unchanged: faction `ally` already has its own HP-bar tint.

### 4. XP, persistence and losing

- **XP:** none. Only `state.party` is paid, from the authored roster as before (`xpRoster`); a guest
  is not in it. The party's share is unchanged by a guest, as it is by a story ally.
- **Persistence:** none. Nothing of a guest leaves the battle: no level, HP, status, death or roster
  place. "Try again" rebuilds the guests fresh from the opening RNG, with the rest of the board.
- **Losing:** the fight is lost when every party member is down (as before), or the round cap is reached,
  or — only where `loseIfGuestFalls` is true — when any guest or story ally falls. In that case the log
  says "Veyra has fallen. This fight is lost." so the table is not left wondering. A fallen guest
  otherwise stays down and the fight goes on. `battleOutcome(battle, encounter?)` takes the encounter
  for this; `settleOutcome` and the turn hand-off pass it from the draft's content.
- **Carry on:** a lost guest fight routes down the battle node's `onDefeat` like any other, so the story
  decides that the fight is not repeated (Scene 2.5's Carry-on branch). Nothing guest-specific.

### 5. Saves

**No save field and no migration.** A guest is an ordinary `Unit` with fields the schema already holds:
faction `ally` and AI profile `none` (table) or a real profile (ai). The loss rule and the guest list are
read from the encounter at the moment they apply, like every other encounter rule. `serialize.test.ts`
round-trips a mid-battle save with an AI character guest, an AI enemy guest and a table guest, and the
load path's repair pass (`reconcileBattleResult`) leaves it unchanged. Every v5 save loads as before; a
save from before this change that is mid-Cutting has Ruon as faction `ally`, which is a guest now, and
plays the same.

What changes for an old save after a content edit: a mid-battle save loaded after an encounter's
`loseIfGuestFalls` or guest list changed plays its battle with the units it saved and the rule the
content now has. That is the same contract as an enemy's or an ability's data changing under a save.

### 6. Purity and determinism

All of it is in `src/core` with no DOM and no new randomness. Building guests draws initiative jitter for
each extra unit from the battle's seeded cursor, only in encounters that have guests. `previewAbility`
and the AI's `scoreAbility` are untouched and still draw nothing. The headless simulator lends a table
guest an AI profile, as it does the party, so `npm run balance` plays guest fights to the end.

## The win condition: decided (built: see the 2026-11-15 amendment below)

Scene 2.5 as merged (#814, owner decisions of 2026-11-15) settles it: **win** by stopping the winch (a
party member or Veyra stands at the winch brake at the end of a round) **or** by defeating the handlers;
**lose** when the whole party is down or the crate reaches the barge (six rounds); **Veyra cannot be
lost**. The last is this ADR's default: the encounter leaves `loseIfGuestFalls` unset, and a fallen guest
stays down while the fight goes on. (That she "sits behind the pump" is presentation for the art pass.)

Defeating the handlers works today. Stopping the winch needs an objective win condition, which the
engine does not have. The rule is small: it can be derived from the battle and the encounter each time
the outcome is settled, so it adds no save field either. It is not small to _show_: the target cells must
be drawn on the board on both backends (board-correctness parity, ADR 0002), the top bar needs the
objective and the rounds left, the AI needs to weigh the goal, and the guided tips need a line about it.
So it is the next change, with its own ADR amendment, in this shape:

```ts
readonly objective?: {
  readonly kind: 'holdAtRoundEnd';   // a friendly unit stands on one of `cells` when a round ends
  readonly cells: readonly Vec2[];   // the winch brake
  readonly byRound?: number;         // not held by the end of this round: the fight is lost (6)
  readonly label: string;            // the top-bar objective, written by the writing pass
};
```

Victory is "every enemy down **or** the objective held". Checking at the end of a round, rather than
whenever a unit stops on the cell, is what the script says and gives the handlers a turn to answer.

## Next steps

- **Barks.** Scene 2.5 gives Veyra five barks (first turn, lance, flare, an ally hurt, winning). They
  need a small data hook on the guest (`barks?: { onFirstTurn?: string; ... }`) and the speech-bubble
  presentation; the writing pass supplies the lines. Not built here.
- **Veyra's kit and art.** A `nonbender` character or enemy record with the lance and flare abilities, and
  her sprite and portrait, through the art pipeline.
- **Measure** the plan's guest-ally numbers once the trial encounter exists: files and lines touched in
  `src/core/`, `src/app/` and `src/render/` (this change: `src/core` adds `rules/guests.ts` and edits
  five files; `src/app` edits the combat scene, the inspector and the session; `src/render` none), and
  whether the encounter data alone places, kits and drives the guest (it does).

## Consequences

- A second guest, in any region, is data only: an entry in an encounter's `guests`.
- "Ally turn" becomes "Guest turn" on the acting card, for Ruon as well.
- The combat HUD reads "who plays this unit" through `Session.controllerFor`, which covers heroes and
  table guests alike; the hand-off memory is now the person who took the tablet, not a unit.

## Amendment, 2026-11-15: objective win conditions and round limits

The win condition the section above named is built. It is a contract change (a new encounter field, a
new way for a battle to end, a new overlay kind both backends draw), so it is recorded here rather than
in a new ADR: it exists for this ADR's fight and follows from it.

### The data

Two optional encounter fields (`src/core/types.ts`, zod in `src/content/schemas.ts`):

```ts
type EncounterObjective = {
  readonly kind: 'holdAtRoundEnd'; // a friendly unit stands on one of `cells` when a round ends
  readonly cells: readonly Vec2[]; // the winch brake
  readonly label: string; // the header line, written by the writing pass
};

interface EncounterDef {
  // ...
  readonly objective?: EncounterObjective;
  /** Lost if not won by the end of this round (Scene 2.5: 6). 1–50. */
  readonly loseAfterRound?: number;
}
```

Two changes from the sketch above, both for later fights:

- **The clock is its own field**, not `objective.byRound`. "Win before round N" is useful without an
  objective (a fight against the tide, defeat everyone first), and a later objective kind may want
  a clock of its own meaning. `loseAfterRound` works with or without an objective.
- **The objective is a union on `kind`**, a discriminated union in the schema, so reaching an exit or
  protecting a unit is one more member, with its own fields, not a set of optional keys on this one.

**Validation** (`validateContent`, held by `src/content/objectives.test.ts`): every objective cell is in
bounds and walkable, listed once, not a party spawn and not under a map prop (the fight would open won,
or could never be won), and no story ally or guest starts on one. An enemy may start on one: guarding
it is the point.

### The rules

`src/core/rules/objectives.ts`, used by the turn hand-off (`src/core/state/turnFlow.ts`):

- **Held at the end of a round, wins.** When the turn pointer wraps, and before the next round's
  upkeep (walls expiring, terrain ticking), `roundEndOutcome` looks for a living party member or
  guest (faction `party` or `ally`) with any cell of its footprint on an objective cell. One there
  seals the battle as a victory, the log says "Kaya holds the objective. The fight is won!", and
  the round is left on the one that ended.
- **The last round ends without a hold, loses.** Checked in the same place, after the hold, so holding
  on the final round still wins. The log says "Out of time. This fight is lost." `battleOutcome`
  also reads `round > loseAfterRound` as a defeat, so a save whose content later shortened the limit
  settles on load rather than playing on.
- **Every enemy down still wins, at once**, mid-round, as ever. **The party down still loses, first:**
  the round-end check runs only while `battleOutcome` says the fight is active, so a guest on the
  brake never outranks a wiped party.
- **No randomness.** Nothing here draws from the RNG; `previewAbility` and `scoreAbility` are untouched.
  An encounter without either field takes the old path exactly (the round-end check returns before it
  reads anything).

### The AI

`src/core/rules/ai.ts`, flat points on the same scale as an ability's score, all 0 without an objective
(so the shipped fights play as before):

- **The party's side** (AI guests, and the party in the headless simulator): standing on an objective
  cell is worth `OBJECTIVE_HOLD` (60, more than a kill's 25 plus its damage, so a guest on the brake
  does not step off for one); every step away costs `OBJECTIVE_PULL` (3).
- **Enemies**: standing on it is worth `OBJECTIVE_BLOCK` (24, about a kill); every step further than
  adjacent costs `OBJECTIVE_GUARD` (1.5), so the rest gather round it without all queueing for it.
- **First move.** A unit not on an objective cell that can reach a free one this turn walks there first
  (the safest reachable cell, then the cheapest), then plays its turn from there. The values also
  enter every move the planner compares (as the difference from where the unit stands) and the
  no-attack reposition, so a guest out of reach closes on the cell and a holder stays put.
- Enemies contest a held cell the way they fight anyone: by attacking the holder. A dedicated "hit
  whoever is on the brake" bias is left until the trial encounter shows it is needed.

### Presentation

- **The board**: a new overlay kind, `objective`, from the scene's view model (the renderer reads no
  content; `combatObjective.ts` builds one layer object per objective so the outline caches hold),
  drawn under every other overlay, on everyone's turn, while the fight is on. On the top-down board it
  is part of the organic wash layer both backends already draw (`topdown/wash.ts`): a mint wash
  (`OBJECTIVE_RGB`, a colour no other overlay, surface or faction uses), a ring at each cell's foot so it
  still reads with a figure on it, and a small pennant in the cell's upper corner. Under High contrast and
  on the orthographic board it is a cell overlay in `OVERLAY.objective`/`objectiveEdge`, through the
  shared `overlayColors` both backends read. Board-correctness parity holds by construction: both
  backends draw the same layer from the same function.
- **The header**: under the encounter's name and round, a flag mark, the label in bold and a chip with
  the rounds left ("3 rounds left", "Last round!" in the warning tone). It is `role="status"` with the
  accessible name "Goal: <label>. 3 rounds left"; all sizes are rem and tokens. With a round limit and
  no objective the goal reads "Defeat every enemy".
- **The tip**: the first fight with an objective queues a one-time combat tip, ahead of the others: "To
  win, be standing on the flag spot when a round ends. The top bar counts the rounds." (flag
  `guidance.tip.objective`, as the other tips).

### Saves

**No save field and no migration.** The hold is read off the board at the moment a round ends and the
clock off `battle.round`; a battle won or lost that way is sealed in `phase`, which is already saved.
`serialize.test.ts` round-trips a mid-round save with a hero on the cell and shows the loaded game
finishes the round and wins exactly as the unsaved one does. Old saves load unchanged; the same content
contract as the guest rules applies if an encounter's objective or limit is edited under a save.

### Story text

None. Every label in this change is a test placeholder ("Placeholder objective"); no shipped encounter
has an objective yet. Scene 2.5's encounter, with its label and `loseAfterRound: 6`, comes with the trial
region's content, and the writing pass owns the label and could give the time-out its own line (the
crate reaching the barge) later through a `timeUpText` on the objective.
