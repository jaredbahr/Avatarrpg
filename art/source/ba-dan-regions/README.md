# Ba Dan region paintings: sources

The village is one continuous painting. These are its sources; `scripts/art/ba-dan-regions/README.md` is the
pipeline and `docs/art/ba-dan-scene.md` the design.

| path        | what                                                                                                                                                                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accepted/` | the six region paintings, `rRcC.png`, each 1536 x 1024 px (1536 x 1024 world px at 1 px per world px, ADR 0088), and `rRcC.json`: where it came from (path and SHA-256), its registration gate numbers, `prompt` (the G1 restyle's prompt file) |
| `geometry/` | the village's upright geometry frozen as it stood when the painting was made: `scene.json` and `sprites/` (`geometry/README.md`)                                                                                                                |

## The regions

**At 1 px per world px (ADR 0088, 27 October 2026).** The grid is `regions.py plan`'s: 3 columns by 2 rows over the pan box
(3000 x 1600 world px from (-200, -100)), 804 and 448 px of overlap (at least 192 world px on every shared side), origins on
whole, even world px. The six regions are crops of the polished G1 master (`art/source/ba-dan-route-a/world/world-g1-polish.png`,
1 px per world px) by `art/source/ba-dan-route-a/tools/regions_back.py`, each gated against a guide of that master with the
frozen uprights over it; all six passed without `--force`. Everything below, up to "Rebuilding", is the history of the twelve
regions at 1.5 px per world px that the G1 restyle was made from (in git before this re-cut).

The grid was then 4 columns by 3 rows, region origins multiples of 3 painting px so they sat on whole world px. Each
was painted over a **guide** (the unpainted village at 1.5x: the geometry's uprights over the old ground plates, plus the neighbouring
accepted paintings' pixels where they overlap) with the built-in image editor, and accepted by a **gate**: the whole frame
and every large blob of the uprights' mask within 1 px and 2 px of the guide's, the frame correlating with the guide, and
seam scores over the overlaps. The gate numbers are in each `.json` (`gate`, `forced`). The tools that built the
guides and ran the gate (`guide`, `gate`, `accept`) are back in `regions.py`: they work from the frozen geometry and
the painting the accepted regions make (the old ground plates are gone), so a region repainted later starts from a
guide of the shipped painting with the geometry's uprights over it (`scripts/art/ba-dan-regions/README.md`).

The painter's prompts were not kept (`prompt: null`). Do not paste carried pixels back into a region after painting it:
`stitch` joins the accepted regions across their overlaps, and that join is invisible.

**Nature pass (2026-10-10).** The owner asked for a greener, more grown-in village on the same layout. All twelve
regions were repainted once more over guides of the shipped painting: reeds, irises and lily pads at the water's edge,
climbers and beds against walls, wildflower drifts and worn earth paths in the lawn, growth in the paving joints. On walkable
tiles only low ground cover was added; no building, path, object or the water's course moved (same gate). Each `.json`
names the attempt taken (`source.path`, relative to the painters' run folders, which are not tracked).

**Prop check.** The gate measures where buildings and other large pieces sit; it does not notice a small prop drawn wrongly.
The owner found a white jar fused into a barrel by the north shop (there since the first repaint). It was redrawn as two
objects and that one box (about 112 x 122 px) was put into `r0c2` and, feathered, into the same spot of `r1c2`; nothing else
in either region changed. After any repaint, compare every prop with the painting before at 3x (fused, miscounted, missing
parts, broken construction, lost shadow) before accepting it.

## Rebuilding

`sh scripts/art/ba-dan-regions/regen.sh` rebuilds `public/art/maps/ba-dan-scene/ground-NN.webp`,
`uprights-N.webp` and `src/content/scenes/baDan.art.ts` from `accepted/` and `geometry/` and nothing else;
`--check` compares instead of writing. Replacing a region: put the new 1536 x 1024 painting (1 px per world px) in `accepted/`
(`regions.py guide rRcC` makes the guide to paint over; `gate` checks it registers within 2 px; `accept` stores it), run `regen.sh`, look at `.review/regions/stitch-report.json` (`needsRepaint`, `forced`) and the
joins at 2x, then run `ba-dan-regions.test.ts`.
