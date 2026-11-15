# Pipeline trial log: RG-02, Saltstep and Emberwatch (slice)

The content-pipeline half of the trial in `docs/pipeline-proof-plan.md` §6: can a new region be built mostly as data
in `src/content/`, without touching `src/core/`, at a known cost and time? This log is the measurement. It covers
the slice the owner scoped on 2026-11-15: the Saltstep market and Emberwatch, Veyra's guest-ally fight (Scene 2.5)
and one optional XP side fight (SF-2.1), built on placeholder art from the merged script
(`docs/story/scripts/act2-sparks.md`, #814).

**Result:** the slice is playable start to end as data. **Zero files in `src/core/`**, zero map or encounter ids in
`src/app/` or `src/render/` (one `src/app/` test changed: the music test now names regions still waiting for a
track). One Claude session, **about 100 minutes** of wall-clock time from the first read to a green `ci:local`, of
which about 45 were the content pipeline proper and most of the rest was finding and fixing tests pinned to a
one-region world. The friction below is what to fix before region three.

## Steps and minutes

Wall-clock minutes, one session, measured from the session's own timestamps. "Reading" includes the ADRs, the
script, the region folder pattern and how Act I is wired.

| Step                                                                   |  Minutes | Notes                                                                                                     |
| ---------------------------------------------------------------------- | -------: | --------------------------------------------------------------------------------------------------------- |
| 1. Read the plan, ADR 0111, ADR 0116, the script, Act I's wiring       |        6 | The script's "Trial slice" and "Build list" sections made scoping quick.                                  |
| 2. Scaffold the region (`npm run new:region`)                          |       <1 | Folder, manifest, content, layouts and the three list lines, passing `validateContent` at once.           |
| 3. Design: maps, story graph, fights, the Act I link                   |        3 | Deciding the slice's scenes and how the loss branch is carried.                                           |
| 4. Author the data: 4 maps, 121 story nodes, 2 fights, 3 enemies       |        8 | Mostly transcribing the script's lines into nodes.                                                        |
| 5. Make the content validators pass                                    |        5 | Node presentations, the Ba Dan link (rebuilt once, friction 1), map packs.                                |
| 6. Registration: flags, id ledger, docs, the band test                 |        6 | `flags.ts`, `npm run ids:ledger`, `docs:story`, `docs:saves`, `docs:content`; a new progression check.    |
| 7. A browser spec for the slice; this log's first draft                |       25 | About 10 of work; the rest waiting for the CI lock another session held.                                  |
| 8. First `ci:local`                                                    |        8 | Steps 1-6 green; the test step failed 26 tests in 9 files pinned to the one-region world (friction 5-9).  |
| 9. Fix those: precache, music, guest form, board width, pins, baseline |       22 | The balance baseline took about 20 minutes to write in process (friction 9), overlapping the other fixes. |
| 10. Second `ci:local`, the e2e run, the PR                             |       16 | Steps 1-12 green; step 13 is the known `ERR_UNSUPPORTED_DIR_IMPORT`. E2E: 3 passed.                       |
| **Total**                                                              | **~100** |                                                                                                           |

The content pipeline itself (steps 2 to 6) took **23 minutes** for a two-map region with 121 story nodes. The
expensive part was the world outside the region folder: the Ba Dan link and the pinned tests.

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

Ordered by what it cost. None was solved by a `src/core/` change; 1, 2, 3, 5 and 6 are worth an issue before region three.

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
5. **The guest mechanic is not yet "data only" for a shipped guest.** `src/core/state/encounterSpawns.test.ts`
   counts only `allies` as the party's side, so the first shipped `EncounterDef.guests` entry fails it (six cases).
   That is a one-line fix in a `src/core/` test, which this trial does not make, so Veyra uses ADR 0116's `allies`
   shorthand (the same AI guest, at the encounter's level, tagged "Guest"). Swap to `guests` once that test reads
   guests. Also: a guest built from a character kit would join the party-setup roster (no "not playable" flag), so
   Veyra is an enemy record, and since `progression.test.ts` allows zero XP only to `ruon_ally`, it carries a token
   `xp: 1` that is never paid.
6. **Tests pinned to the demo's world.** A second region failed 26 tests in 9 files that hard-code the one-region
   world: the soak matrix's cell count and roster list, the story-graph document list and count, the scaffolder's
   list test, region assets, the region cache ("inert while the start region is the only region"), the precache,
   and the core bench, which adds every board tied for the largest combat grid and demands frozen limits for it
   (RG-02's boards are 19 columns, not 20, to stay out of it). Each was updated to the new truth, none loosened, but
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
   digit. Placeholder tuning is easy: the winch fight wins 100% in about 2 rounds at every size on Story, and
   SF-2.1 wins 67% at three players on Hard.
10. **Map painting packs for every map.** `prompts.test.ts` still demands an orthographic painting pack (ADR 0009)
    per map, written in `scripts/art/map-pack.ts`. Top-down regions do not use it; it should be scoped to maps with
    a `backdrop`, or retired.
11. **The Ba Dan presentation test read only the shared registry.** It now reads node-declared presentations too
    (the ADR 0111 way); the assertion is unchanged.
12. **Things the script needs that the engine lacks** (not built here, as briefed): the winch objective
    (`claude/objective-hold`; TODO in `encounters.ts`), fight barks for Veyra, an in-fight line on a combo event
    ("the first time a puddle sparks"), a live line that shocks the wet ground beside it, the handlers yielding at
    low health, and a drifting stall.
13. **The region-graph progression walk.** The XP walk stops at Act I's end, so RG-02's fights are not walked. A new
    check holds every Act I route, won or lost, inside RG-02's band on arrival, and `bands.ts` holds both fights to
    the band; walking a region's own fights waits for the ADR 0011 rewrite.

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
- The winch fight's tip.
- The market's objective text, three states (before the bowl, carrying it, after the vote).
- Three enemy descriptions (freight handler, line rigger, Veyra).
- Not marked, written plainly and to be checked: Emberwatch's and the power yard's objectives, the maps' names and
  exit labels, and the "The party" speaker label.
- Missing from the script and so not shown: SF-2.1's "the riggers put down their cutters" and the carry-on
  narration ("they get away over the wall with one coil"), which the script gives as prose, not lines.
