# ADR 0072: Scene image cap raised from 32 to 40

## Status

Accepted.

## Context

`SCENE_IMAGE_CAP` bounds how many distinct images a partial scene may ask for,
because the scene paints its authored ground only while every piece is resident
(`src/render/scene.ts`). The Forest Road asked for 31. Its roadside dressing
(`docs/art/forest-roadside-props.md`) adds eight sprites, each a separate URL,
for 39.

## Decision

The cap is 40. The eight sprites are alpha-trimmed to between 58x58 and 144x146
pixels, so together they decode to well under 1 MB, against the ~23 MB the widest
scene already held when the cap was set. The residency test in `scene.test.ts`
keeps holding every partial scene under it.

Merging the sprites into one atlas would hold the count down but needs a
sub-rectangle field on `SceneImage` and in both backends, a larger change than the
art warrants.

## Consequences

A scene can now ask for up to 40 distinct images before it falls back to the
grid. The Forest Road has one image of headroom; a further piece of dressing needs
an atlas or another raise.
