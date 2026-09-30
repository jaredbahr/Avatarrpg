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

Panning clamps to the projected full grid plus a map-authored painted ring on
every screen-space side:

| Map          | Ring depth |
| ------------ | ---------: |
| Forest Road  |  2.5 tiles |
| Quarry Gate  |    2 tiles |
| The Cutting  | 2.25 tiles |
| Quarry Floor |    2 tiles |

The camera may reach the outer edge of that ring but may not reveal page beyond
it. Clamp calculations use the entire grid rectangle without inspecting tile
walkability, so blocked and `X` edge rows count as visible authored ground.

The ring art and its fade into the page colour are a separate change.

## Consequences

- Characters and targets retain today's 96/64/40-pixel combat scales.
- Initial combat framing is unchanged because fitting and centring still use
  the grid bounds alone.
- A player can pan farther into authored surroundings, up to each map's ring.
- Unit tests pin both ring endpoints and ensure the ring does not affect scale
  or initial centring. Existing viewport tests continue to own device framing
  and tile-size expectations.
