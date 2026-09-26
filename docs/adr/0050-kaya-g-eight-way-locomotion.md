# ADR 0050: Kaya uses authored eight-way PixelLab locomotion

**Status:** Accepted, amended by ADR 0051, ADR 0052 and ADR 0053  
**Date:** 2026-09-25

## Context

Kaya's replacement PixelLab set provides 192 px root-locked idle and walk cels
in eight directions, but no cast, hit, or KO replacement. The painted maps and
all other character art remain unchanged. The shipped unit-asset budget cannot
hold the uncompressed 128-cel locomotion atlas.

## Decision

- Only `unit.fire.kaya` uses the G atlas.
- Eight-way locomotion is a capability a sheet declares
  (`SheetEntry.locomotion`, `headings: 8`), never a global quantisation. The
  animator asks only a declaring sheet for diagonal and west clips; every other
  sheet keeps the four-way side/front/back choice, corner hysteresis included,
  exactly as before. Content validation requires a declaring sheet to carry an
  idle, walk and rest clip for all eight headings, requires `facing: 'both'` to
  declare it, and rejects eight-way clips on a sheet that does not. Sura and Bo
  opt in by adding the declaration and the clips, with no code change.
- Source locomotion is nearest-neighbour scaled to 75%, placed at x = -8 and
  y = 31 in 128 x 192 frames, and rendered at 128 pixels per tile with anchor
  (0.5, 0.85).
- Idle uses four cels at 4 fps. Walk uses twelve cels with a nominal 114 ms
  cadence. Route playback remains gameplay-timed; cel phase is distance-based
  from the measured per-direction root travel, declared on the sheet as
  `locomotion.walkMsPerTile`, so Kaya's feet do not skate. That travel is a
  screen measurement, so the animator scales it by the screen length of one
  logical tile of the route: 1 on orthographic ground, and on oblique ground
  about 1.12 along a grid axis, 1.41 screen-across and 0.71 screen-down.
  Because the rate depends on the heading, the phase is accumulated along the
  route, each segment of the smoothed curve at its own rate, so it runs on
  continuously through a turn. Four-way sheets keep a fixed 500 ms a tile.
- The walks are the corrected set (party-consistency, 2026-09-25): the first
  walks' leg projection left strides short and the feet 12-16 px above the
  line. Each direction's walk and rest cels are moved vertically so the
  planted sole meets the idle baseline, by the gate-measured
  `planted_sole_minus_baseline` at 0.75 (south up 4 px, the diagonals 1 px,
  east and west unmoved). North is the exception: seen from behind, the
  planted sole is the leading foot, a stride up-screen of where she stands,
  and lowering the walk 5 px to it dropped her head and body 6 px at the
  switch. The north walk is its idle's height, and drawn unmoved its mean
  lowest row sits 0.6 px below idle's and its mean head row 0.4 px below,
  so it stays where it was drawn. The west walk and rest are moved 6 px right,
  which puts their torso and head on idle's (east's already sit within 3 px).
  Idle never moves. (ADR 0051 raises the north-east and north-west walks 1
  and 2 px more, to hold every walk's mean lowest row within 4 px of idle's.)
- The walk-to-idle transition is a one-cel `rest*` clip per direction: the
  walk cel whose placed silhouette best overlaps idle cel 0, except
  north-east, whose best overlap is a contact pose with the trailing foot
  24 px off the anchor column; it stops on its passing pose (cel 9) instead,
  torso and head on idle's and the feet together under the column. (ADR 0051
  replaces the best-overlap rule with one that first requires the cel to
  stand like idle, which moves the south and south-west stops off a lone
  foot 15-16 px from the column, and re-picks north-west for its raised walk.)
- The south walk art stands 9 px taller than its idle (127 against 118 px).
  That is the art, not placement, and it is not rescaled: she reads a little
  larger while walking toward the camera.
- The atlas is lossily encoded as alpha WebP at quality 90, and validated on
  its decoded pixels, as shipped: the transparent margin on every cel, a
  SHA-256 pin per decoded cel, and for eight-way locomotion the feet on the
  anchor's foot line (standing cels within 6 px; stride cels no more than
  12 px above where she stands in that heading, which is the line or, when
  higher, idle cel 0's feet, and no more than 10 px below the line; the
  feet's centre within 32 px of the anchor column mid-stride). A WebP sheet without a pin file fails.
- `scripts/art/kaya-g.ts` (now `scripts/art/g-sprites.ts --character kaya`,
  ADR 0051) builds only from the pinned sources:
  `art/source/kaya-g/pins.json` records the SHA-256 of all 128 PixelLab cels
  and the four preserved action cels, and a missing, changed or unpinned source
  stops the build before anything is written. The build writes the decoded
  cel pins into the same file, so an intended rebuild is one reviewable diff.
- Kaya's existing east/west cast and KO cels are preserved as source cels and
  packed into the new atlas. Existing horizontal mirroring remains active for
  those legacy actions. No unprovided animation is fabricated.
- Canvas and WebGL select the same eight directional locomotion clips.

## Consequences

Kaya is sharper and more pixel-art-forward than the painted environments and
the existing party. Her locomotion is directionally correct and grounded, but
the 12 separately authored walk silhouettes can shimmer at game scale. Future
PixelLab cast, hit, and KO art can replace the preserved action cels without
changing the locomotion contract.
