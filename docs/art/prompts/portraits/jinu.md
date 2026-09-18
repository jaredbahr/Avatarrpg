# Portrait: Jinu — `portrait.jinu`

|               |                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Palette**   | `air` — base `#e8dcc0`, light `#fdf6e3`, dark `#9a8e72`, accent `#fffdf5`, ink `#1b1410`, background `#f4e9d8`       |
| **Reference** | `art/raw/reference/unit.air.jinu.png` — the full-body figure; the image reference, so the portrait matches the sheet |
| **Deliver**   | `art/raw/portraits/jinu.png` (1024×1024 or larger, PNG)                                                              |
| **Ships as**  | `public/art/portraits/jinu.png` (512×512)                                                                            |
| **Manifest**  | `'portrait.jinu': { kind: 'image', url: 'art/portraits/jinu.png', palette: 'air' }`                                  |

## Who

A young woman with dark curly hair in two high buns and loose curls at the temples, grey eyes, deep brown skin and an open laughing smile.

A short rust-orange shoulder cape over a saffron-yellow cross-over wrap tunic with cream undersleeves; dark cloth wraps on the forearms; a dark-red fringed sash with long tails; loose cream trousers; brown sandals with straps cross-bound up the calves.

Two small leaves caught in a breeze beside her raised right hand on the viewer’s left. The right palm faces the viewer: index and middle raised in a relaxed V, ring and little curled separately on the viewer’s left, and one thumb rooted on the viewer’s right across the curled fingers.

## Signature

The two curly buns and the fringed sash. She must not be mistaken for Nima: buns, curls, more cloth in motion.

## Prompt

Copy the whole paragraph. It carries the style block itself so nothing needs to be prepended.

```text
A young woman with dark curly hair in two high buns and loose curls at the temples, grey eyes, deep brown skin and an open laughing smile. A short rust-orange shoulder cape over a saffron-yellow cross-over wrap tunic with cream undersleeves; dark cloth wraps on the forearms; a dark-red fringed sash with long tails; loose cream trousers; brown sandals with straps cross-bound up the calves. Two small leaves caught in a breeze beside her raised right hand on the viewer’s left. The right palm faces the viewer: index and middle raised in a relaxed V, ring and little curled separately on the viewer’s left, and one thumb rooted on the viewer’s right across the curled fingers. Flat cel-shaded illustration in the manner of a hand-drawn animated series: clean, uniform dark-brown ink outlines (#1b1410), never black and never tapered; every material in exactly two flat tones, a base and one shadow, plus a thin pale rim light along the edge facing the light; no gradients, no painted texture, no photographic detail, no lens effects, no soft shading. Bust portrait, head and shoulders, three-quarter view turned slightly toward the viewer’s right, eyes toward the viewer. Centred, the head filling about two thirds of the height, with clear space on every side because the game crops it to a circle. Flat, completely plain background of exactly #f4e9d8 (warm parchment) with no scenery, no vignette, no border and no texture. Square, 1024×1024, to be downscaled to 512×512. Colours: the air palette for the sash, the trim and the element hint — base #e8dcc0, shadow #9a8e72, highlight #fdf6e3, accent #fffdf5; every other garment keeps the colours of the reference image; skin and hair in flat natural tones with one shadow each; ink #1b1410. Expression and bearing: Talkative, delighted, about to make a point. Same character as the reference image: same face, hair and costume.
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

Run `checklist.md` before committing. For this portrait in particular: The two curly buns and the fringed sash. She must not be mistaken for Nima: buns, curls, more cloth in motion.
