# ADR 0077: Scene actor grounding

## Status

Accepted. Extends ADR 0071.

## Context

Ba Dan is one painting whose own casts darken the ground ~32% on average (~40% at
the core) with a tight contact line at every base. The runtime figure shadow
(ADR 0071) was tuned on the old flat ground: a projected cast at 0.4 alpha that
reads ~36% at best and a soft radial contact pool 0.885 of a tile down, a few
pixels below the soles. Beside the painted posts and tables the figures read as
floating.

## Decision

`MapScene.actorGrounding` (`{ cast?, contact? }`, defaults `CAST_SHADOW_ALPHA`
and `0`) sets, per scene, the alpha of a figure's projected cast and of a
**contact band**. A scene that sets nothing is unchanged: the union is tinted at
`shadowCeiling` = the strongest of the cast alpha and the scene's alphas, on
WebGL every caster writes its alpha as a fraction of that ceiling (Canvas does the
same arithmetic exactly, see Consequences), so the default keeps coverage 1 at 0.4.

The contact band is the `CONTACT_BAND.height` tiles of the figure's art ending on its
foot line, laid flat about the foot (wider, a little lower) into the same max-unioned
mask. It follows the pose and both feet and is drawn from the art, not a disc. A scene
with a contact layer anchors both layers on the tile's ground (a bob lifts the figure
off its shadow instead of dragging the cast along), and the WebGL mask renders at full
device resolution because a leg is a few pixels wide.

What a figure's feet get is one decision, `groundTreatment` in `lighting.ts`, read by
both backends: in a contact scene every figure that casts gets a band and loses its
radial pool; a figure that casts nothing (`castShadow: false`) keeps whatever pool it
had; a default scene is untouched. The band's art is the figure's sheet frame when it
has one, and otherwise the sprite the backend actually draws (`spriteBandArt`: the
whole sprite, standing on `FOOT_LINE`). That covers the painter residents (`npc.guard`,
`npc.household`, `npc.hanru`), the single-image residents (Mira, Gao, Pella, Dorin) and
a unit whose sheet failed to load and is drawn from its painter; none of them has a
frame, and a painter resident's baked frame is only a stand-in for its cast, so the
band is never cut from it. The single-image residents lose their pool in a contact
scene and gain the band in its place.

Ba Dan sets `{ cast: 0.5, contact: 0.8 }`: measured darkening on the same
ground is ~45% for the cast core and ~72% at the sole band, against ~40% for
the painted cast and the painted contact line. Both backends read the same
numbers from `lighting.ts`.

## Consequences

The Canvas 2D backend combines the casters of a contact scene by exact maximum, as
ADR 0071 requires and as the WebGL `max` blend does. The layer holds a grey level per
pixel on opaque black; each caster is drawn alone into a scratch, turned to white at
its own alpha, scaled by its level with `multiply` (exact for an opaque grey), and
`lighten`ed into the layer, which is a per-channel maximum. The result is applied to
the board as `scene * (1 - g)` (`multiply`) plus `ink * g` (`lighter`). Casters write
their absolute strength (`cast`, `contact`, the structure and scenery `0.4`), not a
fraction of the ceiling, so two 0.5 casts leave their overlap at 0.5 and a 0.5 over a
0.8 leaves 0.8, whichever order they were drawn in. This costs a few small blits per
caster, bounded to its box, and only in scenes that set `actorGrounding`; a default
scene keeps the single source-over mask and its one tint, byte-for-byte as before,
since every caster there is at the ceiling. The Canvas mask is at CSS-pixel resolution
(the WebGL one is at device resolution in a contact scene), so on a high-density
display the band is a little softer on Canvas.
