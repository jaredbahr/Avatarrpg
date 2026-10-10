# Ba Dan region paintings: sources

The village is one continuous painting. These are its sources; `scripts/art/ba-dan-regions/README.md` is the
pipeline and `docs/art/ba-dan-scene.md` the design.

| path        | what                                                                                                                                                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accepted/` | the twelve region paintings, `rRcC.png`, each 1536 x 1024 px (1024 x 682.7 world px at 1.5 px per world px), and `rRcC.json`: where it came from (path and SHA-256), its registration gate numbers, `prompt` (null: not kept) |
| `geometry/` | the village's upright geometry frozen as it stood when the painting was made: `scene.json` and `sprites/` (`geometry/README.md`)                                                                                              |

## The regions

The grid is `regions.py plan`'s: 4 columns by 3 rows over the pan box (3000 x 1600 world px from (-200, -100)), at least 192 world
px of overlap on every shared side, region origins multiples of 3 painting px so they sit on whole world px. Each
was painted over a **guide** (the unpainted village at 1.5x: the geometry's uprights over the old ground plates, plus the neighbouring
accepted paintings' pixels where they overlap) with the built-in image editor, and accepted by a **gate**: the whole frame
and every large blob of the uprights' mask within 1 px and 2 px of the guide's, the frame correlating with the guide, and
seam scores over the overlaps. The gate numbers are in each `.json` (`gate`, `forced`). The tools that built the
guides and ran the gate (`guide`, `gate`, `accept`) are back in `regions.py`: they work from the frozen geometry and
the painting the accepted regions make (the old ground plates are gone), so a region repainted later starts from a
guide of the shipped painting with the geometry's uprights over it (`scripts/art/ba-dan-regions/README.md`).

The painter's prompts were not kept (`prompt: null`). Do not paste carried pixels back into a region after painting it:
`stitch` joins the accepted regions across their overlaps, and that join is invisible.

## Rebuilding

`sh scripts/art/ba-dan-regions/regen.sh` rebuilds `public/art/maps/ba-dan-scene/ground-NN.webp`,
`uprights-N.webp` and `src/content/scenes/baDan.art.ts` from `accepted/` and `geometry/` and nothing else;
`--check` compares instead of writing. Replacing a region: put the new 1536 x 1024 painting in `accepted/`
(`regions.py guide rRcC` makes the guide to paint over; `gate` checks it registers within 2 px; `accept` stores it), run `regen.sh`, look at `.review/regions/stitch-report.json` (`needsRepaint`, `forced`) and the
joins at 2x, then run `ba-dan-regions.test.ts`.
