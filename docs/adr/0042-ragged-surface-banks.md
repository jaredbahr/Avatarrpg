# ADR 0042: A pool meets the ground on a ragged bank

**Status:** accepted, 2026-09-20

## Context

The 20 September route review read the Driller's floor as unfinished, and one
concrete instance was the two stone stacks apparently "sitting on plain dark
rectangles rather than a grounded shadow". A probe of the running build shows
those rectangles are not shadows: they are the authored **mud** tiles, drawn
exactly two tiles by two because a surface's wash is filled to the square the
rules use, with a ruled bank and a bright rim along that boundary. The same
applies to every authored oil, mud and rubble patch in the game — the quarry
gate's oil channel, the cutting's puddles, the rubble on the boss floor.

Water was already softened this way ([ADR 0041](0041-ground-joins.md) for the
shore, and the 0.2.3 water treatment for the wash). Pooled materials kept the
rectangle.

## Decision

A pooled material fades at its bank instead of stopping on the tile edge:

- `surfaceRendering.ts` owns one ragged outline per tile, `surfaceOutline`,
  built from a perimeter walk whose depth at an open edge is seeded by
  `tileNoise`. A side shared with the same material stays on the tile's own
  edge, so a pool four tiles wide is still one shape. `surfaceRim` returns the
  same walk per open edge for the bank band, the gathering material and the
  rim stroke.
- The Canvas 2D painter lays a thin base coat over the whole cell and a firmer
  coat inside that outline, so the boundary is a fade. The base coat is what
  keeps the promise the old code made: the visible material still covers every
  hazard tile, and no outline point is ever drawn outside it.
- `backends/shaders.ts` computes the same two coats from world noise, so a pool
  does not change character between the backends. The shader's earlier
  `edgeDistance` — a hard distance to the boundary — is now perturbed by noise
  and consumed by the bank, the rim and the gathered material alike.
- Heavy materials (mud, oil and rubble) gather a little deeper along the same
  outline. Ice, fire and steam keep the plain bank they had, because their
  shape reads as an effect rather than as ground.

## Consequences

A pool keeps its exact rules footprint and stops reading as a filled
rectangle: the corner is a fade, the rim wanders, and the material gathers
unevenly along it. This is a presentation change only — no rule, save, preview
or content change, and the colourblind hatch and High-contrast paths are
untouched.

Costs: a perimeter walk of seven points a side per surfaced tile with an open
edge, replacing four `fillRect` bands; about 0.4 KB of JavaScript. The wobble is
small on purpose — it decorates the boundary, it does not move it, so a player
still reads the hazard from the tile it really occupies.
