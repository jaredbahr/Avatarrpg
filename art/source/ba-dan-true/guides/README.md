# Ba Dan paint guides, round 3 (1.5x, taller wall, four households)

`python scripts/art/ba-dan-guides/build.py` rebuilds the guides, masks, footprints and `pieces.json` here (PIL + numpy; `guidelib.py` renderer, `pieces.py` geometry, `meas.py` proportion probe); `--sheets DIR` also writes the painter sheets to `DIR`.
The round-2 guides, comparison images and the placement check these notes once mentioned were scratch and are not kept. See `../README.md` for the whole chain.

## Scale (new)

Every guide is rendered at **WORLD_SCALE = 1.5 output px per world px**, same geometry/projection as before (ground (x,y) -> X = 64(x-y), Y = 32(x+y), z straight up, all x1.5;
tile = 192x96 px in the guide). The scene should draw each guide at **2/3 (0.6667) of its pixel size** (`scene_draw_scale` in `pieces.json`) to land at world scale; the painted art
is then authored at the 1.5 screen px per world px the game shows. `anchor_front_corner_at_scene_scale_px` and `canvas_at_scene_scale` are the values after that 2/3.
Line widths are in output px (so lines are 1 to 2 px, crisper than before).

## Sizes (guide px, anchor = front corner of the footprint at the bottom of the plinth)

| piece                                     | footprint | canvas  | anchor     | canvas at scene scale | anchor at scene scale |
| ----------------------------------------- | --------- | ------- | ---------- | --------------------- | --------------------- |
| dwelling-4x3                              | 4x3       | 702x576 | (399, 561) | 468x384               | (266, 374)            |
| merchant-house-4x3                        | 4x3       | 702x576 | (399, 561) | 468x384               | (266, 374)            |
| dwelling-4x4                              | 4x4       | 798x624 | (399, 609) | 532x416               | (266, 406)            |
| merchant-house-4x4                        | 4x4       | 798x624 | (399, 609) | 532x416               | (266, 406)            |
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

## Orientation and placement (unchanged)

Ridge along y; long eave wall with door, windows and shop bay faces +x; timber gable faces +y. Door faces tile (x+w, y+d-1), steps in tile (x+w-1, y+d-1).
Placements: gao-house merchant 4x3 at (6,1); north-house dwelling 4x3 at (12,1); southwest-house dwelling 4x4 at (6,10); southeast-house merchant 4x4 at (13,10).
Footprint: body depth is now 1.7 tiles in x, so the 26 px plinth (ledges 0.25 west/north/south, 0.45 east porch) covers only the east part; **the rest of the footprint westward
(about 1.6 tiles, behind the house) is a low 8 px stone terrace** to be painted as paving or yard. It is behind the house; from the front it shows left of the gable.

## Wall / roof proportions (world px, measured on the guide)

- Plinth 26; eave line (wall top) z 140 (plinth + 114 of wall); ridge z 186 (rise 46); roof tip on the door side z 131.9 (overhang +x 0.15 tile, other sides 0.15 to 0.20); corner kick 8 px over 0.6 tile.
- Door opening 62 + lintel 8 (top z 96, cap z 99); windows z 56 to 92 with frame/sill; the eave tip reads at wall-plane z about 127 and the round rafter ends bottom out at z about 116, so
  **about 17 world px of plaster show above the lintel**, more above the windows.
- Measured on the raster (`meas.py`: tagged roof pixels in one screen column just north of the door, wall plane): **visible near roof plane 123 world px (185 guide px) tall; wall + plinth
  below it, eave edge to ground 146 world px (219 guide px): ratio 0.84.** (Round 2: 119 vs 122, ratio 0.98.)
- How it got there: roof screen height is 64 px per tile of body depth/2 plus the rise, so the body depth was cut from 3.0 to 1.7 tiles, with eave 140 and rise 46 (the brief said about 50).
  The cost: with a shallower body the far (west) slope is steeper than the 32 px/tile screen slope of the ground, so it shows as a band beyond the ridge. Measured visible band **about 10 world px (16 guide px)**.
  It cannot be shrunk to nothing without a deeper body (roof taller) or a lopsided gable; say if you want a different trade.

## Households (four, no shared dressing)

All houses: gently upturned eave corners, ridge beam with a row of ridge tiles and a stepped ornament at each end, round rafter ends under the eave on the +x face, plank door with lintel cap and a
threshold stone, a veranda stair spanning the door bay (frame to frame plus 0.04 tile each side, three steps), shuttered windows (open shutters flat on the wall, sill stones), a shuttered gable window.
Attachment spots on the plinth ledge are simple solids (prisms, boxes) for the painter to turn into set dressing:

| piece                                                                                                                                                                                                           | household                    | spots                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dwelling-4x3                                                                                                                                                                                                    | potter's, jars               | three jars of different sizes on the east ledge in front of the two windows; a lidded jar on the south ledge; lantern on a bracket south of the door                    |
| dwelling-4x4                                                                                                                                                                                                    | woodcutter's, wood and broom | firewood stack (3 rows of log ends) at the north end of the east ledge; broom leaning on the wall; name board on the wall between windows and door                      |
| merchant-house-4x3                                                                                                                                                                                              | rain barrel and bench        | barrel at the SE corner of the plinth; bench along the south ledge; lantern on a bracket by the door                                                                    |
| merchant-house-4x4                                                                                                                                                                                              | crates                       | stacked crates at the north end of the east ledge; two crates on the south ledge; hanging name board (bracket arm, blank panel) in the wall space north of the shop bay |
| Dwellings have two windows on the +x wall. Merchants: open shop bay (jambs, dark opening, two shelves with jar silhouettes), a counter on the ledge (three board lines on its face) and an awning on two posts, |
| **sloped 34 px over 0.40 tile** (top z 120 at the wall, lip z 86, valance 8 px, side flap, six seams down the slope); the bay is 1.0 tile wide on 4x3 and 1.5 on 4x4.                                           |

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
