# ADR 0004: Animation runtime

**Status:** accepted, 2026-09-15 (lands in Phase A3)

## Context

`src/app/animator.ts` turns reducer events into timed tracks sampled per
frame. Its contract — `push`, `busy`, `finishesAt`, `prune`, `clear` and the
per-frame samplers — is what the e2e `waitForIdle` helper and the AI turn
pacing depend on. Motion today is linear position lerps and sine pulses; there
is no easing, no sprite frame state, no camera choreography and no particles.

## Decision

Evolve the animator; do not replace it.

- New `src/app/anim/`: `easing.ts`, `timeline.ts` (typed tracks with easing), `choreography.ts` (event → tracks: approach, wind-up, cast, projectile, impact, recoil, floater, KO), and camera tracks (focus, shake) that the scene applies to `Camera` each frame.
- `RenderUnit` gains `clip`, `clipTime`, `offset`, `scale`, `flash`. `MapView` gains `emitters` (definition, position, progress, seed). The renderer stays a pure function of the view and time.
- Particle recipes are content (`src/content/fx.ts`), keyed `fx.<element>.<name>` and validated by zod. A new ability or element needs no `src/core/` change.
- Particle randomness is seeded per instance from the event index. The game RNG is never touched; determinism is unaffected.
- Reduce-motion keeps the existing `rate` collapse; particles reduce to a single flash.
- Canvas 2D draws the clip frames and the flash; particles are WebGL-only (ADR 0002).
- No tween library. The runtime is roughly 600 lines, the JavaScript budget is tight, and test timing must stay deterministic.

## Consequences

- `busy()` and `finishesAt` keep their meaning, so the e2e suite and the AI pacing do not change.
- Every event kind the animator handles today must play through the new runtime before A3 closes.
- Frame budget: 60 fps on an A12-class iPad with the boss map and a 5×5 blast on screen, measured with `?stats=1`.
