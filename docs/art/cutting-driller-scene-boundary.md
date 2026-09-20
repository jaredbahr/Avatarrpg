# Cutting and Driller floor scene boundary

Ground registration is complete; no map registration has started. This follows
the southwest depth comparison and stays within the opening-through-Driller
slice. Use the established oblique `MapScene` contract and the existing 96px
runtime camera; do not replace the renderer or alter rules.

## Exact source geometry

Both maps are 20×12 and currently use orthographic backdrops at 80 pixels/tile.
The replacement must opt into the existing oblique scene contract. Ground source
is authored as projected chunks using `x=768+(x-y)*64`, `y=(x+y)*32`, then packed
to the same 1152×1280 west/east chunk rectangles used by `FOREST_ROAD_SCENE`.
That projected source is not a 20:12 backdrop: upright cliffs/terraces are
separate depth-owned `MapScene.scenery` slices with exact footprints and depths.
Preserve every row and tile coordinate.

The Cutting (`ambush_road`) mask is:

```text
AAAAAAA^^^^^^^AAAAAA
AA^^^,,,,,,,,,,^^^AA
^^,,,,,,r,,,,,,,,^^A
,,,,,,,,,,,,r,,,,,^^
====================
=====,,~~~~,,,,,====
=====,,~~~~,,,,,====
====================
,,,,,,r,,,,,,,,,,,^^
^^,,,,,,,,,,r,,,,^^A
AA^^^,,,,,,,,,,^^^AA
AAAAAAA^^^^^^^AAAAAA
```

Counts are A36, ^38, grass96, road58, rubble4, water8. The art should read as
a narrow rock cutting with stepped high walls at the edges, a continuous road,
the two-tile live water patch and four live rubble anchors. Keep party spawns at
(1,3),(3,4),(1,5),(3,6),(1,7),(3,8); no props are baked into the painting.

The Driller floor (`quarry_floor`) mask is:

```text
AAA^^..........^^AAA
AA^^....r..r....^^AA
^^.....oo..oo.....^^
.......oo..oo.......
..r.................
..........mm........
..........mm........
..r.................
.......oo..oo.......
^^.....oo..oo.....^^
AA^^....r..r....^^AA
AAA^^..........^^AAA
```

Counts are A20, ^24, dirt170, rubble6, oil16 and mud4. Paint a terraced quarry
pit with the open centre and four oil stone patches visibly distinct, while
leaving the centre mud patch and six rubble anchors available to the rules.
Keep the conditional cabbage cart at (9,6) as a live prop; do not paint it.

## Required files and ownership

Art owns two technical layout guides and two continuous transparent/ground
source paintings under `art/raw/maps/`, plus provenance and pack reports:

- `scripts/art/cutting-scene-guide.ts`, `scripts/art/driller-floor-guide.ts`
- `scripts/art/projected-scene-ground-pack.ts`
- `art/raw/cutting/ground-guide.svg`, `art/raw/cutting/scenery-guide.svg`
- `art/raw/driller/ground-guide.svg`, `art/raw/driller/scenery-guide.svg`
- registered `ground-west.webp` / `ground-east.webp` only after source review
- `src/content/scenes/cutting.ts`, `src/content/scenes/drillerFloor.ts` only
  after the source painting and ownership masks pass review

Gameplay owns only `MapDef.backdrop` projection opt-in/scene registration and
fallback tests. Existing rows, surfaces, cover/rubble, spawns, encounter props,
save data and pathfinding remain unchanged. If upright scenery is needed, use
registered `MapScene.scenery` slices with exact depth ownership; do not embed
actors, cart, oil, mud, water or rubble into the paintings.

## Budget and acceptance

The registered ground pages bring the map family to 3,846,608 bytes, leaving
347,696 bytes under 4 MiB. They use 230,894 bytes of the original 450,560-byte
combined reserve, leaving 219,666 bytes for transparent cliff slices and packing
variance while retaining at least 128,030 bytes of family headroom. Keep each
page ≤2048px per edge and retain the current 16-image scene cache envelope.
Validate served hashes, missing-page fallback, both renderers, 96px landscape,
portrait/high contrast and legal movement through every apparent route before
integrating.

The visual bar is the approved quarry reference: world fills the frame with
active industrial context, readable scale and connected paths. A fresh painting
that merely recolors the old orthographic arena is a failed source review. The
registered ground pages and measured source contract are recorded in
`docs/art/cutting-driller-ground-registration.md`. First review the two guides,
the ground batch and the later upright source locally; stop before gameplay
wiring or a second generation if the central open floor, live-surface anchors or
actor scale do not read at actual play zoom.
