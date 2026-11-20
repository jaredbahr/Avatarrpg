# Map painting: The River Road (`river_road`)

**Deliver** one PNG of 1920×672 pixels or a whole multiple of it (3840×1344 is the comfortable size to generate at), landscape 20:7, saved as `art/raw/maps/river_road.png`. `art:map` downsizes it with a box filter and never upscales.

**Ships as** `public/art/maps/river_road.webp`, 48 px a tile, under 1 MB.

**Map** `backdrop: { url: 'art/maps/river_road.webp', pixelsPerTile: 48 },` on the map's definition in `src/content/maps/`.

**Layout** `river_road-layout.png` beside this file: the tile grid as flat colour blocks at 32 px a tile, with the grid drawn. Hand it to the generator as the composition reference (image-to-image or a structure control) at a strength that keeps every edge where it is; upscale it to the delivery size first so the generator does not invent a border.

**Palette** hue anchors from the game's own ground (`src/render/palettes.ts`): grass `#6f9e4c`, water deep `#1f4a5e`, wall `#3a352f`, stone `#d8cbb0`, dirt `#b39064`, wood `#6b4f33`, road `#b39064`, sand `#c7a87d`, still water `#3e8fb0`. The painting replaces those tones outright, so lighter and more saturated is fine; stay in the same families so the effects and the parchment HUD still read over it.

## Where

The river road, the cart road up the river from the coast to Causeway, a day long.

## The grid

40 columns by 14 rows, counted from 0 at the top-left corner. The painting is the ground and what stands on it, nothing else: the game draws its own grid, movement contours, units, props and effects over it, so every edge in the painting that matters to the rules sits exactly on a tile edge.

- Road (76 tiles): 38 tiles (middle right), row 3: columns 32–39; row 4: columns 30–39; row 5: columns 21–31; row 6: columns 21–29; a 19×2 block at columns 0–18, rows 5–6 (middle left).
- Still water (2 tiles): a 2×1 block at columns 20–21, row 8 (the centre).
- Trees (51 tiles): 33 tiles (top left), row 0: columns 0–16; row 1: columns 0–2, 4–7 and 12–15; row 2: columns 0–1, 5–6 and 14; 15 tiles (top centre), row 0: columns 20–28; row 1: columns 24–28; row 2: column 27; one tile at column 10, row 3 (top left); one tile at column 26, row 7 (the centre); one tile at column 23, row 8 (the centre).
- Timber walls (3 tiles): one tile at column 25, row 2 (top centre); one tile at column 12, row 3 (top left); one tile at column 23, row 3 (top centre).
- Stone walls (170 tiles): 157 tiles (bottom centre), row 9: columns 1, 20–21 and 33–39; row 10: columns 0–5, 9–15, 20–21 and 28–39; rows 11–13: columns 0–39; 11 tiles (top centre), row 0: columns 17–19; rows 1–2: columns 18–19; rows 3–4: columns 19–20; a 2×1 block at columns 19–20, row 7 (the centre).
- Cut quarry rock, two steps up (13 tiles): 13 tiles (top right), rows 0–1: columns 29–33; row 2: columns 30–32.
- Ledges, one step up (10 tiles): a 5×2 block at columns 35–39, rows 1–2 (top right).
- Sand (18 tiles): a 6×2 block at columns 22–27, rows 9–10 (bottom centre); a 6×1 block at columns 4–9, row 9 (bottom left).
- Plank floors (7 tiles): a 2×2 block at columns 19–20, rows 5–6 (the centre); a 3×1 block at columns 6–8, row 10 (bottom left).
- Open ground everywhere else: grass (190 tiles), bare earth (20 tiles).
- The party enters from the left, standing at (1, 5), (1, 6), (2, 5), (2, 6), (3, 5), (3, 6); enemies come from the right. Paint nothing there that would read as an object to walk round.

The rows as the rules read them:

```
TTTTTTTTTTTTTTTTTWWWTTTTTTTTTXXXXX,,,,,,
TTT,TTTT,,,,TTTT,,WW,,,,TTTTTXXXXX,^^^^^
TT,,,TT,,,,,,,T,,,WW,,...F.T,,XXX,,S^^^^
,,,,,,,,,,T,F,,,,,,WW,.F...,,,,,========
,,,,,,,,,.....,,,,,WW,.....,,,==========
===================ww===========,,,,,,,,
===================ww=========,,,,,,,,,,
,,,,,,,.,,,,,,,,,,,WW,,,,,U,,,,,,,,,,,,,
,,,,,,,.,,,,,,,,,,,,~~,U,,,,,,,,,,,,,,,,
,W,,::::::,,,,,,,,,,WW::::::,,,,,WWWWWWW
WWWWWWwwwWWWWWWW,,,,WW::::::WWWWWWWWWWWW
WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW
WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW
WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW
```

Legend: `T` trees; `W` stone walls; `X` cut quarry rock, two steps up; `,` grass; `^` ledges, one step up; `.` bare earth; `F` timber walls; `S` ledges, one step up; `=` road; `w` plank floors; `U` trees; `~` still water; `:` sand.

## Prompt

**Live surfaces:** the layout marks water, oil, mud and rubble that the game draws. Paint dry earth beneath water and mud, clean flat stone beneath oil, and only the fixed cover silhouette beneath rubble. Do not bake liquid, flame or smoke into the painting. Keep interactable props separate. Village houses are open cutaways: walls fill their blocking cells and plank interiors remain visible and clear.

> Top-down painted ground for a tactics battlefield, seen straight from above with the faintest three-quarter tilt so anything that stands up shows a sliver of its south face; north is up; every tile the same size; no perspective convergence, no horizon, no sky. A packed-earth road runs left to right across the middle, a wide slow river along the whole bottom edge and a wooded hillside along the top. Halfway along, a side stream comes down from the hills to the river; a plank bridge carries the road over it, with stepping stones a little downstream. A big shade tree and a trough stand by the road on the left, a footpath leads down to a small jetty, and a camp with a cold fire sits past the bridge. At the right the road climbs past a rock face to a rise looking out over open country. Bright morning light, a little haze over the river. Painterly ground with soft transitions inside a region and clean edges between regions; a clean, uniform dark-brown ink line (`#1b1410`) only where an edge is drawn, never black; two flat tones plus a thin rim light per material on the things that stand up (rocks, trunks, walls, crates); evenly lit, no vignette, no darkened corners, no cast shadows longer than a tile. Nothing the game draws itself: no characters, no creatures, no barrels, carts or braziers, no user interface, no text, no border, no grid lines. Landscape 20:7, 3840×1344.

## Negative prompt

> characters, people, creatures, animals, text, letters, watermark, signature, logo, user interface, icons, grid, border, frame, vignette, perspective, horizon, sky, isometric, 3D render, photograph, blur, depth of field, lens flare, glow, gradients

## Commands

```
npm run art:map -- --map river_road --px 48
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
