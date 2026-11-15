# Map painting: The Freight Pontoon (`saltstep_pontoon`)

**Deliver** one PNG of 1824×1152 pixels or a whole multiple of it (3648×2304 is the comfortable size to generate at), landscape 19:12, saved as `art/raw/maps/saltstep_pontoon.png`. `art:map` downsizes it with a box filter and never upscales.

**Ships as** `public/art/maps/saltstep_pontoon.webp`, 96 px a tile, under 1 MB.

**Map** `backdrop: { url: 'art/maps/saltstep_pontoon.webp', pixelsPerTile: 96 },` on the map's definition in `src/content/maps/`.

**Layout** `saltstep_pontoon-layout.png` beside this file: the tile grid as flat colour blocks at 32 px a tile, with the grid drawn. Hand it to the generator as the composition reference (image-to-image or a structure control) at a strength that keeps every edge where it is; upscale it to the delivery size first so the generator does not invent a border.

**Palette** hue anchors from the game's own ground (`src/render/palettes.ts`): water deep `#1f4a5e`, wood `#6b4f33`. The painting replaces those tones outright, so lighter and more saturated is fine; stay in the same families so the effects and the parchment HUD still read over it.

## Where

The freight pontoon at Saltstep, where the handlers load the barges.

## The grid

19 columns by 12 rows, counted from 0 at the top-left corner. The painting is the ground and what stands on it, nothing else: the game draws its own grid, movement contours, units, props and effects over it, so every edge in the painting that matters to the rules sits exactly on a tile edge.

- Timber walls (4 tiles): a 2×2 block at columns 14–15, rows 3–4 (middle right).
- Stone walls (72 tiles): 72 tiles (the centre), rows 0 and 11: columns 0–18; rows 1 and 10: columns 0–2 and 15–18; row 2: columns 0–1 and 17–18; rows 3–4: column 0; rows 5–7: columns 0 and 18; row 8: columns 0 and 17–18; row 9: columns 0–1 and 16–18.
- Crates and cover (4 tiles): a 1×2 block at column 6, rows 2–3 (top centre); a 1×2 block at column 5, rows 7–8 (middle left).
- Plank floors (148 tiles): 148 tiles (the centre), rows 1 and 10: columns 3–14; row 2: columns 2–5 and 7–16; row 3: columns 1–5, 7–13 and 16–18; row 4: columns 1–13 and 16–18; rows 5–6: columns 1–17; row 7: columns 1–4 and 6–17; row 8: columns 1–4 and 6–16; row 9: columns 2–15.
- No open ground: every tile is a feature.
- The party enters from the left, standing at (1, 3), (3, 4), (1, 5), (3, 6), (1, 7), (3, 8); enemies come from the right. Paint nothing there that would read as an object to walk round.

The rows as the rules read them:

```
WWWWWWWWWWWWWWWWWWW
WWWwwwwwwwwwwwwWWWW
WWwwwwcwwwwwwwwwwWW
WwwwwwcwwwwwwwBBwww
WwwwwwwwwwwwwwBBwww
WwwwwwwwwwwwwwwwwwW
WwwwwwwwwwwwwwwwwwW
WwwwwcwwwwwwwwwwwwW
WwwwwcwwwwwwwwwwwWW
WWwwwwwwwwwwwwwwWWW
WWWwwwwwwwwwwwwWWWW
WWWWWWWWWWWWWWWWWWW
```

Legend: `W` stone walls; `w` plank floors; `c` crates and cover; `B` timber walls.

## Prompt

**Live surfaces:** the layout marks water, oil, mud and rubble that the game draws. Paint dry earth beneath water and mud, clean flat stone beneath oil, and only the fixed cover silhouette beneath rubble. Do not bake liquid, flame or smoke into the painting. Keep interactable props separate. Village houses are open cutaways: walls fill their blocking cells and plank interiors remain visible and clear.

> Top-down painted ground for a tactics battlefield, seen straight from above with the faintest three-quarter tilt so anything that stands up shows a sliver of its south face; north is up; every tile the same size; no perspective convergence, no horizon, no sky. A broad deck of weathered planks on the water, ragged at its edges, with deep harbour water all round it. A cast-iron hand pump in its crate stands near the left end, in two places. A heavy timber winch with a crane arm stands near the right end, its brake lever on the deck beside it; the deck runs on to the right edge as a gangway toward a barge beyond the picture. Grey afternoon light off the water, the tide on the turn. Painterly ground with soft transitions inside a region and clean edges between regions; a clean, uniform dark-brown ink line (`#1b1410`) only where an edge is drawn, never black; two flat tones plus a thin rim light per material on the things that stand up (rocks, trunks, walls, crates); evenly lit, no vignette, no darkened corners, no cast shadows longer than a tile. Nothing the game draws itself: no characters, no creatures, no barrels, carts or braziers, no user interface, no text, no border, no grid lines. Landscape 19:12, 3648×2304.

## Negative prompt

> characters, people, creatures, animals, text, letters, watermark, signature, logo, user interface, icons, grid, border, frame, vignette, perspective, horizon, sky, isometric, 3D render, photograph, blur, depth of field, lens flare, glow, gradients

## Commands

```
npm run art:map -- --map saltstep_pontoon --px 96
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
