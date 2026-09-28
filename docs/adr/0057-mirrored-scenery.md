# ADR 0057: Mirrored scenery

**Status:** Accepted  
**Date:** 2026-09-28

## Context

The Ba Dan scene draws the south-east house over x 13..16, but the village
`rows` block its footprint out to (17,10) and (17,11). That paved strip read
as open ground with an invisible wall. The courtyard already has the right
object for it: `low-planter`, the scene's own low solid boundary. But its long
side runs along x, and this strip runs along y.

There were two ways to turn it: check in a mirrored copy of the WebP, or let
scenery mirror its own drawing. The copy would add about 40 KB to the maps
family, which stands at 3.94 of its 4 MiB budget. The flag costs a few lines
on each backend.

## Decision

- **`SceneScenery.flip`** mirrors the drawing left to right inside its own box.
  `x`, `y`, `width` and `height` stay the box on the page. The footprint and
  depth are authored for the mirrored drawing, so sorting and collision know
  nothing about it.
- **Both backends draw it, as board parity requires.** A mirrored planter
  still marks a solid cell. Canvas 2D mirrors about the box inside the
  piece's existing transform. Pixi anchors the sprite on its texture's right
  edge and makes `scale.x` negative, after `width`, whose setter keeps the
  sign.
- **The cutaway probes the drawn pixel.** `sceneryOpacity` reads the mask at
  `1 - x` for a mirrored piece, so a mirrored roof fades where it covers
  someone rather than where its texture would.
- The Ba Dan planter at (17,10)/(17,11) is the first use. Its depth ties the
  south-east house (x + y = 30) and it is listed after the house, as
  `baDan.ts` already requires for equal-depth frontage.

## Consequences

- Any upright scenery can be turned without a second asset. Ground images
  (`SceneImage` outside `scenery`) are not mirrored; nothing needs that yet.
- A mirrored piece that also leans in the wind would lean the other way on
  Pixi, because the skew applies in the sprite's mirrored space. No mirrored
  piece has `wind`. Add the sign if one ever does.
