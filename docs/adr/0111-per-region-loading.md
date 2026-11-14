# ADR 0111: Regions as the unit of content, loading and budgets

**Status:** §1 (the region manifest) accepted, 2026-11-14. §2 (per-region loading), §3 (caching and
offline) and §4 (budgets) are proposed and land in their own PRs; §4 changes budget rules and waits
for the owner. Builds on ADR 0011 (regions in the world model), ADR 0076 (asset families), ADR 0104
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

### 2. Per-region loading (proposed)

To land in its own PR; this section is filled in there.

### 3. Caching and offline (proposed)

To land with §2.

### 4. Budgets (proposed, owner decision)

To land as a draft PR; no budget number or rule changes before the owner agrees.

## Consequences

- Adding a region is a folder and three list lines; no file outside `src/content/regions/` names a
  region's records to register them.
- The rule that a region names only itself and its neighbours constrains authoring: a story link
  two regions away needs a node in between, or the regions declared as neighbours.
