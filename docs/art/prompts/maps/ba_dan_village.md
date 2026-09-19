# Map painting: Ba Dan Village (`ba_dan_village`)

**Deliver** one PNG of 1536×1024 pixels or a whole multiple of it (3072×2048 is the comfortable size to generate at), landscape 3:2, saved as `art/raw/maps/ba_dan_village.png`. `art:map` downsizes it with a box filter and never upscales.

**Ships as** `public/art/maps/ba_dan_village.webp`, 64 px a tile, under 1 MB.

**Map** `backdrop: { url: 'art/maps/ba_dan_village.webp', pixelsPerTile: 64 },` on the map's definition in `src/content/maps/`.

**Layout** `ba_dan_village-layout.png` beside this file: the tile grid as flat colour blocks at 32 px a tile, with the grid drawn. Hand it to the generator as the composition reference (image-to-image or a structure control) at a strength that keeps every edge where it is; upscale it to the delivery size first so the generator does not invent a border.

**Palette** hue anchors from the game's own ground (`src/render/palettes.ts`): grass `#41552f`, wood `#6b4f33`, road `#5b5044`, stone `#565452`, dirt `#4d3f2f`, still water `#3e8fb0`. The painting replaces those tones outright, so lighter and more saturated is fine; stay in the same families so the effects and the parchment HUD still read over it.

## Where

Ba Dan, the small village the party sets out from: a clearing in the woods.

## The grid

24 columns by 16 rows, counted from 0 at the top-left corner. The painting is the ground and what stands on it, nothing else: the game draws its own grid, movement contours, units, props and effects over it, so every edge in the painting that matters to the rules sits exactly on a tile edge.

- Road (64 tiles): 64 tiles (the centre), rows 3–4: columns 9 and 12; rows 5 and 9: columns 9–13; rows 6 and 10–11: columns 9 and 13; rows 7–8: columns 0–21.
- Still water (3 tiles): a 3×1 block at columns 10–12, row 6 (the centre).
- Trees (48 tiles): 13 tiles (top right), row 0: columns 18–23; row 1: columns 22–23; rows 2–6: column 23; 13 tiles (bottom right), rows 9–13: column 23; row 14: columns 22–23; row 15: columns 18–23; 11 tiles (top left), row 0: columns 0–3; row 1: columns 0–1; rows 2–6: column 0; 11 tiles (bottom left), rows 9–13: column 0; row 14: columns 0–1; row 15: columns 0–3.
- Timber walls (36 tiles): 10 tiles (bottom centre), row 10: columns 6–8; row 11: column 6; row 12: columns 6 and 9; row 13: columns 6–9; 7 tiles (top centre), row 1: columns 6–9; row 2: columns 6 and 9; row 3: column 6; 7 tiles (top centre), row 1: columns 12–15; row 2: columns 12 and 15; row 3: column 15; 6 tiles (bottom centre), row 10: columns 14–17; row 11: columns 14 and 17; 6 tiles (bottom centre), row 12: columns 13 and 16; row 13: columns 13–16.
- Stone walls (10 tiles): 4 tiles (top left), row 4: columns 7–8; row 5: columns 6–7; a 2×1 block at columns 13–14, row 4 (top centre); a 2×1 block at columns 16–17, row 4 (top right); a 2×1 block at columns 14–15, row 9 (the centre).
- Plank floors (16 tiles): a 2×2 block at columns 7–8, rows 2–3 (top centre); a 2×2 block at columns 13–14, rows 2–3 (top centre); a 2×2 block at columns 7–8, rows 11–12 (bottom centre); 4 tiles (bottom centre), row 11: columns 15–16; row 12: columns 14–15.
- Open ground everywhere else: grass (203 tiles), bare earth (4 tiles).
- The party enters from the left, standing at (3, 7); enemies come from the right. The exit is at (23, 7). Paint nothing there that would read as an object to walk round.

The rows as the rules read them:

```
TTTT,,,,,,,,,,,,,,TTTTTT
TT,,,,BBBB,,BBBB,,,,,,TT
T,,,,,BwwB,,BwwB,,,,,,,T
T,,,,,Bww=,,=wwB,,,,,,,T
T,,,,,,ll=,,=ll,ll,,,,,T
T,,,,,ll,=====,,,,,,,,,T
T,,,,,,,,=~~~=,,,,,,,,,T
======================..
======================..
T,,,,,,,,=====ll,,,,,,,T
T,,,,,BBB=,,,=BBBB,,,,,T
T,,,,,Bww=,,,=BwwB,,,,,T
T,,,,,BwwB,,,BwwB,,,,,,T
T,,,,,BBBB,,,BBBB,,,,,,T
TT,,,,,,,,,,,,,,,,,,,,TT
TTTT,,,,,,,,,,,,,,TTTTTT
```

Legend: `T` trees; `,` grass; `B` timber walls; `w` plank floors; `=` road; `l` stone walls; `~` still water; `.` bare earth.

## Prompt

**Live surfaces:** the layout marks water, oil, mud and rubble that the game draws. Paint dry earth beneath water and mud, clean flat stone beneath oil, and only the fixed cover silhouette beneath rubble. Do not bake liquid, flame or smoke into the painting. Keep interactable props separate. Village houses are open cutaways: walls fill their blocking cells and plank interiors remain visible and clear.

> Top-down painted ground for a tactics battlefield, seen straight from above with the faintest three-quarter tilt so anything that stands up shows a sliver of its south face; north is up; every tile the same size; no perspective convergence, no horizon, no sky. A village clearing ringed by trees, thickest in the corners. A road of flagstones crosses the whole picture left to right through the middle, two tiles deep, and runs out through the east gate at the right edge where the flagstones give way to bare earth. Four timber houses, two above the road and two below, each an open cutaway rectangle of timber walls round a visible floor of planks with a doorway opening onto a paved path that leads to the road. Between the houses above the road a paved yard opens off the road with a small rectangular dry earth bed in its middle beneath live water; below the road a matching paved yard. Grass everywhere else, worn to paths near the doors. Soft mid-morning light, no long shadows. Painterly ground with soft transitions inside a region and clean edges between regions; a clean, uniform dark-brown ink line (`#1b1410`) only where an edge is drawn, never black; two flat tones plus a thin rim light per material on the things that stand up (rocks, trunks, walls, crates); evenly lit, no vignette, no darkened corners, no cast shadows longer than a tile. Nothing the game draws itself: no characters, no creatures, no barrels, carts or braziers, no user interface, no text, no border, no grid lines. Landscape 3:2, 3072×2048.

## Negative prompt

> characters, people, creatures, animals, text, letters, watermark, signature, logo, user interface, icons, grid, border, frame, vignette, perspective, horizon, sky, isometric, 3D render, photograph, blur, depth of field, lens flare, glow, gradients

## Commands

```
npm run art:map -- --map ba_dan_village --px 64
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
