# Actor effect attachments and silhouette bars

Status: implemented locally; moving visual review required.

## Problem

Directed Fire Jab used logical tile centres for its launch and contact. Upright
actors in the oblique scene stand above those points, so the technique appeared
to leave and hit their feet. Health bars used unscaled idle headroom even when
the character grew about its feet, placing the bar across its upper body.

## Decision

Keep gameplay coordinates, flight duration, targeting, damage and saved state
unchanged. Only Fire Jab opts into presentation attachment metadata. Choreography
records the source pose at gather and launch and the target's contact position.
Each record contains position, sprite, footprint, facing, draw scale and pose
offset. A projectile never re-reads a recovering caster or recoiling victim.
Resolved endpoints are weakly cached by their track-owned snapshot after first
presentation, so a late atlas load or zoom change cannot redirect a flight.
Fire Jab's gather cue ends when the sheet switches to its release pose instead
of leaving flame suspended at the former rear-hand position.

Use separate measured gather/release palm coordinates for the existing Kaya and
Tenzo cast cels. When those sheets are unavailable, use the existing painter rig's
actual rear/front hand and growth transform. Torso contact uses the actor frame;
both occupied boss cells select the same actor and contact point. New techniques
need an explicit socket decision; an effect's `over` layer is not an attachment.

Both backends resolve through one helper: project the actor's ground anchor,
add upright socket/scale/pose/elevation displacement, then inverse-project into
the existing FX pipeline. This avoids treating screen-up as logical grid-up in
the oblique scene. The existing particles, cels and layer ordering are retained.
Area, surface, terrain and other techniques retain their ground coordinates.
Reduced motion continues to omit emitters while preserving action outcomes.

Health bars use the entire scaled foot-to-silhouette distance and a gap above
the outline. Fetched and baked sheets measure a conservative opaque envelope
across their frames once, cached with the existing asset/bake lifetime. This
avoids pixel readback per draw and idle-frame jitter. An envelope can leave more
space above a short pose; review this visually rather than narrowing it until a
different pose intersects the bar. Fallback and boss width remain supported.

## Validation and limits

Geometry and choreography tests cover forward/inverse projection, mirroring,
pose scale, elevation, distinct palms, fallback, boss footprint, unchanged ground
effects and reduced motion. A paired Canvas/WebGL actual hit recording must
review gather, release, travel, contact, recovery and bar placement before this
candidate is described as visually accepted. No new art frames or engine change.

## Resize presentation follow-up

The moving review at c6b46f2 accepted the bounded attachment/bar placements but
recorded one blank WebGL battlefield as Confirm removed its preview. An actual
Confirm regression on that production build reproduced a 499→619 backing-height
change with zero opaque pixels and no draw after resize, before browser paint.
This establishes a runtime gap, not merely an uncertain video capture artifact.

Resize clears the backing store. Retain the last `MapView` and repaint it in the
same resize transaction after the scene has adjusted the camera. Do not schedule
another animation loop or advance animation time. Clear the retained view at
destruction. Both canvas-box observation and explicit scene/window resizing need
this ordering: the latter reproduced the same gap at 619→699 pixels even after
the observer-only correction. Initial construction may resize without a view.

The browser regression goes through actual aim/target/Confirm and inspects draw
order plus canvas pixels in a microtask after resize and before paint. It covers
Canvas/WebGL, ordinary/reduced motion and intentionally missing character sheets;
the normal-motion cases also exercise a real window-size change. This complements
moving review rather than relying on a settled screenshot to catch a transient.
