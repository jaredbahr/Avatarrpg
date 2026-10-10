# Ba Dan exterior surround master

`village-surround-master.png` is the canonical master: the assembled 1824x640
atlas itself, lossless, with binary alpha. It holds the two foliage and roof
backdrops behind the boundary wall; their rectangles are `BA_DAN_SURROUND_MODULES`
in `src/content/scenes/baDan.ts`. It was 1824x1280 and also held the old north and
west fieldstone wall runs; the wall is now composed from painted modules
(`art/source/ba-dan-true/README.md`, "The boundary wall") and the master was cropped
to the backdrops (rows 640 to 1279 of the old atlas, unchanged).

It was assembled from built-in image-generator output, selected on 6 October
2026, by a one-off script that is not reproducible; the intermediate sources are
not tracked and the exact generation prompts are unavailable. The art direction
requested isolated reusable oblique pale-fieldstone wall, roof and foliage
modules matching the Ba Dan houses and tree, with warm upper-left light,
dark-brown outlines, no people, text, ground plane or projected shadow. This is
an acceptance summary, not a verbatim prompt.

`village-surround.webp` is no longer shipped: the north and west backdrops are inside the village's continuous
painting now (`docs/art/ba-dan-scene.md`), and the encoder `scripts/art/ba-dan-surround.ts` was retired with the
ground plates. The master here and the last encoded atlas (`art/source/ba-dan-regions/geometry/sprites/village-surround.webp`)
are what the painting's guides were drawn from.

## Trim (9 October 2026)

The slices the master was assembled from left ruled vertical edges: clumps cut flat for eighty rows, and four of
them with the end of a house roof (chimney, ridge, plaster) sliced on the same line behind the trees, which read in
the game as a building with a part cut away. `python scripts/art/ba-dan-guides/surround-trim.py` removes those four
roofs and eats every ruled vertical edge into a scalloped canopy end (no new paint, binary alpha kept; running it
again changes nothing). The master in this folder is the trimmed result; the untrimmed one is the parent commit's.
