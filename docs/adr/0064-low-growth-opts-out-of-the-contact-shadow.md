# ADR 0064: Low growth opts out of the footprint contact shadow

**Status:** accepted by the supervisor, 2026-09-29 (a presentation detail inside the approved grounding direction)

## Context

`src/render/grounding.ts` (PR 157) seats every upright scenery piece with one
shared contact raster, keyed to the piece's declared footprint: a stepped
shadow cast a little down-right over the **whole** footprint cell, plus a
tight ring of occlusion. Under a tree or a house the art covers most of that
cell, so the shadow reads as shade. Under the Forest Road's reed fringes and
the flood-bank nest, which are passable clumps a fraction of their cell's
size, it read as a dark diamond: a placed tile, the "floating/placed object"
complaint and the footprint-ring problem Ba Dan's scenery was already rejected
for.

## Decision

`SceneScenery` gains an optional `contactShadow: false`. `contactRaster` skips
any piece that sets it, so neither backend draws a runtime contact patch for
it. Both backends read the same cached raster, so nothing in either backend
changes. The schema admits only the literal `false`: the default stays on,
and nothing that already ships changes.

A piece that opts out has to be seated some other way, and the scene's own
ground pack does it: the Forest Road wears the ground at the reeds' _painted_
feet, as Ba Dan's garden pack wears it at `CONTACT_FEET`
(`scripts/art/forest-reed-wear.ts`, painted into `route-ground.webp` and the
grass regions). `forest-reed-wear.test.ts` holds the set of opted-out pieces
equal to the set the wear seats, and fails on wear that covers the cell's
boundary band all round.

## Consequences

- Only the forest's five reed fringes and its nest opt out. Trees, houses,
  timber and the lodge keep the runtime shadow.
- The flag is presentation only. It changes no rule, footprint, collision or
  depth order.
- A piece that opts out and is placed on a scene with no ground pack wear
  stands with no contact treatment at all. That is why the default stays on.
