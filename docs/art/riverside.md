# Riverside art and motion trial

The direction is an overhead illustrated world with ink-edged silhouettes,
painted ground and deliberate held poses. Bastion and Hades are references for
readable overhead movement; Spiritfarer, Hollow Knight and Battle Chef Brigade
inform gesture, pauses, weight and effects. Their characters and assets are not
used here.

The background was generated for this project at 1536 by 1024. Composition:
terracotta-roofed timber houses on the left bank, a banyan above an open village square,
a stream and waterfall through the right third, a central wooden bridge,
a practice clearing across it, a north-east shrine and a south-west tea veranda.
Warm afternoon light, sage foliage, cream paths, mossy stone, gentle painted
texture and brown ink accents; no characters, animals, lettering, UI or grid.

The delivered WebP is 1440 by 960, 40 pixels per tile, encoded at quality 88:

```
node --import tsx scripts/art/map.ts --map ba_dan_riverside --in <source.png> --px 40 --quality 88
```

The generated prompt pack describes future regeneration at the standard larger
size. The current painting uses the explicit 40-pixel setting above and the map's
backdrop metadata agrees. New characters and effects remain code-drawn, so they
can move independently of the painting. This tests the motion language before
commissioning or generating a complete set of directional animation sheets.

Review at fitted zoom and zoomed in: foot sliding, readability of the two forms,
foreground occlusion near the banyan, path-to-paint alignment, Pebble's scale,
text contrast and the cost of the second canvas on actual iPads. The cliff and
roof boundaries are intentionally conservative in this first art-first area.

## Walkable ground against the painting (R1)

The grid was re-traced against the painting cell by cell. Sand that is plainly
open is now walkable:

- the west lane (1..4, 6..9);
- the path north of the square at (10,3) and (11,5);
- the south path beside the exit (11,19..21);
- the sand pocket south of the square (17..20, 18..21);
- the south-east bank path (32..34, 16..20) and the tea deck at (7,19).

A painted solid now blocks the one cell its base stands on:

- the practice posts (31,10), (30,11), (30,12) and (33,13);
- the lantern (30,14), the rock (31,14) and the trunk (30,16) on the lower
  east-bank lane;
- the rocky bank (20,13);
- the garden fences (16,5) and (10,15..17).

**Flowers never block on their own.** A flowerbed is as walkable as the
ground it grows in. It blocks only where a fence, post, pot, rock or wall
stands on the cell, or where the ground itself is not walkable, as on the
shrine terrace's rocky ledge at (29,4) and (33,4). By this rule the beds in the
square (9..10,5) and west lane (4..7,7) stay open, and so are:

- the bed in front of the middle house (12..13,5), whose pot at (12,4) blocks;
- the bed inside the north-east fence (19,6), (20,5..7), which R1 had closed as
  an island; the fence (19,5) and (21,6) and the barrel (18,6) still block;
- the clump at the lantern's foot (4,10);
- the daisies at the sand pocket's west side (18..19,21).

Canopy is still not a footprint. Every walkable cell of the south path belongs
to the exit mouth, so the map sets `edgeContract: 'enforce'`.

These blocked cells still read as open ground and need a painted stop. Paint an
object; do not reopen the cell:

- the lane north between the middle and north-east houses, (15..17, 0..3), runs
  to the rim;
- the lane west past (10,3) continues at (9,2) behind the north-west house
  fence;
- the west lane reaches the rim at (0,6);
- the south-east bank path runs on under the canopy from (34,21);
- the east clearing reaches the rim past the banner fence at (34..35, 12);
- the back lane behind the north-west house, (4..5, 0..1), is unreachable, so it
  is low priority.

The garden slabs west of the porch steps are a clear stone walkway, so (8,20)
and (5..8,21) are open, with no prop on them. By the flower rule the lawn they
cross, (4..6,20), is open too. The garden needs no added stop: the walkway ends
against painted solids on every side. Those are the boulders at (4,21), the
tea-house fence (4..6,19), its corner post (7,20), and the trees along row 22.
(8,21) must be open because movement is four-way: it is the walkway's only link
from (9,21). The small rock painted on it is left as it is, under the feet.
