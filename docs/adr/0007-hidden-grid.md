# ADR 0007: Hidden grid, soft overlays, curved paths

**Status:** accepted, 2026-09-16 (lands with the look-gate milestone)

## Context

The rules are tile-based and stay that way: eight-direction Chebyshev
movement, per-tile surfaces, Bresenham sight, the AI, the simulator and every
test depend on it. The presentation drew the grid the rules think in: a line
round every tile, a square per reachable cell, a dot per path step, a unit
sliding in straight hops. The owner's reference for the feel is a top-down RPG
whose surfaces are also cells underneath, but which never shows them. The
question was whether the feel needs the rules to change. It does not.

## Decision

Hide the grid in presentation. Nothing in `src/core` changes.

- **Grid lines off by default**, on both backends. A "Show grid" setting in
  Settings restores them for anyone who plans by counting squares; under High
  contrast the setting is forced on. The WebGL ground shader keeps its grid
  term behind a `uGridLines` uniform; Canvas 2D skips `paintGridLine`.
- **Overlays are contours.** A move range, a target set and a blast area are
  drawn as the rounded outline of the tile set (`src/render/geometry/contour.ts`):
  the boundary is traced per tile edge and every corner cut a quarter tile
  in, twice, so a long side stays straight and only corners soften. Holes are
  traced as their own loops and cut out. A wide, faint stroke under a thin,
  crisp one stands in for a feathered edge with no blur filter. The rounding
  never exceeds a quarter tile, so every tile in the set is still
  unambiguous; the hover highlight stays a rounded square. Under High
  contrast the overlays revert to crisp per-tile squares.
- **The path is a curve.** The tile-centre polyline with its corners cut and
  its endpoints pinned (`src/render/geometry/curve.ts`), ending in an
  arrowhead on the last tangent. Cutting a corner of three consecutive
  centres stays inside those tiles' own squares, so the curve never enters a
  tile the rules would not let the unit cross.
- **Units walk the curve.** The animator samples it by arc length under an
  ease-in-out over the whole move, adds a small vertical bob per tile of
  travel and flips the sprite to face the direction of travel. `renderPos`
  remains the sort key; the bob is a draw-time offset and never reorders
  units. Durations are unchanged, so `busy()` and `finishesAt` mean what
  they did.
- **Taps do not change.** A tap still resolves to a tile through
  `Camera.toTile`, `rendererCamera()` reports the same numbers, and the e2e
  helpers keep mapping tile to pixel through it.

Both backends draw the same loops from the same points, because overlays and
paths are rules-relevant (ADR 0002).

## Consequences

- The board reads as ground with regions on it rather than a chessboard,
  which is the first half of the feel the owner asked for; effects and
  atmosphere are the other half (ADR 0004, the atmosphere ADR that follows).
- A player who wants the squares has them back in one tap, and a
  high-contrast table never loses them.
- Contour tracing is pure geometry with its own tests; the backends memoise
  loops per overlay layer, so nothing is traced per frame.
- Anything that later draws a region of tiles (a reaction forecast, an
  ability's reach on hover) goes through `contourLoops`, never a square per
  tile.
