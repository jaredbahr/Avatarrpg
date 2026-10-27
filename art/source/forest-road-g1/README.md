# The forest road at G1: sources, tools and ledger

Issue #284, ADR 0085 (Route A at G1) and ADR 0086 (this pass). The first fight's board (`forest_road`,
`src/content/scenes/forestRoad.ts`) redrawn at the characters' grain, 1 art px = 1 world px, in the PixelLab G family that
made Ba Dan's G1 world. Gameplay geometry is untouched: every ground piece keeps its rectangle and alpha, every upright
its rectangle, anchor and depth key.

## Provenance

- Generator: PixelLab v2. Ground: `POST /v2/edit-images-v2`, method `edit_with_text`, seed 11, 512 px tiles. Uprights
  and props: `POST /v2/edit-image-pro-flash`, method `text`, `no_background`, seeds 21 and 22. No reference image, no
  figure, anywhere.
- Inputs: the pre-G1 art at main `5a41f98` (`pre-g1/` holds the ground plates and `scene.json`, the registration they
  were drawn at; the uprights and props are read from git by `tools/pre.py`).
- Generated 2026-10-27. Terms: https://pixellab.ai/termsofservice
- `ledger.json`: every job in order, with its request (images as input names), job id, status, outputs and its
  generations. **778 generations**: the ground pass 400 (16 tiles; two tiles held only page and were not sent), the
  prompt probe 50, the two heap re-grounds 20, the rejected heap inpaints 12, and 52 upright and prop jobs 296.
- `jobs/`: output 0 of every job. The tools read it before they call PixelLab, so the whole pipeline re-runs offline.

## Pipeline

```sh
python3 art/source/forest-road-g1/tools/compose.py   # pre-G1 ground pieces -> one world-px composite (2688 x 1344)
python3 art/source/forest-road-g1/tools/world.py     # one restyle pass at world px            (PixelLab, cached)
python3 art/source/forest-road-g1/tools/tone.py      # broad colour back to the painting's, one palette
python3 art/source/forest-road-g1/tools/uprights.py  # every upright and prop at world px     (PixelLab, cached)
python3 art/source/forest-road-g1/tools/cut.py       # clear the heaps and glyphs, cut back into the pieces
python3 art/source/forest-road-g1/tools/select.py    # -> pieces/ (the selection, contour, 1.5x delivery)
node --import tsx scripts/art/forest-g1-pack.ts      # -> public/art/maps/forest-g1/, public/art/props/ (--check)
```

Work files go to `FOREST_G1_WORK` (default `.review/forest-g1`). `scripts/art/forest-g1-pack.test.ts` holds the shipped
files to `pieces/` byte for byte.

- **Prompts** (`tools/style.py`): Ba Dan's `STYLE` and `KEEP` unchanged, and the forest's own ground sentence. Ba Dan's
  (`GROUND_BADAN`) was probed first on one tile: it bleached the grass to a single olive, the fault the owner saw in Ba
  Dan at a distance (probe jobs `probe-badan`, `probe-living`; numbers in ADR 0086).
- **Colour** (`tools/tone.py`): the restyle drifted salmon on the road and yellow on the grass, tile by tile. Its low
  frequencies are moved back to the painting's (YCbCr, sigma 12 px; chroma fully, luma 60%), then one 192-colour
  palette, no dither. The shelf is taken down 10% in luma.
- **Cut** (`tools/cut.py`): the two rubble heaps are separate pieces that a fight can clear, so the ground under them is
  restyled again from the composite without them (`reground-*`) and pasted over their footprint only, gain-matched.
  Pro Flash inpaint was tried first (`clear-heap-*`): smooth and pink, rejected. Generator glyphs on the grass west of
  the lodge (pseudo-letters, found at the 1.5 camera) are closed over in the grass's own tones. In the apron's fade the
  page colour is un-mixed from the restyle, so the fade keeps its pre-G1 alpha without darkening twice.
- **Uprights** (`tools/uprights.py`, `selection.json`): each piece's pre-G1 art reduced to the rectangle it is drawn at,
  in world px, on the smallest Pro Flash canvas (multiple of 4, at least 32), two seeds. Picks (`tools/sheet_uprights.py`
  draws the sheet): darker, warmer wood for the lodge and dressing; grey stone for the milestone and the heap prop; the
  greener cabbages; for `pine-b` the blue-green seed, whose chroma `select.py` then moves halfway to `pine`'s so the wall
  reads as one species. Silhouette edges are taken 0.8 of the way to `#1b1410`, alpha made binary.

## Faults (judged at the fit and at the 1.5 camera, Canvas)

- The ground ships at 1 file px per world px (budget), so at the 1.5 camera it is softer than the 1.5x uprights and
  the figures; the lossy codec softens moss and kerb colour edges a little more. See ADR 0086.
- The figures are still finer-grained than the world (ADR 0085's open camera question).
- The restyle invented a few things in the apron's fade: bushes past the west corner and the east shelf, and a striped
  sliver at the bottom corner (a streak was there before too). They sit in faded, out-of-play ground.
- Lily pads now sit near two water-cell centres (west creek 6,11 and pond 4,6). Still plainly water.
- The kerb stones carry a 1 px contour where the painting had none; at the fit it reads as a crisp road edge, at the
  1.5 camera as a stepped dark line.
- The thicket floor under the pines is busier than the meadow; it is never walked.
