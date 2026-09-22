# Map painting: The Forest Road (`forest_road`)

**Deliver** one PNG of 1600×960 pixels or a whole multiple of it (3200×1920 is the comfortable size to generate at), landscape 5:3, saved as `art/raw/maps/forest_road.png`. `art:map` downsizes it with a box filter and never upscales.

**Ships as** `public/art/maps/forest_road.webp`, 80 px a tile, under 1 MB.

**Map** `backdrop: { url: 'art/maps/forest_road.webp', pixelsPerTile: 80 },` on the map's definition in `src/content/maps/`.

**Layout** `forest_road-layout.png` beside this file: the tile grid as flat colour blocks at 32 px a tile, with the grid drawn. Hand it to the generator as the composition reference (image-to-image or a structure control) at a strength that keeps every edge where it is; upscale it to the delivery size first so the generator does not invent a border.

**Palette** hue anchors from the game's own ground (`src/render/palettes.ts`): grass `#6f9e4c`, stone `#d8cbb0`, road `#b39064`, dirt `#b39064`, still water `#3e8fb0`. The painting replaces those tones outright, so lighter and more saturated is fine; stay in the same families so the effects and the parchment HUD still read over it.

## Where

A road through lowland woods a day out of the village, where the party is first waylaid.

## The grid

20 columns by 12 rows, counted from 0 at the top-left corner. The painting is the ground and what stands on it, nothing else: the game draws its own grid, movement contours, units, props and effects over it, so every edge in the painting that matters to the rules sits exactly on a tile edge.

- Road (68 tiles): 68 tiles (the centre), rows 4 and 8: columns 0–19; rows 5 and 7: columns 0–4 and 7–11; row 6: columns 0–3 and 8–11.
- Still water (8 tiles): 8 tiles (middle left), rows 5 and 7: columns 5–6; row 6: columns 4–7.
- Trees (15 tiles): 3 tiles (top left), row 0: columns 0–1; row 1: column 0; 3 tiles (top right), row 0: columns 18–19; row 1: column 19; 3 tiles (bottom left), row 10: column 0; row 11: columns 0–1; 3 tiles (bottom right), row 10: column 19; row 11: columns 18–19; one tile at column 8, row 0 (top centre); one tile at column 14, row 1 (top right); one tile at column 14, row 10 (bottom right).
- Ledges, one step up (6 tiles): 3 tiles (top right), row 2: column 19; row 3: columns 18–19; 3 tiles (middle right), row 5: columns 18–19; row 6: column 19.
- Heaps of tumbled rock (2 tiles): one tile at column 7, row 3 (top centre); one tile at column 8, row 9 (bottom centre).
- Open ground everywhere else: grass (141 tiles).
- The party enters from the left, standing at (1, 3), (3, 4), (1, 5), (3, 6), (1, 7), (3, 8); enemies come from the right. Paint nothing there that would read as an object to walk round.

The rows as the rules read them:

```
TT,,,,,,T,,,,,,,,,TT
T,,,,,,,,,,,,,T,,,,T
,,,,,,,,,,,,,,,,,,,^
,,,,,,,r,,,,,,,,,,^^
====================
=====~~=====,,,,,,^^
====~~~~====,,,,,,,^
=====~~=====,,,,,,,,
====================
,,,,,,,,r,,,,,,,,,,,
T,,,,,,,,,,,,,T,,,,T
TT,,,,,,,,,,,,,,,,TT
```

Legend: `T` trees; `,` grass; `^` ledges, one step up; `r` heaps of tumbled rock; `=` road; `~` still water.

## Prompt

**Live surfaces:** the layout marks water, oil, mud and rubble that the game draws. Paint dry earth beneath water and mud, clean flat stone beneath oil, and only the fixed cover silhouette beneath rubble. Do not bake liquid, flame or smoke into the painting. Keep interactable props separate. Village houses are open cutaways: walls fill their blocking cells and plank interiors remain visible and clear.

> Top-down painted ground for a tactics battlefield, seen straight from above with the faintest three-quarter tilt so anything that stands up shows a sliver of its south face; north is up; every tile the same size; no perspective convergence, no horizon, no sky. A wide road of packed earth crosses the whole picture left to right through the middle, five tiles deep. In its left half a rough diamond of dry bare earth marks the substrate for a live pond just left of centre; leave its interior empty. In its right half a grassy island splits the road into two lanes, one above it and one below. Grass fills the top and bottom thirds, meadow with the odd fallen branch. Trees with round canopies stand in all four corners, one alone near the top centre, and two more standing out from the right-hand corners, one near the top and one near the bottom. Along the right edge a low ledge of grey stone steps up out of the grass. Two heaps of tumbled rock sit in the open grass, one above the road toward the left, one below it near the middle. Late morning under thin cloud: even light, no long shadows. Painterly ground with soft transitions inside a region and clean edges between regions; a clean, uniform dark-brown ink line (`#1b1410`) only where an edge is drawn, never black; two flat tones plus a thin rim light per material on the things that stand up (rocks, trunks, walls, crates); evenly lit, no vignette, no darkened corners, no cast shadows longer than a tile. Nothing the game draws itself: no characters, no creatures, no barrels, carts or braziers, no user interface, no text, no border, no grid lines. Landscape 5:3, 3200×1920.

## Negative prompt

> characters, people, creatures, animals, text, letters, watermark, signature, logo, user interface, icons, grid, border, frame, vignette, perspective, horizon, sky, isometric, 3D render, photograph, blur, depth of field, lens flare, glow, gradients

## Commands

```
npm run art:map -- --map forest_road --px 80
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
