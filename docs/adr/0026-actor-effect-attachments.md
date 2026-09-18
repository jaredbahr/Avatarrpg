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

## Common directed fundamentals

The next moving audit at ebcaa8e confirmed Water Whip leaving Nilak's feet and
Air Blast gathering at Nima's ground ring, travelling low and striking the
recipient's feet. Eight staged actual-Confirm captures covered Nilak, Bo, Nima
and Riko on both backends. These are bounded presentation fixtures, not a
continuous campaign or full-roster qualitative acceptance.

Extend the explicit attachment opt-in to Water Whip and Air Blast. Rename the
socket vocabulary to cast-gather/cast-release and calibrate the existing cast
cels for Nilak, Sura, Nima and Jinu independently. Keep the same immutable pose,
flight and recipient snapshots. Their gather disappears as the release pose
begins. Nilak/Jinu's missing-sheet paths use the robed painter rig; Sura/Nima use
lean. Fire Jab's calibration stays unchanged. Rock Throw's grounded gather and
terrain debris, melee, area effects and surfaces are unchanged pending their
own material/weapon decisions. Water's upstream pouch/source animation remains
an art gap; hand attachment alone does not establish sourced-water presentation.

The first attached Water Whip capture also exposed recovery starting while its
returning stroke was still connected to the launch point. Keep the release pose
through the returning whip; impact timing stays unchanged and recovery follows
return. This is presentation-only and extends the serialized action animation,
not AP, initiative, damage, cooldowns or saved state.

## Ground lift, bodily contact and carried water

Rock Throw retains its ground eruption, dust and cracks, but its boulder now
rises from the actor's foot anchor to the measured release palm before the
existing flight. Bo and Lin Mei use their own cast measurements. Flight ends
at the recipient torso; impact shards attach there while terrain debris stays
on the original ground. Strike attaches sparks/contact ring to the torso while
keeping dust on the floor; the existing melee release pose and impact clock stay.

Sura alone has an authored waterskin. A brief existing-particle draw connects its
cast/0 upper attachment (approximately53,100 in128x192 art) to her gather palm.
The procedural Sura also has a waterskin; fallback origin uses that exact hip,
across-axis and neck geometry. Nilak has no visible pouch, so he receives no
invented gear socket. This is presentation, not a water-consumption rule. Source
opening is indistinct and requires moving review; flexible water material and
Nilak's available source remain separate gaps.

Exact resolved Air Blast at4tiles: launch306.8ms, contact506.8ms, hit-stop ends
536.8ms (named recipe30ms, not family20ms). Previously damage/recovery scheduling
postponed its shove until908.8ms,402ms after contact. Actual pushed victims now
start their same220ms forced slide at536.8ms. Keep contact hold, suppress their
ordinary recoil-out/back so it cannot override the slide, and retain the maximum
of caster recovery/action cursor and slide end. No-push hits still recoil; other
forced movement is unchanged. The reducer's destination/collisions, AP and sound
contact scheduling remain authoritative. Reduced motion scales both clocks.
