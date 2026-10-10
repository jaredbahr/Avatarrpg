# Ba Dan upright scenery restyle sources

`scripts/art/ba-dan-restyle.ts` packs the Ba Dan upright textures that are **not** true
pieces, in `public/art/maps/ba-dan-scene/`, from `fine/` and nothing else:

- (until the dressing pass) the four native trees (`sapling-`, `small-`, `medium-`, `large-village-tree`),
  which the village drew unscaled. They are still the authored sources here and the village's painting
  was made over them (the guides had them), but nothing packs them any more: the trees the village
  shows are in the painting (`docs/art/ba-dan-scene.md`; `scripts/art/ba-dan-trees-pack.ts` was retired
  with the continuous painting); and
- two older masters the Forest Road still borrows: `village-tree` (its alder) and `dwelling`
  (its lodge, 602x388).

The village's houses, market tables, planters and bridge are the true pieces, built from guide
geometry and painted over: see `art/source/ba-dan-true/README.md`. Their old masters, variants,
`pre/` sources and the preparation scripts (projection conform, variety prep, chroma fit,
shade, outline and stone-edge steps) were removed with them.

`scripts/art/ba-dan-restyle.test.ts` re-packs these files and compares every pixel with what
ships, and checks each file against `fine/pins.json`; `node --import tsx
scripts/art/ba-dan-restyle.ts --check` does the same from the command line.

- `fine/<name>.png` is the authored asset (lit repaint, binary alpha); `fine/variety-prompts.md`
  is the painter's record. `pins.json` holds each file's hash and, for `dwelling`, the
  projection measurement windows the lodge master was conformed against
  (`scripts/art/ba-dan-projection.test.ts` holds the shipped file within a degree of the tile
  line).
- `pixellab/<name>.png` is the chosen PixelLab `image_to_pixelart` redraw the `dwelling` and
  `village-tree` masters descend from, as the job returned it; `shipped/<name>.png` is the
  texture it replaced, decoded from the WebP at commit `59d951f`. The generations were made on
  Jared's PixelLab subscription, under PixelLab's terms of service, with no third-party
  reference image.
