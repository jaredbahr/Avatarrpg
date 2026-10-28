# Portrait expression: Kaya warm — `portrait.kaya.warm`

|               |                                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Palette**   | `fire` — base `#d1462f`, light `#f0785c`, dark `#8c2416`, accent `#ffb27a`, ink `#1b1410`, background `#f4e9d8`       |
| **Reference** | `art/raw/reference/unit.fire.kaya.png` — the full-body figure; the image reference, so the portrait matches the sheet |
| **Deliver**   | `art/raw/portraits/kaya.png` (1024×1024 or larger, PNG)                                                               |
| **Ships as**  | `public/art/portraits/expressions/warm/kaya.png` (512×512)                                                            |
| **Manifest**  | `'portrait.kaya.warm': { kind: 'image', url: 'art/portraits/kaya.png', palette: 'fire' }`                             |

## Who

A young woman, lean and quick, with a high dark ponytail tied off in a red band and loose bangs falling either side of the brow. Warm tan skin, golden-brown eyes, a confident lopsided smirk.

A fitted dark-red jacket with a high collar, charcoal shoulder panels edged in gold and a row of gold frog clasps down the front, the long sleeves ending in dark leather bracers. A wide red sash at the waist with a small bronze disc buckle and two long trailing tails, over charcoal-black coat tails with gold-edged red panels. Loose black trousers tucked into dark boots bound with red bands.

A small flame is guided by her raised left palm on the viewer’s right, drawn as two flat orange-and-pale ribbons, not a glow. The palm faces the viewer with one thumb on the viewer’s left and four gently curved fingers; show palm creases and fingertip pads, not dorsal tendons or fingernails on the extended fingers.

## Signature

The high ponytail and the red sash tails. She must read as fast even standing still. The two fire characters differ by hair: hers tied up, his swept back.

## Prompt

Built-in OpenAI image edit, 2026-10-28. Input: the shipped neutral portrait; do not use another expression as the identity reference.

```text
Edit target: the shipped neutral Kaya portrait shown immediately above. Identity-preserve expression edit. Change ONLY her face to WARM: a genuine relaxed closed-mouth smile that reaches the eyes, softened friendly eyebrows, subtly lifted cheeks. Preserve exact eye shape and golden-brown iris color, nose, face shape and warm tan skin; she is the same confident young woman, now pleased to see a friend. Preserve every non-face feature exactly: hair strands, high ponytail/red tie, red/gold costume, raised hand/flame, body pose, framing and parchment background. Match existing approved soft cel-painted shading and dark-brown outline weight; no sharpening or extra softness. No teeth, blush marks, under-eye dots, new freckles, text, border or watermark. Same square composition, intended512x512 game asset.
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
