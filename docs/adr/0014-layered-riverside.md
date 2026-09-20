# ADR 0014: Illustrated heroes and foreground depth

The first riverside looked like pieces placed over a painting. This pass changes
the scene construction and the art together. The environment keeps its layout
but uses stronger ink contours and large cel-shadow shapes. Two hero atlases
combine existing idle/cast poses with four new walk poses and two greeting poses.
The shared sheet vocabulary gains an optional `wave` clip (two frames, falling
back to idle); combat, save formats and game rules stay the same.

The village stage loads sheets through the existing SheetStore and receives the
sprite keys and backdrop from its view model. Missing art retains the procedural
figure fallback. All poses share a foot anchor and contact shadow. Generated
frames are normalized at one scale per character, never stretched separately.

Scenery silhouettes are authored in tile coordinates against the painting.
The same pixels are redrawn at each object's ground-contact depth among actors,
using the camera's actual offset and scale. Canopy and trunk are separate
polygons, leaving air beneath branches. This avoids mismatched duplicate art
and works over both map backends. A small ground marker and the name remain
visible when the party is concealed. The `Under the banyan` action uses the
normal walk reducer and gives the player a direct way to judge the effect.

Foreground masks are intentionally authored for this one painting. Replacing
or moving a landmark requires re-registering its silhouette. This is layered
2D staging, not a general height, bridge-underpass or collision system. NPCs
and Pebble still use procedural drawings; additional character directions and
full animation cleanup remain art work. The two heroes retain mirrored facing.

Validation covers reachable activities, foreground registration, drawn-sheet
readiness on both browser backends, and the canopy route before the existing
save-isolation walkthrough. Gallery beat 20c records the occluded state.
