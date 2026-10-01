# ADR 0068: Combat camera keeps play zoom and clamps to the painted ring

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

Manual panning and anchored zoom clamp to the projected full grid plus a
map-authored painted allowance on each screen-space side. Programmatic
centring, including acting-unit focus and Recentre, still clamps to the grid:

| Map          |  Top | Right | Bottom | Left |
| ------------ | ---: | ----: | -----: | ---: |
| Forest Road  |  2.2 |   4.4 |    2.2 |  4.4 |
| Quarry Gate  | 8.75 |     5 |   1.25 |    5 |
| The Cutting  | 8.75 |     5 |   1.25 |    5 |
| Quarry Floor | 8.75 |     5 |   1.25 |    5 |

These are measured painted extents rather than a nominal ring depth. The three
quarry values are derived from their shared `QUARRY_SURROUND`: relative to the
2048x1024 projected grid box it spans 320 px left and right, 560 px above, and
80 px below. Forest Road's values are derived from its 2.2-logical-tile painted
fade: 2.2 projected tiles vertically and 4.4 horizontally. Its plates retain a
2.5-tile allocation so transparent colour bleed survives WebP filtering.

The camera may reach the outer edge of that ring but may not reveal page beyond
it. Clamp calculations use the entire grid rectangle without inspecting tile
walkability, so blocked and `X` edge rows count as visible authored ground.

Forest Road derives its screen-side allowances from the apron's painted fade
extent rather than repeating a camera literal. Its oblique projection doubles
the logical apron reach on the left and right while leaving one fade depth on
the top and bottom. The plate has colour bleed beyond that alpha edge, but the
camera may not count clear bleed as paint.

## Consequences

- Characters and targets retain today's 96/64/40-pixel combat scales.
- Initial combat framing is unchanged: fitting, acting-unit focus and Recentre
  use the grid bounds. A resize that preserves a manually panned or zoomed
  camera reapplies the painted-ring bounds against the new viewport.
- A player can pan farther into authored surroundings, up to each map's ring.
- Unit tests pin both ring endpoints and ensure the ring does not affect scale
  or initial centring. Existing viewport tests continue to own device framing
  and tile-size expectations.
