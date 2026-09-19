# ADR 0039: Modular illustrated world on the gameplay grid

**Status:** accepted direction, 2026-09-19; implementation proof pending.

## Context

The current game mixes complete map paintings, independently composed scenery,
and a square grid. Jared explicitly selected composed scenery as the official
visual model, retaining the grid as the technical foundation. A complete map
painting makes interactive geometry, depth ordering and changes to the world
depend on reconciling gameplay with flattened pixels.

## Decision

Build playable spaces from authored ground regions and independent scenery:
walls, buildings, roofs, trees, cliffs, props, foreground masks and lighting.
Retain the existing oblique projection, Pixi/Canvas backends, animated 2D sheets,
and procedural effects. This is not an engine or full-3D migration.

The real grid remains authoritative for collision, elevation, cover, paths and
interaction. Derive visual registration and occlusion from shared coordinates
and authored footprints. Do not create a second collision map in painted art.
Normal presentation should conceal square construction seams while preserving
optional tactical grid readability. Existing saves retain their gameplay truth.

Use complete paintings for distant or immutable vistas, title/interlude art and
temporary prototypes. Local painted ground patches and scenery sprites remain
valid assets. Runtime batching or caching of modular ground is permitted; a
flattened full-map source image must not become the authority for the playable
space. Preserve useful existing assets during migration.

## First proof and acceptance

Implement a small Ba Dan courtyard/canal area inside the actual game. It must
render without depending on complete ground-west/ground-east map paintings.
Use authored ground shapes/material patches and modular scenery, with a real
animated character crossing readable paths and passing behind/in front of
foreground scenery. Include an existing interaction and runtime water or another
dynamic effect. Review perspective, scale, palette, grounding, seams and depth
ordering in actual Canvas and WebGL play, including touch-sized presentation.

Verify that every apparent opening agrees with movement and picking, scenery
occludes correctly without losing the actor, and save/reload preserves position
and state. Keep the existing asset/bundle budgets and fallback behavior. Required
repository checks and exact-head CI remain unchanged.

## Consequences

The first contract extension is an optional `MapScene.groundMode: 'partial'`.
Absent means the existing complete-ground behavior. Partial mode draws the
procedural terrain base, then authored projected ground pieces, then dynamic
surfaces, paths and effects. It must not globally suppress permanent water
outside an explicitly represented area. This extension is approved for the
proof but remains unimplemented at this decision checkpoint; source and visual
parity tests must establish the eventual implementation.

The proof comes before expanding this construction across the existing bounded
village-to-quarry route. It does not replace the full route, encounter, outcome,
return, motion/audio, save, device, merge or deployment requirements. Existing
full-map rendering is a migration baseline, not evidence of visual completion.
Do not delete old assets or break other scenes merely to make the proof appear
complete. Renderer contract changes need focused parity and picking coverage.
