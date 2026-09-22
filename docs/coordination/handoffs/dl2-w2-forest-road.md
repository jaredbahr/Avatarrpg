# Handoff — the forest road, re-keyed from the village's accepted plates

Owner: Opus supervisor run, 2026-09-22. Branch `claude/dl2-w2-forest-road`,
clone `D:/AvatarRPG-work/dl2-w2-forest`, based on `ae35ecb` (origin/main, the
PR #86 merge). This is **DL-2 work item W2** from
`SUBSYSTEMS/dl2-ground-language-plan.md`: give the forest road the same ground
language as Ba Dan, so a reviewer holding `ba-dan-exploration.png` and a fresh
`04-board-idle.png` places both in one game.

The plan's §2 diagnosis was that three scenes each tile their own generated
atlas, and that the village is the only place in the pipeline where an
**accepted** painting is the source of the next one
(`ba-dan-neighborhood-ground.ts:35-56`). W2 generalises that mechanism to the
forest. **No art was generated in this run.**

## What changed

1. **`scripts/art/forest-village-material.ts` (new).** Decodes
   `ba-dan-scene/courtyard-ground.webp` and
   `ba-dan-scene/western-approach-ground.webp` read-only and exposes the forest's
   ground material. What it takes from the village is its **structure** — the
   shape and rhythm of the painted incident — read as one of three classes by
   luminance percentile inside a verified opaque crop; what it applies is the
   DL-2 §3 ground table. Crops, both certified by the village's own packer and
   re-checked here (`calibrate()` throws if a sample reaches a clear pixel):
   broad paving at `western-approach x1..5,y7..8` and quiet lawn at
   `courtyard x10..11,y4`.
   - Three materials, not two: `road` `#b39064`/`#8e7049` rim `#c7a87d`,
     `wear` `#a6845a`/`#7a5f3e` rim `#c7a87d`, `verge` `#6f9e4c`/`#4f7538`
     tuft `#a8c686`. Ink `#1b1410`.
   - The source tile is chosen by a **hash of the destination cell** and flipped
     on either axis by the same hash, replacing the old fixed-period mirrored
     repeat. Neighbouring cells therefore draw unrelated tiles of the source in
     unrelated orientations, which is what stops the plane reading as one swatch.
   - `SHADOW_SHARE = 0.14`, `RIM_SHARE = 0.14` hold the tone split as _shares_
     rather than absolute cuts, so the plate's mean stays predictable and the
     cross-scene tone band stays checkable.
2. **`scripts/art/forest-route-ground.ts`** no longer reads the four-quadrant
   forest atlas. It packs from the shared material, adds path wear along two
   wandering cart ruts either side of the road's centre line as the third
   material, and lays the bible's uniform `#1b1410` ink on every road/verge
   boundary with a thin pale rim on the boundary's up-screen (lit) side. The
   packer is now `packRouteGround(material)` with a `main()` guard, so a test
   can build the plate.
3. **The smoothstep feather is spent on _which_ flat tone a pixel takes**, not
   on blending two of them. Half-width stays `0.16 + 0.03·…` and both materials
   still meet at the same 50/50 midpoint, but the join no longer invents a
   third, intermediate key — which is the only way to keep "exactly two flat
   tones per material" and the existing packer idiom at the same time.
4. **`scripts/art/forest-grass-regions.ts`** takes the same material, so the
   route plate and the two grass packs cannot drift across their shared rows 3
   and 9. `packGrassRegion` now takes a `ForestMaterial` instead of an atlas.
5. **Repacked art** (`public/art/maps/forest-scene/`): `route-ground.webp`
   121,534 → 112,886 B, `grass-north.webp` 83,474 → 60,934 B,
   `grass-south.webp` 64,510 → 48,022 B, and the 12 `exterior-apron-*.webp`
   bands 167,038 → 203,290 B total, because
   `scripts/art/forest-exterior-apron.ts` continues these three plates outward
   and had to be re-run or the board rim would carry the old ochre. Map family
   **4,184,084 → 4,172,660 B (3.990 → 3.979 MiB of 4 MiB)** — net _smaller_
   despite far more painted incident, because flat tones compress well.
   WebP quality for the three ground plates drops 86 → 74
   (`FOREST_GROUND_QUALITY`); there is no photographic texture left to preserve,
   and at 86 the family went **over** budget at 4.03 MiB.
6. **`scripts/art/forest-ground-measure.ts` (new)** is the measurement tool the
   numbers below come from, so the next pass re-runs it rather than re-derives
   it. It reads window **means**, not per-pixel extremes: a baked gradient or a
   distance haze is a low-frequency change, while the ink line and the rim light
   live inside a window and are the look, not the drift.
7. **Tests.** `scripts/art/forest-route-ground.test.ts` (new) pins the plate
   byte-for-byte against the packer, pins the texture cap, asserts **no colour
   outside the ten-entry table is painted** (a gradient needs continuous tone to
   exist, so this is the structural form of "no gradient"), asserts all three
   materials are used, asserts the window span and the village tone band, and
   asserts the ink is present while water cells stay clear and every road centre
   stays opaque. `forest-grass-regions.test.ts` drops the atlas source and gains
   an Earth-green assertion.

Nothing touches map rows, cell keys, scene ids, collision or saves; no product
code changed. `FOREST_APRON_SEAM` is unchanged at 0.35. No new region file:
`route-ground`, `grass-north` and `grass-south` are re-keyed in place, so the
forest's resolved-URL count is unchanged against `SCENE_IMAGE_CAP = 32`.
Both plates stay 1984×960 / 1536×768 / 1472×736, inside 2048 px.

## Measurements

Plate decode, `npx tsx scripts/art/forest-ground-measure.ts <plate>`; "span" is
the ratio of the brightest 128 px window mean to the darkest, stepped 32 px,
windows at least half opaque.

| Plate                 | Window span | Mean luma | Mean colour | Earth-green share |
| --------------------- | ----------- | --------- | ----------- | ----------------- |
| `route-ground` before | **1.524×**  | 144.8     | `#b18e4d`   | 0.0%              |
| `route-ground` after  | **1.076×**  | 142.5     | `#93925a`   | 40.7%             |
| `grass-north` before  | 1.039×      | 113.1     | `#817334`   | 0.0%              |
| `grass-north` after   | 1.048×      | 143.3     | `#729e51`   | 100%              |
| `grass-south` before  | 1.041×      | 113.1     | `#807334`   | 0.0%              |
| `grass-south` after   | 1.058×      | 143.4     | `#729e51`   | 100%              |

The DL-2 §3 bar is **≤ 1.25×**. The worst window pair in the new plate is
brightest 147.7 at (1504, 640) against darkest 137.2 at (448, 448). The old
plate's worst pair was 170.0 at (672, 352) against 111.6 at (1216, 640) — that
58-point drop across the plate _is_ defects 10 and 11, the baked light-to-dark
ramp and the far-edge haze, and it is gone.

**On screen, like for like.** `playwright.route-tone.config.ts` +
`scripts/route-tone-compare.mjs`, canvas, 1368×912, the same method
`village-ground-tone.md` used for the village:

- `battle_forest_road` **authored** layer: 692,531 of 848,160 px moved
  (**81.65%**), mean luminance **138.6 → 143.8**.
- Per terrain under the board: `grass` `#7f7134` 111.5 → `#749b4f` **141.0**
  (+29.5), `road` `#cd9d5b` 162.3 → `#a7865c` **138.0** (−24.3). The step
  _between_ the road and its verge therefore collapses from **1.46× to 1.02×**,
  which is the defect the acceptance is really about.
- `battle_forest_road` **procedural** and **cells** layers: **0.00%** moved.
- `battle_ambush`, every layer: **0.00%** moved, every terrain tone identical.

**Tone band.** The forest authored ground now reads **143.8** on screen against
the village authored ground's recorded **`#8d9557` = 142.9**
(`village-ground-tone.md:46`, same probe, same viewport): **1.006×**, well
inside the 1.3× bar. Plate-decode to plate-decode the new route plate (142.5)
is **1.315×** of the courtyard plate (187.4) and **1.409×** of the
western-approach paving crop alone (200.7) — see "Open" below.

## Commands, exactly as run

```
node --import tsx scripts/art/forest-route-ground.ts
node --import tsx scripts/art/forest-grass-regions.ts
node --import tsx scripts/art/forest-exterior-apron.ts
npx prettier --write "scripts/art/forest-*.ts"
npm run art:validate                                   # green
npm run check:assets                                   # green, maps 3.98 MiB
npm run verify                                         # green, 938 tests / 117 files
npx vitest run src/render/scene.test.ts src/content/scenes \
  scripts/art/forest-route-ground.test.ts scripts/art/forest-grass-regions.test.ts \
  scripts/art/forest-exterior-apron.test.ts scripts/art/apron-plates.test.ts
npx tsx scripts/art/forest-ground-measure.ts public/art/maps/forest-scene/route-ground.webp \
  public/art/maps/forest-scene/grass-north.webp public/art/maps/forest-scene/grass-south.webp
npx playwright test -c playwright.gallery.config.ts --project=ipad-webgl \
  -g "04-board-idle|05-move-preview|16-grid-on"
FNT_RT_TAG=after  npx playwright test -c playwright.route-tone.config.ts
FNT_RT_TAG=before npx playwright test -c playwright.route-tone.config.ts   # base art checked out
node scripts/route-tone-compare.mjs .shots/route-tone/before .shots/route-tone/after
```

## Capture paths

- `gallery/ipad-webgl/04-board-idle.png`, `05-move-preview.png`,
  `16-grid-on.png` in this clone (the gallery folder is git-ignored).
- Route-tone frames and the class maps: `.shots/route-tone/{before,after}/`.
- Compared against `evidence/refs/ba-dan-exploration.png` and the pre-change
  forest frame `evidence/gallery-7c0b82a/ipad-webgl-3/ipad-webgl/04-board-idle.png`.

## Open, recorded honestly

- **The plate-decode tone ratio does not reach 1.3×, and two attempts did not
  close it.** At `SHADOW_SHARE/RIM_SHARE` 0.16/0.12 the plate measured 141.2;
  at 0.14/0.14 it measures 142.5; the courtyard plate decodes at 187.4 and the
  paving crop alone at 200.7. The cap is arithmetic, not a packer defect: §3
  specifies **packed earth** `#b39064` for this road (base luma 148.3) and
  **limestone** for the village plaza, and no mixture of the three declared
  earth tones can average above ~150. Closing it would mean either lightening
  the §3 road hexes — palette drift, which the bible calls a QA failure — or
  reading "the village paving mean" as the project's own recorded on-screen
  figure `#8d9557`, against which the plate is **1.003×** and the rendered board
  **1.006×**. This is a reviewer's call on which reference the acceptance meant;
  it is not something the packer should decide by drifting a hex.
- **The road reads as earth-toned paving, not as loose dirt.** The village's
  flagstone shapes come through the re-key intact — which is precisely what
  makes it the same hand as Ba Dan, and is arguably right for a road leaving a
  paved village, but a reviewer wanting a rutted dirt track will not get one
  from this source. Changing that needs a packed-earth structure crop, which
  neither approved village plate contains.
- **The cart ruts are present but do not read as ruts** at board zoom. The wear
  material is measurably there (its base is painted, the test asserts it) and it
  breaks the plane's uniformity, but it does not draw a track. Widening or
  darkening it trades directly against the tone band above.
- **`pond-bank.webp`, `raised-shelf.webp` and `rubble.webp` were not repacked.**
  They still carry the old forest atlas's ochre and cold grey, so the pond's dry
  margin and the two rubble diamonds are now the odd material on this board.
  Their packers are in scope by filename but their outputs are outside this work
  item's allowed paths, so they are left for the reviewer to schedule — probably
  as a small W2b, since `forest-shoreline.ts` already samples the road "with
  exactly the mapping `forest-route-ground.ts` uses" (`forest-pond-shoreline.md:87`).
- **No other scene's capture was taken.** The structural argument is that only
  `public/art/maps/forest-scene/` changed and no product code did, so nothing
  else _can_ move; the route-tone probe's `battle_ambush` result (0.00% on every
  layer) is the only direct evidence of that, and it does not cover the village,
  the gate, the Cutting or the quarry floor.
- Not claimed: no playthrough, no listening, no physical device, no Large-text
  check, no WebKit run, no canvas-backend gallery capture, and no reviewer
  judgement — W5 is the gate that decides whether the four scenes read as one
  game, and this is one of its four inputs.

## Next action

Review the draft PR against `ba-dan-exploration.png`. If the acceptance's
"village paving mean" is the on-screen `#8d9557` figure, W2 is complete and W3
can start. If it is the plate decode, the §3 road hexes need a decision before
W3 re-keys the quarry to the same table, because W3 inherits exactly the same
arithmetic.

## CI cost

No push to `main`, no workflow dispatch, no re-run. One branch push and one
**draft** PR; auto-merge was not enabled. Local only: one `npm run verify`, one
3-frame gallery capture, and two route-tone captures.
