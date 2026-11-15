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
`presentations.ts`, the recap, and two places in the story-graph test). A whole region, after ADR 0111:

| #   | Point                                                       | Inside the region folder? | Notes                                                                                                                                               |
| --- | ----------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `REGIONS`, `REGION_CONTENT`, `REGION_LAYOUTS`               | no (one line each)        | Written by `npm run new:region`; zero effort.                                                                                                       |
| 2   | `bands.test.ts`'s placeholder-band list                     | no                        | One id; intended, so a placeholder band cannot ship silently.                                                                                       |
| 3   | The region's `STORY_GROUPS`                                 | yes                       |                                                                                                                                                     |
| 4   | Node presentations                                          | yes                       | Declared on the nodes (`stage.ts`), not in `presentations.ts`: ADR 0111 removed this one.                                                           |
| 5   | `flags.ts`: entries, `FLAG_ARCS`, and readers of old flags  | no                        | 3 new flags, a new arc, and `act1_lost`/`ruon_traded` readers (the test prints them).                                                               |
| 6   | `ids.ledger.json`                                           | no                        | `npm run ids:ledger`; zero effort.                                                                                                                  |
| 7   | `enemies.ts`                                                | no                        | A region cannot carry its own enemies; they ship in the boot chunk.                                                                                 |
| 8   | The neighbour's link (`maps/world.ts`) and both manifests   | no                        | Expected: a link has two ends.                                                                                                                      |
| 9   | `scripts/art/map-pack.ts` and `docs/art/prompts/maps/`      | no                        | `prompts.test.ts` asks every map for an orthographic painting pack (see friction).                                                                  |
| 10  | Music: the region waits in `music.test.ts`'s list           | no                        | Every map must name a track and a track belongs to one region, so a region with no track yet is named in the test.                                  |
| 12  | Script tests pinned to the demo's world                     | no                        | Soak cell count and roster list, story-graph document list and count, scaffolder list test, region assets, region cache, core bench (see friction). |
| 13  | `scripts/balance/baseline.json`                             | no                        | 12 new rows; the writer could not run as shipped here (see friction).                                                                               |
| 11  | Generated docs (`docs:story`, `docs:saves`, `docs:content`) | no                        | Commands; zero effort.                                                                                                                              |

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

Every one reads "[Writer placeholder] …" in game; `grep -rn "Writer placeholder\|writerPlaceholder" src/content`
lists them.

- Three option details for Scene 2.3's approach choice (the script gives the labels only).
- The winch fight's tip and its objective label ("Stop the winch", the ADR's example).
- The market's objective text, three states (before the bowl, carrying it, after the vote).
- Three enemy descriptions (freight handler, line rigger, Veyra).
- Not marked, written plainly and to be checked: Emberwatch's and the power yard's objectives, the maps' names and
  exit labels, and the "The party" speaker label.
- Missing from the script and so not shown: SF-2.1's "the riggers put down their cutters" and the carry-on
  narration ("they get away over the wall with one coil"), which the script gives as prose, not lines.

## Art production, by batch

The owner approved the estimate above (about 1,040 credits, ±50%) on 2026-11-15, with a hard stop at 1,560. Every
job is booked in `prototypes/topdown/ledger.json` under `rg02_` and tagged `saltstep_emberwatch`, so
`python3 tools/ledger_audit.py` totals the region. Credits are each job's own booked usage; the balance is read
before and after each batch as a cross-check (the key is shared with other projects).

| Batch                                                           | Estimate | Booked | Balance before → after                                                          | Notes                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------- | -------: | -----: | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Characters: Veyra, the freight handler, the rigger           |      390 |    468 | 6,806 → 6,036 (with batch 2's first 302 booked alongside: 767 booked, 770 fell) | 3 bases, 16 clips of 8 headings, then retakes: the handler's swing and hit (east, west: smears, a red patch), Veyra's hit (four headings: a blade, blood) and flare (west), and a second knockout group for Veyra and the rigger (both sat up in the south), and Veyra's north-east flare (its first cel stood 2 px below her idle). The rigger's second group was not better and is not shipped. |
| 2. NPCs and the cart                                            |      350 |    314 | about 6,030 → 6,021 (most of it booked alongside batch 1)                       | 6 bases (the bowl-seller twice: the first drew steam off her bowl), the residents' idle and the walk for each, and two takes of the cart with Parcel (seed 11 ships). No retakes.                                                                                                                                                                                                                 |
| 2b. Luli again, to her portrait's build (owner, on #841)        |       50 |     50 | 5,764 → 5,655 (the key is shared; 50 booked)                                    | A new base (broad and sturdy: wild curly black hair, a soot smudge, a leather apron over a red vest, heavy gloves, a grin), the residents' idle and the walk. The walk job reported failed with 7 of 8 headings drawn and was booked at its own usage (21); south-west was drawn by a retake in the same group (3).                                                                               |
| 3. Portraits, style B: Veyra, Tavi Ren, Luli, the customs clerk |       72 |     30 | 6,021 → 5,991                                                                   | `portraits_b.py --prefix rg02_` from the nearest existing portrait (Jin's, Hanru's, Dema's, Sen's), as Dema and Sen were; five calls of 6, one of them Tavi's retake at seed 23 (seed 11 kept Hanru's spearhead on the ferry pole).                                                                                                                                                               |
