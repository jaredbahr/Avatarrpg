# ADR 0011: The free-roam world model

**Status:** accepted, 2026-09-16 (lands in Phase W, after Milestone 3)

## Context

The target is a world that is full and fun to explore and live in — many
regions, many people worth talking to, and fights that belong to places rather
than to a script. The combat rules are not the constraint; they are close to
where they need to be, and combos and tuning are a later pass.

Milestone 3 (ADR 0010) has just put the whole party in the village: a walk is
an event, the followers trail the leader, and a roster and hotbar sit around
the map. That is the presentation half, and it is the half that was missing
from the picture. It deliberately changed no state shape and no save schema,
so everything below still stands exactly as it did.

The constraint is that **the story graph currently owns the world**. Four
places make that concrete:

- An `explore` story node is `{ mapId, objective, next }` — one map, one
  objective, one destination.
- `MapDef.exit` is a single tile, and `handleWalkTo` only honours it when the
  _current story node_ is an `explore` node, sending the party to that node's
  `next`. The map does not know where its own exit goes.
- `startBattle` searches the story graph for a node carrying the encounter id.
  A fight cannot exist unless a node runs it.
- `GameState.location` is one `{ mapId, pos }` with no per-map memory, and
  `StoryState.nodeId` is a single cursor. There is no representation of a party
  wandering with three things outstanding.

So the shape today is _story drives, world illustrates_. A world that is worth
living in needs the inverse: **the world persists, the story reacts.**

What is already right is the part that would have been expensive to retrofit.
`Condition` is a validated, describable predicate DSL; flags and nation
standing already serialise and migrate; `StoryOption` carries `requires`,
`lockedHint`, `setFlags`, `adjust` and a `speaker` tag that makes picking a
line the same act as picking who says it; `NpcDef.routes` gives first-match
conditional conversations; and `validateContent` already proves every story
node is reachable. Flags plus conditions are, in substance, a quest database
already. What is missing is world topology, world-owned triggers, and a way to
be nowhere in particular.

## Decision

### 1. Maps own their connections

`MapDef.exit` becomes `MapDef.exits`, a list:

```ts
readonly exits: readonly {
  readonly pos: Vec2;
  readonly toMapId: string;
  readonly toPos: Vec2;
  readonly label: string;
  /** Unmet: the exit is shown, described and refused. Never hidden. */
  readonly requires?: Condition;
  /** Author's sentence for a refused exit, as `StoryOption.lockedHint` is. */
  readonly lockedHint?: string;
}[];
```

An exit is a property of the map, not of the node the party happens to be on.
A refused exit is drawn and explained rather than omitted, for the same reason
the dialogue UI draws options the party cannot take: a locked door with no
sign is not a choice, and a named reason is a reason to come back.

Milestone 3's title plate reads the exit's label when the party stands beside
the gate (ADR 0010). With more than one exit it reads the label of the exit
the party is beside, and a refused one reads its `lockedHint` instead — the
plate is where a refused exit says why, so no new surface is needed for it.

### 2. Nowhere-in-particular is a legal state

`StoryState.nodeId` is already `string | null`. Null becomes the ordinary
free-roam state rather than a pre-start condition, and `Screen` gains nothing:
`explore` already covers it. Entering a node is what a conversation, a trigger
or a fight does; leaving one returns the party to the world.

### 3. The world fires the story

`MapDef` gains triggers:

```ts
readonly triggers: readonly {
  readonly id: string;
  readonly area: readonly Vec2[];
  readonly when?: Condition;
  readonly kind: { readonly type: 'node'; readonly node: string }
             | { readonly type: 'encounter'; readonly encounterId: string;
                 readonly onVictory?: string; readonly onDefeat?: string };
  readonly once: boolean;
}[];
```

This is what separates a world from a menu of people: walking into the burnt
farmstead is the event. It also removes the graph search in `startBattle` —
an encounter can belong to a place.

### 4. The world remembers

`GameState.location` keeps `{ mapId, pos }` and gains `world`:

```ts
readonly world: {
  /** Per-map return position, so leaving and coming back is coherent. */
  readonly returnPos: Readonly<Record<string, Vec2>>;
  /** Trigger ids already fired, for `once`. */
  readonly fired: readonly string[];
  /** Encounter ids already cleared, so a place stays cleared. */
  readonly cleared: readonly string[];
};
```

Every one of these fields lands in the zod schema in `src/core/save/serialize.ts`
in the same commit that adds it. A field added to `GameState` and forgotten in
the schema serialises fine, parses back as `undefined`, and crashes only on a
loaded save.

### 5. The journal is derived, never stored

Flags and conditions are the quest database. A quest index in
`src/content/quests.ts` names the stages and the `Condition` that each one is
complete under; the journal is a projection over current flags, computed on
read. Nothing about a quest is stored twice, so a quest cannot desynchronise
from the world that produced it.

### 6. Progression: hybrid gating

This is the decision the rest of the phase depends on, and it replaces the
premise `progression.test.ts` was written under.

`progression.test.ts` enumerates every route through the story graph and
asserts the party reaches each fight at the level that fight is tuned for. A
free-roam world breaks the premise, not the test: the party can arrive at a
given fight at many levels. Three models were considered.

| Model                                                        | Verdict                                                                                                               |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Scale every encounter to party level                         | Rejected. If everything scales, exploration stops having stakes and the world stops feeling real — the Oblivion trap. |
| Hard-gate everything by region, assert exact levels as today | Rejected. Preserves the test cheaply but makes the world a corridor of locked doors.                                  |
| **Hybrid**                                                   | **Accepted.**                                                                                                         |

Under the hybrid model:

- The world is divided into **regions**. A region carries a level band
  (`minLevel`, `maxLevel`) and is the unit of gating.
- **Entry to a region is hard-gated** by a `Condition` on the exits that reach
  it — story progress, nation standing, a discipline taken. A refused exit says
  why. Within a region the party goes where it likes.
- **Within a region, `rules/difficulty.ts` absorbs the slop**, ±2 levels around
  the band, using the machinery it already has for table size. Nothing outside
  that file and the encounter's `reinforcements` scales anything, exactly as
  today. Roster variants remain not a scaling lever.
- XP still does not scale.

`progression.test.ts` is rewritten, not weakened: it enumerates every route
through the _region graph_ and asserts the party enters each region inside its
band, and that the lowest-level legal arrival at every encounter in the region
is still inside what `difficulty.ts` can absorb. The guarantee is the same one
it makes today — the party arrives at a fight at a level that fight is tuned
for — stated over a band instead of a point.

### Out of scope

- **Traversal animation.** Already done: Milestone 3 made a walk an event
  (`partyWalked`) and the choreography plays it as a move track, with the
  followers trailing on `PartyTrail` (ADR 0010). Phase W inherits it and adds
  nothing — a walk across a region is the same walk, and crossing an exit is a
  map change, not a longer track.
- **Items, economy and loot.** Still out. Power comes from levels and
  disciplines. Revisit under a separate ADR if a region ever needs a merchant
  to be interesting.
- **Fast travel.** Wait until there is enough world to be tedious, then decide
  with the map in front of us.

## Consequences

- The inversion touches `src/core/story/`, `location`, the save schema and the
  content schemas. **It touches `src/core/rules/` not at all** — combat,
  surfaces, combos, line of sight, the AI and the balance simulator are
  unaffected, and the balance numbers survive the phase.
- `progression.test.ts` is rewritten once, at W1, before any region content is
  authored against the new shape. It is not weakened and not deleted; the
  CLAUDE.md rule against a single global "pick option N" index still holds.
- `MapDef.exit` → `exits` is a content-schema break. It is a save-version bump
  and a migration, because `location.mapId` in an old save may name a map whose
  exits have moved.
- Story content splits by region (`src/content/story/<region>.ts`). `act1.ts`
  is 534 lines for 39 nodes; at the volume this world wants, one file per
  region is the difference between authoring and archaeology.
- `validateContent` gains: every exit resolves to a real map and a walkable
  `toPos`; every trigger's node or encounter exists; every region is reachable
  from the start under some sequence of conditions; no region is entered below
  its band on any route. Reachability moves from the story graph to the world
  graph and keeps the story graph check as well.
- The asset budget tightens with every region, and each region wants a painted
  backdrop through the `art:map` slot (ADR 0009). The 4 MB-per-family and 25 MB
  precache gates in `scripts/check-asset-budget.mjs` are what will say when a
  region has to start paging its art rather than precaching it.
- Every W slice that changes what is drawn ships with its gallery beat, like
  every other slice since ADR 0006.
