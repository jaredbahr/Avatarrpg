# Map painting: The Quarry Gate (`quarry_gate`)

**Deliver** one PNG of 1600×960 pixels or a whole multiple of it (3200×1920 is the comfortable size to generate at), landscape 5:3, saved as `art/raw/maps/quarry_gate.png`. `art:map` downsizes it with a box filter and never upscales.

**Ships as** `public/art/maps/quarry_gate.webp`, 80 px a tile, under 1 MB.

**Map** `backdrop: { url: 'art/maps/quarry_gate.webp', pixelsPerTile: 80 },` on the map's definition in `src/content/maps/`.

**Layout** `quarry_gate-layout.png` beside this file: the tile grid as flat colour blocks at 32 px a tile, with the grid drawn. Hand it to the generator as the composition reference (image-to-image or a structure control) at a strength that keeps every edge where it is; upscale it to the delivery size first so the generator does not invent a border.

**Palette** hue anchors from the game's own ground (`src/render/palettes.ts`): stone `#d8cbb0`, wall `#3a352f`, dirt `#b39064`, wood `#6b4f33`, road `#b39064`. The painting replaces those tones outright, so lighter and more saturated is fine; stay in the same families so the effects and the parchment HUD still read over it.

## Where

The gate of a stone quarry, its yard and the road that runs through it.

## The grid

20 columns by 12 rows, counted from 0 at the top-left corner. The painting is the ground and what stands on it, nothing else: the game draws its own grid, movement contours, units, props and effects over it, so every edge in the painting that matters to the rules sits exactly on a tile edge.

- Road (36 tiles): a 11×2 block at columns 0–10, rows 5–6 (middle left); a 7×2 block at columns 13–19, rows 5–6 (middle right).
- Stone walls (32 tiles): 8 tiles (top centre), row 0: columns 4–9; row 1: columns 4 and 9; 8 tiles (top right), row 0: columns 12–17; row 1: columns 12 and 17; 8 tiles (bottom centre), row 10: columns 4 and 9; row 11: columns 4–9; 8 tiles (bottom right), row 10: columns 12 and 17; row 11: columns 12–17.
- Ledges, one step up (36 tiles): 11 tiles (top left), rows 0–1: columns 0–3; row 2: columns 0–2; 11 tiles (bottom left), row 9: columns 0–2; rows 10–11: columns 0–3; 7 tiles (top right), rows 0–2: columns 18–19; row 3: column 19; 7 tiles (bottom right), row 8: column 19; rows 9–11: columns 18–19.
- Crates and cover (4 tiles): one tile at column 13, row 2 (top right); one tile at column 5, row 3 (top left); one tile at column 5, row 8 (bottom left); one tile at column 14, row 9 (bottom right).
- Spilled oil (12 tiles): 12 tiles (the centre), rows 3–4 and 7–8: columns 10–11; rows 5–6: columns 11–12.
- Open ground everywhere else: bare earth (120 tiles).
- The party enters from the left, standing at (1, 3), (3, 4), (1, 5), (3, 6), (1, 7), (3, 8); enemies come from the right. Paint nothing there that would read as an object to walk round.

The rows as the rules read them:

```
^^^^######..######^^
^^^^#....#..#....#^^
^^^..........c....^^
.....c....oo.......^
..........oo........
===========oo=======
===========oo=======
..........oo........
.....c....oo.......^
^^^...........c...^^
^^^^#....#..#....#^^
^^^^######..######^^
```

Legend: `^` ledges, one step up; `#` stone walls; `.` bare earth; `c` crates and cover; `o` spilled oil; `=` road.

## Prompt

**Live surfaces:** the layout marks water, oil, mud and rubble that the game draws. Paint dry earth beneath water and mud, clean flat stone beneath oil, and only the fixed cover silhouette beneath rubble. Do not bake liquid, flame or smoke into the painting. Keep interactable props separate. Village houses are open cutaways: walls fill their blocking cells and plank interiors remain visible and clear.

> Top-down painted ground for a tactics battlefield, seen straight from above with the faintest three-quarter tilt so anything that stands up shows a sliver of its south face; north is up; every tile the same size; no perspective convergence, no horizon, no sky. A yard of hard-packed pale earth with a two-lane road of flagstones crossing it left to right through the middle. A stripe of clean flat grey stone two tiles wide runs top to bottom across the middle of the yard, stepping one tile to the right where it crosses the road; the game draws oil over it. Two gatehouses of dressed grey stone stand at the top and two at the bottom: each a hollow rectangle of wall round a small floor of earth, the pairs leaving a gap between them where the road out of the quarry passes. Stone ledges step up in all four corners and in short runs along the left and right edges. Four wooden crates stand as cover on the earth, two above the road and two below. Flat noon light; dust on everything, no shadows longer than a tile. Painterly ground with soft transitions inside a region and clean edges between regions; a clean, uniform dark-brown ink line (`#1b1410`) only where an edge is drawn, never black; two flat tones plus a thin rim light per material on the things that stand up (rocks, trunks, walls, crates); evenly lit, no vignette, no darkened corners, no cast shadows longer than a tile. Nothing the game draws itself: no characters, no creatures, no barrels, carts or braziers, no user interface, no text, no border, no grid lines. Landscape 5:3, 3200×1920.

## Negative prompt

> characters, people, creatures, animals, text, letters, watermark, signature, logo, user interface, icons, grid, border, frame, vignette, perspective, horizon, sky, isometric, 3D render, photograph, blur, depth of field, lens flare, glow, gradients

## Commands

```
npm run art:map -- --map quarry_gate --px 80
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
