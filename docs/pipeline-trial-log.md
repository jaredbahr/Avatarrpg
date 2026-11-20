# Pipeline trial log: RG-02, Saltstep and Emberwatch (slice)

The content-pipeline half of the trial in `docs/pipeline-proof-plan.md` §6: can a new region be built mostly as data
in `src/content/`, without touching `src/core/`, at a known cost and time? This log is the measurement. It covers
the slice the owner scoped on 2026-11-15: the Saltstep market and Emberwatch, Veyra's guest-ally fight (Scene 2.5)
and one optional XP side fight (SF-2.1), built on placeholder art from the merged script
(`docs/story/scripts/act2-sparks.md`, #814).

**Result:** the slice is playable start to end as data. **Zero files in `src/core/`**, zero map or encounter ids in
`src/app/` or `src/render/` (one `src/app/` test changed: the music test now names regions still waiting for a
track). One Claude session, **about 125 minutes** of wall-clock time from the first read to a green `ci:local`, of
which about 25 were the content pipeline proper and most of the rest was finding and fixing tests pinned to a
one-region world. The first review's follow-up (the core spawn test, Veyra's guest form and tuning the winch
fight) added about 95 minutes. The friction below is what to fix before region three.

## Steps and minutes

Wall-clock minutes, one session, measured from the session's own timestamps. "Reading" includes the ADRs, the
script, the region folder pattern and how Act I is wired.

| Step                                                                                                  |  Minutes | Notes                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------- | -------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Read the plan, ADR 0111, ADR 0116, the script, Act I's wiring                                      |        6 | The script's "Trial slice" and "Build list" sections made scoping quick.                                                                                          |
| 2. Scaffold the region (`npm run new:region`)                                                         |       <1 | Folder, manifest, content, layouts and the three list lines, passing `validateContent` at once.                                                                   |
| 3. Design: maps, story graph, fights, the Act I link                                                  |        3 | Deciding the slice's scenes and how the loss branch is carried.                                                                                                   |
| 4. Author the data: 4 maps, 121 story nodes, 2 fights, 3 enemies                                      |        8 | Mostly transcribing the script's lines into nodes.                                                                                                                |
| 5. Make the content validators pass                                                                   |        5 | Node presentations, the Ba Dan link (rebuilt once, friction 1), map packs.                                                                                        |
| 6. Registration: flags, id ledger, docs, the band test                                                |        6 | `flags.ts`, `npm run ids:ledger`, `docs:story`, `docs:saves`, `docs:content`; a new progression check.                                                            |
| 7. A browser spec for the slice; this log's first draft                                               |       25 | About 10 of work; the rest waiting for the CI lock another session held.                                                                                          |
| 8. First `ci:local`                                                                                   |        8 | Steps 1-6 green; the test step failed 26 tests in 9 files pinned to the one-region world (friction 5-9).                                                          |
| 9. Fix those: precache, music, guest form, board width, pins, baseline                                |       22 | The balance baseline took about 20 minutes to write in process (friction 9), overlapping the other fixes.                                                         |
| 10. Second `ci:local`, the e2e run, the PR                                                            |       16 | Steps 1-12 green; step 13 is the known `ERR_UNSUPPORTED_DIR_IMPORT`. E2E: 3 passed.                                                                               |
| 11. Merge #827 (objective), plug in the winch brake, rebaseline, final CI                             |       30 | One encounter field and a round limit, no code; the baseline rewrite was most of it (friction 9).                                                                 |
| 12. Follow-up: the spawn-test PR (#831), merge main, Veyra as a guest, tune the winch, rebaseline, CI |       95 | About 15 for #831 (mostly its CI), 35 tuning through a scratch simulator harness, 15 for the baseline rewrite (friction 9), the rest e2e and two `ci:local` runs. |
| **Total**                                                                                             | **~220** |                                                                                                                                                                   |

The content pipeline itself (steps 2 to 6) took **23 minutes** for a two-map region with 121 story nodes. The
expensive part was the world outside the region folder: the Ba Dan link and the pinned tests.

## Tuning the winch fight

After the first review: with the objective plugged in, the sling was won in 2 to 3 rounds at every size, and never
for the brake. The simulated party simply killed the handlers, who used Rush to charge off the pontoon and died
by round 2 or 3; Veyra reached the brake almost at once when they did not. The target was forgiving but real: a
first-time table usually wins, the brake held around round 3 to 5, with handlers in the way.

What changed, all content:

- **The board:** the pontoon is now a main deck joined by a two-wide gangway to the winch platform. The brake is on
  the gangway's far end, (12, 4), instead of open deck at (13, 4).
- **Placement:** five handlers hold the gangway and the platform, one standing on the brake itself (the objective
  pull in the AI keeps a guard there; Veyra's Shield Bash can push him off). One reinforcement for a table of five or
  six (three made the sling the largest roster in the game and moved the core bench off its frozen cases).
- **Veyra** starts with the party at the west end, as a `guests` entry, not beside the brake.
- **The freight handler** is sturdier (30 to 48 HP) and has no Rush, so the handlers hold the winch instead of
  charging. This goes slightly past the briefed levers (positions, the brake, placement, the round limit): with
  placement alone the handlers still charged and died, and the fight stayed at about 3 rounds and 100% on Hard. It
  is still data (`enemies.ts`), and the handler appears only in this fight.
- `loseAfterRound` stays 6. The pay per head follows the roster (5 handlers at 120 over a baseline of 4: 150), and
  every Act I route still arrives inside RG-02's band.

Win rate, average rounds to a win and party HP left, 40 seeded runs per cell through the same `runCombat` the
balance report uses, party level 4 (no roster variants, so no `BALANCE_VARIANTS` split):

| Table | Story before   | Story after    | Hard before    | Hard after    |
| ----: | -------------- | -------------- | -------------- | ------------- |
|     1 | 100%, 2.0, 100 | 100%, 3.8, 100 | 100%, 2.0, 100 | 63%, 3.4, 29  |
|     2 | 100%, 3.0, 86  | 100%, 3.4, 61  | 100%, 3.0, 81  | 93%, 3.8, 42  |
|     3 | 100%, 2.2, 98  | 100%, 3.3, 70  | 100%, 2.1, 99  | 85%, 3.7, 39  |
|     4 | 100%, 2.4, 99  | 100%, 3.1, 82  | 100%, 2.5, 94  | 100%, 3.4, 56 |
|     5 | 100%, 2.3, 95  | 100%, 3.1, 84  | 100%, 2.9, 79  | 100%, 3.2, 67 |
|     6 | 100%, 2.4, 96  | 100%, 2.9, 91  | 100%, 2.9, 82  | 100%, 3.0, 78 |

The balance tripwire baseline (`scripts/balance/baseline.json`, 120 runs, sizes 1, 3 and 6) agrees. Wins, average
rounds and party HP left, before and after; only the winch's rows changed:

| Table | Story before    | Story after     | Hard before     | Hard after     |
| ----: | --------------- | --------------- | --------------- | -------------- |
|     1 | 120, 2.00, 100% | 120, 3.54, 100% | 120, 2.00, 100% | 101, 3.91, 64% |
|     3 | 120, 2.13, 99%  | 120, 3.23, 70%  | 120, 2.07, 99%  | 109, 3.83, 40% |
|     6 | 120, 2.34, 96%  | 120, 2.94, 89%  | 120, 2.91, 83%  | 120, 3.01, 75% |

The default difficulty still always wins, now in about 3 to 4 rounds and with real damage taken at two to four
players; Hard can be lost at one to three. The simulated party still prefers to win by defeating the handlers (it
takes the brake in up to a third of Story wins and three quarters of Hard wins at one player); real players, told
"Stop the winch", will go for the brake more often. A table of six is the easiest cell, as the one-reinforcement
cap makes it; that is the thing to watch when the owner plays it.

## Files touched

56 files changed against `main`. **None in `src/core/`.**

| Where                                     | Files | What                                                                                                                                            |
| ----------------------------------------- | ----: | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/content/regions/saltstepEmberwatch/` |     9 | The region: manifest, content, layouts, maps, MQ-02 story, Emberwatch story, encounters, staging, placeholders.                                 |
| `src/content/regions/` (lists, bands)     |     4 | The three registration lines (by the scaffolder) and the placeholder-band list in `bands.test.ts`.                                              |
| `src/content/` shared                     |     5 | `enemies.ts` (3 records), `flags.ts` (3 flags, 1 arc, 8 readers), `ids.ledger.json`, `maps/world.ts` (the sign), Ba Dan's manifest (neighbour). |
| `src/content/` tests                      |     2 | `progression.test.ts` (a new band-entry check), `story/baDanDay.test.ts` (reads node-declared presentations).                                   |
| `src/app/` tests                          |     1 | `audio/music.test.ts` (regions waiting for a track). No `src/app/` or `src/render/` code.                                                       |
| `scripts/`                                |     8 | `region-cache.mjs` (neighbours precached), `art/map-pack.ts` (a prompt per map), the balance baseline, five pinned tests.                       |
| `docs/`                                   |    26 | ADR 0111 amendment, this log; generated: story diagrams (2 new, 12 renumbered), save history, content reference, 4 map packs and layouts.       |
| `e2e/`                                    |     1 | `rg02-trial-slice.spec.ts`.                                                                                                                     |
| `src/core/`, `src/render/`                | **0** |                                                                                                                                                 |

The region chunk is **11.2 KB gz** (cap 40); boot plus the largest region is 406.5 of 410 KB. The three enemy
records ship in the boot chunk (friction 4).

Region data: 1,930 lines across the region folder, of which the MQ-02 story is 1,152 (one node per script line).

## Registration points hit

The SQ-01 trial counted nine per side story (`flags.ts`, `FLAG_ARCS`, `STORY_GROUPS`, NpcDef routes,
`presentations.ts`, the recap, and two places in the story-graph test).

**2026-11-19:** five remain, every one of them the story's own data. A side story keeps its conversations on
their map with `inWorld(mapId, nodes)` (`story/storyGroup.ts`) and exports its own `StoryGroup`, so
`presentations.ts` needs no rows and the region's list takes one entry. The story-graph test derives its
document list and count from the groups. What is left: the flags and their arc line in `flags.ts`, the region
entry, the NpcDef routes that open it, and the recap lines (the writing pass).

A whole region, after ADR 0111:

| #   | Point                                                       | Inside the region folder? | Notes                                                                                                                                                                       |
| --- | ----------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `REGIONS`, `REGION_CONTENT`, `REGION_LAYOUTS`               | no (one line each)        | Written by `npm run new:region`; zero effort.                                                                                                                               |
| 2   | `bands.test.ts`'s placeholder-band list                     | no                        | One id; intended, so a placeholder band cannot ship silently.                                                                                                               |
| 3   | The region's `STORY_GROUPS`                                 | yes                       |                                                                                                                                                                             |
| 4   | Node presentations                                          | yes                       | Declared on the nodes (`stage.ts`), not in `presentations.ts`: ADR 0111 removed this one.                                                                                   |
| 5   | `flags.ts`: entries, `FLAG_ARCS`, and readers of old flags  | no                        | 3 new flags, a new arc, and `act1_lost`/`ruon_traded` readers (the test prints them).                                                                                       |
| 6   | `ids.ledger.json`                                           | no                        | `npm run ids:ledger`; zero effort.                                                                                                                                          |
| 7   | `enemies.ts`                                                | no                        | A region cannot carry its own enemies; they ship in the boot chunk.                                                                                                         |
| 8   | The neighbour's link (`maps/world.ts`) and both manifests   | no                        | Expected: a link has two ends.                                                                                                                                              |
| 9   | `scripts/art/map-pack.ts` and `docs/art/prompts/maps/`      | no                        | `prompts.test.ts` asks every map for an orthographic painting pack (see friction).                                                                                          |
| 10  | Music: the region waits in `music.test.ts`'s list           | no                        | Every map must name a track and a track belongs to one region, so a region with no track yet is named in the test.                                                          |
| 12  | Script tests pinned to the demo's world                     | no                        | Soak cell count and roster list, scaffolder list test, region assets, region cache, core bench (see friction). The story-graph list and count are derived since 2026-11-19. |
| 13  | `scripts/balance/baseline.json`                             | no                        | 12 new rows; the writer could not run as shipped here (see friction).                                                                                                       |
| 11  | Generated docs (`docs:story`, `docs:saves`, `docs:content`) | no                        | Commands; zero effort.                                                                                                                                                      |

Thirteen touches, of which five are commands or one-liners. The ones that cost thinking were 5, 7, 8, 9, 12 and 13.

## Friction found

Ordered by what it cost. None needed a change to shipped `src/core/` code (5 was a test-only correction in its own
PR, #831); 1, 2, 3, 6 and 14 are worth an issue before region three.

1. **An exit cannot be added to a baked top-down map.** The first link was an exit on Ba Dan's south lawn (the
   architecture's intended region gate). `topdownLayout.test.ts` refuses it: an exit must stand on a rim mouth
   that the map's baked terrain already has, and changing the terrain means re-baking Ba Dan's plates (art). The
   link is now a route sign (`coast_road_sign`) whose `when` is the gate. Any region joined to an existing map
   will hit this; a region link should be planned into the neighbour's board, or the layout rules should allow a
   declared future mouth.
2. **A one-option tap does not exist.** The script's `Party:` lines are "tappable choice text with no speaker",
   often a single one. A `choice` node needs two options (schema) and is always a table vote. They are shown as a
   narrator-framed "The party" line for now. The same gap blocks Scene 2.3's "the decider picks" (not a vote).
3. **No condition on a story link.** A `branch` reads one flag, so hero variants ("If Kaya is in the party") can
   only be wired where an NPC route chooses the entry (Kaya's crates, Luli's invitation). Tenzo, Jinu, Sura, Wen
   and Riko's lines are not wired. A `branch` taking a `Condition` would cover them all.
4. **Enemies are shared content.** The freight handler, the rigger and Veyra's record live in `enemies.ts`, in the
   boot chunk, not the region chunk. Fine for three; a saga's worth will grow the boot JS.
5. **The guest mechanic was not yet "data only" for a shipped guest.** `src/core/state/encounterSpawns.test.ts`
   counted only `allies` as the party's side, so the first shipped `EncounterDef.guests` entry failed it (six cases).
   **Outcome:** fixed as a test-only correction in its own code PR (#831, merged: the test now counts guests after
   the story allies, as ADR 0116 and the engine already did, with a new case for sizes 1 to 6), and Veyra now uses
   the `guests` form. The trial briefly used ADR 0116's `allies` shorthand meanwhile. Cost: about 15 minutes, most
   of it the CI run.
   Also: a guest built from a character kit would join the party-setup roster (no "not playable" flag), so
   Veyra is an enemy record, and since `progression.test.ts` allows zero XP only to `ruon_ally`, it carries a token
   `xp: 1` that is never paid.
6. **Tests pinned to the demo's world.** A second region failed 26 tests in 9 files that hard-code the one-region
   world: the soak matrix's cell count and roster list, the story-graph document list and count, the scaffolder's
   list test, region assets, the region cache ("inert while the start region is the only region"), the precache,
   and the core bench, which adds every board tied for the largest combat grid and demands frozen limits for it
   (RG-02's boards are 19 columns, not 20, to stay out of it; the tuned winch fight likewise keeps one
   reinforcement, so a table of six stays below the ambush, the largest roster, which the bench also freezes). Each was updated to the new truth, none loosened, but
   every region will pay this again until they read the region list instead of a number.
7. **Offline start needed the neighbour precached.** A region is ready only when its neighbours are, so once Ba Dan
   names RG-02, a new game cannot start until RG-02's chunk is in. ADR 0111 §3 left it to the runtime cache, which
   an update clears: the demo would not have started offline after an update. Fixed in `scripts/region-cache.mjs`
   (the start region's neighbours are precached) with an ADR 0111 amendment for the owner.
8. **A track belongs to one region.** `region-assets.test.ts` refuses a track in two regions and `music.test.ts`
   wants a track on every map, so placeholder music is impossible. RG-02's maps have no rows (they keep what is
   playing) and the music test lists the region as waiting for its track.
9. **The balance baseline writer cannot run here.** `npm run balance:baseline` fails in this container with
   `ERR_UNSUPPORTED_DIR_IMPORT` (the worker threads do not load TypeScript; `balance:check` fails the same way on
   `main`). The rows were written in process through the same functions; the existing 48 came out unchanged to the
   digit. The winch fight was tuned afterwards (see "Tuning the winch fight" below); SF-2.1 wins 67% at three
   players on Hard and was left alone.
10. **Map painting packs for every map.** `prompts.test.ts` still demands an orthographic painting pack (ADR 0009)
    per map, written in `scripts/art/map-pack.ts`. Top-down regions do not use it; it should be scoped to maps with
    a `backdrop`, or retired.
11. **The Ba Dan presentation test read only the shared registry.** It now reads node-declared presentations too
    (the ADR 0111 way); the assertion is unchanged.
12. **Things the script needs that the engine lacks** (not built here, as briefed): fight barks for Veyra, an
    in-fight line on a combo event ("the first time a puddle sparks"), a live line that shocks the wet ground beside
    it, the handlers yielding at low health, and a drifting stall. The winch objective merged mid-trial (#827) and
    was plugged in as data: `objective` (hold the brake at a round's end, now (12, 4)) and `loseAfterRound: 6`, with
    no code; that is the guest-ally ADR's pass bar met for the objective, too.
13. **The region-graph progression walk.** The XP walk stops at Act I's end, so RG-02's fights are not walked. A new
    check holds every Act I route, won or lost, inside RG-02's band on arrival, and `bands.ts` holds both fights to
    the band; walking a region's own fights waits for the ADR 0011 rewrite.

14. **One content test sits near its time limit.** `topdownLayout.test.ts`'s "passes the content validation" takes
    about 3.8 s of its 5 s on `main` (4.2 s with RG-02), almost all of it classifying the quarry's top-down terrain
    in `validateTopDownLayout`; it timed out once in a loaded `ci:local` during the follow-up and passed on the rerun.
    Every region adds to `validateContent`, so it will cross the limit by itself before long; caching the terrain
    classification would fix it without raising the timeout.

## Art needed, with an estimated PixelLab cost

Unit costs from `docs/pipeline-proof-plan.md` ("Cost per unit"). Nothing was generated in this trial.

| Asset                                                                                                                                                                                                                                                          | Count | Credits each |          Credits |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----: | -----------: | ---------------: |
| Veyra: base and six clips (idle, walk, lance, flare, hit, knockout), 8 headings                                                                                                                                                                                |     1 |         ~146 |              146 |
| New enemy types with five clips each: freight handler, line rigger (Sabi shares the rigger sheet)                                                                                                                                                              |     2 |         ~122 |              244 |
| NPCs with idle and walk: Tavi, customs clerk, Luli, bowl-seller, freight clerk, retired cook                                                                                                                                                                   |     6 |          ~50 |              300 |
| The cart with Parcel in harness                                                                                                                                                                                                                                |     1 |          ~50 |               50 |
| Portraits, style B at 160 px (Veyra, Tavi, Luli, customs clerk), about 3 tries each                                                                                                                                                                            |     4 |          ~18 |               72 |
| Wang tilesets: planks over water, quay sand, parade ground and barracks stone, yard earth with puddles                                                                                                                                                         |     4 |           15 |               60 |
| Objects: stalls, level poles, customs stall and flag, ferry, warehouses, Jin's office front, Miri's crates, pump crate, teapot, handcart, winch, crane sling and crate, barge, bean canvas, spear-rack trellis, jetty, line poles, cistern, copper spur, lamps |   ~26 |           ~5 |              130 |
| Cards: Mira's note, the pay packet, the lamp-over-a-wave stencil                                                                                                                                                                                               |     3 |           ~6 |               18 |
| Effects: pressure lance, signal flare, live-line spark                                                                                                                                                                                                         |     3 |           ~5 |               15 |
| Sounds: lance hiss, flare, winch                                                                                                                                                                                                                               |     3 |            1 |                3 |
| **Total**                                                                                                                                                                                                                                                      |       |              | **~1,040, ±50%** |

The plan's pre-trial estimate for a small region was about 750. The slice is larger in figures (one guest with full
clips and six NPCs), which is where the difference is. Not in credits: one area track (ADR 0108, the owner listens
first), and four boards drawn as top-down scenes (each a hand-written board script of 400 to 1,150 lines today,
the plan's biggest art-pipeline cost in hours).

## Placeholders left for the writer

**Closed by the writing pass (2026-11-15).** No string reads "[Writer placeholder] …" in game any more. The
helper stays in `placeholders.ts` for the next build; `grep -rn "writerPlaceholder(" src/content` lists any that are
open (none now).

What was written, from or in agreement with the script (`docs/story/scripts/act2-sparks.md`):

- The three option details for Scene 2.3's approach choice, and a footer saying all three reach the clerk.
- The winch fight's tip and its objective label ("Stop the winch at the brake").
- The market's objective in its three states (before the bowl, carrying it, after the vote).
- The three descriptions (freight handler, line rigger, Veyra).
- Checked and reworded: Emberwatch's and the power yard's objectives now say what to do and where; the coast-road
  exit names the map it goes to ("Ba Dan Village"), as Act I's exits do. The map names and the other exit labels
  already matched the script and Act I's pattern.
- SF-2.1's two outcomes, as narrator lines: "The riggers put down their cutters." before Luli's offer, and the
  riggers getting away over the wall with one coil before her carry-on line.
- Hero variants wired as data: **Tenzo** at the bowl stall (2.2) and **Jinu** on the coast road after a loss (2.1).
  Each is the scene's chain again under its own ids, entered by an NPC route on `partyHas` and ending on the hero's
  lines (the way Kaya's crates were wired). That is 13 extra node ids for four hero lines; friction 3's `branch` on a
  `Condition` would have needed four.
- **Sura and Wen (2.4) and Riko (2.6)**, once friction 3 was answered by `branchWhen` (ADR 0118): a `branchWhen` on
  `partyHas` before Veyra's "Odd." (Sura, after either driver's echo), after it (Wen) and after Veyra leaves (Riko).
  Sura's culvert line is a variant on `visited: cutting_culvert`. Three pass-through nodes and nine lines, no copies.
- **Kaya's, Tenzo's and Jinu's copies folded** onto the one chain behind a `branchWhen` each. The NPC and sign routes
  that picked a copy are gone, and the ten retired ids are aliased onto their plain twins (`idAliases.ts`), so a save
  made mid-copy resumes on the same line. Every hero variant in MQ-02 is now one pass-through node and its lines.

Still open, and why:

- **"The party" speaker label.** The owner decided `Party:` lines are tappable choice text with no speaker. A
  dialogue node must name a speaker and a choice needs two options (friction 2), so the four `Party:` lines keep the
  narrator-framed "The party" label until a one-option tap exists.

## Art production, by batch

The owner approved the estimate above (about 1,040 credits, ±50%) on 2026-11-15, with a hard stop at 1,560. Every
job is booked in `prototypes/topdown/ledger.json` under `rg02_` and tagged `saltstep_emberwatch`, so
`python3 tools/ledger_audit.py` totals the region. Credits are each job's own booked usage; the balance is read
before and after each batch as a cross-check (the key is shared with other projects).

| Batch                                                                                      | Estimate | Booked | Balance before → after                                                          | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------ | -------: | -----: | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Characters: Veyra, the freight handler, the rigger                                      |      390 |    468 | 6,806 → 6,036 (with batch 2's first 302 booked alongside: 767 booked, 770 fell) | 3 bases, 16 clips of 8 headings, then retakes: the handler's swing and hit (east, west: smears, a red patch), Veyra's hit (four headings: a blade, blood) and flare (west), and a second knockout group for Veyra and the rigger (both sat up in the south), and Veyra's north-east flare (its first cel stood 2 px below her idle). The rigger's second group was not better and is not shipped.                                                                                                                                                                                                                                                                                                                                                       |
| 2. NPCs and the cart                                                                       |      350 |    314 | about 6,030 → 6,021 (most of it booked alongside batch 1)                       | 6 bases (the bowl-seller twice: the first drew steam off her bowl), the residents' idle and the walk for each, and two takes of the cart with Parcel (seed 11 ships). No retakes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2b. Luli again, to her portrait's build (owner, on #841)                                   |       50 |     50 | 5,764 → 5,655 (the key is shared; 50 booked)                                    | A new base (broad and sturdy: wild curly black hair, a soot smudge, a leather apron over a red vest, heavy gloves, a grin), the residents' idle and the walk. The walk job reported failed with 7 of 8 headings drawn and was booked at its own usage (21); south-west was drawn by a retake in the same group (3).                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2c. The retired cook again (owner: "the cook just seemed off")                             |       50 |     50 | 5,457 → 5,407                                                                   | A new base with a small straw hat no wider than his shoulders and adult proportions, the residents' idle and the walk; on-model in all 8 headings, no retakes. His face (skull to chin, hat left out) is about 12 of 46 px, within 10% of the party's.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 3. Portraits, style B: Veyra, Tavi Ren, Luli, the customs clerk                            |       72 |     30 | 6,021 → 5,991                                                                   | `portraits_b.py --prefix rg02_` from the nearest existing portrait (Jin's, Hanru's, Dema's, Sen's), as Dema and Sen were; five calls of 6, one of them Tavi's retake at seed 23 (seed 11 kept Hanru's spearhead on the ferry pole).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 4. Wang tilesets: planks over water, quay sand, parade flagstones, yard earth with puddles |       60 |     75 | about 5,991 → 5,916                                                             | `tools/rg02tiles.py`, pro mode, 32 px, the village palette. The first planks set came back as red-and-grey brick and was redone with the wood, its colour and the boards' direction spelled out (`rg02_planks2`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 5. Objects: 26 pieces for the four boards                                                  |      130 |    147 | 5,916 → 5,764 (with batch 4's planks retake)                                    | One `create-object-pro-flash` call each, the oven as the one angle reference and the size in px. Five first tries were refused (no charge): a canvas narrower than the 42 × 47 reference; all five were redone on 48 px canvases. Two calls were charged while the disk was full, so their images and ledger rows were lost; they are booked by hand as `rg02_obj_*_lost` (10). Miri's lantern crates are wired on the quay; the rest wait for the boards.                                                                                                                                                                                                                                                                                              |
| 5b. The parade wall and a yard fence                                                       |       20 |     16 | 5,407 → 5,391                                                                   | Three pieces: the parade wall section (used along the barracks row) and a yard fence in two orientations. The fence is not used: the map's notes make the yard's `F` cells the live line on its poles and the copper spur, which the 26 pieces already had.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 5c. Dressing: the quay's scatter and the parade's training props (owner)                   |       40 |     30 | 5,391 → 5,361                                                                   | Six pieces: a net pile, fish baskets, a rope coil with a barrel, a training dummy, a water trough, a weapon rack.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 6a. Density: the market (owner: "think about the density in Ba Dan")                       |       80 |     79 | 5,361 → 5,282                                                                   | Fifteen pieces: the lighthouse (the landmark), three kinds of house for the town, drying racks, tall crate stacks, barrels, lobster pots, a gutting table, a fish shed, bunting, a rowing boat, a sailboat, shoreline rocks and gulls. 70 scenery pieces on the board, from 19.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 6a2. The market again, in the Earth Kingdom style (owner: "follow the game's lore")        |       50 |     53 | 5,226 → 5,171                                                                   | Ten pieces: a cottage, a shophouse and a moon-door house with green glazed upturned roofs, a stone beacon tower with a lantern pavilion (the landmark, replacing the lighthouse), a coastal pine, a well, a wayside shrine, laundry, a warehouse and green and gold banners. The first take's European houses, lighthouse, bunting and warehouse (about 30 credits) are not used. 77 standing pieces.                                                                                                                                                                                                                                                                                                                                                   |
| 6b. Density: the pontoon                                                                   |       56 |     56 | 5,282 → 5,226                                                                   | Eleven pieces: the big cargo barge (the landmark, a second take: the first came back end-on), a dock crane, a pulley gantry, tarped cargo, oil drums, chains, pilings, rope lines, buoys and a gangway (not used). 34 standing pieces and about 27 flats on the water and the deck, from 6.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 6c. Density: the parade ground, a Fire Nation outpost (owner: "follow the game's lore")    |       64 |     65 | 5,171 → 5,106                                                                   | Twelve pieces: the old signal tower (the landmark), a barracks front, a red wall section with flame crests, braziers, flame banners, a flag mast, a lantern shrine, an army tent, straw targets, a sparring ring, a rock spur and boulders. The board became a walled outpost: the wall along the north, the tower standing tall at its east corner, a rock spur down the west side and a rocky south-east shoulder, with the bay biting into the south-west. 46 standing pieces and about 10 flats, from 22. About 70 minutes. Six pieces on the last row cast their shadows into the void past the south edge; they are nudged up 12 px so the shadow lands on the ground.                                                                            |
| 6d. Density: the power yard                                                                |       40 |     41 | 5,106 → 5,065                                                                   | Eight pieces, in the outpost's Fire Nation style: Luli's generator shed (the landmark, its hanging cables trimmed from the sprite so its cast stays joined), copper coils, transformer drums, warning signs, cable reels, crates of insulators, a switch panel and cables lying across the ground (one call had to be redone: a 32 px canvas is shorter than the style reference). The yard is pinched between the shed in the north-west corner, where the live line now starts, and a low rocky rise on the south side; its clutter lines the rim, carried one cell past the grid (`Rg02Terrain`'s new `ends`), so the edge stays ragged. Eight walkable cells went; the balance tripwire passes (233 of 240 measures unchanged to the digit, largest | z   | 1.85). 41 standing pieces, from 10. About 60 minutes. |
| 6e. The market, one more pass (owner)                                                      |       45 |     45 | 5,065 → 4,993 (the key is shared; 45 booked)                                    | Nine pieces in the Earth Kingdom style (each prompt names it, as in the Avatar animated style, and says what it is not: not European, no half-timbering, no chimney): two market stalls (a green glazed canopy, a jade paper parasol), a merchant's handcart with a green canopy, fish crates, a bamboo frame hung with dried fish and squid, glazed clay jars, a tower of woven baskets, a bamboo lantern post and a reed mat of fish (a flat). All first takes, 5 credits each, no retakes. 17 pieces went onto the quay's wide sand (13 standing, 4 mats), with the lane's rows 5 and 6 staggered so one row is always open; the soft ground edges are a baker option (`wear.soft`), used by the market only.                                        |

### Building the boards

The boards cost no credits: they are baked from the tilesets and the pieces above. One baker serves the whole region
(`scripts/art/topdown/boards/rg02.ts`), over one terrain classifier (`src/content/scenes/rg02.topdown.terrain.ts`) that
reads each map's own rows, so a board is a config of about twenty lines plus its layout (`rg02.topdown.ts`). About
**47 minutes** (16:12 to 16:59) took the first two boards from nothing to green, with the classifier and the baker as
most of it. What cost time:

- **A narrow deck carries a figure.** The two-cell jetties lost their figures' side probes to the water, so on ground
  the water and the void are held off a flat core out past a figure's half width.
- **No edge on the grid line.** Any bump left at a cell's edge snaps the boundary to the grid and the straight-edge
  check fails (6 tiles at first); every bump now lets go by the cell's edge, and the noise is a little stronger.
- **Planks are not quilted.** The ground quilt's warp broke the boards' lines into a two-tone camouflage, so the deck
  keeps the tile's rows whole and only staggers its board ends. A deck's side over the water is built timber and is
  left out of the straight-edge check, as the canal's kerbs are.
- A probe left waiting on standard input looked like a slow validator; it never ran.
- **Registering a scene is a perf-guard change.** The market and the parade ground are 24 by 16, as Ba Dan is, so
  listing them in the region's `scenes` made them tie for the largest top-down board, and
  `scripts/perf/core-bench.test.ts` then wanted independently measured, frozen limits for each. A board of the same
  area and reach budget adds no new bound, so the supplement now measures one tied map: the one with frozen limits,
  else the first registered (`chooseTopDownBenchMap`). No limit was remeasured; the harness change is recorded as a
  revision beside the original calibration, whose hashes stay pinned. A region of Ba Dan's size no longer pays this.
- **The last two boards took about 60 minutes** (17:00 to 18:00, with other work between): read the maps' own notes
  first. The yard's `F` cells are the live line and the copper spur, not a fence, so the fence bought for them went
  unused (10 credits), and the parade's east gate and the yard's west gate needed flagstones (`C`) for their mouths.
  Two more noise and shadow fixes: the second octave a little stronger so the parade's flagstone edges break, and the
  south copper spur moved off the yard's corner so its shadow falls on the yard, not into the rim.
- **Dressing the boards took about 50 minutes** (owner, 2026-11-15: the market and the parade ground dressed before
  the merge). Every standing piece needs a blocked cell, so the region has its own legend: the shared one plus three
  see-over blocked grounds (`n` sand, `u` grass, `d` dirt), in the region's `maps.ts`, with nothing in `src/core`.
  What cost time: a piece on a cell at the water's edge has its foot sampled to within 4 px of the cell's sides, where
  the water creeps in, so pieces on the waterline sit back a few px and the customs stall moved to an inner deck cell,
  behind its clerk. A new test (`saltstepEmberwatch/reach.test.ts`) walks every map from its first spawn and holds
  every NPC, trigger and exit reachable, so dressing can never wall a scene off.
- **The density pass, the market: about 60 minutes and 79 credits** (owner, 2026-11-17: 60 to 100 pieces a map, the
  rim dressed, one landmark, a shape that is not a rectangle). The board's shape is carved in its rows: the town's
  houses fill the top edge as blocked cells (`U`) so the plate's margin carries on as ground under more roofs; the
  bay carries on past the bottom edge as water; the quay has an inlet and four jetties of different lengths, one
  crooked. Boats, rocks and gulls are flats on the water, so they need no cells. The baker gained ground variation
  for every board (a three-step colour drift, worn paths, wet patches, pebbles), which roughly doubles a plate's
  bytes (the market's is 219 KB, under the quarry's 350 KB). A single-cell-wide jetty cannot hold a standing piece
  at its end: the water creeps into both sides of the foot.
- **The pontoon: about 35 minutes and 56 credits.** It is a fight board, so its walkable cells are exactly as they
  were and the balance tripwire has nothing to see. The density comes from a freight quay along the north edge
  (`k`: timber, blocked and seen over, the same to the rules as the water it replaced), its yard running on past the
  edge, piles in the water round the deck, rope lines across the gaps, and the barge moored alongside the platform.
  Flats (boats, piles, chains) are baked into the plate, so a scene's `scenery` count is standing pieces only: the
  pontoon's 34 understate it.
- **Lore before density: about 40 minutes and 53 credits.** Saltstep is an outer Earth Kingdom harbour town (the
  story bible's Tidemark Reach) and Emberwatch a decommissioned Fire Nation outpost, so every building follows that
  nation's architecture as in the animated style. The first market take was generic European (half-timbering,
  chimneys, a colonial lighthouse) and was redrawn; every object prompt now names the nation and "as in the Avatar
  animated style", and says what it is not. The town was loosened at the same time: houses staggered off row 0 by
  varied base offsets and flips, with pines, a well, a shrine and washing in the gaps, and alleys in the lane. Ba
  Dan's houses show the same European drift; that is the owner's call and is not changed here.
- **The market again, filling the quay: about 50 minutes and 45 credits** (owner, 2026-11-17: the open sand in the middle
  read empty at 1x; the wet patches read as square stains). Ba Dan's density was the reference. The baker's `wear.soft`
  option breaks the ground's colour drift, the quilt's seams, the wet patches and the worn paths with a per-pixel
  jitter, as the Wang tiles' edges are, so none of them follows a straight or square line; it is on for the market
  only, and the other boards' plates are byte-for-byte unchanged. Sixteen more cells of the quay are blocked (stalls,
  jars, crates, baskets, a lantern post), each island of the lane (rows 5 and 6) has a gap of both rows beside it, and
  `reach.test.ts` still holds every NPC, trigger and exit reachable.

| Board                    | State                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saltstep market          | Baked, dressed and shown: quay sand, packed earth, three stall jetties, the warehouse, Jin's office and its freight, the broth and fish stalls, the customs stall behind its clerk, the tide pole at the pier's end, bollards, two dock lamps, nets, baskets, rope and a handcart along the quay's edges, Tavi's ferry. Rows 5-6 and column 3 stay open. |
| Freight pontoon          | Baked and shown: the planks, the winch and crane on their blocked cells, the cover crates and the pump crate on the cover cells, the barge in the water.                                                                                                                                                                                                 |
| Emberwatch parade ground | Baked, dressed and shown: packed earth, the flagstone square (kept clear for a fight) and east gate, the wall in sections either side of the barracks, the spear-rack trellis, an outpost lamp, two training dummies, a weapon rack, a water trough, the cook's beans, and the jetty corner reworked into a stepped, organic edge over the water.        |
| Emberwatch power yard    | Baked, dressed and shown: the yard's mud with the cistern's overflow in puddles, the live line on seven poles, the cistern, the copper spur on its poles, the workshop bench in the south-west corner, the flagstone west gate; the yard's wall is the rim.                                                                                              |

## Ba Dan's houses in the Earth Kingdom style (owner, 2026-11-17: "follow the game's lore")

Ba Dan is an Earth Kingdom farming village, but its five houses had drifted to a European look (half-timbering, red
brick chimneys, terracotta roofs), as did two props (a gabled stone shrine and a wrought-iron street lamp) and the
timber-gabled well. The same lore pass Saltstep had (the "Lore before density" note above, row 6a2), applied to the
starting village. Tools: `prototypes/topdown/tools/v16gen.py` (houses), `v16props.py` (shrine, lamp, well), then
`v16proc.py` and `v16propsproc.py` (1-bit alpha, largest component, outline recoloured as v14); the picks are in
`prototypes/topdown/v16/pick.json`. The method is the quarry's and Saltstep's: `create-object-pro-flash`, low top-down,
the **existing piece as the ONE angle reference** (its size and camera only; the prompt says not to copy its materials),
the size in px, and a prompt that names "an Earth Kingdom village house as in the Avatar animated style" with a sage green
glazed roof with upturned eaves, rammed-earth and limewashed walls on a stone base, dark reddish timber posts and paper
lattice windows, and says it is not European (no half-timbering, no chimney, no Tudor, no red clay tiles). Ba Dan's pieces
keep a warmer inland look than the harbour's (rammed-earth browns and ochre, cream limewash, sage not olive roofs).
Each piece's door is on its sprite's centre, so `put()` keeps every door cell, route and talk point.

| Piece (old size → new)               | Credits | Notes                                                                                                                    |
| ------------------------------------ | ------: | ------------------------------------------------------------------------------------------------------------------------ |
| `house_gao` (182x190 → 216x167)      |       9 | Gao's cottage: round lattice windows, herb bundles at the door. First take.                                              |
| `house_mira` (226x237 → 256x238)     |       9 | Two tiers of roofs, studded double door, a paper lantern. First take.                                                    |
| `house_pella` (214x221 → 242x216)    |      18 | First take came back with transparent walls (the green wall read as empty): retaken with "solid, opaque cream limewash". |
| `house_se` (204x218 → 186x161)       |      18 | First take 80% as wide as the old one; retaken larger (seed 4), a timber balcony and a bamboo shade.                     |
| `house_merchant` (250x188 → 216x164) |      18 | The wide shop-house with an open shop front and a hanging sign; retaken wider (seed 4).                                  |
| `shrine`, `lamp`, `well`             |  5 each | A green-roofed wayside shrine, a wooden post with a paper lantern, a round stone well with a tiled roof.                 |

- **Credits: 87 of the 100 cap** (11 jobs: 5 first takes, 3 retakes, 3 props; the houses cost 9, the small props 5). The
  balance read 5,065 before; the ledger (`prototypes/topdown/ledger.json`, tag `ba_dan_valley`) is the count, since the
  key is shared with other sessions. About an hour end to end, most of it waiting for the shared CI lock.
- **Re-bake:** `pack-ground.ts --map ba_dan_village` (the new props are in `assets/objects_t3/`, which the board loader
  prefers over `objects12`; the houses replace `objects_bd13/`). Layout, footprints, blocked cells and base lines are unchanged.
- **Smoke:** the village's chimney wisps were found by detecting each drawn chimney. The new houses have none, so each house
  now has one wisp from a roof-ridge vent (`VENT` in `boards/baDan.ts`), five as before, which `topdownAmbience.test.ts` holds.
- **Left as they were, on purpose:** `house_ne` (unplaced, listed in `LEFT_OUT`); the red `banner_pole` (red reads Fire
  Nation; `pack-ground.test.ts` measures its baked disc from `objects12/banner_pole.png`, so it needs its own change); the
  striped market awning, which is a market's, not a nation's.
