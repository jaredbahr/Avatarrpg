# ADR 0101: Authored village ambience sources

**Status:** Proposed; draft implementation awaiting checks and visual review  
**Date:** 2026-10-30 (America/Chicago)

## Context

Issue #368 asks for more village life using the existing exploration ambience
system. The current assignment permits integration of existing assets only.
The painted plates, uprights and frozen geometry must stay unchanged, and the
Canvas and Pixi backend owners have separate work in progress.

## Decision

Extend `AmbienceRecipe` with optional `flow`, `waterLeaf`, `steam` and `lantern`
definitions, and `MapScene` with optional `ambienceSources`: up to two vessel
mouths and four lantern-glass centres, in fractional ground tiles. The existing
`ambientEmitters` receives these sources and the world clock phase in one optional
argument. Scenes without sources retain their existing output. Combat does not
pass that argument and retains its current ambience policy.

Ba Dan supplies a lidded market vessel and the glass of its three existing
lantern posts, measured on the tracked upright pages. The source coordinates
are derived from each upright's registered rectangle. No new asset, texture,
generation request, runtime light wash, collision field or save field is added.

The four additions are:

- Sparse glints that move slowly along the canal, using the existing hardened
  stroke raster. Their complete geometry and journey fit inside one permanent
  water tile, including beside the bridge.
- At most two four-pixel leaves moving through an inner corridor of permanent
  water cells. A leaf's whole footprint stays clear of banks and the bridge.
- Two six-pixel puffs rising from the existing market vessel.
- Two-pixel warm marks inside lantern glass in `evening` and `night`, changing
  brightness in four held steps, with normal blending and no glow halo.

The new particle definitions use the existing one-particle projectile sampler
as a stationary stamp (`from === to`). `ambientEmitters` computes movement
locally, snaps the centre in projected world pixels and inverts the oblique
projection back to ground coordinates. Fixed sizes use existing pixel-ladder
rungs; `upright` keeps them aligned to the screen under the oblique transform.
This leaves the generic sampler and both backend files untouched. The new flow
uses the existing one-world-pixel hardened stroke path. Existing ambience is
unchanged; this does not claim to solve pixel placement across all old effects.

Under Reduce motion the new flow and floating leaves are omitted. Steam and
lanterns hold a fixed sample, alongside the original fixed chimney wisps.
Everything depends on the render clock, authored coordinates and deterministic
presentation hashes; no core RNG, event log or world state changes.

## Consequences and remaining gates

This is a partial issue #368 draft: four discrete effects across canal, smoke
and fire, not four of the issue's suggested categories. Birds, cloth, animals,
additional chimney calibration and full issue acceptance remain open.

The existing Canvas limits stay at 96 particles and 60 strokes. A focused test
sweeps the complete village population including the new effects. No budget is
raised. Parent review must run the focused tests, renderer E2E and `ci:local`,
then inspect zoom-1 motion and reduced-motion evidence on both backends.
Nearest sampling and integer centres are implementation properties, not a claim
that visual integration or Canvas 60fps has already been accepted.

## Third painted chimney, 2026-11-01

The current upright atlas has three open chimney mouths. The southeast merchant
house's lower wing was missing from the original two-dwelling smoke list. Add
its measured mouth at upright pixel `(279, 92)`, atlas page 0 `(1341, 94)`,
through the existing registered-painting conversion. Its scene world-pixel
position is `(1238, 730)`, ground tiles `(13.078125, 9.734375)`.

Keep the original two coordinates and their order: both still land inside their
painted mouths, and their emitter indices determine their presentation seeds.
The new source reuses the existing chimney recipe, two loop instances and
fixed-sample reduced-motion path on both backends. It adds no texture, new
sampling contract, painted geometry, world state or save field. Gao's roofed
ridge vent is not an open chimney.

The original dwelling-mouth pixel checks remain, alongside a separate regression
against the third mouth's registered dark, opaque atlas pixel. Existing complete
population sweeps must still pass the unchanged 96-particle cap. Dedicated
native evidence must show all three mouths at zoom 1 live and under reduced
motion; source registration alone does not establish motion, performance or
owner aesthetic acceptance.
