# Ba Dan upright scenery restyle sources

`scripts/art/ba-dan-restyle.ts` packs Ba Dan's six upright textures in
`public/art/maps/ba-dan-scene/` (merchant house, dwelling, fruit stall, low
planter, village tree, canal bridge) from these files and nothing else.
`scripts/art/ba-dan-restyle.test.ts` re-packs them and compares every pixel with
what ships, and checks each file here against `pins.json`.

- `pixellab/<name>.png` is the chosen PixelLab `image_to_pixelart` redraw,
  exactly as the job returned it: `faithful=false`, `init_image_strength=0`,
  output at two screen pixels a texel (the world width at zoom 1.2, halved).
  Three seeds were generated per asset and one was kept; the job ids and seeds
  are in `pins.json`. The inputs were the shipped WebPs as already published
  on the repository's `main`, so nothing new left the repository.
- `shipped/<name>.png` is the texture the redraw replaces, losslessly decoded
  from the WebP at commit `59d951f`. These were OpenAI image generations (see
  `docs/art/ba-dan-scene.md`). The restyle takes its chroma from them, so the
  jade roof, cream plaster, oak and limestone stay the approved Ba Dan
  materials; the redraw supplies the luminance, shapes and pixel grain.

The generations were made on Jared's PixelLab subscription, under PixelLab's
terms of service, with no third-party reference image.
