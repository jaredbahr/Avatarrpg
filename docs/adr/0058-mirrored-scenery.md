# ADR 0058: Mirrored scenery

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

- **At an equal-depth tie, the figure wins on both backends.** Canvas 2D
  lists scenery ahead of every figure and sorts stably, so a figure level
  with a piece draws over it. Pixi used the bare ground depth for both and
  broke the tie by child order. That order was accidental: scenery sprites
  are added when a scene first loads and figure sprites are reused across
  map changes, so which one won depended on how the player had reached the
  map. Scenery now sits 0.002 under the tie, below a figure's shadow at
  0.001 as well (`backends/depthOrder.ts`, with a test of the sort). The
  cutaway follows: `sceneryOpacity` skips a figure at the tie, since nothing
  of it is behind the piece. Kaya at (18,11), level with the turned planter
  and the south-east house, no longer ghosts the house.
- **The turned planter is two depth slices**, cropped from the one texture
  with `sourceRect` like any atlas piece. Its far end sorts level with (18,10),
  so a figure there stands in front of it rather than behind the whole
  planter. The cut sits at the house image's east edge, not at the cells'
  join: shallower than the house, a slice under the house's awning post would
  lose to it. A mirrored slice crops the texture's other end, since the box
  mirrors the crop.

## Consequences

- Any upright scenery can be turned without a second asset. Ground images
  (`SceneImage` outside `scenery`) are not mirrored; nothing needs that yet.
- A mirrored piece that also leans in the wind would lean the other way on
  Pixi, because the skew applies in the sprite's mirrored space. No mirrored
  piece has `wind`. Add the sign if one ever does.
