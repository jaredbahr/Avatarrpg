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

Timed clips play from their authored holds. A timed cast's first three frames
are its gather; frame 3 is contact and the remaining frames strike and recover.
The action beat lasts through the complete clip. Timed hits play once before
returning to idle, and timed knockouts play once and hold their last frame.

## Consequences

- Existing untimed sheets validate and animate identically.
- Full mirrored action animation is data-driven without declaring eight-way
  locomotion.
- Art validation rejects an overlong timed clip or a timing array that does not
  cover every frame.
