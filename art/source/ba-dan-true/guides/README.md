# Ba Dan paint guides (1.5x)

`python scripts/art/ba-dan-guides/build.py` rebuilds the guides, masks, footprints and `pieces.json` here (PIL + numpy; `guidelib.py` renderer, `houses.py` the four houses, `pieces.py` the tables, planters and bridge,
`dressing.py` the dressing); `--sheets DIR` also writes the painter sheets to `DIR`. The houses are described in `README-houses.md`. See `../README.md` for the whole chain.

## Scale (new)

Every guide is rendered at **WORLD_SCALE = 1.5 output px per world px**, same geometry/projection as before (ground (x,y) -> X = 64(x-y), Y = 32(x+y), z straight up, all x1.5;
tile = 192x96 px in the guide). The scene should draw each guide at **2/3 (0.6667) of its pixel size** (`scene_draw_scale` in `pieces.json`) to land at world scale; the painted art
is then authored at the 1.5 screen px per world px the game shows. `anchor_front_corner_at_scene_scale_px` and `canvas_at_scene_scale` are the values after that 2/3.
Line widths are in output px (so lines are 1 to 2 px, crisper than before).

## Sizes (guide px, anchor = front corner of the footprint at the bottom of the plinth)

| piece                                     | footprint | canvas  | anchor     | canvas at scene scale | anchor at scene scale |
| ----------------------------------------- | --------- | ------- | ---------- | --------------------- | --------------------- |
| dwelling-4x3                              | 4x3       | 702x538 | (399, 523) | 468x358.7             | (266, 348.7)          |
| merchant-house-4x3                        | 4x3       | 702x508 | (399, 493) | 468x338.7             | (266, 328.7)          |
| dwelling-4x4                              | 4x4       | 798x574 | (399, 559) | 532x382.7             | (266, 372.7)          |
| merchant-house-4x4                        | 4x4       | 798x560 | (399, 545) | 532x373.3             | (266, 363.3)          |
| merchant-display (three baskets)          | 2x1       | 318x222 | (207, 207) | 212x148               | (138, 138)            |
| merchant-display-b (cloth bolts, jars)    | 2x1       | 318x242 | (207, 227) | 212x161               | (138, 151)            |
| merchant-display-c (sacks, hanging scale) | 2x1       | 318x244 | (207, 229) | 212x163               | (138, 153)            |
| low-planter                               | 2x1       | 318x212 | (207, 197) | 212x141               | (138, 131)            |
| low-planter-1x2 (turned)                  | 1x2       | 318x212 | (111, 197) | 212x141               | (74, 131)             |
| canal-bridge                              | 1x3       | 414x236 | (111, 221) | 276x157               | (74, 147)             |

Sheets (1536x1024, JSON beside each, `rect` / `anchor_front_corner` / `foot_polygon` in sheet px, pieces laid out with at least ~12 px between opaque pixels):
`sheet-a` dwelling 4x3 + merchant 4x3; `sheet-b` dwelling 4x4 + merchant 4x4 (staggered diagonally, they do not fit side by side at 798 px);
`sheet-c` the three tables, both planters, the bridge. Per piece: `<piece>-guide.png`, `-mask.png` (grey silhouette, blue plinth/stone, red footprint clipped to the silhouette),
`-footprint.png` (full unclipped quad). The comparison and placement-check images (`compare-r2-*`, `check*.png`) were scratch and are not kept.

## Orientation and placement

Ridge along y; long eave wall with door, windows and shop bay faces +x; timber gable faces +y. Door faces tile (x+w, y+d-1), steps in tile (x+w-1, y+d-1).
Placements: gao-house merchant 4x3 at (6,1); north-house dwelling 4x3 at (12,1); southwest-house dwelling 4x4 at (6,10); southeast-house merchant 4x4 at (13,10). The houses' proportions, yards
and households are in `README-houses.md`.

## Table variants (2x1)

`merchant-display`: three round baskets (frustum, hoops, rim) each with a mound outline of produce (red, green, yellow outlines). `merchant-display-b`: stack of three folded cloths, two upright cloth bolts, three jars of different sizes.
`merchant-display-c`: three tied sacks and a hanging scale (post 78 px, balance beam, two chained pans). Same footprint, legs and drawer shelf as before.

## Planters

Unchanged geometry (rim 26, capstones, soil bed) with the mound outline kept (base ellipse on the rim plane, two profile arcs, peak 16 px above). Floating outline strokes now count toward the
silhouette (in round 2 any stroke outside a filled polygon, e.g. the mound peak, was clipped from the guide).

## Bridge

Deck 1 tile wide (planks across x, seams every 0.1 tile along y) over the canal tile only (y 1..2) with 0.08 tile bearing on each bank, deck top z 15; low side beams (top z 21) on both sides;
four short posts (top z 35 plus a cap) at the deck corners; four abutment stones (two per bank, each 0.40 wide and 0.42 deep, 9 px tall, inside x 0.08..0.92 so none is wider than the path tile they sit on).
Footprint 1x3 at (9,5) unchanged. Planks run across x, deck spans y 0.92..2.08 of the piece. The deck is now about 1.16 tiles long instead of 2.0.

## Audit

Every tile-axis edge in every drawing is exactly +-0.5 (analytic, max deviation ~2e-14), verticals have dX 0; raster probes of each long axis edge fit |slope| 0.4967 to 0.5040 (pixel-quantised).
See `pieces.json` (`audit`, `proportions`, `dressing_spots`, `notes`). `foot_outside_silhouette_px` is 0 for the four houses; tables, planters and the bridge do not fill their tiles.
Guesses: window, shutter, lantern, awning sizes and the shelf contents are mine; the east kick fades over 0.6 tile; tile ribs every 0.2 tile.
