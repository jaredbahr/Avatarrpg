# ADR 0020: Build toward the approved player views

Status: accepted direction; staged implementation.

## Context

The owner approved three full player-view concepts as the long-term target.
The current exploration roster occupies a fixed-width side column, leaving less
room for the world, and exposes action-point pips outside combat. The reference
views put the party beside the actions and make the environment dominant.

## Decision

Use [the approved target](../player-view-target.md) as the shared presentation
reference. Begin with the exploration dock and camera recentering. Keep DOM
controls, existing portrait assets, tokens, minimum touch targets, the canvas
ResizeObserver and the current grid/camera transforms.

Portrait and narrow layouts stack the two dock sections below the map. Roster
cards and action rows scroll horizontally when necessary; the dock has a bounded
height and can scroll vertically at large text sizes. The map retains its own
flexible viewport. Recenter moves only the camera and keeps the current zoom.

## Consequences

- The world gains the space previously reserved for the side roster.
- The same party health and inspector remain available in a compact strip.
- The existing observer measures the new canvas box; pointer coordinates must
  still be checked independently of the camera's own reported values.
- The riverside pilot retains its specialized controls. It must not acquire an
  empty reserved roster column or duplicate recenter controls.
- The oblique projection in the pictures remains future work. Changing that
  contract, scene geometry or asset formats requires a separate ADR and tests.
- Reference PNGs are review material outside the shipped and precached assets.

No save migration, rules change, engine change or budget increase is required.
