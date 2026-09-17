# ADR 0018: North and south character locomotion

The existing hero sheets show side-facing action poses. Vertical travel therefore
reads as sideways sliding, and the riverside only has dedicated side walks for
Kaya and Sura.

Add optional `idleNorth`, `idleSouth`, `walkNorth`, and `walkSouth` clips to the
existing 2D sheet contract. Each hero receives one standing pose and four walk
drawings per direction. North shows the back; south shows the front. These poses
are not horizontally mirrored. Side-facing combat poses retain their existing
mirroring and fallbacks.

The character's original sheet remains the scale reference. The importer finds
transparent gutters, refuses cuts through visible artwork, and uses one scale
for all ten new drawings. Frames remain 128×192 with the existing (0.5, 0.85)
anchor and eight-pixel margins. Original idle, bending, wave and KO pixels are
copied unchanged into sibling `locomotion-*` atlases. Kaya and Sura also receive
`riverside-locomotion-*` atlases retaining their existing side walks and waves.

The animator derives cardinal direction from the movement curve. A narrow
diagonal hysteresis band prevents rapid direction changes around corners. It
retains the final heading at rest, including when reduced motion or a skipped
render frame crosses the end of the route. `clear()` resets that presentation
state. No heading is added to saves or simulation state.

Walk time still advances with distance: 500 ms of clip time per tile. Four
drawings at four fps complete a stride over two tiles. Both board backends and
the riverside overlay consume the same directional choice. The riverside uses
the unrounded distance clock for these walks. Authored action poses take
precedence while bending or attacking. Older sheets and procedural placeholders
fall back to their existing walk/idle clips while new art loads.

Validation covers unchanged original pixels, frame bounds and baselines for all
ten heroes and both riverside variants, direction changes, follower cadence,
reduced-motion completion, old-sheet fallbacks, and browser rendering in Canvas
and WebGL. Physical tablet review remains a separate device check.
