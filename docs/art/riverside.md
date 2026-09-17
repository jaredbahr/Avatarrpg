# Riverside art and motion trial

The direction is an overhead illustrated world with ink-edged silhouettes,
painted ground and deliberate held poses. Bastion and Hades are references for
readable overhead movement; Spiritfarer, Hollow Knight and Battle Chef Brigade
inform gesture, pauses, weight and effects. Their characters and assets are not
used here.

The background was generated for this project at 1536 by 1024. Composition:
jade-roofed timber houses on the left bank, a banyan above an open village square,
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
