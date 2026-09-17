# ADR 0018: Roaming from the riverside

Status: accepted, 2026-09-17. Builds on ADRs 0011 and 0017.

The riverside and Ba Dan now own reciprocal, named map exits. The south path
leads into the village, whose river path returns beside that exit. Both work
with a null story cursor. Pella's invitation still works, and the existing
Act 1 gates preserve encounter order and progression. The title preview can
follow these routes through the connected region while retaining its existing
temporary party and save isolation. Campaign travel autosaves normally.

The travel journal derives places from the current location, map return memory
and visited explore nodes (for migrated saves). It reveals destinations adjacent
to visited places, without listing undiscovered distant areas. Discoveries use
authored Condition predicates and existing story flags. The journal stores no
duplicate progress and adds no save fields. It gives leads for places already
visited and records what the party learned. Route conditions are readable on
touch devices. The journal is a reference, not a fast-travel menu.

Exploration animation now measures the smoothed path's arc length. Straight
and diagonal routes share a cruising speed, with acceleration and braking
capped at 120 ms each before reduced-motion scaling. Footstep sound times invert
that same distance curve. The walk bob fades at the start and stop so a
fractional final stride lands before the figure returns to idle. Combat move
durations, authored poses, sprite formats and game rules remain unchanged.

The departing riverside retains its own background until the walk completes,
even though the reducer has already committed the arrival location. Both
renderers share the journal and riverside layer. No directional artwork is
claimed by this change; the separate directional asset work remains compatible
with the existing distance-based clip clock.

Validation covers real reciprocal walks, null story cursors, unchanged party
XP, discoveries through save/load, migrated history, cruising pace and stopping
offsets. Browser coverage walks out of the riverside and back, checks the
journal, and compares the suspended campaign and stored saves. The gallery
includes the journal in landscape and portrait. The painted-path picking test
uses touch PointerEvents for pinch zoom, fixing mobile WebKit's unsupported
native mouse-wheel call without skipping the test.
