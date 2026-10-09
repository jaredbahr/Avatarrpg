# Ba Dan true pieces: sources and regeneration

The village's houses, market tables, planters and canal bridge ship as ten _true_ pieces
(`public/art/maps/ba-dan-scene/true-*.webp`): built from code geometry in the map's exact
projection, painted over, cut with the geometry's own silhouette, edge-treated, lit and packed.
Everything needed to regenerate them is in this folder and `scripts/art/ba-dan-guides/`; nothing
is read from `.review/`. The design is described in `docs/art/ba-dan-scene.md` ("Village pieces").

## Layout

| path                           | what                                                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/art/ba-dan-guides/`   | `pieces.py` (3D geometry), `guidelib.py` (renderer), `meas.py` (proportion probe), `build.py`, `edge.py`, `planes.py`, `regen.sh` |
| `guides/<piece>-guide.png`     | the flat-shaded guide, 1.5 image px per world px                                                                                  |
| `guides/<piece>-mask.png`      | silhouette mask (alpha) with plinth/stone and footprint colouring                                                                 |
| `guides/<piece>-footprint.png` | the full footprint quad                                                                                                           |
| `guides/pieces.json`           | canvas, anchor, foot polygon, door and steps, audit numbers per piece; `guides/README.md` is the geometry notes                   |
| `painted/<piece>.png`          | the painter's output for all ten pieces: binary alpha, 1 px outline inside the mask (`painted/NOTES.md`: method, prompts)         |
| `yards/<house>.png`            | the four houses with the rear terrace repainted into a yard (`yards/NOTES.md`: method, prompts)                                   |
| `planes/<house>.png`           | which axis-aligned plane the guide drew under each pixel (R: 1 horizontal, 2 east face, 3 south face; G,B: coordinate)            |
| `<piece>.png`                  | the edge-treated master the packer reads                                                                                          |
| `pins.json`                    | ground-line windows for the projection test (`scripts/art/ba-dan-true-pins.ts`)                                                   |

Pieces: `dwelling-4x3`, `merchant-house-4x3`, `dwelling-4x4`, `merchant-house-4x4`,
`merchant-display`, `-b`, `-c`, `low-planter`, `low-planter-1x2`, `canal-bridge`.

The dressing pass (ADR 0073) adds, from `scripts/art/ba-dan-guides/dressing.py` and `geo.py`: the set
dressing (`village-well`, `banner-pole`, `lantern-post`, `shop-stack`, `baskets`, `laundry-line`,
`notice-board`, `handcart`, `bench-2x1`, `garden-plot-3x2`, `stone-lantern`, `trough-hay`, `fence-2x1`),
the `terrace-planter-2x1`, and the wall modules (`wall-x-2`, `wall-x-2-buttress`, `wall-y-2`,
`wall-y-2-buttress`, `wall-y-1`, `wall-corner-inside`, `wall-end-pier-x`, `wall-end-pier-y`,
`gate-pier-n`, `gate-pier-s`). Built but not placed, so not tracked as sources: `firewood-shelter`, the
1x2 bench and fence, `wall-x-1`, the 1x2 and corner terrace planters. Their painted masters are
`painted/<piece>.png`; the painter's method, drift notes and prompts are `painted/NOTES-dressing.md`.
The props and the planter are edge-treated like the others (`edge.py`, the houses' outline brown; a
dressing master has no painted outline). The wall modules are not: `walls.py` lays them at their tiles
in the order `PLAIN_X` / `PLAIN_Y` / `BUTTRESS_X` give (the straight modules come in three paintings,
`wall-x-2`, `-b`, `-c`, and `wall-y-2`, `-b`, `-c`; `painted/NOTES-wall.md` has their prompts), re-takes
the pixels along each module cut (the painted outline there, the courses that do not meet) from a few
pixels further into the module on both sides of it, cross-fades the colours either side of every pier,
gate-pier and corner join along the wall's axis, fills the painters' black from the stone beside it,
takes the outer edge from the union of the modules' exact geometry, and keeps the guide's 1.5 px per
world px, writing `walls/north-west.png`, `walls/west-south.png` and `walls/walls.json` (canvas origin
in world px, the paintings in order, the joins). `ba-dan-true-pieces.ts` cuts the runs into strips and
packs them into `true-walls.webp` (two rows of three) and the props into `true-dressing.webp`;
`ba-dan-trees-pack.ts` packs `village-trees.webp` (the four masters from
`art/source/ba-dan-restyle/fine/` and the clumps `ba-dan-trees.ts` composites from them, the south and
east frame's among them; enclosed gaps in a canopy are filled at pack time, `closeGaps`).

## Regeneration order

From the repository root (python 3 with PIL and numpy for steps 1 to 3; they write only under this
folder):

1. `python scripts/art/ba-dan-guides/build.py`: guides, masks, footprints, `guides/pieces.json`
   (add `--sheets DIR` to lay out the three 1536x1024 painter sheets in `DIR`; they are the
   painter's input and are not tracked).
2. `python scripts/art/ba-dan-guides/edge.py`: `<piece>.png` from `yards/` (the four houses) or
   `painted/` (the rest): antialiased alpha from the geometry, two-pixel outline, outline colour
   bled under the fringe.
3. `python scripts/art/ba-dan-guides/planes.py`: `planes/<house>.png`.
   `python scripts/art/ba-dan-guides/walls.py`: `walls/` (after step 2, which edge-treats the props).
4. `node --import tsx scripts/art/ba-dan-true-pins.ts`: `pins.json` and `pins-dressing.json` (only when a silhouette moved).
5. `node --import tsx scripts/art/ba-dan-true-pieces.ts`: shade each house's horizontal faces from
   the shared light, grass fringe on lawn-standing stone feet, encode q90 with exact alpha, cut
   the bridge's near layer, lay the dressing and wall atlases; writes `true-*.webp` (`true-dressing.webp`, `true-walls.webp`
   included). `--check` re-packs and compares bytes. `node --import tsx scripts/art/ba-dan-trees-pack.ts`
   writes `village-trees.webp` the same way.
6. The ground plates, in this order, because they carry the light and contact baked from the pieces'
   volumes: `ba-dan-courtyard-ground`, `ba-dan-western-approach-ground`,
   `ba-dan-neighborhood-ground`, `ba-dan-garden`, `ba-dan-exterior-apron`,
   `ba-dan-north-fringe-ground`, `ba-dan-water` (each `node --import tsx scripts/art/<name>.ts`).
7. `node --import tsx scripts/art/ba-dan-restyle.ts --check` for the trees and the borrowed masters.

Step 6's `ba-dan-exterior-apron` also writes `exterior-frame.webp`, the south and east frame
(`node --import tsx scripts/art/ba-dan-exterior-apron.ts --plan` prints the band table and page layout
to paste into `baDan.ts` when the frame's ground changes).

`sh scripts/art/ba-dan-guides/regen.sh` runs steps 5 and 6 and the check;
`sh scripts/art/ba-dan-guides/regen.sh painted` runs the whole chain from step 1. With these
sources unchanged every step reproduces the tracked bytes (`ba-dan-true-pipeline.test.ts` holds
the packed files to that).

Changing the painted master: replace `painted/<piece>.png` (or `yards/<house>.png`) at the guide's
exact canvas, keep the silhouette inside the guide mask (the edge pass re-derives it from the
geometry whatever the painter did outside it), then run from step 2. Changing geometry
(`pieces.py`): the painted masters no longer register, so repaint them from the new sheets first.
Changing a placement or footprint in `src/content/scenes/baDan.ts`: run step 6 after step 5.

## Provenance

The painter was the built-in image editor, used once per complete sheet (three sheets: A the two
4x3 houses, B the two 4x4 houses, C tables, planters and bridge), with the guide sheet as the
immutable edit target and the earlier fine masters as material and style references; then once per
house for the yard. The verbatim prompts, the method and the measured registration drift (internal
structure within about 1-10 px of the guide; the silhouette is forced to the mask) are in
`painted/NOTES.md` and `yards/NOTES.md`. Those notes were written when the files lived under
`.review/painted-v3/` and `.review/yards/`; the paths in them are the old ones.

## Not reproducible from the repository

The painter's generations themselves: the painted masters are the record, not something the
pipeline can regenerate. Everything after them is deterministic.
