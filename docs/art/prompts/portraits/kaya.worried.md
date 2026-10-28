# Portrait expression: Kaya worried — `portrait.kaya.worried`

|               |                                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Palette**   | `fire` — base `#d1462f`, light `#f0785c`, dark `#8c2416`, accent `#ffb27a`, ink `#1b1410`, background `#f4e9d8`       |
| **Reference** | `art/raw/reference/unit.fire.kaya.png` — the full-body figure; the image reference, so the portrait matches the sheet |
| **Deliver**   | `art/raw/portraits/kaya.png` (1024×1024 or larger, PNG)                                                               |
| **Ships as**  | `public/art/portraits/expressions/worried/kaya.png` (512×512)                                                         |
| **Manifest**  | `'portrait.kaya.worried': { kind: 'image', url: 'art/portraits/kaya.png', palette: 'fire' }`                          |

## Who

A young woman, lean and quick, with a high dark ponytail tied off in a red band and loose bangs falling either side of the brow. Warm tan skin, golden-brown eyes, a confident lopsided smirk.

A fitted dark-red jacket with a high collar, charcoal shoulder panels edged in gold and a row of gold frog clasps down the front, the long sleeves ending in dark leather bracers. A wide red sash at the waist with a small bronze disc buckle and two long trailing tails, over charcoal-black coat tails with gold-edged red panels. Loose black trousers tucked into dark boots bound with red bands.

A small flame is guided by her raised left palm on the viewer’s right, drawn as two flat orange-and-pale ribbons, not a glow. The palm faces the viewer with one thumb on the viewer’s left and four gently curved fingers; show palm creases and fingertip pads, not dorsal tendons or fingernails on the extended fingers.

## Signature

The high ponytail and the red sash tails. She must read as fast even standing still. The two fire characters differ by hair: hers tied up, his swept back.

## Prompt

Built-in OpenAI image edit, 2026-10-28. Input: the shipped neutral portrait; do not use another expression as the identity reference.

```text
Edit target: the shipped neutral Kaya portrait shown immediately above. Identity-preserve dialogue expression edit. Make ONLY her facial expression WORRIED / concerned: inner brows subtly raised and drawn together, eyes worried while retaining their exact almond shape and golden-brown irises, closed mouth slightly tense. Same young woman, same nose, jaw, skin tone, face angle. Preserve hair and every strand/ponytail/red tie, costume, raised hand, flame, body pose, framing, parchment background, outline weight and the existing approved soft cel-painted rendering exactly. No tears, under-eye dots, new markings, teeth, text, border, watermark or redesigned features. Do not sharpen or soften. Square composition identical to reference; game output will be512x512. Expression must read distinctly worried, while recognizably the same Kaya.
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

Run `checklist.md` before committing. For this portrait in particular: The high ponytail and the red sash tails. She must read as fast even standing still. The two fire characters differ by hair: hers tied up, his swept back.
