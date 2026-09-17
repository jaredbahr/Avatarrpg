# Portrait: Nima — `portrait.nima`

|               |                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Palette**   | `air` — base `#e8dcc0`, light `#fdf6e3`, dark `#9a8e72`, accent `#fffdf5`, ink `#1b1410`, background `#f4e9d8`       |
| **Reference** | `art/raw/reference/unit.air.nima.png` — the full-body figure; the image reference, so the portrait matches the sheet |
| **Deliver**   | `art/raw/portraits/nima.png` (1024×1024 or larger, PNG)                                                              |
| **Ships as**  | `public/art/portraits/nima.png` (512×512)                                                                            |
| **Manifest**  | `'portrait.nima': { kind: 'image', url: 'art/portraits/nima.png', palette: 'air' }`                                  |

## Who

A young man with short dark hair shaved close at the sides, grey eyes, tan skin and a wide grin. Slight and light on his feet.

A short rust-orange shoulder cape fastened with a small wooden disc over a saffron-yellow tunic with orange hems and short sleeves. A dark-red sash with a wooden ring and trailing ends; loose cream trousers; brown ankle boots bound with straps; dark cloth wraps on the forearms.

A single curl of wind drawn as one flat pale spiral beside one raised hand at the edge of the frame.

## Signature

The shaved sides and the short orange cape. Airy, not saintly. The two air characters differ by hair: his cropped, hers in two buns.

## Prompt

Copy the whole paragraph. It carries the style block itself so nothing needs to be prepended.

```text
A young man with short dark hair shaved close at the sides, grey eyes, tan skin and a wide grin. Slight and light on his feet. A short rust-orange shoulder cape fastened with a small wooden disc over a saffron-yellow tunic with orange hems and short sleeves. A dark-red sash with a wooden ring and trailing ends; loose cream trousers; brown ankle boots bound with straps; dark cloth wraps on the forearms. A single curl of wind drawn as one flat pale spiral beside one raised hand at the edge of the frame. Flat cel-shaded illustration in the manner of a hand-drawn animated series: clean, uniform dark-brown ink outlines (#1b1410), never black and never tapered; every material in exactly two flat tones, a base and one shadow, plus a thin pale rim light along the edge facing the light; no gradients, no painted texture, no photographic detail, no lens effects, no soft shading. Bust portrait, head and shoulders, three-quarter view turned slightly toward the viewer’s right, eyes toward the viewer. Centred, the head filling about two thirds of the height, with clear space on every side because the game crops it to a circle. Flat, completely plain background of exactly #f4e9d8 (warm parchment) with no scenery, no vignette, no border and no texture. Square, 1024×1024, to be downscaled to 512×512. Colours: the air palette for the sash, the trim and the element hint — base #e8dcc0, shadow #9a8e72, highlight #fdf6e3, accent #fffdf5; every other garment keeps the colours of the reference image; skin and hair in flat natural tones with one shadow each; ink #1b1410. Expression and bearing: Amused and a little elsewhere. Same character as the reference image: same face, hair and costume.
```

## Negative prompt

```text
black outlines, tapered or sketchy lines, gradients, airbrushing, soft shading, painterly texture, photorealism, 3D render, background scenery, vignette, border, frame, text, lettering, watermark, signature, logo, tattoos or markings on the skin, any likeness of a known animated character, weapons pointed at the viewer, gore
```

## Variations

Generate three candidates and pick by the checklist, not by which one is prettiest:

1. As written.
2. Turned a little further toward the viewer, expression one notch calmer.
3. Tighter crop, head filling three quarters of the height, for how it reads in the 2.4rem turn-strip chip.

## Check

Run `checklist.md` before committing. For this portrait in particular: The shaved sides and the short orange cape. Airy, not saintly. The two air characters differ by hair: his cropped, hers in two buns.
