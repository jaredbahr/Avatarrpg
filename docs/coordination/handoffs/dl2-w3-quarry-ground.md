# Handoff — the quarry floor and gate, re-keyed from the village's accepted plates

Owner: Opus supervisor run, 2026-09-22. Branch `claude/dl2-w3-quarry-ground`,
clone `D:/AvatarRPG-work/dl2-w3-quarry`, based on `03faeef` (origin/main, the
PR #88 merge that landed W2). This is **DL-2 work item W3** from
`SUBSYSTEMS/dl2-ground-language-plan.md`: give the Driller floor and the quarry
gate the same ground language as Ba Dan and the re-keyed forest road, so a
reviewer holding `quarry-battle.png` and `ba-dan-exploration.png` places all
four scenes in one game.

W2 established the mechanism — the village is the only place in the pipeline
where an **accepted** painting is the source of the next one — and W3
generalises it a second time rather than inventing a third source.
**No art was generated in this run.** The plan allowed a fresh six-panel sheet
only if re-derivation could not supply cut stone; it can, and exactly: the
village plaza _is_ limestone paving, so `western-approach-ground.webp`'s
flagstone joints are the correct structure for a quarry's cut floor rather than
an approximation of one.

## What changed

1. **`scripts/art/forest-village-material.ts` generalised.** The crop loading,
   calibration and structure classifier W2 wrote are now `loadVillageCrops()`
   and `bindPalette(crops, table, cropOf, saltOf)`; `loadForestMaterial()` is
   written in terms of them. One addition: a material may name a `joint` tone
   for the darkest slice of its crop (`JOINT_SHARE = 0.05`), which is how §3's
   limestone joint lines `#9a8c72` and cut-stone tool marks `#8a7d66` reach a
   plate. A material naming none falls back to its shadow, which is what the
   two-cut version did — **the forest outputs are byte-identical**, proved by
   re-running `forest-route-ground.ts`, `forest-grass-regions.ts` and
   `forest-exterior-apron.ts` and finding the working tree clean.
2. **`scripts/art/quarry-village-material.ts` (new).** The §3 table for the
   quarry, bound to the same two village crops. Six materials:

   | material    | tones                                             | where it lands                                        |
   | ----------- | ------------------------------------------------- | ----------------------------------------------------- |
   | `limestone` | `#d8cbb0`/`#b3a488` joint `#9a8c72` rim `#efe6d2` | cut floor under the oil pools; the gate terrace       |
   | `block`     | `#cfc2a6`/`#a2957c` tool-mark `#8a7d66`           | the `^`/`A` ledge diamonds                            |
   | `earth`     | `#b39064`/`#8e7049` rim `#c7a87d`                 | the Driller's floor plane; the gate road              |
   | `wear`      | `#a6845a`/`#7a5f3e`                               | rut shoulders, heap rims, the mud patch               |
   | `rut`       | `#8e7049`/`#7a5f3e`                               | the trodden core of a haul track                      |
   | `spoil`     | `#a89880`/`#857762` chip `#c2b49c`                | rubble cells; the gate's off-road ground; floor heaps |

   Two pieces of painted incident live here. `heapMark` places spoil heaps as
   **discrete piles anchored to a cell** chosen by `tileNoise`, offset, sized
   and angularly wobbled by the same hash — thresholding a smooth field was
   tried first and made long snaking blobs, because near its level a smooth
   field's contour wanders. `trackMark` lays a pair of wandering haul tracks
   with a thin trodden core and a wider scuffed shoulder, so the pair draws a
   track rather than merely tinting the plane the way W2's forest ruts did.

3. **`scripts/art/quarry-route-ground.ts` rewritten.** It no longer takes a
   source path. It keeps `kind()` — the cell-to-page routing the spill pass
   established — untouched, and adds a finer `materialOf()` used only for
   painting. That split is the whole re-key: the ledges, the rubble, the oil
   pools and the mud patch each become their own material instead of sharing
   one field with the floor, so every one of them gets a uniform `#1b1410` ink
   edge with a pale rim on its up-screen (lit) side. The smoothstep feather is
   kept for boundaries between two _plain_ floor cells and spent on **which**
   flat tone a pixel takes, never on blending two of them; a ledge face, a
   rubble pile and a hazard pool take a crisp inked edge, which is how the
   reference reads them.
4. **`scripts/art/quarry-modular-ground.ts` rewritten** the same way, so the
   two quarry scenes cannot drift from each other or from the village. Three
   materials across the gate's four registered regions: `limestone` region →
   §3 limestone paving, `road` region → §3 packed earth with the haul tracks
   running down its two rows, `earth-west`/`earth-east` → §3 spoil carrying
   scattered inked heaps of cut stone.
5. **Repacked art.** `driller-floor-scene/`: `dirt-west` 33,922 → 39,424 B,
   `dirt-east` 33,068 → 39,836 B, `stone` 50,252 → 43,512 B.
   `quarry-gate-scene/`: `limestone` 33,832 → 29,930 B, `road` 37,382 →
   18,460 B, `earth-west` 25,840 → 35,840 B, `earth-east` 25,864 → 34,708 B.
   Quarry ground total **240,484 → 241,710 B**, and the map family stays at
   **3.98 of 4 MiB**. WebP quality for these seven plates drops 84/82 → **34**
   (`QUARRY_GROUND_QUALITY`): at 76 the two packs came to 445,504 B and put the
   family 2% over budget, and lowering quality is the first lever the work item
   asked for. There is no photographic texture left to preserve — the plates
   are eleven flat tones and an ink line — and the 1368×912 and 1194×834
   captures below show no visible artefact.
6. **Every registered rectangle is unchanged.** `DRILLER_GROUND_REGIONS` moves
   only its `bytes` fields; `QUARRY_GATE_GROUND_REGIONS` does not move at all.
   No map row, cell key, scene id, collision rule or product code changed, so
   saves are unaffected and `SCENE_IMAGE_CAP = 32` is untouched (no plate added
   or removed).
7. **`scripts/art/quarry-route-ground.test.ts` (new)**, six assertions, all
   read off the pixels that ship: the registered rectangles equal what the
   packers produce; no colour outside the tone table is painted (a gradient
   needs continuous tone to exist, so this is the structural form of "no
   gradient"); every material is used; every 128 px window stays inside 1.25×;
   every plate sits inside 1.3× of a village anchor; every rubble and oil
   diamond carries ink and the ledge mass carries thousands of pixels of it;
   and the encoded bytes equal the files on disk.

**The Cutting was not repacked.** `CUTTING_GROUND_REGIONS` and
`public/art/maps/cutting-scene/` are untouched, as the work item requires;
that is W4.

## Measurements

`npx tsx scripts/art/forest-ground-measure.ts <plate>`; "span" is the ratio of
the brightest 128 px window mean to the darkest, stepped 32 px, windows at
least half opaque. The DL-2 §3 bar is **≤ 1.25×**.

| Plate               | Span before | Span after | Mean before | Mean after | Colour after |
| ------------------- | ----------- | ---------- | ----------- | ---------- | ------------ |
| driller `dirt-west` | 1.027×      | **1.134×** | 154.8       | **140.8**  | `#a88960`    |
| driller `dirt-east` | 1.024×      | **1.121×** | 154.6       | **140.8**  | `#a88960`    |
| driller `stone`     | 1.035×      | **1.229×** | 183.4       | **182.6**  | `#c2b69e`    |
| gate `limestone`    | 1.029×      | **1.084×** | 182.9       | **193.6**  | `#cdc1a8`    |
| gate `road`         | 1.023×      | **1.134×** | 187.5       | **135.4**  | `#a2845c`    |
| gate `earth-west`   | 1.024×      | **1.123×** | 154.7       | **150.7**  | `#a4957e`    |
| gate `earth-east`   | 1.028×      | **1.119×** | 154.7       | **150.5**  | `#a4957e`    |

The spans **rose** and that is the point: the old plates were flat because they
were one smoothly-tiled field with nothing painted on them, which is defect 12
stated as a number. The new spans are the heaps, the tracks and the ink, and
they are still comfortably inside the bar.

**Tone band.** Two anchors, because §3 gives the quarry two families and the
village has been measured two ways:

- The **Driller floor plane** — the ~60% of `14-boss-blast-floor`'s frame the
  acceptance is about — reads **140.8** against the village's recorded
  on-screen ground `#8d9557` = 142.9 (`village-ground-tone.md:46`): **1.015×**,
  well inside 1.3×. The gate road (135.4, 1.055×) and both spoil terraces
  (150.7/150.5, 1.055×) are also inside it.
- The **cut-stone plates** belong against the village's own paving _plate_,
  which is the painting these pixels come from: `western-approach-ground.webp`
  decodes at **187.6**. Driller `stone` is **1.027×** of it and gate
  `limestone` **1.032×**.

The test asserts each plate is inside 1.3× of _at least one_ anchor, which is
what "not a fourth ground family" means. It is **not** true that limestone
paving can also sit inside 1.3× of the on-screen `#8d9557` figure — see "Open".

## Commands, exactly as run

```
node --import tsx scripts/art/quarry-route-ground.ts driller
node --import tsx scripts/art/quarry-modular-ground.ts
node --import tsx scripts/art/forest-route-ground.ts          # byte-identity check
node --import tsx scripts/art/forest-grass-regions.ts         # byte-identity check
node --import tsx scripts/art/forest-exterior-apron.ts        # byte-identity check
npx prettier --write "scripts/art/quarry-*.ts" scripts/art/forest-village-material.ts \
  src/content/scenes/quarryRouteGround.ts docs/art/*.md
npm run art:validate                                   # green
npm run check:assets                                   # green, maps 3.98 MiB
npm run verify                                         # green, 944 tests / 118 files
npx vitest run src/content/scenes/quarryProjected.test.ts src/render/scene.test.ts
npx vitest run scripts/art/quarry-route-ground.test.ts
npx tsx scripts/art/forest-ground-measure.ts <the seven plates, before and after>
npx playwright test -c playwright.gallery.config.ts --project=ipad-webgl \
  -g "14-boss-blast|36-grumbler-portrait|38-crossbow-portrait"
npx playwright test -c playwright.gallery.config.ts --project=surface-webgl \
  -g "21a-quarry-gate|21c-quarry-floor"
```

`21a`/`21c` are declared on the `surface-*` projects only, which is why the
gate needs the second capture line; `grep -n "id: '"` over `e2e/gallery/*.ts`
shows there is no `32-`/`33-` gate beat.

## Capture paths

All in this clone; `gallery/` is git-ignored.

- `gallery/ipad-webgl/14-boss-blast-floor.png` — the Driller floor, the frame
  the acceptance names.
- `gallery/ipad-webgl/36-grumbler-portrait-floor.png`,
  `38-crossbow-portrait.png` — the Cutting, as an unchanged control.
- `gallery/surface-webgl/21a-quarry-gate.png` and `-grid.png`,
  `21c-quarry-floor.png` and `-grid.png`.
- Compared against `evidence/refs/quarry-battle.png`,
  `ba-dan-exploration.png`, the pre-change
  `evidence/gallery-7c0b82a/ipad-webgl-2/ipad-webgl/14-boss-blast-floor.png`,
  and W2's accepted `D:/AvatarRPG-work/dl2-w2-forest/gallery/ipad-webgl/04-board-idle.png`.

## Open, recorded honestly

- **The two-anchor tone band is a reviewer's call, and it is the same one W2
  left open.** §3 specifies packed earth for the floor and limestone for the
  cut stone; limestone's base `#d8cbb0` has luma 203.8, so no mixture of the
  declared limestone tones can average near the on-screen `#8d9557` figure
  (142.9). Closing it would mean drifting a §3 hex, which the bible calls a QA
  failure. The test therefore accepts either anchor and this handoff states
  both numbers. If the reviewer rules that a single anchor must hold, §3's
  hexes need a decision **before** W4 folds the Cutting in on the same table.
- **The gate's spoil terrace reads cooler than `quarry-battle.png`.** §3's
  spoil `#a89880`/`#857762` is a desaturated grey-brown by specification, and
  it is the largest area of that board, so the gate is now warmer than it was
  but still cooler than the reference, whose yard is mostly pale limestone
  paving. The alternative — painting the terrace packed earth and letting ink
  and the ruts alone distinguish the road — was considered and not taken,
  because it removes the road's material contrast. This is a visual-direction
  question for W5, not something the packer should decide.
- **The oil pools still read as grey-blue squares.** That is the runtime
  translucent surface drawn _over_ the page, not the page: the page beneath
  them is now warm limestone, which is why they read lighter than before. The
  `quarry-floor-spill-ground.md` tradeoff note still stands and the liquid
  material remains a separate decision.
- **No before/after pixel-difference capture was taken.** W2 used
  `playwright.route-tone.config.ts` plus `scripts/route-tone-compare.mjs` to
  show that only the intended board moved. I did not run it here; the
  structural argument is that only `public/art/maps/driller-floor-scene/` and
  `quarry-gate-scene/` changed and no product code did, and `npm run verify`'s
  944 tests are green — but that argument is weaker than a measured 0.00% on
  the other boards, and it is the obvious thing to add if the reviewer wants
  it.
- **The ledges above the combat camera's clamped frame were not reviewed.**
  The `^`/`A` mass now carries cut-stone block face and an ink outline on the
  plate, and the test asserts the ink is there, but only the rim that falls
  inside `14-boss-blast-floor` was looked at. A party-walk capture at play zoom
  remains the honest way to review them, as `quarry-floor-spill-ground.md`
  already said.
- **The Driller floor still has no working furniture** — no crane, rails, carts
  or dressed stone. The spoil heaps are ground decoration, not props, and
  nothing here claims to close that gap.
- Not claimed: no playthrough, no listening, no physical device, no Large-text
  check, no WebKit run, no canvas-backend capture of the floor, and no reviewer
  judgement — W5 is the gate that decides whether the four scenes read as one
  game, and this is two more of its four inputs.

## Next action

Review the draft PR against `quarry-battle.png` and against W2's accepted
forest frame. If the two-anchor reading of the tone band is accepted, W3 is
complete and **W4** can fold the Cutting in with
`node --import tsx scripts/art/quarry-route-ground.ts cutting` — the packer
already supports it, and the only extra work is re-pinning
`CUTTING_GROUND_REGIONS` and re-checking the asset budget, which has about
21 KB of headroom left. If a single anchor is required, decide the §3 hexes
first.

## CI cost

No push to `main`, no workflow dispatch, no re-run. One branch push and one
**draft** PR; auto-merge was not enabled. Local only: one `npm run verify`,
two short gallery captures (five beats plus one re-shoot).
