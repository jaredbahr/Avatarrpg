# ADR 0024: Courtyard environmental audio on the existing bus

Status: accepted implementation contract; sound acceptance pending.

## Context

Ba Dan has visual ambient particles but no environmental sound. Choreographed
one-shot cues already share one gesture-unlocked AudioBus. A second context or
frame-triggered ambient cue scheduler would duplicate mute policy and risk
piling up sounds during long walks or background-tab suspension.

## Decision

The existing bus owns a CourtyardEnvironment with two original deterministic
procedural loops. ExploreScene supplies `courtyardEnvironment(map.id, grid,
animatedLeaderPosition)` through `audio.updateEnvironment(mix)` each visible
frame, and calls `audio.clearEnvironment()` when hidden or unmounted. Only
`ba_dan_village` activates it. Actual water terrain/surfaces determine pond
proximity; audio never affects world state or saves.

Frames update gain targets only when they change. Playback, sparse details and
smoothing use the Web Audio clock, so frame rate cannot queue or multiply cues.
No catch-up scheduling runs after suspension. Inactive scenes retire sources
with a 0.6-second release and disconnect on source end. Sound Off relinquishes
context ownership immediately, fades the old master over 32 ms, and closes it
at 40 ms. Cold sample callbacks still cannot revive a retired context. On opens
a fresh context via the existing gesture path and creates fresh faded-in layers.
Volume changes smooth both persistent layers over a 0.22-second time constant.

## Consequences

No new downloaded audio assets or licensing dependencies. Two mono 16 kHz
buffers use approximately 4.86 MB decoded memory while active. Existing audio
and precache budgets are unchanged. The environment has no music, voice,
combat ambience or new-region content. Loops repeat and the sparse bird detail
is synthetic; audible acceptance remains a separate gate. Source/provenance,
levels and synchronized capture steps live in [courtyard audio](../art/courtyard-audio.md).

Tests cover Off/On ownership, context unlock, source bounds over repeated frames,
retirement, volume/pond targets, actual map water, deterministic samples and seam
bounds. Real integrated capture and physical-device listening are still required.
