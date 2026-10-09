# Painted wall modules (second pass)

These are the masters `ba-dan-guides/walls.py` composes: the 15 repainted pieces of `.review/painted-wall`
with the same canvases and alpha as the first pass (`NOTES-dressing.md`), plus the variants
`wall-x-2-b`, `wall-x-2-c`, `wall-y-2-b` and `wall-y-2-c` (the `-b` and `-c` paintings share the guide
and mask of `wall-x-2` / `wall-y-2`). `wall-x-1` was painted but is not placed, so it is not tracked.

## Integration

- The straight modules are laid in a fixed order, no painting twice in a row, a buttress every third
  or fourth module (`PLAIN_X`, `PLAIN_Y`, `BUTTRESS_X` in `walls.py`).
- The painters' pure black (a shadow drawn inside the foot, the rear lip and the module ends, up to a
  dozen px deep, and a red-black on the `-b` and buttress modules) is filled from the stone beside it, and
  the lone saturated yellow flower pixels keep at least 80 blue so the encoder's chroma subsampling
  stays inside the fine-grain contract (`CHROMA_FLOOR`).
- Joins: the painted outline along every module cut is taken from stone further into the module, on both
  sides; piers, gate piers and the corner are cross-faded along the axis. A thin vertical hairline
  remains where two stones end at a straight join, the way a vertical mortar joint reads.

## Painter's notes (first words are the painter's own)

## Method

- Painted each of the 15 requested sprites with the built-in image tool, using the matching guide as the geometry reference, the current painted wall as the material reference, and `painted-v3/low-planter.png` as the foliage-grain reference.
- Fit each painted source to the guide silhouette, then replaced its alpha channel byte-for-byte with the matching mask. No tracked game asset was changed.
- Used `wall-x-2-c` and `wall-y-2-c` as the deterministic master strips. On every straight piece, copied the first and last 16 canvas-x pixels from the corresponding master (relocating the far strip for one-tile modules), then linearly blended the following 8 pixels inward. Plants were kept out of those zones.
- Made 50% guide overlays in `overlays/`, a four-run 3x nearest-neighbour join inspection in `join-check.png`, and `sheet.png` with every candidate at 1x plus the old in-game crop and candidate mock runs.

## End profile

The shared profile is a pale cream chipped cap, two uninterrupted warm fieldstone course bands through the middle, and a grey-buff lower course with low olive moss/damp staining. The 16-pixel terminal zones contain no vine, flower, fern, missing chink, or focal repair. The x master comes from `wall-x-2-c`; the y master comes from `wall-y-2-c`. The next 8 pixels inward are a linear blend into each module's unique painting.

## Verification

- Canvas sizes match the JSON/guide sizes for all 15 files.
- Alpha comparison against every matching mask: **0 differing pixels for every piece**.
- The 50% overlays show **0 px silhouette drift by alpha**. The guide top, cap edges, foot line, and fittings remain mask-locked.
- `join-check.png` contains two orders per axis at 3x: x = `a-b-c`, `c-a-b`; y = `a-c-b`, `b-a-c`.
- No game, test suite, repo generator, network operation, push, or deployment was run, per the worker constraint.

## What is still wrong

- These are candidates, not in-game acceptance. The image tool produced oversized sources which were downsampled into the authored guides; at 1x the result is crisp enough to inspect, but a few small stones and flowers are denser than the planter reference.
- The copied course heights eliminate the prior vertical step, but the soft dark terminal silhouette line remains visible at some joins in the 3x check, most clearly on the lit x run. A production pass should selectively suppress the internal terminal outline under the engine's real draw order without changing outer silhouettes.
- The straight-module 16+8 px zones are mechanically identical. Pier, corner, and gate connection faces were painted to the same profile but were not pixel-copied because their connection projections and masks differ; they need an in-engine adjacency review.
- The shaded y face is darker than x, but its perceived ratio has not been measured photometrically in the running game.

## Verbatim prompts

All prompts below were sent to the built-in image tool. Shared references were the named guide, current painted piece, and `low-planter.png`.

### wall-x-2

> Use case: precise-object-edit
> Asset type: isometric 2.5D game scenery sprite, wall-x-2 variant a
> Input images: Image 1 is the exact geometry guide and required silhouette; Image 2 is the current painted wall style reference; Image 3 is the flower and leaf grain reference.
> Primary request: repaint the wall within Image 1's exact geometry as lively warm coursed fieldstone. Keep the exact isometric canvas, projection, top line, capstone edges, foot line, and silhouette. Make individual stones vary subtly in size and warm cream, buff, and grey tone; darker damp base; pale lit chipped uneven capstones fully inside the silhouette; a few missing chinks and small repairs. Add exactly one irregular narrow ivy column rising from the base and spilling slightly over one capstone, with sparse tiny yellow and white flowers. No plant touches either module end.
> Lighting: the visible long face is the lit side, matching Image 1's flat shading and the house art.
> Style: crisp hand-painted game sprite at the guide's 1.5x scale; sharp stone and leaf edges at 1:1; fine leaves no larger than Image 3's planter foliage; soft dark-brown silhouette outline; restrained saturation.
> End-profile invariant: keep the first and last 16 pixels along the wall axis visually bare and compatible: uninterrupted horizontal courses, pale capstone, moss-darkened foot, no vine, flowers, repair, or distinctive stone centered on an end.
> Constraints: actual transparent background; geometry is law; preserve exact silhouette; no blur, no noise grain, no pure black, no shadow outside silhouette, no text, no watermark, no extra objects. Change only the surface painting.

### wall-x-2-b

> Use case: precise-object-edit
> Asset type: isometric 2.5D game scenery sprite, wall-x-2 variant b
> Input images: Image 1 exact geometry guide and silhouette; Image 2 current wall style reference; Image 3 foliage grain reference.
> Primary request: repaint only inside Image 1's exact geometry as warm cream, buff and grey coursed fieldstone with varied stone sizes, darker damp base, pale lit chipped uneven capstones, missing chinks and modest repairs. Add one irregular flowering climber covering about one third of the visible long face, growing from the base and spilling slightly over capstones; fine ivy leaves and sparse tiny yellow and white flowers. No plant touches either module end.
> Lighting: visible long face is lit, matching Image 1 and house art.
> Style: crisp hand-painted sprite at 1.5x world scale; sharp 1:1 edges; foliage as fine as Image 3; soft dark-brown silhouette outline; restrained saturation.
> End-profile invariant: first and last 16 pixels along wall axis visually bare and compatible—uninterrupted horizontal courses, pale capstone, moss-darkened foot; no vine, flower, repair, or distinctive stone centered on an end.
> Constraints: transparent background; exact canvas/projection/top/capstone/foot silhouette from guide; no blur, noise grain, pure black, outside shadow, text, watermark, or extra objects.

### wall-x-2-c

> Use case: precise-object-edit
> Asset type: isometric 2.5D game scenery sprite, wall-x-2 variant c
> Input images: Image 1 exact geometry guide and silhouette; Image 2 current wall style reference; Image 3 foliage grain reference.
> Primary request: repaint only inside Image 1's exact geometry as warm cream, buff and grey coursed fieldstone with varied stone sizes, darker damp base, pale lit chipped uneven capstones, a few missing chinks and modest repairs. Keep this variant mostly bare: low moss and damp staining only, plus one small delicate fern tuft at the foot near but not at the center. No vine or flower and no planting touches either end.
> Lighting: visible long face is lit, matching Image 1 and house art.
> Style: crisp hand-painted sprite at 1.5x world scale; sharp 1:1 edges; fern as fine as Image 3 foliage; soft dark-brown silhouette outline; restrained saturation.
> End-profile invariant: first and last 16 pixels along wall axis visually bare and compatible—uninterrupted horizontal courses, pale capstone, moss-darkened foot; no plant, repair, or distinctive stone centered on an end.
> Constraints: transparent background; exact canvas/projection/top/capstone/foot silhouette from guide; no blur, noise grain, pure black, outside shadow, text, watermark, or extra objects.

### wall-y-2 / wall-y-2-b / wall-y-2-c

> Use case: precise-object-edit
> Asset type: isometric 2.5D game scenery sprite, wall-y-2 variant [a|b|c]
> Input images: Image 1 exact geometry guide and silhouette; Image 2 current wall style reference; Image 3 foliage grain reference.
> Primary request: repaint only inside Image 1 geometry as warm cream, buff and grey coursed fieldstone, varied individual stones, darker damp base, chipped uneven capstones, missing chinks and modest repairs. [a: Add exactly one narrow irregular ivy column from the base, spilling slightly over one capstone, with sparse tiny yellow and white flowers. | b: Add an irregular flowering climber over about one third of the visible long face, growing from the base and spilling slightly over capstones; fine ivy leaves and sparse tiny yellow and white flowers. | c: Keep mostly bare: low moss and damp staining, plus one small delicate fern tuft at the foot. No vine or flower.] No planting touches either end.
> Lighting: visible long face shaded about 0.75 relative to lit capstones, matching Image 1's west-edge shading.
> Style: crisp hand-painted 2.5D game sprite at 1.5x world scale; sharp 1:1 edges; fine foliage matching Image 3; soft dark-brown silhouette outline; restrained saturation.
> End-profile invariant: first and last 16 pixels along wall axis visually bare and compatible—continuous courses, pale capstone, moss-darkened foot; no plant, repair, or distinctive stone centered at ends.
> Constraints: transparent background; exact canvas/projection/top/capstone/foot silhouette; no blur, grain, pure black, outside shadow, text, watermark, extra objects.

### wall-x-1 / wall-y-1

> Use case: precise-object-edit
> Asset type: isometric 2.5D game scenery sprite, [wall-x-1|wall-y-1]
> Input images: exact geometry guide; current wall reference; foliage grain reference.
> Primary request: repaint only inside the guide silhouette as warm cream, buff and grey coursed fieldstone with varied stones, darker mossy base, chipped capstones, missing chinks and repairs. Add one narrow irregular ivy column with sparse tiny yellow and white flowers, away from both ends; no plant crosses ends.
> Lighting: [x: visible long face lit, matching guide and houses. | y: visible long face shaded about 0.75 relative to lit capstones, matching guide.] Style: crisp hand-painted sprite at 1.5x, sharp fine edges, soft dark-brown outline, restrained saturation.
> End-profile invariant: first and last 16 axis pixels bare and compatible—continuous courses, pale capstone, moss-darkened foot; no distinctive feature.
> Constraints: transparent background; exact canvas/projection/top/capstone/foot silhouette; no blur, grain, pure black, outside shadow, text, watermark, extra objects.

### wall-x-2-buttress / wall-y-2-buttress

> Use case: precise-object-edit
> Asset type: isometric 2.5D game scenery sprite, [wall-x-2-buttress|wall-y-2-buttress]
> Input images: exact geometry guide; current painted piece; foliage grain reference.
> Primary request: repaint only inside exact guide silhouette as lively warm cream, buff and grey coursed fieldstone. Vary stones, darken mossy base, chip pale capstones, add missing chinks and repairs. Projecting buttress solid and crisp. Add a small flowering climber hugging one side of buttress, fine ivy leaves and sparse tiny yellow and white flowers, away from run ends.
> Lighting: [x: long face lit, matching guide/houses. | y: long face shaded about 0.75 relative to lit capstones, matching guide.] Style: crisp hand-painted sprite at 1.5x, sharp 1:1 edges, soft dark-brown outline, restrained saturation.
> End invariant: both wall run ends share bare continuous courses, pale capstone and moss-dark foot; no vines cross ends.
> Constraints: transparent background; exact canvas/projection/top/capstone/foot silhouette; no blur, grain, pure black, outside shadow, text, watermark, extra objects.

### wall-corner-inside

> Use case: precise-object-edit
> Asset type: isometric 2.5D game scenery sprite, inside wall corner pier
> Input images: exact geometry guide; current painted piece; foliage grain reference.
> Primary request: repaint only inside exact guide silhouette as warm cream, buff and grey coursed fieldstone with varied stones, darker damp mossy base, chipped uneven lit capstones, missing chinks and small repairs. Preserve square stepped cap geometry. Add a restrained fine ivy sprig with two or three tiny yellow/white flowers rising from one inner foot and barely spilling onto cap, not obscuring run connection faces.
> Lighting: match both flat-shaded faces in guide. Style: crisp hand-painted 1.5x sprite, sharp 1:1 edges, soft dark-brown outline, restrained saturation.
> Connection invariant: both run meeting faces retain bare continuous horizontal courses, pale capstone edge and moss-dark foot matching straight-module end profile; no vine crosses connections.
> Constraints: transparent background; exact guide canvas/projection/top/capstone/foot silhouette; no blur, grain, pure black, outside shadow, text, watermark, extra objects.

### wall-end-pier-x / wall-end-pier-y

> Use case: precise-object-edit
> Asset type: isometric 2.5D game scenery sprite, [x-run|y-run] end pier
> Input images: exact geometry guide; current painted piece; foliage grain reference.
> Primary request: repaint only inside exact guide silhouette as warm cream, buff and grey coursed fieldstone with varied stones, darker damp mossy base, chipped uneven lit capstones, missing chinks and repairs. Preserve square pier geometry. Add a very small fine fern/ivy tuft at the outer foot, not on the wall connection face.
> Lighting: match guide flat shading [y: with shaded west-facing face about 0.75]. Style: crisp hand-painted 1.5x sprite, sharp 1:1 edges, soft dark-brown outline, restrained saturation.
> Connection invariant: wall meeting face keeps bare continuous courses, pale capstone edge and moss-dark foot matching straight-module end profile; no vine crosses connection.
> Constraints: transparent background; exact guide canvas/projection/top/capstone/foot silhouette; no blur, grain, pure black, outside shadow, text, watermark, extra objects.

### gate-pier-n / gate-pier-s

> Use case: precise-object-edit
> Asset type: isometric 2.5D game scenery sprite, [north|south] gate pier
> Input images: exact geometry guide including small cap fitting; current painted piece; foliage grain reference.
> Primary request: repaint only inside exact guide silhouette as warm cream, buff and grey coursed fieldstone with varied stones, darker damp mossy base, chipped uneven lit capstones, missing chinks and repairs. Preserve the small bronze/brown cap fitting exactly in place and legible. Add a restrained fine flowering ivy sprig at one outer base edge with a few tiny yellow and white flowers, clear of wall connection face.
> Lighting: match guide flat shading. Style: crisp hand-painted 1.5x sprite, sharp 1:1 edges, soft dark-brown outline, restrained saturation.
> Connection invariant: wall meeting face retains bare continuous courses, pale capstone edge and moss-dark foot matching straight-module end profile; no vine crosses connection.
> Constraints: transparent background; exact guide canvas/projection/top/capstone/foot/fitting silhouette; no blur, grain, pure black, outside shadow, text, watermark, extra objects.
