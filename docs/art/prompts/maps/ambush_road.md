# Map painting: The Cutting (`ambush_road`)

**Deliver** one PNG of 1600×960 pixels or a whole multiple of it (3200×1920 is the comfortable size to generate at), landscape 5:3, saved as `art/raw/maps/ambush_road.png`. `art:map` downsizes it with a box filter and never upscales.

**Ships as** `public/art/maps/ambush_road.webp`, 80 px a tile, under 1 MB.

**Map** `backdrop: { url: 'art/maps/ambush_road.webp', pixelsPerTile: 80 },` on the map's definition in `src/content/maps/`.

**Layout** `ambush_road-layout.png` beside this file: the tile grid as flat colour blocks at 32 px a tile, with the grid drawn. Hand it to the generator as the composition reference (image-to-image or a structure control) at a strength that keeps every edge where it is; upscale it to the delivery size first so the generator does not invent a border.

**Palette** hue anchors from the game's own ground (`src/render/palettes.ts`): wall `#3a352f`, stone `#d8cbb0`, grass `#6f9e4c`, sand `#c7a87d`, road `#b39064`, dirt `#b39064`, still water `#3e8fb0`. The painting replaces those tones outright, so lighter and more saturated is fine; stay in the same families so the effects and the parchment HUD still read over it.

## Where

A road through a cutting between rock walls, where the party is ambushed.

## The grid

20 columns by 12 rows, counted from 0 at the top-left corner. The painting is the ground and what stands on it, nothing else: the game draws its own grid, movement contours, units, props and effects over it, so every edge in the painting that matters to the rules sits exactly on a tile edge.

- Road (60 tiles): 60 tiles (the centre), rows 4 and 7: columns 0–19; rows 5–6: columns 0–4, 10–13 and 19.
- Still water (8 tiles): a 4×2 block at columns 6–9, rows 5–6 (the centre).
- Cut quarry rock, two steps up (89 tiles): 46 tiles (top centre), row 0: columns 0–19; row 1: columns 0–2, 6–13 and 17–19; row 2: columns 0–1, 8–12 and 18–19; row 3: columns 9–10 and 19; 43 tiles (bottom centre), row 8: columns 9–10; row 9: columns 0–1, 8–12 and 19; row 10: columns 0–2, 6–13 and 18–19; row 11: columns 0–19.
- Ledges, one step up (24 tiles): 10 tiles (top right), row 1: columns 14–16; row 2: columns 14–17; row 3: columns 15–17; 6 tiles (bottom right), row 9: columns 17–18; row 10: columns 14–17; 5 tiles (top left), row 1: columns 3–5; row 2: columns 2–3; a 3×1 block at columns 3–5, row 10 (bottom left).
- Heaps of tumbled rock (4 tiles): one tile at column 6, row 2 (top left); one tile at column 13, row 3 (top right); one tile at column 6, row 8 (bottom left); one tile at column 13, row 8 (bottom right).
- Open ground everywhere else: grass (55 tiles).
- The party enters from the left, standing at (1, 3), (3, 4), (1, 5), (3, 6), (1, 7), (3, 8); enemies come from the right. Paint nothing there that would read as an object to walk round.

The rows as the rules read them:

```
XXXXXXXXXXXXXXXXXXXX
XXX^^^XXXXXXXX^^^XXX
XX^^,,r,XXXXX,^^^^XX
,,,,,,,,,XX,,r,^^^,X
====================
=====,~~~~====,,,,,=
=====,~~~~====,,,,,=
====================
,,,,,,r,,XX,,r,,,,,,
XX,,,,,,XXXXX,,,,^^X
XXX^^^XXXXXXXX^^^^XX
XXXXXXXXXXXXXXXXXXXX
```

Legend: `X` cut quarry rock, two steps up; `^` ledges, one step up; `,` grass; `r` heaps of tumbled rock; `=` road; `~` still water.

## Prompt

**Live surfaces:** the layout marks water, oil, mud and rubble that the game draws. Paint dry earth beneath water and mud, clean flat stone beneath oil, and only the fixed cover silhouette beneath rubble. Do not bake liquid, flame or smoke into the painting. Keep interactable props separate. Village houses are open cutaways: walls fill their blocking cells and plank interiors remain visible and clear.

> Top-down painted ground for a tactics battlefield, seen straight from above with the faintest three-quarter tilt so anything that stands up shows a sliver of its south face; north is up; every tile the same size; no perspective convergence, no horizon, no sky. A road of flagstones crosses the whole picture left to right through the middle, four tiles deep. Its two middle rows hold a small runoff pool a little left of centre, which the game draws water over, and further right a long strip of loose floor. The road is the only way through: at the centre, two tiles wide, cut quarry rock two steps high closes in from above and below to the road's edge, so the floor either side of the pinch opens into four small bays, two above the road and two below. The same rock fills the top and bottom edges and the ground between the bays. Its top faces are sheer, scarred by rows of drill holes; along the bottom edge it is a low sawn lip. Two one-step stone ledges face each other across the pinch above the road, a short one at the upper left and a longer one at the upper right, and two more sit under the bottom rock at the lower left and lower right. Four heaps of tumbled rock lie on the floor, two above the road and two below. Overcast midday: even light in the cutting, the rock faces a little darker. Painterly ground with soft transitions inside a region and clean edges between regions; a clean, uniform dark-brown ink line (`#1b1410`) only where an edge is drawn, never black; two flat tones plus a thin rim light per material on the things that stand up (rocks, trunks, walls, crates); evenly lit, no vignette, no darkened corners, no cast shadows longer than a tile. Nothing the game draws itself: no characters, no creatures, no barrels, carts or braziers, no user interface, no text, no border, no grid lines. Landscape 5:3, 3200×1920.

## Negative prompt

> characters, people, creatures, animals, text, letters, watermark, signature, logo, user interface, icons, grid, border, frame, vignette, perspective, horizon, sky, isometric, 3D render, photograph, blur, depth of field, lens flare, glow, gradients

## Commands

```
npm run art:map -- --map ambush_road --px 80
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
