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
