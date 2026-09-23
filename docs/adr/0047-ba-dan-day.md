# ADR 0047: A believable Ba Dan day — phase-resolved residents

**Status:** accepted direction, 2026-09-22; not implemented. Jared decided the eight design
questions (D1–D8) on 2026-09-22. One question stays open for him: an Act I defeat and MQ-11 (see
"Open question").

Builds on ADRs 0010, 0011, 0017, 0022, 0030 and 0039. It implements Slice A ("a believable Ba Dan
day") of the living world guide, `Avatar-RPG-Living-Tidemark-Reach.md` §19.7, with its companion
handoff `Avatar-RPG-World-Expansion-Agent-Handoff.md`. Both are design sources held outside the
repo; § numbers below refer to the guide. Code references are to `main` at `49dcb77`.

## Context

The guide asks for residents who live somewhere, work somewhere and can be found (§01.1, §18.2).
None of that machinery exists today.

- **An NPC is a fixed tile.** `NpcDef` has one `pos`, an optional `when`, and first-match `routes`
  (`src/core/types.ts:538-558`). `visibleNpcs` filters on `when` alone
  (`src/core/story/world.ts:16-19`). The reducer opens a conversation by matching the tapped tile
  (`src/core/state/reducer.ts:366`).
- **No time of day.** `GameState` holds version, seed, rng, screen, party, battle, story, flags,
  pendingChoices, location, `world { returnPos, fired, cleared }` and log (`types.ts:933-953`). Save
  format 3's zod schema mirrors it (`src/core/save/serialize.ts:19, 122-151`). Nothing represents a
  phase.
- **One person, two places.** Mira and Dorin each have an NpcDef on both maps and are also
  hard-coded as riverside actors. Only one map is loaded at a time, but this still breaks the
  one-person-one-place rule (guide §14.1).

  | Who   | Village                                     | Riverside                                       | Riverside stage                          |
  | ----- | ------------------------------------------- | ----------------------------------------------- | ---------------------------------------- |
  | Mira  | (11,5), `src/content/maps/village.ts:67-73` | (15,9), `src/content/maps/riverside.ts:120-125` | `src/app/village/VillageLife.ts:310-320` |
  | Dorin | (20,8), `village.ts:107-113`                | (32,12), `riverside.ts:127-132`                 | `VillageLife.ts:321-330`                 |

- **NPC drawing is static.** `NpcMarker` is `{pos, sprite, name, scale}`
  (`src/render/view.ts:122-128`). It is rebuilt from `visibleNpcs` every frame
  (`src/app/scenes/ExploreScene.ts:919-925`). Both backends draw it
  (`src/render/backends/canvas2d.ts:239, 647`, `src/render/backends/pixi.ts:1215`), and
  `src/render/scene.ts:144` filters it for near-party fading. Pixi keys each NPC sprite by its tile
  (`pixi.ts:1216`). The riverside stage replaces the markers when it is active
  (`ExploreScene.ts:751-758, 950-951`).
- **The conversation log is written on entry.** `story.visited` is appended when a node is _entered_
  (`src/core/story/storyEngine.ts:158-191`), not when it finishes.
- **What we reuse:** the `Condition` DSL, required for new gates (`types.ts:717-748`;
  `CLAUDE.md:120-123`); reserved flag prefixes, as `standing.` does
  (`src/core/story/conditions.ts:16-33`); ADR 0030's world conversations.
- **Constraints:** `src/core/` is pure and deterministic (`CLAUDE.md:15-21`); a new `GameState`
  field lands in the zod schema in the same change (`CLAUDE.md:206-210`); board-correctness parity
  across both backends is mandatory (`CLAUDE.md:153-155`).

## Decision

### 1. Six phases on `GameState`, advanced only by explicit steps

`types.ts` gains
`export type DayPhase = 'dawn' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night'`.
`GameState.world` gains `clock: { day: number; phase: DayPhase }` (one clock for the whole world)
and `talk: { npcId: string; mapId: string; anchor: string } | null` (the conversation pin, §4).

The phase changes only through a pure helper, `advancePhase(state, to)`, in
`src/core/story/clock.ts`. It moves forward to the next occurrence of `to`; crossing night into dawn
increments `day`. There are exactly two callers in Slice A.

- **The `wait` command: `{ type: 'wait'; until: DayPhase }`.** It is named "wait" rather than "rest"
  because it heals nothing. It is refused when `screen !== 'explore'`, `battle !== null`, the story
  cursor is neither null nor an `explore` node, `until === clock.phase`, the leader is not within
  one tile of a rest spot (D8), or the settle step (§5) would find no free tile for the leader. Rest
  spots are `MapDef.restSpots?: readonly { pos: Vec2; label: string }[]`: in Slice A, the bench
  beside Mira's table (candidate (10,5)) and the riverside tea porch, `RIVERSIDE_SPOTS.tea` (8,18)
  (`riverside.ts:11`). A refused wait shows its reason, as a locked option does. The hotbar offers
  "Wait until…" with the next five phases. Waiting changes time only (no HP, XP, flags or RNG) and
  emits `{ type: 'phaseChanged'; from; to; day }`, handled exhaustively by the log formatter and the
  choreography.
- **An authored story step.** A `flags` node (`types.ts:841-852`) gains an optional
  `phase?: DayPhase`. It means "advance to the next occurrence, or do nothing if already there".
  `validateContent` follows `flags` and `branch` successors transitively and rejects a phase node
  that reaches a `dialogue` or `choice` before an `explore`, `battle` or `end`. It also rejects a
  phase node reachable from any NpcDef root (`node`, `routes[].node`) or a `once: false` trigger,
  walking the conversation subgraph up to `explore`/`end` nodes, so repeatable conversations can't
  churn the clock. The only Slice A use is `act1_victory` (`src/content/story/act1.ts:574-578`),
  which gains `phase: 'evening'` (D2). Its `next` is the `end` node `act1_epilogue`, and its only
  referrer is the boss battle `battle_grumbler` (`act1.ts:534`).
- **Travel.** Not used in Slice A; no exit costs time. Any new path that advances the clock needs an
  amendment to this ADR. For the streamed world, travel cost belongs on route or region records
  rather than on `MapExit`.

Nothing else touches the clock: walking, exits, triggers, dialogue, choices, battles, `setFlags`,
pause, menus, saving, real time. The clock is a typed field, not a flag, so the app's `setFlags`
(`reducer.ts:673-680`) can't rewind it.

A new game starts at `{ day: 1, phase: 'midday' }` in `createGame`
(`src/core/state/createGame.ts:173`) (D4). The title preview (`src/app/App.ts:304`) enters at
`afternoon`, the riverside's written time of day (`VillageLife.ts:23`). The preview is a fresh game
(`App.ts:308-312`), so its start state also records `mira_intro` as visited: otherwise Mira's
pre-intro hold (§4) would keep her in the village and, through the pairing rule, Pella with her. The
preview is set after Mira's briefing anyway (`riverside_mira` greets the party as people she knows).
The preview's drill is covered in §8.

The Condition DSL gains `{ kind: 'phase'; in: readonly DayPhase[] }`. It is described in text as,
for example, "in the evening" or "at dawn or in the evening". There is no day-number condition.
Rotating ambient barks are picked from `day` by a pure hash in presentation code and never touch
`RngState`.

### 2. Resident records and resolution

These types live in `types.ts`. The data lives in `src/content/residents/baDan.ts`, with zod in
`schemas.ts`. `ContentIndex` gains `anchors`, `residents` and `backgroundRoles`.

```ts
export interface WorldAnchor {
  readonly id: string; // 'bd02.shopfront', 'home.gao'
  readonly place: string; // narrative code, 'BD02'
  readonly site:
    | {
        readonly kind: 'map';
        readonly mapId: string;
        readonly pos: Vec2;
        readonly reserve?: string;
      }
    | { readonly kind: 'private'; readonly door: { readonly mapId: string; readonly pos: Vec2 } };
}
export interface ResidentSlot {
  readonly anchor: string;
  readonly activity: string; // pose/prop/bark key; never evaluated
  readonly variants?: readonly { readonly when: Condition; readonly activity: string }[]; // first match
  readonly npc?: string; // NpcDef on the anchor's map that owns conversation here
  readonly interrupt: 'talk' | 'finish-then-talk' | 'observe'; // `npc` set => not 'observe'
  readonly service?: 'gate_watch';
  readonly via?: readonly Vec2[]; // waypoints for the walk into this slot
  readonly loop?: readonly Vec2[]; // presentation-only wander points, <= 2 tiles from the anchor
}
export interface ResidentOverride {
  readonly id: string;
  readonly tier: 'mission' | 'hazard' | 'presence' | 'care' | 'appointment';
  readonly when: Condition;
  /** Per-phase slots; a missing phase means "all phases use `all`". */
  readonly slots: Partial<Readonly<Record<DayPhase, ResidentSlot | 'home' | 'absent'>>>;
  readonly all?: ResidentSlot | 'home' | 'absent';
}
export interface ResidentDef {
  readonly id: string; // design key, 'lw.npc.gao'
  readonly name: string;
  readonly source: { readonly established?: string; readonly runtimeNpcIds: readonly string[] };
  readonly home: string; // private anchor
  readonly fallback: ResidentSlot; // public; must have `npc` and interrupt 'talk'
  readonly schedule: Readonly<Record<DayPhase, ResidentSlot | 'home'>>;
  readonly overrides?: readonly ResidentOverride[];
}
/** Unnamed background people: never in the identity register, never interactive. */
export interface BackgroundRole {
  readonly id: string; // 'bg.relief_watch', 'bg.pella_household'
  readonly label: string;
  readonly sprite: string;
  readonly slots: Partial<Readonly<Record<DayPhase, ResidentSlot>>>; // interrupt 'observe'
  readonly accompanies?: {
    readonly resident: string;
    readonly anchors: readonly string[];
    readonly slot: ResidentSlot;
  }; // present when they are
}
```

**NpcDef changes.** `NpcDef` gains `resident?: string`. When it is set, `pos` becomes optional.
Validators that read `pos` switch to the resolved anchor tiles: the prop-on-NPC and walkable checks
(`src/content/schemas.ts:1174, 1182`) and the reachability loop in
`src/content/scenes/baDan.test.ts:369-370`. Knowledge and relationships stay in story flags and
`visited`; they are not copied into these records.

**Resolution** is `resolveResidents(content, state): { placements; diagnostics }` in
`src/core/story/residents.ts`. It is pure and total. Each resident takes the first candidate in this
order: **0** `conversation` (while `screen === 'dialogue'` and `world.talk.npcId` is bound to this
resident: the pinned anchor with `npc: talk.npcId` and `interrupt: 'talk'`, §4); **1–5** overrides
by tier: `mission`, `hazard` (reserved; Slice B lands the §18.3 rescue/return transition here),
`presence`, `care`, `appointment`; **6** the ordinary `schedule[phase]`.

**Reservations** are ranked globally by (candidate tier, resident declaration order). Each placement
claims its tile and its `reserve` key in rank order, so a pinned speaker always keeps its tile. A
resident whose candidate is taken falls back along a chain: its `fallback` slot, then `home`, then a
diagnostic. `validateContent` runs the resolver over the state classes in the Tests section; a
`mission` or `conversation` placement that loses its tile is a hard error there, and shipped content
must produce no diagnostics. At runtime a displaced placement follows the chain and logs its
diagnostic.

Background roles resolve after all residents, so they can't displace a named person. A role is
placed when it has a slot for the phase, or when its `accompanies.resident` resolved to one of the
listed anchors. A role whose tile is taken is omitted silently; the coverage test (test 6)
guarantees the post is still staffed.

`visibleNpcs` becomes `visibleNpcs(content, map, state)`. A bound NpcDef is visible only when its
resident's placement is on this map with `npc === npc.id`, and it is returned with the anchor's
`pos`. The result is memoised on the (immutable) state object in a one-entry cache, because the
renderer calls it every frame.

**The call-site sweep** covers 10 calls in 5 files: `reducer.ts:366`;
`ExploreScene.ts:218, 295, 869, 920` (including the trail's avoid lists);
`src/app/ui/LocalMap.ts:41, 124`; `src/app/world/guidance.ts:34`; and
`src/app/world/walking.ts:21, 63`. Four more places bypass `visibleNpcs` and must change too:
`VillageLife.ts:152-157` (hit-tests raw `map.npcs`, walks to the legacy `pos`),
`VillageLife.ts:310-330` (hard-coded Mira and Dorin actors), the `NpcMarker` renderers (§7), and the
validators above. `npcNode` is unchanged (`storyEngine.ts:350-363`).

### 3. Anchors on the current maps

Anchor codes are narrative, not tile coordinates (§03.2). House assignments follow D5: north-west =
Gao, north = Mira, south-west = Pella's household; the south-east merchant house stays unassigned.

An anchor tile must be walkable and reachable from every arrival tile. It must not be an exit tile
(village (23,7), (19,14), `src/content/maps/world.ts:65-68`; riverside (10,20),
`maps/world.ts:86-93`), an arrival tile (village (22,7), (18,14); riverside (10,19)), a party spawn,
a trigger cell, a rest spot, or an unbound NpcDef tile (the village's `riverside_sign` at (18,12),
`village.ts:59-65`; the riverside's `riverside_shrine` at (31,5), `riverside.ts:13`). Candidate
tiles need a visual check (W5c).

| Anchor                     | Place                | Binding                                                                                                                               | Fit today                                              |
| -------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `bd01.table`               | BD01 Mira's Table    | village (11,5) (`village.ts:69`)                                                                                                      | **Fits.** Table and awning prop absent (art)           |
| `bd02.shopfront`           | BD02 Gao's shop      | village (9,4) (`village.ts:77`), beside `gao-display` and `gao-house` (`src/content/scenes/baDan.ts:102, 261`)                        | **Fits.** Chair/stool candidate (10,4)                 |
| `home.gao`                 | BD02 rear room       | private; door (9,3), a tested shop door (`baDan.test.ts:353, 371`)                                                                    | **Doorway**                                            |
| `home.mira`                | Mira's home          | private; the north dwelling (`baDan.ts:262`), door cell (12,3) (`village.ts:31`) (D5)                                                 | **Doorway**                                            |
| `bd03.post`                | BD03 gate post       | village (20,9), the verge off road rows 7–8 (D6)                                                                                      | **Fits.** No hut, bench or float shelf art             |
| `bd03.handover`            | BD03 verge           | village (21,9)                                                                                                                        | **Fits**                                               |
| `bd04.court`               | BD04 family court    | village, the lane at the SW dwelling, x=9 rows 10–11 (`village.ts:38-39`, `baDan.ts:263`) (D5)                                        | **Approximate.** No oven yard                          |
| `bd04.yard`                | BD04 household adult | village, a free tile beside `bd04.court` (candidate (10,11))                                                                          | **Approximate**                                        |
| `home.pella`               | BD04 sleeping rooms  | private; door on the SW dwelling (D5)                                                                                                 | **Doorway**                                            |
| `bd05.school`              | BD05 school          | private; represented by a new notice NpcDef, `school_notice` (a `route-sign`, `types.ts:544`), at the free lawn tile (12,11) (§8, W6) | **Does not fit.** No school or play court on any map   |
| `bd06.bank`                | BD06 riverside       | riverside (15,9) (`riverside.ts:8`)                                                                                                   | **Fits**                                               |
| `bd06.watch`               | BD06 safe bank       | riverside (16,14), near `otter` (17,15) (`riverside.ts:10`; row-14 span 9–18, `riverside.ts:64-67`)                                   | **Fits** as a tile; the safe edge needs a visual check |
| `rv.practice`              | Dorin's drill        | riverside (32,12), Dorin's current NpcDef tile (`riverside.ts:129`) (D3)                                                              | Existing spot, not in the guide's table                |
| `home.dorin`, `home.hanru` | Dorin's home; BD16   | private; interim door near the NE tree line (candidate (21,2)), never an exit tile                                                    | **Doorway, no art**                                    |

`rv.practice` is Dorin's standing tile. The drill's party visit uses `RIVERSIDE_SPOTS.practice`
(30,13) (`riverside.ts:12`) and is unchanged.

The remaining anchors don't fit today: BD07–BD15 have no buildings and BD11's south wagon approach
has no exit, so each needs a doorway, a private state or a later submap. The walkable `w` cells
behind the upright houses (`village.ts:30-31, 39-40`) are not anchors, because the house art would
hide an actor there.

### 4. Single location, co-presence, guard relief and conversation holds

- **One place.** Every resident has exactly one placement: a map tile, a private anchor or `absent`.
  Its village and riverside NpcDefs are never both visible, which removes today's duplicates. These
  invariants are validated across all maps, not only the loaded one.
- **No sharing.** No two placements share a tile or a `reserve` key, and nobody stands on a
  forbidden tile (§3). Every visible NPC keeps a neighbour, one legal step away, that is walkable
  and is not another NPC tile, an exit, an arrival tile, an active trigger cell or a rest spot. That
  neighbour is what `findApproach` (`reducer.ts:502-530`) walks to and what settle (§5) moves the
  leader onto.
- **Guard relief.** Exactly one placement carries `service: 'gate_watch'` in every phase and state
  class. The rota is Dorin at dawn, morning and afternoon; `bg.relief_watch` at midday (D3); Hanru
  in the evening and at night. Dorin and Hanru are co-present only on the post and handover tiles.
  Hanru is `home` from morning through afternoon, so no daylight scene can wake them.
- **The conversation pin (B1), chosen over completion flags.**
  - _Set:_ when `handleWalkTo` opens a conversation from a resident-bound NpcDef
    (`reducer.ts:380-390`) and the entered state is a dialogue, it writes `world.talk`: the NpcDef
    id, the map and the resident's anchor at that moment (the one that made the NpcDef visible).
  - _Hold:_ while `screen === 'dialogue'`, the resolver places that resident at the pinned anchor at
    tier 0, ahead of every tier, so a hold that lifts on `visited` can't move the speaker
    mid-conversation. Phase can't change inside a conversation (`wait` is refused outside explore,
    and phase nodes are unreachable from NpcDef roots, §1).
  - _Clear:_ settle (§5) clears it after any command whose result has `screen !== 'dialogue'` or a
    `location.mapId` other than `talk.mapId`. `reconcileWorld` (§5) also clears a loaded pin that
    fails either test, or whose NpcDef, anchor or binding no longer exists in content.
  - The pin is saved, so a mid-conversation save reloads with the speaker in place. Trigger-opened
    nodes pin nobody; every required conversation in Slice A is opened from an NpcDef.
- **Required conversations.** A `mission` override holds each owner at a named public anchor in
  every phase until the conversation is visited; the pin covers the conversation itself.

  | Hold                         | Until visited                                        | Anchor                                                                                        |
  | ---------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
  | Mira                         | `mira_intro`; after `act1_complete`, `mira_epilogue` | `bd01.table`, all phases                                                                      |
  | Gao, after `act1_complete`   | `gao_home` or `gao_home_cold`                        | `bd02.shopfront`, all phases                                                                  |
  | Pella, after `act1_complete` | `pella_home`                                         | `bd04.court`, all phases                                                                      |
  | Dorin, after `act1_complete` | `dorin_home`                                         | `bd03.post` with `gate_watch`, dawn–afternoon; `bd03.handover`, no service, evening and night |

  All hold slots use `interrupt: 'talk'`. Dorin's hold keeps him off the post at night, so Hanru
  still covers the watch, and during the day his hold slot carries the watch itself (the midday
  relief watch then loses the tile and is omitted). The objective guidance for `village_explore`
  still targets `elder_mira` (`act1.ts:36-49`), and the homecomings still feed
  `VILLAGE_HOMECOMINGS_COMPLETE` (`src/content/story/return.ts:4-18`). Mira's pre-intro hold also
  means that in the main game riverside Mira, and Pella's riverside afternoon, appear only after
  `mira_intro`; the river path is open from the start (`maps/world.ts:67`), so a player who goes
  there first finds Dorin at midday and otherwise an empty bank.

- **Supervision and household** (guide §05.1–05.2 require an adult with Pella). At `bd06.watch` the
  adult is Mira: a validator rule pairs every Pella `bd06.*` slot and override with a Mira `bd06.*`
  placement under the same conditions, otherwise Pella falls back to `bd04.court`. At `bd04.court`
  the adult is `bg.pella_household`, which `accompanies` Pella there, stands on `bd04.yard` and only
  observes. It is an unnamed stand-in until Nala arrives in a later slice and says nothing about
  Pella's parents (handoff, "What is new").
- **The school notice.** In the morning, `school_notice` (visible only with `phase: ['morning']`)
  reads "Pella is in class until midday". "Wait until midday" is the §18.9 next-period alternative.

**Amendment (W5, 2026-09-23): the supervision pairing inside Mira's conversation.** `story.visited`
is written when a node is entered (Context), so opening `mira_intro`, or `mira_epilogue` once
`pella_home` has been heard, lifts Mira's hold at once. For that one conversation Mira stays at
`bd01.table` only through the pin (tier 0), while Pella's supervision fallback has also lifted, so
in the afternoon Pella resolves to `bd06.watch` without Mira at BD06. This is accepted: Pella is on
the riverside, off the player's map, and it lasts only until the conversation ends, when Mira walks
to `bd06.bank`. The pairing rule and test 11 therefore allow exactly this case: Mira pinned at
`bd01.table` with Pella not on the village map. Every other state, pinned or not, keeps the pairing.

### 5. After every command: settle (B2)

`apply` wraps every command with a pure `settle(content, before, after)` in
`src/core/story/settle.ts`. Its events are appended to the command's own. It does two things:

1. **Clear the pin** when the resulting screen isn't `dialogue` or the map is no longer
   `talk.mapId`.
2. **Move the leader off an NPC.** This runs only when the result is in explore. If the leader's
   tile is a visible NPC tile, a breadth-first search over the explore grid finds the nearest
   walkable tile that is not an NPC tile, exit, arrival tile, active trigger cell or rest spot. Its
   step rule is `findPath`'s (`src/core/rules/grid.ts:269`): eight neighbours, no corner-cutting
   (`grid.ts:208-216`). It expands only through tiles that are neither exits nor active trigger
   cells, so the step never crosses one it would have to fire. Ties break by (path length, y, x).
   The leader moves there and the step emits `partyWalked` with the real path.

The §4 neighbour rule guarantees such a tile, so a failure can only mean broken content; it logs a
diagnostic and leaves the leader in place. `wait` pre-checks the search and refuses instead.

During a conversation the leader is not moved. If a conversation's own flags move another resident
onto the leader's tile, the two overlap until the conversation ends, and settle then steps the
leader aside.

**On load**, `reconcileWorld(content, state)` in `src/core/save/reconcile.ts` clears a stale pin
(§4) and runs the same search without events. It runs after `reconcileDisciplines`
(`reconcile.ts:21-44`) at both of that function's load call sites: `App.adoptSave` (`App.ts:367`)
and the continuity test's load helper (`src/core/save/continuity.test.ts:43`). It is idempotent, so
the `continuity.test` promise that a load settles (`continuity.test.ts:8, 111`) still holds.

Placements depend on flags and `visited` as well as the clock, so any command can move people (a
hold lifting, `act1_complete`, a `scene.` flag, a phase change). The app therefore diffs placements
after every dispatch, not only on `phaseChanged` (§7).

### 6. Save format 4, the migration and scene memory

- **The schema.** `SAVE_FORMAT_VERSION` goes from 3 to 4 (`serialize.ts:19`), and
  `GameState.version` to 4 (`SAVE_VERSION`, `createGame.ts:42`). The zod `world` object
  (`serialize.ts:145-149`) gains
  `clock: z.object({ day: z.number().int().min(1), phase: z.enum([...six]) })` and
  `talk: z.object({ npcId, mapId, anchor }).nullable()`.
- **The migration.** `migrate` gains a `format === 3` case after the 2→3 case
  (`serialize.ts:230-240`). It writes `world: { ...world, clock, talk: null }`, choosing the phase
  from the raw `state.location.mapId`: `'ba_dan_riverside'` → `afternoon` (Mira and Pella at the
  riverside once `mira_intro` is visited); any other map → `evening` (Mira, Gao, Pella and both
  guards in the village, matching D2's homecoming evening). Like `migrateToFormat2`
  (`serialize.ts:245-293`), it is raw JSON and needs no content.
- **Legacy mid-conversation saves.** A format-3 save made mid-dialogue has no pin. The chosen phase
  keeps most speakers on the save's map, but not all: riverside Dorin resolves to the village post
  in the afternoon, and riverside Mira is held in the village before `mira_intro`. Such a save still
  loads into the same conversation, which plays to its end with the speaker off the map; pinning
  starts with the next conversation. This is one-time and presentation-only, so the migration takes
  no content lookup to avoid it.
- **Placements are never saved.** They are derived from the clock, flags, `visited` and the pin, as
  the party trail is (ADR 0010). A load can't duplicate or lose a person.
- **Scene memory.** The reserved flag prefix `scene.` holds `'completed' | 'declined'` and is
  validated like `standing.`. A `flags` node sets it at the authored end of a scene (§18.10:
  starting is not completing). "Seen" is the first node in `visited`; "interrupted" is visited with
  no value and grants nothing; watching an ambient scene stores nothing. Idle variants read memory
  through `Condition`s in `slot.variants`, never by presentation code reading flags.
- **Out of scope here.** Slice B's per-person presence and recovery state is not added.

### 7. Visible movement, the blocked-path fallback, the renderers and taps

This is presentation only. The rules position is always the resolved anchor.

- **Placement diff.** After every dispatch, the pure planner `src/app/world/residentMotion.ts` diffs
  the placements before and after, for the loaded map. A same-map change walks `via` waypoints, then
  core `findPath` over the reducer's explore grid (`reducer.ts:489-499`), avoiding party and NPC
  tiles as the trail does (`ExploreScene.ts:218, 295, 869`). A private anchor walks to or from its
  door tile; another map or `absent` walks to or from the exit tile leading there. Fades happen only
  on door and exit tiles, never mid-screen. Walks play as `alongside` animator tracks keyed
  `npc:<residentId>`. Under reduced motion they collapse, as the party's walk does. A conversation
  pin freezes its resident's sprite on the pinned tile.
- **Blocked paths (M5).** If a route avoiding party tiles fails: (1) retry ignoring party tiles,
  since rules paths already pass through them (`reducer.ts:403-408`); (2) if that fails, the sprite
  waits on the reachable tile nearest its destination and the planner re-plans after every dispatch;
  (3) it never teleports and is never lost, and each wait logs a diagnostic. A fixture with the
  party on a chokepoint (the canal bridge (9,6), `baDan.ts:144-145`, or the south-west lane) proves
  it.
- **Renderers and taps (M8).** `NpcMarker` gains an `id` and optional `renderPos`, `facing`,
  `clipTime` and locomotion, as `RenderUnit` has (`ExploreScene.ts:913-916`); `canvas2d.ts` and
  `pixi.ts` both draw them, with parity. Pixi re-keys NPC sprites by `id` instead of by tile
  (`pixi.ts:1216`), so a walking resident keeps one sprite. The near-party fade (`scene.ts:144`)
  reads `renderPos`. A tap hit-tests each marker's drawn `renderPos`, maps it to that NPC and
  dispatches `walkTo` to the NPC's rules tile (`walking.ts:21` matches rules tiles). Before any
  `walkTo` toward an NPC, its loop freezes and returns it to its anchor. `VillageLife`'s hit-test
  (`VillageLife.ts:152-157`) and actors (`VillageLife.ts:310-330`) switch to `visibleNpcs` and drawn
  positions.
- **Ambient loops.** Optional `loop` points play only while the scene is idle: no dialog, no walk,
  no reduced motion.
- **The character pipeline.** Slice A is the consumer of the character pipeline's animated sheets
  (step P3, which needs its own sheet-contract ADR). Until P2/P3 pass, residents use the existing
  static NPC art, translated at the arc-length pace of `0018-riverside-roaming-journal.md:20` with
  the walk bob, and labelled as placeholders in the gallery.
- **Night is label-only (D1).** The phase shows in the title plate and the journal; there is no
  lighting change.

### 8. Slice A cast and scenes

**Cast:** Mira (`lw.npc.mira`), Gao (`lw.npc.gao`), Pella (`lw.npc.pella`), Dorin (`lw.npc.dorin`)
and Hanru (`lw.npc.hanru`, bounded). There are also two background roles: `bg.relief_watch` (D3) and
`bg.pella_household`.

**Excluded until released:** Bo-shan, Leto, Amri, Hesra and Senn. No record, NpcDef or placement
exists for them, and the identity register (W0) rejects their keys.

**The schedule:**

|                         | dawn                      | morning         | midday           | afternoon                | evening            | night     |
| ----------------------- | ------------------------- | --------------- | ---------------- | ------------------------ | ------------------ | --------- |
| Mira                    | bd01 sets bowls           | bd01 public     | bd01 meal        | bd06.bank walk           | bd01 table company | home      |
| Gao                     | bd02 plant into light     | bd02 service    | bd02 break sign  | bd02 stock (plant scene) | bd02 threshold     | home      |
| Pella                   | bd04 breakfast            | school (notice) | bd04 meal        | bd06.watch with Mira     | bd04 supper        | home      |
| Dorin                   | bd03.post                 | bd03.post       | rv.practice (D3) | bd03.post                | bd03.handover      | home      |
| Hanru                   | bd03.handover             | home (sleep)    | home (sleep)     | home (errands)           | bd03.post          | bd03.post |
| Relief watch (D3)       | —                         | —               | bd03.post        | —                        | —                  | —         |
| Pella's household adult | accompanies Pella at bd04 |                 |                  |                          |                    |           |

**Adaptations from §05.1** (recorded, as §18.1 requires): Mira's midday private rest and Hanru's
"then BD16 breakfast" are compressed into single-anchor phases; Mira's evening is her table, not
home, so she stays findable; Gao's BD10 and Dorin's BD07 visits are dropped (those residents and
places don't exist yet); Pella's "BD05 play; designated days BD06" becomes BD06 every afternoon;
Dorin's drill moves to his midday relief (D3).

**New NpcDefs**, each with a presentation registry entry
(`src/content/story/presentations.ts:21-40`, enforced at `presentations.ts:168-180`):

| NpcDef            | Map                                         | Sprite                                                              | Nodes                                              |
| ----------------- | ------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------- |
| `guard_hanru`     | `ba_dan_village`, resident `lw.npc.hanru`   | placeholder from A1, distinct from `npc.dorin` and `npc.guard` (D7) | `hanru_watch`, `handover_scene`                    |
| `riverside_pella` | `ba_dan_riverside`, resident `lw.npc.pella` | `npc.kid`                                                           | `riverside_pella`, with an `act1_complete` variant |
| `school_notice`   | `ba_dan_village`, unbound, at (12,11)       | notice art from A1                                                  | `school_notice`                                    |

The existing `pella_*` nodes return to `village_explore` (`act1.ts:140-157`), so they can't be
reused on the riverside.

**LW-S-BD-01, the plant's chair (M1).** This is the first route on `shopkeeper_gao`, ahead of the
routes at `village.ts:80-93` (`gao_home_cold`, `gao_home`, `gao_cold`, in that first-match order).
It fires only when all hold:

- `phase in [afternoon]`;
- `scene.bd01_plant_chair` unset;
- not (`act1_complete` set and neither `gao_home` nor `gao_home_cold` visited), so the homecoming
  comes first;
- not (`ruon_traded` set, `act1_complete` unset and `gao_cold` unvisited), so before victory Gao's
  disagreement is heard first, in its own branch (§05.3). After victory `gao_cold` can never fire
  (`gao_home_cold` matches first), so the clause stops at victory; `gao_home_cold`, which the
  homecoming clause already puts first, carries Gao's side from then on.

Because Gao is at `bd02.shopfront` every afternoon, the scene becomes reachable as soon as these
clear on every route; it can't be pre-empted forever. The final node sets the scene flag, and the
afternoon slot's variant
`{ when: scene.bd01_plant_chair eq 'completed', activity: 'plant_on_chair_idle' }` takes over. No
`ruon_*` flag is touched, and the custody routes keep firing as before. There is no chair, stool or
plant art yet; the scene ships as text plus a changed pose and is reported that way.

**LW-S-BD-03, the handover.** The first route on `guard_hanru` is `handover_scene`, gated on
`phase in [dawn, evening]` and `scene.bd03_handover` unset. It carries the guide's lines and sets
the flag at the end. After that, `hanru_watch` plays. Ambient barks, rotated by `day`, are shown as
subtitles. The barks are presentation work and are assigned to W7, not W6 (W6 review).

**Dorin's drill (M7).** The "Dorin's drill" control (`VillageLife.ts:108-112, 262-264`) and the
Dorin actor are shown only while Dorin resolves to `rv.practice`. The preview enters in the
afternoon, so its drill appears after "Wait until midday" at the porch (D3, D8).

**Amendment (W7, 2026-09-23): where the UI puts the wait, and what it leaves to W8.** The village
hotbar offers "Wait until…" only while the leader is within one tile of a rest spot, in Look
around's slot: the dock is laid out for four actions, and a fifth wrapped the iPad dock to twice
its height and pushed a button off a phone at Largest text. On the riverside it is always in the
Activities group. Away from a seat the travel journal says where the map lets you wait, and the
dialog shows the rule's refusal once over its locked options. The refusals name their reason: a
fight, a conversation, no seat (naming the map's rest spots), or nowhere for the party to stand.
The handover barks are three items rotated by `(day, watch)` and shown once per watch as a toast.
Background roles are not drawn yet: on the village they are `NpcMarker`s, which are W8's, and
drawing them needs W8 to decide how the party treats an observe-only figure's tile (rules paths
and settle ignore it today). The riverside, the only stage VillageLife draws, has no role
placements in Slice A.

### 9. Consistency with Jared's later decisions

- **One streamed world:** placements derived, anchors are stable ids with a `mapId`, the clock is
  global, invariants validated over all maps, nobody baked into map art; `restSpots` later becomes a
  region property.
- **Combat in place:** `wait` is refused during a battle; the `hazard` tier is reserved.
- **Single-user exploration:** `wait` is a hotbar action; the decider rotation and hot-seat session
  are untouched.

## Decisions recorded

Each was put to Jared as an open question with a suggested default. **Decided by Jared 2026-09-22:
all eight defaults accepted.** Text that depends on one cites it as (Dn).

- **D1. Night presentation.** Label only: the phase shows in the title plate and journal; lighting
  goes to a later render/art ADR.
- **D2. The return's phase.** `act1_victory` gets `phase: 'evening'`. The lines don't conflict:
  `riverside_mira_home`'s afternoon of finding beds (`return.ts:152`) can precede an evening in
  which the `pella_asked` variant of `pella_home` says "He is asleep now" of Bo-shan
  (`return.ts:80`, naming him at `return.ts:70`).
- **D3. Dorin's drill.** At his midday relief (`rv.practice`), with the unnamed `bg.relief_watch` on
  the post. (Rejected alternatives: preview only, or drop it.)
- **D4. The new-game phase.** Midday. Mira, Gao and Pella are in the village; Dorin is at his drill
  and the relief watch holds the gate. Morning would have put Pella in school on the first visit.
- **D5. House ownership.** Gao north-west, Mira north, Pella's household south-west; south-east
  unassigned.
- **D6. Gate post.** The verge (20,9), out of cart traffic, rather than the road tile (20,8).
- **D7. Hanru's appearance.** A placeholder sprite distinct from both Dorin sprites. Hanru uses
  they/them (§04.14).
- **D8. Where waiting is allowed.** Only at designated spots: Mira's table bench and the riverside
  porch.

Animation work (the Mixamo route and the character pipeline) is separate and is not decided here.

## Open question for Jared

**An Act I defeat and MQ-11 (main-story change, not decided).** `act1_epilogue_lost` is an `end`
node with no `next` (`act1.ts:560-572`; ADR 0022), so a loss at the quarry is terminal. The guide
instead expects a revisitable Ba Dan after defeat, with the five still held until the MQ-11
liberation. Making defeat resumable changes the main story, so Slice A does not do it: defeat is
covered only by the resolver state class `act1_lost` (tests 4–7). Jared to decide whether, and in
which slice, an Act I loss becomes resumable.

## Conflicts between the guide and current code

- **Duplicate people today:** Mira and Dorin on two maps and hard-coded as riverside actors; fixed
  by binding (§2, §4).
- **An Act I loss is terminal:** see "Open question for Jared".
- **The five missing:** "four people" plus Bo-shan (`act1.ts:58, 135`) agrees with the guide; none
  has a runtime actor.
- **Predicate strings** (§18.5–18.7): the DSL has only flags, visits, party, standing and size
  (`types.ts:717-748`). Slice A adds `phase` only; per-person state is Slice B.
- **Sprite and portrait reuse, not identity.** Road-keeper Dema uses `portrait.mira` and Sen
  `portrait.gao` (`src/content/story/world.ts:51, 80`); on the map, Dema uses Mira's `npc.elder` and
  Sen Gao's `npc.shopkeeper` (`src/content/maps/world.ts:140, 217`); the village's `riverside_sign`
  uses Pella's `npc.kid` (`village.ts:62`) and the riverside shrine uses `npc.elder`; riverside
  Dorin is `npc.guard` (`riverside.ts:130`) while village Dorin is `npc.dorin`.
- **Pathing.** Rules paths ignore NPC tiles (`reducer.ts:403-408`). Settle (§5) and the planner (§7)
  supply the §18.8 guarantees.
- **Legacy flags.** Every §18.4 flag exists as described
  (`act1.ts:145, 220, 324, 350, 378, 407, 417, 461, 488, 557, 576`;
  `src/content/story/world.ts:62, 91`), and the `learned_*` teacher flags live in
  `src/content/disciplines.ts:33-37`. The homecoming visit records are `story.visited`. Slice A
  reads these and writes none of them.

## Consequences

- **Core:** `types.ts`; `serialize.ts` (format 4, `clock`, `talk`); `conditions.ts` (`phase`); the
  reducer (`wait`, `phaseChanged`, story `phase`, the pin write, the settle wrapper); new
  `clock.ts`, `residents.ts`, `settle.ts`; `reconcileWorld`; the `visibleNpcs` signature.
  `src/core/rules/` is untouched, so balance and progression hold.
- **`validateContent` gains:** the identity register and reserved keys (the five missing; Bo ≠
  Bo-shan; the Dema, Sen, Senn and Sena collisions from §00.5; nothing keyed on sprite or portrait);
  anchor reachability and forbidden tiles; the §4 neighbour rule; slot-to-NpcDef map agreement;
  `npc` set ⇒ not `observe`, mission slots `talk`; fallback-slot rules; guard coverage; Pella–Mira
  pairing; the transitive phase-node rules; the `scene.` prefix; a resolver run with no diagnostics.
- **Asset requests (A1):** chair, stool and plant with Gao's lift-and-sit poses; guard hut, handover
  board and float shelf; school notice; door markers; a Hanru placeholder (D7); a household-adult
  placeholder whose sprite belongs to no named person.
- Written, state-integrated, mapped, asset-supported, tested and visually reviewed are reported
  separately.

## Tests (guide §18.11 and the handoff acceptance list, adapted)

Required before merge; document checks are not gameplay tests. "State classes" means: new game;
`mira_intro` visited; `act1_lost` (resolver only); `act1_complete` before the homecomings;
homecomings complete; `ruon_traded`; `ruon_spared`; `lost_ambush`, each × 6 phases.

1. **Determinism.** Same state, same placements; `wait`, settle and resolution leave `state.rng`
   unchanged; replaying the same commands gives the same events.
2. **Clock paths.** Across every `world.test` route and every dialogue, choice, exit, trigger and
   battle, only `wait` and `act1_victory` change the clock. `setFlags` with clock-like keys leaves
   it alone. `wait` writes no flags and leaves the `world.ducks_seen` flag unchanged. Every §1
   refusal is exercised.
3. **Story `phase`.** Idempotent; `wait` to the current phase is refused; the validator rejects
   `flags(phase) → branch → dialogue` and a phase node on an NPC root.
4. **One place per resident** in every state class; Mira and Dorin never visible on two maps.
5. **Co-presence** in every state class: no shared tile or reserve key, no forbidden tile, every
   visible NPC approachable from every arrival tile and meeting the §4 neighbour rule, zero
   diagnostics. A two-residents-one-tile fixture across tiers shows a losing mission placement is a
   hard error.
6. **Guard relief** in every state class, including Dorin's night hold: exactly one `gate_watch`;
   Dorin and Hanru co-present only on post and handover; Hanru never visible from morning through
   afternoon.
7. **Required conversations.** `mira_intro` and each homecoming reachable in every phase until
   visited; the guidance target is a visible NPC.
8. **Conversation pin (B1).** For every hold × phase, the speaker stays visible on the same tile at
   every line and choice, including across a mid-conversation save and reload. A loaded pin with a
   map mismatch, a non-dialogue screen or an unknown NpcDef or anchor is cleared by
   `reconcileWorld`.
9. **Settle (B2).** Hold lifts, `act1_complete`, scene flags and phase changes produce planner
   moves, no pops. After any command that leaves the game in explore, and after loading onto a
   content-shifted anchor, the leader is not on an NPC tile; the step's path crosses no exit or
   active trigger cell; a second load changes nothing.
10. **No captive on a work loop.** No record or NpcDef for the five; `visibleNpcs` never yields
    them; a fixture declaring one is rejected; `dema` bound to `lw.npc.dema_cook` is rejected;
    `sen_tea`, `senn_messenger` and `sena` are distinct.
11. **Supervision.** Pella at BD06 ⇒ Mira at BD06; Pella at BD04 ⇒ household adult present; Pella
    never outside Ba Dan.
12. **Gao route matrix (M1)** over `act1_complete`, `ruon_traded`, `gao_cold` and homecoming visits,
    the scene flag and the phase: the plant scene never pre-empts a homecoming or a pre-victory
    `gao_cold`, is eventually reachable on every route (including traded, `gao_cold` never heard,
    then victory), leaves `ruon_*` unchanged, and when abandoned re-offers and grants nothing.
13. **Handover.** Only at dawn and evening; completion persists across a save.
14. **Saves (M6).** Deep round-trip of `clock`, `talk` and `scene.` flags; real fixtures chain
    1→2→3→4 with the phase chosen by `mapId` and every required conversation reachable; a format-3
    mid-conversation fixture (riverside Dorin) loads and plays its conversation to the end; zod
    rejects a bad phase or `day < 1`; `continuity.test` passes, with `reconcileWorld` in its load
    helper; placements identical across a load.
15. **Transitions (M5).** Consecutive same-map slots path-connected; doors reachable; routes never
    cross blocked tiles; the chokepoint fixture never teleports or loses a resident.
16. **Preview and drill (M7).** The preview enters at afternoon, with `mira_intro` visited, Mira at
    `bd06.bank` and Pella at `bd06.watch`; the drill control and Dorin's actor appear only when he
    is at `rv.practice`; save isolation unchanged.
17. **Progression.** `progression.test`, the XP audit and the balance report unchanged; `wait`
    grants no HP or XP.
18. **Browser, both renderers (M8).** Wait through six phases on both maps and tap every resident;
    tapping a looping sprite opens that NPC; a walking resident keeps one sprite on pixi; board
    parity; evening save and reload keeps Hanru at the gate; parties of 1 and 6 settle; reduced
    motion; gallery beats at dawn, afternoon and night reviewed as placeholder art.

MQ-11, teachers, spokes, Latch, travellers, endings and six-hero staging are outside Slice A. Test 4
is their no-regression guard.

## Work breakdown (bounded workers)

| #   | Work                                                                                                                                                                               | Size | Model                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| W0  | Identity register and reserved keys: the five missing, Bo/Bo-shan, Dema/Sen/Senn/Sena, with validator and test 10 (§19.7, "identity mapping first")                                | S    | Flash                                                                        |
| W1  | `DayPhase`, `world.clock` and `world.talk`, format 4, the `mapId`-based migration, fixtures, test 14                                                                               | S    | Flash                                                                        |
| W2  | The `phase` Condition kind: evaluate, describe, zod                                                                                                                                | S    | Flash                                                                        |
| W3  | `wait`, `advancePhase`, `phaseChanged`, the story `phase` field and its transitive validator, the pin write, `settle`, `reconcileWorld` at both load sites; tests 1–3, 8, 9 and 17 | M    | Flash, with Sonnet review (§1, §4 and §5 confirmed by an independent review) |
| W4a | Resident, anchor and background-role types and zod; the resolver with tiers, global ranking, the fallback chain, diagnostics and memo                                              | M    | **Sonnet/Opus**                                                              |
| W4b | The call-site sweep (10 calls in 5 files, plus the validator switch-over)                                                                                                          | S    | Flash, after W4a                                                             |
| W5a | Ba Dan anchors, resident and role records, tile logic                                                                                                                              | M    | **Sonnet**                                                                   |
| W5b | Validators and test tables for tests 4–7, 11, 12, 13 and 15                                                                                                                        | M    | Flash                                                                        |
| W5c | Anchor tiles needing visual judgment: post and handover, `bd04.*`, `bd06.watch`, doors, rest spots                                                                                 | S    | **Opus**                                                                     |
| W6  | Dialogue: plant scene, `handover_scene`, `hanru_watch`, school notice, `riverside_pella`, registry entries                                                                         | S–M  | **Opus** writes, Luna/Sonnet review. See the note below                      |
| W7  | The "Wait until…" hotbar and refusal text, the phase in the title plate and journal, the preview clock, `VillageLife` reading placements and drill gating                          | M    | **Sonnet** builds, **Opus** reviews. Never Flash                             |
| W8  | `residentMotion` planner, blocked-path fallback, `NpcMarker` id and motion fields in `canvas2d.ts` and `pixi.ts` (sprite re-keying), tap mapping and loop freeze: the P3 consumer  | M    | **Sonnet** plus **Opus** visual review. Never Flash                          |
| W9  | Browser tests and gallery beats (test 18), then capture review                                                                                                                     | M    | Flash for specs; **Opus/SOL** for judgment                                   |
| A1  | Art requests (Consequences)                                                                                                                                                        | —    | **Opus/SOL only**                                                            |

**W6 and the story bible.** The guide defers voice to the story bible (Part 07 of
`Avatar-RPG-The-Common-Current-Story-Bible-v1.0.md`) and its expansion, and neither is available.
Jared has authorized Opus to write, or rewrite, the story material Slice A needs, so W6 no longer
waits on them: Opus writes the lines against `docs/writing-guide.md` and the existing Ba Dan scenes,
and Hanru's voice is set there. If the bible arrives later, W6's lines are reconciled with it.

**Order:** W0 → W1 → W2 → W3 → W4a → W4b → W5a/W5c → W5b → W6 → W7 → W8 → W9. W8 ships on static art
first; animated sheets wait for P2/P3.

## Review record

An independent review of revision 1 (2026-09-22, ACCEPT-WITH-CHANGES) raised two blockers and eight
majors. Revision 2 answered them; a second, confirming review against `main` at `49dcb77` then
checked §1, §4 and §5 and every code citation, and made the corrections in the last rows.

| Finding                                                  | Resolution                                                                                                                                                                                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B1: speaker vanishes mid-conversation                    | The pin: `world.talk`, tier 0 `conversation` (§1, §2, §4). Test 8                                                                                                                                                                                |
| B2: pops on non-phase changes; leader on an NPC tile     | Diff after every dispatch (§5, §7); core `settle` and `reconcileWorld` on load (§5); `wait` refusal (§1). Test 9                                                                                                                                 |
| M1: plant route unsatisfiable or pre-empting             | First-route gating (§8). Test 12                                                                                                                                                                                                                 |
| M2: holds versus guard invariants; relief has no type    | Per-phase hold anchors, Dorin at handover at night (§4); `BackgroundRole` (§2). Tests 5–6 over all classes                                                                                                                                       |
| M3: fallback untalkable; ranking and diagnostics         | `fallback: ResidentSlot` with `npc`/`talk`; global ranking; fallback → home → diagnostic; mission loss is a hard error; `{ placements, diagnostics }` (§2)                                                                                       |
| M4: `phase` semantics and churn                          | Next occurrence or no-op; `wait` refuses the current phase; transitive validator; no phase nodes on NPC or repeatable roots (§1). Test 3                                                                                                         |
| M5: blocked-path fallback                                | Ignore-party retry, visible wait, re-plan, diagnostic, chokepoint fixture (§7). Test 15                                                                                                                                                          |
| M6: migration phase                                      | Chosen by `mapId`, `{ ...world }`, zod enum and `min(1)` (§6). Test 14                                                                                                                                                                           |
| M7: preview and drill regress                            | Drill control and actor gated on `rv.practice` (§8). Test 16                                                                                                                                                                                     |
| M8: renderer and tap work missing                        | `canvas2d`/`pixi` parity, `renderPos` hit-test, loop freeze (§7); W8. Test 18                                                                                                                                                                    |
| Confirming review: plant scene unreachable after victory | The `ruon_traded` clause blocked the scene forever on a traded route where `gao_cold` was never heard before victory, since `gao_cold` can't fire after it; the clause now applies only before victory (§8). Test 12                             |
| Confirming review: settle and the dialogue window        | The leader step runs only in explore; test 9 now says so, and §5 records the in-conversation overlap. The search copies `findPath`'s corner rule and never crosses an exit or active trigger (§5)                                                |
| Confirming review: pin robustness                        | The pin drops its redundant tile (the anchor is the source of truth); `reconcileWorld` clears stale pins and is wired at both load sites (§4, §5). Tests 8, 14                                                                                   |
| Confirming review: legacy mid-conversation saves         | "The phase keeps the speaker on the map" was false for riverside Dorin; recorded as a one-time limitation with a fixture (§6). Test 14                                                                                                           |
| Confirming review: preview without Mira                  | The preview is a fresh game, so Mira's pre-intro hold kept her (and Pella) in the village, against test 16; the preview's start state now records `mira_intro` as visited (§1), and §4 records the main-game consequence. Test 16                |
| Confirming review: pixi sprite keys                      | Pixi keys NPC sprites by tile; W8 re-keys them by id (§7). Test 18                                                                                                                                                                               |
| Confirming review: citations                             | `school_notice` is planned, not existing (§3); flag lines are in `src/content/story/world.ts`; `return.ts:80` says "He", not Bo-shan; `scene.ts:144` is a fade filter; tested shop door and load call sites made exact; more sprite reuse listed |
