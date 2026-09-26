# ADR 0050: Kaya uses authored eight-way PixelLab locomotion

**Status:** Accepted  
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
  `locomotion.walkMsPerTile`, so Kaya's feet do not skate.
- The supplied nearest walk-to-idle frame is a one-cel `rest*` transition for
  each direction.
- The atlas is lossily encoded as alpha WebP at quality 90. Atlas validation
  verifies the WebP header and dimensions; transparent-margin pixel checks
  remain available only for PNG sheets.
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
