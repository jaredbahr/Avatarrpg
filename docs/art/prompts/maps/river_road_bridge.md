# Map painting: The Plank Bridge (`river_road_bridge`)

**Deliver** one PNG of 1824×1152 pixels or a whole multiple of it (3648×2304 is the comfortable size to generate at), landscape 19:12, saved as `art/raw/maps/river_road_bridge.png`. `art:map` downsizes it with a box filter and never upscales.

**Ships as** `public/art/maps/river_road_bridge.webp`, 96 px a tile, under 1 MB.

**Map** `backdrop: { url: 'art/maps/river_road_bridge.webp', pixelsPerTile: 96 },` on the map's definition in `src/content/maps/`.

**Layout** `river_road_bridge-layout.png` beside this file: the tile grid as flat colour blocks at 32 px a tile, with the grid drawn. Hand it to the generator as the composition reference (image-to-image or a structure control) at a strength that keeps every edge where it is; upscale it to the delivery size first so the generator does not invent a border.

**Palette** hue anchors from the game's own ground (`src/render/palettes.ts`): grass `#6f9e4c`, water deep `#1f4a5e`, wall `#3a352f`, dirt `#b39064`, wood `#6b4f33`, road `#b39064`, sand `#c7a87d`, still water `#3e8fb0`. The painting replaces those tones outright, so lighter and more saturated is fine; stay in the same families so the effects and the parchment HUD still read over it.

## Where

The plank bridge on the river road, where a quarry corporal and his guards have put a pole across it.

## The grid

19 columns by 12 rows, counted from 0 at the top-left corner. The painting is the ground and what stands on it, nothing else: the game draws its own grid, movement contours, units, props and effects over it, so every edge in the painting that matters to the rules sits exactly on a tile edge.

- Road (34 tiles): 20 tiles (middle right), row 4: column 18; row 5: columns 9–18; row 6: columns 9–17; a 7×2 block at columns 0–6, rows 5–6 (middle left).
- Still water (2 tiles): a 2×1 block at columns 8–9, row 8 (bottom centre).
- Trees (27 tiles): 15 tiles (top centre), row 0: columns 8–16; row 1: columns 12–16; row 2: column 15; 10 tiles (top left), row 0: columns 0–4; row 1: columns 0–3; row 2: column 2; one tile at column 14, row 7 (middle right); one tile at column 11, row 8 (bottom centre).
- Timber walls (3 tiles): one tile at column 13, row 2 (top right); one tile at column 0, row 3 (top left); one tile at column 11, row 3 (top centre).
- Stone walls (43 tiles): 30 tiles (bottom centre), row 9: columns 8–9; row 10: columns 0–3, 8–9 and 16–18; row 11: columns 0–18; 11 tiles (top centre), row 0: columns 5–7; rows 1–2: columns 6–7; rows 3–4: columns 7–8; a 2×1 block at columns 7–8, row 7 (the centre).
- Cut quarry rock, two steps up (5 tiles): 5 tiles (top right), rows 0–1: columns 17–18; row 2: column 18.
- Sand (12 tiles): a 6×2 block at columns 10–15, rows 9–10 (bottom right).
- Plank floors (4 tiles): a 2×2 block at columns 7–8, rows 5–6 (the centre).
- Open ground everywhere else: grass (83 tiles), bare earth (15 tiles).
- The party enters from the left, standing at (3, 5), (3, 6), (2, 5), (2, 6), (2, 4), (2, 7); enemies come from the right. Paint nothing there that would read as an object to walk round.

The rows as the rules read them:

```
TTTTTWWWTTTTTTTTTXX
TTTT,,WW,,,,TTTTTXX
,,T,,,WW,,...F.T,,X
F,,,,,,WW,.F...,,,,
..,,,,,WW,.....,,,=
=======ww==========
=======ww=========,
,,,,,,,WW,,,,,U,,,,
,,,,,,,,~~,U,,,,,,,
,,,,,,,,WW::::::,,,
WWWW,,,,WW::::::WWW
WWWWWWWWWWWWWWWWWWW
```

Legend: `T` trees; `W` stone walls; `X` cut quarry rock, two steps up; `,` grass; `.` bare earth; `F` timber walls; `=` road; `w` plank floors; `U` trees; `~` still water; `:` sand.

## Prompt

**Live surfaces:** the layout marks water, oil, mud and rubble that the game draws. Paint dry earth beneath water and mud, clean flat stone beneath oil, and only the fixed cover silhouette beneath rubble. Do not bake liquid, flame or smoke into the painting. Keep interactable props separate. Village houses are open cutaways: walls fill their blocking cells and plank interiors remain visible and clear.

> Top-down painted ground for a tactics battlefield, seen straight from above with the faintest three-quarter tilt so anything that stands up shows a sliver of its south face; north is up; every tile the same size; no perspective convergence, no horizon, no sky. A packed-earth road crosses the middle left to right and runs over a plank bridge where a side stream comes down from wooded hills along the top. A striped pole lies across the bridge. Past it, above the road on the right, a small camp: a cold fire ringed with stones, bedrolls, a cook pot and stacked crates. Two rows below the bridge the stream runs shallow over stepping stones, a fallen log beside them. A wide slow river runs along the bottom edge, gravel bars at its edge, and a grey rock face rises at the top-right corner. Bright morning light, a little haze over the river. Painterly ground with soft transitions inside a region and clean edges between regions; a clean, uniform dark-brown ink line (`#1b1410`) only where an edge is drawn, never black; two flat tones plus a thin rim light per material on the things that stand up (rocks, trunks, walls, crates); evenly lit, no vignette, no darkened corners, no cast shadows longer than a tile. Nothing the game draws itself: no characters, no creatures, no barrels, carts or braziers, no user interface, no text, no border, no grid lines. Landscape 19:12, 3648×2304.

## Negative prompt

> characters, people, creatures, animals, text, letters, watermark, signature, logo, user interface, icons, grid, border, frame, vignette, perspective, horizon, sky, isometric, 3D render, photograph, blur, depth of field, lens flare, glow, gradients

## Commands

```
npm run art:map -- --map river_road_bridge --px 96
npm run art:validate
npm run check:assets
```

Then put the `backdrop` line above on the map, run `npm run verify`, and open the fight in the game.

## Check

- [ ] Settings, Show grid on: the road edges, banks, ledges and walls in the painting sit on the tile lines, and nothing that matters is cut by one
- [ ] Every feature in the grid section is there, and nothing the game places (units, props) is painted in
- [ ] The live surfaces read over it: a puddle is tinted by the game, fire burns on it, a ledge still shows its step under High contrast
- [ ] Even light edge to edge: no vignette, no dark corners (the game adds its own shading round the board)
- [ ] Ink is dark brown, never black; no text, watermark or border
- [ ] Under 1 MB as WebP; `npm run art:validate` and `npm run check:assets` pass
- [ ] Looked at on the tablet at the fitted zoom and pinched to the largest, on both renderers (`?renderer=canvas`, `?renderer=webgl`)
