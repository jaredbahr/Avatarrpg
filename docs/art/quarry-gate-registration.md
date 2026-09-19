# Quarry gate registered art candidate

Status: original wholeplate REJECTED on integrated runtime `4e7788b`.
The replacement below repairs material registration; integrated gameplay and
overall visual acceptance remain pending.
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
Four wood-cover cells at (13,2),(5,3),(5,8),(14,9) have separate low timber decals
centered inside their ground footprints. They remain passable. The 12 oil cells have
neutral stone substrate, never baked oil or painted-surface suppression.
Brazier (10,5), barrels (14,3)/(14,8), flask (12,4), cart (6,6), exits (0,5)/(19,5),
parley crossing x8 and all party/enemy spawns remain gameplay-owned and unchanged.

## Sources and packing

### Deterministic repair

The original generated ground failed semantic registration despite matching
the plate aspect ratio. For example, cover (5,3) appeared near logical
(3.78,1.78). Roads and elevation were also displaced. The original source is
retained for provenance, but neither its geometry nor its painted props are used.

Built-in ImageGen produced `exec-bbd97582-db51-429f-879c-9f2345378cc5.png`
(2172 × 724, three equal material panels) and
`exec-99f58bdf-66be-4d8b-886c-ca9d8967e096.png` (transparent low timber).
The material prompt requested even, unobstructed, edge-to-edge quarry dust,
pale compacted road dust and warm-gray shallow limestone fields, with no map,
objects, cliffs, oil, shadows or gameplay geometry. The cover prompt requested
one ankle-high irregular heap of weathered timber, true alpha, isometric view,
no floor patch or extra props. Both use the project's original painterly-ground
and restrained ink/shading brief; no external downloaded art is used.

`quarry-ground-pack.ts` crops an eight-pixel inset from each material panel,
reflects authored texels without upscaling, and selects the material by inverting
the agreed projection at every world pixel center. All 36 `=` cells select road;
all 36 `^` and 12 `o` cells select stone; remaining cells and bleed select dirt.
No generated region boundary determines game geometry. There is no wholeplate
warp or procedural replacement painting. Two 864 × 960 WebPs cover the same
world extent as before. Their downsampling may soften a boundary by one texel.

One 224 × 96 transparent timber image is placed four times at 112 × 48 world
size, centered on the real `c` cells and clipped to the true 128 × 64 cell diamond.
The authored silhouette fits without removing any nontransparent pixels.
There are six ground entries and the original 32 wall entries. All wall files,
live oil, props, spawns, collision rules, actor depth and fade rules are unchanged.
This is map-truth repair, not a claim that the material style meets the approved
finished scene target. Sharp road/shelf boundaries and reflected material
repetition require review at the actual gameplay camera.

Repaired ground and cover total 168,142 bytes; retained walls total 66,614 bytes.
The map family is 3.08 MiB of its existing 4 MiB budget. `npm run verify`
passed 627 tests, and art validation and asset budget checks passed. The exact
packed-image overlay was visually inspected against all four semantic classes.

### Rejected wholeplate and retained wall provenance

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

## Modular local-ground proof

The gate now uses four transparent local material regions in partial-ground
mode instead of the two opaque projected pages: west/east earth, road, and
limestone. Their alpha masks follow the authoritative map rows, including the
oil-channel substrate and corner terraces. They are not partitions of a
flattened map painting. The procedural base remains beneath them, so live oil,
props, collision and old saves retain their rules-owned truth. Existing low
timber cover and all wall scenery remain independent.

Reproduce the shipped regions with:

```powershell
node --import tsx scripts/art/quarry-modular-ground.ts "C:/Users/Jared/.codex/generated_images/01a0b2ee-8d60-7643-be9b-340997ca4ae0/exec-8dcfcdb5-eeb3-485c-a1c7-5cfd6279580d.png"
```

That raw ImageGen source is deliberately local and ignored under `art/raw/`; it
is not a tracked runtime asset. The packer records its local registration JSON
under the same ignored folder and writes only the reviewed WebPs to
`public/art/maps/quarry-gate-scene/`. Current partial-ground elevation shading
is renderer-owned and remains a separate pending correction; this change does
not alter it.

Source/packed images have been inspected, but tests and technical registration
do not establish visual acceptance. Inspect coherent wall runs versus repeated
block appearance, exposed ends/corners, ground contact and occlusion while actors
move on both sides. Check live oil/brazier/barrel/cart interactions and low cover
readability on both backends at the actual 96px camera before extending maps.
Minor authored wall silhouette insets
must not create distracting seams between adjacent cells. The quarry reference
is a composition/material target, not authorization to invent new obstacles.
