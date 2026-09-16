# Portrait: Wen — `portrait.wen`

|               |                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Palette**   | `nonbender` — base `#9b7bb8`, light `#c3a8d8`, dark `#5f4677`, accent `#e9dcf5`, ink `#1b1410`, background `#f4e9d8` |
| **Reference** | `art/raw/reference/unit.non.wen.png` — the full-body figure; the image reference, so the portrait matches the sheet  |
| **Deliver**   | `art/raw/portraits/wen.png` (1024×1024 or larger, PNG)                                                               |
| **Ships as**  | `public/art/portraits/wen.png` (512×512)                                                                             |
| **Manifest**  | `'portrait.wen': { kind: 'image', url: 'art/portraits/wen.png', palette: 'nonbender' }`                              |

## Who

A stocky young engineer with short tousled blond hair, brass-rimmed goggles pushed up on the forehead, brown eyes, light skin and a wide grin.

A cropped open blue work jacket with the sleeves rolled, over a cream collarless shirt; brown leather harness straps across the chest; a wide brown belt with a brass buckle, pouches and a brown cloth tied at the hip; black cargo trousers with brown knee patches; brown buckled boots over grey socks. On the arm nearer the viewer, the same arm in every frame, a bulky riveted brass-and-iron gauntlet with a pale-blue glowing cell at the wrist; the other hand in a fingerless glove.

The gauntlet raised into the bottom corner of the frame, a single small flat spark drawn as a white-and-gold star at its cell.

## Signature

The goggles on the forehead and the gauntlet. Engineer, not soldier. Wen and Riko differ in build and colour: Wen stocky in blue and brass, Riko wiry in maroon.

## Prompt

Copy the whole paragraph. It carries the style block itself so nothing needs to be prepended.

```text
A stocky young engineer with short tousled blond hair, brass-rimmed goggles pushed up on the forehead, brown eyes, light skin and a wide grin. A cropped open blue work jacket with the sleeves rolled, over a cream collarless shirt; brown leather harness straps across the chest; a wide brown belt with a brass buckle, pouches and a brown cloth tied at the hip; black cargo trousers with brown knee patches; brown buckled boots over grey socks. On the arm nearer the viewer, the same arm in every frame, a bulky riveted brass-and-iron gauntlet with a pale-blue glowing cell at the wrist; the other hand in a fingerless glove. The gauntlet raised into the bottom corner of the frame, a single small flat spark drawn as a white-and-gold star at its cell. Flat cel-shaded illustration in the manner of a hand-drawn animated series: clean, uniform dark-brown ink outlines (#1b1410), never black and never tapered; every material in exactly two flat tones, a base and one shadow, plus a thin pale rim light along the edge facing the light; no gradients, no painted texture, no photographic detail, no lens effects, no soft shading. Bust portrait, head and shoulders, three-quarter view turned slightly toward the viewer’s right, eyes toward the viewer. Centred, the head filling about two thirds of the height, with clear space on every side because the game crops it to a circle. Flat, completely plain background of exactly #f4e9d8 (warm parchment) with no scenery, no vignette, no border and no texture. Square, 1024×1024, to be downscaled to 512×512. Colours: the nonbender palette for the sash, the trim and the element hint — base #9b7bb8, shadow #5f4677, highlight #c3a8d8, accent #e9dcf5; every other garment keeps the colours of the reference image; skin and hair in flat natural tones with one shadow each; ink #1b1410. Expression and bearing: Busy; already thinking of the next problem. Same character as the reference image: same face, hair and costume.
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

Run `checklist.md` before committing. For this portrait in particular: The goggles on the forehead and the gauntlet. Engineer, not soldier. Wen and Riko differ in build and colour: Wen stocky in blue and brass, Riko wiry in maroon.
