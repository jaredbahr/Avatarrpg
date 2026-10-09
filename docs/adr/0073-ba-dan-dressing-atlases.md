# ADR 0073: Ba Dan's set dressing, wall and tree clumps ship in three atlases

## Status

Accepted.

## Context

The village sat at `SCENE_IMAGE_CAP` (40 distinct images, ADR 0072) and at 77 of the 80 scenery
entries the schema allows. The dressing pass adds 17 placed props, a new boundary wall built from
painted modules and a new terrace planter, and trims the rim trees: that is 14 new sprites, six wall
strips and 49 trees, which cannot be 40-odd new URLs or 40-odd new entries.

## Decision

- `true-dressing.webp` is one atlas (2048 x 712) holding the 13 props and the terrace planter.
  Scenery draws its rectangles through `sourceRect`, as the surround already did. The props are
  guide-scale (1.5 px per world px, drawn at 2/3) like the other true pieces.
- `true-walls.webp` (2048 x 1125) holds the six strips of the boundary wall. The wall is composed at
  pack time (`ba-dan-guides/walls.py`) at the guide's own 1.5 px per world px and drawn at 2/3 like
  every other true piece; the first cut at 1 px per world px read soft beside the houses. A run is
  3.4k px long at that scale, so the strips are their own atlas (laid by hand in two rows, the
  shelf packer's tallest-first order would waste a third of it) rather than a third of the dressing
  atlas, and a new prop never moves a wall rectangle.
- `village-trees.webp` holds the four native tree masters and sixteen clumps (eight of the rim's and
  the eight of the south and east frame, which `docs/art/ba-dan-scene.md` describes; 1888 x 1756,
  laid by `packTight`, a MaxRects pack, where the first cut was shelf-packed at 1280 x 1833). A clump is
  the pixels several rim trees drew, composited at pack time at their own positions and mirrors,
  nothing scaled. A clump is only legal where no figure on a walkable tile, and no other piece of
  scenery, can tell that its trees now draw at one depth; `scripts/art/ba-dan-trees.ts` holds the
  rule and `ba-dan-true-pipeline.test.ts` the proof. A tree a figure can walk behind, the court
  trees and the two exterior canopies stay single and are drawn from the master's rectangle.
- The four `*-village-tree.webp` files and the wall runs in `village-surround.webp` are gone (the
  surround atlas keeps the two backdrops, 1824 x 640). Distinct images: 39. Scenery entries: 70
  (the two south planters that stood hidden behind the southern roofs, (6,9) and (14,9), are gone).
  The south and east frame (ADR 0075's context) then took the fortieth image, `exterior-frame.webp`, and
  eight more scenery entries: 40 of 40 images, 78 of 80 entries, 31 of the schema's 32 ground pieces.
- The trees' placement logic left the game bundle for `scripts/art/ba-dan-trees.ts`; the shadows
  still come from every tree on its own root (`ba-dan-village-light.ts`).

## Consequences

Maps art grows by about 0.8 MB against a budget it already exceeded (`node scripts/check-asset-budget.mjs`):
the clumps repeat tree pixels and the wall is three times the pixels it was. ADR 0075 sets the maps
family's budget at 7 MiB, and this sentence's budget is that one now. Decoded, the three
atlases hold 5.8 MB (dressing), 9.2 MB (walls) and 9.4 MB (trees; 12.6 MB once the frame's clumps joined) beside the 6 MB the removed files
held. Each lossy repack is checked for exact alpha. A change to a tree, a dressing piece or a wall
module goes through `ba-dan-guides/regen.sh`; the atlas rectangles in `baDan.ts` are asserted equal to
what the packers lay out. The well stands in the south court, (12,13): no tile near the square keeps
the north-west lawn's link to the square two tiles wide, leaves Gao his work tile (8,5), and clears
every door, stall and trail (`docs/art/ba-dan-scene.md`).
