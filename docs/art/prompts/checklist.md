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
- [ ] Saved as 512×512 PNG at `public/art/portraits/<name>.png`, with the manifest entry carrying the right `palette`

## Before the commit

- [ ] The generator's output licence permits non-commercial use
- [ ] `npm run verify` passes (the prompt test guards the packs; the content test guards the manifest)
- [ ] Looked at in the game on the tablet: dialogue stage, party setup, unit inspector, turn strip
