# Forest road exterior apron

`public/art/maps/forest-scene/exterior-apron.webp` is the ground outside the
Forest Road board. Packed by `scripts/art/forest-exterior-apron.ts`, registered
last in `FOREST_ROAD_SCENE.ground`, checked by
`scripts/art/forest-exterior-apron.test.ts`.

## Why it exists

`FOREST_ROAD_SCENE` is a `partial` scene: the procedural board is off and the
authored plates own every playable pixel. Outside them the page showed through,
so the route ended on a hard diamond — the same defect the Ba Dan apron
(`ba-dan-exterior-apron.md`) fixed inside the village.

## What it does differently from the village apron

The village's own cells are procedural, so its apron paints
`TERRAIN_STYLES`' terrace colours outward. The forest's ground is authored
texture from a reviewed material sheet; a flat fill beside it would add exactly
the tone step the route is already criticised for. So the forest apron invents
no colour. For each point outside the rim it walks back into the board along the
outward normal and continues the pixels it finds there, compositing
`grass-north`, `grass-south` and `route-ground` in their own draw order.

Two consequences are deliberate:

- The road leaves the board instead of ending on it. The route is a stretch of a
  longer road, and rows 4 and 8 continue outward as road until the fade takes
  them.
- The pond, the raised shelf and the rubble are **not** sampled. They are objects
  standing on the ground, so their authored edges meet the apron's ground rather
  than being smeared outward. Where a ledge or the pond blocks the walk, it keeps
  going (up to 3.4 tiles) to the terrain those objects stand on.

The band is 2.5 logical tiles wide, opaque at the rim, faded out by 2.2 tiles,
with grain and recession ramping in from 0.35 tiles so the board's own edge is
not redrawn as a line.

## The continuation is a mirror, not a translation

The first in-engine frame showed the band combed into long diagonal streaks.
The cause was geometry, not texture: continuing a point by its own `depth` in
along the normal lands every point of a band on the *same* rim line, so the band
was one row of pixels stretched outward. Sampling the point's reflection instead
— `2 * depth` in — is a rigid mirror: it varies in two dimensions, joins
continuously at the rim and carries the authored texture. Inside the seam band
the offset is that band's width, which is a plain shift.

## The seam band

The grass packs feather to alpha 0 across their outermost ~0.2 tiles. Against
the page that was invisible; beside textured ground it read as a pale hem, so
the plate reaches 0.35 tiles *inside* the rim and fills that band — but only
where the whole ground composite is thinner than `GUARD_ALPHA` (250). The
invariant is therefore "never overpaint authored ground" rather than "never
paint a playable pixel", and `forest-exterior-apron.test.ts` counts both: zero
overpainted pixels, and more than a thousand fill pixels closing the hem.

The fill's inner edge follows the guard's own alpha contour, which is
cell-quantised. In the Canvas and WebGL frames that reads as faint texture noise
rather than a line, so nothing further is queued for it; feathering the fill's
alpha into the guard's ramp is the refinement if a later frame shows it.
