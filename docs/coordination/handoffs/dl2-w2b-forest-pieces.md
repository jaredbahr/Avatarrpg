# Handoff — the forest's remaining pieces, re-keyed to the same hand

Owner: Opus subagent run, 2026-09-22. Branch `claude/dl2-w2b-forest-pieces`,
clone `D:/AvatarRPG-work/dl2-w2b-forest`, based on `03faeef` (origin/main, the
PR #88 merge that landed W2). This is **DL-2 work item W2b**, the small pass
W2's own "not done" list asked for
(`dl2-w2-forest-road.md:179-185`): `pond-bank.webp`, `raised-shelf.webp` and
`rubble.webp` still carried the four-quadrant forest atlas's ochre and cold
grey, so on a board whose road and verges had moved to the village's hand they
were the odd material. **No art was generated in this run**; every pixel below
comes from `forest-village-material.ts`, which re-derives the forest's ground
from the two approved Ba Dan plates.

## What changed

1. **`scripts/art/forest-village-material.ts`** gains the rest of the DL-2 §3
   table as `FOREST_PIECE_TONES`, held apart from `FOREST_GROUND_TONES` so the
   route plate's "no colour outside the table is painted" test keeps testing
   three materials rather than seven.
   - `margin` `#8e7049`/`#7a5f3e` rim `#b39064` — the §3 water margin's **damp
     margin** over the road's own packed-earth shadow, so the pond's dry ring is
     the road's family gone damp rather than a fourth earth.
   - `bed` `#2a5e77`/`#1a3a4c` rim `#7ec8e3` — the §3 **bed** with a deeper
     second flat tone; the pale entry is the §3 waterline **edge**.
   - `spoil` `#a89880`/`#857762` rim `#c2b49c` — §3 quarry spoil / rubble.
   - `stone` `#cfc2a6`/`#a2957c` rim `#efe6d2` — §3 cut stone block face. Its
     pale entry is the limestone row's `#efe6d2`, **not** the cut-stone row's
     `#8a7d66` tool-mark: the bible's third entry is a _thin pale rim_, both rows
     are one family, and a dark tool-mark would be a third field tone, which the
     no-gradient rule forbids. Flagged for the reviewer.
   - Each material now names which village crop lends it structure — paving's
     flagstone joints for the made materials (road, wear, stone, spoil), the
     courtyard lawn's rhythm for the grown and settled ones (verge, margin, bed)
     — and `classOf()` exposes the crop's class without choosing a colour, which
     is what lets the bed pick its two tones by depth.
2. **`scripts/art/forest-shoreline.ts`.** Every piece of geometry is unchanged:
   the bounded exterior feather (`SHORE_LIMIT`/`COVER_LIMIT`), the seeded bite
   into the outer water cells (ADR 0044), the inset field, and ADR 0045's
   **opaque bed across every wet pixel**. What changed is what the geometry is
   painted with. The packer no longer opens `shoreline-source.png` or the
   material sheet — those images only ever supplied colour; the shapes were
   always the packer's own.
   - The wet line now carries the bible's `#1b1410` ink, with `#7ec8e3` on its
     wet side and the margin's pale rim on its dry one. **The ink sits at the
     bite boundary, not at the tile edge**: the tile polygon is not a material
     edge and never was.
   - ADR 0045's "deepens away from the shore" survives as a choice of _which_
     of two flat tones a pixel takes — the deep tone's share rises across
     `BED_DEEP_BAND` — resolved over four-pixel clumps rather than per pixel,
     because a per-pixel draw is a dither and a dither is a gradient with extra
     steps. No intermediate key is ever written.
   - Both bed tones clear the `e2e/renderer.spec.ts` authored-water gate's
     blue-minus-red > 20 bar on their own (77 and 50), which the test now pins,
     so no rasteriser has to make up the difference. `BED_COOL` is gone with the
     sampled silt it corrected.
3. **`scripts/art/forest-raised-shelf.ts`** is now `packRaisedShelf(material)`
   with a `main()` guard and no argument. The ledge is **packed earth** standing
   on a **cut stone block face**, the face showing only where the ledge's
   down-screen (+x/+y) side is exposed, ink around the silhouette, thin pale rim
   inside the lit (up-screen) edge. The cell envelope, the (19,4) road exit and
   the projected bounds do not move.
4. **`scripts/art/forest-rubble.ts` (new).** `rubble.webp` had no packer at all
   — it was committed straight out of `bd70d2d`. The plate is now painted in the
   §3 spoil key on a ragged diamond, with the chip highlight as the rim on the
   diamond's lit slopes. The village paving lends the structure at **three times**
   the road's logical frequency, so its flagstones arrive as chips rather than
   whole slabs: the difference between a heap and a floor. The plate keeps its
   shipped 384×128 size, so both `FOREST_RUBBLE_CELLS` placements are untouched.
5. **Tests.** `forest-shoreline.test.ts` rewritten against the new packer: it
   pins the plate byte-for-byte, asserts no colour outside the two water-margin
   rows is painted, keeps every ADR 0044/0045 assertion (bank coverage, no leak
   past `SHORE_LIMIT`, opaque bed, bounded wandering bite, shelf darker than
   bank, deep darker than shelf, feather running pale to dark outward), and adds
   the blue-gate check. `forest-rubble.test.ts` (new) pins the plate, the table,
   the ragged silhouette and the window span. `forest-raised-shelf.test.ts`
   keeps its coverage/exit test and gains a byte-pin and a table check.

Nothing touches map rows, cell keys, scene ids, collision or saves; no product
code changed. **No new region file** — all three are re-keyed in place, so the
forest's resolved-URL count is unchanged against `SCENE_IMAGE_CAP = 32`. Ba Dan,
the quarry and the Cutting are untouched.

**Map family 3.98 → 3.95 MiB of 4 MiB.** `pond-bank` 33,744 → 24,600 B,
`raised-shelf` 9,870 → 7,344 B, `rubble` 21,456 → 5,114 B. All three moved to
`FOREST_GROUND_QUALITY = 74`, the setting W2 already shares across the ground
plates; no budget was touched.

## Measurements

`npx tsx scripts/art/forest-ground-measure.ts <plate>`; "span" is the ratio of
the brightest 128 px window mean to the darkest, stepped 32 px, windows at least
half opaque. The W2 route plate's mean is **142.5**; the DL-2 §3 bars are span
**≤ 1.25×** and plate mean within **1.3×** of the route's.

| Plate                 | Window span | Mean luma | Mean colour | vs route mean |
| --------------------- | ----------- | --------- | ----------- | ------------- |
| `pond-bank` before    | 1.744×      | 115.1     | `#7c7453`   | 1.238×        |
| `pond-bank` after     | **1.687×**  | 97.8      | `#566563`   | **1.457×**    |
| `raised-shelf` before | 1.076×      | 148.9     | `#af9452`   | 1.045×        |
| `raised-shelf` after  | **1.029×**  | 157.4     | `#b49b76`   | **1.105×** ✓  |
| `rubble` before       | 1.057×      | 116.5     | `#8f714a`   | 1.223×        |
| `rubble` after        | **1.087×**  | 135.7     | `#948671`   | **1.050×** ✓  |

The shelf and the rubble pass both bars. **The pond plate passes neither on the
whole-plate figures, and cannot**, because it is the one plate that holds two
materials which are _supposed_ to differ: damp earth and a bed seen through
water. The packer therefore reports each material's own mean, in the same
Rec. 709 luma, and those are the numbers that say whether either has drifted:

```
node --import tsx scripts/art/forest-shoreline.ts
  -> { dryMean: 116.9, bedMean: 83.8, bitePixels: 41653, bedPixels: 89419,
       deepBedPixels: 6014, inkPixels: 5526, bytes: 24600 }
```

- **Dry margin 116.9 against the route's 142.5 = 1.219×** — inside the 1.3×
  band. The bank is in the same tone band as the road it runs beside, which is
  the acceptance this work item is really about.
- **Bed 83.8 = 1.70× of the route.** It is under water. The §3 table specifies
  `#2a5e77` for it, and nothing in the same family is brighter; the only way to
  reach 1.3× would be to drift the §3 bed hex, which the bible calls a QA
  failure.
- Plate span 1.687× is therefore a **wet-against-dry material step**, not a
  baked ramp. It is nonetheless _worse_ than a plate with no bed would measure,
  and I did not attempt a third arrangement: the darker second bed tone was
  chosen to keep ADR 0045's depth reading, and softening it would trade the
  depth for a number. **Recorded rather than closed** — see "Open".

Before/after screen evidence is the captures below, not a tone probe: no
route-tone comparison was run this pass (see "Not claimed").

## Commands, exactly as run

```
node --import tsx scripts/art/forest-shoreline.ts
node --import tsx scripts/art/forest-raised-shelf.ts
node --import tsx scripts/art/forest-rubble.ts
npx prettier --write "scripts/art/forest-*.ts"
npm run art:validate                 # green
npm run check:assets                 # green, maps 3.95 MiB of 4 MiB
npm run verify                       # green, 945 tests / 118 files
npx vitest run src/render/scene.test.ts src/content/scenes          # 53 tests
npx vitest run scripts/art/forest-shoreline.test.ts \
  scripts/art/forest-rubble.test.ts scripts/art/forest-raised-shelf.test.ts
npx tsx scripts/art/forest-ground-measure.ts \
  public/art/maps/forest-scene/pond-bank.webp \
  public/art/maps/forest-scene/raised-shelf.webp \
  public/art/maps/forest-scene/rubble.webp
npx playwright test -c playwright.gallery.config.ts --project=ipad-webgl \
  -g "04-board-idle|09-rock-throw|16-grid-on"                        # 3 passed
```

## Capture paths

- `gallery/ipad-webgl/04-board-idle.png`, `09-rock-throw.png`, `16-grid-on.png`
  in this clone (the gallery folder is git-ignored).
- Compared against `evidence/refs/ba-dan-exploration.png` and the W2 frame
  `D:/AvatarRPG-work/dl2-w2-forest/gallery/ipad-webgl/04-board-idle.png`.
- Plate decodes composited over magenta for silhouette review:
  `.shots/peek/{pond-bank,raised-shelf,rubble}.png` (also git-ignored; the
  helper that wrote them was a scratch script and is not kept).

On screen, against the W2 frame: the pond's dark ochre ring is gone and the
bank now continues the road's material into the waterline, which carries the
ink and the pale edge; the bed reads as silt deepening toward the middle rather
than as one flat teal fill; both rubble diamonds have moved from cold grey to
warm spoil and sit in the road's tone band instead of punching out of it.

## Open, recorded honestly

- **The pond plate's whole-plate span and mean do not meet the §3 bars, and
  this run did not try twice to close them.** The per-material figures above are
  offered instead. A reviewer who reads §3's span bar as "per plate, whatever is
  on it" should reject this; a reviewer who reads it as "no material carries a
  baked ramp" should accept it. That is a call about the contract's wording, not
  about the packer, and it is the same class of question W2 left open about the
  village paving mean.
- **The `#7ec8e3` waterline reads brightly** at board zoom — a pale halo around
  the pond rather than a glint. It is the §3 edge hex at the bible's 3 px rim
  width, so both numbers are per contract, but a reviewer may want it thinner or
  dropped to the bank's side only.
- **`pond-reeds.webp` and `old-nest-reeds.webp` were not re-keyed.** They
  measure `#766238` / `#7b6642`, which is ochre against the route's 142.5
  (1.44× / 1.37×), but that ochre is the artist's own flood-bank reed material
  out of `assets/source/forest-bank/old-nest-reeds.png` — it is not the forest
  atlas's. They are also standing scenery, not ground, and the §3 table has no
  row for vegetation. Re-keying them would be a visual-direction change (dry
  straw → green reeds, as in the Ba Dan reference), which is Jared's call, not
  this work item's. Left as it is, with the measurement recorded.
- **The shelf is not visible in any of the three captures**: it sits on the
  board's eastern edge, outside the framing of all three gallery shots. Its
  evidence is the plate decode, the coverage test and the measurement only.
- **The cut-stone rim uses `#efe6d2`, not the §3 cut-stone row's `#8a7d66`.**
  Reasoned above; a reviewer wanting the tool-mark instead should say so, and it
  would need a decision about whether a _dark_ third tone is allowed on a face.
- **No route-tone before/after probe.** W2 ran `playwright.route-tone.config.ts`
  to show what moved on screen; this pass did not, so the "what moved" claim
  above is read off the captures by eye rather than counted.
- Not claimed: no playthrough, no listening, no physical device, no Large-text
  check, no WebKit run, no canvas-backend capture, no other scene's capture, and
  no reviewer judgement. W5 remains the gate that decides whether the four
  scenes read as one game.

## Next action

Review the draft PR against `ba-dan-exploration.png` and the W2 frame, and rule
on the two contract questions above (the pond's plate-wide span, and the
cut-stone rim hex). With W2 and W2b together the forest's ground is entirely off
the old atlas, so W3 — the quarry, which inherits the same table and the same
arithmetic — can start as soon as those rulings exist.

## Rebase and water-tint tests

Owner: Sonnet subagent run, 2026-09-22. Rebased this branch onto
`origin/main` (`49dcb77`), which had landed both PR #87 (fallback palette
re-key) and PR #90 (the quarry re-key, which generalised
`forest-village-material.ts`'s per-material `parseHex`/`structure` calls into
shared `loadVillageCrops()` + `bindPalette()` and added
`scripts/art/quarry-village-material.ts`).

- **The conflict** was in `forest-village-material.ts` alone. Kept main's
  generalised `loadVillageCrops`/`bindPalette`/`VillagePalette<N>` machinery
  rather than this branch's per-material `parseHex` block, and folded this
  branch's `FOREST_PIECE_TONES`, `FOREST_ALL_TONES` and `classOf()` into it:
  `VillagePalette<N>` now declares `classOf`, `bindPalette()` implements it,
  and `ForestMaterial` is `extends VillagePalette<ToneName>` plus `worn`
  instead of redeclaring `colour`/`rimOf`/`ink`/`cuts`/`classOf` by hand.
  `loadForestMaterial()` binds all seven tones (`road`, `wear`, `verge`,
  `margin`, `bed`, `spoil`, `stone`) through the shared `CROP_OF`/`SALT_OF`
  tables instead of the three-tone table it bound before. One adaptation
  `structure()` now returns a fourth class, `'joint'`, for the quarry's
  tool-mark; no forest tone names a joint colour, so `classOf()` folds
  `'joint'` back into `'shadow'`, which is exactly the three-way split this
  branch's `classOf` had before the quarry work existed.
- **Byte-identity.** Re-ran every forest packer (`forest-route-ground.ts`,
  `forest-grass-regions.ts`, `forest-exterior-apron.ts`, `forest-shoreline.ts`,
  `forest-raised-shelf.ts`, `forest-rubble.ts`) and both quarry packers
  (`quarry-route-ground.ts driller`, `quarry-modular-ground.ts`), then
  `npx prettier --write` per the quarry handoff's own command list. `git
status` came back clean: every regenerated plate and registration file
  matched what was already committed.

Separately, the two forest raised-shelf/rubble water-tint e2e checks failed
on this branch against current `main`'s ground contract: the shelf's bare
tone is now the warm packed earth `FOREST_PIECE_TONES.stone` samples to
(~178, 147, 101 at the probed cell), which is already greener (`g=147`) than
the `#3e8fb0` water fill (`g=143`), so no water film can raise green over it.
The green-rise assertions were calibrated on the old, darker legacy dirt and
are unsatisfiable by construction against the new contract, not a real
regression.

- **`e2e/partial-ground.spec.ts`** ("partial elevation keeps a live surface
  above its base"): kept `wet.b - bare.b > 12`, added `wet.r < bare.r - 12`,
  and replaced `wet.g - bare.g > 10` with
  `(wet.b - wet.r) - (bare.b - bare.r) > 25`. Measured: canvas
  `bare {r:177.9, g:146.6, b:100.5}` → `wet {r:133.6, g:144.3, b:130.3}`, gap
  `74.2`; webgl `bare {r:178.2, g:147.0, b:100.8}` → `wet {r:125.0, g:138.3,
b:121.9}`, gap `74.4`.
- **`e2e/painted-rubble.spec.ts`** (water tint over the registered rubble
  image): kept `blueShift > 10` and `waterRegion.r - registered.r < -10`,
  and replaced the absolute green shift (`> 2`) and the green/blue ratio
  (`> 0.2`) with the same gap criterion,
  `(waterRegion.b - waterRegion.r) - (registered.b - registered.r) > 25`.
  Measured: canvas gap `47.3`; webgl gap `48.5`.

`npx playwright test e2e/partial-ground.spec.ts e2e/painted-rubble.spec.ts
e2e/renderer.spec.ts` (all local projects): **14 passed**, canvas and webgl
both. `npm run verify` (typecheck, lint, format:check, vitest): green, 951
tests / 119 files. `npm run art:validate` and `npm run check:assets`: green,
maps 3.94 MiB of 4 MiB.

## CI cost

No push to `main`, no workflow dispatch, no re-run, no auto-merge. One branch
push and one **draft** PR. Local only: one `npm run verify` and one 3-frame
gallery capture.

The rebase pass added one further force-push to this same draft PR's branch
(`--force-with-lease`, no merge, no CI re-run triggered from this side) and
one local `npm run verify` plus the three e2e specs above.

## Repair after the independent review

Owner: Opus subagent run, 2026-09-23, on `3e1db6c` (main had not moved from
`49dcb77`, so no rebase). The independent visual review returned
CHANGES-NEEDED and withdrew the earlier acceptance, because the shelf was
outside every gallery frame. This pass answers its five findings. No art was
generated; every pixel still comes from `forest-village-material.ts`, and
only DL-2 §3 and `palettes.ts` hexes are painted.

1. **Raised shelf.** `forest-raised-shelf.ts` now draws the step the way this
   camera sees a raised block: the top is the footprint lifted by
   `SHELF_RISE = 16` world pixels (the height the old 0.26-cell band gave), and
   any pixel whose ground would already be off the shelf is the face, so the
   face stands straight up from the +x/+y edges. The top is a new `trodden`
   tone (the road's packed-earth hexes, read through the courtyard lawn with
   its own salt 97, not the paving's flagstones). Ink runs along the lip as
   well as the silhouette and the foot. The face uses only the cut-stone row's
   shadow tones: the left-facing wall `#a2957c` with `#8a7d66` tool-mark
   joints, the right-facing wall `#8a7d66` with ink joints, in two coursed
   rows of staggered blocks. `stone.base` and `stone.rim` are no longer painted
   and the test forbids them. Plate mean luma 157.4 → 130.4 (1.093× the route).
2. **Rubble.** `forest-rubble.ts` now paints a heap, not a floor: 18 broken
   chunks (irregular 5–7-sided polygons) in five courses stacked back to
   front, rising to a crown about 40 plate px above the ground they spread
   over. Each chunk has a lit top facet with the chip highlight on its upper
   edge and a shadowed front facet. Half of them are §3 spoil and half are the
   road's own slabs, broken. The gaps and the contact shadow under each chunk
   are the packed-earth shades (`#8e7049`, `#7a5f3e`), with 2 px ink round the
   pile and 1 px between the chunks. Every outline is built from straight
   sides or whole-number harmonics, so there is no seam step. The heap stays
   inside its cell's diamond; the plate size and both placements are
   unchanged. The plate goes from `#948671` to `#826d51` (red minus blue 35 → 49),
   mean luma 111.6 (1.28× the route).
3. **Pond.** Under the water film the bank is now the damp margin one step
   darker (`#7a5f3e` field, `#8e7049` where the lawn lifts), and its pale rim
   is no longer painted there. That rim was what read as a curb top. The deep
   bed is no longer dithered in 4 px clumps: it is one pool whose edge is
   where the depth's smoothstep across `BED_DEEP_BAND` (now 0.6) clears a
   smooth value-noise field. The two comments that disagreed are replaced by
   one. The packer now reports the dry margin (116.3, 1.225× the route), the
   wet bank (95.2) and the bed (82.8) separately.
4. **Invented tone.** `bed.shadow` is `#173b4c`, the palette's
   `water_deep.edge`. `#1f4a5e` was the alternative, but it failed the ADR
   0045 deepening check (deep band mean < 0.8 × shelf band) once the silt flips
   are counted.
5. **Test comment.** `e2e/partial-ground.spec.ts` now names the shelf top's
   `trodden` packed earth `#b39064`, measured at ~179,148,101 on both
   backends.

**On screen** (canvas / webgl, 128 px tiles, mean over the rubble diamond):
PR head `#a79d8d` / `#a69c8e` (red minus blue 25.7 / 24.0) → `#9b8d7a` /
`#998c79` (33.4 / 31.1). It is warmer and darker, but the runtime rubble wash
(`SURFACE_STYLES.rubble`, `#6e6a63` at 0.3 over the whole tile, drawn above the
plate in partial scenes) still cools whatever the plate paints. That wash is
render code and out of scope here.

**Determinism.** All eight forest and quarry packers were run twice. All 43
output hashes matched between the runs, and every plate other than these three
matched what is committed.

**Evidence**: `C:/Users/Jared/OpenClawControl/avatar-supervisor/evidence/pr89-repair/`.
It holds `before/` and `after/` full frames (canvas and webgl; board, shelf,
both rubble cells and pond at 64 and 128 px tiles, with camera probes) and
`compare-*.png` before/after crops. The capture spec is a scratch file and is
not committed.
