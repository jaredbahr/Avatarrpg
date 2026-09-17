# Map painting: Ba Dan · The Riverside (`ba_dan_riverside`)

**Deliver** one PNG of 1440×960 pixels or a whole multiple of it (2880×1920 is the comfortable size to generate at), landscape 3:2, saved as `art/raw/maps/ba_dan_riverside.png`. `art:map` downsizes it with a box filter and never upscales.

**Ships as** `public/art/maps/ba_dan_riverside.webp`, 40 px a tile, under 1 MB.

**Map** `backdrop: { url: 'art/maps/ba_dan_riverside.webp', pixelsPerTile: 40 },` on the map's definition in `src/content/maps/`.

**Layout** `ba_dan_riverside-layout.png` beside this file: the tile grid as flat colour blocks at 32 px a tile, with the grid drawn. Hand it to the generator as the composition reference (image-to-image or a structure control) at a strength that keeps every edge where it is; upscale it to the delivery size first so the generator does not invent a border.

**Palette** hue anchors from the game's own ground (`src/render/palettes.ts`): wall `#3a352f`, road `#5b5044`. The painting replaces those tones outright, so lighter and more saturated is fine; stay in the same families so the effects and the parchment HUD still read over it.

## Where

The riverside neighborhood of Ba Dan, a quiet afternoon beyond the village.

## The grid

36 columns by 24 rows, counted from 0 at the top-left corner. The painting is the ground and what stands on it, nothing else: the game draws its own grid, movement contours, units, props and effects over it, so every edge in the painting that matters to the rules sits exactly on a tile edge.

- Road (185 tiles): 184 tiles (the centre), row 4: columns 10 and 15; row 5: columns 9–10, 14–16 and 30–32; row 6: columns 8–17 and 30–32; row 7: columns 10–18 and 30–31; row 8: columns 13–20 and 30–31; row 9: columns 13–21 and 30–31; row 10: columns 13–21 and 29–32; row 11: columns 12–33; row 12: columns 9–33; row 13: columns 7–20 and 29–33; row 14: columns 10–18 and 29–33; row 15: columns 10–18 and 29–32; row 16: columns 10–18 and 29–31; row 17: columns 10–12 and 17–18; row 18: columns 10–11; rows 19–20: columns 9–10; one tile at column 20, row 6 (top centre).
- Stone walls (679 tiles): 679 tiles (the centre), rows 0–3 and 21–23: columns 0–35; row 4: columns 0–9, 11–14 and 16–35; row 5: columns 0–8, 11–13, 17–29 and 33–35; row 6: columns 0–7, 18–19, 21–29 and 33–35; row 7: columns 0–9, 19–29 and 32–35; row 8: columns 0–12, 21–29 and 32–35; row 9: columns 0–12, 22–29 and 32–35; row 10: columns 0–12, 22–28 and 33–35; row 11: columns 0–11 and 34–35; row 12: columns 0–8 and 34–35; row 13: columns 0–6, 21–28 and 34–35; row 14: columns 0–9, 19–28 and 34–35; row 15: columns 0–9, 19–28 and 33–35; row 16: columns 0–9, 19–28 and 32–35; row 17: columns 0–9, 13–16 and 19–35; row 18: columns 0–9 and 12–35; rows 19–20: columns 0–8 and 11–35.
- No open ground: every tile is a feature.
- The party enters from the left, standing at (16, 12), (15, 12), (14, 12), (14, 13), (15, 13), (16, 13); enemies come from the right. The exit is at (10, 20). Paint nothing there that would read as an object to walk round.

The rows as the rules read them:

```
####################################
####################################
####################################
####################################
##########=####=####################
#########==###===#############===###
########==========##=#########===###
##########=========###########==####
#############========#########==####
#############=========########==####
#############=========#######====###
############======================##
#########=========================##
#######==============########=====##
##########=========##########=====##
##########=========##########====###
##########=========##########===####
##########===####==#################
##########==########################
#########==#########################
#########==#########################
####################################
####################################
####################################
```

Legend: `#` stone walls; `=` road.

## Prompt

> Top-down painted ground for a tactics battlefield, seen straight from above with the faintest three-quarter tilt so anything that stands up shows a sliver of its south face; north is up; every tile the same size; no perspective convergence, no horizon, no sky. A warm painted village of timber houses and terracotta roofs occupies the left bank. A great banyan shades a central open square. A stream flows from a waterfall at the north toward the south, crossed by a wooden footbridge through the middle. Across it, a little practice clearing opens to the east and a narrow path climbs north to an old stone shrine. A tea veranda overlooks the southwest path. Mossy stones, flowers and reeds soften the banks. Keep the central square, bridge and marked paths clear. Warm afternoon daylight, sage greens and cream earth, gently painted edges with dark brown ink accents. Painterly ground with soft transitions inside a region and clean edges between regions; a clean, uniform dark-brown ink line (`#1b1410`) only where an edge is drawn, never black; two flat tones plus a thin rim light per material on the things that stand up (rocks, trunks, walls, crates); evenly lit, no vignette, no darkened corners, no cast shadows longer than a tile. Nothing the game draws itself: no characters, no creatures, no barrels, carts or braziers, no user interface, no text, no border, no grid lines. Landscape 3:2, 2880×1920.

## Negative prompt

> characters, people, creatures, animals, text, letters, watermark, signature, logo, user interface, icons, grid, border, frame, vignette, perspective, horizon, sky, isometric, 3D render, photograph, blur, depth of field, lens flare, glow, gradients

## Commands

```
npm run art:map -- --map ba_dan_riverside --px 40
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
