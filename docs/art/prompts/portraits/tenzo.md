# Portrait: Tenzo — `portrait.tenzo`

|               |                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Palette**   | `fire` — base `#d1462f`, light `#f0785c`, dark `#8c2416`, accent `#ffb27a`, ink `#1b1410`, background `#f4e9d8`                                                           |
| **Reference** | `art/raw/reference/unit.fire.tenzo.png` — none yet: the sheet pack `sheets/unit.fire.tenzo.md` generates it first; the image reference, so the portrait matches the sheet |
| **Deliver**   | `art/raw/portraits/tenzo.png` (1024×1024 or larger, PNG)                                                                                                                  |
| **Ships as**  | `public/art/portraits/tenzo.png` (512×512)                                                                                                                                |
| **Manifest**  | `'portrait.tenzo': { kind: 'image', url: 'art/portraits/tenzo.png', palette: 'fire' }`                                                                                    |

## Who

A young man, broad through the shoulders, with dark hair swept straight back off the brow, a calm watchful face and a faint beard shadow. Olive skin, dark eyes, the beginning of a smile and no more.

A long-sleeved red jacket with a high collar and black side panels edged in gold, closed with dark frog clasps, the cuffs turned back once. A charcoal apron-front tied at the hip under a plain red sash with short ends; loose charcoal trousers tucked into dark boots bound with red bands.

A single small, steady flame held low in one open palm at the edge of the frame, like a candle he is keeping from going out.

## Signature

The swept-back hair, the squarer build and the charcoal apron-front. Patience in the shoulders; nothing about him is hurried, and he must not be mistaken for Kaya: hair back, not up; heavier; nothing trailing.

## Prompt

Copy the whole paragraph. It carries the style block itself so nothing needs to be prepended.

```text
A young man, broad through the shoulders, with dark hair swept straight back off the brow, a calm watchful face and a faint beard shadow. Olive skin, dark eyes, the beginning of a smile and no more. A long-sleeved red jacket with a high collar and black side panels edged in gold, closed with dark frog clasps, the cuffs turned back once. A charcoal apron-front tied at the hip under a plain red sash with short ends; loose charcoal trousers tucked into dark boots bound with red bands. A single small, steady flame held low in one open palm at the edge of the frame, like a candle he is keeping from going out. Flat cel-shaded illustration in the manner of a hand-drawn animated series: clean, uniform dark-brown ink outlines (#1b1410), never black and never tapered; every material in exactly two flat tones, a base and one shadow, plus a thin pale rim light along the edge facing the light; no gradients, no painted texture, no photographic detail, no lens effects, no soft shading. Bust portrait, head and shoulders, three-quarter view turned slightly toward the viewer’s right, eyes toward the viewer. Centred, the head filling about two thirds of the height, with clear space on every side because the game crops it to a circle. Flat, completely plain background of exactly #f4e9d8 (warm parchment) with no scenery, no vignette, no border and no texture. Square, 1024×1024, to be downscaled to 512×512. Colours: the fire palette for the sash, the trim and the element hint — base #d1462f, shadow #8c2416, highlight #f0785c, accent #ffb27a; every other garment keeps the colours of the reference image; skin and hair in flat natural tones with one shadow each; ink #1b1410. Expression and bearing: Quiet and precise. Same character as the reference image: same face, hair and costume.
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

Run `checklist.md` before committing. For this portrait in particular: The swept-back hair, the squarer build and the charcoal apron-front. Patience in the shoulders; nothing about him is hurried, and he must not be mistaken for Kaya: hair back, not up; heavier; nothing trailing.
