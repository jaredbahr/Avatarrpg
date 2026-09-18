# Quarry gate registered art candidate

Status: local source candidate; actual 96px gameplay review remains pending.
Gate first, cutting and floor later. No legacy backdrop, map row, prop, hazard,
spawn, route or save data changes are included here. Gameplay owns projection
opt-in, live surfaces and props, picking and actor-aware wall occlusion.

## Agreed geometry

20 × 12 logical map; basis (64,32)/(-64,32), origin (768,0). Ground world extent
2304 × 1280 includes 128 side, 192 top and 64 bottom bleed. Two ground chunks
occupy (-128,-192,1152,1280) and (1024,-192,1152,1280).

Exactly 32 wall cells use upright scenery, exhausting the existing 32-instance
ceiling without changing it. Each module is a 128 × 176 world rectangle with
128 × 64 diamond base and 112 vertical rise. Base center is (64,144), so the
rectangle origin for cell (x,y) is (768+(x-y)*64-64, (x+y+1)*32-144). Depth is
(x+0.5,y+0.5); footprint is exactly that single cell and actor-aware fading is
on. End, corner and bonded-interior material variants use cardinal wall adjacency.
No multi-cell depth sprite, source-rectangle atlas contract or overhang is added.

The 36 elevation cells remain walkable, represented by shallow ground stone.
Four wood-cover cells at (13,2),(5,3),(5,8),(14,9) have low timber offcuts painted
inside their ground footprints. They remain passable. The 12 oil cells have
neutral stone substrate, never baked oil or painted-surface suppression.
Brazier (10,5), barrels (14,3)/(14,8), flask (12,4), cart (6,6), exits (0,5)/(19,5),
parley crossing x8 and all party/enemy spawns remain gameplay-owned and unchanged.

## Sources and packing

ImageGen sources in
`C:/Users/Jared/.codex/generated_images/01a0b2ee-8d60-7643-be9b-340997ca4ae0/`:

| Source                                        | Purpose                                                                                   |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| exec-036019db-44bd-4665-83d7-7ccdfbd965e2.png | One registered warm limestone/dust ground plate; native 1683 × 935                        |
| exec-0ce1d3bf-23a1-48da-a6f2-faae532ea028.png | Three bonded stone wall material variants on matching technical prisms; native 1852 × 849 |

`quarry-guide.ts` derives the ground guide from authoritative rows and writes
an exact three-prism wall guide. These are technical diagrams, not shipped art.
The generation prompts required quiet hand-painted stone, open floor space,
no painted interactive props/hazards, matching upper-left light and compatible
wall courses; the wall variants vary material/visible-face treatment only.

`quarry-pack.ts` downsizes the ground to 1674 × 930, split into two 837 × 930
WebPs. Wall panels are normalized to three 256 × 352 whole-image sprites and
clipped to the agreed prism silhouette. Packing removes 1,917 nonzero pixels
outside the prism and keys 594 saturated red/yellow generator-fringe pixels
confined to the outer eight world pixels. No painted colors are synthesized.
Original sources are retained. All textures use quality 88; wall alpha is retained.

Ground assets total 176,206 bytes (below 240 KiB); walls total 66,614 bytes
(below 100 KiB). The map family totals approximately 3.09 MiB of 4 MiB, leaving
about 0.91 MiB for the later maps and contingency. No other assets were degraded.

## Review required

Source/packed images have been inspected, but tests and technical registration
do not establish visual acceptance. Inspect coherent wall runs versus repeated
block appearance, exposed ends/corners, ground contact and occlusion while actors
move on both sides. Check live oil/brazier/barrel/cart interactions and low cover
readability on both backends at the actual 96px camera before extending maps.
The source has darker neutral floor under the wall locations; verify these do
not appear as visible skirts when walls fade. Minor authored silhouette insets
must not create distracting seams between adjacent cells. The quarry reference
is a composition/material target, not authorization to invent new obstacles.
