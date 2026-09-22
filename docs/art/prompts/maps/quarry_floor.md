# Map painting: The Quarry Floor (`quarry_floor`)

**Deliver** one PNG of 1600×960 pixels or a whole multiple of it (3200×1920 is the comfortable size to generate at), landscape 5:3, saved as `art/raw/maps/quarry_floor.png`. `art:map` downsizes it with a box filter and never upscales.

**Ships as** `public/art/maps/quarry_floor.webp`, 80 px a tile, under 1 MB.

**Map** `backdrop: { url: 'art/maps/quarry_floor.webp', pixelsPerTile: 80 },` on the map's definition in `src/content/maps/`.

**Layout** `quarry_floor-layout.png` beside this file: the tile grid as flat colour blocks at 32 px a tile, with the grid drawn. Hand it to the generator as the composition reference (image-to-image or a structure control) at a strength that keeps every edge where it is; upscale it to the delivery size first so the generator does not invent a border.

**Palette** hue anchors from the game's own ground (`src/render/palettes.ts`): stone `#d8cbb0`, dirt `#b39064`, wall `#3a352f`. The painting replaces those tones outright, so lighter and more saturated is fine; stay in the same families so the effects and the parchment HUD still read over it.

## Where

The floor of the quarry itself, an open pit of earth ringed by terraces.

## The grid

20 columns by 12 rows, counted from 0 at the top-left corner. The painting is the ground and what stands on it, nothing else: the game draws its own grid, movement contours, units, props and effects over it, so every edge in the painting that matters to the rules sits exactly on a tile edge.

- Stone walls (2 tiles): one tile at column 8, row 4 (the centre); one tile at column 11, row 7 (the centre).
- High ledges, two steps up (20 tiles): 5 tiles (top left), row 0: columns 0–2; row 1: columns 0–1; 5 tiles (top right), row 0: columns 17–19; row 1: columns 18–19; 5 tiles (bottom left), row 10: columns 0–1; row 11: columns 0–2; 5 tiles (bottom right), row 10: columns 18–19; row 11: columns 17–19.
- Ledges, one step up (24 tiles): 4 tiles (top left), row 0: columns 3–4; row 1: columns 2–3; 4 tiles (top right), row 0: columns 15–16; row 1: columns 16–17; 4 tiles (bottom left), row 10: columns 2–3; row 11: columns 3–4; 4 tiles (bottom right), row 10: columns 16–17; row 11: columns 15–16; a 2×1 block at columns 0–1, row 2 (top left); a 2×1 block at columns 18–19, row 2 (top right); a 2×1 block at columns 0–1, row 9 (bottom left); a 2×1 block at columns 18–19, row 9 (bottom right).
- Heaps of tumbled rock (6 tiles): one tile at column 8, row 1 (top centre); one tile at column 11, row 1 (top centre); one tile at column 2, row 4 (middle left); one tile at column 2, row 7 (middle left); one tile at column 8, row 10 (bottom centre); one tile at column 11, row 10 (bottom centre).
- Spilled oil (16 tiles): a 2×2 block at columns 7–8, rows 2–3 (top centre); a 2×2 block at columns 11–12, rows 2–3 (top centre); a 2×2 block at columns 7–8, rows 8–9 (bottom centre); a 2×2 block at columns 11–12, rows 8–9 (bottom centre).
- Churned mud (4 tiles): a 2×2 block at columns 10–11, rows 5–6 (the centre).
- Open ground everywhere else: bare earth (168 tiles).
- The party enters from the left, standing at (1, 3), (3, 4), (1, 5), (3, 6), (1, 7), (3, 8); enemies come from the right. Paint nothing there that would read as an object to walk round.

The rows as the rules read them:

```
AAA^^..........^^AAA
AA^^....r..r....^^AA
^^.....oo..oo.....^^
.......oo..oo.......
..r.....#...........
..........mm........
..........mm........
..r........#........
.......oo..oo.......
^^.....oo..oo.....^^
AA^^....r..r....^^AA
AAA^^..........^^AAA
```

Legend: `A` high ledges, two steps up; `^` ledges, one step up; `.` bare earth; `r` heaps of tumbled rock; `o` spilled oil; `#` stone walls; `m` churned mud.

## Prompt

**Live surfaces:** the layout marks water, oil, mud and rubble that the game draws. Paint dry earth beneath water and mud, clean flat stone beneath oil, and only the fixed cover silhouette beneath rubble. Do not bake liquid, flame or smoke into the painting. Keep interactable props separate. Village houses are open cutaways: walls fill their blocking cells and plank interiors remain visible and clear.

> Top-down painted ground for a tactics battlefield, seen straight from above with the faintest three-quarter tilt so anything that stands up shows a sliver of its south face; north is up; every tile the same size; no perspective convergence, no horizon, no sky. An open floor of bare earth with stepped stone terraces in all four corners, the outer step two tiles high and the inner one tile, so the corners rise like a shallow amphitheatre. Four clean flat stone patches, each two tiles across, sit in the earth in a ring round the centre, two above the middle and two below; the game adds oil. A dry earth patch two tiles across marks the exact centre beneath live mud. Six heaps of tumbled rock lie on the floor: one just above each of the two upper stone patches, one just below each of the two lower stone patches, and two on the left of the open floor, one above and one below the middle. Hard afternoon light into the pit; the terraces cast no shadow onto the floor. Painterly ground with soft transitions inside a region and clean edges between regions; a clean, uniform dark-brown ink line (`#1b1410`) only where an edge is drawn, never black; two flat tones plus a thin rim light per material on the things that stand up (rocks, trunks, walls, crates); evenly lit, no vignette, no darkened corners, no cast shadows longer than a tile. Nothing the game draws itself: no characters, no creatures, no barrels, carts or braziers, no user interface, no text, no border, no grid lines. Landscape 5:3, 3200×1920.

## Negative prompt

> characters, people, creatures, animals, text, letters, watermark, signature, logo, user interface, icons, grid, border, frame, vignette, perspective, horizon, sky, isometric, 3D render, photograph, blur, depth of field, lens flare, glow, gradients

## Commands

```
npm run art:map -- --map quarry_floor --px 80
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
