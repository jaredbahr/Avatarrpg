# ADR 0076: Ba Dan is one continuous painting; the maps art family is 7.5 MiB

**Status:** accepted, 2026-10-10

Amends ADR 0075 (the maps family budget) and ADR 0073 (Ba Dan's atlases). Replaces the baked ground plates, the
partial-scene join wash and the packed true pieces as the way Ba Dan's art is made.

## Context

The village was built from pieces: ten painted true pieces and the dressing, walls and trees packed into atlases, laid on ground plates
that carried the light, the cast shadow, the contact, the wear and the joins baked from the pieces' volumes, drawn as a
`groundMode: 'partial'` scene with a runtime join wash on top. The owner looked at it and rejected it as cut, stacked and floating,
and liked the trial repaints. The route chosen on 2026-10-09: the village is **one continuous painting** (twelve region paintings,
each painted over guides rendered at 1.5 image px per world px and registered to the geometry within 2 px), with the pieces a figure can walk
behind cut back out of it by their geometry masks.

## Decision

- The twelve accepted regions (`art/source/ba-dan-regions/accepted/`) are stitched (a cheapest seam per overlap, differences given
  whole to one side, colour ramped and detail kept) into one 4500 x 2401 painting, cut into 12 ground plates (4 x 3, 2 px overlaps, lossy WebP
  q85) and 49 uprights (the pieces a figure on a walkable cell can stand behind; 29 more stay in the ground), packed into two
  2048-pixel pages. `scripts/art/ba-dan-regions/regen.sh` is the way Ba Dan's shipped art is produced, deterministic, with `--check`.
- The upright geometry the painting is cut by is frozen (`art/source/ba-dan-regions/geometry/`), so the scene data can change
  independently. `src/content/scenes/baDan.art.ts` is generated.
- Ba Dan is a complete scene (`paintedWater: true`, no `groundMode: 'partial'`). The runtime draws no contact ring, cast shadow, join wash
  or film over the painted canal; the baked-light ground generators, the exterior apron, frame and surround pieces and their tests
  are removed (git history at `7925789c`). The renderer is unchanged.
- Resolution is 1.5 painting px per world px for ground and uprights: at 1 px the painting is visibly softer than the characters.
- The maps family budget (`MAPS_BUDGET_MB` in `scripts/check-asset-budget.mjs`) goes from 7 MiB to **7.5 MiB**: the owner allowed
  raising it for this work on 2026-10-09, to the next 0.5 MiB above what is measured after honest trimming.

## Measured

|                                                | before                                | after                                                          |
| ---------------------------------------------- | ------------------------------------- | -------------------------------------------------------------- |
| Ba Dan scene folder, the village's files       | 40 files, 3,427,002 B                 | 14 files, 4,097,958 B (12 plates 2,584,854; 2 pages 1,513,104) |
| decoded, the village                           | 85.3 MiB (ground 45.5, uprights 39.8) | 68.6 MiB (ground 41.3, uprights 27.3)                          |
| maps family (`public/art/maps`)                | 7,024,474 B = 6.70 MiB                | 7,695,430 B = 7.34 MiB                                         |
| `baDan.ts` (+ `baDan.art.ts`) minified         | 9.8 KB (3.9 KB gzip)                  | 6.5 KB (2.8 KB gzip)                                           |
| scene images / ground pieces / scenery entries | 40 files / 31 / 78                    | 14 files / 12 / 49                                             |

Trimmed first: the uprights are cut to their bounding boxes and the pieces nothing can stand behind (the backdrops, the wall,
the terrace, the frame's tree clumps, 29 of 78) are in the ground only, which took the uprights from 20.8 million pixels of
canvas (16.8 million trimmed) to 6.6 million trimmed. What is left over 7 MiB is the painting itself: 12 plates at 2.58 MB. Ground quality is 85, the lowest whose 2x
crops show no loss against the lossless painting (80 softens wood grain and stone).

## Consequences

- The maps family is allowed 7.5 MiB; every other family keeps its number. The next ask for more is a reviewed line and an ADR, as
  this one is.
- The precache total (25 MiB) needs a build and is checked by CI (`npm run build`, `node scripts/check-asset-budget.mjs`), not here.
- Decoded memory for the village falls by 16.7 MiB (this scene asks for 14 of `SCENE_IMAGE_CAP`'s 40 images, ADR 0072; the largest
  plate decodes to 3.4 MiB, the pages to 16.0 and 11.3).
- A fading house or tree over the repainted ground veils a figure rather than clearing the building away (the ground under a piece
  is the painting, piece included), and what a fading front piece reveals of a hidden upright is the old painting's drawing in the
  new painting's colours. Both need the running game to judge (`docs/art/ba-dan-scene.md`).
- Moving or adding a piece is a repaint of its region and a new frozen-geometry entry, not a change to a plate.
- **Open: the painting is smaller than the camera's reach.** It covers the pan box (-200, -100, 3000, 1600); at 1368 x 714 and 1.5
  the camera shows world x -378 .. 2938 and y -199 .. 1479 (more when zoomed out), where the old art reached x -384 .. 3136. The ring is
  flat margin colour there and the painting's edge cuts painted foliage. It needs outer regions painted or the camera held in
  (`docs/art/ba-dan-scene.md`, "Pan reach"); this ADR does not decide which.
