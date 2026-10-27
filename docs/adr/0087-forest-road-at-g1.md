# ADR 0087: The forest road at G1, and the combat props with it

**Status:** proposed, 2026-10-27 (draft PR for the owner's review, issue #284)

Follows ADR 0085 (Route A: the world drawn at the characters' grain). Changes the forest road's art, its asset format
(new files under `public/art/maps/forest-g1/`), the six combat props, and the budgets' measured use, so it is recorded
here.

## Context

The owner asked to finish Ba Dan as it stands and to add one combat area in the new visual design "and see how it
looks". The forest road is the first fight. Its art was the layered painting of `docs/art/forest-scene-registration.md`
(OpenAI image generation, PixelLab reeds): soft and glossy beside the G sheets, the fault #284 opened on. Ba Dan's G1
review also gave two lessons to apply from the start: at a distance its ground went flat and bleached, and its objects
read too slight.

## Decision

**Same hand as Ba Dan.** One PixelLab `edit-images-v2` `edit_with_text` pass restyles the whole forest ground at world
px (one prompt, one seed, 512 px tiles, Ba Dan's `STYLE` and `KEEP` and its tiler), and every upright and prop is
redrawn by Pro Flash `edit-image-pro-flash` at its drawn size in world px. No figure is passed as a reference. Pipeline,
prompts, every job and the selection: `art/source/forest-road-g1/` (README there).

**Living but calm ground.** Ba Dan's ground sentence bleached the grass to one olive (probe in the ledger: saturation
0.461 and low-pass std 0.065 against the painting's 0.528 and 0.086, judged at the fit scale). The forest's own sentence
asks for broad patches of three or four greens that read at a distance, darker tufts along edges, moss in the cobble
joints and deep water (0.507 and 0.082). Then the restyle keeps its own pixels and only its broad colour moves back to
the painting's (YCbCr low-pass at sigma 12 px: chroma fully, luma 60%), and the board goes onto one 192-colour palette
with no dither, so flat tone groups stay flat. The raised shelf, the board's one elevation read, is taken down 10% in
luma so its sandstone does not read bleached; its face to top ratio stays 0.64 (painted: 0.635).

**Geometry did not move.** Every ground piece keeps its rectangle and its pre-G1 alpha exactly (the restyle is cut back
under each piece's own alpha), so footprints, water cells, the shelf's coverage and the open road exit are the same
pixels. Every upright keeps its rectangle, anchor and depth key; it was generated on that rectangle. The rubble heaps
are their own pieces and can be cleared in a fight, so the ground under them was restyled again from the composite
drawn without them and pasted over their footprint only (a Pro Flash inpaint filled smooth and pink: rejected). A few
pseudo-letters the generator wrote on the grass west of the lodge are closed over in the grass's own tones. Nothing in
`src/core/`, the map rows, the legend or `combat.ts` changed.

**Delivery.**

| piece                                | file px per world px | format                                                                 |
| ------------------------------------ | -------------------- | ---------------------------------------------------------------------- |
| ground, apron, shelf                 | 1                    | lossy q90, sharp YUV, exact alpha (Ba Dan's ground plates)             |
| pond and creek plates                | 2 (as before)        | the same; colour nearest-doubled, alpha the pre-G1 plate's own         |
| uprights (pines, alders, lodge, ...) | 1.5                  | EPX x2 then a 0.75 Lanczos (ADR 0085); lossy, or lossless 5-bit if not |
| combat props                         | 4 (256 px frame)     | nearest x4 into the frame the renderer draws into one 64 world px box  |

The forest's own alder, lodge and deadfall replace the art it borrowed from Ba Dan and the Quarry Gate (those files still
ship for their own scenes). Two pines (`pine`, `pine-b`, picked per cell by a hash, never the RNG) replace one stamp. The
forest's two heaps are its own (`forestRubbleHeap`); the Cutting and the Driller floor keep the shared plates. The
thrown oil flask's cels are ADR 0086's own G1 drawing (effects at G1), not cut from the prop.

**Ground stays at 1 file px per world px.** At the 1.5 camera a ground pixel is 1.5 screen px, filtered, so the ground
is softer up close than the 1.5x uprights and the figures. A 1.5x ground would cost about 0.4 MB more for the route
plate alone. When this was measured the precache had 0.15 MB left; since ADR 0086's effects pass it has 1.5 MB, so a
1.5x ground is now affordable, but it is a delivery-scale choice for every map at once and waits for the camera ADR ADR 0085 leaves open (an integer zoom), which
decides the delivery scale for every map at once.

**Budgets (measured, no limit raised).** The forest's G1 folder is 45 files, 1,009,808 bytes; it replaces 799,474
bytes of retired forest art (the forest-scene folder keeps its heaps, songbirds and water swatch, 61,970 bytes). The
props drop from 157,424 to 21,395 bytes. Maps family 7.01 MiB of 7.5;
precache 24.85 MB of 25 on main 5a41f98, and 23.50 MB merged with ADR 0086's effects pass (main 1641a8e).

**Tests.** `forest-g1-pack.test.ts` holds every shipped G1 file to its committed source byte for byte, every scene URL
to a shipped file and back, every upright to 1.5x its drawn rectangle, and every prop to its old foot at 4 frame px per
world px. The old forest plate tests now read the G1 files and keep their footprint checks exactly (`expectPackerAlpha`
and the apron's band-for-band alpha). The procedural apron is derived from the pre-G1 plates, which are kept as the
restyle's recorded inputs in `art/source/forest-road-g1/pre-g1/` and no longer ship. Five art-direction limits written
for the painted plates move, each to the G1 measurement with margin, and each says so where it is set:

| limit                                | was         | G1 measured | now      | why                                        |
| ------------------------------------ | ----------- | ----------- | -------- | ------------------------------------------ |
| route plate near-black share         | 0.0005      | 0.0074      | 0.01     | ADR 0085's 1 px contour on the kerb stones |
| route plate road cells green         | 0.05        | 0.057       | 0.07     | moss drawn in the cobble joints            |
| route plate 128 px window span       | 1.25        | 1.28        | 1.3      | value structure that reads at the fit      |
| shelf columns with a pale lip rim    | 0.6         | 0.58        | 0.5      | some lips drawn with the contour instead   |
| water centre / pond water blue share | 0.95 / 0.85 | 0.85-0.90   | 0.8/0.85 | lily pads and the contoured wet edge       |

The pin tests (byte size and SHA-256 of each 2026-10-03 plate) go with the plates.

## Consequences

- The first fight and Ba Dan share one generator, contour and light. The forest is the template for the rest of the
  combat maps: compose the ground pieces, restyle at world px in one pass with the forest's ground sentence, colour back,
  cut under the old alpha, redraw the uprights at their rectangles.
- The combat props changed on every map that uses them (the Quarry Gate, the Cutting, the Driller floor), at the same
  size and foot.
- The old procedural packers for the forest plates (`forest-route-ground.ts`, `forest-grass-regions.ts`, ...) still
  build the pre-G1 art and still own the footprints; their output no longer ships.
- **Open:** the ground's delivery scale (above) and the camera's integer zoom. The precache has 1.5 MB left after ADR 0086.

## Amendment, 2026-10-27: the polish pass

Owner: "Do a pass and clean up visuals." `tools/clean.py` (called by `cut.py`) and `tools/feet.py` (called by `select.py`);
jobs `clean-*` and `foot-*` in the ledger (23 jobs, 147 generations; 99 of them on tries that were rejected or not used, including one batch re-run by a tooling slip).

- **The south edge's cut face** showed as horizontal stripes: the pieces are below alpha 0.35 there, so what shows is
  `cut.py`'s colour carried outward. The four facets are redrawn on that carried colour as a shaded earth bank.
- **Lily pads** more than 10 px from a bank take the water's own colour, so the water cells read as open water.
- **Kerb ink**: on the route plate, away from the pond, the creeks and the shelf, near-black contour pixels take the road's
  own dark joint tone, so the kerbs no longer draw a stepped black line at the 1.5 camera. The route plate's near-black
  share falls, inside its limit.
- **Pine feet**: both pines' trunks root into a soil mound with grass; only the rows below the lowest bough change.
- An invented fern past the east shelf is redrawn as meadow. The bushes past the west corner lie where every ground piece is
  transparent and never show.
