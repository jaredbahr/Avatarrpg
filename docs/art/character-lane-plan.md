# Character lane plan (2026-10-12)

Inventory of every Ba Dan resident and returnee sprite, which are placeholders, and the plan to replace them with characters from the house generator. Line links point at the code as of main on 2026-10-12.

## Scope and source gap

This is a read-only inventory of the current branch, `3959ae69`.

Two explicitly requested recipe sources are not present in this checkout:

- `media/model-sheets/kaya/CANON.md`
- `media/party-consistency/tone/tone.py` and `params.json`

`media/` contains only `media/art-sources/`. The checked-in integration script nevertheless records that Sura and Bo use the frozen tone step while Kaya is intentionally untoned ([g-sprites.ts](../../scripts/art/g-sprites.ts:5)). Exact tone parameters cannot be reconstructed responsibly from this branch.

## Inventory

Directions use E, NE, N, NW, W, SW, S, SE. Default one-tile frames are 128×192 with an 85% foot baseline; the art contract requires transparent gutters and no baked floor or shadow ([art-bible.md](../../docs/art-bible.md:62), [art-bible.md](../../docs/art-bible.md:130)).

### Ba Dan residents

| Visible character/role                      | Definition and current art                                                                                                                                                                                                                                | Construction and available motion                                                                                                                                                      | Draw scale / gaps                                                                                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mira; also riverside Mira and shrine figure | `npc.elder` → `public/art/npcs/mira.png`; manifest [lines 416–423](../../src/content/assets/manifest.ts:416), village binding [lines 101–107](../../src/content/maps/village.ts:101)                                                                      | Older generated illustrated style; one static 256-square idle, no directional clips. The same sheet is reused by the optional shrine figure and by Dema, the road keeper.              | 1.5× on an oblique map ([exploreMarkerScale.ts](../../src/app/scenes/exploreMarkerScale.ts:5)). Walking schedules move a still image.                     |
| Gao                                         | `npc.shopkeeper` → `public/art/npcs/gao.png`; village binding [lines 109–156](../../src/content/maps/village.ts:109)                                                                                                                                      | Older generated illustrated style; static 256-square idle. Reused by Sen, the tea keeper.                                                                                              | 1.5×. No idle loop, walk, work, or turn clips.                                                                                                            |
| Pella                                       | `npc.kid` → `public/art/npcs/pella.png`; village binding [lines 158–167](../../src/content/maps/village.ts:158)                                                                                                                                           | Older generated illustrated style; static 256-square idle.                                                                                                                             | 1.5×, but the packed child occupies only 58% of a tile-height contract ([npc-idles.md](../../docs/art/npc-idles.md:21)). No directions or motion.         |
| Dorin                                       | `npc.dorin` → `public/art/npcs/dorin.png`; village binding [lines 169–175](../../src/content/maps/village.ts:169)                                                                                                                                         | Older generated illustrated style; static 256-square idle, reused for his riverside drill.                                                                                             | 1.5×. Schedule describes handover, walking and drill activity, but the image remains still.                                                               |
| Hanru                                       | `npc.hanru` → procedural `villager/nonbender/guard`; manifest explicitly marks it temporary ([manifest.ts](../../src/content/assets/manifest.ts:424)); village binding identifies it as placeholder ([village.ts](../../src/content/maps/village.ts:177)) | **Placeholder.** Procedural figure poses, not a shipped atlas. Painter supports its generic idle/walk/action pose vocabulary, but it is not an authored identity or directional G set. | 1.4× in oblique exploration specifically to bring the oversized placeholder down ([exploreMarkerScale.ts](../../src/app/scenes/exploreMarkerScale.ts:8)). |
| Midday relief watch                         | `npc.guard` → procedural earth villager guard ([manifest.ts](../../src/content/assets/manifest.ts:424)); role [baDan.ts](../../src/content/residents/baDan.ts:328)                                                                                        | **Placeholder stand-in.** Procedural pose set, no atlas.                                                                                                                               | 1.4×. Generic appearance is safe to generate without establishing a named identity.                                                                       |
| Pella’s household adult                     | `npc.household` → procedural earth villager ([manifest.ts](../../src/content/assets/manifest.ts:428)); role [baDan.ts](../../src/content/residents/baDan.ts:338)                                                                                          | **Placeholder stand-in.** Procedural pose set, no atlas.                                                                                                                               | 1.4×. Explicitly unnamed and says nothing about family relationships.                                                                                     |
| Bo-shan and Hesra                           | Both reuse `npc.household`                                                                                                                                                                                                                                | **Placeholder and shared sheet.** No distinct portrait; narrator portrait is also substituted.                                                                                         | 1.4×; no authored clips.                                                                                                                                  |
| Leto                                        | Reuses `npc.guard`                                                                                                                                                                                                                                        | **Placeholder and shared sheet.**                                                                                                                                                      | 1.4×; no authored clips.                                                                                                                                  |
| Amri and Senn                               | Reuse `npc.hanru`                                                                                                                                                                                                                                         | **Placeholder and shared sheet.**                                                                                                                                                      | 1.4×; no authored clips.                                                                                                                                  |

All five returnee substitutions are declared explicitly as `placeholder: true` ([returnees.ts](../../src/content/residents/returnees.ts:33)). Their village bindings are at [village.ts lines 209–235](../../src/content/maps/village.ts:209).

The four finished resident images were generated from approved portraits and packed as single static idles; the repo expressly says they have no animation clips ([npc-idles.md](../../docs/art/npc-idles.md:1)). Their source descriptions establish:

- Mira: elderly, white bun, green/ochre shawl, pendant, walking stick.
- Gao: older round merchant, cap, beard, green tunic, cream apron, abacus, peppers and waterskins.
- Pella: nine-year-old child, dark pigtails, patched green sash, cabbage.
- Dorin: lanky young guard, tousled hair, wispy moustache, oversized green coat, spear.

These descriptions are pinned in [npc-idle-prompts.json](../../docs/art/npc-idle-prompts.json:2).

### Player party

All ten can be seen in Ba Dan depending on party selection. Their content bindings are in [characters.ts lines 116–231](../../src/content/characters.ts:116), and their manifest entries are at [manifest.ts lines 349–360](../../src/content/assets/manifest.ts:349).

| Characters                  | Current atlas                                                                                                      | Motion and frame counts                                                                                                                                                                                                                                                               | Style / scale / papered-over gaps                                                                                                                                                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kaya, Sura, Bo              | `<name>-g.webp/json`, pages `-2`, `-3`, `-4`, bend page and clip data; Kaya/Sura also have a legacy riverside page | All 8 headings: idle 4, walk 12, rest 1, stance 8. Directional hit 4 per heading. KO 7 in four diagonals. Bend: Kaya and Bo 11 per heading; Sura 9–10 due to rejected/missing source cels. Legacy cast 3 and legacy KO 1 remain on page 1. Kaya/Sura wave 2 and tea 2 are older cels. | G style, 128×192, 128 px/tile, anchor .5/.85, `facing: both`; drawn at 1.25× in oblique play ([actorScale.ts](../../src/app/anim/actorScale.ts:4)). **Missing:** genuinely directional G attack/cast; current cast, wave and tea are older illustrated art.                           |
| Tenzo, Nilak, Lin Mei, Jinu | `walking-<name>.png/json`, each 1024×576                                                                           | Side idle 2 and walk 4; N/S idle 1 and walk 4; cast 3; KO 1. Side art is mirrored for the opposite side.                                                                                                                                                                              | Older illustrated style, 128×192, 1.25×. **Missing:** NE/NW/SE/SW; directional casts; hit; bend; animated KO. Hit becomes idle plus recoil/flash, melee borrows cast, and missing diagonals fall back to cardinal clips ([resolveClip.ts](../../src/render/sheets/resolveClip.ts:1)). |
| Nima, Wen                   | Same older `walking-*` atlases, 1024×576                                                                           | As above, plus rest 1 for side, north and south.                                                                                                                                                                                                                                      | Same gaps as the preceding group.                                                                                                                                                                                                                                                     |
| Riko                        | `walking-riko.png/json`, 1024×576                                                                                  | Same four-direction locomotion; cast 3, KO 1; melee side 2 and one N/S contact cel.                                                                                                                                                                                                   | Older illustrated style. **Missing:** hit, diagonal directions, full directional melee and animated KO. Side melee already aliases/reuses cast pixels ([manifest.ts](../../src/content/assets/manifest.ts:142)).                                                                      |

The older directional sheets’ source recipe and importer are documented at [directional-character-walks.md lines 21–37](../../docs/art/directional-character-walks.md:21).

### Early enemies and quarry machine

Enemy definitions and sprite keys are centralized in [enemies.ts](../../src/content/enemies.ts:24); encounter order starts with the forest-road fight at [encounters.ts](../../src/content/encounters.ts:31).

| Character                 | Atlas and clips                                                                                    | Style / size / scale / gaps                                                                                                                                                                                                                                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bandit/thug               | `thug-g.webp/json`, 2048×1344. All 8 headings: idle 4, walk 8, rest 1; legacy cast 3, hit 1, KO 1. | G locomotion, older illustrated actions. 128×192; 1.25×. **Missing:** directional G attack, hit and KO.                                                                                                                                                                                                                           |
| Slinger                   | `slinger-g.webp/json`, 2048×1344; same counts as thug.                                             | Same mixed construction and gaps.                                                                                                                                                                                                                                                                                                 |
| Bruiser                   | `bruiser-g.webp/json`, 1920×1920; same counts, but 160×192 frames for club reach.                  | Same mixed construction and gaps.                                                                                                                                                                                                                                                                                                 |
| Quarry bender             | `quarrybender-g.webp/json`, 2048×1344; same counts.                                                | Same mixed construction and gaps; no bend-body clip, only legacy cast plus separate effects.                                                                                                                                                                                                                                      |
| Fire deserter             | `deserter.png/json`, 1152×192: idle 2, walk 2, cast 3, hit 1, KO 1.                                | Older illustrated, one mirrored side direction, 128×192. Missing all directional motion and bend-body work.                                                                                                                                                                                                                       |
| Blade mercenary           | `merc.png/json`, 1521×199: idle 2, walk 2, cast 3, melee 2, hit 1, KO 1. Frame 169×199.            | Older illustrated, mirrored side only. Melee is authored but no directional variants.                                                                                                                                                                                                                                             |
| Crossbow mercenary        | `crossbow.png/json`, 1152×192: idle 2, walk 2, cast 3, hit 1, KO 1.                                | Older illustrated, mirrored side only. It is separately scaled 1.23× to compensate for its shorter body ([actorScale.ts](../../src/app/anim/actorScale.ts:9)).                                                                                                                                                                    |
| Sergeant                  | `sergeant.png/json`, 1323×203: idle 2, walk 2, cast 3, melee 2, hit 1, KO 1. Frame 147×203.        | Older illustrated, mirrored side only.                                                                                                                                                                                                                                                                                            |
| Captain Ruon, when allied | `ruon.png/json`, 1251×192: idle 2, walk 2, cast 3, melee 2, hit 1, KO 1. Frame 139×192.            | Older illustrated, mirrored side only.                                                                                                                                                                                                                                                                                            |
| Grumbler quarry machine   | `driller.webp/json`, 1936×528: idle 6, walk 6, attack/cast 8, hit 4, KO 8.                         | Bespoke generated machine animation, not a humanoid G skeleton. 176×176 frames, 80 px/tile, 2×2 footprint, anchor y .8295; 2× oblique compensation ([manifest.ts](../../src/content/assets/manifest.ts:371), [actorScale.ts](../../src/app/anim/actorScale.ts:15)). Mirrored side-only, but its principal action set is complete. |

The mixed G/legacy enemy construction is intentional: the accepted G sets had no G attacks, hits or knockouts, so the previous action cels were copied into the new atlases ([ADR 0062](../../docs/adr/0062-g-quarry-bandits.md:18)).

## Generated frames → shipped asset

The current reliable pipeline is:

1. Create or reuse an approved identity/model sheet. The art bible calls for one 2048×2048 front/side/back/face/swatch sheet per character ([art-bible.md](../../docs/art-bible.md:240)).

2. Generate one clip at a time against that identity, with:

   - low three-quarter top-down view;
   - transparent background;
   - dark-brown line work;
   - readable silhouette at 40 px;
   - no floor, shadow, lettering, watermark or elemental effect;
   - stable costume, anatomy, registration and scale.

   Regeneration is preferred over manually repainting inconsistent frames ([art-bible.md](../../docs/art-bible.md:242)).

3. For a new ordinary generated sheet, place frames under:

   ```text
   art/raw/<asset-key>/<clip>/<zero-based-frame>.png
   ```

   Then normalize:

   ```bash
   npm run art:normalise -- --unit <asset-key> --key alpha
   ```

   This trims one shared scale, aligns the feet to the baseline and writes `art/normalised/` ([normalise.ts](../../scripts/art/normalise.ts:1)).

4. Pack a conventional atlas:

   ```bash
   npm run art:pack -- --unit <asset-key> --name <output-name>
   ```

   This writes `public/art/units/<name>.png` and `.json` and prints the manifest clip block ([pack.ts](../../scripts/art/pack.ts:1)).

5. For existing G party sheets, use the specialized importer instead:

   ```bash
   node --import tsx scripts/art/g-sprites.ts \
     --character <kaya|sura|bo> \
     --source <approved-locomotion-directory> \
     --combat <approved-combat-directory>
   ```

   It scales root-locked 192 px cels to 75%, encodes quality-90 WebP pages, requires checked SHA-256 source pins, and records decoded-cel pins ([g-sprites.ts](../../scripts/art/g-sprites.ts:5)).

6. For the existing G enemy family:

   ```bash
   node --import tsx scripts/art/bandits-g.ts --import <approved-source> --unit <name>
   node --import tsx scripts/art/bandits-g.ts --unit <name>
   ```

   The first command imports and pins selected toned cels; the second reproduces the shipped sheet ([bandits-g.ts](../../scripts/art/bandits-g.ts:7)).

7. Register the sheet in `ASSETS` in `src/content/assets/manifest.ts`, including atlas pages, exact frame size, anchor, direction support and clip counts. NPC conversion additionally changes the relevant `npc.*` entry from `image`/`painter` to `sheet`; the content map need not change if the asset key stays stable.

8. Validate:

   ```bash
   npm run art:validate
   npm run build
   npm run check:assets
   npm run ci:local
   ```

   `art:validate` checks manifest pages, required frame names, duplicate/missing cels, texture bounds, alpha gutters, baseline/registration and source pins ([validate.ts](../../scripts/art/validate.ts:905)). The asset budget is checked after a build because precache measurement requires `dist/` ([check-asset-budget.mjs](../../scripts/check-asset-budget.mjs:95)). Device QA at intended size remains manual.

The art bible refers to obsolete `.mjs` normalise/pack filenames at lines 244–246; the actual package commands and checked-in implementations are TypeScript ([package.json](../../package.json:28)).

## Ordered generation plan

Because only about 0.79 MiB remains, “expected size” below is a target compressed shipped cost, not permission to land every job together. Generate and review in this order; packing should happen in small, budget-measured batches.

|   # | Job and reason                                                                                            | Appearance brief                                                                                                                                                            | Directions and clips                                                                  | Motion source                                                             | Expected shipped units cost; integration                                                                                                                   |
| --: | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | Unnamed household adult — replaces a prominent courtyard placeholder without establishing a named design  | Practical rural adult in muted earth greens/ochres, work tunic, apron or overshirt, simple trousers and shoes; basket/household chore silhouette; no family-specific emblem | 8-dir idle 4, walk 8, rest 1                                                          | Existing enemy-G 4/8/1 skeleton and root-lock contract                    | ~180–240 KiB WebP+JSON. Change `ASSETS['npc.household']`; preserve `RETURNEE_PRESENTATIONS` temporarily.                                                   |
|   2 | Generic relief watch — removes the second procedural village figure                                       | Anonymous rural watch member, sturdy coat, plain spear, practical cap, no distinctive named-person face or insignia                                                         | 8-dir idle 4, walk 8, rest 1                                                          | Same 4/8/1 G skeleton; wider frame only if spear violates gutter          | ~200–280 KiB. Change `ASSETS['npc.guard']`; background role already points there.                                                                          |
|   3 | Mira motion — the first required conversation and daily village focal point                               | Preserve the approved white bun, lined face, shawl, pendant, stoop and walking stick exactly                                                                                | 8-dir idle 4, walk 8, rest 1; no combat                                               | G resident locomotion derived from the 4/8/1 skeleton, with slower timing | ~170–230 KiB. Replace `ASSETS['npc.elder']`; Dema/shrine reuse should be broken at the same time by adding separate keys or deliberately left and flagged. |
|   4 | Gao motion — persistent shopfront activity                                                                | Preserve cap, beard, green rolled sleeves, cream apron, abacus, peppers and waterskins                                                                                      | 8-dir idle 4, walk 8, rest 1; optional two-frame work idle only after locomotion fits | Same resident skeleton                                                    | ~180–240 KiB. Replace `ASSETS['npc.shopkeeper']`; add a separate old-static key for Sen if he must not inherit Gao.                                        |
|   5 | Pella motion — high-visibility courtyard character                                                        | Preserve child proportions, pigtails, patched sash and cabbage; compact steps, never adult proportions                                                                      | 8-dir idle 4, walk 8, rest 1                                                          | G skeleton retargeted to child stride; use her existing 58% height        | ~140–200 KiB. Replace `ASSETS['npc.kid']`.                                                                                                                 |
|   6 | Dorin motion — gate focal point and riverside drill                                                       | Preserve lanky build, large ears, moustache, green coat, collar key and plain spear                                                                                         | 8-dir idle 4, walk 8, rest 1; stance/drill 4–8 if budget permits                      | Enemy-G skeleton; spear may require a 160-wide frame like the bruiser     | ~220–310 KiB. Replace `ASSETS['npc.dorin']`; both village and riverside bindings update automatically.                                                     |
|   7 | Thug directional action completion — most common body in the first fight                                  | Preserve current ragged, asymmetric bandit identity and palette; no redesign                                                                                                | 8-dir attack 3–5, hit 4, diagonal KO 7                                                | Existing `thug-g` skeleton, registration, pins and locomotion             | ~180–280 KiB additional page. Extend `enemyGSheet()` and `thug-g` clip data rather than replacing locomotion.                                              |
|   8 | Slinger directional action completion — ranged read in the first fight                                    | Preserve lean hood, sling and stone pouch; maintain coherent grip and visible release                                                                                       | 8-dir attack 3–5, hit 4, diagonal KO 7                                                | Existing `slinger-g` skeleton                                             | ~180–280 KiB. Extend `enemyGSheet('slinger')` and the enemy-G importer.                                                                                    |
|   9 | Bruiser directional action completion — strongest first-fight silhouette                                  | Preserve broad build, bald crown, rust rag and heavy wooden club                                                                                                            | 8-dir attack 3–5, hit 4, diagonal KO 7                                                | Existing `bruiser-g` skeleton and 160×192 cell                            | ~220–340 KiB. Extend `enemyGSheet('bruiser')`; retain `frameSize`.                                                                                         |
|  10 | Quarry bender directional action completion — prepares the next mandatory fight without new identity work | Preserve swept-back hair, green head rag/tunic, ochre sash and empty hands                                                                                                  | 8-dir earth-action body 4–8, hit 4, diagonal KO 7                                     | Existing `quarrybender-g` skeleton; separate effects remain authoritative | ~220–360 KiB. Extend `enemyGSheet('quarrybender')` and its importer/clip data.                                                                             |

Jobs 1–2 are intentionally generic stand-ins. Jobs 3–10 preserve existing approved identities; they do not invent a new named appearance.

A full NPC G page could consume roughly the same 240–320 KiB as an existing bandit page. Therefore only two or three of these jobs are likely to fit before retiring or recompressing older sheets. Generation can proceed ahead of that decision, but shipping cannot.

## Owner decisions

These looks should not enter the first generation queue without explicit visual approval:

- Hanru: named, currently has no established character sheet and is expressly a placeholder.
- Bo-shan, Leto, Amri, Hesra and Senn: separately named returnees with no individual sprite or portrait. Their current reuse mapping is temporary.
- Whether Dema should continue looking exactly like Mira.
- Whether Sen should continue looking exactly like Gao.
- Whether the riverside shrine figure is intended to be Mira or a separate person.
- Whether the generic household and relief-watch sheets may continue serving returnees temporarily after their procedural placeholders are replaced.
- Whether the missing `media/model-sheets/kaya/CANON.md` and frozen tone folder should be restored into this worktree or supplied as the authoritative external handoff before new G generation.

## Risks and pinned tests

### Budget

Measured current units files:

- Current: **6,253,289 bytes = 5.96 MiB**
- Limit: **7,077,888 bytes = 6.75 MiB**
- Headroom: **824,599 bytes = 0.79 MiB**, about **11.6%**

The limit is defined at [check-asset-budget.mjs line 16](../../scripts/check-asset-budget.mjs:13). This is less than four typical G character pages and may be less than three once JSON and wider weapon frames are included.

`npm run check:assets` reported the units figure correctly, but the command did **not** complete successfully because this checkout has no `dist/`; it stopped with “run `npm run build` first.” No budget success is claimed.

### Manual points

- Selecting good generated takes, judging identity consistency, anatomy, grip, gait and game-size readability.
- Measuring root travel and choosing rest frames.
- Deciding when a weapon needs a wider cel.
- Applying the unavailable frozen tone recipe.
- Creating/updating source hashes and pins.
- Visual review on both renderers and on target devices.
- Resolving shared NPC keys before a replacement unintentionally changes two named people.
- Updating credits and source provenance.

### Tests and data that pin contents

- `scripts/art/g-sprites.test.ts`: source pin coverage, placements and reproducibility.
- `scripts/art/thug-g.test.ts`: frozen tone-manifest and exact source hashes.
- `scripts/art/validate.test.ts`: atlas names, margins, registration and decoded-cel pins.
- `scripts/art/cutting-characters.test.ts`: optional fighter atlas contents.
- `src/render/sheets/atlasHeadroom.test.ts`: sheet bounds/headroom.
- `src/render/sheets/store.test.ts`: page and clip-data loading.
- `src/render/sheets/resolveClip.ts`: the explicit fallback behavior that new clips will supersede.
- `src/app/scenes/exploreMarkerScale.test.ts`: current 1.4/1.5 placeholder/image scales.
- `src/content/residents/baDan.test.ts` and resident-motion tests: stable resident identities, sprite bindings and schedules.
- `src/content/content.test.ts`: every referenced asset key must resolve.
- Existing G files are decoded-pixel pinned; repacking at a different WebP setting can fail validation even if the image looks equivalent.

### Actual validation attempted

- Read-only atlas enumeration and byte measurement completed.
- `npm run check:assets` measured all art families but stopped at the missing `dist/` prerequisite.
- `npm run art:validate` could not start because dependencies are not installed: Node could not resolve `tsx`.
- No files were changed, no network operation was performed, and no successful test suite is claimed.
