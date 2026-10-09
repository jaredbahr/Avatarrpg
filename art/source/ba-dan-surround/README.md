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

Run `node --import tsx scripts/art/ba-dan-surround.ts` to encode
`public/art/maps/ba-dan-scene/village-surround.webp` (lossy, exact alpha), or add
`--check` to re-pack and compare it byte for byte with the shipped file.
