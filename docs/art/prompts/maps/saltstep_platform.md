# Map painting: Spare market platform (`saltstep_platform`)

**Deliver** one PNG of 1920×1408 pixels or a whole multiple of it (3840×2816 is the comfortable size to generate at), landscape 15:11, saved as `art/raw/maps/saltstep_platform.png`. `art:map` downsizes it with a box filter and never upscales.

**Ships as** `public/art/maps/saltstep_platform.webp`, 128 px a tile, under 1 MB.

**Map** `backdrop: { url: 'art/maps/saltstep_platform.webp', pixelsPerTile: 128 },` on the map's definition in `src/content/maps/`.

**Layout** `saltstep_platform-layout.png` beside this file: the tile grid as flat colour blocks at 32 px a tile, with the grid drawn. Hand it to the generator as the composition reference (image-to-image or a structure control) at a strength that keeps every edge where it is; upscale it to the delivery size first so the generator does not invent a border.

**Palette** hue anchors from the game's own ground (`src/render/palettes.ts`): water deep `#1f4a5e`, wood `#6b4f33`. The painting replaces those tones outright, so lighter and more saturated is fine; stay in the same families so the effects and the parchment HUD still read over it.

## Where

A spare market platform at Saltstep, floating loose in the harbour, where the ferry apprentices spar.

## The grid

15 columns by 11 rows, counted from 0 at the top-left corner. The painting is the ground and what stands on it, nothing else: the game draws its own grid, movement contours, units, props and effects over it, so every edge in the painting that matters to the rules sits exactly on a tile edge.

- Timber walls (5 tiles): a 1×3 block at column 7, rows 4–6 (the centre); one tile at column 3, row 3 (top left); one tile at column 11, row 7 (bottom right).
- Stone walls (111 tiles): 111 tiles (the centre), rows 0–1 and 8–10: columns 0–14; rows 2–7: columns 0–2 and 12–14.
- Ledges, one step up (9 tiles): a 9×1 block at columns 3–11, row 2 (top centre).
- Plank floors (40 tiles): 40 tiles (the centre), row 3: columns 4–11; rows 4–6: columns 3–6 and 8–11; row 7: columns 3–10.
- No open ground: every tile is a feature.
- The party enters from the left, standing at (5, 5), (5, 4), (5, 6), (4, 5), (4, 3), (4, 7); enemies come from the right. Paint nothing there that would read as an object to walk round.

The rows as the rules read them:

```
WWWWWWWWWWWWWWW
WWWWWWWWWWWWWWW
WWWHhhhhhhhHWWW
WWWFwwwwwwwwWWW
WWWwwwwFwwwwWWW
WWWwwwwFwwwwWWW
WWWwwwwFwwwwWWW
WWWwwwwwwwwFWWW
WWWWWWWWWWWWWWW
WWWWWWWWWWWWWWW
WWWWWWWWWWWWWWW
```

Legend: `W` stone walls; `H` ledges, one step up; `h` ledges, one step up; `F` timber walls; `w` plank floors.

## Prompt

**Live surfaces:** the layout marks water, oil, mud and rubble that the game draws. Paint dry earth beneath water and mud, clean flat stone beneath oil, and only the fixed cover silhouette beneath rubble. Do not bake liquid, flame or smoke into the painting. Keep interactable props separate. Village houses are open cutaways: walls fill their blocking cells and plank interiors remain visible and clear.

> Top-down painted ground for a tactics battlefield, seen straight from above with the faintest three-quarter tilt so anything that stands up shows a sliver of its south face; north is up; every tile the same size; no perspective convergence, no horizon, no sky. A small square deck of market planking alone on the water, with deep harbour water all round it. Down its middle runs the short stub of an old stall counter, open at both ends. A low step of planks runs along the top edge, sloping down at each end. Two mooring bollards with looped rope stand at the top-left and bottom-right corners of the deck. Bright midday light, calm water. Painterly ground with soft transitions inside a region and clean edges between regions; a clean, uniform dark-brown ink line (`#1b1410`) only where an edge is drawn, never black; two flat tones plus a thin rim light per material on the things that stand up (rocks, trunks, walls, crates); evenly lit, no vignette, no darkened corners, no cast shadows longer than a tile. Nothing the game draws itself: no characters, no creatures, no barrels, carts or braziers, no user interface, no text, no border, no grid lines. Landscape 15:11, 3840×2816.

## Negative prompt

> characters, people, creatures, animals, text, letters, watermark, signature, logo, user interface, icons, grid, border, frame, vignette, perspective, horizon, sky, isometric, 3D render, photograph, blur, depth of field, lens flare, glow, gradients

## Commands

```
npm run art:map -- --map saltstep_platform --px 128
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
