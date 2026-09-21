# ADR 0044: The pond's bank reaches inside its own water tiles

**Status:** accepted, 2026-09-20

## Context

ADR 0042 gave every pooled material a wandering bank, and ADR 0041 gave water a
painted shore. Standing water still read as a filled polygon, because the forest
pond's own ground plate — `public/art/maps/forest-scene/pond-bank.webp` — is
packed from a generated source against an exact-cell guide: the dry bank stops
precisely where the rules' eight-cell cross stops, so the camera sees the tile
union in ochre no matter what the wash does. The packer's own note records this:
it "does not naturalize the exact eight-cell cross".

The route review lists this second, behind the prop contact shadows: the
references show an irregular shoreline with a visible bed, and ours showed a
straight-edged cross.

## Decision

The pond bank may reach a bounded way **inside** the water cells, using only the
material the artist drew:

- `scripts/art/forest-shoreline.ts` keeps its exterior band exactly as it was
  (opaque to 0.08 cells out, feathered to zero at 0.12) and adds a bite: a pixel
  inside a water cell is dry when it sits within `SHORE_BITE` (0.3 cells) of the
  water's boundary by an amount that wanders with seeded value noise
  (`biteDepth`, two octaves at 2.6 per cell, 30–100% of the maximum).
- The bitten pixels take their colour from the _nearest authored bank pixel_:
  one multi-source breadth-first walk out of the source's dry exterior builds a
  colour and distance map, and a small seeded offset along the shore turns the
  walk's parallel chains into mottle. Nothing is synthesised, and the source's
  own shallow-water mottling is deliberately not carried inward as fill.
- The bite's inner edge is feathered over `BITE_FEATHER` (0.05 cells), so wet
  and dry meet in damp silt rather than on a second ruled line.

The runtime water layer is unchanged and still covers every water cell, exactly
as the rules do: this is the shore the camera sees, not a change to what the
tile is.

## Consequences

The pond stops reading as the rules' boundary: the wet outline wanders, the bank
varies in width along it, and the hard teal-against-ochre line that made the
cross obvious is gone on both backends, because both draw the same ground plate
and the same translucent water over it.

Costs and limits: about a third of the pond's wet pixels can carry authored bank
under the water film, so the shore reads broad on this small a pond; the bite is
bounded well below half a cell and the cell centres stay clear, so the middle of
every water tile is still water and a unit standing there still reads as wet.
`scripts/art/forest-shoreline.test.ts` holds the bounds: reproducibility, the
exterior band, no teal in the plate, the deepest bite, and a clear centre on
every authored water cell. A full re-author of the pond bed — submerged stones,
reeds, a visible bed — remains open, as do the village canal and the quarry
floor's flat stain.
