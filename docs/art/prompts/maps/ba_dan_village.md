# Map painting: Ba Dan Village (`ba_dan_village`)

**Deliver** one PNG of 1792×1288 pixels or a whole multiple of it (3584×2576 is the comfortable size to generate at), landscape 32:23, saved as `art/raw/maps/ba_dan_village.png`. `art:map` downsizes it with a box filter and never upscales.

**Ships as** `public/art/maps/ba_dan_village.webp`, 56 px a tile, under 1 MB.

**Map** `backdrop: { url: 'art/maps/ba_dan_village.webp', pixelsPerTile: 56 },` on the map's definition in `src/content/maps/`.

**Layout** `ba_dan_village-layout.png` beside this file: the tile grid as flat colour blocks at 32 px a tile, with the grid drawn. Hand it to the generator as the composition reference (image-to-image or a structure control) at a strength that keeps every edge where it is; upscale it to the delivery size first so the generator does not invent a border.

**Palette** hue anchors from the game's own ground (`src/render/palettes.ts`): wall `#3a352f`, stone `#d8cbb0`, grass `#6f9e4c`, wood `#6b4f33`, dirt `#b39064`, road `#b39064`, water deep `#1f4a5e`, still water `#3e8fb0`. The painting replaces those tones outright, so lighter and more saturated is fine; stay in the same families so the effects and the parchment HUD still read over it.

## Where

Ba Dan, a quarry village built from the pale stone of its own hill.

## The grid

32 columns by 23 rows, counted from 0 at the top-left corner. The painting is the ground and what stands on it, nothing else: the game draws its own grid, movement contours, units, props and effects over it, so every edge in the painting that matters to the rules sits exactly on a tile edge.

- Road (32 tiles): 28 tiles (middle right), row 8: columns 18–22; row 9: columns 18–31; row 10: columns 23–31; a 2×2 block at columns 13–14, rows 12–13 (the centre).
- Still water (58 tiles): 34 tiles (middle right), row 12: column 15; row 13: columns 15–31; row 14: columns 16–31; a 12×2 block at columns 1–12, rows 12–13 (middle left).
- Trees (116 tiles): 38 tiles (bottom left), rows 11–14: column 0; rows 15–20: columns 0–1; row 21: columns 0–3; row 22: columns 0–17; 32 tiles (bottom right), rows 15–17: columns 30–31; rows 18–20: columns 28 and 30–31; row 21: columns 27–31; row 22: columns 20–31; a 2×6 block at columns 30–31, rows 3–8 (top right); 10 tiles (top left), row 3: columns 0–2; rows 4–5: columns 0–1; rows 6–8: column 0; a 6×1 block at columns 10–15, row 2 (top centre); a 5×1 block at columns 22–26, row 1 (top right); a 2×2 block at columns 30–31, rows 11–12 (middle right); a 3×1 block at columns 16–18, row 1 (top centre); a 3×1 block at columns 3–5, row 2 (top left); a 3×1 block at columns 19–21, row 2 (top centre).
- Timber walls (99 tiles): 25 tiles (top right), row 4: columns 19–25; row 5: columns 19–28; row 6: columns 19–22 and 27–28; row 7: columns 27–28; a 5×3 block at columns 11–15, rows 4–6 (top centre); a 4×3 block at columns 8–11, rows 15–17 (bottom left); a 3×3 block at columns 2–4, rows 5–7 (top left); 9 tiles (bottom right), rows 16–17: columns 20–23; row 18: column 23; a 3×2 block at columns 3–5, rows 16–17 (bottom left); a 3×2 block at columns 15–17, rows 16–17 (bottom centre); a 3×2 block at columns 8–10, rows 19–20 (bottom left); a 3×2 block at columns 13–15, rows 19–20 (bottom centre); a 2×2 block at columns 26–27, rows 16–17 (bottom right); one tile at column 25, row 2 (top right).
- Stone walls (24 tiles): a 1×6 block at column 29, rows 3–8 (top right); a 1×6 block at column 29, rows 15–20 (bottom right); 3 tiles (middle left), row 9: column 0; row 10: columns 0–1; a 2×1 block at columns 5–6, row 6 (top left); a 2×1 block at columns 13–14, row 9 (the centre); a 1×2 block at column 29, rows 11–12 (middle right); one tile at column 21, row 7 (top right); one tile at column 25, row 7 (top right); one tile at column 5, row 8 (middle left).
- Cut quarry rock, two steps up (60 tiles): 60 tiles (top centre), row 0: columns 0–31; row 1: columns 0–6, 9–15, 19–21 and 27–31; row 2: columns 0–2 and 29–31.
- Ledges, one step up (11 tiles): 11 tiles (top left), row 1: columns 7–8; rows 2–3: columns 6–9; row 4: column 9.
- Open ground everywhere else: grass (210 tiles), bare earth (126 tiles).
- The party enters from the left, standing at (11, 10); enemies come from the right. The exit is at (31, 9). Paint nothing there that would read as an object to walk round.

The rows as the rules read them:

```
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXX^^XXXXXXXTTTXXXTTTTTXXXXX
XXXTTT^^^^TTTTTT,,,TTT,,,F...XXX
TTT,,,^^^^...................#TT
TT,,,,,,,S,BBBBB,,,BBBBBBF...#TT
TTBBB,,,,,,BBBBB,,,BBBBBBFFFF#TT
T,BBBll..,,BBBBB,,,BBBB,,,,BB#TT
T,BBB....,........,,,l,,,l,BB#TT
T,,,,l...,........=====,,,,,,lTT
W............ll...==============
WW,,,,,,,,........,,,,,=========
T,,,,,,,,.........,,,,,,,,,,,#TT
T~~~~~~~~~~~~==~,,,,,,,,,,,,,#TT
T~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~
T,..............~~~~~~~~~~~~~~~~
TT,,,,,,BBBB,................#TT
TT,BBB,,BBBB,,,BBB..BBBB,,BB,#TT
TT,BBB,,BBBB,,,BBB..BBBB,,BB,#TT
TT,,,,,,,,,,,,,,,,..,,,B,,,,T#TT
TT,,,,,,BBB,,BBB,,..,,,,,,,,T#TT
TT,,,,,,BBB,,BBB,,..,,,,,,,,T#TT
TTTT,,,,,,,,,,,,,,..,,,,,,,TTTTT
TTTTTTTTTTTTTTTTTT..TTTTTTTTTTTT
```

Legend: `X` cut quarry rock, two steps up; `^` ledges, one step up; `T` trees; `,` grass; `F` timber walls; `.` bare earth; `#` stone walls; `S` ledges, one step up; `B` timber walls; `l` stone walls; `=` road; `W` stone walls; `~` still water.

## Prompt

**Live surfaces:** the layout marks water, oil, mud and rubble that the game draws. Paint dry earth beneath water and mud, clean flat stone beneath oil, and only the fixed cover silhouette beneath rubble. Do not bake liquid, flame or smoke into the painting. Keep interactable props separate. Village houses are open cutaways: walls fill their blocking cells and plank interiors remain visible and clear.

> Top-down painted ground for a tactics battlefield, seen straight from above with the faintest three-quarter tilt so anything that stands up shows a sliver of its south face; north is up; every tile the same size; no perspective convergence, no horizon, no sky. A village on a hillside under a quarry. Cliff and trees close the top edge, with a dry-stone terrace on the left reached by a short flight of steps, and trees close the left and bottom edges. A road of flagstones runs in from the east edge through a gap in a low stone wall, past a shop with a storeroom and a stone trough on the road, and opens into a square at the middle of the picture. A long patched awning over a table stands at the near side of the square, in front of the largest house. A lane leaves the square to the left past a yard of cut stone blocks and a small house, and a path runs behind the house backs along the top, through a side gate in a garden fence on the right. A canal crosses the lower third from the left edge to the right, with a two-tile-wide stone bridge a little left of centre and washing steps on its near bank, and runs out under the east wall. South of the canal a row of small houses with doorsteps faces a lane, and a path leaves the bottom edge at the middle. A flooded ford closes the left edge of the road. Soft midday light, pale dust on the square, no long shadows. Painterly ground with soft transitions inside a region and clean edges between regions; a clean, uniform dark-brown ink line (`#1b1410`) only where an edge is drawn, never black; two flat tones plus a thin rim light per material on the things that stand up (rocks, trunks, walls, crates); evenly lit, no vignette, no darkened corners, no cast shadows longer than a tile. Nothing the game draws itself: no characters, no creatures, no barrels, carts or braziers, no user interface, no text, no border, no grid lines. Landscape 32:23, 3584×2576.

## Negative prompt

> characters, people, creatures, animals, text, letters, watermark, signature, logo, user interface, icons, grid, border, frame, vignette, perspective, horizon, sky, isometric, 3D render, photograph, blur, depth of field, lens flare, glow, gradients

## Commands

```
npm run art:map -- --map ba_dan_village --px 56
npm run art:validate
npm run check:assets
```

Then put the `backdrop` line above on the map, run `npm run verify`, and open the village in the game.

## Check

- [ ] Settings, Show grid on: the road edges, banks, ledges and walls in the painting sit on the tile lines, and nothing that matters is cut by one
- [ ] Every feature in the grid section is there, and nothing the game places (units, props) is painted in
- [ ] The live surfaces read over it: a puddle is tinted by the game, fire burns on it, a ledge still shows its step under High contrast
- [ ] Even light edge to edge: no vignette, no dark corners (the game adds its own shading round the board)
- [ ] Ink is dark brown, never black; no text, watermark or border
- [ ] Under 1 MB as WebP; `npm run art:validate` and `npm run check:assets` pass
- [ ] Looked at on the tablet at the fitted zoom and pinched to the largest, on both renderers (`?renderer=canvas`, `?renderer=webgl`)
