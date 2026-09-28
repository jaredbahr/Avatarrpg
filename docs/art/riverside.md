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

The delivered WebP is 1440 by 960, 40 pixels per tile, encoded at quality 88.
It is baked from the unmodified painting in `art/source/ba-dan-riverside/`,
with the painted edge stops below laid on it:

```
node --import tsx scripts/art/riverside-edge-props.ts
```

The bake encodes through the same `paintingWebp` step as
`scripts/art/map.ts --map ba_dan_riverside --px 40 --quality 88`.
`scripts/art/riverside-edge-props.test.ts` rebuilds it and compares the bytes.
Change the painting or a stop there and rerun the bake. Do not re-encode the
shipped WebP, which already carries the props.

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

## Painted edge stops

A blocked cell that reads as open ground needs something painted on it.
Paint an object; do not reopen the cell. The stops are the painting's own
elements, cut out, laid on the blocked cell with a shadow falling left and a
little down as the painting's shadows do, and relit where they move into shade
(method (b) of the edge-prop prototype). The cells behind them cannot be
reached, so the props live in the painting rather than as runtime scenery:

- the lane north between the middle and north-east houses, (15..17, 0..3): two
  bays of the tea garden's front-facing rail span the gap at (15..16,3), and
  the north-east house's eave and wall are laid back over the right-hand post;
- the lane west past (10,3), at (9,2): one more bay of the north-west garden
  fence runs from its end post to the tree;
- the west lane's end at the rim, (0,6): a mossy boulder, relit to the canopy
  shade;
- the east clearing's rim past the banner fence, (34..35,12): a second rank of
  log rounds behind the painted ones makes a woodpile against the fence;
- the south-east bank path, (34,21): a small mossy rock where the sand narrows
  between two trees. The prototype's boulder there drew over the canopy. Of the
  two fixes, the canopy mask is the cleaner: the rock stands on the top of
  (34,21)'s visible sand, and the leaves of the right-hand tree are laid back
  over its corner. The alternative moved the stop north onto (34,20). That
  would have closed a sand cell R1 opened, left the sand beyond the rock
  looking open, and put the rock level with the feet of anyone on (33,20).

Two stretches still read as open and have no stop:

- the back lane behind the north-west house, (4..5, 0..1), is unreachable, so it
  is low priority;
- the sand pocket's southern dead end: the sand and grass of (19..20,21) trail on
  under the trees at (19..20,22). A prop there would stand on the walkable cell
  or in the canopy, so the painted canopy is the stop for now.

## The tea garden walkway

The garden slabs west of the porch steps are a clear stone walkway, so (8,20)
and (5..8,21) are open, with no prop on them. By the flower rule the lawn they
cross, (4..6,20), is open too. The garden needs no added stop: the walkway ends
against painted solids on every side. Those are the boulders at (4,21), the
tea-house fence (4..6,19), its corner post (7,20), and the trees along row 22.
(8,21) must be open because movement is four-way: it is the walkway's only link
from (9,21). The small rock painted on it is left as it is, under the feet.
