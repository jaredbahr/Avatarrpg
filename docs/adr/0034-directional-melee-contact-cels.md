# ADR 0034: Directional melee contact cels

Status: accepted for the Riko directional contact correction, 2026-09-19.

Riko's existing side-facing melee cel can read as a near miss when the target is
above or below her in the projected battlefield. The logical attack already
resolves correctly, so the presentation needs an authored contact pose without
changing positions, range, damage or hit timing.

## Decision

Keep the existing `melee` timeline and add an optional per-sheet contact map:
`screenUp` and `screenDown` each name a two-frame pair. The direction is chosen
from the projected screen vector only when its vertical component is dominant.
Side and near-horizontal attacks continue through the existing cast/side pose.
The choreography carries the optional token through the pose track, animator and
view model. Both render backends pass it to the shared sheet store, which
resolves the authored pair when it is present and falls back to the normal clip
when the atlas or metadata is unavailable.

Riko uses two unused 128×192 cells in the existing 1024×576 atlas. Existing
cells remain byte-identical. The asset schema and art validator check every
directional frame for presence, dimensions and the same clear margin as normal
clip frames. The active marker follows the transient offset only while a
directional contact pose is playing, so the marker stays under the moving feet;
logical positions and all other marker behavior remain unchanged. Canvas 2D and
Pixi both derive that point through the same elevation-aware helper, so an
elevated cell cannot cancel its lift in one backend.

## Consequences

The change is presentation-only: reducer state, hit events, seeded randomness,
collision, movement and ability balance are unchanged. Canvas 2D and Pixi use
the same direction token and atlas frames, with the existing procedural fallback
still available. The two generated contact cels add 28,440 bytes to the Riko
atlas; selective lossless repacking of four existing PNGs and semantic JSON
compaction keep the units family below its 4.5 MiB ceiling.

The current source covers vertical-dominant screen-up and screen-down attacks.
Diagonal and side attacks intentionally retain the existing pose until authored
directional art is available. The original generated outputs, reviewed
normalised cells, prompts, hashes and packing command are tracked under
`docs/art/sources/riko-directional-contact/` and the existing
`docs/art/prompts/sheets/unit.non.riko.md` sheet pack; the reproducible packer
is `scripts/art/riko-directional-contact.ts`. Capture evidence and the
remaining byte headroom are recorded in the Riko handoff.
