# ADR 0068: Combat camera keeps play zoom and bounded manual pan

## Status

Accepted.

## Context

Combat uses a fixed readable oblique scale: normally 96 CSS pixels per tile,
with the existing compact-layout choices of 64 or 40 pixels. The board is
deliberately larger than phone and iPad viewports and is navigated by panning.
Fitting the entire walkable hull would shrink characters and targets too far for
hot-seat tablet play.

The camera previously clamped to the projected bounds of the full map grid.
That made its edge read as a hard rectangle even where authored surroundings
continue beyond it. Blocked edge cells, including wholly blocked `X` rows, are
part of that grid and must remain showable; walkability does not define camera
bounds.

## Decision

Combat fit scale, default tile sizes, initial centring on the acting unit or
party, manual zoom, and reflow behaviour remain unchanged.

Manual panning and anchored zoom normally clamp to the projected full grid plus
the existing per-side painted allowance. Programmatic centring, including
acting-unit focus and Recentre, clamps to the grid:

| Map          |  Top | Right | Bottom | Left |
| ------------ | ---: | ----: | -----: | ---: |
| Quarry Gate  | 8.75 |     5 |   1.25 |    5 |
| The Cutting  | 8.75 |     5 |   1.25 |    5 |
| Quarry Floor | 8.75 |     5 |   1.25 |    5 |

These are measured painted extents rather than a nominal ring depth. The three
quarry values are derived from their shared `QUARRY_SURROUND`: relative to the
2048x1024 projected grid box it spans 320 px left and right, 560 px above, and
80 px below.

The camera may reach the outer edge of that ring but may not reveal page beyond
it. Clamp calculations use the entire grid rectangle without inspecting tile
walkability, so blocked and `X` edge rows count as visible authored ground.

Forest Road is the exception. Its manual-pan set is the convex hull of every
offset that programmatic centring can produce for the focus quad whose corners
are the four corner-cell centres. The camera maps that quad through the same
`centreOn` offset calculation and the same per-axis grid `clamp`; it adds exact
images where a quad edge crosses a clamp break line, then builds the convex hull
of those images. It also includes the image of every intersection between an x
and y break line that lies inside the focus quad: these are vertices of the
piecewise-affine subdivision even though they are not on the quad boundary.
A fitted axis therefore collapses naturally to `slack / 2`,
one fitted axis produces a segment, and two fitted axes produce one point.

The hull varies continuously with scale and viewport size, but nearest-point
projection becomes steep beside a fitted threshold. For example, 390×700 has
the exact oblique y-fit threshold `700 / 1024 = 0.68359375`; immediately above
it the reachable hull is a very thin trapezoid. If its diameter is `D` and its
smallest positive overflow is `m`, an edge endpoint motion `δ` can translate
the edge by `δ` and rotate its far end by at most `Dδ/m`. Continuity tests
therefore use the geometric condition bound `(1 + D/m)δ`, while retaining a
strict `< 0.01px` comparison at `threshold ± 1e-6`.

The painted Forest Road hull is not camera-clamp geometry. It remains map data
only for exact viewport-versus-fade clipping tests. This separation guarantees
that every programmatic focus remains a valid manual position, that a one-pixel
drag after focusing a rim unit cannot snap inward, and that a pinched-out board
does not freeze at grid centre while it still overflows. Reflow after a manual
pan or zoom reapplies the same reachable-set bound. If the pending move target
is still outside the padded viewport after the reflow's minimal pan, the scene
uses its ordinary programmatic centring position.

## Consequences

- Characters and targets retain today's 96/64/40-pixel combat scales.
- Initial combat framing is unchanged: fitting, acting-unit focus and Recentre
  use the grid bounds. A resize that preserves a manually panned or zoomed
  camera reapplies the painted-ring bounds against the new viewport.
- Forest Road manual pan shows no more apron than programmatic centring on a rim
  cell, plus the tested three-percentage-point allowance. Exact worst manual
  blank fractions at the reviewed cases are 13.1026% (1194x455 at 1.5), 15.2477%
  (1194x560 at 1.5), 21.6697% (834x890 at 1.5), 6.5249% (380x560 at 1.5), and
  25.8261% (1194x455 at 0.75). The 21.6697% exact result supersedes the 20.9%
  hand estimate; the invariant remains within three points of programmatic.
- Quarry maps retain the rectangular ring formula unchanged.
- Unit tests pin both ring endpoints and ensure the ring does not affect scale
  or initial centring. Existing viewport tests continue to own device framing
  and tile-size expectations.
- The routine camera matrix uses every rim cell, seeded interior cells, twelve
  geometric scales plus fit thresholds and named scales, and 200 seeded random
  offsets. `CAMERA_EXHAUSTIVE=1` restores all cells, sixty scales, thousands of
  offsets, and the larger independent `T(F)` sample for an opt-in audit.
