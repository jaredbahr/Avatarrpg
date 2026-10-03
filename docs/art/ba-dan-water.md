# Ba Dan painted water

Shipped 2026-10-03. The courtyard canal's two pools (`canal-banks.webp`) and the
south canal and west ford (`edge-water.webp`) are one fieldstone water material,
the Forest Road pond's family: stone-edged, clear shallows into a darker
channel, a few ripples, lily pads only in the ford. The renderer lays no film
over the declared pool cells (`paintedWaterCells`), and none is baked in.

## Provenance

- Generator: built-in image generation, the image model the earlier candidate
  lane used (output terms: https://openai.com/policies/row-terms-of-use/). The
  same terms cover the rest of the Ba Dan scene art (`NOTICE.md`,
  `docs/art/ba-dan-scene.md`); no exclusive copyright in generated output is
  claimed. Non-commercial use was checked against those terms, as
  `docs/art/README.md` requires. Date: 2026-10-03.
- Prompt summary: a 1:1 repaint, over the registration footprint, of the water
  in a top-down oblique tactical board: laid fieldstone coping, clear shallow
  water deepening to a darker channel, a few small ripples, nothing else (no
  figures, props, grid, lettering, franchise or character names). The verbatim
  prompts were not kept with the masters; only this summary is recorded.
- Masters: `art/source/ba-dan-water/canal-banks.png` (135,081 bytes) and
  `edge-water.png` (421,139 bytes), the generator's accepted output with its
  alpha equal to the shipped footprint (the cells' diamonds plus the shoreline
  band).
- Mechanical steps: none beyond the encode. `scripts/art/ba-dan-water.ts` reads
  each master PNG and writes the lossless-alpha WebP at quality 82 into
  `public/art/maps/ba-dan-scene/`; `scripts/art/ba-dan-water.test.ts` holds the
  shipped files to the footprint geometry. `ba-dan-canal-banks.ts` and
  `ba-dan-edges.ts` stay as the geometric reference the footprint is measured
  against and no longer write shipped files.

## Water that stops being water

The pools are baked into the plate, but the rules own the cell. If a declared
cell ever holds a surface other than water (steam, ice, a drained pool), both
backends cover it with its procedural terrain (`paintedWaterIsDry` in
`src/render/sceneSurfaces.ts`; Canvas 2D paints the terrain, WebGL packs
terrain + 16 into the map texel and the shader draws it over the art) and the
new surface draws on top. Today nothing reaches this path: the village is an
explore map and no encounter is staged on it (`baDan.test.ts` holds that).
