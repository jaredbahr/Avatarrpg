# ADR 0046: The canal holds the village paving as a bed

**Status:** accepted, 2026-09-20

## Context

ADR 0045 gave the forest pond a bed because the painter lays a 0.4-alpha water
film over every water tile (`SURFACE_STYLES.water`) and leaves roughly 60% of
what the camera sees to the ground plate underneath. The village canal had the
same problem from the other side: `canal-banks.webp` was **transparent** inside
the water cells — it supplied coping and nothing else — so the ground plate below
showed through. That plate is `courtyard-ground.webp`, whose packer chooses stone
from the map's road rows (`=`, `.`, `B`, `l`) and grass everywhere else. Water is
`~`, which is not a road row, so the courtyard painted **grass** under the canal
and the village canal read as one flat pale band with a hard polygon edge. The
route review names it directly: "the bed is a uniform teal field and the bank is
a hard edge".

## Decision

`scripts/art/ba-dan-canal-banks.ts` packs the canal's ground layer, not just its
coping:

- **Every packed pixel inside a water cell is opaque bed.** The runtime water
  layer still covers all six permanent water cells; nothing here changes a rule,
  a collision, a surface or a preview.
- The bed's material is the **village's own paving**, sampled out of the tracked
  `courtyard-ground.webp` with that plate's own world mapping and offset
  `BED_ROW` (1.5) cells toward the viewer, onto the two rows the map marks as
  broad flagstone. The canal is cut into the street, so its bottom and its kerb
  are the same stone the player walks on and the grain continues across the
  waterline. The offset is a constant in cell space, and it clears the coping's
  own half-cell reach northward, so no part of the plate can sample the water row
  the courtyard paints as grass.
- The bed is **shaded by how far it sits inside the water** (`BED_DEPTH` 32 world
  pixels to full depth): the shelf under the kerb keeps `BED_SHELF` (0.78) of the
  paving's brightness and the middle of the channel loses a further `BED_SHADE`
  (0.42), with a seeded `BED_MOTTLE` (0.06) and a `BED_COOL` shift
  (red ×0.88, green ×0.99, blue ×1.12), because standing water absorbs red
  first. The shading is smooth in cell space, so neighbouring pixels agree.
- The kerb is **dressed stone**: the same paving moved `KERB_DESATURATE` (0.24)
  toward its own grey, shaded from `KERB_WET_SHADE` (0.86) at the waterline to
  `KERB_DRY_SHADE` (1.02) at its outer edge, with a `KERB_WET_COOL` red/blue
  shift in the wet band. The ramp is smooth, so it neither draws a line along the
  water nor ends in a bare edge against the street.
- **The source changed from the untracked four-quadrant atlas to the tracked
  courtyard plate.** The generator used to take `art/raw/scenes/ground-materials.png`
  on the command line; that file is ignored, so the shipped asset could not be
  reproduced from the repository. The packer now has no arguments and reads the
  same tracked file the game serves, which is also what makes its contract test
  able to re-pack and compare bytes.

## Consequences

Measured on the packed plate and the route harness at 1368x912, installed Chrome,
canvas and WebGL, both passing 2/2: the bed covers 24,576 pixels — exactly the six
permanent water cells' diamonds (4096 each) — and nothing outside the coping
radius is painted. Mean brightness falls from the kerb's own stone to the shelf
and again to the channel's middle, and in the running game the canal's water turns
from an opaque green-teal band into pale aqua over visible stone slabs with a
deeper middle, a dressed grey kerb on both sides and no bare outline.

Costs and limits: `public/art/maps/ba-dan-scene/canal-banks.webp` grows from
5,204 to 9,080 bytes (precache 17.32 MB of 25 MB; the JS budget is untouched —
this is art only). The water's **outline** is still the rules' tile diamond: the
kerb dresses it and the review's remaining water ask is bank planting and reeds,
which need authored material rather than reuse. The quarry floor's flat stain is
untouched, and the canal bottom is deliberately shallow — one cell of paving
under a shallow film — rather than reading as deep water.
