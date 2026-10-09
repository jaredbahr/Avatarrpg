# Ba Dan modular courtyard layers

## Exterior surround modules (6 October 2026)

`village-surround.webp` is one 1824×1280 lossy WebP atlas (exact binary alpha) containing four
assembled runs: north and west fieldstone walls plus their deeper foliage and
roof backdrops. The scene reuses those runs beyond the north and west edges.
All placements are decorative `exterior` scenery; their footprints remain
outside the 24×16 rules map and the east road, south river mouth, and west ford
are deliberately unoccupied.

The canonical master is the assembled atlas itself,
`art/source/ba-dan-surround/village-surround-master.png` (lossless); its
provenance and the known generation direction are recorded in the README beside
it. It was assembled by a one-off script that is not reproducible, and the exact
prompts are unavailable. `scripts/art/ba-dan-surround.ts` validates the master
and encodes the shipped lossy WebP (quality 90, exact alpha plane). Upright
scenery pieces use the same encoding. Regenerate or check it with:

```sh
node --import tsx scripts/art/ba-dan-surround.ts
node --import tsx scripts/art/ba-dan-surround.ts --check
```

Built-in OpenAI image generation and deterministic material packing, 18–19
September 2026. Exact source prompts and generated filenames remain in
`ba-dan-scene-prompts.json`. Existing merchant houses, dwelling, village trees,
planters, and displays keep their transparent scene layers and warm upper-left
palette. They ship under `public/art/maps/ba-dan-scene/` and count against the
existing map family budget.

The active exploration proof is a partial authored scene. `BA_DAN_SCENE` sets
`groundMode: 'partial'`; Canvas and WebGL paint the procedural grid terrain,
then projected local ground pieces, then the live grid surfaces and overlays.
The former complete `ground-west.webp` and `ground-east.webp` pages were
historical assets with no active Ba Dan exploration consumer and were removed
from the shipped map family on 19 September 2026. Their committed history and
the deterministic packers remain available; the full-map backdrop is retained
for presentations that still use it, while partial exploration suppresses it so
modular scenery and the grid remain visible.

The local courtyard piece is `courtyard-ground.webp`, 1152×576 projected pixels
at `(640,256)`. It covers the logical `x5..15,y3..11` envelope with a half-cell
alpha feather and samples the reviewed four-quadrant material atlas for grass,
stone, and road. The image is already camera-projected; the renderer does not
skew it again. Its irregular projected boundary blends into procedural terrain
instead of ending at a rectangular opaque seam.

The western first-view approach is `western-approach-ground.webp`, 704×352
projected pixels at `(384,192)`. It covers only logical `x0..6,y6..9`: the
spawn road on rows 7–8 and its immediate grass shoulders. Its transparent
irregular mask leaves the permanent canal water at `(6,6)` to the runtime
surface. It retains grass/stone beneath blocked trees and the map edge so their
transparent scenery cannot reveal a procedural corner. The `x5..6` overlap is
sampled with the exact same logical-coordinate material function as the
courtyard and sits below that region's existing feather, avoiding a second
screen-space join.

The remaining connected village courts are six local transparent pieces packed
by `scripts/art/ba-dan-neighborhood-ground.ts`: northwest lawn (`x0..6,y3..6`),
north house court (`x4..17,y1..4`), east gate approach (`x14..23,y6..9`),
south house court (`x5..17,y10..14`), and the two outer lawns that closed the
last flat fields — northeast (`x15..23,y1..7`) and southwest
(`x0..6,y9..14`). Their half-open bounds overlap reviewed western/courtyard
pixels but deliberately leave rows 0 and 15 and the exterior tree rim
procedural. Every piece overlaps at least one neighbour by two or more cells, so
two exterior feathers never leave an uncovered band between them: the outer
lawns overlap the house courts west and north of them and the east gate approach
south of them. Water is transparent in every local piece. The packer uses only
decoded opaque quiet-grass (`x10..11,y4`) and broad flagstone (`x5..9,y7..8`)
source interiors from the tracked accepted courtyard asset; it copies exact
decoded RGB through existing overlaps and gives every new piece its own exterior
feather.

The accepted upper field of `edge-water.webp` is the single painted source for
the connected row-6 canal. It is registered across `(0..12,6)`, with permanent
water at `(0..8,6)` and `(10..12,6)` and the dry bridge crossing at `(9,6)`.
`canal-banks.webp` is retired and unregistered; the water packer does not rewrite
it. `ba-dan-canal-banks.ts` remains only as the geometric metric/audit helper used
to verify the registered edge-water source. The coping adds no collision wall.

The bridge is a transparent scenery layer registered to `(9,6)` with a single
logical footprint. `true-canal-bridge.webp` is the deck/back layer and
`true-canal-bridge-front.webp` is a near-bank mask cut from the bridge by
`scripts/art/ba-dan-true-pieces.ts` (`trueBridgeFront`). Both use the same drawn rectangle
(the 414x236 guide at 2/3, anchored on the crossing); depths `6.25` and `6.75`
let actors render between the deck and near rail. Rows 5, 7, and 8 remain open
for north/south approaches. The front mask is an occlusion aid, not a second
collision object.

The deterministic material and coping generators are:

```sh
npx tsx scripts/art/ba-dan-restyle.ts
npx tsx scripts/art/ba-dan-true-pieces.ts
npx tsx scripts/art/ba-dan-courtyard-ground.ts
npx tsx scripts/art/ba-dan-western-approach-ground.ts
npx tsx scripts/art/ba-dan-neighborhood-ground.ts
npx tsx scripts/art/ba-dan-garden.ts
npx tsx scripts/art/ba-dan-exterior-apron.ts
npx tsx scripts/art/ba-dan-north-fringe-ground.ts
npx tsx scripts/art/ba-dan-water.ts
```

`ba-dan-canal-banks.ts` is deliberately not in this command list. The canal was
extended to the west map edge after that audit helper was written, beyond its
courtyard-only source origin; it therefore cannot repack the current canal.
`canal-banks.webp` is retired and is not produced by the current art pipeline.

## Outer garden and grounding (28 September 2026)

The previous outer garden mixed three unrelated treatments around the same
courtyard: the authored lawns' quiet olive clusters, Canvas's flat procedural
grass, and WebGL's brighter noise. Their seams were visible through the lawns'
feathered edges, while the exterior apron extended the saturated procedural
green with a smooth alpha fade. The result read as a rectangular game board
around an otherwise painted village.

`scripts/art/ba-dan-garden.ts` now builds one deterministic, one-world-pixel
garden field beneath the whole playable diamond. Three smoothly selected source
phases prevent a visible repeat across a 12x8-tile lawn without enlarging source
pixels. The quiet olive range remains the courtyard's; authored courts and lawns
remain above the base, so their feathered edges blend into the same material.
Trodden earth uses a narrow irregular coverage ramp, with grass thinning over
soil rather than a binary stepped boundary. The two lossless `garden-*.webp`
plates are first in `BA_DAN_SCENE.ground`.
`scripts/art/ba-dan-exterior-apron.ts` continues the same world-aligned pixel
sampling outside the diamond and dissolves it into the page in ten flat alpha
steps whose edges wander up to 0.18 tiles on a broad clustered mask (five
straight steps read as diagonal stripes); material transitions are world-anchored clusters, never an ordered
screen. The garden paints every texel that touches the board and the apron
every texel that does not, so they meet along the rim with no gap (an earlier
split left a dotted line of page there) and the apron never covers a playable
pixel; no apron pixel lies past its fade either. The apron bands are lossy, so
the clear texels within `RIM_BLEED` of the band carry the ground beneath them:
left black, the encoder smeared them into a light line along the whole rim.

The two road exits, west and east on rows 7–8, continue the courts' own
flagstone rather than the art bible's paving triple, which is near white and
read as a glitch past the east rim. `flagstoneTexel` tiles the courtyard's
broad-flagstone interior on the logical grid exactly as the east gate
approach does, so the slabs run on across the rim: under the courts' 0.4-tile
feather in the garden base (`EXIT_INSET`), then out across the apron, where
grass takes back `EXIT_WEAR` of it in clusters by the fade. The lane's sides
wander a sixth of a tile on the same clustered mask, so it keeps no ruled
edge.

Upright scene pieces are seated at runtime by `src/render/grounding.ts`, keyed
to their declared logical footprints rather than to Ba Dan asset names. One
shared contact raster combines a stepped down-right shadow with tight ambient
occlusion. The garden pack wears the ground at each piece's _painted_ foot,
not its footprint: `CONTACT_FEET` takes every sprite column's lowest opaque
pixel that projects within a third of a tile of the footprint, so a tree keeps
its trunk and roots (its canopy projects far from the cell) and a house its
plinth line. `contactWear` lays damp soil and deep-grass litter out from those
feet over a reach set by broad ground-plane noise: a lopsided spill under a
tree that leans into its south-east shade, a broken skirt along a plinth with
bare stretches. An earlier pass wore a band around every logical footprint and
drew square and diamond outlines round the trees and buildings; the garden
test now fails on wear that covers a footprint's boundary band all round.
The apron carries a rim tree's wear past the rim. Canvas and
WebGL consume the same cached contact data with nearest sampling and retain the
same scenery/figure depth order. Runtime damageable props keep their existing
art-measured shadow in `SpriteCache`, so buildings, stalls, planters, trees,
static props, and live props all have a contact treatment.

The deterministic checks are `ba-dan-garden.test.ts`,
`ba-dan-exterior-apron.test.ts`, `apron-plates.test.ts`, and
`grounding.test.ts`. Local before/after walking frames and Canvas/WebGL lineups
are written under ignored `review-evidence/badan/`; they are comparison
evidence, not a declaration of visual acceptance.

## Village pieces: guide and paint (current)

The village's houses, market tables, planters and canal bridge are _true_ pieces: each is
built from code geometry first, then painted over, so every ground line lies on the map's
tile lines by construction and the light baked into the ground is computed from the same
geometry the painter saw. Ten pieces ship (`TRUE_PIECES` in `ba-dan-true-pieces.ts`): the
dwelling and merchant house at 4x3 and 4x4, three tables, the 2x1 planter and its turned 1x2,
and the bridge with its near-bank layer. The four native trees (and the lodge and alder
Forest Road borrows) are the older fine masters in `art/source/ba-dan-restyle/fine/`, packed
by `ba-dan-restyle.ts`; `variety-prompts.md` there is their record. Everything for the true
pieces is under `art/source/ba-dan-true/`, whose `README.md` gives the exact order and the
painter's verbatim prompts; the geometry and python tools are `scripts/art/ba-dan-guides/`.

**Guide.** `pieces.py` models each piece in 3D (ground (x, y) to screen `X = 64(x - y)`,
`Y = 32(x + y) - z`, at 1.5 image pixels per world pixel). A house is a plinth with a low
rear terrace, a plaster wall with a door, steps and windows, and a gabled tile roof; the long
eave wall and its door face +x. `build.py` renders the flat-shaded guide, a silhouette mask, the
footprint quad and `pieces.json` (canvas, anchor, foot polygon, door and steps). Every axis edge
is +-0.5 to float error and every vertical has dX 0.

**Paint.** The guides went to the painter on three sheets (`build.py --sheets DIR`), edited once
per sheet with the guide as the immutable target, cut at each piece's rectangle and forced
through its mask (`painted/`). The four houses had a second pass: the low terrace behind the
house (the plane `planes/<house>.png` marks) was repainted into a private yard, with every pixel
outside it and every alpha byte from the first painting (`yards/`).

**Edge.** `edge.py` re-derives the silhouette's coverage from the guide geometry (8x supersampled)
and writes `<name>.png`: an antialiased alpha edge (the game filters art bilinearly, where a binary
edge dashes), a dark-brown outline two source pixels wide, and the outline colour bled four
pixels under the transparent fringe so no filter or encoder pulls in another colour. The
silhouette is geometry only.

**Pack.** `ba-dan-true-pieces.ts` shades each house's horizontal faces (plinth top, porch,
steps) with the shared light's shadow on that plane, so the roof's shadow carries across the
porch as the ground's does; plants stone feet in turf with a ragged grass fringe, only where every
placement stands on open lawn; and encodes q90 with `exact` so the fringe colour survives, stepping
up only to hold the fine-grain contract. The bridge's near layer is cut on the tile line
`y - x / 2 = TRUE_BRIDGE_CUT`. `--check` re-packs and compares bytes. Then the ground plates
are regenerated in order (`scripts/art/ba-dan-guides/regen.sh`), since they carry the light.

**Placement.** Each canvas is drawn at 2/3 of its pixel size (world scale) and placed by its
anchor, the canvas pixel of the footprint's front corner, on that corner's ground point
(`BA_DAN_TRUE_PIECES`, `place()` in `baDan.ts`). Gameplay footprints are unchanged. The pieces
set `contactShadow: false`: the runtime's footprint ring is a whole-tile box, a grey mat under a
table's open legs, and the baked contact below replaces it.

**Light bake.** `ba-dan-village-light.ts` builds the volumes from the live scenery at the guide's
own heights (house: terrace slab, plinth, wall, roof with eave overhang and ridge; table: top,
trays, shelf, legs; planter: rim and bed; bridge: abutments, deck, beams, posts; trees cast their
silhouettes). One world-space light shades every plate (see "Light and shadow").

**Contact rules.** Every foot (terrace, plinth, rim, leg, abutment) carries a dark seat line 2.6
ground pixels wide, a 12 pixel falloff and a faint 14 pixel tail all round, at full weight for a
plinth and less for a thin leg (0.78, reach 0.55), a low terrace (0.75) and the bridge (reach
0.85); two pieces' edges together are no darker than 0.36. A table's top and the bridge's deck take
sky light from the ground beneath. Each house door lands on a small worn flagstone landing as deep
as two slabs, centred on its three steps, with a trodden trail to the nearest path
(`LANDINGS`, `DOOR_TRAILS` in `ba-dan-village-material.ts`).

**Guards.** `ba-dan-true-pipeline.test.ts` holds: every shipped true file equals a re-pack of the
tracked sources (and the folder holds no other `true-` file); each source is on its guide's
canvas with the guide's silhouette, an antialiased edge, outline brown on the rim and under the
fringe, and the shipped alpha is exact; the bridge cut; the scenery count within the schema's
limit; every scenery piece has a light volume or caster at its drawn position; no two scenery foot
polygons overlap; a baked contact line all round every foot (396 sample points); a landing at
each door; every file in the output folder is referenced by a scene; and the forest, quarry,
driller and cutting plates are byte-identical to the parent. `ba-dan-projection.test.ts` holds each
piece's ground lines within one degree of the tile line, source and shipped.

## Edges (A5, 29 September 2026)

Jared asked for no invisible walls and a village that does not read as a
rectangle; the plan's section 1.1 and its approved J5 (the west ford) set the
structure. Nothing here is new imagery: every piece is an existing
texture placed again, or ground packed from the garden's flagstone.

- **Woodland rim.** 36 perimeter `T` cells had no sprite. Each now stands a
  `village-tree` (`BA_DAN_RIM_TRUNKS`), alternately mirrored, taller on the
  back edges (north, west) and sapling-sized on the front edges (east and the
  south-east), where a full canopy would wall off the board's near quarter. The
  original canopies are `BA_DAN_RIM_CANOPIES`, less the one at (18,15), which
  stood in the river path's mouth. The garden and apron are
  re-packed so every new trunk is worn at its painted foot.
- **North band.** The open lawn x4..17 on row 0 ends at a tea terrace one cell
  outside the rim: seven courtyard `low-planter` pieces end to end
  (`BA_DAN_NORTH_TERRACE`, `exterior`). It is the back edge, so everyone on
  the board stands in front of it.
- **West ford and connected canal.** `edge-water.webp` carries the west pond
  plus the continuous courtyard channel reused by `canalBanks()`. The pond is
  cut by `sourceRect` and painted after the apron. Both reuse the courtyard
  canal's construction — its diamond
  metric and kerb radius, `bedShade`, `BED_COOL`, `kerbShade` — over the
  garden's `flagstoneTexel`, in flat steps at the garden's two-pixel grain. The
  bed's depth is the distance to the shore, not to each cell's centre, so the
  joins between cells leave no ridges. The connected canal occupies the map's
  permanent-water cells; the ford is blocked `W`. The pond runs past the rim
  into the apron fade, flooding (0,7) and (0,8) over five drowned stepping
  stones. A route-sign marker on its south bank, (1,9), says why the road stops
  there.

The village declares both lawn edges as `band` and sets
`edgeContract: 'enforce'`. Every other walkable rim cell is an exit mouth: the
east road's two cells, and the river path's three. The river path's are the
rim cells themselves, (18..20,15), walkable dirt with no tree on them; like the
east road's, the garden base paints them flagstone and the apron carries it on
south off the board. The riverside arrives at (19,14), one step inside.

The water packer takes no arguments. It combines the tracked painted
`art/source/ba-dan-water/edge-water.png` with the current channel/ford footprint
and rewrites only the shipped `edge-water.webp` page. The canal-banks tests hold
the registered upper field to the diamond metric, depth gradient, and kerb
contract without producing a second runtime plate.

The western pack derives from the tracked accepted local material source
`public/art/maps/ba-dan-scene/courtyard-ground.webp` (1152×576 WebP).
It decodes that already material-composed region, copies its actual pixels in
the x5–6 overlap, and repeats only verified interior quiet-grass (`x10..11,y4`)
and broad-flagstone (`x5..9,y7..8`) swatches for the western cells. Courtyard
feather alpha is never carried into the western interior: the local region uses
its own exterior alpha feather. This is local material reuse, not a full-map
crop or recolouring. The older ignored raw atlas is not the source of this pack
and is not described as tracked.

The original scenery layers continue to use `scripts/art/scene-image.ts` for
alpha-trimmed WebP packing. The complete map encoder remains useful for old
art and other scenes; it is not used to fake coverage for this partial proof.
The shader's partial base pass suppresses its terrain-surface effects until the
overlay pass, so water, firelight, hatching, and grid marks are emitted once.
The WebGL filters are destroyed without taking ownership of Pixi's shared
program cache.

Browser evidence is recorded in
`docs/coordination/handoffs/ba-dan-neighborhood.md` with exact Canvas/WebGL
crossing and save/reload paths. It is technical local evidence only; it does
not claim physical-device, listening, or final visual-quality acceptance.

No new destination or map family was added. The source contract keeps the
existing roads, NPCs, exits, save positions, and walkable water behaviour.

## Light and shadow (7 October 2026)

The village ground is lit once, in the plates, by one world-space function
(`scripts/art/ba-dan-village-light.ts`). The runtime's projected shadows stay
off for this map (`castShadow: false`, the faint wedges read as dirt); baked
light replaces them.

**Where the shadows come from.** Volumes are read from the live scene, not
copied: each house is a wall box on its footprint plus a hipped roof with an
eave overhang (the ridge runs along y, the slopes close in, the ends step in),
each stall a table slab on two legs with goods on it, each planter a rim and a
bed, the bridge a deck with two rails, the north and west surround runs a
dry-stone wall. Heights are the guides' own, in world pixels (plinth 26, eave line 140,
ridge 186, table top 36, planter rim 26), and checked in place with
`ba-dan-ground-composite.ts`. Trees cast their own
painted silhouette, sheared the way unit shadows are.

**The key.** A point `h` screen pixels above the ground lands `0.42h` right
and `0.27h` down (`CAST_PER_PIXEL` in `src/render/lighting.ts`). A ground pixel
is shadowed when walking back along that shear meets a volume at its height, so
nothing casts toward the upper left and a roof's shadow has a roof's shape.

**Penumbra.** Each height slice is softened by `0.8 + 0.04h` ground pixels
(stalls, planters and the bridge by 0.6 of that): crisp where the caster meets
the ground, soft at the far tip. At 0.1 per pixel a roof's far edge was 16
pixels soft and washed the roof's outline out of its shadow. Tree shade is the
canopy silhouette blurred by the same rule, with light holes at leaf-cluster
scale (more of them the farther the leaves hang from the trunk, none at its
foot) and a lighter cast than a wall's.

**Colour.** Shadow multiplies the lit ground by about (0.59, 0.60, 0.67), the
reference's ~0.65 once the warm sun lift (1.045, 1.02, 0.965, drifting ±6.5%
over 7 tiles and 2.6 tiles) is counted; shade reads cooler and darker, open
ground warmer. Water and its banks take the same light.

**Not stacking with the runtime's contact shadow.** `src/render/grounding.ts`
still lays ink under every piece with a footprint (up to 0.55 alpha at the
foot, gone by 0.4 tile). `contactAlpha` reproduces it; inside its reach the
bake solves for the colour that lands on the intended shade and never goes
brighter than the open lit ground, so cast shade and contact ink do not make a
black rim. `ba-dan-ground-composite.ts` lays the same ink over the plates when
it draws scenery.

**One finish for every plate.** `villageBake(wx, wy, rgb)` in the material
module is `litRgb(pavingLip(rgb))`; every generator calls it per world pixel,
so overlapping plates agree up to the lossy encoder's noise. The paving
authority (`assets/source/ba-dan-ground-v1/courtyard-paving.webp`) is the only
source of paving colour: the shipped courtyard plate carries light now, and
copying it would light the road twice.

**Ground defects closed in the same pass.** The canal's alpha edge is
antialiased (a two-pixel tent, a soft dark lip, grass over the coping where lawn
is the neighbour). The margin runs to a wandering bank (`apronBank`, 1.72 to
2.12 tiles out) that is a massed hedge: dark leaf clusters with lit tips and a
darker rim at its silhouette, with the road exits as gaps in it. The lawn gets
fine-grain life from the material (`lawnLife`): longer darker grass along walls
and under trees, sparse flowers and clover in loose drifts, faint desire lines
read from the map, and more earth at thresholds.

**The south and east frame.** The north and west edges end at a wall and tree backdrops; the
south and east are the near edges, and used to end at the hedge with the margin colour beyond it (the
tour's views 7, 9 and 10 were 21%, 22% and 40% flat fill). `ba-dan-exterior-apron.ts` now carries the
ground on past the apron on those two sides (`farGround`: the points whose nearest board side is south
or east): the lawn runs on in deepening shade into a woodland floor of leaf litter and ferns, scrub
and the massed hedge, and ends in an irregular tree line 4.2 to 6.2 tiles out (`FRAME_BANK_MIN` to
`FRAME_BANK_MAX`; the swell runs with `x - y`, which has no seam at the corner, and the two ends round
off against the north and west). The two road exits go on as roads through a gap in the planting:
flagstone with grass creeping in (whole to about 3 tiles out, three texels in five at 4.2), packed
earth after, and
the track shades into the margin colour at its far end (`frameColour`). The apron's own bands carry
this ground to `APRON_FADE` and `packFrame` carries it from `FRAME_START` (1.9) on in the same
function and the same light, so the two overlap on identical pixels. The frame ships as six
rectangles of one page, `exterior-frame.webp` (`planFrameBands`, `BA_DAN_FRAME_BANDS`; one distinct
image, not six). Eight tree clumps stand along it (`FRAME_TREES`, composited at pack time from the same
native masters as the rim's): each clears every ground diamond and standing figure of every walkable
tile and both exit corridors at its drawn position, so none can hide a person, a stand point, a door
trail or an exit; `ba-dan-true-pipeline.test.ts` holds that. Their shade comes from the same casters
as every tree's.

**Marks the ground and the canopy must not carry.** A tree clump's contact wear comes from each
member's own roots, not from the lowest pixel of each column of the composite: the hanging leaves of a
sapling moved off its cell projected back onto the cell, and wore a bare disc into the lawn beside
the east rim (`CONTACT_FEET`). The well's south side had a stand spot with no one standing there;
the west spot stays because the household adult stands on it (`bd04.yard`). And a canopy's small
enclosed gaps are filled at pack time (`closeGaps`): behind the north-west trees the wall's cream
showed through one as a short white streak.

**The runtime draws joins over the plates (round 2).** Ba Dan is a `partial`
scene, so the renderer bakes the rules grid's ground joins and lays them over the
finished plates (`decorMode` 'seams' in `src/render/backends/pixi.ts`, baked by
`paintTileSeams` in `src/render/decorSheets.ts`, quiet mode): on every open tile
beside another material, a ragged wedge of the neighbour's colour is washed along
the shared edge at 23% (16% for water). That, not the plates, was the ruler-straight
pale green line along the paving side of every lawn boundary, and the bluish
translucent band along the canal's kerb. `runtimeSeams` in the light module
reproduces the wedge from the same `tileNoise`; the composite lays it over the
plates (`--no-seams` turns it off), and the bake pre-compensates for it
(`COMPENSATE_RUNTIME_SEAMS`): the colour that lands on the lit target once the wash
is over it. Where the target is brighter than anything the wash can show (bright
paving under a green wash), the whole target eases down together, so the residue
is a faint soft shade and not a tinted line. If the renderer stops drawing seams
over this scene, set the constant to false and regenerate. The smallest render fix
is to skip `paintTileSeams` in the 'seams' bake for a scene whose plates carry
their own joins (`decorSheets.ts`, the `seamsOnly` branch, and
`canvas2d.ts` where it calls `paintTileSeams`).

**The lawn/paving boundary** wanders: grass tufts push out over the stone in
clumps up to a dozen pixels, chips of stone push out over the lawn, and the lip's
weight and width change along the edge (`pavingLip`).

**The canal's kerb** is laid stone where the master painted a translucent band
(south bank, both end caps) or a pale blue-grey one (north bank east of the
bridge): one or two courses of dressed blocks with joints, wet at the waterline,
opaque to the edge (`copingRgb` in `ba-dan-water.ts`).

**Needs the running game.** Tree shadows, the contact-shadow sum, the seam
compensation and the bank's last pixels are modelled from `grounding.ts` and
`paintTileSeams`, not seen in-engine. The margin colour behind the hedge is
`MAP_MARGIN_COLORS.verdant` (`#465b40`, `src/render/palettes.ts`, selected by
`marginTone: 'verdant'` in the scene); a deeper `#2b3d2d` would read as shade
behind the planting rather than as a lit page.

## Wall, well and dressing placement (8 October 2026)

**The wall** is composed from the painted modules at the guides' own 1.5 px per world px and drawn at
2/3 like the houses (`true-walls.webp`, ADR 0073). The straight modules come in three paintings
(`wall-x-2`, `-b`, `-c`; the same for y) laid in a fixed order that never repeats a painting twice in a
row, with a buttress every third or fourth module; the paintings and their joins are listed in
`art/source/ba-dan-true/walls/walls.json`. Where two straight modules meet, the painted end outline is
taken from stone a few pixels further into the module and the join is stone to stone; piers, gate
piers and the inside corner are cross-faded into the run along its axis. The outline stays only round
the run's silhouette. The painters' black (a shadow drawn inside the foot and the rear lip) is filled
from the stone beside it before the run's own two-pixel outline is applied.

**Where dressing may stand.** A piece of scenery draws in front of another when its depth (the footprint's
front cell, `x + w - 0.5` and `y + d - 0.5`) is larger, and a house's depth is its front corner. So a
prop on a house's lawn side with a smaller sum draws _behind_ the house even when it stands in front
of its wall: the well cannot stand at (7,4) or (8,4), the shop stack at (10,1) was overlapped by Gao's
plinth, and the south planters at (6,9) and (14,9) were hidden by the southern roofs. The well was
moved from (8,5), hard against the bridge's post and on Gao's work tile, to (12,13) in the south
court: every lawn tile near the square is in front of a door's steps ((10,4), (11,4)), behind a house
roof ((13,4), (7,4)), on a door trail ((13..16,4)), in front of a stall ((14..16,6)), a gate-watch post
((16,6), (17,6)) or the south court's only entrance ((12,10)). The shop stack stands at (10,2) and the
banner pole at (11,2): clear of the plinth and of the north house's eave.
