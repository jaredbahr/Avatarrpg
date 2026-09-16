# Portrait: Bo — `portrait.bo`

|               |                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Palette**   | `earth` — base `#6f9e4c`, light `#a8c686`, dark `#456330`, accent `#e0e8b0`, ink `#1b1410`, background `#f4e9d8`     |
| **Reference** | `art/raw/reference/unit.earth.bo.png` — the full-body figure; the image reference, so the portrait matches the sheet |
| **Deliver**   | `art/raw/portraits/bo.png` (1024×1024 or larger, PNG)                                                                |
| **Ships as**  | `public/art/portraits/bo.png` (512×512)                                                                              |
| **Manifest**  | `'portrait.bo': { kind: 'image', url: 'art/portraits/bo.png', palette: 'earth' }`                                    |

## Who

A young man with short tousled black hair, green eyes, tan skin and a broad grin. Broad shoulders, thick forearms.

A sleeveless moss-green tunic with a darker green collar and a gold key-pattern trim at the hem, worn over a mustard-yellow long-sleeved shirt rolled to the elbow. Brown cloth wraps on both forearms; a wide brown sash with a bronze ring; loose cream trousers; brown cloth-wrapped boots.

A fist-sized stone hovering just above one open hand at the edge of the frame.

## Signature

The sleeveless green tunic over mustard sleeves and the width of the shoulders. The two earth characters differ in cut: his sleeveless and broad, hers a cropped jacket and slight.

## Prompt

Copy the whole paragraph. It carries the style block itself so nothing needs to be prepended.

```text
A young man with short tousled black hair, green eyes, tan skin and a broad grin. Broad shoulders, thick forearms. A sleeveless moss-green tunic with a darker green collar and a gold key-pattern trim at the hem, worn over a mustard-yellow long-sleeved shirt rolled to the elbow. Brown cloth wraps on both forearms; a wide brown sash with a bronze ring; loose cream trousers; brown cloth-wrapped boots. A fist-sized stone hovering just above one open hand at the edge of the frame. Flat cel-shaded illustration in the manner of a hand-drawn animated series: clean, uniform dark-brown ink outlines (#1b1410), never black and never tapered; every material in exactly two flat tones, a base and one shadow, plus a thin pale rim light along the edge facing the light; no gradients, no painted texture, no photographic detail, no lens effects, no soft shading. Bust portrait, head and shoulders, three-quarter view turned slightly toward the viewer’s right, eyes toward the viewer. Centred, the head filling about two thirds of the height, with clear space on every side because the game crops it to a circle. Flat, completely plain background of exactly #f4e9d8 (warm parchment) with no scenery, no vignette, no border and no texture. Square, 1024×1024, to be downscaled to 512×512. Colours: the earth palette for the sash, the trim and the element hint — base #6f9e4c, shadow #456330, highlight #a8c686, accent #e0e8b0; every other garment keeps the colours of the reference image; skin and hair in flat natural tones with one shadow each; ink #1b1410. Expression and bearing: Immovable and mildly amused. Same character as the reference image: same face, hair and costume.
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

Run `checklist.md` before committing. For this portrait in particular: The sleeveless green tunic over mustard sleeves and the width of the shoulders. The two earth characters differ in cut: his sleeveless and broad, hers a cropped jacket and slight.
