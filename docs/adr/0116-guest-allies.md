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

## The win condition: decided, built next

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
