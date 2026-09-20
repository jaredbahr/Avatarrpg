# ADR 0041: Ground joins drawn from the rules grid

**Status:** accepted, 2026-09-20

## Context

The route's ground is authored art ([ADR 0039](0039-modular-illustrated-world.md)):
every map from Ba Dan to the quarry floor is a partial scene whose regions and
scenery are painted images. Their material edges are therefore as straight as
the tiles under them, which is the largest "unfinished" impression the
20 September route review found: paving meets grass along one diagonal, the
forest road ends on a line, the quarry floor steps between two materials, and
the pond is a tile-shaped polygon of flat teal.

Procedural tile decor, which is where a join would naturally live, is not drawn
over a complete scene — the picture owns the ground there.

## Decision

Derive the join from the rules grid and draw it over the ground, on both
backends, wherever two ground materials meet:

- `geometry/board.ts` gives each tile the material on each of its four edges
  (n/e/s/w). Standing water counts as its own material, so a pond tile joins
  dry ground the way a road joins grass. A join exists only between tiles at
  the same elevation, because a ledge keeps its cliff face.
- `painters/board.ts` paints it: the neighbouring material reaches into the tile
  in a ragged wedge, with a contact shade under it and, on some edges only, its
  own litter — grass tufts, laid chips, grit, or the stones and reeds of a bank.
  Everything stays inside the tile box so the WebGL chunk bake cannot clip it.
- A bank is laid deeper and more solidly than a dry join: it stands in the water
  it edges and is what breaks the tile outline. Reeds and stones are sparse, so
  a long boundary does not read as an evenly spaced row.
- The Canvas 2D backend draws the joins in their own pass over a complete
  scene, and the WebGL backend bakes the same painter into its decor chunks in
  a third mode (`seams`) instead of drawing the full decor, which a complete
  scene still suppresses.

The decor signature now includes whether a tile carries standing water, because
the join depends on it: a puddle that appears or dries changes the shore around
it, and the WebGL bake must follow.

## Consequences

The board reads as worked ground over the picture, and a water hazard keeps its
tile-shaped rules footprint while its visible outline is organic. The picture
still owns everything else, so this is a join between authoring and the grid —
not a replacement for authored ground art. Authored regions whose material
edges do not follow the grid would show the join in the wrong place; keep
regions registered to the tiles they paint.

Costs: a per-tile pass on Canvas 2D over a scene, and one extra chunk mode on
WebGL. Re-baking decor when standing water appears or disappears is a handful of
chunks per encounter, not per round. No rule, save, preview or asset format
changes.
