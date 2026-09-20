# ADR 0038: Exclude unused video texture registration

## Decision

Keep the existing 300 KiB compressed JavaScript budget. Extend the existing Vite
Pixi registration filter to omit only `VideoSource` from Pixi's rendering entry
point. This game loads still-image atlases, painted scenes, canvases and buffer
textures; it does not create HTML video textures. Image, canvas and buffer sources,
all masks, graphics, text, filters and particle registrations remain intact.

The transform checks both expected registration statements and fails the build
if a dependency update changes them. It does not modify installed dependencies,
remove player features or alter Canvas fallback. A future video-texture feature
must revisit this decision and explicitly restore its source registration.

## Evidence and verification

The combined quarry/Riverside baseline at `e7ac483` built to307,232 compressed
JavaScript bytes,32 bytes above the307,200-byte budget. An isolated output build
with this registration omitted measured304,893 bytes:2,339 bytes saved, with the
same game assets and feature set. Raising Terser passes had negligible benefit
and was discarded.

The baseline full browser suite stopped after97 passes on an unrelated quarry
approach-coordinate expectation;
this experiment used a separate ignored output directory. Actual renderer,
animation, fallback and texture-loading checks are required before this change
is accepted into a pushed release. No physical-device performance claim is made.
