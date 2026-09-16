# Portrait: The narrator (Ba Dan itself) — `portrait.narrator`

|              |                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Palette**  | `neutral` — base `#8d7d69`, light `#bfae97`, dark `#4a3a2c`, accent `#f4e9d8`, ink `#1b1410`, background `#f4e9d8` |
| **Deliver**  | `art/raw/portraits/narrator.png` (1024×1024 or larger, PNG)                                                        |
| **Ships as** | `public/art/portraits/narrator.png` (512×512)                                                                      |
| **Manifest** | `'portrait.narrator': { kind: 'image', url: 'art/portraits/narrator.png', palette: 'neutral' }`                    |

## Who

Not a person. The narrator speaks as places: the village, the east road, the quarry. Draw the village of Ba Dan as an emblem: a squat stone gate of cut blocks with a wooden crossbeam, the quarry hill rising behind it under a low sun, one empty cart in the road.

Stone in warm grey-brown (base #8d7d69, shadow #4a3a2c) with the sky in pale parchment and the hill in muted green. Two tones per surface, ink outlines, like a woodcut printed flat.

The cart is empty. That is the whole story of Act 1 in one detail.

## Signature

The gate and the hill; it must read as a place at 40 px, not a face.

## Prompt

Copy the whole paragraph. It carries the style block itself so nothing needs to be prepended.

```text
Not a person. The narrator speaks as places: the village, the east road, the quarry. Draw the village of Ba Dan as an emblem: a squat stone gate of cut blocks with a wooden crossbeam, the quarry hill rising behind it under a low sun, one empty cart in the road. Stone in warm grey-brown (base #8d7d69, shadow #4a3a2c) with the sky in pale parchment and the hill in muted green. Two tones per surface, ink outlines, like a woodcut printed flat. The cart is empty. That is the whole story of Act 1 in one detail. Flat cel-shaded illustration in the manner of a hand-drawn animated series: clean, uniform dark-brown ink outlines (#1b1410), never black and never tapered; every material in exactly two flat tones, a base and one shadow, plus a thin pale rim light along the edge facing the light; no gradients, no painted texture, no photographic detail, no lens effects, no soft shading. Bust portrait, head and shoulders, three-quarter view turned slightly toward the viewer’s right, eyes toward the viewer. Centred, the head filling about two thirds of the height, with clear space on every side because the game crops it to a circle. Flat, completely plain background of exactly #f4e9d8 (warm parchment) with no scenery, no vignette, no border and no texture. Square, 1024×1024, to be downscaled to 512×512. Colours: base #8d7d69, shadow #4a3a2c, highlight #bfae97, one accent #f4e9d8; skin and hair in flat natural tones with one shadow each; ink #1b1410. Expression and bearing: Still, patient, a little foreboding.
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

Run `checklist.md` before committing. For this portrait in particular: The gate and the hill; it must read as a place at 40 px, not a face.
