# Map painting: The Power Yard (`emberwatch_power_yard`)

**Deliver** one PNG of 1824×1152 pixels or a whole multiple of it (3648×2304 is the comfortable size to generate at), landscape 19:12, saved as `art/raw/maps/emberwatch_power_yard.png`. `art:map` downsizes it with a box filter and never upscales.

**Ships as** `public/art/maps/emberwatch_power_yard.webp`, 96 px a tile, under 1 MB.

**Map** `backdrop: { url: 'art/maps/emberwatch_power_yard.webp', pixelsPerTile: 96 },` on the map's definition in `src/content/maps/`.

**Layout** `emberwatch_power_yard-layout.png` beside this file: the tile grid as flat colour blocks at 32 px a tile, with the grid drawn. Hand it to the generator as the composition reference (image-to-image or a structure control) at a strength that keeps every edge where it is; upscale it to the delivery size first so the generator does not invent a border.

**Palette** hue anchors from the game's own ground (`src/render/palettes.ts`): wall `#3a352f`, wood `#6b4f33`, water deep `#1f4a5e`, dirt `#b39064`, road `#b39064`, still water `#3e8fb0`. The painting replaces those tones outright, so lighter and more saturated is fine; stay in the same families so the effects and the parchment HUD still read over it.

## Where

The power yard at Emberwatch, where the live line comes in.

## The grid

19 columns by 12 rows, counted from 0 at the top-left corner. The painting is the ground and what stands on it, nothing else: the game draws its own grid, movement contours, units, props and effects over it, so every edge in the painting that matters to the rules sits exactly on a tile edge.

- Road (2 tiles): a 1×2 block at column 0, rows 5–6 (middle left).
- Still water (34 tiles): 24 tiles (the centre), row 2: columns 5–10; row 3: columns 4–12; row 4: columns 5–11; row 5: columns 10–11; 8 tiles (the centre), row 7: columns 9–11; row 8: columns 8–12; a 2×1 block at columns 16–17, row 3 (top right).
- Timber walls (19 tiles): a 14×1 block at columns 1–14, row 1 (top centre); a 1×5 block at column 17, rows 4–8 (middle right).
- Stone walls (64 tiles): 64 tiles (the centre), rows 0 and 11: columns 0–18; rows 1–2: columns 0 and 15–18; rows 3–4, 7–8 and 10: columns 0 and 18; rows 5–6: column 18; row 9: columns 0–1 and 17–18.
- Open ground everywhere else: bare earth (109 tiles).
- The party enters from the left, standing at (1, 3), (3, 4), (1, 5), (3, 6), (1, 7), (3, 8); enemies come from the right. Paint nothing there that would read as an object to walk round.

The rows as the rules read them:

```
###################
#FFFFFFFFFFFFFFWWW#
#....~~~~~~....WWW#
#...~~~~~~~~~...~~#
#....~~~~~~~.....F#
=.........~~.....F#
=................F#
#........~~~.....F#
#.......~~~~~....F#
#d...............##
#.................#
###################
```

Legend: `#` stone walls; `F` timber walls; `W` stone walls; `.` bare earth; `~` still water; `=` road; `d` stone walls.

## Prompt

**Live surfaces:** the layout marks water, oil, mud and rubble that the game draws. Paint dry earth beneath water and mud, clean flat stone beneath oil, and only the fixed cover silhouette beneath rubble. Do not bake liquid, flame or smoke into the painting. Keep interactable props separate. Village houses are open cutaways: walls fill their blocking cells and plank interiors remain visible and clear.

> Top-down painted ground for a tactics battlefield, seen straight from above with the faintest three-quarter tilt so anything that stands up shows a sliver of its south face; north is up; every tile the same size; no perspective convergence, no horizon, no sky. A walled yard of bare earth. Along the top edge a line of timber poles carries a live cable, a fence you can see over. At the top right a rain cistern of stone has overflowed, and standing water spreads across the yard in two broad puddles, one beside the line and one lower down. Down the right side a second row of poles holds a dead copper spur. A gate in the left wall leads back to the parade ground. Night after rain, lit by the yard lamps; the puddles catch the light. Painterly ground with soft transitions inside a region and clean edges between regions; a clean, uniform dark-brown ink line (`#1b1410`) only where an edge is drawn, never black; two flat tones plus a thin rim light per material on the things that stand up (rocks, trunks, walls, crates); evenly lit, no vignette, no darkened corners, no cast shadows longer than a tile. Nothing the game draws itself: no characters, no creatures, no barrels, carts or braziers, no user interface, no text, no border, no grid lines. Landscape 19:12, 3648×2304.

## Negative prompt

> characters, people, creatures, animals, text, letters, watermark, signature, logo, user interface, icons, grid, border, frame, vignette, perspective, horizon, sky, isometric, 3D render, photograph, blur, depth of field, lens flare, glow, gradients

## Commands

```
npm run art:map -- --map emberwatch_power_yard --px 96
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
