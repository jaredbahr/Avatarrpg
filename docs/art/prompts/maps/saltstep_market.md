# Map painting: Saltstep (`saltstep_market`)

**Deliver** one PNG of 1920×1280 pixels or a whole multiple of it (3840×2560 is the comfortable size to generate at), landscape 3:2, saved as `art/raw/maps/saltstep_market.png`. `art:map` downsizes it with a box filter and never upscales.

**Ships as** `public/art/maps/saltstep_market.webp`, 80 px a tile, under 1 MB.

**Map** `backdrop: { url: 'art/maps/saltstep_market.webp', pixelsPerTile: 80 },` on the map's definition in `src/content/maps/`.

**Layout** `saltstep_market-layout.png` beside this file: the tile grid as flat colour blocks at 32 px a tile, with the grid drawn. Hand it to the generator as the composition reference (image-to-image or a structure control) at a strength that keeps every edge where it is; upscale it to the delivery size first so the generator does not invent a border.

**Palette** hue anchors from the game's own ground (`src/render/palettes.ts`): grass `#6f9e4c`, wood `#6b4f33`, sand `#c7a87d`, road `#b39064`, water deep `#1f4a5e`. The painting replaces those tones outright, so lighter and more saturated is fine; stay in the same families so the effects and the parchment HUD still read over it.

## Where

Saltstep, a market town built out over a grey bay.

## The grid

24 columns by 16 rows, counted from 0 at the top-left corner. The painting is the ground and what stands on it, nothing else: the game draws its own grid, movement contours, units, props and effects over it, so every edge in the painting that matters to the rules sits exactly on a tile edge.

- Road (4 tiles): a 2×2 block at columns 0–1, rows 5–6 (middle left).
- Trees (76 tiles): 76 tiles (the centre), rows 0 and 15: columns 0–23; row 1: columns 0–1 and 22–23; rows 2–4 and 7–14: columns 0 and 23; rows 5–6: column 23.
- Timber walls (18 tiles): a 5×2 block at columns 14–18, rows 1–2 (top right); a 4×2 block at columns 5–8, rows 1–2 (top left).
- Stone walls (117 tiles): 117 tiles (bottom centre), rows 8–9: columns 1–2, 7–9, 14–16 and 22; row 10: columns 1–3, 6–10, 13–17 and 21–22; rows 11–12: columns 1–10 and 13–22; rows 13–14: columns 1–22.
- Sand (83 tiles): 83 tiles (the centre), row 4: columns 1–22; rows 5–6: columns 2–21; row 7: columns 1–21.
- Plank floors (40 tiles): 14 tiles (the centre), rows 8–9: columns 10–13; rows 10–12: columns 11–12; 13 tiles (middle right), rows 8–9: columns 17–21; row 10: columns 18–20; 10 tiles (middle left), rows 8–9: columns 3–6; row 10: columns 4–5; a 1×3 block at column 22, rows 5–7 (middle right).
- Open ground everywhere else: grass (46 tiles).
- The party enters from the left, standing at (1, 5), (1, 6), (2, 5), (2, 6), (1, 4), (2, 4); enemies come from the right. Paint nothing there that would read as an object to walk round.

The rows as the rules read them:

```
TTTTTTTTTTTTTTTTTTTTTTTT
TT,,,BBBB,,,,,BBBBB,,,TT
T,,,,BBBB,,,,,BBBBB,,,,T
T,,,,,,,,,,,,,,,,,,,,,,T
T::::::::::::::::::::::T
==::::::::::::::::::::wT
==::::::::::::::::::::wT
T:::::::::::::::::::::wT
TWWwwwwWWWwwwwWWWwwwwwWT
TWWwwwwWWWwwwwWWWwwwwwWT
TWWWwwWWWWWwwWWWWWwwwWWT
TWWWWWWWWWWwwWWWWWWWWWWT
TWWWWWWWWWWwwWWWWWWWWWWT
TWWWWWWWWWWWWWWWWWWWWWWT
TWWWWWWWWWWWWWWWWWWWWWWT
TTTTTTTTTTTTTTTTTTTTTTTT
```

Legend: `T` trees; `,` grass; `B` timber walls; `:` sand; `=` road; `w` plank floors; `W` stone walls.

## Prompt

**Live surfaces:** the layout marks water, oil, mud and rubble that the game draws. Paint dry earth beneath water and mud, clean flat stone beneath oil, and only the fixed cover silhouette beneath rubble. Do not bake liquid, flame or smoke into the painting. Keep interactable props separate. Village houses are open cutaways: walls fill their blocking cells and plank interiors remain visible and clear.

> Top-down painted ground for a tactics battlefield, seen straight from above with the faintest three-quarter tilt so anything that stands up shows a sliver of its south face; north is up; every tile the same size; no perspective convergence, no horizon, no sky. A packed-sand quay crosses the picture left to right just above the middle, with a road of flagstones coming in at the left edge. North of it a strip of grass holds two timber warehouses, the right one a freight office with a clean brass plate. South of the quay the bay is deep, still water, and plank platforms stand out in it on piles: three near the quay, one further out on a narrow walk, and a ferry landing on the right. Tall painted level poles stand along the platform edges. Trees close the top corners and edges. Flat grey coastal daylight; the water darker than the planks. Painterly ground with soft transitions inside a region and clean edges between regions; a clean, uniform dark-brown ink line (`#1b1410`) only where an edge is drawn, never black; two flat tones plus a thin rim light per material on the things that stand up (rocks, trunks, walls, crates); evenly lit, no vignette, no darkened corners, no cast shadows longer than a tile. Nothing the game draws itself: no characters, no creatures, no barrels, carts or braziers, no user interface, no text, no border, no grid lines. Landscape 3:2, 3840×2560.

## Negative prompt

> characters, people, creatures, animals, text, letters, watermark, signature, logo, user interface, icons, grid, border, frame, vignette, perspective, horizon, sky, isometric, 3D render, photograph, blur, depth of field, lens flare, glow, gradients

## Commands

```
npm run art:map -- --map saltstep_market --px 80
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
