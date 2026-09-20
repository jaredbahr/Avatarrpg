# ADR 0037: Scene walls follow the loaded battle grid

**Status:** accepted, 2026-09-19, for the Driller interior registration.

## Problem

Saved battles retain their own baked `Grid`. A later content build may add
projected scenery to the same map, so drawing the current map scene
unconditionally can put a new wall sprite on an older save's walkable tile.
That makes the picture disagree with movement, line of sight and saved props.

## Decision

`SceneScenery.wall` marks structure art whose footprint is an
authored wall rather than decoration. The shared `sceneForGrid` renderer helper
keeps such a piece only when every in-map footprint cell in the loaded grid has
`terrain === 'wall'` and `blocked === true`. Exterior pieces remain visible
because their footprints intentionally sit outside the grid. Other scenery is
unchanged.

Canvas 2D and Pixi filter the same `MapScene` before ground completeness,
cutaway opacity and upright draw ordering. The reducer, save schema version,
loaded grid, props and movement rules remain untouched. A solid dynamic prop on
an old tile cannot make a missing authored wall appear because the terrain check
requires the saved wall tile itself.

## Consequences and limits

Current Driller wall cells render from current saves and new battles. Older
saves keep their old walkable presentation while retaining their original
terrain and props. Multi-cell structure pieces require all cells to agree. This
contract only controls scene presentation; it does not migrate old maps or
invent collision. Focused tests cover open tiles, wall tiles, prop-blocked tiles,
multi-cell footprints, exterior scenery and the shared helper used by both
backends.
