# Cutting and Driller floor scene boundary

Ground registration is complete, and the Cutting's ground follows its M5 rows
(below). This follows
the southwest depth comparison and stays within the opening-through-Driller
slice. Use the established oblique `MapScene` contract and the existing 96px
runtime camera; do not replace the renderer or alter rules.

## Exact source geometry

Both maps are 20×12 and currently use orthographic backdrops at 80 pixels/tile.
The replacement must opt into the existing oblique scene contract. Ground source
is authored as projected chunks using `x=768+(x-y)*64`, `y=(x+y)*32`, then packed
to the same 1152×1280 west/east chunk rectangles used by `FOREST_ROAD_SCENE`.
That projected source is not a 20:12 backdrop: upright cliffs/terraces are
separate depth-owned `MapScene.scenery` slices with exact footprints and depths.
Preserve every row and tile coordinate.

The Cutting (`ambush_road`) mask, since M5 (plan 1.5, Option A), is:

```text
XXXXXXXXXXXXXXXXXXXX
XXX^^^XXXXXXXX^^^XXX
XX^^,,r,XXXXX,^^^^XX
,,,,,,,,,XX,,r,^^^,X
====================
=====,~~~~====,,,,,=
=====,~~~~====,,,,,=
====================
,,,,,,r,,XX,,r,,,,,,
XX,,,,,,XXXXX,,,,^^X
XXX^^^XXXXXXXX^^^^XX
XXXXXXXXXXXXXXXXXXXX
```

Counts are X89 (blocked cut rock, tier 2), ^24, floor55, road60, rubble4,
water8: 151 walkable cells, down from 240. There is no walkable tier 2 and no
0-to-2 step. The pinch is x9-10, open only on the road rows 4-7. Keep party
spawns at (1,3),(3,4),(1,5),(3,6),(1,7),(3,8); no props are baked into the
painting.

How the M5 art draws it (all composed from existing pieces, no new imagery):

- **Rock (`X`)** is painted on the `stone` page by the Cutting's own raised
  painter (`scripts/art/cutting-rock.ts`), which stands the same `block` rock
  as the Quarry Gate and the Driller floor (`quarry-rock.ts`) but at the
  Cutting's heights. The **north cut** (rows 0-3) is sheer and tall: four
  courses (64 px) over the road and floor, three over a ledge. The **south
  run** keeps the shared heights: two courses over the bays, and a one-course
  sawn lip at the board's edge. So nothing upright stands between the camera
  and the southern bays. Every blocked cell is painted; `quarryProjected.test.ts`
  exempts only `#` from coverage.
- **Rock tops are rough.** They use the `block` tones over the spoil row's chipped
  structure, with small shadowed hollows and a few joint-tone fissures. They have
  no slab joints, so they do not read as paving.
- **Faces** are courses of long cut blocks. Each course catches the light on its upper
  arris: a rim line and a band of base on the left-facing wall, a narrower band
  on the right. That banding stacks the courses into height. It also keeps
  the stone page inside §3.
- **Drill scars** are sparse. The only ones are long, leaning gouges on the tall north faces, at
  most one in a 72 px stretch, drawn in about 40% of stretches.
  - Round 1's lit half-pipe every 8 px read as a picket fence, so it is gone.
- **Window span.** The stone page's darkest window measures 1.239 against the §3
  limit of 1.25. Taller faces first pushed it to 1.43. It came back inside the
  limit through the art, and the limit was not changed:
  - the course banding above;
  - rougher, slightly darker rock tops;
  - joint-tone rather than ink joints on the right-facing wall;
  - a one-pixel foot, where the footprint's own ink line already marks it.
- **Ledges (`^`)** are walkable, and they read apart from the rock:
  - They keep the `block` row's dressed paving, which gives them a worn slab top
    with its pale arrises.
  - They stand one course (16 px) on their own face over the floor in front, as
    the forest's shelf does.
- **The runoff pool** is packed by the forest pond's packer with PR 162's
  organic shore (`organic: true`), at its moved patch.
- **West bands** (0,3) and (0,8) stand against the gate's cribbed spoil bank
  (`quarryCribbing`, rows 2-3 and 8-9). The east band (19,8) is the front edge,
  so it is left to the surround's low rock.
- **Not dressed, for want of an existing asset:** the tea-station awning,
  prayer ribbons, and the wedged hand-cart with a broken wheel. The only cart is
  the live cabbage cart, which would read as the interactive prop. The tea
  station itself is the explore-mode discovery at (3,9), beside Sen at (5,9).

The Driller floor (`quarry_floor`) mask is:

```text
AAA^^..........^^AAA
AA^^....r..r....^^AA
^^.....oo..oo.....^^
.......oo..oo.......
..r.................
..........mm........
..........mm........
..r.................
.......oo..oo.......
^^.....oo..oo.....^^
AA^^....r..r....^^AA
AAA^^..........^^AAA
```

Counts are A20, ^24, dirt170, rubble6, oil16 and mud4. Paint a terraced quarry
pit with the open centre and four oil stone patches visibly distinct, while
leaving the centre mud patch and six rubble anchors available to the rules.
Keep the conditional cabbage cart at (9,6) as a live prop; do not paint it.

## Required files and ownership

Art owns two technical layout guides and two continuous transparent/ground
source paintings under `art/raw/maps/`, plus provenance and pack reports:

- `scripts/art/cutting-scene-guide.ts`, `scripts/art/driller-floor-guide.ts`
- `scripts/art/projected-scene-ground-pack.ts`
- `art/raw/cutting/ground-guide.svg`, `art/raw/cutting/scenery-guide.svg`
- `art/raw/driller/ground-guide.svg`, `art/raw/driller/scenery-guide.svg`
- registered `ground-west.webp` / `ground-east.webp` only after source review
- `src/content/scenes/cutting.ts`, `src/content/scenes/drillerFloor.ts` only
  after the source painting and ownership masks pass review

Gameplay owns only `MapDef.backdrop` projection opt-in/scene registration and
fallback tests. Existing rows, surfaces, cover/rubble, spawns, encounter props,
save data and pathfinding remain unchanged. If upright scenery is needed, use
registered `MapScene.scenery` slices with exact depth ownership; do not embed
actors, cart, oil, mud, water or rubble into the paintings.

## Budget and acceptance

The registered ground pages bring the map family to 3,846,608 bytes, leaving
347,696 bytes under 4 MiB. They use 230,894 bytes of the original 450,560-byte
combined reserve, leaving 219,666 bytes for transparent cliff slices and packing
variance while retaining at least 128,030 bytes of family headroom. Keep each
page ≤2048px per edge and retain the current 16-image scene cache envelope.
Validate served hashes, missing-page fallback, both renderers, 96px landscape,
portrait/high contrast and legal movement through every apparent route before
integrating.

The visual bar is the approved quarry reference: world fills the frame with
active industrial context, readable scale and connected paths. A fresh painting
that merely recolors the old orthographic arena is a failed source review. The
registered ground pages and measured source contract are recorded in
`docs/art/cutting-driller-ground-registration.md`. First review the two guides,
the ground batch and the later upright source locally; stop before gameplay
wiring or a second generation if the central open floor, live-surface anchors or
actor scale do not read at actual play zoom.
