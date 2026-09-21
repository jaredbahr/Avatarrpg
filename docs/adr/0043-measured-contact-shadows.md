# ADR 0043: Contact shadows sized from the art that stands on them

**Status:** accepted, 2026-09-20

## Context

`painters/shapes.ts#groundShadow` is the one contact shadow every prop painter,
the sprite cache and the baked sheets share. It filled a fixed ellipse with
flat black, so a prop met the ground on a hard dark rim — the 20 September
route review's "objects standing on plain dark rectangles" — and the footprint
was a hand-set fraction of the tile, which was narrower than the barrel, the
cart and the stone pile that actually stand on it. A rim hidden under its own
prop grounds nothing, and one number cannot fit both a flask and a cart.

## Decision

- The shadow is filled with a radial gradient: density at the contact, feather
  across the outer half of the radius, nothing at the rim. Its centre stays on
  the `0.86` foot line the sheets are baked to, and it falls a hair
  down-screen, the way the board's ledge and cliff shadows do, for light from
  the north.
- A prop drawn from art measures its own footprint once per page
  (`render/propFootprint.ts`): the widest opaque run across the lower half of
  the image's silhouette, plus a small margin, clamped to the tile. Art that
  has not decoded or cannot be read falls back to `0.7` of a tile.
- Only the lower half counts, so a wide canopy, a raised arm or a haystack's
  overhang cannot widen the shadow; and the fade finishes inside the ellipse,
  so a cached sprite still never paints outside its box.
- Measurements are cached per prop key. Art is static at runtime, and one
  64x64 scratch read per key is not a per-frame cost.

## Consequences

A prop's shadow now follows the art it belongs to, including art that lands
later, without a table of hand-tuned widths to keep in step. The Canvas 2D and
WebGL backends share the sprite cache, so both change together, and no rule,
save, preview or asset format is touched.

Costs: one scratch canvas and one `getImageData` per prop key on first draw,
and a gradient fill instead of a flat one inside a cache rebuild that already
happens. The measured widths are in the review captures, not in the source, so
a change to a prop PNG changes the shadow with it.
