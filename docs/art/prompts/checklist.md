# Checklist

Every generated image passes every line before it is committed. A failure is a
regeneration, not a retouch: a retouched image drifts from its siblings.

## Any asset

- [ ] Outline weight uniform and dark brown; no black, no tapering, no sketch lines
- [ ] Two flat tones per material plus a thin rim light; no gradients, no airbrushing, no texture, no grain, no depth of field
- [ ] Colours match the pack's palette lines (spot-check the base and shadow of the main garment against the hex values)
- [ ] No text, lettering, watermark, signature or logo anywhere
- [ ] No likeness of any known animated character; nothing that would be recognised as a costume from a series
- [ ] No markings, tattoos or emblems on skin
- [ ] Readable when shrunk to 40 pixels: squint, or downscale and look

## Portraits

- [ ] Bust, three-quarter view, eyes toward the viewer
- [ ] Head centred with clear space on every side; nothing important within the corners the circular crop removes
- [ ] Background is flat `#f4e9d8` edge to edge: no vignette, no border, no scenery, no gradient
- [ ] The signature element named in the pack is present and reads at the turn-strip size (2.4rem, roughly 40 px)
- [ ] The two characters of an element are distinct in silhouette, not only in colour (Kaya/Tenzo, Nilak/Sura, Bo/Lin Mei, Nima/Jinu, Riko/Wen)
- [ ] `npm run art:portrait` accepted it (512 or larger, the medallion keeps the whole head after its centre-square cut) and `npm run art:validate` passes with the manifest entry it printed

## Sheets

- [ ] Same face, hair, build and costume in every frame; the reference figure is the truth, and a frame that drifts is regenerated
- [ ] Full figure facing screen-right in every frame, feet on the 85% line, head inside the frame; nothing that reads wrong mirrored
- [ ] Background keyed clean by `art:normalise`: no green fringe, no ground shadow, no cast shadow, no remnants
- [ ] The element only as the small hint at the hand the pose names; no swirl, no floating rocks or leaves, because the effects layer draws those
- [ ] Idle A and B differ only by the breath; cast wind-up, release and recover read as one motion; hit and KO show no wounds
- [ ] Readable at 40 px in the game, and distinct in silhouette from the other character of the element
- [ ] `npm run art:validate` and `npm run check:assets` pass; the manifest entry carries the right `palette`

## Maps

- [ ] Every feature in the pack's grid section is there, and every edge that matters to the rules (road edges, banks, ledges, walls) sits on a tile line with Show grid on
- [ ] Nothing the game draws itself is painted in: no characters, no barrels, carts or braziers, no UI, no grid
- [ ] Evenly lit edge to edge: no vignette, no dark corners, no cast shadow longer than a tile
- [ ] Still water where the map has water; the game tints it live, so a drained or frozen pond still reads
- [ ] `npm run art:map` accepted it (the aspect within a tenth, at least the delivery size) and any band it cut is under a tile, and `npm run art:validate` and `npm run check:assets` pass
- [ ] Looked at in the game on both renderers, at the fitted zoom and pinched to the largest

## Before the commit

- [ ] The generator's output licence permits non-commercial use
- [ ] `git ls-files art/` prints nothing: raw pictures stay on the `art-intake` branch
- [ ] `npm run verify` passes (the prompt test guards the packs; the content test guards the manifest)
- [ ] Looked at in the game on the tablet: dialogue stage, party setup, unit inspector, turn strip
