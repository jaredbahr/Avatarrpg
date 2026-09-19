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
The complete `ground-west.webp` and `ground-east.webp` pages remain historical
assets and are not active Ba Dan exploration ground authority. The full-map
backdrop is retained for presentations that still use it, while partial
exploration suppresses it so modular scenery and the grid remain visible.

The local courtyard piece is `courtyard-ground.webp`, 1152×576 projected pixels
at `(640,256)`. It covers the logical `x5..15,y3..11` envelope with a half-cell
alpha feather and samples the reviewed four-quadrant material atlas for grass,
stone, and road. The image is already camera-projected; the renderer does not
skew it again. Its irregular projected boundary blends into procedural terrain
instead of ending at a rectangular opaque seam.

The canal's water is runtime-owned. `canal-banks.webp` is a transparent
576×288 coping piece at `(928,368)`, generated from the six exact water-cell
centres and the shared 64/32 projected diamond. It supplies textured stone only;
its interior is transparent. Permanent water remains the walkable `~` surface
at `(6..8,6)` and `(10..12,6)`, and the dry road crossing is `(9,6)`. The
coping is intentionally shallow and does not add a collision wall. The old
water-bearing `canal.webp` candidate is superseded and is kept only in ignored
local evidence; it is not referenced or shipped.

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
npx tsx scripts/art/ba-dan-canal-banks.ts art/raw/scenes/ground-materials.png
python scripts/art/ba-dan-bridge-front.py
```

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
