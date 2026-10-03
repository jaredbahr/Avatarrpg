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

- The creek (M3's `W` pools, `creek-west` and `creek-east`) **is** sampled. It
  is a watercourse, not an object: left out, the mirror beyond the south rim
  found no ground in the pools, reached on past them and carried row 8's cart
  track out past the creek as a strip of paving. The pools are packed open to
  the south rim (`scripts/art/forest-creek.ts`), so the apron continues the
  water off the board instead of mirroring a second, banked channel.

## The fade (A1)

The fade was a smoothstep ramp from the rim to 2.2 tiles. Against the page it
read as a pale haze smeared across the corners of the board. It now uses Ba
Dan's approved fade (`apronAlpha` in `ba-dan-exterior-apron.ts`): solid for
0.45 tiles, then ten flat alpha steps whose edges wander on a broad clustered
mask, so there is no continuous tone and no ruled contour. The bands are lossy,
so the clear pixels within `RIM_BLEED` (0.4 tiles) either side of the painted
band carry the ground's colour at alpha 0; left black, the encoder smeared them
into a light fringe along the rim, as it did on Ba Dan's. The test holds the
shipped rim's fringe under 2% and every painted alpha to one of the ten steps.

## The continuation is a mirror, not a translation

The first in-engine frame showed the band combed into long diagonal streaks.
The cause was geometry, not texture: continuing a point by its own `depth` in
along the normal lands every point of a band on the _same_ rim line, so the band
was one row of pixels stretched outward. Sampling the point's reflection instead
— `2 * depth` in — is a rigid mirror: it varies in two dimensions, joins
continuously at the rim and carries the authored texture. Inside the seam band
the offset is that band's width, which is a plain shift.

The same comb came back where an object blocks the mirror. The raised shelf
stands on the east rim's cells, so for every shallow depth there the mirror
point lands in the shelf's hole in the grass, and the walk took the first ground
past it — one far-edge line for all those depths, which is a translation again.
The visual audit caught it on the iPad frame of the fight. A blocked mirror now
reflects a second time across the hole's far edge, so the sample keeps moving
with depth. A corner is the exception: there the mirror falls off the board or
into the neighbouring rim's feather, not into an object, and the first ground is
still the nearest continuation. Only the other three sides decide that — every
shallow depth mirrors into its own rim's feather, which is where the shelf's hole
begins, so judging by that rim too left a comb a third of a tile wide right at
the rim. The hole's far edge is found once per point by bisection, not by
striding from each mirror, which would put every point on its own multiple of
the stride; and if the second reflection finds no ground, the edge colour stands
in rather than a gap. `forest-exterior-apron.test.ts` counts distinct colours
along the rows beside the shelf, including the band closest to the rim.

## The seam band

The grass packs feather to alpha 0 across their outermost ~0.2 tiles. Against
the page that was invisible; beside textured ground it read as a pale hem, so
the plate reaches 0.35 tiles _inside_ the rim and fills that band — but only
where the whole ground composite is thinner than `GUARD_ALPHA` (250). The
invariant is therefore "never overpaint authored ground" rather than "never
paint a playable pixel", and `forest-exterior-apron.test.ts` counts both: zero
overpainted pixels, and more than a thousand fill pixels closing the hem.

The fill's inner edge follows the guard's own alpha contour, which is
cell-quantised. In the Canvas and WebGL frames that reads as faint texture noise
rather than a line, so nothing further is queued for it; feathering the fill's
alpha into the guard's ramp is the refinement if a later frame shows it.

## The encounter camera

The apron was first reviewed under the exploration follow camera only. The
batched v0.2.8 branch adds the fight's own framing to
`e2e/forest-apron.review.ts`: `battle_forest_road` on both backends, captured at
the encounter camera and again at zoom 40 centred on the west exit and the north
rim. In those frames the road and its grass run out of the board under the
combat HUD exactly as they do in exploration, and the two renders agree — the
board edge the fight sits against is not a bare page.

## Regenerated for the generated ground (3 October 2026)

The apron derives from `grass-north`, `grass-south`, `route-ground` and the
creek plates, so the twelve `exterior-apron-N.webp` bands were rebuilt with
`npx tsx scripts/art/forest-exterior-apron.ts` once those plates were replaced
(`docs/art/forest-ground-composition.md`). Nothing in the packer changed, and
`apron-plates.test.ts` still holds the shipped bands byte-for-byte to the packed
ring. The textured verge made one proxy in `forest-exterior-apron.test.ts`
obsolete: it compared the carried-out meadow's distance to a board-wide mean,
which no longer describes ground that varies along the road. It now asserts that
the meadow leaves green and the road leaves as earth.

## The creek plates run out past the south rim (3 October 2026)

The pass-2 creek plates carry their own water, far bank (stones) and fade beyond
the south rim, and they are packed at 2x the world pixels they are drawn at. The
packer read them 1:1, so the continuation was sampled from the wrong pixels, and
it painted its opaque meadow over the plates' far bank and fade, which left the
creek a thin navy strip with a blocky green edge. `loadPlates` now averages
2x/3x-packed plates (creek, pond, rubble) down to their registered size, and
`packApron` takes the creek plates as `watercourse`: any exterior pixel they paint
is left clear. Six bands changed (3, 5, 7, 9, 10, 11); mechanical only.
