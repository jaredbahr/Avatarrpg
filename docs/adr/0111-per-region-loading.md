# ADR 0111: Regions as the unit of content, loading and budgets

**Status:** §1 (the region manifest) and §2 (per-region loading) accepted, 2026-11-14. §3's
current behaviour is unchanged; its proposal for later regions and §4 (budgets) wait for the owner;
the budget gates change only when the owner accepts §4. Builds on ADR 0011 (regions in the world model), ADR 0076 (asset families), ADR 0104
(top-down scenes as assets), ADR 0108 (area music) and ADR 0109 (the JS budget). Answers "Scale and
saves" in `docs/pipeline-proof-plan.md`.

## Context

The owner decided on 2026-11-14 that, before any trial region, the game needs a per-region manifest,
per-region loading and a rethought audio budget, so it can grow into a long saga.

Measured on `main` at `d24dc58`:

- One JS bundle: the entry chunk at 378.7 KB gz plus Pixi's lazy `browserAll`, 382.8 of the 410 KB
  budget. `src/content` is about 59 KB gz of it (estimates from `npm run bundle:report`): story
  14.9, abilities 9.5, assets 6.1, maps 5.4, residents 2.6.
- All five top-down scenes are fetched before the app boots (`loadTopDownPresentations`).
- Audio is 3.35 of 4 MiB, of which the four music loops are 3.19 MiB; the next area track (0.5 to
  1.1 MB at ADR 0108's 96 kbps) breaks the family budget.
- A region touched about twelve registration points (`ALL_MAPS`, `ALL_STORY`, `connectAct1`,
  residents, encounters, `STORY_GROUPS`, `TOPDOWN_SCENES`, `TOPDOWN_LAYOUTS`, `MAP_MUSIC`, ...).

## Decision

### 1. The region manifest

A region is one folder under `src/content/regions/<id>/` (types in `src/content/regions/types.ts`):

| File          | Type              | Holds                                                                                                                              | Ships                |
| ------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `manifest.ts` | `RegionManifest`  | id, name, `mapIds`, `neighbours`, music rows, top-down scene sources                                                               | always, at boot      |
| `content.ts`  | `RegionContent`   | maps (with their connections applied), story files (`storyGroups`), voiced story, encounters, anchors, residents, background roles | with the region (§2) |
| `layouts.ts`  | `TopDownLayout[]` | what the content validation checks and the ground packer bakes                                                                     | never (CI, packer)   |

Three lists register a region, one line each, in region order: `REGIONS` (`regions/index.ts`),
`REGION_CONTENT` (`regions/content.ts`) and `REGION_LAYOUTS` (`regions/layouts.ts`). Everything
that used to be a registration point is now built from them: `ALL_MAPS`, `ALL_STORY`, the
encounters, anchors, residents and background roles in `CONTENT`, `STORY_GROUPS` in the story
diagrams, `TOPDOWN_SCENES`, `MAP_MUSIC` and `TOPDOWN_LAYOUTS`. Shared content (abilities,
characters, disciplines, enemies, statuses, surfaces, props, combos, tuning, the asset manifest)
stays in the core.

`regions.test.ts` holds the contract: every folder is registered in all three lists in the same
order; a manifest's `mapIds` equal its content's maps; music, scene and layout rows name only the
region's own maps; every map, story node, encounter, anchor, resident and role belongs to exactly
one region; a region's story is its story files in order; the story entry is in the start region;
and **a region's records name only its own records and its declared neighbours'** (exit targets,
story links, NPC and trigger nodes, encounter boards, anchor maps). That last rule is what makes §2
safe.

**The demo is one region, `ba_dan_valley`.** Its main story (`act1.ts`) and the walk home
(`return.ts`) each run the whole route, and the rules read the story in order in a few places
(`exploreNodeFor` takes the first explore node listed for a map; `startBattle` the first battle
node for an encounter). Splitting the files by map would reorder the story and change play, and
the demo's behaviour must stay byte-identical. A region boundary is drawn where the story is
authored: the next region gets its own story files from its first beat.

**Migration was byte-identical.** The full content index, `TOPDOWN_SCENES`, `MAP_MUSIC`,
`TOPDOWN_LAYOUTS` and `STORY_GROUPS`, serialised to JSON, are the same bytes before and after
(605,710 bytes each); the progression, golden-save, continuity and determinism tests pass
unchanged.

### 2. Per-region loading

**Chunks.** Each region's `manifest.ts` has `load: () => import('./content')`, so the bundler puts
the region's data in a chunk of its own, named `assets/region-<folder>-<hash>.js`
(`chunkFileNames` in `vite.config.ts`). The shared half of the index (`src/content/core.ts`) and the
manifests stay in the boot chunk. `src/content/index.ts`, the full index, is for tests, scripts, the
balance report and the dev-only validator; `src/app/regions.test.ts` fails if any shipped module in
`src/app`, `src/render` or `src/main.ts` imports it, a region list, or anything a region's
`content.ts` imports.

**The store.** `RegionStore` (`src/app/regions.ts`) owns the one `ContentIndex` the app hands every
rules call: the core fields, plus region maps it fills **in place** as regions load. A region loads
with its neighbours (data and top-down scenes, in parallel); a region is ready when it and every
neighbour are in. Loaded regions are never removed. After each load the region maps are refilled in
`REGIONS` order, so any set of loaded regions iterates as the full index does with the others left
out: a first-match read gives the full index's answer whenever that answer is in a loaded region,
which §1's neighbour rule guarantees for everything the current region can name. A failed fetch is
forgotten so the next request tries again; a failed scene draws its region's bare boards, as a failed
scene did at boot before.

**When regions load.**

| Moment                             | What waits                                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Boot                               | The autosave's region (the start region when there is none), before `App`                                                                   |
| Title showing                      | The start region is fetched in the background, for New game and the preview                                                                 |
| New game, riverside preview        | The start region, if not yet in                                                                                                             |
| Load a save (slot, file, Continue) | The save's region (and its battle board's), before reconciling it                                                                           |
| Every command                      | `App.dispatch` runs nothing until the party's region is ready; after it, the party's (possibly new) region and its neighbours start loading |

With everything ready each of these is synchronous, as before; otherwise the app shows "Loading the
next area…" and runs the action when the region is in. `src/core/` is unchanged and stays pure: it
reads what it is handed.

**Determinism.** The rules see the same records for the same command, so the same seed and commands
give the same events. Tests, replays, the balance report and the golden saves use the full index.

**Measured (demo):** the boot chunk went from 369.9 to 349.9 KB gz (`check-bundle-size.mjs`); the
`ba_dan_valley` chunk is 21.9 KB gz; total JS 384.7 KB gz (was 382.8: the split costs about 2 KB of
gzip context). Still in the boot chunk and region-specific, for a follow-up: story presentations and
interludes, discovery markers, followers, journal notes, Ba Dan's routines and canal bridge
(about 4 KB gz), which `src/app` imports by name.

### 3. Caching and offline

**Today nothing changes:** the demo is one region and it is the start region, so its chunk
(`**/*.js`) and its scenes and boards (`art/topdown/**`) stay precached and the game plays offline
after a first visit. Music still streams (ADR 0108).

**Proposed for the next region** (owner decision, below): the start region is precached; every other
region's chunk (`assets/region-<folder>-*`) and art are left out of the precache
(`scripts/precache.mjs`) and cached by the service worker on first fetch (workbox `CacheFirst`), so
a tablet plays offline anywhere it has already been. The alternative is to precache every region:
simpler and always offline, but the install grows with the saga.

### 4. Budgets (proposed; the owner decides)

One total per kind grows with every region and would need raising each time. Proposed instead: a
budget for what the core ships and one per region. **For the demo's one region every proposed cap
adds up to today's number**, so nothing grows today; each new region then brings its own caps
instead of a raise. Measured on this branch:

| Gate                 | Today (rule, number)                       | Proposed (rule, number)                                       | Demo now             |
| -------------------- | ------------------------------------------ | ------------------------------------------------------------- | -------------------- |
| JS per session       | all shipped JS ≤ 410 KB gz                 | boot JS + the largest region chunk ≤ **410 KB gz**            | 362.8 + 21.9 = 384.7 |
| JS per region        | (none)                                     | each region chunk ≤ **40 KB gz**                              | 21.9                 |
| Top-down art, shared | `topdown` family (boards included) ≤ 6 MiB | `topdown` family without region boards ≤ **4.5 MiB**          | 3.27 MB              |
| Top-down art, region | (in the family)                            | each region's boards (its scenes' folders) ≤ **1.5 MiB**      | 1.39 MB              |
| Audio, sound effects | `audio` family (all sound) ≤ 4 MiB         | sound effects ≤ **0.5 MiB**                                   | 0.16 MB              |
| Audio, shared music  | (in the family)                            | music no region plays (the title) ≤ **0.75 MiB**              | 0.53 MB              |
| Audio, region music  | (in the family)                            | each region's area music ≤ **2.75 MiB**                       | 2.66 MB              |
| Precache             | ≤ 25 MB                                    | unchanged, ≤ **25 MB** (core plus every precached region, §3) | 10.43 MB             |
| Other art families   | 4 MiB each; units 8.5; maps 6              | unchanged                                                     | unchanged            |

(The caps are MiB, as the scripts have always measured; the report prints them as "MB".)

The draft PR that carries this section implements exactly these gates in
`scripts/check-bundle-size.mjs` and `scripts/check-asset-budget.mjs`; a region's files are found
from its manifest (`scripts/region-assets.ts`). Until the owner agrees, `main` keeps today's gates
and only reports the per-region numbers.

**The audio rethink.** Music is most of the audio (3.19 of 3.35 MiB) and the reason it is out of
room. With the split above, each region carries up to 2.75 MiB of its own music, streamed and never
precached, so the next region's track does not break anything. Two further options, for the owner's
ear rather than for the budget: shorter loops (the Ba Dan loop is 90 s, the title 45 s), or HE-AAC at
about 64 kbps, roughly a third smaller per track, which ADR 0108 did not try. And music is not
cached for offline play today (ADR 0108); caching each track on first play would make a visited
region's music play offline too.

### Decisions for the owner

1. **Budgets:** accept §4's structure and numbers (the draft PR), change them, or keep the totals.
2. **Offline for later regions:** precache every region (simple, the install grows with the saga) or
   only the start region, with later regions cached on first visit (§3). The demo is the start region
   either way.
3. **Music:** keep 96 kbps and per-region caps, or try shorter loops or HE-AAC; and whether music
   should be cached for offline after its first play.

## Consequences

- Adding a region is a folder and three list lines; no file outside `src/content/regions/` names a
  region's records to register them.
- The rule that a region names only itself and its neighbours constrains authoring: a story link
  two regions away needs a node in between, or the regions declared as neighbours.
