# ADR 0045: The pond holds the forest floor as a bed

**Status:** accepted, 2026-09-20

## Context

ADR 0041 gave water a painted shore and ADR 0044 let the pond's bank reach a
bounded way inside its own water cells, so the pond stopped tracing the rules'
eight-cell cross. The route review's remaining complaint about water is what lies
_under_ it: the painter lays a 0.4-alpha water film over each tile
(`SURFACE_STYLES.water`), which leaves roughly 64% of what the camera sees to
the ground plates below — and the pond plate was clear inside its water cells, so
that 64% was whatever ground the pond happened to sit on. The result was the flat
teal field the review calls "a uniform teal field" rather than a bed.

Both references show shallow water over a visible bottom: silt, colour that
deepens away from the shore, and small submerged stones.

## Decision

`scripts/art/forest-shoreline.ts` packs the pond's bed as well as its bank:

- Every packed pixel inside a water cell is **opaque bed**. There is no clear
  pixel left inside the pond for the backdrop or the retracted road plate to show
  through, and the runtime water layer still covers every one of them.
- The bed's material is the **forest's own floor**, sampled in world space out of
  `assets/source/forest-material-v2/material-sheet.png` with the same atlas
  mapping, guard and 192-pixel period the road itself is packed from
  (`forest-route-ground.ts`). The pond holds a piece of the ground around it, so
  the substrate's grain continues across the shoreline instead of changing
  material at the wet line, and the atlas's own pebbles arrive at their authored
  scale as submerged stones.
- The bed is **shaded by how far it sits inside the water**: `BED_SHELF` (0.78 of
  the floor's brightness at the shelf under the bank) falling by `BED_SHADE`
  (0.55) to its deepest point `BED_DEPTH` (1.5 cells) in, with a seeded
  `BED_MOTTLE` (0.07) and a small `BED_COOL` shift (red ×0.94, blue ×1.06),
  because standing water absorbs red first. The shading is smooth in cell space,
  so neighbouring pixels agree and the bed never speckles.
- The bank's bite (ADR 0044) now composites **over** the bed rather than fading
  into transparency, so its feathered inner edge meets silt instead of bare
  ground.

No rule, collision, surface, save, shader or painter change: the tile is still
water to the rules, and both backends draw the same packed plate.

## Consequences

Measured on the packed plate at `1368x912`, installed Chrome, both backends
passing the route harness: the bed covers all 131,072 wet pixels; mean plate
brightness falls from 156.3 over the dry bank to 102.5 on the shelf (0.3–0.6
cells in) and 68.8 in the middle (0.9 cells in and deeper); the deepest point
keeps 0.387 of the floor's brightness, so the bottom stays legible under the
film. In the running game the pond's middle measures 87.8/107.0/96.0 against
70.3/92.3/91.1 before — about 17% lighter, still green-teal, and now carrying
visible substrate and depth instead of one flat fill.

Costs and limits: `public/art/maps/forest-scene/pond-bank.webp` grows from
34,822 to 36,562 bytes (precache 17.32 MB of 25 MB). The bed has no reeds or
bank planting yet, and the boat-channel variant of the same problem — the
village canal's bed and bank, and the quarry floor's flat stain — is untouched.
The pond is shallow: its deepest cell keeps the floor's pigment rather than
reading as deep water, which is what a pond this size can support with one
authored material.
