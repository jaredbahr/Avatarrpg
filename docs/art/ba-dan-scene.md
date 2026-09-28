# Ba Dan modular courtyard layers

Built-in OpenAI image generation and deterministic material packing, 18–19
September 2026. Exact source prompts and generated filenames remain in
`ba-dan-scene-prompts.json`. Existing merchant houses, dwelling, village trees,
planters, and displays keep their transparent scene layers and warm upper-left
palette. They ship under `public/art/maps/ba-dan-scene/` and count against the
existing map family budget.

The active exploration proof is a partial authored scene. `BA_DAN_SCENE` sets
`groundMode: 'partial'`; Canvas and WebGL paint the procedural grid terrain,
then projected local ground pieces, then the live grid surfaces and overlays.
The former complete `ground-west.webp` and `ground-east.webp` pages were
historical assets with no active Ba Dan exploration consumer and were removed
from the shipped map family on 19 September 2026. Their committed history and
the deterministic packers remain available; the full-map backdrop is retained
for presentations that still use it, while partial exploration suppresses it so
modular scenery and the grid remain visible.

The local courtyard piece is `courtyard-ground.webp`, 1152×576 projected pixels
at `(640,256)`. It covers the logical `x5..15,y3..11` envelope with a half-cell
alpha feather and samples the reviewed four-quadrant material atlas for grass,
stone, and road. The image is already camera-projected; the renderer does not
skew it again. Its irregular projected boundary blends into procedural terrain
instead of ending at a rectangular opaque seam.

The western first-view approach is `western-approach-ground.webp`, 704×352
projected pixels at `(384,192)`. It covers only logical `x0..6,y6..9`: the
spawn road on rows 7–8 and its immediate grass shoulders. Its transparent
irregular mask leaves the permanent canal water at `(6,6)` to the runtime
surface. It retains grass/stone beneath blocked trees and the map edge so their
transparent scenery cannot reveal a procedural corner. The `x5..6` overlap is
sampled with the exact same logical-coordinate material function as the
courtyard and sits below that region's existing feather, avoiding a second
screen-space join.

The remaining connected village courts are six local transparent pieces packed
by `scripts/art/ba-dan-neighborhood-ground.ts`: northwest lawn (`x0..6,y3..6`),
north house court (`x4..17,y1..4`), east gate approach (`x14..23,y6..9`),
south house court (`x5..17,y10..14`), and the two outer lawns that closed the
last flat fields — northeast (`x15..23,y1..7`) and southwest
(`x0..6,y9..14`). Their half-open bounds overlap reviewed western/courtyard
pixels but deliberately leave rows 0 and 15 and the exterior tree rim
procedural. Every piece overlaps at least one neighbour by two or more cells, so
two exterior feathers never leave an uncovered band between them: the outer
lawns overlap the house courts west and north of them and the east gate approach
south of them. Water is transparent in every local piece. The packer uses only
decoded opaque quiet-grass (`x10..11,y4`) and broad flagstone (`x5..9,y7..8`)
source interiors from the tracked accepted courtyard asset; it copies exact
decoded RGB through existing overlaps and gives every new piece its own exterior
feather.

The canal's water is runtime-owned, but its ground layer is authored.
`canal-banks.webp` is a 576×288 piece at `(928,368)`, generated from the six
exact water-cell centres and the shared 64/32 projected diamond. It carries the
**bed** the water sits on — the tracked courtyard painting's own flagstone,
sampled one and a half cells nearer the viewer with that plate's world mapping,
shaded darker and cooler with distance inside the water so the middle of the
channel is its deepest point — and the **kerb** around it: the same paving moved
24% toward its own grey, shaded from wet stone at the waterline to the paving's
own brightness at the outer edge. Both are opaque; only the ground beyond the
coping radius is left clear. Permanent water remains the walkable `~` surface at
`(6..8,6)` and `(10..12,6)`, the dry road crossing is `(9,6)`, and the coping adds
no collision wall. The old water-bearing `canal.webp` candidate is superseded and
is kept only in ignored local evidence; it is not referenced or shipped. The
reasoning is [ADR 0046](../adr/0046-canal-bed.md).

The bridge is a transparent scenery layer registered to `(9,6)` with a single
logical footprint. `canal-bridge.webp` is the deck/back layer and
`canal-bridge-front.webp` is a near-bank mask derived by
`scripts/art/ba-dan-bridge-front.py`. Both use the same projected rectangle
(192×121.125 world pixels, centred at the crossing); depths `6.25` and `6.75`
let actors render between the deck and near rail. Rows 5, 7, and 8 remain open
for north/south approaches. The front mask is an occlusion aid, not a second
collision object.

The deterministic material and coping generators are:

```sh
npx tsx scripts/art/ba-dan-courtyard-ground.ts art/raw/scenes/ground-materials.png
npx tsx scripts/art/ba-dan-western-approach-ground.ts
npx tsx scripts/art/ba-dan-neighborhood-ground.ts
npx tsx scripts/art/ba-dan-canal-banks.ts
npx tsx scripts/art/ba-dan-restyle.ts
python scripts/art/ba-dan-bridge-front.py
```

## Restyle (direction B, 28 September 2026)

The upright scenery — `merchant-house`, `dwelling`, `merchant-display` (the
fruit stall), `low-planter`, `village-tree` and `canal-bridge` — was restyled
by direction B of the Ba Dan style study, which Jared approved on 28 September 2026. The OpenAI originals read as rendered rather than drawn: soft ramps on
every tile and fruit, no ink, more detail than a 40–90 px piece can hold, and
perfectly repeated tiles and baskets. The G party and the riverside painting
are flat clusters with hard steps and a dark contour.

Each piece is a PixelLab `image_to_pixelart` redraw (`faithful=false`,
`init_image_strength=0`, default guidance) at two screen pixels a texel, the
grain of the party and the riverside painting: the largest instance's world
width × zoom 1.2, halved. Its input was the shipped WebP as already published
on `main`. Three seeds were generated for each asset and the one closest to the
shipped silhouette was kept. The jobs, seeds and hashes are in
`art/source/ba-dan-restyle/pins.json`: 18 generations in all.

`scripts/art/ba-dan-restyle.ts` then does the rest deterministically, from the
tracked redraw and the tracked lossless decode of the texture it replaces:

- It keys the redraw's flat background. For the tree, this includes the
  pockets inside the canopy.
- It locks the palette: the redraw keeps its own stepped luminance but takes
  its YCbCr chroma from the shipped piece at the same place. PixelLab alone
  pushes the jade roof teal and the timber orange.
- It quantises to 32 colours with no dither.
- The redraw's darkest line work and the whole silhouette become `#1b1410`.
- Isolated specks take their neighbours' colour.
- A few repeated roof tiles, the second orange and pear baskets, and one
  planter kerb block are stepped a shade (`VARIATIONS`).
- It ships lossless, nearest-upscaled by a whole number (houses ×2, tree ×3,
  stall, planter and bridge ×4). Scenery is linearly filtered in both
  backends, so this keeps the grain crisp.

Nothing is drawn by hand. `ba-dan-restyle.test.ts` re-packs every asset and
compares each pixel with the shipped file.

The redraws register to the old footprints within about 1% of their width: the
front corners and the ends of the footprint land where they did. So every
anchor in `baDan.ts` still holds, and only the aspects changed.
`BA_DAN_TEXTURES` records the new pixel sizes. `BA_DAN_PLANTER_CUT` became 71
columns, the widest cut that still starts at the south-east house image's east
edge. The dwelling's smoke vent at (0.55, 0.19) still lands on the tiles just
under the main ridge, halfway along it. The bridge's front mask is re-derived by
`ba-dan-bridge-front.py`, which now states its cut in the texture's own
proportions.

The canal packer takes no arguments: unlike the courtyard and the historical
ground page, its material source is the tracked
`public/art/maps/ba-dan-scene/courtyard-ground.webp`, so the shipped
`canal-banks.webp` can be re-packed and byte-compared from a clean checkout.
`scripts/art/ba-dan-canal-banks.test.ts` holds that contract, the diamond metric
the bed is cut to, the depth gradient, and the kerb's dress and wet band.

The western pack derives from the tracked accepted local material source
`public/art/maps/ba-dan-scene/courtyard-ground.webp` (1152×576 WebP,
SHA-256 `691cadc6a8fd3a981aeafb18181eab0580ef62f89b51422c45165527367aac6a`).
It decodes that already material-composed region, copies its actual pixels in
the x5–6 overlap, and repeats only verified interior quiet-grass (`x10..11,y4`)
and broad-flagstone (`x5..9,y7..8`) swatches for the western cells. Courtyard
feather alpha is never carried into the western interior: the local region uses
its own exterior alpha feather. This is local material reuse, not a full-map
crop or recolouring. The older ignored raw atlas is not the source of this pack
and is not described as tracked.

The original scenery layers continue to use `scripts/art/scene-image.ts` for
alpha-trimmed WebP packing. The complete map encoder remains useful for old
art and other scenes; it is not used to fake coverage for this partial proof.
The shader's partial base pass suppresses its terrain-surface effects until the
overlay pass, so water, firelight, hatching, and grid marks are emitted once.
The WebGL filters are destroyed without taking ownership of Pixi's shared
program cache.

Browser evidence is recorded in
`docs/coordination/handoffs/ba-dan-neighborhood.md` with exact Canvas/WebGL
crossing and save/reload paths. It is technical local evidence only; it does
not claim physical-device, listening, or final visual-quality acceptance.

No new destination or map family was added. The source contract keeps the
existing roads, NPCs, exits, save positions, and walkable water behaviour.
