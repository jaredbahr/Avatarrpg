# ADR 0069: Timed bare clips may carry full animation

## Status

Accepted.

## Context

Legacy mirrored sheets use bare `idle`, `cast`, `hit`, and `ko` clips whose
small frame-count bounds describe key poses. The Driller instead has complete
cel animation for those actions. Discarding cels would lower animation quality,
while widening the existing bounds would silently weaken every legacy asset.

## Decision

A bare `idle`, `cast`, `hit`, or `ko` clip that declares one `frameMs` value per
frame is a timed bare clip and may contain up to twelve frames while retaining
its existing minimum. Untimed clips retain their existing exact bounds. Frame
names, timing-array length, and the directional eight-way family rules remain
unchanged.

Timed clips play from their authored holds. A timed cast gathers up to its
contact frame, which is the clip's `events.hit` when it declares one and frame 3
otherwise; up to three frames strike from there and the rest recover. The action
beat lasts through the complete clip, and its cel clock runs on through the
wind-up, release, hold and recover motions without replaying a cel. An ability
with no travel lands on the contact frame; one that throws something lands when
it arrives. A sheet with no `melee` clip plays its timed cast the same way for a
melee ability. Timed hits play once before returning to idle, and timed
knockouts play once and hold their last frame, drawn the way the unit was facing
when it fell.

A timed clip's holds may total at most 3000 ms for a cast or a hit, 4000 ms for
a knockout and 6000 ms for an idle, so no authored clip can stall a turn.

## Consequences

- Existing untimed sheets validate and animate identically.
- Full mirrored action animation is data-driven without declaring eight-way
  locomotion.
- Art validation rejects an overlong timed clip or a timing array that does not
  cover every frame.
