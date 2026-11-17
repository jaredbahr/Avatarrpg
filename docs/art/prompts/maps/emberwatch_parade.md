# Map painting: Emberwatch (`emberwatch_parade`)

**Deliver** one PNG of 1920×1280 pixels or a whole multiple of it (3840×2560 is the comfortable size to generate at), landscape 3:2, saved as `art/raw/maps/emberwatch_parade.png`. `art:map` downsizes it with a box filter and never upscales.

**Ships as** `public/art/maps/emberwatch_parade.webp`, 80 px a tile, under 1 MB.

**Map** `backdrop: { url: 'art/maps/emberwatch_parade.webp', pixelsPerTile: 80 },` on the map's definition in `src/content/maps/`.

**Layout** `emberwatch_parade-layout.png` beside this file: the tile grid as flat colour blocks at 32 px a tile, with the grid drawn. Hand it to the generator as the composition reference (image-to-image or a structure control) at a strength that keeps every edge where it is; upscale it to the delivery size first so the generator does not invent a border.

**Palette** hue anchors from the game's own ground (`src/render/palettes.ts`): grass `#6f9e4c`, wall `#3a352f`, sand `#c7a87d`, road `#b39064`, water deep `#1f4a5e`, wood `#6b4f33`. The painting replaces those tones outright, so lighter and more saturated is fine; stay in the same families so the effects and the parchment HUD still read over it.

## Where

Emberwatch, an old military outpost across the bay, reopened for civilians.

## The grid

24 columns by 16 rows, counted from 0 at the top-left corner. The painting is the ground and what stands on it, nothing else: the game draws its own grid, movement contours, units, props and effects over it, so every edge in the painting that matters to the rules sits exactly on a tile edge.

- Road (6 tiles): a 3×2 block at columns 21–23, rows 7–8 (middle right).
- Trees (79 tiles): 79 tiles (the centre), rows 0 and 15: columns 0–23; rows 1–3, 5, 9 and 11–14: columns 0 and 23; row 4: columns 0–1 and 22–23; row 6: columns 0–1 and 23; rows 7–8: column 0; row 10: columns 0 and 21–23.
- Stone walls (29 tiles): a 22×1 block at columns 1–22, row 1 (top centre); 7 tiles (bottom left), row 12: column 1; row 13: columns 1–2; row 14: columns 1–4.
- Sand (126 tiles): a 18×7 block at columns 3–20, rows 3–9 (the centre).
- Plank floors (11 tiles): 11 tiles (bottom left), row 12: columns 2–5; row 13: columns 3–7; row 14: columns 5–6.
- Open ground everywhere else: grass (133 tiles).
- The party enters from the left, standing at (3, 12), (4, 12), (3, 13), (4, 13), (5, 12), (5, 13); enemies come from the right. Paint nothing there that would read as an object to walk round.

The rows as the rules read them:

```
TTTTTTTTTTTTTTTTTTTTTTTT
T######################T
T,,,,,,,,,,,,,,,,,,,,,,T
T,,::::::::::::::::::,,T
Tu,::::::::::::::::::,uT
T,,::::::::::::::::::,,T
Tu,::::::::::::::::::,,T
T,,::::::::::::::::::===
T,,::::::::::::::::::===
T,,::::::::::::::::::,,T
T,,,,,,,,,,,,,,,,,,,,uuT
T,,,,,,,,,,,,,,,,,,,,,,T
TWwwww,,,,,,,,,,,,,,,,,T
TWWwwwww,,,,,,,,,,,,,,,T
TWWWWww,,,,,,,,,,,,,,,,T
TTTTTTTTTTTTTTTTTTTTTTTT
```

Legend: `T` trees; `#` stone walls; `,` grass; `:` sand; `u` trees; `=` road; `W` stone walls; `w` plank floors.

## Prompt

**Live surfaces:** the layout marks water, oil, mud and rubble that the game draws. Paint dry earth beneath water and mud, clean flat stone beneath oil, and only the fixed cover silhouette beneath rubble. Do not bake liquid, flame or smoke into the painting. Keep interactable props separate. Village houses are open cutaways: walls fill their blocking cells and plank interiors remain visible and clear.

> Top-down painted ground for a tactics battlefield, seen straight from above with the faintest three-quarter tilt so anything that stands up shows a sliver of its south face; north is up; every tile the same size; no perspective convergence, no horizon, no sky. A long barracks wall of grey stone runs the whole width along the top, its old slogans painted over. Below it a wide parade ground of packed sand is covered in beans drying on old tent canvas, with a spear rack used as a bean trellis. Grass rims the ground. A timber jetty juts into deep water at the lower left, where the ferry lands. A gap in the right edge leads on to the power yard. Early evening, the outpost lamps not yet lit. Painterly ground with soft transitions inside a region and clean edges between regions; a clean, uniform dark-brown ink line (`#1b1410`) only where an edge is drawn, never black; two flat tones plus a thin rim light per material on the things that stand up (rocks, trunks, walls, crates); evenly lit, no vignette, no darkened corners, no cast shadows longer than a tile. Nothing the game draws itself: no characters, no creatures, no barrels, carts or braziers, no user interface, no text, no border, no grid lines. Landscape 3:2, 3840×2560.

## Negative prompt

> characters, people, creatures, animals, text, letters, watermark, signature, logo, user interface, icons, grid, border, frame, vignette, perspective, horizon, sky, isometric, 3D render, photograph, blur, depth of field, lens flare, glow, gradients

## Commands

```
npm run art:map -- --map emberwatch_parade --px 80
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
