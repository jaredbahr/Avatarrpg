# The style block

Every prompt pack in this folder carries this block inline, so a pack is a
complete copy-and-paste. This is the reference copy, with the reasoning.

## The paragraph

> Flat cel-shaded illustration in the manner of a hand-drawn animated series:
> clean, uniform dark-brown ink outlines (`#1b1410`), never black and never
> tapered; every material in exactly two flat tones, a base and one shadow,
> plus a thin pale rim light along the edge facing the light; no gradients, no
> painted texture, no photographic detail, no lens effects, no soft shading.

## Why each clause is there

- **Hand-drawn animated series** names a register without naming a franchise.
  Never add a title, a studio or a character name to steer the generator: the
  art bible forbids it and the prompt test fails on it.
- **Uniform dark-brown ink** is the single most recognisable rule of the look.
  Generators default to black and to tapered "sketch" lines; both read wrong
  next to the game's own drawn placeholders, which use the same brown.
- **Two flat tones per material** is what makes an asset survive being drawn
  40 pixels tall. A third tone or a gradient turns to mud at that size.
- **Rim light** is the one concession to depth, and it is a line, not a glow.
- **No texture, no lens effects** keeps a generated image from looking like a
  painting or a photograph pasted into a cartoon. Grain and depth of field are
  the two most common ways a candidate fails the checklist.

## The frame, for portraits

> Bust portrait, head and shoulders, three-quarter view turned slightly toward
> the viewer's right, eyes toward the viewer. Centred, the head filling about
> two thirds of the height, with clear space on every side because the game
> crops it to a circle. Flat, completely plain background of exactly `#f4e9d8`
> (warm parchment) with no scenery, no vignette, no border and no texture.
> Square, 1024×1024, to be downscaled to 512×512.

The circular crop is why the head sits centred with room around it: the HUD
draws every portrait inside a circle, from the 11rem dialogue medallion down
to the 2.4rem turn-strip chip.

## Palette

Locked to `src/render/palettes.ts` and `src/styles/base.css`; every pack quotes
the hex values for its element. Skin and hair are free within "flat natural
tones, one shadow each". Gold (`#d9a441`, `#f0c674`) is a UI accent and appears
on a character only as a small detail.

| Element   | Base      | Light     | Dark      | Accent    |
| --------- | --------- | --------- | --------- | --------- |
| fire      | `#d1462f` | `#f0785c` | `#8c2416` | `#ffb27a` |
| water     | `#3e8fb0` | `#7ec8e3` | `#22566e` | `#cdeefb` |
| earth     | `#6f9e4c` | `#a8c686` | `#456330` | `#e0e8b0` |
| air       | `#e8dcc0` | `#fdf6e3` | `#9a8e72` | `#fffdf5` |
| nonbender | `#9b7bb8` | `#c3a8d8` | `#5f4677` | `#e9dcf5` |
| neutral   | `#8d7d69` | `#bfae97` | `#4a3a2c` | `#f4e9d8` |
| enemy     | `#8a4b3c` | `#b8705c` | `#4d241b` | `#e5a48c` |

Ink is `#1b1410` everywhere. Parchment, the portrait background, is `#f4e9d8`.
