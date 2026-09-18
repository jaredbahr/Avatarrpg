# 0025 — Optional exploration rest poses

Status: accepted contract; Nima is the visual pilot.

Exploration should allow relaxed standing without changing combat readiness.
Add optional single-frame `rest`, `restNorth`, and `restSouth` clips. Existing
required clips, atlas frame dimensions, foot anchors, and asset budgets remain.
Exploration may select rest clips when stationary; combat continues to select
idle. The integration renderer owns that selection and directional mapping.

Fallbacks preserve existing assets: rest → idle; restNorth → idleNorth → rest →
idle; restSouth → idleSouth → rest → idle. Procedural figures use their existing
idle pose. Missing optional artwork never makes an actor disappear.

The Nima pilot appends three drawings into unused cells of his existing atlas.
The packer checks that all twenty existing frames are pixel-identical and uses
one shared scale based on the existing idle height. No new atlas request or
budget increase is needed. Review the transition from walking to rest in the
actual courtyard before extending this treatment to the remaining heroes.
