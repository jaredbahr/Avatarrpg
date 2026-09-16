# ADR 0008: Board atmosphere and height

**Status:** accepted, 2026-09-16 (lands with the look-gate milestone)

## Context

With the grid hidden (ADR 0007) and the effects in (ADR 0004), the board
itself was the flattest thing on screen: a hard rectangle of tiles on a dark
frame, trees as black squares with a stroke round them, ledges as a pale
line and a grey band, pits as flat black, a puddle as four rimmed squares.
The owner's reference reads as a place with ground, cover and height in it,
lit and framed. This ADR is the set of decisions that get the board there
without touching the rules or the tile-to-pixel contract every tap and every
e2e spec depends on.

## Decision

- **Elevation is drawn as cliff bands, never as shifted tiles.** A raised tile
  keeps its place; the step down is a face drawn inside the _lower_ tile
  along the edge it shares with the ledge (`src/render/geometry/board.ts`,
  `boardRelief`). From the three-quarter view only a south-facing step shows
  a face, with strata, cracks, a lit lip, an ink foot and a cast shadow; a
  step to the side is a shadow line; the plateau's exposed edges are rimmed.
  A unit, prop or NPC standing on high ground is drawn a little up the
  screen (`ELEVATION_LIFT`, 0.06 tile a tier) and nothing else moves, so
  `Camera.toTile` and `rendererCamera()` are untouched.
- **One decor painter for both backends.** Cliff faces, canopies for trees,
  roofed masses for wall runs, the falling floor of a pit, cover pebbles and
  a sparse scatter of tufts, stones, cracks and ripples are Canvas 2D
  routines in `src/render/painters/board.ts`, placed by `tileNoise` so a tile
  always draws the same. Canvas 2D draws them straight onto the board in a
  second pass, so a canopy may overhang its neighbours. WebGL bakes the same
  routines into chunk textures (`src/render/decorSheets.ts`): eight tiles
  square, at the zoom's sprite bucket, never sharper than 128 device pixels a
  tile, in a bounded least-recently-used set. Elevation, blocking and cover
  are rules-relevant, and this is what keeps them identical on both (ADR 0002).
  A wall run is outlined only round its outside, from the relief's `solid`
  edges, so it reads as one mass.
- **A pool is one shape.** The surface rim is drawn only on the sides where
  the neighbour is not the same surface (`surfaceEdges`); the WebGL shader
  reads its four neighbours for water pixels alone and laps foam along those
  banks. Off the map counts as a bank.
- **The canvas clears to transparent** on both backends (`backgroundAlpha: 0`,
  an alpha 2D context) and `.map-wrap` is transparent too, so what frames the
  board is the backdrop: its grain, its radial base and the mood wash, which
  now stays visible under the map scenes. High contrast keeps the frame plain
  and the wash off, as it already did.
- **Edge shading and a vignette** sit over the ground and decor and under
  everything that stands on it: the board's four sides fall off into the dark
  over 1.4 tiles and the corners of the view dim. Canvas 2D draws five
  gradients; WebGL draws five sprites of two baked gradient textures, in world
  units so they ride the camera. Both use the same constants, exported from
  the Canvas 2D backend. `MapView.atmosphere` turns them off under High
  contrast.
- **The air over the board is content.** `FX_AMBIENCE` in `src/content/fx.ts`
  keys a recipe of drifting motes by a map's `ambience` string (leaves and
  light in the forest, petals and light in the village, dust in the quarry),
  using a new `drift` particle shape born anywhere in the board's rectangle.
  The scene loops each emitter on the clock, two loops half a period apart,
  reseeded every cycle (`src/app/anim/ambience.ts`), so nothing is stored
  between frames. WebGL only and off under reduce motion: it is fidelity,
  not information. A map whose ambience has no recipe gets still air.

## Consequences

- The board reads as terrain with height, cover and a horizon on it, which
  with the hidden grid and the effects is the whole of the look the owner
  asked to judge before writing more story.
- The e2e pixel test that samples a puddle and a patch of grass still passes
  on both backends: shading multiplies, foam sits on the banks, the tile
  centres keep their colour.
- The old per-tile elevation lip, wall block and cover stones are gone from
  `paintTerrain` and the WebGL marker layer; anything that marks a tile from
  now on goes through `paintTileDecor`, and anything per edge through
  `boardRelief` or `surfaceEdges`.
- Decor memory is bounded (sixteen chunks, 64 MB at the sharpest bake) and
  cleared with the sprites on a resize, for the iOS canvas cap.
- A new ambience needs a recipe and nothing else; a new terrain needs a decal
  case, or none.
