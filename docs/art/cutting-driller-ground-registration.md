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
dry underlay. `scripts/art/quarry-route-ground.ts` applies the ramp for future
packs; `scripts/art/soften-quarry-dirt-join.ts` reproduces it from the approved
shipped pages when the historical raw source is unavailable. Runtime oil, mud,
and water remain transparent because the repair only reduces nonzero dirt alpha.
