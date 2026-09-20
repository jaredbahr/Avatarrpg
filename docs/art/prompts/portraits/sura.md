# Portrait: Sura — `portrait.sura`

|               |                                                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Palette**   | `water` — base `#3e8fb0`, light `#7ec8e3`, dark `#22566e`, accent `#cdeefb`, ink `#1b1410`, background `#f4e9d8`       |
| **Reference** | `art/raw/reference/unit.water.sura.png` — the full-body figure; the image reference, so the portrait matches the sheet |
| **Deliver**   | `art/raw/portraits/sura.png` (1024×1024 or larger, PNG)                                                                |
| **Ships as**  | `public/art/portraits/sura.png` (512×512)                                                                              |
| **Manifest**  | `'portrait.sura': { kind: 'image', url: 'art/portraits/sura.png', palette: 'water' }`                                  |

## Who

A young woman with dark hair in one long braid over the shoulder, tied off with a blue bead, and small blue beaded earrings. Deep brown skin, blue eyes, a set, determined smile.

A teal-and-navy wrap tunic with a white-edged cross-over collar and cream fur cuffs; a brown rope belt with a small round stone clasp; a navy skirt panel with a white-and-blue spiral motif at the hem; navy trousers; cream fur-topped boots cross-bound with straps. A stoppered water skin hangs in a net at the hip.

A few angular pale-blue ice crystals hover clear of her raised right palm on the viewer’s left. The palm faces the viewer with four spread fingers and one thumb on the viewer’s right: middle longest, index and ring of comparable length, little shortest. Show palm creases and fingertip pads rather than dorsal knuckle marks and fingernails on the extended fingers.

## Signature

The long braid and the water skin at the hip. She must not be mistaken for Nilak: braid down, no hood, a wider stance.

## Prompt

Copy the whole paragraph. It carries the style block itself so nothing needs to be prepended.

```text
A young woman with dark hair in one long braid over the shoulder, tied off with a blue bead, and small blue beaded earrings. Deep brown skin, blue eyes, a set, determined smile. A teal-and-navy wrap tunic with a white-edged cross-over collar and cream fur cuffs; a brown rope belt with a small round stone clasp; a navy skirt panel with a white-and-blue spiral motif at the hem; navy trousers; cream fur-topped boots cross-bound with straps. A stoppered water skin hangs in a net at the hip. A few angular pale-blue ice crystals hover clear of her raised right palm on the viewer’s left. The palm faces the viewer with four spread fingers and one thumb on the viewer’s right: middle longest, index and ring of comparable length, little shortest. Show palm creases and fingertip pads rather than dorsal knuckle marks and fingernails on the extended fingers. Flat cel-shaded illustration in the manner of a hand-drawn animated series: clean, uniform dark-brown ink outlines (#1b1410), never black and never tapered; every material in exactly two flat tones, a base and one shadow, plus a thin pale rim light along the edge facing the light; no gradients, no painted texture, no photographic detail, no lens effects, no soft shading. Bust portrait, head and shoulders, three-quarter view turned slightly toward the viewer’s right, eyes toward the viewer. Centred, the head filling about two thirds of the height, with clear space on every side because the game crops it to a circle. Flat, completely plain background of exactly #f4e9d8 (warm parchment) with no scenery, no vignette, no border and no texture. Square, 1024×1024, to be downscaled to 512×512. Colours: the water palette for the sash, the trim and the element hint — base #3e8fb0, shadow #22566e, highlight #7ec8e3, accent #cdeefb; every other garment keeps the colours of the reference image; skin and hair in flat natural tones with one shadow each; ink #1b1410. Expression and bearing: Cheerful certainty; she thinks this is going to be fun. Same character as the reference image: same face, hair and costume.
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

Run `checklist.md` before committing. For this portrait in particular: The long braid and the water skin at the hip. She must not be mistaken for Nilak: braid down, no hood, a wider stance.
