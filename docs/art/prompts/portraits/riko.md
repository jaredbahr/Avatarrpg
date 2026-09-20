# Portrait: Riko — `portrait.riko`

|               |                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Palette**   | `nonbender` — base `#9b7bb8`, light `#c3a8d8`, dark `#5f4677`, accent `#e9dcf5`, ink `#1b1410`, background `#f4e9d8` |
| **Reference** | `art/raw/reference/unit.non.riko.png` — the full-body figure; the image reference, so the portrait matches the sheet |
| **Deliver**   | `art/raw/portraits/riko.png` (1024×1024 or larger, PNG)                                                              |
| **Ships as**  | `public/art/portraits/riko.png` (512×512)                                                                            |
| **Manifest**  | `'portrait.riko': { kind: 'image', url: 'art/portraits/riko.png', palette: 'nonbender' }`                            |

## Who

A young woman with jaw-length dark hair and one thin braid at the temple, brown eyes, tan skin and a level, knowing half-smile. Wiry, shoulders relaxed.

A fitted maroon jacket with a high collar, grey piping and a single toggle at the chest; grey cloth wraps on both forearms; a bright-red sash with long tails; loose black trousers with grey knee guards; dark-red leg wraps; split-toe dark shoes.

No weapon and no element: her right hand is raised on the viewer’s left in a controlled two-finger gesture. The right palm faces the viewer, index and middle extended together, ring and little curled separately on the viewer’s left, and one thumb rooted on the viewer’s right across them.

## Signature

The raised two-finger hand, the grey knee guards and the single thin braid. Plain, controlled, nothing decorative; she must not read as an acrobat or a performer.

## Prompt

Copy the whole paragraph. It carries the style block itself so nothing needs to be prepended.

```text
A young woman with jaw-length dark hair and one thin braid at the temple, brown eyes, tan skin and a level, knowing half-smile. Wiry, shoulders relaxed. A fitted maroon jacket with a high collar, grey piping and a single toggle at the chest; grey cloth wraps on both forearms; a bright-red sash with long tails; loose black trousers with grey knee guards; dark-red leg wraps; split-toe dark shoes. No weapon and no element: her right hand is raised on the viewer’s left in a controlled two-finger gesture. The right palm faces the viewer, index and middle extended together, ring and little curled separately on the viewer’s left, and one thumb rooted on the viewer’s right across them. Flat cel-shaded illustration in the manner of a hand-drawn animated series: clean, uniform dark-brown ink outlines (#1b1410), never black and never tapered; every material in exactly two flat tones, a base and one shadow, plus a thin pale rim light along the edge facing the light; no gradients, no painted texture, no photographic detail, no lens effects, no soft shading. Bust portrait, head and shoulders, three-quarter view turned slightly toward the viewer’s right, eyes toward the viewer. Centred, the head filling about two thirds of the height, with clear space on every side because the game crops it to a circle. Flat, completely plain background of exactly #f4e9d8 (warm parchment) with no scenery, no vignette, no border and no texture. Square, 1024×1024, to be downscaled to 512×512. Colours: the nonbender palette for the sash, the trim and the element hint — base #9b7bb8, shadow #5f4677, highlight #c3a8d8, accent #e9dcf5; every other garment keeps the colours of the reference image; skin and hair in flat natural tones with one shadow each; ink #1b1410. Expression and bearing: Dry, patient, unimpressed. Same character as the reference image: same face, hair and costume.
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

Run `checklist.md` before committing. For this portrait in particular: The raised two-finger hand, the grey knee guards and the single thin braid. Plain, controlled, nothing decorative; she must not read as an acrobat or a performer.
