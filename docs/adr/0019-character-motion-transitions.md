# ADR 0019: Preserve character intent through animation transitions

Walking and forced movement used the same presentation track. Knockback therefore
added a walking bounce to the struck pose and changed the character's resting
direction to the direction of the push. Attack facing applied only while its pose
was active, so recovery could abruptly return to the previous walking direction.

Move tracks now mark forced displacement with an optional `gait: 'slide'`.
Position still samples the same curve and timing, while walking clips, foot lift,
and direction updates apply only to voluntary movement. The existing hit pose
and ground shadow carry the push.

The animator queues heading cues for walk completion and explicitly faced poses.
Cues are consumed in playback order, including after skipped frames or reduced
motion. A future action cannot turn an idle character early; a completed strike
keeps its facing until the next voluntary movement or faced action. Clearing the
animator clears these cues and the remembered headings.

This is presentation state only. Save formats, simulation, movement speed,
damage and character assets stay unchanged.
Regression tests cover backward knockback, reduced motion, a northward walk into
a westward cast, and a subsequent southward walk. The browser suite observes the
actual units passed to both combat renderers and the gallery shows the transition.

## Element releases

Each elemental motion style now sets a launch fraction within the extension pose
and a small foot-anchored compression/extension. Earth gathers deeper, air stays
light, water eases through the gesture, and fire extends sharply. Projectile and
sound share the launch instant, and hit/flash timing still follows the real flight.
Melee and self-casts keep their existing launch timing. Reduced motion continues
to suppress emitters and shake while retaining sound and result information.

The stroke vocabulary gains `flame` and `gust`. Fire uses nested pointed
silhouettes; air uses separated translucent streaks instead of glowing rings.
They traverse a flight once, including its optional lob, then disappear. Water's
existing whip becomes a tapered filled ribbon and still reaches its target at
half its out-and-back duration. Both backends consume the same sampled polygons.
Particles remain within the existing budgets, and character sheets are untouched.

Gallery sequences show each element's existing character through gathering,
launch, flight and recovery. Geometry tests cover cardinal directions, zero-length
aims, finite coordinates, bounded reach, lobbed flights and effect expiration.
