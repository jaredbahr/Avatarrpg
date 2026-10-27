# ADR 0088: Integer zoom: the pixel-art boards draw on whole device pixels

**Status:** accepted, 2026-10-27 (owner: _"2. Do it."_, issue #284)

Closes the open camera item in ADR 0085 (_"a single on-screen pixel grid needs the camera to snap to 1x or 2x"_) and the
delivery-scale item ADR 0087 left waiting on it. Changes a rendering contract (how art is sampled) and the camera's fit and
zoom rules, so it is recorded here.

## Context

Since ADR 0085 the world is pixel art at G1: one art pixel per world pixel, 64 world px per tile. The camera drew it at any
CSS scale (1.5 in exploration, fitted tiles of 77 or 96 px in combat), times any device pixel ratio, so an art pixel landed
on 1.5, 2.25 or 4.5 device pixels. Smoothed, the art went soft; sampled nearest it would double some pixels and drop others,
so 1 px outlines doubled or vanished. That is the last thing standing between the world and the figures sharing one grid.

## Decision

**The oblique boards draw at a whole number N of device pixels per world pixel.** `Camera.integerZoom` is on for every
oblique map (Ba Dan, the forest road, the quarry, the cutting, the Driller floor) and off for the orthographic boards, whose
procedural art is not pixel art and whose "whole board on screen" fit would lose up to half its size to a floor.

- **N is device pixels, not CSS pixels.** The CSS scale is `N / dpr`, so a Surface (1.5 dpr) gets 2/3, 4/3, 2 ... and an
  iPad (2 dpr) 0.5, 1, 1.5 .... The backing store is already device pixels (`Renderer.resize`), so nothing is scaled again
  by CSS.
- **The offsets read back on the device-pixel grid.** `offsetX` / `offsetY` round to whole device pixels under integer zoom;
  the camera keeps the exact value underneath, so slow drags still add up. Every world pixel boundary then lands on a device
  pixel boundary, so no outline is split across a half-covered column. `project`, `unproject`, `groundMatrix`, `pickTile`
  and both backends read the same snapped numbers, so **picking stays the exact inverse of drawing**, lifted tiers
  (ADR 0065) included: nothing in `pickCell` or the lift changed.
- **Rendering at an integer scale and letting CSS scale the canvas was rejected.** A canvas stretched by 1.5 in CSS gives
  the uneven 1-2-1-2 pixel pattern this ADR exists to remove, and puts a second scale between the pointer and the board.

**How each view picks N** (`wholeDeviceScale`; `nearest` rounds by ratio, so k and k + 1 meet at sqrt(k (k + 1))):

| view                                           | N                                                                                                                                                                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| exploration (`fitExplore(96)`)                 | nearest to the preferred tile; at least a small board's fit (floor); at least `MIN_TILE_PX`                                                                                                                          |
| oblique combat (`fitExplore(px, 12, 'floor')`) | the floor of the tuned tile (96, or 64 / 40 on a short canvas), so the fight stays at least as much in view as it was tuned to show; at least `MIN_TILE_PX`                                                          |
| `fit()`                                        | the floor of the continuous fit, so the board still fits; if that is under `MIN_TILE_PX`, the smallest tappable N, and the board pans (the portrait exception, unchanged)                                            |
| a painted extent (`viewExtent`)                | never under the ceiling of the extent's minimum, so the painting's edge never shows                                                                                                                                  |
| pinch and wheel (`zoomAt`)                     | the gesture moves a continuous request; the board steps to the stop nearest it, anchored on the pointer (the ground under the fingers moves by at most half a device pixel)                                          |
| the zoom-out stop                              | the floor of the fit; where that is under one device pixel (the oblique boards at 1 dpr), the **overview**: the continuous fit, drawn smoothed, so "zoom out to the whole board" and Recentre's fitted state survive |
| the zoom-in limit                              | the ceiling of `maxScale` (2.5 CSS), so a 1 dpr screen has 1, 2 and 3                                                                                                                                                |

Measured with the shipped maps (`fitExplore(96)`; combat on a 200 px shorter canvas):

| device                      | dpr | before: tile, device px per world px | explore after | combat after |
| --------------------------- | --- | ------------------------------------ | ------------- | ------------ |
| desktop, 1368 x 912         | 1   | 96 px, 1.5                           | 128 px, 2     | 64 px, 1     |
| Surface, 1368 x 912         | 1.5 | 96 px, 2.25                          | 85.3 px, 2    | 85.3 px, 2   |
| iPad, landscape or portrait | 2   | 96 px, 3                             | 96 px, 3      | 96 px, 3     |
| phone, 390 x 844            | 3   | 96 px, 4.5                           | 106.7 px, 5   | 85.3 px, 4   |

The desktop at 1 dpr is the one view that has to move by a whole step either way. Exploration takes 2 (nearer 1.5 by ratio;
it also puts the current 2 px party sheets on exactly one device pixel each), and combat takes 1, because 2 would show a
third of the board the fight was tuned around. **Owner check:** either direction is one word (`'nearest'` or `'floor'`)
per view, not a redesign.

**The refit rules hold.** `ResizeObserver` still drives `onViewportChange`; a refit never eats a pinch zoom. Combat's manual
zoom calls `raiseToFit()` (raise a board a rotation left under its fit to the whole-pixel fit, keep a closer zoom), and
exploration's refit calls `resnap()`, which puts a scale a dpr change left off the grid (a window dragged to another screen)
back on the nearest whole N about the view centre. The battle opening's formation hold is a whole-pixel frame; only its
ease to the actor passes between whole scales, and is drawn smoothed while it does.

**Sampling: nearest exactly when it is exact** (`src/render/pixelSampling.ts`, both backends). Art whose pixel covers a
whole number of device pixels (at least one) is sampled nearest-neighbour; anything else is smoothed. Canvas 2D reads the
ratio from the context transform at each draw (`drawArt`: scene ground plates and uprights, the oblique backdrop, unit,
bend and resident frames); WebGL sets each texture source's scale mode from the sprite's own scale (`sampleArt`). So:

| art                                                           | at N = 1               | N = 2    | N = 3    | N = 4    |
| ------------------------------------------------------------- | ---------------------- | -------- | -------- | -------- |
| G1 world at 1 px (forest ground, effects, native 1 px sheets) | crisp                  | crisp    | crisp    | crisp    |
| party and enemy G sheets at 2 sheet px per world px           | smoothed (downsampled) | crisp    | smoothed | crisp    |
| Ba Dan regions and uprights, forest uprights, at 1.5 px       | smoothed               | smoothed | crisp    | smoothed |

A downsample, or a 1.5 px painting at N = 2, is never sampled nearest: that would drop or double pixels. The camera works
unchanged for both the current 2 px party sheets and the native 1 px sheets being rebuilt.

Text, the HUD, the grid overlays, markers and particles are not art pages and are unaffected; UI stays in `rem`.

## Delivery scale (the art follow-up)

Every map should ship at **1 art px per world px** and let the camera do all the scaling: that is the only density that is
crisp at every N. Today two kinds of art still ship at 1.5:

- **Ba Dan's regions, ground plates and uprights** (ADR 0076/0085: EPX x2 then a 0.75 Lanczos of the G1 world). This is
  not a packing-only change: the whole region pipeline (`scripts/art/ba-dan-regions/regions.py`, `SCALE = 1.5`, the
  accepted regions and the frozen geometry) is laid out in 1.5 "village pixels". Going to 1 px means re-cutting the
  regions from the 1 px G1 master (`art/source/ba-dan-route-a/world/world-g1.png` and its passes) at `SCALE = 1`, then
  `regen.sh`. It should roughly halve Ba Dan's 3.5 MB folder (2.25x fewer pixels).
- **The forest road's uprights** (ADR 0087: the same EPX and Lanczos). Its ground is already 1 px and is crisp now.

Both belong to the art cleanup pass now running on Ba Dan and the forest, so they are not done here: this change touches no
art source, no generated file and no packer. Until they land, those pieces are smoothed at N = 2 exactly as soft as they
were at 1.5, and crisp at N = 3 (the iPad).

## Consequences

- One art pixel is exactly N x N device pixels for every 1 px piece on the oblique boards, and the G1 world and the figures
  can share one on-screen pixel grid once the 1.5 px art goes to 1 px.
- At 1 dpr the desktop explores closer (128 px tiles) and fights further out (64 px); see the owner check above.
- Zoom is stepped: a slow pinch moves nothing until it crosses the halfway ratio, then jumps one whole scale. Under one
  device pixel the only stop is the overview, and a HUD reflow leaves a board there as it is (`resnap` ignores scales
  under one device pixel; `raiseToFit` raises one the fit outgrew).
- New maps ship at 1 px per world px. A density that does not divide every N (1.5, 2.25) is a smoothed piece.
- Tests: `cameraIntegerZoom.test.ts` (whole scales and device-grid offsets for Ba Dan, the oblique combat board and `fit()`
  at desktop, Surface, iPad both ways, combat canvas and phone; pick round trips including lifted tops; pinch steps,
  wheel floor, sub-pixel drags, dpr resnap, raiseToFit) and `pixelSampling.test.ts`. The e2e viewport, renderer, gestures
  and combat preview specs pass (33 of 33); the one expectation that moved is the 1368 x 912 combat frame at 1 dpr in
  `gestures.spec.ts` (96 px, now 64 px: combat floors).
