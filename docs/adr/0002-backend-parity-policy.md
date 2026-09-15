# ADR 0002: Backend parity policy

**Status:** accepted, 2026-09-15

## Context

Two backends drift. When this was written, elevation, blocked and cover
markers drew only on Canvas 2D, and ability effects were variant-aware on
Canvas 2D but a single gold ring on WebGL. Maintaining full parity doubles the
cost of every visual feature; ignoring parity lets a fight read differently
on a GPU than on a CI runner.

Pixi 8.16 added an experimental canvas renderer that could one day replace
the hand-written fallback. Its display-object coverage is not documented, and
the hand-written backend gets simpler, not harder, once art is atlas frames.

## Decision

1. **WebGL is the fidelity target.** New visual work is built for the Pixi backend first.
2. **Canvas 2D is the board-correct fallback**, kept for CI runners without a GPU and for software-rasteriser machines.
3. **Board-correctness parity is mandatory, fidelity parity is not.** Anything the rules care about — terrain, surfaces, elevation, blocked tiles, cover, units, props, overlays, health, statuses, floating numbers — must read the same on both backends. Animated water, firelight and particles are fidelity and Canvas 2D does not owe them.
4. The rule is encoded as `RenderBackend.capabilities` (`name`, `shaders`, `particles`) so callers ask rather than test a class.
5. Revisit Pixi's canvas renderer at the Phase C gate. If it renders sprites, text and graphics reliably, retire the hand-written backend under a new ADR.

## Consequences

- The WebGL tile markers were added in Phase A1 to close the existing gap.
- The generic gold-ring effect on WebGL is acceptable until ADR 0004's particle recipes replace it; ability effects are fidelity.
- Reviewers check any change to a rules-relevant drawing on both backends.
- The e2e renderer spec keeps forcing both paths via `?renderer=`.
