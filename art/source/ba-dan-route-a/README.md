# Ba Dan Route A (Pixel), round 1: sources and review

Issue #284, Route A: the world in the demo slice redone in the PixelLab rendering, so it follows the G figures. The layout
is kept (locked 2026-10-10) and only the rendering changes. **Nothing here is shipped.** The Ba Dan plates, uprights and
`baDan.art.ts` are untouched; this folder holds sources, a ledger and a static review mock.

## Slice

Tiles **x 0..13, y 0..9** of `src/content/scenes/baDan.ts`, the diamond from tile corner (0,0) to (14,10). Painting px
(1.5 per world px, from the pan box corner (-200,-100)): top (1836,150), right (3180,822), bottom (2220,1302),
left (876,630). It contains Gao's house `gao-house` (6,1) 4x3, the north house's west edge (12,1), the canopy tree
`tree-5-5`, the fruit table `gao-display` (6,5), the bench and fence, the canal y 6 with the bridge (9,6), road rows 7–8,
verges and planted beds. The composition box is painting px x 945..3105, y 0..1320. It covers the slice except for the
last ~70 painting px at the far west and east tips.

## What was generated

| file                                       | what                                                                                                                                         | job                |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `generated/gao-house.png` (468x339)        | Gao's house with its yard, doorway, awning and roof, on the frozen `gao-house` sprite rectangle                                              | `p1-gao-editref`   |
| `generated/canopy-tree.png` (320x312)      | the canopy tree on the frozen `tree-5-5` rectangle                                                                                           | `a1-tree-s11`      |
| `generated/ground-tile-0..5.png` (512x512) | the slice-sized ground composition at world px: grass and verges, paving and road, canal bank and water, and the props baked into the ground | `a2-ground-t0..t5` |
| `generated/rejected/`                      | the probe variants that lost, kept for comparison                                                                                            | see ledger         |

Every image is **1 generated px = 1 world px = 1.5 screen px** at game zoom. Each one is a PixelLab `edit-images-v2` restyle
of the matching crop of the shipped painting, scaled to world px. The house and tree used `edit_with_reference` with the
party strip (Kaya, Sura and Bo idle cels) as the style. The ground used `edit_with_text` (see "Why", below). Seed 11 was
used throughout, plus 23 for the second tree. `tools/style.py` holds the prompts, and `ledger.json` holds every request (images as
input references), its job id, its cost and the verdict.

The material swatches (`review/swatches-4x.png`) are cut from the generated ground composition, not generated
separately. They show what the ground is in context.

## Why this method (the probe)

Probe on Gao's house, judged at 1x and 4x beside Kaya (`review/probe-1-gao-variants.webp`,
`review/probe-2-gao-painting-res.webp`):

- **World px (468 px)** gave a strong restyle with the composition kept. `edit_with_reference` was flattest: 1 px
  `#1b1410`-like contour, 3–5 tone groups, matte, no glints. **Taken.** `edit_with_text` kept more painted mottling.
  `generate-image-v2` (composition reference plus style image) drifted from the layout. `image-to-pixelart-pro` chose a
  216 px grid (3.25x on screen): chunky, so rejected.
- **Painting px (702 px, two tiles)** and **figure density (936 px, four tiles)**: the edit barely changed the painting.
  With the party as reference, it also **pasted ghost copies of the party into the scene**.
- **Two-stage** (restyle at world px, upscale, then a full-resolution "crisp to 1 px" edit): PixelLab snapped back to its
  own coarse grid, so no finer marks.
- **Whole slice with the party reference** (`a1-slice`, 8 tiles): ghost figures all over the ground again, and a weak
  restyle. Rejected. The ground was redone with `edit_with_text`, which never leaked a figure.

So in this tool a restyle strong enough to change the rendering only happens at about world px, and the reference image
leaks its content once the canvas has room for it.

## Composing the mock

`tools/build_mock.py` rebuilds the mock from the committed files and makes no PixelLab calls:

1. The ground tiles are stitched (gain-matched, feathered 64 px overlaps) and scaled x1.5 to painting px by **EPX x2,
   then a 0.75 Lanczos**: the same kind of downsample the G sheets get on screen (128 sheet px per 96 px tile), so edges
   antialias like the figures.
2. The house and tree replace the ground pass inside their **frozen silhouettes** (`geometry/`, rendered by `regions.py
render`; only the front-most owner per `ids.png`).
3. Kaya (8,4) walking south-west, Bo (6,4) idle south-east and Sura (10,7) idle north-west are placed at game scale
   (anchor 0.5/0.85, 0.75 screen px per sheet px, so about 88–91 px tall), with a small contact shadow. They are
   depth-sorted against every frozen upright by `x + y`, exactly as both backends sort.
4. The "current" composite is built the same way from the shipped painting (`quiet.png` ground, `faded.png` uprights):
   same framing, poses and occlusion.

```sh
python scripts/art/ba-dan-regions/regions.py --out .review/regions plan
python scripts/art/ba-dan-regions/regions.py --out .review/regions render
python scripts/art/ba-dan-regions/regions.py --out .review/regions stitch --complete
python scripts/art/ba-dan-regions/regions.py --out .review/regions split
python art/source/ba-dan-route-a/tools/build_mock.py   # -> .review/route-a/
python art/source/ba-dan-route-a/tools/sheets.py
```

The generators (`pl.py`, `tiles.py`, `probe2.py`, `pass1.py`, `pass2.py`) need `PIXELLAB_API_KEY`. They skip a job the
ledger already holds as completed, and they wait out the 20-concurrent-job cap.

## Review files (`review/`)

| file                                              | what                                                                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `mock-route-a-ipad.png` / `mock-current-ipad.png` | 1368x714 at game zoom (1 painting px = 1 screen px), same framing and poses                                 |
| `mock-route-a.webp` / `mock-current.webp`         | the whole composition box (2160x1320), lossless                                                             |
| `sheet-4x-crops.png`                              | current and Route A at 4x nearest: Kaya and doorway, roof edge, baskets, table leg, trunk, bridge with Sura |
| `swatches-4x.png`                                 | grass verge, paving, canal bank and water from the generated ground                                         |
| `check-grid-route-a.webp`                         | the slice's tile grid drawn over Route A (projection check)                                                 |
| `out-ground-composition.webp`                     | the ground composition alone at painting px                                                                 |

## Faults, against #284's four questions (round 1, judged at the game's 1.5 zoom)

**1. Same hand at normal play size? Not yet: closer, but no.**

- Contour, matte tone groups and no glints now match the figures much better than the painting does. The roof, plaster,
  table and baskets lost their gloss.
- **Grain is coarser than the figures.** One generated px is 1.5 screen px, so the contour is 1–2 px where Kaya's is about
  1 px, and the tone clusters (roof tiles, vines, ground patches) are 2–4 px. At 4x this reads as a lower resolution than
  the people. No tested setting gave finer marks with a real restyle (see "Why").
- **The ground is now very flat.** The verges and paving are broad 3–4 tone areas with large blotchy patches. They are
  calm, but emptier than the figures' detail level and than ADR 0083's calm ground. The water lost its depth.
- The six ground tiles were edited separately. Colour is gain-matched, but tone and detail density can differ between tiles.
  The tile joins are at painting x ≈ 696 and 1392, and y ≈ 552, in the composition box; I did not measure them.
- Not every in-slice piece had a dedicated pass. The table, bench, fence, bridge, planters and the north house's edge
  are only as good as the ground pass. Outside the slice, nothing changed.

**2. Could these people use, carry and build these things? No, scale was not addressed.**

- The rendering pass keeps the silhouettes, so the scale faults the diagnosis measured remain: fruit about head-sized,
  oversized baskets, thick table. Route A as briefed ("keep the composition, change only the rendering") cannot fix them.
  A round 2 needs new silhouettes (and repainting their region) for the goods.
- Construction stays readable (supported table corners, door at about 1.3H). Nothing new is broken, but nothing
  improved either.

**3. Does everything sit in this place? Partly.**

- Projection holds: everything inherits the painting's 26.57° geometry, and the tile grid lands on the paving, the
  bridge and the house plinth (`check-grid-route-a.webp`).
- The house and tree registered to their frozen silhouettes by eye. This was not measured with the region gate,
  because the gate needs a whole 1536x1024 region.
- Contact and cast shadows survive from the painting, but flattened: the darker pool under the table and beside the house
  is weaker than before. There is less sign of use (worn earth, joints) on the calmed ground.
- Static only. There is no in-game cutout check (crossing behind and in front), which a static composite cannot prove.

**4. Do the residents and party move like the same game? Not tested.** This round is static art only. The figures are the
shipped G cels (unchanged), with no residents, walk clip or frame strip. That work is shared with Route B (#284 says do it
once).

## Grain ladder (added on request: current | G1 | G2)

Jared's main session relayed a new owner note ("maybe we go more pixelated"), which reopens the 2026-10-06 "never
chunky pixels" rule. It asked for two grains, each with its own single pixel grid and no smooth scaling:

- **G1 "hi-bit":** 1 art px = 1 world px (a ground tile diamond is 128x64 art px; the relayed brief said 64x32, which was wrong).
- **G2 "chunky":** 1 art px = 2 world px (a tile diamond is 64x32 art px).

`tools/ladder.py` builds `review/ladder/ladder-sheet-1x.png` (1368x714 per panel) and `ladder-sheet-4x.png` (4x
nearest crops of those panels). Every panel is shown at **2 screen px per world px**, the nearest integer zoom to the
game's 1.5, so G1 is x2 and G2 x4 nearest-neighbour. The current panel is the shipped painting (Lanczos x4/3, since it is
a painting) with the shipped G cels at exactly 1:1. `ladder-g1-native.png` and `ladder-g2-native.png` are the
compositions at their own art resolution.

|     | world and props                                                                                                      | figures                                                                                                        | figure height         |
| --- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------- |
| G1  | the round-1 world-px art (house, tree, 6 ground tiles), feathered joins                                              | shipped G cels **box-downsampled 2:1 and alpha-thresholded, no PixelLab**                                      | 59 art px (Kaya idle) |
| G2  | new PixelLab **Pro Flash** text edits at native size: house 236x172, tree 160x156, 8 ground tiles of 256; hard joins | G cels box-downsampled 4:1 to 32x48, then **cleaned up by PixelLab Pro Flash** (one cel each, identity prompt) | 30 art px             |

Brief correction: in the shipped game an adult is about 59 world px tall (Kaya's idle is 118 sheet px at 128 sheet px
per 64 px tile; 88–91 screen px at the 1.5 zoom), not 76. So G1 figures are about 59 art px and G2 about 30.

What the ladder shows:

- **On its own grid, G1 is one grain.** World and figures share 1 art px = 1 world px. The "grain coarser than the
  figures" fault above comes from the game drawing the figures at 0.75 screen px per sheet px; on the G1 grid the figures
  lose that extra detail instead. The G1 world is the flat round-1 art, with the same flat-ground and scale faults.
- **G2 is the most uniform by construction.** World and figures come from one tool at one grain and read as one hand at
  1x. Costs: detail goes (the fruit becomes 3–4 px blobs that no longer read as pears or apples; faces are 2–3 px), and
  the 4x crops are plainly retro pixel art, the look the owner ruled out on 2026-10-06 and has now reopened.
- **G2 party legibility** (`review/ladder/ladder-party-legibility.png`, the party at each grain, with head and shoulders
  enlarged): at about 30 art px, silhouettes and element colours still separate the three (Bo's mop and green, Kaya's
  ponytail and red sash, Sura's braid and blue). The **face does not read**: it is a 2–4 px skin patch with no eyes or
  expression, where G1 keeps a readable face and the current cels a clear one. Hands and props are 1–2 px. Sura's
  north-west cel shows her back, so her face is not tested.
- **G2 tiles do not register.** Pro Flash redraws geometry slightly per tile. A feather ghosts the overlaps (a doubled
  table edge and doubled bank stones), so G2 uses hard joins, which leave a visible seam and doubled canal-bank stones
  left of the table. A real G2 pass needs one canvas per region, or inpainting across the joins.
- **Camera consequence.** A pixel route needs an integer zoom. G2 at today's 1.5 zoom is exactly 3 screen px per art px,
  so it fits as is. G1 at 1.5 would mix 1 and 2 px marks, so the camera would have to snap to 1x or 2x (an ADR; it
  touches `Camera.fit` and the pinch zoom).
- **Animation cost.** Only one cel per figure was rebuilt. A G2 party means every cel of every clip goes through the
  same downsample and clean-up (5 generations a cel through Pro Flash; Kaya alone has hundreds of cels), or a free
  box-downsample that is muddier than the cleaned cels. G1 figures need no regeneration: a 2:1 downsample is enough.
  Nothing here tests motion.

The ladder used 102 generations (house 9, tree 6, 8 ground tiles at 9, 3 figures at 5).

## Cost

42 PixelLab jobs, **802 generations** (job usage): 700 for round 1 and 102 for the ladder. The account balance was 9,770
at the start and 7,413.5 at the end, but another session spent from the same account at the same time, so the
difference is not this work's cost. 200 of the 802 went to the rejected `a1-slice` pass.

## The G1 world (owner decision, 2026-10-27)

The owner chose Route A at G1 (#284; ADR 0085), and the whole village was redone in this hand. The order, each step
deterministic after the PixelLab jobs (which are in `ledger.json`):

1. `tools/world.py` reduces the shipped stitched painting (with ADR 0083's calm) to world px (3000 x 1601) and restyles it
   in 28 tiles of 512 px with `edit-images-v2` `edit_with_text`, one prompt (`world/prompt.txt`) and seed 11, with no
   reference image. The tiles (`world/tiles/`) are joined with a 64 px feather. Where the input is the flat page colour
   the generator invented water and foliage with tile-edged steps, so the page colour is put back there (`keep_margin`).
2. `tools/objects.py` clears the eight oversized pieces: `gao-display`, `south-market-display`, `north-market-display`,
   the south and north basket groups (`d1`, `d2`), the shop stack (`d8`), the canal bench (`d12`) and the fence (`d13`).
   The cleared area is each old piece's footprint and silhouette (the geometry before ADR 0085, rendered by main's
   `regions.py render` into `BA_DAN_OLD_WORK`) dilated 6 px, plus its baked shadow wherever it reaches (raw ground over 30
   levels darker than the plain ground around it), minus what other pieces own. Only that area is blanked to the ground
   ring's median, so the generator sees the real ground up to its edge. Then one Pro Flash inpaint per piece
   (`world/inpaint/o4-out-*`), gain-matched to the ground ring and blended 2 px. It then sets in #288's toned G1 objects
   (`objects-288/grain/g1-toned`, copied from PR #288 at `SOURCE_COMMIT`) by their `g1_anchor_px`, with a key-light
   shadow (a pixel h above the base falls 0.35h right and 0.16h down of its foot, one tone), a 1 px contact line and a 1 px
   contour toward `#1b1410` (`CONTOUR` 0.8) to bring the outline toward the world furniture's weight. With
   `--geometry` it points those pieces' frozen sprites at the new silhouettes. Result: `world/world-g1.png`.
3. `tools/regions_back.py` scales that world to 1.5 painting px (EPX x2, 0.75 Lanczos), crops the twelve regions and
   accepts each through `regions.py accept` (gates built from the shipped painting first). All twelve passed without
   `--force`.
4. `sh scripts/art/ba-dan-regions/regen.sh`.

Three earlier clearing rounds are in the ledger as rejected or superseded:

- `o1`: masked only on the silhouettes; the generator redrew the old tables from their own context.
- `o2`: a wide, flat-blanked mask; the generator drew flat ground that showed as straight-edged patches in game.
- `o3`: a dark-island pass over those patches; it also caught the paving joints.

Known faults:

- The new objects are still slighter than the world's own furniture (the bridge rails, the houses' benches and yard
  carts); the contour pass narrows the gap in line weight, not in mass.
- Gao's yard keeps its painted cart and jars: clearing them made the generator invent a structure, and #288's handcart
  is three tiles long (`o4-out-gao-yard-cart`, rejected).
- The projection test pins the three new tables' legs (`pins-g1.json`). Their short sides are about 20 px, so a pair of
  whole-pixel feet fixes them only to about 6 degrees; the shop stack (a rack over crates) has no ground edge to measure.
- Not done here: #288's other families (well, banners, lanterns, laundry line, notice board, handcart, stone lantern,
  trough, planters; `--families`). Each new upright also needs projection pins, so they are a follow-up. The garden kit
  and the untiled house props need a hand layout. Until then the restyled painting keeps its own versions.
- The south display's cleared paving keeps a faint straight edge on its west side; elsewhere the patches read as ground.
- The stitched picture keeps the restyle's feathered tile joins. Every region overlap matches, but nothing was measured
  inside a region.
- A single on-screen pixel grid needs an integer camera zoom (ADR 0085, open).

## Completing Ba Dan (2026-10-27, second round)

See ADR 0085's amendment. Order: `tools/ground.py` (writes `world-g1-ground.png` from `world/world-g1.png`), then
`OBJECTS_BASE=world-g1-ground.png OBJECTS_TAG=o5 tools/objects.py --geometry` (furniture from `objects-g1b/`, families and
the garden kit from `objects-288/families/`), then `tools/regions_back.py` and `regen.sh`. Sources: `world/ground-tiles/`,
`world/inpaint/o5-*`, `objects-g1b/`. Review: `review/village/` (Canvas, tile 36 and 56, before and after, same camera;
`e2e/ba-dan-village.review.ts`).

Known faults: a faint lighter patch can remain on the east road where a post stood; the garden plot reads sparser than the
old painted bed; Gao's yard cart is the painted one; tables still carry #288's arrangement of goods.

## Polish pass (2026-10-27, third round)

Owner: "Do a pass and clean up visuals. Tree roots and other items are off." See ADR 0085's second amendment.

```sh
python art/source/ba-dan-route-a/tools/polish.py --geometry      # world-g1.png -> world/world-g1-polish.png (PixelLab cached in polish/)
WORLD_G1=art/source/ba-dan-route-a/world/world-g1-polish.png python art/source/ba-dan-route-a/tools/regions_back.py
sh scripts/art/ba-dan-regions/regen.sh
```

Run `polish.py` against the geometry as it stands before the pass (`git show 38e271b:art/source/ba-dan-regions/geometry`):
its masks read the piece map `regen.sh` renders from that geometry, and `--geometry` then grows the resized props' rectangles.

| step   | tool                       | what                                                                                                                                                                                                                                                                            |
| ------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| roots  | `roots.py`                 | 14 trunk feet, one Pro Flash inpaint each over the root spread; two retries with a new seed (`SEED`, `EXTRA`) and one stump the generator added filled as lawn (`TOUCH`)                                                                                                        |
| props  | `props.py`, `props_set.py` | lantern posts, banners, notice board, handcart, trough redrawn larger by Pro Flash (seeds 21 and 22, output 0 of seed 21 taken); old props and their shadows lifted, the holes cloned from the ground a whole number of tiles away; bench and fence casts shortened (`reshade`) |
| garden | `garden.py`                | kit, furrows and the see-through box lifted; a guide drawn on the plot's diamond and rendered by one `edit-images-v2` pass (`p1-garden-bed`); the verges around inpainted                                                                                                       |
| paving | `paving.py`                | per-flag calm (median, `CALM`, `FLAG_PULL`, `CHROMA_PULL`), joints and cracks kept; three small inpaints for a post's ghost on the east road                                                                                                                                    |
| rim    | `rim.py`                   | pale ghosts at the page edge to the page colour; the paving behind the north wall redrawn as woods                                                                                                                                                                              |

Review: `review/polish/` (village wide and mid, Canvas, before over after; 2x and 4x crops of each fixed fault from the world).

Known faults after the pass:

- Gao's yard cart is still the painted one.
- The bench and fence keep #288's drawing; only their shadows changed.
- Where a tree's frozen silhouette traced a long root, the tree's upright now carries the grass there (as it carried the root).
- Rim trees whose feet stand behind other canopies were not redrawn (`tree-18-0`, `tree-23-3`, the clumps behind the east and south rims).
- The paving's flag lines are the restyle's own: some flags are irregular, and the calm does not straighten them.

## Grounding pass (2026-10-28, fourth round)

ADR 0093. Owner, relayed: "a lot of items still appear to be floating. Shadows are wrong or non-existent." The objects
`objects.py` and `props_set.py` set in were cast by measuring every pixel's height from the object's lowest row, so an
oblique piece's shadow landed as a flat band below its front feet (Gao's table, the displays, the planters), and
`reshade` had cut the bench's and fence's casts to stubs.

```sh
python art/source/ba-dan-route-a/tools/shadows.py      # world/world-g1-polish.png -> world/world-g1-grounded.png
WORLD_G1=art/source/ba-dan-route-a/world/world-g1-grounded.png python art/source/ba-dan-route-a/tools/regions_back.py
sh scripts/art/ba-dan-regions/regen.sh
```

`shadows.py` lifts those shadows exactly (the masks are deterministic, as `props_set.lift` already used) and casts each
of the 22 objects from its own ground: every column from the lower convex hull of the silhouette's bottom edge, taking
as feet only the columns that reach the piece's footprint (a hanging lantern or a roof's eave is not a foot), along the
same key and tone; then a 1 px contact line under every edge that stands on that ground. A pixel a later polish step had
repainted is capped at the unshaded ground around it, so the lift leaves no pale ghost. The garden plot (repainted by
`garden.py`) is not re-shaded. All six regions passed the gate without `--force`. Before and after of each object:
`art/source/grounding/painted/` (ADR 0093's fault list).
