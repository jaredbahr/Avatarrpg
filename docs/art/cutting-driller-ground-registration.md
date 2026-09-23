# Cutting and Driller ground registration

This source-only checkpoint registers the lead's reviewed full-scene ground
candidates to the existing oblique page contract. It does not opt either map
into a scene, replace its orthographic fallback, change a row, or alter a live
surface, prop, spawn, encounter, collision or path.

## Inputs and measured transform

The lead generated the candidates recorded in commit `881f473` under
`docs/art/cutting-driller-ground-source.md`. Local ignored copies are
`art/raw/cutting/ground-source-v2.png` and
`art/raw/driller/ground-source-v1.png`. Cutting v1 remains rejected.

Each source is 1683×935. It is a full-canvas render of the 2304×1280 technical
guide at exactly 0.73046875 scale, so registration scales both axes by
1.3689839572 with no rotation, shear, tile remap, perspective correction or
material repetition. The declared source corners are top (654.500187, 140.25),
right (1589.499252, 607.75), bottom (1028.499813, 888.25) and left
(93.500748, 420.75). They map to guide corners top (896, 192), right
(2176, 832), bottom (1408, 1216) and left (128, 576).

The packer applies the inverse of the established world projection to every
output pixel, accepts only map coordinates inside the authoritative 20×12
diamond, and writes transparent pixels outside it. It repaired only saturated
or transparent generator fringe at that perimeter by copying the nearest valid
painted neighbor: 5,118 pixels on Cutting and 4,465 on Driller. It never uses a
generic material atlas or creates terrain from the map legend.

## Registered output

`scripts/art/projected-scene-ground-pack.ts` produced these unreferenced runtime
files, each 1152×1280 and alpha-preserving:

| Map          | Files                                                                      |   Bytes | WebP quality |
| ------------ | -------------------------------------------------------------------------- | ------: | -----------: |
| The Cutting  | `public/art/maps/cutting-scene/ground-west.webp`, `ground-east.webp`       | 129,580 |           82 |
| Quarry Floor | `public/art/maps/driller-floor-scene/ground-west.webp`, `ground-east.webp` | 101,314 |           82 |

Both sets stay within the 220 KiB per-map ground allocation. The ignored
`ground-registration.json` beside each source records all measurements, page
sizes, file sizes and repair counts so the result can be reproduced with:

```text
node --import tsx scripts/art/projected-scene-ground-pack.ts ambush_road art/raw/cutting/ground-source-v2.png
node --import tsx scripts/art/projected-scene-ground-pack.ts quarry_floor art/raw/driller/ground-source-v1.png
```

The source SHA-256 values are
`bed2b4dca43068cc6315b8fc1b62ac28cec2e9389981302ee031f894de4d7fa8`
(Cutting) and
`e4d1b60b81da36c5180d79625e6842fa83a7aa380bed81f64942e3c89355dde5`
(Driller). The map family is now 3,846,608 bytes of the 4 MiB cap, leaving
347,696 bytes. Of the originally reserved 450,560 bytes for this two-map batch,
219,666 bytes remain for cliff sources and packing variance.

The paintings deliberately leave water, oil, mud and rubble as ordinary ground
underlays. Their rules-owned overlays stay visible and mutable after gameplay
adds the scenes. The Cutting's brown marks are source dirt under the four live
rubble anchors, not baked cover. The Driller's centre remains open for the
conditional cabbage cart at (9,6).

## Required upright cliff source

`scripts/art/cutting-scene-guide.ts` and
`scripts/art/driller-floor-guide.ts` now generate ignored `cliff-guide.svg` and
`cliff-slices.json` files. Each guide has 12 source slices per map, grouped only
by cardinally connected cells at the same elevation, within the 32-item scene
limit. Every slice records the exact footprint, elevation, foreground ground
corner, depth and exposed edges with the elevation drop. The next source batch
must supply transparent upright limestone/terrace paintings for those slices:
no flat ground, actors, cart, cover, rubble, water, oil or mud. Do not replace
them with procedural cubes.

Gameplay may register `src/content/scenes/cutting.ts` and
`src/content/scenes/drillerFloor.ts` only after reviewing the upright source and
these ground pages together. Keep `paintedWater` unset so live water remains
visible. The old backdrop continues as the missing-asset fallback until then.

## Local Cutting and Driller material regions

The local region packs use the reviewed six-panel quarry source
`exec-8dcfcdb5-eeb3-485c-a1c7-5cfd6279580d.png` from the documented local
ImageGen directory. Its verified SHA-256 is
`d15b808ab498c4521d73892d887ce2fedc54243008e0c92f9750c976e67a64f9`.
`scripts/art/quarry-route-ground.ts` derives transparent dirt, road and stone
regions from authoritative rows for each map. A cell is painted with the ground
its material stands on: an oil slick takes the stone page and a mud patch the
dirt page, and the live surface is still drawn over it at runtime, so no opaque
spill leaves the only unpainted hole in the floor beside illustrated ground.
Water alone stays transparent, because its bed is authored with the liquid and
a painted page under a translucent film would compete with it. A two-pixel edge
bleed is restricted away from those water interiors. Cutting packs: dirt-west,
dirt-east, road and stone. Driller packs: dirt-west, dirt-east and stone. The
exterior surround, rims, rear loading strip, walls and props are independent
registrations.

The east dirt page now takes over across a narrow logical `x=10` alpha ramp
over the west page's existing bleed. This avoids a visible diagonal caused by
separately compressed opaque dirt-page edges while keeping the west page as the
dry underlay. `scripts/art/quarry-route-ground.ts` applies the ramp itself
(`softenDirtJoin`) when it packs either map. Runtime oil, mud, and water remain
transparent because the ramp only reduces nonzero dirt alpha. (A one-off script,
`soften-quarry-dirt-join.ts`, once re-applied the ramp to the shipped pages; it
re-encoded them at quality 84, broke the byte pins, and was deleted in the DL-2
cleanup.)

## DL-2 W3 re-key of the Driller floor (2026-09-22)

The Driller floor's three regions no longer come from that six-panel sheet.
`scripts/art/quarry-route-ground.ts` takes no source argument; it re-derives
its pixels from the **approved village plates**
`public/art/maps/ba-dan-scene/western-approach-ground.webp` and
`courtyard-ground.webp`, read-only, through
`scripts/art/quarry-village-material.ts`, and applies the ground table in
`SUBSYSTEMS/dl2-ground-language-plan.md` §3. Reproduce with:

```powershell
node --import tsx scripts/art/quarry-route-ground.ts driller
```

Cell-to-page routing, the page origin and the cell keys are unchanged, so all
three registered rectangles are identical and only bytes moved. What changed is
that a cell's **material** is now read more finely than its page: `^`/`A` are
cut-stone block face, `r` is spoil, `o` is limestone cut floor, `m` is path
wear, and the plain floor is packed earth. Every boundary between two materials
carries the bible's uniform `#1b1410` ink with a thin pale rim on its up-screen
side, which is what gives each ledge and hazard diamond an edge for the first
time. The packed-earth plane carries painted incident — inked spoil heaps and a
pair of wandering haul ruts in §3's cart-rut tone — so no quarter of the frame
is bare material.

**The Cutting was not repacked.** Its four regions and `CUTTING_GROUND_REGIONS`
keep their approved bytes; folding it in is DL-2 W4.

WebP quality for the re-keyed plates is 34 (`QUARRY_GROUND_QUALITY`), shared
with the gate. `scripts/art/quarry-route-ground.test.ts` pins the shipped bytes
against the packer, the tone table, the window span and the ink.

## DL-2 W4: The Cutting folded in (2026-09-23)

The Cutting's four regions now come from the same packer and the same §3 table
as the Driller floor and the gate. Reproduce with:

```powershell
node --import tsx scripts/art/quarry-route-ground.ts cutting
```

The Cutting is the gate's road layout cut between ledges, so it takes the
gate's reading of that layout rather than the Driller's. If `,` were painted as
earth like the Driller's `.`, the lane and its shoulders would merge into one
plane and the approved road would vanish. So `=` is packed earth with one haul
track down each of the two one-row lanes (rows 4 and 7), `,` is spoil carrying
inked heaps of cut stone (limestone body, block rim), and `^`/`A` are cut-stone
block face. A heap is painted only if it fits wholly on plain spoil, so none is
clipped by the lane or a ledge. Rubble diamonds are inked even on spoil of their
own material, because a pile is an object on the floor. The Driller's and the
gate's plates are byte-identical to W3.

| Page        | Before (B) | After (B) | Delta (B) |
| ----------- | ---------: | --------: | --------: |
| `dirt-west` |     24,988 |    24,578 |      −410 |
| `dirt-east` |     22,760 |    25,408 |    +2,648 |
| `road`      |     64,366 |    28,396 |   −35,970 |
| `stone`     |     55,406 |    47,206 |    −8,200 |
| Total       |    167,520 |   125,588 |   −41,932 |

Every registered rectangle is unchanged. The east dirt page keeps its soft
`x=10` takeover over the west page's bleed; it is produced by the packer's
`softenDirtJoin`. `scripts/art/quarry-route-ground.test.ts` pins the Cutting's
bytes, its ink and the lane/shoulder split, and checks that every page's size
on disk equals the `bytes` recorded for it in `CUTTING_GROUND_REGIONS` and
`DRILLER_GROUND_REGIONS`.

## DL-2 W5 gate fixes (2026-09-23)

The W5 route-wide gate ranked three items before release. All three are fixed
in the packers; reproduce with:

```powershell
node --import tsx scripts/art/quarry-route-ground.ts cutting
node --import tsx scripts/art/quarry-route-ground.ts driller
node --import tsx scripts/art/quarry-modular-ground.ts
```

**Cover read backwards.** Real cover (legend `r`: `cover: true` and the rubble
surface) showed only as a faint inked spoil diamond, while the decorative heaps
beside it were whole inked limestone heaps, the loudest thing on the board.
Now:

- The decorative heaps are ground texture: about half their old size
  (`HEAP_SCALE`), no ink, and painted in the §3 spoil row alone — a flat body,
  the chip highlight along the lit upper edge and the spoil shadow along the
  front (`heapClass` in `quarry-village-material.ts`). They keep a clear margin
  from every other material (`HEAP_CLEARANCE`) and from every cover cell, and
  are drawn whole or not at all. The same change applies to the gate's terrace
  (`quarry-gate-registration.md`).
- Every `r` cell carries the route's one painted heap, the forest's
  `forest-scene/rubble.webp`, registered per cell in `quarryProjected.ts`
  (`CUTTING_RUBBLE_CELLS`, `DRILLER_RUBBLE_CELLS`, both listed in
  `paintedRubble` so the live wash stands down under the heap, as in the forest
  since PR 95). The pages no longer paint the cell as a diamond: they paint the
  floor the heap stands on and the heap's spill across it — spoil breaking up
  into the Driller's packed earth through `spillWins`, exactly as the forest's
  spill breaks up into the verge, and on the Cutting's spoil shoulders the spoil
  row the other way up (`spillMark`), so the fresh grit round the heap's foot
  still shows as a darker footprint on ground of its own material.

**The `x = 10` seam.** The two dirt pages met on the line and the east page
faded in over 0.08 of a tile, so wherever their compressed edges disagreed the
Cutting's procedural grass showed through. Both pages now paint the two
columns either side of the line (`DIRT_OVERLAP`); the west page is opaque
across both and the east page fades in across the middle of them
(`DIRT_FADE`), over identical painting.

**The Cutting's water.** The pool was a hole in every page, so the runtime drew
it as a flat teal rectangle — a third water style on the route. It now has its
own plate, `cutting-scene/pool-bank.webp`, packed by the forest pond's own
packer (`packShoreline`, now parametrised by the pond it banks) in the same §3
keys: bed `#2a5e77` pooling to `#173b4c`, the damp margin `#8e7049` round it
and gone wet where the bank bites into the water, the inked wet line and its
`#7ec8e3` edge. The quarry reads those tones from the forest's table rather
than restating them (`QUARRY_GROUND_TONES.margin`/`.bed`). The live water film
and its runtime bank band are unchanged.

The spoil row lives once, as `SPOIL_TONES` in `forest-village-material.ts`;
the forest's heap and spill and every quarry use of spoil read it from there.
If §3's spoil row is amended, that is one edit and a repack of the plates that
paint it (plus `TERRAIN_STYLES.sand` and `SURFACE_STYLES.rubble` in
`src/render/palettes.ts`, which the runtime holds separately).

| Page                      | Before (B) | After (B) | Delta (B) |
| ------------------------- | ---------: | --------: | --------: |
| Cutting `dirt-west`       |     24,578 |    26,388 |    +1,810 |
| Cutting `dirt-east`       |     25,408 |    26,300 |      +892 |
| Cutting `road`            |     28,396 |    28,402 |        +6 |
| Cutting `stone`           |     47,206 |    43,804 |    −3,402 |
| Cutting `pool-bank` (new) |          — |    13,184 |   +13,184 |
| Cutting total             |    125,588 |   138,078 |   +12,490 |
| Driller `dirt-west`       |     39,424 |    42,066 |    +2,642 |
| Driller `dirt-east`       |     39,836 |    42,132 |    +2,296 |
| Driller `stone`           |     43,512 |    39,282 |    −4,230 |
| Driller total             |    122,772 |   123,480 |      +708 |

The dirt pages' registered rectangles grow by the overlap: the Cutting's
`dirt-west` to 1218×612 and `dirt-east` to 1064×534 at (665, 332); the
Driller's `dirt-west` to 1282×644 and `dirt-east` to 1256×630 at (601, 300).
The pool plate is 832×448, drawn into (752, 368, 416×224). The heap plate adds
one distinct image to each scene. Both packers were run twice and produced
byte-identical files. `scripts/art/quarry-route-ground.test.ts` pins every
page and the pool plate to the packer and to its recorded size on disk
(`CUTTING_GROUND_REGIONS`, `DRILLER_GROUND_REGIONS`, `CUTTING_POOL_BYTES`).

**Not fixed here.** A faint band of the neighbouring terrain's colour still
runs just inside each cover cell's diamond. It is not a gap in the art: the
runtime's `drawSeams` paints the neighbour's `TERRAIN_STYLES` fill inside any
cell whose terrain differs from its neighbour's, and legend `r` is `sand` next
to the Cutting's `,` grass (and the Driller's `.` dirt). Setting the cell's
terrain to its neighbours' removes the band in a live probe. The fix belongs in
the renderer or the legend, outside this art change.
