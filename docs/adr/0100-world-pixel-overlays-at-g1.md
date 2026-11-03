# ADR 0100: World overlays use the G1 pixel grid

**Status:** accepted, 2026-10-29 (issue #341)

Follows ADR 0085 (G1 world art), ADR 0088 (integer camera zoom and sampling), ADR 0090 (world art at one px per world px), and ADR 0096 (actor and scenery occlusion). This records a rendering contract shared by Canvas 2D and Pixi; it changes no saved state, command, art asset, or view field.

## Context

Talk pips, exit markers, movement and target contours, route and aim cues, selection rings, target reticles, and knockout crosses were drawn as backend-specific vector paths. Their edges and apparent size varied with zoom, device-pixel ratio, and backend. Some marks also used broad strokes or soft bands, which did not follow the G1 world-art grid.

The demo audit's “enemy intent arrow” is the existing spike cap on an enemy health bar (`healthBarCap`, `HP_CAP.enemy`). There is no separate enemy-intent model or arrow renderer. The spike is decorative; this change converts only that existing cap shape.

## Decision

Both renderers draw these marks from the shared pure geometry and raster helpers in `src/render/pixelOverlayGeometry.ts` and `src/render/pixelMarks.ts`. One raster texel is one projected world pixel. Geometry and semantic anchors snap to integer G1 coordinates before rasterization; palette colours are flat RGBA, alpha edges are hard, and line widths are one or two G1 pixels. The masks use no blur or generated art. The talk and exit opacity pulse stays outside the raster key and is held steady under reduced motion.

Ground marks are authored in projected-world pixels, before camera scale and pan, using `camera.groundPoint`. Upright marks first preserve their existing screen-space anchor and then invert the camera transform to a snapped world-pixel coordinate. Both backends keep each mark in its existing draw order and clip path: ground ranges, routes, aims, and exits remain below upright actors and on raised tops; the exploration selection ellipse remains under its actor; talk, target, and KO cues remain in their current foreground passes. Pixi uses separate pooled sprites at the corresponding layer depths. Canvas retains its caller's clip while it switches from the oblique ground matrix to a square G1 mask transform.

The normal range contour keeps its rounded loop geometry. High contrast keeps square tile-set contours. Both use the same snapped palette masks. Route and aim lines keep their existing endpoints, arrow direction, and cue meaning. The route's dash pattern has a stable source phase so an animation clock does not invalidate every raster chunk; pulse and fade opacity remain draw-time values.

Existing colours, opacity, anchors, cue semantics, and ordinary-motion pulse timing remain. Under reduced motion, talk pips and exits use a steady visible alpha. Talk pips retain `npcPipLift` and their resident alpha, the target marker keeps its elevation/cloud meanings, and the enemy spike is made from the exact existing `healthBarCap` points and colours. Health-bar frame/fill, ally diamond, combat active-unit frame, climb and cliff cues, and obscuration veil stay in their existing renderers.

The enemy spike's local vertices are snapped relative to its raw cap midpoint, then the midpoint alone is snapped as the moving placement anchor. A camera pan therefore moves the source without changing its raster geometry or cache key.

Fractional overview zoom keeps the established linear sampling policy. At whole device-pixel stops, Canvas uses nearest sampling through `drawArt` and Pixi uses the matching source scale mode, following ADR 0088. Pixel masks do not change camera or picking geometry.

## Bounded storage and ownership

Large contours and routes use stable source-grid chunks no larger than 256 px per side. Only intersecting chunks are requested. Chunk destination rectangles partition the cue so a translucent pixel is composited once; line phase and the sampling gutter continue across chunk edges. A small pan retains stable interior raster keys.

The current limits are:

| Resource                       |                             Idle limit | Active-frame rule                                                                                                             |
| ------------------------------ | -------------------------------------: | ----------------------------------------------------------------------------------------------------------------------------- |
| CPU G1 raster masks            |                  1 MiB and 128 entries | Raster LRU may evict its own idle masks at any time.                                                                          |
| Canvas / Pixi drawable sources |                  8 MiB and 256 entries | Every visible source is retained through the frame; an exceptionally large visible set can temporarily exceed the idle limit. |
| Pixi `Texture` wrappers        | 128 total in the existing source cache | A wrapper stays while any stage sprite or offstage shadow-mask sprite references its texture source.                          |

Pixi retires a drawable source only after rendering and after detaching unused pooled sprites. Eviction queues the associated canvas; `trimTextures` scans the stage and the offstage shadow-mask source layer, and destroys the texture only when no live sprite refers to its source. Resize detaches mark sprites before clearing drawable and texture caches. Pixel-mark GPU source memory follows the 8 MiB / 256-entry drawable idle limit, with the same visible-frame exception. Other scene textures continue to follow their existing caches and are outside this mark-source limit.

## Consequences

- Canvas and Pixi share the same integer G1 mark pixels while preserving the existing layering and camera transform.
- A mark remains one world pixel wide at N1, N2 and N3; the camera and DPR scale that source grid using the established sampling policy.
- Large cues remain complete while raster work and idle sources stay bounded; visible sources are never destroyed while attached.
- No AI behavior, enemy-intent state, command semantics, view shape, or generated art changes.

Focused helper tests cover palette/alpha and integer bounds, anchor placement and culling, raised/shaken viewport reach, cross-chunk lines and contours, seam compositing, source reuse, route/aim arrow direction in both projections, target cues in both elevation directions, and drawable-entry eviction. Final rendered alpha, cross-backend parity, raised-tile picking and Canvas/WebGL captures are required at N1/N2/N3 and DPR1/DPR2 before delivery; record their results in the #341 handoff.
