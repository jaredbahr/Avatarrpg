# Ba Dan true pieces: sources and regeneration

The village's houses, market tables, planters and canal bridge were ten _true_ pieces: built from code geometry
in the map's exact projection, painted over, cut with the geometry's own silhouette, edge-treated, lit and packed.
**They no longer ship.** Since 10 October 2026 the village is one continuous painting
(`docs/art/ba-dan-scene.md`, `scripts/art/ba-dan-regions/`), painted over guides rendered from this folder's
geometry; the sprites these pieces were packed into are frozen in `art/source/ba-dan-regions/geometry/sprites/`,
where their silhouettes are what the painting's uprights are cut by. What stays here is the source of that
geometry: the guides, the painted masters, the pins (`pins.json`, `pins-dressing.json`, which
`scripts/art/ba-dan-projection.test.ts` holds the shipped uprights to) and the python tools. The packers and the
ground bake described under "Regeneration order" were retired with the plates; they are in git history at
`7925789c`, and the whole chain below step 3 can be read as history.

## Layout

| path                           | what                                                                                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/art/ba-dan-guides/`   | `houses.py` (the four houses), `pieces.py` (tables, planters, bridge), `guidelib.py` (renderer), `houses_meta.py`, `build.py`, `edge.py`, `planes.py`, `regen.sh`                                |
| `guides/<piece>-guide.png`     | the flat-shaded guide, 1.5 image px per world px                                                                                                                                                 |
| `guides/<piece>-mask.png`      | silhouette mask (alpha) with plinth/stone and footprint colouring                                                                                                                                |
| `guides/<piece>-footprint.png` | the full footprint quad                                                                                                                                                                          |
| `guides/pieces.json`           | canvas, anchor, foot polygon, door and steps, audit numbers per piece (the houses add yard, proportions, light volumes); `guides/README.md` and `guides/README-houses.md` are the geometry notes |
| `painted/<piece>.png`          | the painter's output for all ten pieces: binary alpha, 1 px outline inside the mask (`painted/NOTES.md`: method, prompts; the houses, yard included, `painted/NOTES-houses.md`)                  |
| `planes/<house>.png`           | which axis-aligned plane the guide drew under each pixel (R: 1 horizontal, 2 east face, 3 south face; G,B: coordinate)                                                                           |
| `<piece>.png`                  | the edge-treated master the packer reads                                                                                                                                                         |
| `pins.json`                    | ground-line windows for the projection test (`scripts/art/ba-dan-true-pins.ts`)                                                                                                                  |

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
2. `python scripts/art/ba-dan-guides/edge.py`: `<piece>.png` from
   `painted/`: antialiased alpha from the geometry, two-pixel outline, outline colour
   bled under the fringe.
3. `python scripts/art/ba-dan-guides/planes.py`: `planes/<house>.png`.
   `python scripts/art/ba-dan-guides/walls.py`: `walls/` (after step 2, which edge-treats the props).
4. _(retired)_ `ba-dan-true-pins.ts` found `pins.json` and `pins-dressing.json` (ground-line windows) from the packed sources; the files
   are kept as the record the projection test reads.
5. _(retired)_ `ba-dan-true-pieces.ts` shaded each house's horizontal faces from the shared light, grass-fringed
   lawn-standing feet, encoded q90 with exact alpha, cut the bridge's near layer and laid the dressing and wall atlases;
   `ba-dan-trees-pack.ts` packed `village-trees.webp`.
6. _(retired)_ the ground plates (`ba-dan-courtyard-ground`, `-western-approach-ground`, `-neighborhood-ground`, `-garden`,
   `-exterior-apron`, `-north-fringe-ground`, `-water`) carried the light and contact baked from the pieces' volumes.
7. `node --import tsx scripts/art/ba-dan-restyle.ts --check` still checks the lodge and the alder the Forest Road borrows.

`sh scripts/art/ba-dan-guides/regen.sh` runs steps 1 to 3 now. The shipped village is produced by
`sh scripts/art/ba-dan-regions/regen.sh` from the accepted region paintings (`art/source/ba-dan-regions/`).

Changing the painted master: replace `painted/<piece>.png` at the guide's
exact canvas, keep the silhouette inside the guide mask (the edge pass re-derives it from the
geometry whatever the painter did outside it), then run from step 2. Changing geometry
(`pieces.py`): the painted masters no longer register, so repaint them from the new sheets first.
Changing a placement or footprint in `src/content/scenes/baDan.ts` no longer touches any art here: the painting is registered to the frozen geometry (`art/source/ba-dan-regions/geometry/`), so a moved piece is a repaint of the region it stands in.

## Provenance

The painter was the built-in image editor, used once per complete sheet with the guide sheet as the
immutable edit target and the earlier fine masters as material and style references. The tables,
planters and bridge came from sheet C (`painted/NOTES.md`: verbatim prompts, method and the measured
registration drift, internal structure within about 1-10 px of the guide, the silhouette forced to the
mask; written when the files lived under `.review/painted-v3/`, so the paths in it are the old ones).
The four houses were painted over the round 4 sheets A and B (the two 4x3, the two 4x4: the yard is
part of each house, `painted/NOTES-houses.md`), registered within 1 px; the painter simplified some of
the yards' contents (the potter's drying bench and pots, some of Gao's barrels and crates), which the
village keeps. The edge pass gives the houses the houses' outline brown, as it does the dressing (their
paintings carry no outline of their own).

## Not reproducible from the repository

The painter's generations themselves: the painted masters are the record, not something the
pipeline can regenerate. Everything after them is deterministic.

## Odd-visuals pass (9 October 2026)

Finishes, none of them new paint (each is a function of the painted masters, the guide's planes or the ground
bake, and `regen.sh` reproduces them):

- `edge.py` fills the painter's pure-black seam (and the bright specks in it) in a house's painting from the stone beside it
  (`unblack_seams`; it was written for round 3's yard paintings, whose front kerb carried a dashed black line). The fill is
  darkened by 0.72 so it reads as a mortar joint. Alpha is untouched.
- (Round 3 also had `fringeYard`, grass over the yard's bare-earth back edge. Round 4's yard is bounded by its own kerb or
  fence on every side, so there is no such edge and it is gone.)
- `ba-dan-village-light.ts` carries the baked contact line a line's width in under every foot (a stair of lit pixels
  between the painted foot and the rectangle read as dashes) and gives the route sign's post (`FIXTURE_FEET`) the same contact
  as dressing; `ba-dan-village-material.ts` wanders the trodden-wear band (a domain warp), rounds and breaks the door
  landings' edges, and no longer lays a lip of grass across the road at the rim (the cell beyond a road mouth is road).
- `ba-dan-exterior-apron.ts` (`frameColour`, `marginFinish`) paints the woodland floor and scrub in broad soft drifts that
  keep the lawn's grain, not small flat blotches.
- `surround-trim.py` (see `art/source/ba-dan-surround/README.md`) trims the sliced roofs and ruled edges out of the backdrop.

## Round 4 houses (guides only, 9 October 2026)

The four houses were redesigned as whole buildings (a visible far roof slope, a plinth all round at 18 px, a yard of its own on the
footprint's west tiles) under new ids beside the shipped ones: geometry `scripts/art/ba-dan-guides/houses_v4.py`, driver
`houses_v4_build.py`, data and numbers in `guides-v4/` (`README.md` there has the figures, the yard layouts, the footprint
proposal, the tests to expect failing at the swap and the swap checklist). Nothing shipped changed, and `build.py` now runs
(its `pieces.json` write had a broken line) and reproduces the tracked guides byte for byte.

## Houses, round 4 (the swap)

The round 4 houses (`guides/README-houses.md`) are the village's houses, in the ids the round 3 houses had
(`dwelling-4x3`, `merchant-house-4x3`, `dwelling-4x4`, `merchant-house-4x4`), on the same footprints and blocked
tiles. What the swap changed outside the art: the light volumes are the guides' (`ba-dan-houses.ts`, with `density`
where a panel lets sky through), the chimney points (`BA_DAN_CHIMNEYS`) are the chimney mouths, the door landings
centre on the new stair (`STEPS_CENTRE` 0.9), the roof/wall shade on the plinth, steps and yard floor takes the
house's whole upstanding volume, and each house sorts as one piece by the lane cell below its south-west corner
(`house()` in `baDan.ts`; `baDan.test.ts` holds it): the yard is part of the sprite, and the old front-corner key put
a figure on the lane beside the yard behind the fence it stands in front of.
