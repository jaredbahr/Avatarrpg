# Map painting: Saltstep (`saltstep_market`)

**Deliver** one PNG of 1792×1008 pixels or a whole multiple of it (3584×2016 is the comfortable size to generate at), landscape 16:9, saved as `art/raw/maps/saltstep_market.png`. `art:map` downsizes it with a box filter and never upscales.

**Ships as** `public/art/maps/saltstep_market.webp`, 56 px a tile, under 1 MB.

**Map** `backdrop: { url: 'art/maps/saltstep_market.webp', pixelsPerTile: 56 },` on the map's definition in `src/content/maps/`.

**Layout** `saltstep_market-layout.png` beside this file: the tile grid as flat colour blocks at 32 px a tile, with the grid drawn. Hand it to the generator as the composition reference (image-to-image or a structure control) at a strength that keeps every edge where it is; upscale it to the delivery size first so the generator does not invent a border.

**Palette** hue anchors from the game's own ground (`src/render/palettes.ts`): grass `#6f9e4c`, wood `#6b4f33`, dirt `#b39064`, road `#b39064`, sand `#c7a87d`, water deep `#1f4a5e`. The painting replaces those tones outright, so lighter and more saturated is fine; stay in the same families so the effects and the parchment HUD still read over it.

## Where

Saltstep, a market town built out over a grey bay.

## The grid

32 columns by 18 rows, counted from 0 at the top-left corner. The painting is the ground and what stands on it, nothing else: the game draws its own grid, movement contours, units, props and effects over it, so every edge in the painting that matters to the rules sits exactly on a tile edge.

- Road (4 tiles): a 2×2 block at columns 0–1, rows 5–6 (middle left).
- Trees (58 tiles): 57 tiles (top centre), row 0: columns 0–31; row 1: columns 0–1, 11–13 and 28–31; row 2: columns 0, 12 and 29–31; rows 3–4: columns 0 and 30–31; rows 5–6: columns 30–31; row 7: column 31; one tile at column 0, row 7 (middle left).
- Timber walls (35 tiles): a 5×3 block at columns 15–19, rows 1–3 (top centre); 10 tiles (top left), rows 1–2: columns 4–7; row 3: columns 5–6; a 3×2 block at columns 23–25, rows 1–2 (top right); one tile at column 12, row 12 (bottom centre); one tile at column 23, row 13 (bottom right); one tile at column 7, row 14 (bottom left); one tile at column 10, row 16 (bottom left).
- Stone walls (215 tiles): 132 tiles (bottom centre), row 8: columns 0–1 and 30–31; row 9: columns 0–3 and 28–31; rows 10–11: columns 0–6 and 29–31; row 12: columns 0–5 and 29–31; row 13: columns 0–4 and 27–31; row 14: columns 0–4 and 25–31; row 15: columns 0–5 and 24–31; row 16: columns 0–7, 13–15 and 20–31; row 17: columns 0–31; 82 tiles (the centre), row 7: columns 11–12; row 8: columns 10–14 and 20–22; rows 9–10: columns 9–25; row 11: columns 9–24; rows 12–13: columns 13–20; row 14: columns 14–19; one tile at column 5, row 6 (middle left).
- Sand (89 tiles): 89 tiles (the centre), row 5: columns 2–13 and 20–25; row 6: columns 2–4 and 6–27; row 7: columns 1–10 and 13–29; row 8: columns 2–6, 9, 15–19, 23–25 and 28–29; row 9: columns 4–6.
- Plank floors (85 tiles): 85 tiles (bottom centre), rows 8–9: columns 7–8 and 26–27; row 10: columns 7–8 and 26–28; row 11: columns 7–8 and 25–28; row 12: columns 6–11 and 21–28; row 13: columns 5–12, 21–22 and 24–26; row 14: columns 5–6, 8–13 and 20–24; row 15: columns 6–23; row 16: columns 8–9, 11–12 and 16–19.
- Open ground everywhere else: grass (67 tiles), bare earth (23 tiles).
- The party enters from the left, standing at (1, 5), (1, 6), (2, 5), (2, 6), (1, 4), (2, 4); enemies come from the right. Paint nothing there that would read as an object to walk round.

The rows as the rules read them:

```
UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUU
UU,,BBBB,,,UUU,BBBBB,,,BBB,,UUUU
U,,,BBBB,,,,U,,BBBBB,,,BBB,,,UUU
U,,,,BB,,,,,,,,BBBBB,,,,,,,,,,UU
U,..........,,,.......,,,,,,,,UU
==::::::::::::......::::::,,,,UU
==:::n::::::::::::::::::::::,,UU
U::::::::::WW:::::::::::::::::,U
WW:::::ww:WWWWW:::::WWW:::ww::WW
WWWW:::wwWWWWWWWWWWWWWWWWWwwWWWW
WWWWWWWwwWWWWWWWWWWWWWWWWWwwwWWW
WWWWWWWwwWWWWWWWWWWWWWWWWwwwwWWW
WWWWWWwwwwwwkWWWWWWWWwwwwwwwwWWW
WWWWWwwwwwwwwWWWWWWWWwwkwwwWWWWW
WWWWWwwkwwwwwwWWWWWWwwwwwWWWWWWW
WWWWWWwwwwwwwwwwwwwwwwwwWWWWWWWW
WWWWWWWWwwkwwWWWwwwwWWWWWWWWWWWW
WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW
```

Legend: `U` trees; `,` grass; `B` timber walls; `.` bare earth; `=` road; `:` sand; `n` stone walls; `W` stone walls; `w` plank floors; `k` timber walls.

## Prompt

**Live surfaces:** the layout marks water, oil, mud and rubble that the game draws. Paint dry earth beneath water and mud, clean flat stone beneath oil, and only the fixed cover silhouette beneath rubble. Do not bake liquid, flame or smoke into the painting. Keep interactable props separate. Village houses are open cutaways: walls fill their blocking cells and plank interiors remain visible and clear.

> Top-down painted ground for a tactics battlefield, seen straight from above with the faintest three-quarter tilt so anything that stands up shows a sliver of its south face; north is up; every tile the same size; no perspective convergence, no horizon, no sky. A packed-sand quay runs along the top third, with a road of flagstones coming in at the left edge and a dirt lane behind it. North of it a strip of grass holds three buildings of different sizes: an L-shaped house on the left, a freight office with a clean brass plate in the middle and a small house on the right. South of the quay the bay is deep, still water. A two-plank-wide walk runs out from the left of the quay to a ring of plank platforms on piles round an open basin, and a ferry jetty on the right joins the ring back to the shore. A short side jetty points out to sea from the bottom of the ring. Tall painted level poles stand in the basin and along the walk. Trees close the top corners and edges. Flat grey coastal daylight; the water darker than the planks. Painterly ground with soft transitions inside a region and clean edges between regions; a clean, uniform dark-brown ink line (`#1b1410`) only where an edge is drawn, never black; two flat tones plus a thin rim light per material on the things that stand up (rocks, trunks, walls, crates); evenly lit, no vignette, no darkened corners, no cast shadows longer than a tile. Nothing the game draws itself: no characters, no creatures, no barrels, carts or braziers, no user interface, no text, no border, no grid lines. Landscape 16:9, 3584×2016.

## Negative prompt

> characters, people, creatures, animals, text, letters, watermark, signature, logo, user interface, icons, grid, border, frame, vignette, perspective, horizon, sky, isometric, 3D render, photograph, blur, depth of field, lens flare, glow, gradients

## Commands

```
npm run art:map -- --map saltstep_market --px 56
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
